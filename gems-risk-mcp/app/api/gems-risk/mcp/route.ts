import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import {
  DATA_SOURCES,
  DATA_SOURCE_INFO,
  PROJECT_TYPES,
  PROJECT_TYPE_KEYS,
  PROJECT_TYPE_NAMES,
  AREAS,
  AREA_KEYS,
  AREA_NAMES,
  COUNTRY_NAMES,
  INCOME_GROUPS,
  REGIONS,
  resolveCountry,
  SECTORS,
  SECTOR_KEYS,
  SECTOR_NAMES,
  SENIORITY_NAMES,
  type DataSource,
} from '@/lib/gems-risk/catalog';
import { Data360Error } from '@/lib/gems-risk/data360';
import { GLOBAL_TOTAL, getHistory, getRates, type RateStat, type Selection, type Slice } from '@/lib/gems-risk/stats';
import pkg from '@/package.json';

// Vercel function limit; Data360 calls are cached, but a cold call may chain several requests.
export const maxDuration = 60;

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const SOURCE_DESCRIPTION =
  'Data sources: "sovereign" (sovereign and sovereign-guaranteed debt), "public" (sub-sovereign public sector), ' +
  '"private" (corporate/private sector, largest sample). Default: private.';

const dataSourceParam = z.enum(DATA_SOURCES).optional().describe(SOURCE_DESCRIPTION);
const regionParam = z.enum(AREA_KEYS);
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

const pct = (value: number) => `${value.toFixed(2)}%`;

function text(body: string, isError = false): ToolResult {
  return isError ? { content: [{ type: 'text', text: body }], isError } : { content: [{ type: 'text', text: body }] };
}

/** Run a tool body, turning Data360 failures into readable tool errors. */
async function guarded(run: () => Promise<string>): Promise<ToolResult> {
  try {
    return text(await run());
  } catch (error) {
    if (error instanceof Data360Error) {
      console.error(`Data360 ${error.kind}: ${error.message}`);
      return text(`⚠️ **World Bank Data360 request failed** (${error.kind})\n\n${error.message}`, true);
    }
    throw error;
  }
}

function period(source: DataSource, vintage: string): string {
  return `${DATA_SOURCE_INFO[source].coverageStart}–${vintage}`;
}

function attribution(source: DataSource, vintage: string, indicators: string[]): string {
  const info = DATA_SOURCE_INFO[source];
  const stale = Number(vintage) < new Date().getFullYear() - 1
    ? ` ⚠️ This is the latest GEMs publication on Data360; it may predate the current GEMs report.`
    : '';
  return (
    `*Source: World Bank Data360, IFC GEMs (${indicators.join(', ')}), ${info.label} — ${info.description}. ` +
    `Publication vintage ${vintage}; rates are averages over ${period(source, vintage)}.${stale}*`
  );
}

function areaName(code: string): string {
  return AREA_NAMES[code] ?? COUNTRY_NAMES[code] ?? code;
}

function defaultRateText(stat: RateStat): string {
  const ci = stat.ci90 ? ` (90% CI ${stat.ci90[0].toFixed(2)}–${stat.ci90[1].toFixed(2)}%)` : '';
  return pct(stat.rate.value) + ci;
}

/** Countries with published default rates for `source`. */
async function countriesWithData(source: DataSource): Promise<string[]> {
  const byArea = await getRates(source, 'default', GLOBAL_TOTAL, 'REF_AREA');
  return [...byArea.keys()].filter((code) => COUNTRY_NAMES[code]).sort((a, b) => COUNTRY_NAMES[a].localeCompare(COUNTRY_NAMES[b]));
}

const COMPARISON_GROUPS = {
  region: Object.values(REGIONS) as string[],
  income: ['WLD', ...Object.values(INCOME_GROUPS)],
  country: Object.keys(COUNTRY_NAMES),
};

const SELECTION_METHOD_TEXT: Record<Selection['method'], string> = {
  'unique': '',
  'count-anchor': 'the value equal to defaults ÷ observations of the full sample',
  'historical-anchor': 'closest to the period average reconstructed from the annual series',
  'published-precision': 'the only value at published precision',
  'first-listed': 'first value listed by Data360 — treat as uncertain',
};

