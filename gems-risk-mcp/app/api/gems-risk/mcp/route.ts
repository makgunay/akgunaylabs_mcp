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
  CURRENCY_TYPE_NAMES,
  RETURNS_INDICATOR,
  SOVEREIGN_BENCHMARK_INDICATOR,
  type DataSource,
} from '@/lib/gems-risk/catalog';
import { Data360Error } from '@/lib/gems-risk/data360';
import {
  expectedLoss,
  newOutput,
  rateRecord,
  selectionOutput,
  ToolOutputSchema,
  type OutputRecord,
  type ToolOutput,
} from '@/lib/gems-risk/output';
import {
  GLOBAL_TOTAL,
  getHistory,
  getRates,
  getReturns,
  getSovereignBenchmark,
  type ReturnEntry,
  type History,
  type RateStat,
  type Selection,
  type Slice,
} from '@/lib/gems-risk/stats';
import pkg from '@/package.json';

// Vercel function limit; Data360 calls are cached, but a cold call may chain several requests.
export const maxDuration = 60;

type ToolResult = { content: { type: 'text'; text: string }[]; structuredContent: ToolOutput; isError?: boolean };

/** Markdown answer plus the same figures as structured output. */
interface ToolAnswer {
  text: string;
  data: ToolOutput;
}

const SOURCE_DESCRIPTION =
  'Data sources: "sovereign" (sovereign and sovereign-guaranteed debt), "public" (sub-sovereign public sector), ' +
  '"private" (corporate/private sector, largest sample). Default: private.';

const dataSourceParam = z.enum(DATA_SOURCES).optional().describe(SOURCE_DESCRIPTION);
const regionParam = z.enum(AREA_KEYS);
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

const pct = (value: number) => `${value.toFixed(2)}%`;

/**
 * Run a tool body, turning Data360 failures into readable tool errors. `out` is the tool's output under
 * construction, so an error still reports the filters and any notes gathered before the failure.
 */
async function guarded(out: ToolOutput, run: () => Promise<ToolAnswer>): Promise<ToolResult> {
  try {
    const { text, data } = await run();
    return { content: [{ type: 'text', text }], structuredContent: data };
  } catch (error) {
    if (error instanceof Data360Error) {
      console.error(`Data360 ${error.kind}: ${error.message}`);
      return {
        content: [{ type: 'text', text: `⚠️ **World Bank Data360 request failed** (${error.kind})\n\n${error.message}` }],
        structuredContent: { ...out, status: 'error', notes: [...out.notes, `Data360 ${error.kind}: ${error.message}`] },
        isError: true,
      };
    }
    throw error;
  }
}

function period(source: DataSource, vintage: string): string {
  return `${DATA_SOURCE_INFO[source].coverageStart}–${vintage}`;
}

const STALE_NOTE = 'This is the latest GEMs publication on Data360; it may predate the current GEMs report.';

/** Record `vintage` in `out`; returns the stale-publication suffix for the source line ('' when current). */
function recordVintage(vintage: string, out: ToolOutput): string {
  out.vintage = vintage;
  if (Number(vintage) >= new Date().getFullYear() - 1) return '';
  out.notes.push(STALE_NOTE);
  return ` ⚠️ ${STALE_NOTE}`;
}

