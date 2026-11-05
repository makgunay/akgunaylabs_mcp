// Default/recovery statistics from the IFC GEMs tables on Data360.
//
// Data quirks this module handles (verified against the live API, vintage 2025):
// - Snapshot indicators (IFC_GEM_PRD, _PBD, _SD, _PRR, _PBR, _SR) carry a single TIME_PERIOD, the publication
//   vintage, whose values are averages over the whole coverage period. Annual values live in the `_H` indicators.
// - Some snapshot rows are further split by dimensions the API neither returns nor filters (credit enhancement,
//   default action, resolution type, rating grade). A fully specified visible key can therefore match several
//   values, e.g. private global recovery has 10. `selectRate` picks the headline value and reports the rest.
//   Default rates resolve exactly: the headline ADR equals 100 × defaults / observations of the aggregate,
//   whose counts are the largest in the group (verified on every ambiguous default key of the 2025 vintage).

import { DATABASE_ID, DATA_SOURCE_INFO, type DataSource } from './catalog.ts';
import { fetchObservations, type Filters, type Observation } from './data360.ts';

export type Kind = 'default' | 'recovery';
export type GroupDimension = 'REF_AREA' | 'SECTOR' | 'PROJECT_TYPE' | 'SENIORITY';

export interface Slice {
  REF_AREA: string;
  SECTOR: string;
  PROJECT_TYPE: string;
  SENIORITY: string;
}

export const GLOBAL_TOTAL: Slice = { REF_AREA: 'WLD', SECTOR: '_T', PROJECT_TYPE: '_T', SENIORITY: '_T' };

// Breakdowns this server does not expose; pinned to their totals so every row describes the same population.
const PINNED_TOTALS: Filters = { CURRENCY_TYPE: '_T', CONTRACT_SIZE: '_T', DEFAULT_TYPE: '_T', RR_BAND: '_T' };

const RATE_METRIC: Record<Kind, string> = { default: 'ADR', recovery: 'ARR' };
// Annual-series metric used to weight years when reconstructing the period average.
const WEIGHT_METRICS: Record<Kind, string[]> = { default: ['OBS'], recovery: ['DT', 'CT_DT'] };

export type SelectionMethod = 'unique' | 'count-anchor' | 'historical-anchor' | 'published-precision' | 'first-listed';

interface Anchor {
  value: number;
  method: 'count-anchor' | 'historical-anchor';
}

export interface Selection {
  value: number;
  /** Distinct values Data360 returned for the same key, in API order. Length > 1 means the key was ambiguous. */
  candidates: number[];
  method: SelectionMethod;
}

export interface RateStat {
  /** Value of the grouped dimension, or the slice's REF_AREA when ungrouped. */
  code: string;
  /** Average default rate (ADR) or average recovery rate (ARR), in percent. */
  rate: Selection;
  /** Publication vintage (TIME_PERIOD of the snapshot). */
  vintage: string;
  /** Counterparts (default tables). */
  counterparts?: number;
  /** Defaults (DT) or defaulted contracts (CT_DT). */
  defaults?: number;
  defaultsUnit?: 'defaults' | 'defaulted contracts';
  /** Counterpart-year observations (default tables). */
  observations?: number;
  /** Signed amount, EUR millions. */
  signedAmountEURm?: number;
  /** 90% confidence interval of the default rate, in percent (default tables). */
  ci90?: [number, number];
}

/**
 * Snapshot rate statistics for `slice`. With `groupBy`, that dimension is left unfiltered and one entry is
 * returned per value Data360 has; otherwise the map holds a single entry keyed by `slice.REF_AREA`.
 */