/** Disclose when Data360 returned several values for one breakdown; empty when unambiguous. */
function ambiguityNote(label: string, rate: Selection): string {
  if (rate.candidates.length < 2) return '';
  return (
    `\n⚠️ ${label}: Data360 returned ${rate.candidates.length} values for this breakdown ` +
    `(${rate.candidates.map(pct).join(', ')}) that differ by a dimension the Data360 API does not expose. ` +
    `Showing ${pct(rate.value)}: ${SELECTION_METHOD_TEXT[rate.method]}.\n`
  );
}

function expectedLoss(defaultRate: number, recoveryRate: number): number {
  return (defaultRate * (100 - recoveryRate)) / 100;
}

/** Sample size line; recovery tables carry only defaults and signed amount. */
function sampleLine(stat: RateStat, label = 'Sample'): string {
  const parts: string[] = [];
  if (stat.counterparts !== undefined) parts.push(`${stat.counterparts.toLocaleString('en-US')} counterparts`);
  if (stat.observations !== undefined) parts.push(`${stat.observations.toLocaleString('en-US')} counterpart-years observed`);
  if (stat.defaults !== undefined) parts.push(`${stat.defaults.toLocaleString('en-US')} ${stat.defaultsUnit}`);
  if (stat.signedAmountEURm !== undefined) {
    parts.push(`EUR ${(stat.signedAmountEURm / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} bn signed`);
  }
  return parts.length ? `**${label}:** ${parts.join(' · ')}\n` : '';
}

/** Sample lines for a default/recovery pair. */
function sampleLines(dr?: RateStat, rr?: RateStat): string {
  return (dr ? sampleLine(dr, 'Default sample') : '') + (rr ? sampleLine(rr, 'Recovery sample') : '');
}

/** Table marker for ambiguous values: † resolved by a selection rule, ‡ unresolved. */
function marker(rate: Selection): string {
  if (rate.candidates.length < 2) return '';
  return rate.method === 'first-listed' ? ' ‡' : ' †';
}

function markerLegend(rates: Selection[]): string {
  const marks = new Set(rates.map(marker));
  let out = '';
  if (marks.has(' †')) {
    out +=
      '† Data360 returned several values for this breakdown that differ by a dimension its API does not expose; ' +
      'the headline value identified from the sample counts, the annual series or published precision is shown.\n';
  }
  if (marks.has(' ‡')) {
    out += '‡ Same ambiguity, but no rule identifies the headline; the first value listed by Data360 is shown — treat as uncertain.\n';
  }
  return out;
}

function noData(what: string, filters: string[]): string {
  return (
    `ℹ️ **No ${what} published in Data360 for:**\n\n${filters.map((f) => `- ${f}`).join('\n')}\n\n` +
    'IFC GEMs publishes sector, project-type and seniority breakdowns mainly at the global level, ' +
    'and sovereign/public statistics for fewer breakdowns than private. Try region "global" or data_source "private".'
  );
}

async function single(source: DataSource, kind: 'default' | 'recovery', slice: Slice): Promise<RateStat | undefined> {
  return (await getRates(source, kind, slice)).get(slice.REF_AREA);
}

/** Compare a default rate with the global average of the same data source. */
function benchmarkLine(source: DataSource, defaultRate: number, global: RateStat | undefined): string {
  if (!global) return '';
  const diff = defaultRate - global.rate.value;
  const relation = Math.abs(diff) < 0.005 ? 'in line with' : diff < 0 ? 'below' : 'above';
  return (
    `Default rate is **${relation}** the global ${DATA_SOURCE_INFO[source].label.toLowerCase()} average ` +
    `(${pct(global.rate.value)}) by ${Math.abs(diff).toFixed(2)} percentage points.\n\n`
  );
}

interface BreakdownRow {
  name: string;
  defaultStat?: RateStat;
  recoveryStat?: RateStat;
}