/** Source line for `out.indicators`; records the vintage (and staleness) in `out`. */
function attribution(source: DataSource, vintage: string, out: ToolOutput): string {
  const info = DATA_SOURCE_INFO[source];
  const stale = recordVintage(vintage, out);
  return (
    `*Source: World Bank Data360, IFC GEMs (${out.indicators.join(', ')}), ${info.label} — ${info.description}. ` +
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

/** Disclose when Data360 returned several values for one breakdown (also in `notes`); empty when unambiguous. */
function ambiguityNote(label: string, rate: Selection, notes: string[]): string {
  if (rate.candidates.length < 2) return '';
  const list = rate.candidates.map(pct).join(', ');
  notes.push(
    `${label}: Data360 returned ${rate.candidates.length} values (${list}) that differ by a dimension the API does not expose; ` +
      `showing ${pct(rate.value)} (${SELECTION_METHOD_TEXT[rate.method]}).`,
  );
  return (
    `\n⚠️ ${label}: Data360 returned ${rate.candidates.length} values for this breakdown ` +
    `(${list}) that differ by a dimension the Data360 API does not expose. ` +
    `Showing ${pct(rate.value)}: ${SELECTION_METHOD_TEXT[rate.method]}.\n`
  );
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

function noData(what: string, filters: string[], out: ToolOutput): ToolAnswer {
  return {
    text:
      `ℹ️ **No ${what} published in Data360 for:**\n\n${filters.map((f) => `- ${f}`).join('\n')}\n\n` +
      'IFC GEMs publishes sector, project-type and seniority breakdowns mainly at the global level, ' +
      'and sovereign/public statistics for fewer breakdowns than private. Try region "global" or data_source "private".',
    data: { ...out, status: 'no_data' },
  };
}

async function single(source: DataSource, kind: 'default' | 'recovery', slice: Slice): Promise<RateStat | undefined> {
  return (await getRates(source, kind, slice)).get(slice.REF_AREA);
}

/** Compare a default rate with the global average of the same data source (recorded in `out`). */
function benchmarkLine(source: DataSource, defaultRate: number, global: RateStat | undefined, out: ToolOutput): string {
  if (!global) return '';
  out.global_default_rate_pct = global.rate.value;
  const diff = defaultRate - global.rate.value;
  const relation = Math.abs(diff) < 0.005 ? 'in line with' : diff < 0 ? 'below' : 'above';
  return (
    `Default rate is **${relation}** the global ${DATA_SOURCE_INFO[source].label.toLowerCase()} average ` +
    `(${pct(global.rate.value)}) by ${Math.abs(diff).toFixed(2)} percentage points.\n\n`
  );
}

const DISTRIBUTION_OMITTED = 'Distribution not shown: Data360 returns several distributions for this breakdown.';

/** Recovery percentiles line, or why they are not shown (also in `notes`); empty when none are published. */
function distributionLine(rr: RateStat, notes: string[]): string {
  const d = rr.distribution;
  if (d) {
    return `**Recovery distribution:** 10th ${pct(d.p10)} · 25th ${pct(d.p25)} · median ${pct(d.median)} · 75th ${pct(d.p75)} · 90th ${pct(d.p90)}\n`;
  }
  if (!rr.distributionOmitted) return '';
  notes.push(DISTRIBUTION_OMITTED);
  return `${DISTRIBUTION_OMITTED}\n`;
}

const BENCHMARK_AREAS = ['EAS', 'ECS', 'LCN', 'MEA', 'SAS', 'SSF', 'HIC', 'UMC', 'LMC', 'LIC'];

const RETURN_GROUPS: { dimension: ReturnEntry['dimension']; heading: string; names: Record<string, string> }[] = [
  { dimension: 'TOTAL', heading: 'All loans', names: { _T: 'All loans' } },
  { dimension: 'CURRENCY_TYPE', heading: 'Currency', names: CURRENCY_TYPE_NAMES },
  { dimension: 'PROJECT_TYPE', heading: 'Project type', names: PROJECT_TYPE_NAMES },
  { dimension: 'SENIORITY', heading: 'Seniority', names: SENIORITY_NAMES },
];

function returnLabel(entry: Pick<ReturnEntry, 'dimension' | 'code'>): string {
  const names = RETURN_GROUPS.find((g) => g.dimension === entry.dimension)?.names;
  return names?.[entry.code] ?? entry.code;
}

/** Annual history point as a TIME_PERIOD record; several values for a year mean the first listed is shown. */
function historyRecord(kind: 'default' | 'recovery', point: History['points'][number]): OutputRecord {
  const rate = {
    value_pct: point.rate,
    candidates_pct: point.candidates,
    method: point.candidates.length > 1 ? ('first-listed' as const) : ('unique' as const),
  };
  const year = String(point.year);
  return { dimension: 'TIME_PERIOD', code: year, label: year, ...(kind === 'default' ? { default_rate: rate } : { recovery_rate: rate }) };
}

interface BreakdownRow {
  code: string;
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

function breakdownRecords(dimension: OutputRecord['dimension'], rows: BreakdownRow[]): OutputRecord[] {
  return rows.map((r) => rateRecord(dimension, r.code, r.name, r.defaultStat, r.recoveryStat));
}

/** Default and recovery stats for every value of one dimension; rows sorted by default rate. */
async function breakdown(
  source: DataSource,
  slice: Slice,
  dimension: 'SECTOR' | 'PROJECT_TYPE' | 'CURRENCY_TYPE',
  names: Record<string, string>,
): Promise<{ rows: BreakdownRow[]; vintage?: string; defaults: Map<string, RateStat>; recoveries: Map<string, RateStat> }> {
  const [defaults, recoveries] = await Promise.all([
    getRates(source, 'default', slice, dimension),
    getRates(source, 'recovery', slice, dimension),
  ]);
  // Codes without a known label (e.g. SECTOR=MXS) are listed by code rather than dropped.
  const codes = [...new Set([...defaults.keys(), ...recoveries.keys()])].filter((c) => c !== '_T');
  const rows = codes
    .map((code) => ({ code, name: names[code] ?? code, defaultStat: defaults.get(code), recoveryStat: recoveries.get(code) }))
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
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ region, data_source: source = 'private' }) => {
        const out = newOutput(source, { region, data_source: source }, [DATA_SOURCE_INFO[source].defaultIndicator]);
        return guarded(out, async () => {
          const code = AREAS[region];
          const stat = await single(source, 'default', { ...GLOBAL_TOTAL, REF_AREA: code });
          if (!stat) return noData('default rate', [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`], out);
          out.records.push(rateRecord('REF_AREA', code, AREA_NAMES[code], stat));
          const text =
            `# Default Rates: ${AREA_NAMES[code]}\n\n` +
            `**Average annual default rate:** ${defaultRateText(stat)}\n` +
            `**Period:** ${period(source, stat.vintage)}\n` +
            sampleLine(stat) +
            ambiguityNote('Default rate', stat.rate, out.notes) +
            `\n${attribution(source, stat.vintage, out)}`;
          return { text, data: out };
        });
      },
    );

    server.registerTool(
      'get_recovery_rates',
      {
        title: 'Recovery rates by region',
        description: `Average recovery rate on defaulted exposures in a region. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({ region: regionParam.describe('Region or income group to query'), data_source: dataSourceParam }),
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ region, data_source: source = 'private' }) => {
        const out = newOutput(source, { region, data_source: source }, [DATA_SOURCE_INFO[source].recoveryIndicator]);
        return guarded(out, async () => {
          const code = AREAS[region];
          const stat = await single(source, 'recovery', { ...GLOBAL_TOTAL, REF_AREA: code });
          if (!stat) return noData('recovery rate', [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`], out);
          out.records.push(rateRecord('REF_AREA', code, AREA_NAMES[code], undefined, stat));
          const text =
            `# Recovery Rates: ${AREA_NAMES[code]}\n\n` +
            `**Average recovery rate:** ${pct(stat.rate.value)}\n` +
            distributionLine(stat, out.notes) +
            `**Period:** ${period(source, stat.vintage)}\n` +
            sampleLine(stat) +
            ambiguityNote('Recovery rate', stat.rate, out.notes) +
            `\nWhen loans default, lenders recover on average ${pct(stat.rate.value)} of the exposure ` +
            '(discounted post-default cash flows over the outstanding amount).\n\n' +
            attribution(source, stat.vintage, out);
          return { text, data: out };
        });
      },
    );

    server.registerTool(
      'query_credit_risk',
      {
        title: 'Credit risk profile',
        description: `Credit risk profile for a region: default rate, recovery rate, expected loss and sample size. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({ region: regionParam.describe('Region or income group to analyze'), data_source: dataSourceParam }),
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ region, data_source: source = 'private' }) => {
        const info = DATA_SOURCE_INFO[source];
        const out = newOutput(source, { region, data_source: source }, [info.defaultIndicator, info.recoveryIndicator]);
        return guarded(out, async () => {
          const code = AREAS[region];
          const slice = { ...GLOBAL_TOTAL, REF_AREA: code };
          const [dr, rr] = await Promise.all([single(source, 'default', slice), single(source, 'recovery', slice)]);
          if (!dr && !rr) return noData('credit risk data', [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`], out);
          out.records.push(rateRecord('REF_AREA', code, AREA_NAMES[code], dr, rr));
          const vintage = (dr ?? rr)!.vintage;
          let text = `# Credit Risk Profile: ${AREA_NAMES[code]}\n\n## Key Metrics\n\n`;
          text += `**Default rate:** ${dr ? defaultRateText(dr) : 'not published'}\n`;
          text += `**Recovery rate:** ${rr ? pct(rr.rate.value) : 'not published'}\n`;
          if (rr) text += distributionLine(rr, out.notes);
          text += `**Period:** ${period(source, vintage)}\n`;
          text += sampleLines(dr, rr);
          if (dr) text += ambiguityNote('Default rate', dr.rate, out.notes);
          if (rr) text += ambiguityNote('Recovery rate', rr.rate, out.notes);
          text += '\n## Risk Assessment\n\n';
          text +=
            dr && rr
              ? `**Expected loss:** ${pct(expectedLoss(dr.rate.value, rr.rate.value))} per year ` +
                '(default rate × (1 − recovery rate)).\n\n'
              : 'Expected loss not computed: both default and recovery rates are required.\n\n';
          return { text: text + attribution(source, vintage, out), data: out };
        });
      },
    );

    server.registerTool(
      'get_sector_analysis',
      {
        title: 'Credit risk by sector',
        description:
          'Default and recovery rates by economic sector (IFC categories and GICS sectors) in a region, or one sector in detail. ' +
          `Private sector data is published per region; public sector data only globally. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({
          sector: z.enum(SECTOR_KEYS).optional().describe('Sector to analyze, or "all" (default) for a comparison table'),
          region: regionParam
            .optional()
            .describe('Region to analyze (default: global); income groups have no sector breakdown. Public sector data is global only.'),
          data_source: dataSourceParam,
        }),
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ sector = 'all', region = 'global', data_source: source = 'private' }) => {
        const info = DATA_SOURCE_INFO[source];
        const out = newOutput(source, { sector, region, data_source: source }, [info.defaultIndicator, info.recoveryIndicator]);
        return guarded(out, async () => {
          const area = AREAS[region];
          const code = SECTORS[sector];
          if (code === '_T') {
            const { rows, vintage } = await breakdown(source, { ...GLOBAL_TOTAL, REF_AREA: area }, 'SECTOR', SECTOR_NAMES);
            if (!rows.length || !vintage) {
              return noData('sector breakdown', [`Region: ${AREA_NAMES[area]}`, `Data source: ${source}`], out);
            }
            out.records.push(...breakdownRecords('SECTOR', rows));
            const text =
              `# Credit Risk by Sector (${AREA_NAMES[area]}, ${info.label})\n\n` +
              breakdownTable('Sector', rows) +
              `\n${attribution(source, vintage, out)}`;
            return { text, data: out };
          }

          const slice = { ...GLOBAL_TOTAL, REF_AREA: area, SECTOR: code };
          const [dr, rr, global] = await Promise.all([
            single(source, 'default', slice),
            single(source, 'recovery', slice),
            single(source, 'default', GLOBAL_TOTAL),
          ]);
          if (!dr && !rr) {
            return noData('sector data', [`Sector: ${SECTOR_NAMES[code]}`, `Region: ${AREA_NAMES[area]}`, `Data source: ${source}`], out);
          }
          out.records.push(rateRecord('SECTOR', code, SECTOR_NAMES[code], dr, rr));
          let text = `# Sector Analysis: ${SECTOR_NAMES[code]} (${AREA_NAMES[area]})\n\n`;
          text += `**Default rate:** ${dr ? defaultRateText(dr) : 'not published'}\n`;
          text += `**Recovery rate:** ${rr ? pct(rr.rate.value) : 'not published'}\n`;
          if (dr && rr) text += `**Expected loss:** ${pct(expectedLoss(dr.rate.value, rr.rate.value))}\n`;
          text += `**Period:** ${period(source, (dr ?? rr)!.vintage)}\n`;
          text += sampleLines(dr, rr);
          if (dr) text += ambiguityNote('Default rate', dr.rate, out.notes);
          if (rr) text += ambiguityNote('Recovery rate', rr.rate, out.notes);
          text += '\n';
          if (dr) text += benchmarkLine(source, dr.rate.value, global, out);
          return { text: text + attribution(source, (dr ?? rr)!.vintage, out), data: out };
        });
      },
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
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ metric, grouping = 'region', data_source: source = 'private' }) => {
        const info = DATA_SOURCE_INFO[source];
        const kinds = metric === 'both' ? (['default', 'recovery'] as const) : metric === 'default-rate' ? (['default'] as const) : (['recovery'] as const);
        const out = newOutput(
          source,
          { metric, grouping, data_source: source },
          kinds.map((k) => (k === 'default' ? info.defaultIndicator : info.recoveryIndicator)),
        );
        return guarded(out, async () => {
          const codes = COMPARISON_GROUPS[grouping];
          const wanted = new Set(codes);
          const results = await Promise.all(kinds.map((kind) => getRates(source, kind, GLOBAL_TOTAL, 'REF_AREA')));

          const heading = { region: 'Regional', income: 'Income Group', country: 'Country' }[grouping];
          let text = `# ${heading} Credit Risk Comparison (${info.label})\n\n`;
          let vintage: string | undefined;
          // Codes in the order of the first ranking printed, then any only the second ranking has.
          const shownCodes: string[] = [];
          kinds.forEach((kind, i) => {
            const stats = [...results[i].values()].filter((s) => wanted.has(s.code));
            stats.sort((a, b) => (kind === 'default' ? a.rate.value - b.rate.value : b.rate.value - a.rate.value));
            text += `## ${kind === 'default' ? 'Default Rates (lowest first)' : 'Recovery Rates (highest first)'}\n\n`;
            stats.forEach((s, rank) => {
              const n = kind === 'default' ? s.counterparts ?? s.observations : s.defaults;
              const unit = kind === 'default' ? (s.counterparts !== undefined ? 'counterparts' : 'observations') : s.defaultsUnit;
              const sample = n !== undefined ? ` (n = ${n.toLocaleString('en-US')} ${unit})` : '';
              text += `${rank + 1}. **${areaName(s.code)}:** ${pct(s.rate.value)}${marker(s.rate)}${sample}\n`;
              if (!shownCodes.includes(s.code)) shownCodes.push(s.code);
            });
            const missing = codes.filter((c) => !results[i].has(c));
            if (grouping === 'country') text += `\n${stats.length} of ${codes.length} GEMs countries published.\n`;
            else if (missing.length) text += `\nNot published: ${missing.map(areaName).join(', ')}\n`;
            text += '\n';
            vintage ??= stats[0]?.vintage;
          });
          if (!vintage) return noData(`${heading.toLowerCase()} data`, [`Data source: ${source}`], out);
          const byKind = new Map<string, Map<string, RateStat>>(kinds.map((kind, i) => [kind, results[i]]));
          out.records.push(
            ...shownCodes.map((code) =>
              rateRecord('REF_AREA', code, areaName(code), byKind.get('default')?.get(code), byKind.get('recovery')?.get(code)),
            ),
          );
          if (grouping === 'country') text += 'Small samples make country rates volatile; weigh them by n.\n\n';
          const shown = results.flatMap((r) => [...r.values()].filter((s) => wanted.has(s.code)).map((s) => s.rate));
          text += markerLegend(shown) + '\n';
          return { text: text + attribution(source, vintage, out), data: out };
        });
      },
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
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ projectType = 'all', data_source: source = 'private' }) => {
        const info = DATA_SOURCE_INFO[source];
        const out = newOutput(source, { projectType, data_source: source }, [info.defaultIndicator, info.recoveryIndicator]);
        return guarded(out, async () => {
          const { rows, vintage } = await breakdown(source, GLOBAL_TOTAL, 'PROJECT_TYPE', PROJECT_TYPE_NAMES);
          const code = PROJECT_TYPES[projectType];
          const selected = code === '_T' ? rows : rows.filter((r) => r.code === code);
          if (!selected.length || !vintage) {
            return noData('project type data', [`Project type: ${PROJECT_TYPE_NAMES[code]}`, `Data source: ${source}`], out);
          }
          out.records.push(...breakdownRecords('PROJECT_TYPE', selected));
          let text = `# Credit Risk by Project Type (Global, ${info.label})\n\n` + breakdownTable('Project Type', selected);
          const withDefault = selected.filter((r) => r.defaultStat);
          if (withDefault.length > 1) {
            const lowest = withDefault[0];
            const highest = withDefault[withDefault.length - 1];
            text += `\n**Lowest default rate:** ${lowest.name} (${pct(lowest.defaultStat!.rate.value)})\n`;
            text += `**Highest default rate:** ${highest.name} (${pct(highest.defaultStat!.rate.value)})\n`;
          }
          return { text: text + `\n${attribution(source, vintage, out)}`, data: out };
        });
      },
    );

    server.registerTool(
      'get_time_series',
      {
        title: 'Historical credit risk trend',
        description:
          `Annual default or recovery rates over recent years for a region, optionally for one sector. ${SOURCE_DESCRIPTION} ` +
          'Sovereign history is published for the global aggregate only.',
        inputSchema: z.object({
          region: regionParam.optional().describe('Region to analyze (default: global); income groups have no history'),
          years: z.number().int().min(1).max(45).optional().describe('Number of most recent published years (default: 10)'),
          metric: z.enum(['default-rate', 'recovery-rate']).optional().describe('Series to return (default: default-rate)'),
          sector: z.enum(SECTOR_KEYS).optional().describe('Sector (default: all sectors); sector history is published for region "global" only'),
          data_source: dataSourceParam,
        }),
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ region = 'global', years = 10, metric = 'default-rate', sector = 'all', data_source: source = 'private' }) => {
        const info = DATA_SOURCE_INFO[source];
        const kind = metric === 'default-rate' ? 'default' : 'recovery';
        const out = newOutput(
          source,
          { region, years: String(years), metric, sector, data_source: source },
          [kind === 'default' ? info.defaultHistory : info.recoveryHistory],
        );
        return guarded(out, async () => {
          const code = AREAS[region];
          const sectorCode = SECTORS[sector];
          const label = kind === 'default' ? 'Default Rate' : 'Recovery Rate';
          const history = await getHistory(source, kind, code, sectorCode);
          const points = history.points.slice(-years);
          if (!points.length) {
            return noData(
              `${label.toLowerCase()} history`,
              [`Region: ${AREA_NAMES[code]}`, `Sector: ${SECTOR_NAMES[sectorCode]}`, `Data source: ${source}`],
              out,
            );
          }

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
          out.records.push(...points.map((p) => historyRecord(kind, p)));
          out.trend = {
            first_year: first.year,
            last_year: last.year,
            change_pp: change,
            slope_pp_per_year: points.length < 3 ? null : slope,
          };

          const sectorSuffix = sectorCode === '_T' ? '' : ` — ${SECTOR_NAMES[sectorCode]}`;
          let text = `# Historical ${label}: ${AREA_NAMES[code]} (${info.label})${sectorSuffix}\n\n`;
          text += `**Period:** ${first.year}–${last.year}`;
          text += points.length < span ? ` (${points.length} published years)\n\n` : ` (${points.length} years)\n\n`;
          text += '## Summary\n\n';
          text += `- **Latest (${last.year}):** ${pct(last.rate)}\n`;
          text += `- **Average of annual rates:** ${pct(rates.reduce((s, r) => s + r, 0) / rates.length)}\n`;
          text += `- **Highest:** ${pct(Math.max(...rates))}\n`;
          text += `- **Lowest:** ${pct(Math.min(...rates))}\n`;
          text += `- **Change ${first.year}→${last.year}:** ${change > 0 ? '+' : ''}${change.toFixed(2)} pp\n`;
          text += `- **Trend:** ${trend}\n\n`;
          text += `## Year-by-Year\n\n| Year | ${label} | Change |\n|---|---|---|\n`;
          points.forEach((p, i) => {
            const delta = i > 0 ? p.rate - points[i - 1].rate : undefined;
            text += `| ${p.year} | ${pct(p.rate)} | ${delta === undefined ? '-' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} pp`} |\n`;
          });
          const conflicts = history.conflictingYears.filter((y) => y >= first.year);
          if (conflicts.length) {
            const note = `Data360 returned conflicting values for ${conflicts.join(', ')}; the first listed value is shown.`;
            out.notes.push(note);
            text += `\n⚠️ ${note}\n`;
          }
          text += `\n*Source: World Bank Data360, IFC GEMs (${out.indicators.join(', ')}), ${info.label} — ${info.description}.*`;
          return { text, data: out };
        });
      },
    );

    server.registerTool(
      'get_seniority_analysis',
      {
        title: 'Recovery by debt seniority',
        description: `Recovery rates by debt seniority (senior secured, senior unsecured, subordinated, ...). Published for the global aggregate of public and private data. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({ region: regionParam.optional().describe('Region to analyze (default: global)'), data_source: dataSourceParam }),
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ region = 'global', data_source: source = 'private' }) => {
        const out = newOutput(source, { region, data_source: source }, [DATA_SOURCE_INFO[source].recoveryIndicator]);
        return guarded(out, async () => {
          const code = AREAS[region];
          const stats = await getRates(source, 'recovery', { ...GLOBAL_TOTAL, REF_AREA: code }, 'SENIORITY');
          const levels = [...stats.values()].filter((s) => s.code !== '_T').sort((a, b) => b.rate.value - a.rate.value);
          if (!levels.length) return noData('seniority breakdown', [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`], out);

          const seniorityName = (c: string) => SENIORITY_NAMES[c] ?? c;
          let text = `# Recovery by Debt Seniority: ${AREA_NAMES[code]} (${DATA_SOURCE_INFO[source].label})\n\n`;
          text += '| Seniority | Recovery Rate | Sample |\n|---|---|---|\n';
          for (const s of levels) {
            const sample = s.defaults !== undefined ? `${s.defaults.toLocaleString('en-US')} ${s.defaultsUnit}` : '';
            text += `| ${seniorityName(s.code)} | ${pct(s.rate.value)} | ${sample} |\n`;
            out.records.push(rateRecord('SENIORITY', s.code, seniorityName(s.code), undefined, s));
          }
          for (const s of levels) text += ambiguityNote(seniorityName(s.code), s.rate, out.notes);
          const ss = stats.get('SS');
          const su = stats.get('SU');
          if (ss && su) {
            const premium = ss.rate.value - su.rate.value;
            text += `\n**Security premium (secured − unsecured):** ${premium.toFixed(2)} pp of recovery\n`;
          }
          const overall = stats.get('_T');
          if (overall) {
            out.records.push(rateRecord('SENIORITY', '_T', SENIORITY_NAMES._T, undefined, overall));
            text += `**All seniority levels:** ${pct(overall.rate.value)}\n${ambiguityNote('All seniority levels', overall.rate, out.notes)}`;
          }
          return { text: text + `\n${attribution(source, levels[0].vintage, out)}`, data: out };
        });
      },
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
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ region = 'global', sector = 'all', projectType = 'all', data_source: source = 'private' }) => {
        const info = DATA_SOURCE_INFO[source];
        const out = newOutput(source, { region, sector, projectType, data_source: source }, [info.defaultIndicator, info.recoveryIndicator]);
        return guarded(out, async () => {
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
          if (!dr && !rr) return noData('data', filters, out);
          out.records.push(rateRecord('REF_AREA', slice.REF_AREA, AREA_NAMES[slice.REF_AREA], dr, rr));

          let text = `# Multi-Dimensional Credit Risk Analysis\n\n## Filters\n\n${filters.map((f) => `- ${f}`).join('\n')}\n\n`;
          text += '## Risk Metrics\n\n| Metric | Value |\n|---|---|\n';
          text += `| Default rate | ${dr ? defaultRateText(dr) : 'not published'} |\n`;
          text += `| Recovery rate | ${rr ? pct(rr.rate.value) : 'not published'} |\n`;
          text += `| Expected loss | ${dr && rr ? pct(expectedLoss(dr.rate.value, rr.rate.value)) : 'n/a'} |\n`;
          if (dr) text += ambiguityNote('Default rate', dr.rate, out.notes);
          if (rr) text += ambiguityNote('Recovery rate', rr.rate, out.notes);
          text += '\n';
          text += sampleLines(dr, rr);
          if (dr) text += '\n' + benchmarkLine(source, dr.rate.value, global, out);
          return { text: text + attribution(source, (dr ?? rr)!.vintage, out), data: out };
        });
      },
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
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ country, years = 10, data_source: source = 'private' }) => {
        const info = DATA_SOURCE_INFO[source];
        const out = newOutput(
          source,
          { country, years: String(years), data_source: source },
          [info.defaultIndicator, info.recoveryIndicator, info.defaultHistory],
        );
        return guarded(out, async () => {
          const match = resolveCountry(country);
          if ('error' in match) {
            return { text: `ℹ️ ${match.error}`, data: { ...out, status: 'invalid_input', notes: [...out.notes, match.error] } };
          }
          const code = match.code;
          const name = areaName(code);
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
            const answer = noData('country data', [`Country: ${name} (${code})`, `Data source: ${source}`], out);
            answer.text +=
              `\n\nCountries with ${source} data (${available.length}): ` +
              (available.length ? available.map((c) => `${COUNTRY_NAMES[c]} (${c})`).join(', ') : 'none');
            return answer;
          }

          const vintage = (dr ?? rr)!.vintage;
          out.records.push(rateRecord('REF_AREA', code, name, dr, rr));
          let text = `# Country Credit Risk: ${name} (${info.label})\n\n## Key Metrics\n\n`;
          text += `**Default rate:** ${dr ? defaultRateText(dr) : 'not published'}\n`;
          text += `**Recovery rate:** ${rr ? pct(rr.rate.value) : 'not published'}\n`;
          if (rr) text += distributionLine(rr, out.notes);
          if (dr && rr) text += `**Expected loss:** ${pct(expectedLoss(dr.rate.value, rr.rate.value))} per year\n`;
          text += `**Period:** ${period(source, vintage)}\n`;
          text += sampleLines(dr, rr);
          if (dr) text += ambiguityNote('Default rate', dr.rate, out.notes);
          if (rr) text += ambiguityNote('Recovery rate', rr.rate, out.notes);
          if (dr?.counterparts !== undefined && dr.counterparts < 100) {
            const note = `Small sample (${dr.counterparts} counterparts): treat the rate as indicative and weigh the confidence interval.`;
            out.notes.push(note);
            text += `\n⚠️ ${note}\n`;
          }
          text += '\n';
          if (dr) text += benchmarkLine(source, dr.rate.value, global, out);

          if (sectors.rows.length) {
            out.records.push(...breakdownRecords('SECTOR', sectors.rows));
            text += `## By Sector\n\n${breakdownTable('Sector', sectors.rows)}\n`;
          }

          const points = history.points.slice(-years);
          if (points.length) {
            out.records.push(...points.map((p) => historyRecord('default', p)));
            text += `## Annual Default Rates (${points[0].year}–${points[points.length - 1].year})\n\n| Year | Default Rate |\n|---|---|\n`;
            for (const p of points) text += `| ${p.year} | ${pct(p.rate)} |\n`;
            text += '\n';
          }
          return { text: text + attribution(source, vintage, out), data: out };
        });
      },
    );

    server.registerTool(
      'get_currency_analysis',
      {
        title: 'Credit risk by loan currency',
        description:
          'Default and recovery rates by loan currency in a region: foreign currency (FC), local currency (LC), local ' +
          'currency pegged to another currency (LC_P) and mixed-currency loans (X). Private and public sector data are ' +
          `published per region; sovereign lending has no currency split. ${SOURCE_DESCRIPTION}`,
        inputSchema: z.object({
          region: regionParam.optional().describe('Region to analyze (default: global); income groups have no currency breakdown'),
          data_source: dataSourceParam,
        }),
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      ({ region = 'global', data_source: source = 'private' }) => {
        const info = DATA_SOURCE_INFO[source];
        const out = newOutput(source, { region, data_source: source }, [info.defaultIndicator, info.recoveryIndicator]);
        return guarded(out, async () => {
          const code = AREAS[region];
          const { rows, vintage } = await breakdown(source, { ...GLOBAL_TOTAL, REF_AREA: code }, 'CURRENCY_TYPE', CURRENCY_TYPE_NAMES);
          if (!rows.length || !vintage) {
            return noData('currency breakdown', [`Region: ${AREA_NAMES[code]}`, `Data source: ${source}`], out);
          }
          out.records.push(...breakdownRecords('CURRENCY_TYPE', rows));
          const text =
            `# Credit Risk by Loan Currency: ${AREA_NAMES[code]} (${info.label})\n\n` +
            breakdownTable('Currency', rows) +
            `\n${attribution(source, vintage, out)}`;
          return { text, data: out };
        });
      },
    );

    server.registerTool(
      'get_sovereign_benchmark',
      {
        title: 'GEMs default rates vs sovereign benchmark',
        description:
          'Observed GEMs default rate per region and income group next to its sovereign benchmark: the S&P default rate ' +
          "of sovereigns with the same rating as the project's country. Shows whether GEMs lending defaulted more or less " +
          'often than sovereign ratings imply.',
        inputSchema: z.object({}),
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      () => {
        const out = newOutput(null, {}, [SOVEREIGN_BENCHMARK_INDICATOR]);
        return guarded(out, async () => {
          const benchmark = await getSovereignBenchmark();
          const areas = BENCHMARK_AREAS.filter((a) => benchmark.has(a));
          if (!areas.length) return noData('sovereign benchmark', ['Indicator: IFC_GEM_DRVSVG'], out);
          const omitted = 'Global aggregate omitted: Data360 returns several values for it.';
          out.notes.push(omitted);
          let text =
            '# GEMs Default Rates vs Sovereign Benchmark\n\n' +
            "Benchmark: S&P default rate of sovereigns with the same rating as the project's country. " +
            'Difference = GEMs rate − benchmark.\n\n' +
            '| Area | GEMs default rate | S&P sovereign benchmark | Difference |\n|---|---|---|---|\n';
          for (const area of areas) {
            const { gems, sovereign } = benchmark.get(area)!;
            const diff = gems - sovereign;
            text += `| ${AREA_NAMES[area]} | ${pct(gems)} | ${pct(sovereign)} | ${diff > 0 ? '+' : ''}${diff.toFixed(2)} pp |\n`;
            out.records.push({
              dimension: 'REF_AREA',
              code: area,
              label: AREA_NAMES[area],
              default_rate: selectionOutput({ value: gems, candidates: [gems], method: 'unique' }),
              sovereign_benchmark_pct: sovereign,
            });
          }
          const vintages = [...new Set(areas.map((a) => benchmark.get(a)!.vintage))].sort();
          if (vintages.length > 1) {
            const mixed = `Areas come from different publication vintages (${vintages.join(', ')}).`;
            out.notes.push(mixed);
            text += `\n⚠️ ${mixed}\n`;
          }
          const latest = vintages[vintages.length - 1];
          const stale = recordVintage(latest, out);
          text +=
            `\n${omitted}\n\n` +
            `*Source: World Bank Data360, IFC GEMs (${SOVEREIGN_BENCHMARK_INDICATOR}). Publication vintage ${latest}.${stale}*`;
          return { text, data: out };
        });
      },
    );

    server.registerTool(
      'get_spreads_and_losses',
      {
        title: 'Spreads and loss rates (private lending)',
        description:
          'Average total spread and average loss rate of private sector lending (global), overall and by loan currency, ' +
          'project type and seniority. Average total spread: the average of annual total spreads, each the average across ' +
          'contracts signed in the prior year. Average loss rate: average default rate × (1 − average recovery rate).',
        inputSchema: z.object({}),
        outputSchema: ToolOutputSchema,
        annotations: READ_ONLY,
      },
      () => {
        const out = newOutput('private', {}, [RETURNS_INDICATOR]);
        return guarded(out, async () => {
          const { vintage, entries, misdated } = await getReturns();
          if (!entries.length) return noData('spreads or loss rates', ['Indicator: IFC_GEM_PR_RTNS'], out);
          const cell = (s?: Selection) => (s ? pct(s.value) + marker(s) : 'n/a');
          let text =
            '# Spreads and Loss Rates (Private Sector Lending, Global)\n\n' +
            '| Breakdown | Average total spread | Average loss rate |\n|---|---|---|\n';
          for (const group of RETURN_GROUPS) {
            const rows = entries.filter((e) => e.dimension === group.dimension);
            if (!rows.length) continue;
            if (group.dimension !== 'TOTAL') text += `| **${group.heading}** | | |\n`;
            for (const entry of rows) {
              const label = returnLabel(entry);
              text += `| ${group.dimension === 'TOTAL' ? `**${label}**` : label} | ${cell(entry.totalSpread)} | ${cell(entry.lossRate)} |\n`;
              const record: OutputRecord =
                entry.dimension === 'TOTAL'
                  ? { dimension: 'REF_AREA', code: 'WLD', label }
                  : { dimension: entry.dimension, code: entry.code, label };
              if (entry.totalSpread) record.total_spread = selectionOutput(entry.totalSpread);
              if (entry.lossRate) record.loss_rate = selectionOutput(entry.lossRate);
              out.records.push(record);
            }
          }
          const shown = entries.flatMap((e) => [e.totalSpread, e.lossRate]).filter((s) => s !== undefined);
          text += `\n${markerLegend(shown)}n/a = not published for this breakdown.\n`;
          for (const m of misdated) {
            const note =
              `Data360 dates the ${returnLabel(m)} ${m.metric === 'TS' ? 'total spread' : 'loss rate'} ` +
              `${m.timePeriod} instead of ${vintage}; not shown.`;
            out.notes.push(note);
            text += `\n⚠️ ${note}\n`;
          }
          text +=
            '\nAverage total spread: average of annual total spreads, each across contracts signed in the prior year. ' +
            'Average loss rate: average default rate × (1 − average recovery rate).\n\n' +
            `*Source: World Bank Data360, IFC GEMs (${RETURNS_INDICATOR}), Private sector — ` +
            `${DATA_SOURCE_INFO.private.description}. Publication vintage ${vintage}.${recordVintage(vintage, out)}*`;
          return { text, data: out };
        });
      },
    );
  },
  { serverInfo: { name: 'gems-risk', version: pkg.version } },
);

export { handler as GET, handler as POST, handler as DELETE };