export async function getRates(
  source: DataSource,
  kind: Kind,
  slice: Slice,
  groupBy?: GroupDimension,
): Promise<Map<string, RateStat>> {
  const info = DATA_SOURCE_INFO[source];
  const filters: Filters = {
    DATABASE_ID,
    INDICATOR: kind === 'default' ? info.defaultIndicator : info.recoveryIndicator,
    ...PINNED_TOTALS,
    ...slice,
  };
  if (groupBy) delete filters[groupBy];
  const rows = await fetchObservations(filters);

  const groups = new Map<string, Observation[]>();
  for (const row of rows) {
    const key = groupBy ? String(row[groupBy]) : slice.REF_AREA;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  // Annual series are fetched only when some group is ambiguous, once for all groups.
  let history: Promise<Observation[]> | undefined;
  const loadHistory = () => {
    history ??= fetchHistoryRows(source, kind, slice, groupBy);
    return history;
  };

  const result = new Map<string, RateStat>();
  for (const [code, groupRows] of groups) {
    const vintage = groupRows.reduce((max, r) => (r.TIME_PERIOD > max ? r.TIME_PERIOD : max), '');
    const latest = groupRows.filter((r) => r.TIME_PERIOD === vintage);
    const rateRows = latest.filter((r) => r.METRIC === RATE_METRIC[kind]);
    if (rateRows.length === 0) continue;

    const defaultsRow = latest.find((r) => r.METRIC === 'DT') ?? latest.find((r) => r.METRIC === 'CT_DT');
    const defaults = maxOf(latest, defaultsRow?.METRIC ?? 'DT');
    const observations = maxOf(latest, 'OBS');

    let anchor: Anchor | undefined;
    if (distinct(rateRows).length > 1) {
      // Annual series exist only for project-type/seniority totals.
      const groupSlice = groupBy ? { ...slice, [groupBy]: code } : slice;
      if (kind === 'default' && defaults !== undefined && observations) {
        anchor = { value: (100 * defaults) / observations, method: 'count-anchor' };
      } else if (groupSlice.PROJECT_TYPE === '_T' && groupSlice.SENIORITY === '_T') {
        const history = (await loadHistory()).filter((r) => !groupBy || r[groupBy] === code);
        const value = weightedAverage(history, kind);
        if (value !== undefined) anchor = { value, method: 'historical-anchor' };
      }
    }
    const rate = selectRate(rateRows, anchor);

    result.set(code, {
      code,
      rate,
      vintage,
      counterparts: maxOf(latest, 'CP'),
      defaults,
      defaultsUnit: defaultsRow ? (defaultsRow.METRIC === 'CT_DT' ? 'defaulted contracts' : 'defaults') : undefined,
      observations,
      signedAmountEURm: maxOf(latest, 'SA'),
      ci90: kind === 'default' ? confidenceInterval(latest, rate.value) : undefined,
    });
  }
  return result;
}

export interface History {
  points: { year: number; rate: number }[];
  /** Years where Data360 returned conflicting values; the first listed value is used. */
  conflictingYears: number[];
}

/** Annual default (ADR) or recovery (ARR) rates for a region/sector, oldest first. */
export async function getHistory(
  source: DataSource,
  kind: Kind,
  region: string,
  sector = '_T',
): Promise<History> {
  const rows = await fetchObservations({
    DATABASE_ID,
    INDICATOR: kind === 'default' ? DATA_SOURCE_INFO[source].defaultHistory : DATA_SOURCE_INFO[source].recoveryHistory,
    METRIC: RATE_METRIC[kind],
    ...PINNED_TOTALS,
    REF_AREA: region,
    SECTOR: sector,
    PROJECT_TYPE: '_T',
    SENIORITY: '_T',
  });
  const byYear = new Map<number, number[]>();
  for (const row of rows) {
    const year = Number(row.TIME_PERIOD);
    const value = Number(row.OBS_VALUE);
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue;
    const values = byYear.get(year);
    if (values) values.push(value);
    else byYear.set(year, [value]);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  return {
    points: years.map((year) => ({ year, rate: byYear.get(year)![0] })),
    conflictingYears: years.filter((year) => new Set(byYear.get(year)).size > 1),
  };
}

/**
 * Pick the headline value among rows sharing one visible key.
 * 1. Closest to an anchor: defaults ÷ observations (default rates; exact) or the period average reconstructed
 *    from the annual series (recovery; matches to rounding for the global totals).
 * 2. The only value at the published precision (sub-splits are stored unrounded).
 * 3. First listed by Data360.
 */
function selectRate(rows: Observation[], anchor?: Anchor): Selection {
  const candidates = distinct(rows);
  if (candidates.length === 1) return { value: candidates[0], candidates, method: 'unique' };

  if (anchor) {
    const target = anchor.value;
    const value = candidates.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best));
    return { value, candidates, method: anchor.method };
  }

  const published = distinct(rows.filter((r) => decimals(r.OBS_VALUE) <= Number(r.DECIMALS ?? 2)));
  if (published.length === 1) return { value: published[0], candidates, method: 'published-precision' };

  return { value: candidates[0], candidates, method: 'first-listed' };
}