function breakdownTable(label: string, rows: BreakdownRow[]): string {
  let out = `| ${label} | Default Rate | Recovery Rate | Expected Loss |\n|---|---|---|---|\n`;
  for (const { name, defaultStat, recoveryStat } of rows) {
    const dr = defaultStat ? pct(defaultStat.rate.value) + marker(defaultStat.rate) : 'n/a';
    const rr = recoveryStat ? pct(recoveryStat.rate.value) + marker(recoveryStat.rate) : 'n/a';
    const el = defaultStat && recoveryStat ? pct(expectedLoss(defaultStat.rate.value, recoveryStat.rate.value)) : 'n/a';
    out += `| ${name} | ${dr} | ${rr} | ${el} |\n`;
  }
  const rates = rows.flatMap((r) => [r.defaultStat?.rate, r.recoveryStat?.rate]).filter((r) => r !== undefined);
  return `${out}\n${markerLegend(rates)}n/a = not published for this breakdown.\n`;
}

/** Default and recovery stats for every value of one dimension; rows sorted by default rate. */
async function breakdown(
  source: DataSource,
  slice: Slice,
  dimension: 'SECTOR' | 'PROJECT_TYPE',
  names: Record<string, string>,
): Promise<{ rows: BreakdownRow[]; vintage?: string; defaults: Map<string, RateStat>; recoveries: Map<string, RateStat> }> {
  const [defaults, recoveries] = await Promise.all([
    getRates(source, 'default', slice, dimension),
    getRates(source, 'recovery', slice, dimension),
  ]);
  // Codes without a known label (e.g. SECTOR=MXS) are listed by code rather than dropped.
  const codes = [...new Set([...defaults.keys(), ...recoveries.keys()])].filter((c) => c !== '_T');
  const rows = codes
    .map((code) => ({ name: names[code] ?? code, defaultStat: defaults.get(code), recoveryStat: recoveries.get(code) }))
    .sort((a, b) => (a.defaultStat?.rate.value ?? Infinity) - (b.defaultStat?.rate.value ?? Infinity));
  const vintage = [...defaults.values(), ...recoveries.values()][0]?.vintage;
  return { rows, vintage, defaults, recoveries };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'get_default_rates',
      {
        title: 'Default rates by region',
        description: `Average annual default rate for emerging-market lending in a region, with sample size. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({ region: regionParam.describe('Region or income group to query'), data_source: dataSourceParam }),
        annotations: READ_ONLY,
      },
      ({ region, data_source: source = 'private' }) =>
        guarded(async () => {
          const code = AREAS[region];
          const stat = await single(source, 'default', { ...GLOBAL_TOTAL, REF_AREA: code });
          if (!stat) return noData('default rate', [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`]);
          return (
            `# Default Rates: ${AREA_NAMES[code]}\n\n` +
            `**Average annual default rate:** ${defaultRateText(stat)}\n` +
            `**Period:** ${period(source, stat.vintage)}\n` +
            sampleLine(stat) +
            ambiguityNote('Default rate', stat.rate) +
            `\n${attribution(source, stat.vintage, [DATA_SOURCE_INFO[source].defaultIndicator])}`
          );
        }),
    );

    server.registerTool(
      'get_recovery_rates',
      {
        title: 'Recovery rates by region',
        description: `Average recovery rate on defaulted exposures in a region. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({ region: regionParam.describe('Region or income group to query'), data_source: dataSourceParam }),
        annotations: READ_ONLY,
      },
      ({ region, data_source: source = 'private' }) =>
        guarded(async () => {
          const code = AREAS[region];
          const stat = await single(source, 'recovery', { ...GLOBAL_TOTAL, REF_AREA: code });
          if (!stat) return noData('recovery rate', [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`]);
          return (
            `# Recovery Rates: ${AREA_NAMES[code]}\n\n` +
            `**Average recovery rate:** ${pct(stat.rate.value)}\n` +
            `**Period:** ${period(source, stat.vintage)}\n` +
            sampleLine(stat) +
            ambiguityNote('Recovery rate', stat.rate) +
            `\nWhen loans default, lenders recover on average ${pct(stat.rate.value)} of the exposure ` +
            '(discounted post-default cash flows over the outstanding amount).\n\n' +
            attribution(source, stat.vintage, [DATA_SOURCE_INFO[source].recoveryIndicator])
          );
        }),
    );

    server.registerTool(
      'query_credit_risk',
      {
        title: 'Credit risk profile',
        description: `Credit risk profile for a region: default rate, recovery rate, expected loss and sample size. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({ region: regionParam.describe('Region or income group to analyze'), data_source: dataSourceParam }),
        annotations: READ_ONLY,
      },
      ({ region, data_source: source = 'private' }) =>
        guarded(async () => {
          const code = AREAS[region];
          const slice = { ...GLOBAL_TOTAL, REF_AREA: code };
          const [dr, rr] = await Promise.all([single(source, 'default', slice), single(source, 'recovery', slice)]);
          if (!dr && !rr) return noData('credit risk data', [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`]);
          const vintage = (dr ?? rr)!.vintage;
          let out = `# Credit Risk Profile: ${AREA_NAMES[code]}\n\n## Key Metrics\n\n`;
          out += `**Default rate:** ${dr ? defaultRateText(dr) : 'not published'}\n`;
          out += `**Recovery rate:** ${rr ? pct(rr.rate.value) : 'not published'}\n`;
          out += `**Period:** ${period(source, vintage)}\n`;
          out += sampleLines(dr, rr);
          if (dr) out += ambiguityNote('Default rate', dr.rate);
          if (rr) out += ambiguityNote('Recovery rate', rr.rate);
          out += '\n## Risk Assessment\n\n';
          out +=
            dr && rr
              ? `**Expected loss:** ${pct(expectedLoss(dr.rate.value, rr.rate.value))} per year ` +
                '(default rate × (1 − recovery rate)).\n\n'
              : 'Expected loss not computed: both default and recovery rates are required.\n\n';
          const info = DATA_SOURCE_INFO[source];
          return out + attribution(source, vintage, [info.defaultIndicator, info.recoveryIndicator]);
        }),
    );

    server.registerTool(
      'get_sector_analysis',
      {
        title: 'Credit risk by sector',
        description: `Global default and recovery rates by economic sector (IFC categories and GICS sectors), or one sector in detail. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({
          sector: z.enum(SECTOR_KEYS).optional().describe('Sector to analyze, or "all" (default) for a comparison table'),
          data_source: dataSourceParam,
        }),
        annotations: READ_ONLY,
      },
      ({ sector = 'all', data_source: source = 'private' }) =>
        guarded(async () => {
          const info = DATA_SOURCE_INFO[source];
          const code = SECTORS[sector];
          if (code === '_T') {
            const { rows, vintage } = await breakdown(source, GLOBAL_TOTAL, 'SECTOR', SECTOR_NAMES);
            if (!rows.length || !vintage) return noData('sector breakdown', [`Data source: ${source}`]);
            return (
              `# Credit Risk by Sector (Global, ${info.label})\n\n` +
              breakdownTable('Sector', rows) +
              `\n${attribution(source, vintage, [info.defaultIndicator, info.recoveryIndicator])}`
            );
          }

          const slice = { ...GLOBAL_TOTAL, SECTOR: code };
          const [dr, rr, global] = await Promise.all([
            single(source, 'default', slice),
            single(source, 'recovery', slice),
            single(source, 'default', GLOBAL_TOTAL),
          ]);
          if (!dr && !rr) return noData('sector data', [`Sector: ${SECTOR_NAMES[code]}`, `Data source: ${source}`]);
          let out = `# Sector Analysis: ${SECTOR_NAMES[code]} (Global)\n\n`;
          out += `**Default rate:** ${dr ? defaultRateText(dr) : 'not published'}\n`;
          out += `**Recovery rate:** ${rr ? pct(rr.rate.value) : 'not published'}\n`;
          if (dr && rr) out += `**Expected loss:** ${pct(expectedLoss(dr.rate.value, rr.rate.value))}\n`;
          out += `**Period:** ${period(source, (dr ?? rr)!.vintage)}\n`;
          out += sampleLines(dr, rr);
          if (dr) out += ambiguityNote('Default rate', dr.rate);
          if (rr) out += ambiguityNote('Recovery rate', rr.rate);
          out += '\n';
          if (dr) out += benchmarkLine(source, dr.rate.value, global);
          return out + attribution(source, (dr ?? rr)!.vintage, [info.defaultIndicator, info.recoveryIndicator]);
        }),
    );

    server.registerTool(
      'compare_regions',
      {
        title: 'Compare regions, income groups or countries',
        description:
          `Rank regions, income groups or countries by default and/or recovery rate, with sample sizes. ${SOURCE_DESCRIPTION} ` +
          'Country rankings exist for private (90 countries) and public (14) data.',
        inputSchema: z.object({
          metric: z.enum(['default-rate', 'recovery-rate', 'both']).describe('Metric to compare'),
          grouping: z.enum(['region', 'income', 'country']).optional().describe('What to rank (default: region)'),
          data_source: dataSourceParam,
        }),
        annotations: READ_ONLY,
      },
      ({ metric, grouping = 'region', data_source: source = 'private' }) =>
        guarded(async () => {
          const info = DATA_SOURCE_INFO[source];
          const codes = COMPARISON_GROUPS[grouping];
          const wanted = new Set(codes);
          const kinds = metric === 'both' ? (['default', 'recovery'] as const) : metric === 'default-rate' ? (['default'] as const) : (['recovery'] as const);
          const results = await Promise.all(kinds.map((kind) => getRates(source, kind, GLOBAL_TOTAL, 'REF_AREA')));

          const heading = { region: 'Regional', income: 'Income Group', country: 'Country' }[grouping];
          let out = `# ${heading} Credit Risk Comparison (${info.label})\n\n`;
          let vintage: string | undefined;
          kinds.forEach((kind, i) => {
            const stats = [...results[i].values()].filter((s) => wanted.has(s.code));
            stats.sort((a, b) => (kind === 'default' ? a.rate.value - b.rate.value : b.rate.value - a.rate.value));
            out += `## ${kind === 'default' ? 'Default Rates (lowest first)' : 'Recovery Rates (highest first)'}\n\n`;
            stats.forEach((s, rank) => {
              const n = kind === 'default' ? s.counterparts ?? s.observations : s.defaults;
              const unit = kind === 'default' ? (s.counterparts !== undefined ? 'counterparts' : 'observations') : s.defaultsUnit;
              const sample = n !== undefined ? ` (n = ${n.toLocaleString('en-US')} ${unit})` : '';
              out += `${rank + 1}. **${areaName(s.code)}:** ${pct(s.rate.value)}${marker(s.rate)}${sample}\n`;
            });
            const missing = codes.filter((c) => !results[i].has(c));
            if (grouping === 'country') out += `\n${stats.length} of ${codes.length} GEMs countries published.\n`;
            else if (missing.length) out += `\nNot published: ${missing.map(areaName).join(', ')}\n`;
            out += '\n';
            vintage ??= stats[0]?.vintage;
          });
          if (!vintage) return noData(`${heading.toLowerCase()} data`, [`Data source: ${source}`]);
          if (grouping === 'country') out += 'Small samples make country rates volatile; weigh them by n.\n\n';
          const shown = results.flatMap((r) => [...r.values()].filter((s) => wanted.has(s.code)).map((s) => s.rate));
          out += markerLegend(shown) + '\n';
          return out + attribution(source, vintage, kinds.map((k) => (k === 'default' ? info.defaultIndicator : info.recoveryIndicator)));
        }),
    );

    server.registerTool(
      'get_project_type_analysis',
      {
        title: 'Credit risk by project type',
        description: `Global default and recovery rates by financing type (corporate, project, structured finance, ...). ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({
          projectType: z.enum(PROJECT_TYPE_KEYS).optional().describe('Project type to analyze, or "all" (default) for a comparison table'),
          data_source: dataSourceParam,
        }),
        annotations: READ_ONLY,
      },
      ({ projectType = 'all', data_source: source = 'private' }) =>
        guarded(async () => {
          const info = DATA_SOURCE_INFO[source];
          const { rows, vintage } = await breakdown(source, GLOBAL_TOTAL, 'PROJECT_TYPE', PROJECT_TYPE_NAMES);
          const code = PROJECT_TYPES[projectType];
          const selected = code === '_T' ? rows : rows.filter((r) => r.name === PROJECT_TYPE_NAMES[code]);
          if (!selected.length || !vintage) {
            return noData('project type data', [`Project type: ${PROJECT_TYPE_NAMES[code]}`, `Data source: ${source}`]);
          }
          let out = `# Credit Risk by Project Type (Global, ${info.label})\n\n` + breakdownTable('Project Type', selected);
          const withDefault = selected.filter((r) => r.defaultStat);
          if (withDefault.length > 1) {
            const lowest = withDefault[0];
            const highest = withDefault[withDefault.length - 1];
            out += `\n**Lowest default rate:** ${lowest.name} (${pct(lowest.defaultStat!.rate.value)})\n`;
            out += `**Highest default rate:** ${highest.name} (${pct(highest.defaultStat!.rate.value)})\n`;
          }
          return out + `\n${attribution(source, vintage, [info.defaultIndicator, info.recoveryIndicator])}`;
        }),
    );

    server.registerTool(
      'get_time_series',
      {
        title: 'Historical credit risk trend',
        description: `Annual default or recovery rates over recent years for a region. ${SOURCE_DESCRIPTION} Sovereign history is published for the global aggregate only.`,
        inputSchema: z.object({
          region: regionParam.optional().describe('Region to analyze (default: global); income groups have no history'),
          years: z.number().int().min(1).max(45).optional().describe('Number of most recent published years (default: 10)'),
          metric: z.enum(['default-rate', 'recovery-rate']).optional().describe('Series to return (default: default-rate)'),
          data_source: dataSourceParam,
        }),
        annotations: READ_ONLY,
      },
      ({ region = 'global', years = 10, metric = 'default-rate', data_source: source = 'private' }) =>
        guarded(async () => {
          const code = AREAS[region];
          const kind = metric === 'default-rate' ? 'default' : 'recovery';
          const label = kind === 'default' ? 'Default Rate' : 'Recovery Rate';
          const history = await getHistory(source, kind, code);
          const points = history.points.slice(-years);
          if (!points.length) return noData(`${label.toLowerCase()} history`, [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`]);

          const first = points[0];
          const last = points[points.length - 1];
          const rates = points.map((p) => p.rate);
          const change = last.rate - first.rate;
          // Least-squares slope over the shown years: robust to a noisy first or last year, unlike the endpoints.
          const meanYear = points.reduce((s, p) => s + p.year, 0) / points.length;
          const meanRate = rates.reduce((s, r) => s + r, 0) / rates.length;
          const sxx = points.reduce((s, p) => s + (p.year - meanYear) ** 2, 0);
          const slope = sxx > 0 ? points.reduce((s, p) => s + (p.year - meanYear) * (p.rate - meanRate), 0) / sxx : 0;
          const trend =
            points.length < 3
              ? 'n/a (fewer than 3 years)'
              : `${slope > 0.005 ? '📈 Increasing' : slope < -0.005 ? '📉 Decreasing' : '➡️ Flat'} ` +
                `(${slope > 0 ? '+' : ''}${slope.toFixed(2)} pp per year, least-squares fit)`;
          const span = last.year - first.year + 1;

          let out = `# Historical ${label}: ${AREA_NAMES[code]} (${DATA_SOURCE_INFO[source].label})\n\n`;
          out += `**Period:** ${first.year}–${last.year}`;
          out += points.length < span ? ` (${points.length} published years)\n\n` : ` (${points.length} years)\n\n`;
          out += '## Summary\n\n';
          out += `- **Latest (${last.year}):** ${pct(last.rate)}\n`;
          out += `- **Average of annual rates:** ${pct(rates.reduce((s, r) => s + r, 0) / rates.length)}\n`;
          out += `- **Highest:** ${pct(Math.max(...rates))}\n`;
          out += `- **Lowest:** ${pct(Math.min(...rates))}\n`;
          out += `- **Change ${first.year}→${last.year}:** ${change > 0 ? '+' : ''}${change.toFixed(2)} pp\n`;
          out += `- **Trend:** ${trend}\n\n`;
          out += `## Year-by-Year\n\n| Year | ${label} | Change |\n|---|---|---|\n`;
          points.forEach((p, i) => {
            const delta = i > 0 ? p.rate - points[i - 1].rate : undefined;
            out += `| ${p.year} | ${pct(p.rate)} | ${delta === undefined ? '-' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} pp`} |\n`;
          });
          const conflicts = history.conflictingYears.filter((y) => y >= first.year);
          if (conflicts.length) {
            out += `\n⚠️ Data360 returned conflicting values for ${conflicts.join(', ')}; the first listed value is shown.\n`;
          }
          const info = DATA_SOURCE_INFO[source];
          out += `\n*Source: World Bank Data360, IFC GEMs (${kind === 'default' ? info.defaultHistory : info.recoveryHistory}), ${info.label} — ${info.description}.*`;
          return out;
        }),
    );

    server.registerTool(
      'get_seniority_analysis',
      {
        title: 'Recovery by debt seniority',
        description: `Recovery rates by debt seniority (senior secured, senior unsecured, subordinated, ...). Published for the global aggregate of public and private data. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({ region: regionParam.optional().describe('Region to analyze (default: global)'), data_source: dataSourceParam }),
        annotations: READ_ONLY,
      },
      ({ region = 'global', data_source: source = 'private' }) =>
        guarded(async () => {
          const code = AREAS[region];
          const stats = await getRates(source, 'recovery', { ...GLOBAL_TOTAL, REF_AREA: code }, 'SENIORITY');
          const levels = [...stats.values()].filter((s) => s.code !== '_T').sort((a, b) => b.rate.value - a.rate.value);
          if (!levels.length) return noData('seniority breakdown', [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`]);

          let out = `# Recovery by Debt Seniority: ${AREA_NAMES[code]} (${DATA_SOURCE_INFO[source].label})\n\n`;
          out += '| Seniority | Recovery Rate | Sample |\n|---|---|---|\n';
          for (const s of levels) {
            const sample = s.defaults !== undefined ? `${s.defaults.toLocaleString('en-US')} ${s.defaultsUnit}` : '';
            out += `| ${SENIORITY_NAMES[s.code] ?? s.code} | ${pct(s.rate.value)} | ${sample} |\n`;
          }
          for (const s of levels) out += ambiguityNote(SENIORITY_NAMES[s.code] ?? s.code, s.rate);
          const ss = stats.get('SS');
          const su = stats.get('SU');
          if (ss && su) {
            const premium = ss.rate.value - su.rate.value;
            out += `\n**Security premium (secured − unsecured):** ${premium.toFixed(2)} pp of recovery\n`;
          }
          const overall = stats.get('_T');
          if (overall) out += `**All seniority levels:** ${pct(overall.rate.value)}\n${ambiguityNote('All seniority levels', overall.rate)}`;
          return out + `\n${attribution(source, levels[0].vintage, [DATA_SOURCE_INFO[source].recoveryIndicator])}`;
        }),
    );

    server.registerTool(
      'query_multidimensional',
      {
        title: 'Multi-dimensional credit risk query',
        description:
          'Default and recovery rates for a region + sector + project type combination. For private data, sectors ' +
          '(IFC categories and GICS) are published per region; public sector breakdowns and project types only globally. ' +
          `Combinations of sector and project type are not published. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({
          region: regionParam.optional().describe('Region filter (default: global)'),
          sector: z.enum(SECTOR_KEYS).optional().describe('Sector filter (default: all sectors)'),
          projectType: z.enum(PROJECT_TYPE_KEYS).optional().describe('Project type filter (default: all project types)'),
          data_source: dataSourceParam,
        }),
        annotations: READ_ONLY,
      },
      ({ region = 'global', sector = 'all', projectType = 'all', data_source: source = 'private' }) =>
        guarded(async () => {
          const slice: Slice = { ...GLOBAL_TOTAL, REF_AREA: AREAS[region], SECTOR: SECTORS[sector], PROJECT_TYPE: PROJECT_TYPES[projectType] };
          const filters = [
            `Region: ${AREA_NAMES[slice.REF_AREA]}`,
            `Sector: ${SECTOR_NAMES[slice.SECTOR]}`,
            `Project type: ${PROJECT_TYPE_NAMES[slice.PROJECT_TYPE]}`,
            `Data source: ${source}`,
          ];
          const [dr, rr, global] = await Promise.all([
            single(source, 'default', slice),
            single(source, 'recovery', slice),
            single(source, 'default', GLOBAL_TOTAL),
          ]);
          if (!dr && !rr) return noData('data', filters);

          let out = `# Multi-Dimensional Credit Risk Analysis\n\n## Filters\n\n${filters.map((f) => `- ${f}`).join('\n')}\n\n`;
          out += '## Risk Metrics\n\n| Metric | Value |\n|---|---|\n';
          out += `| Default rate | ${dr ? defaultRateText(dr) : 'not published'} |\n`;
          out += `| Recovery rate | ${rr ? pct(rr.rate.value) : 'not published'} |\n`;
          out += `| Expected loss | ${dr && rr ? pct(expectedLoss(dr.rate.value, rr.rate.value)) : 'n/a'} |\n`;
          if (dr) out += ambiguityNote('Default rate', dr.rate);
          if (rr) out += ambiguityNote('Recovery rate', rr.rate);
          out += '\n';
          out += sampleLines(dr, rr);
          if (dr) out += '\n' + benchmarkLine(source, dr.rate.value, global);
          const info = DATA_SOURCE_INFO[source];
          return out + attribution(source, (dr ?? rr)!.vintage, [info.defaultIndicator, info.recoveryIndicator]);
        }),
    );

    server.registerTool(
      'get_country_risk',
      {
        title: 'Country credit risk',
        description:
          'Credit risk profile for one country: default rate with 90% confidence interval, recovery rate, expected loss, ' +
          'sample size, sector breakdown and recent annual default rates. Country statistics exist for private sector ' +
          'lending (90 countries) and public sector lending (14 countries); none for sovereign. Default data source: private.',
        inputSchema: z.object({
          country: z.string().min(2).max(60).describe('ISO3 code (e.g. "KEN") or English country name (e.g. "Kenya")'),
          years: z.number().int().min(1).max(45).optional().describe('Years of annual default-rate history (default: 10)'),
          data_source: z.enum(['private', 'public']).optional().describe('"private" (default) or "public"'),
        }),
        annotations: READ_ONLY,
      },
      ({ country, years = 10, data_source: source = 'private' }) =>
        guarded(async () => {
          const match = resolveCountry(country);
          if ('error' in match) return `ℹ️ ${match.error}`;
          const code = match.code;
          const name = areaName(code);
          const info = DATA_SOURCE_INFO[source];
          const slice = { ...GLOBAL_TOTAL, REF_AREA: code };
          const [sectors, history, global] = await Promise.all([
            breakdown(source, slice, 'SECTOR', SECTOR_NAMES),
            getHistory(source, 'default', code),
            single(source, 'default', GLOBAL_TOTAL),
          ]);
          const dr = sectors.defaults.get('_T');
          const rr = sectors.recoveries.get('_T');
          if (!dr && !rr) {
            const available = await countriesWithData(source);
            return (
              noData('country data', [`Country: ${name} (${code})`, `Data source: ${source}`]) +
              `\n\nCountries with ${source} data (${available.length}): ` +
              (available.length ? available.map((c) => `${COUNTRY_NAMES[c]} (${c})`).join(', ') : 'none')
            );
          }

          const vintage = (dr ?? rr)!.vintage;
          let out = `# Country Credit Risk: ${name} (${info.label})\n\n## Key Metrics\n\n`;
          out += `**Default rate:** ${dr ? defaultRateText(dr) : 'not published'}\n`;
          out += `**Recovery rate:** ${rr ? pct(rr.rate.value) : 'not published'}\n`;
          if (dr && rr) out += `**Expected loss:** ${pct(expectedLoss(dr.rate.value, rr.rate.value))} per year\n`;
          out += `**Period:** ${period(source, vintage)}\n`;
          out += sampleLines(dr, rr);
          if (dr) out += ambiguityNote('Default rate', dr.rate);
          if (rr) out += ambiguityNote('Recovery rate', rr.rate);
          if (dr?.counterparts !== undefined && dr.counterparts < 100) {
            out += `\n⚠️ Small sample (${dr.counterparts} counterparts): treat the rate as indicative and weigh the confidence interval.\n`;
          }
          out += '\n';
          if (dr) out += benchmarkLine(source, dr.rate.value, global);

          if (sectors.rows.length) out += `## By Sector\n\n${breakdownTable('Sector', sectors.rows)}\n`;

          const points = history.points.slice(-years);
          if (points.length) {
            out += `## Annual Default Rates (${points[0].year}–${points[points.length - 1].year})\n\n| Year | Default Rate |\n|---|---|\n`;
            for (const p of points) out += `| ${p.year} | ${pct(p.rate)} |\n`;
            out += '\n';
          }
          return out + attribution(source, vintage, [info.defaultIndicator, info.recoveryIndicator, info.defaultHistory]);
        }),
    );
  },
  { serverInfo: { name: 'gems-risk', version: pkg.version } },
);

export { handler as GET, handler as POST, handler as DELETE };