/**
 * 90% CI belonging to `rate`. Data360 publishes some intervals with the bounds swapped (regional IFC-sector rows),
 * so each pair is ordered before use. With several bound rows, pair them by midpoint: the published intervals are
 * symmetric around the rate up to rounding, except when the lower bound is clipped at 0.
 */
function confidenceInterval(rows: Observation[], rate: number): [number, number] | undefined {
  const lower = distinct(rows.filter((r) => r.METRIC === 'CI_LB_90'));
  const upper = distinct(rows.filter((r) => r.METRIC === 'CI_UB_90'));
  if (lower.length === 1 && upper.length === 1) {
    const lo = Math.min(lower[0], upper[0]);
    const hi = Math.max(lower[0], upper[0]);
    return lo <= rate && rate <= hi ? [lo, hi] : undefined;
  }
  let best: [number, number] | undefined;
  let bestGap = 0.02;
  for (const a of lower) {
    for (const b of upper) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const gap = Math.abs((lo + hi) / 2 - rate);
      if (lo <= rate && rate <= hi && gap <= bestGap) {
        best = [lo, hi];
        bestGap = gap;
      }
    }
  }
  return best;
}

function fetchHistoryRows(
  source: DataSource,
  kind: Kind,
  slice: Slice,
  groupBy?: GroupDimension,
): Promise<Observation[]> {
  const info = DATA_SOURCE_INFO[source];
  const filters: Filters = {
    DATABASE_ID,
    INDICATOR: kind === 'default' ? info.defaultHistory : info.recoveryHistory,
    ...PINNED_TOTALS,
    REF_AREA: slice.REF_AREA,
    SECTOR: slice.SECTOR,
    PROJECT_TYPE: '_T',
    SENIORITY: '_T',
  };
  if (groupBy) delete filters[groupBy];
  return fetchObservations(filters);
}

/** Period average of the annual rates weighted by observations/defaults; undefined when weights are unpublished. */
function weightedAverage(rows: Observation[], kind: Kind): number | undefined {
  const rates = new Map<string, number>();
  const weights = new Map<string, number>();
  for (const row of rows) {
    if (row.METRIC === RATE_METRIC[kind] && !rates.has(row.TIME_PERIOD)) rates.set(row.TIME_PERIOD, Number(row.OBS_VALUE));
    if (WEIGHT_METRICS[kind].includes(row.METRIC)) weights.set(row.TIME_PERIOD, Number(row.OBS_VALUE));
  }
  let sum = 0;
  let total = 0;
  for (const [year, rate] of rates) {
    const weight = weights.get(year);
    if (weight === undefined || !Number.isFinite(rate)) continue;
    sum += rate * weight;
    total += weight;
  }
  return total > 0 ? sum / total : undefined;
}

function distinct(rows: Observation[]): number[] {
  return [...new Set(rows.map((r) => Number(r.OBS_VALUE)).filter(Number.isFinite))];
}

// Counts of a hidden-dimension aggregate are never smaller than those of its sub-splits.
function maxOf(rows: Observation[], metric: string): number | undefined {
  const values = rows.filter((r) => r.METRIC === metric).map((r) => Number(r.OBS_VALUE)).filter(Number.isFinite);
  return values.length ? Math.max(...values) : undefined;
}

function decimals(value: string): number {
  const dot = value.indexOf('.');
  return dot === -1 ? 0 : value.length - dot - 1;
}
