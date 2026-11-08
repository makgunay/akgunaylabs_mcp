// Structured tool output (MCP `structuredContent` + `outputSchema`) shared by every GEMs tool.
// The markdown text stays the human-readable answer; this carries the same figures as typed JSON.

import { z } from 'zod';
import { DATA_SOURCES } from './catalog.ts';
import type { RateStat, Selection } from './stats.ts';

const SelectionSchema = z.object({
  value_pct: z.number(),
  /** Every distinct value Data360 returned for the key; length 1 = unambiguous. */
  candidates_pct: z.array(z.number()),
  method: z.enum(['unique', 'count-anchor', 'historical-anchor', 'published-precision', 'first-listed']),
});

export const RecordSchema = z.object({
  dimension: z.enum(['REF_AREA', 'SECTOR', 'PROJECT_TYPE', 'SENIORITY', 'CURRENCY_TYPE', 'TIME_PERIOD']),
  code: z.string(),
  label: z.string(),
  default_rate: SelectionSchema.optional(),
  default_rate_ci90_pct: z.tuple([z.number(), z.number()]).optional(),
  recovery_rate: SelectionSchema.optional(),
  recovery_distribution_pct: z
    .object({ p10: z.number(), p25: z.number(), median: z.number(), p75: z.number(), p90: z.number() })
    .optional(),
  expected_loss_pct: z.number().optional(),
  counterparts: z.number().optional(),
  observations: z.number().optional(),
  defaults: z.number().optional(),
  signed_amount_eur_m: z.number().optional(),
  recovery_defaults: z.number().optional(),
  recovery_defaults_unit: z.enum(['defaults', 'defaulted contracts']).optional(),
  recovery_signed_amount_eur_m: z.number().optional(),
  sovereign_benchmark_pct: z.number().optional(),
  total_spread: SelectionSchema.optional(),
  loss_rate: SelectionSchema.optional(),
});

export const ToolOutputSchema = z.object({
  status: z.enum(['ok', 'no_data', 'invalid_input', 'error']),
  data_source: z.enum(DATA_SOURCES).nullable(),
  vintage: z.string().nullable(),
  indicators: z.array(z.string()),
  /** Effective tool inputs after defaults, as strings. */
  filters: z.record(z.string(), z.string()),
  records: z.array(RecordSchema),
  global_default_rate_pct: z.number().optional(),
  trend: z
    .object({ first_year: z.number(), last_year: z.number(), change_pp: z.number(), slope_pp_per_year: z.number().nullable() })
    .optional(),
  /** Plain-text warnings: the same facts as the ⚠️ lines in the text answer. */
  notes: z.array(z.string()),
});

export type ToolOutput = z.infer<typeof ToolOutputSchema>;
export type OutputRecord = z.infer<typeof RecordSchema>;

export function newOutput(
  dataSource: ToolOutput['data_source'],
  filters: Record<string, string>,
  indicators: string[],
): ToolOutput {
  return { status: 'ok', data_source: dataSource, vintage: null, indicators, filters, records: [], notes: [] };
}

export function selectionOutput(s: Selection): NonNullable<OutputRecord['default_rate']> {
  return { value_pct: s.value, candidates_pct: s.candidates, method: s.method };
}

export function expectedLoss(defaultRate: number, recoveryRate: number): number {
  return (defaultRate * (100 - recoveryRate)) / 100;
}

/** One record from a default and/or recovery statistic; fields Data360 does not publish are omitted. */
export function rateRecord(
  dimension: OutputRecord['dimension'],
  code: string,
  label: string,
  dr?: RateStat,
  rr?: RateStat,
): OutputRecord {
  const record: OutputRecord = { dimension, code, label };
  if (dr) {
    record.default_rate = selectionOutput(dr.rate);
    if (dr.ci90) record.default_rate_ci90_pct = dr.ci90;
    if (dr.counterparts !== undefined) record.counterparts = dr.counterparts;
    if (dr.observations !== undefined) record.observations = dr.observations;
    if (dr.defaults !== undefined) record.defaults = dr.defaults;
    if (dr.signedAmountEURm !== undefined) record.signed_amount_eur_m = dr.signedAmountEURm;
  }
  if (rr) {
    record.recovery_rate = selectionOutput(rr.rate);
    if (rr.defaults !== undefined) record.recovery_defaults = rr.defaults;
    if (rr.defaultsUnit !== undefined) record.recovery_defaults_unit = rr.defaultsUnit;
    if (rr.signedAmountEURm !== undefined) record.recovery_signed_amount_eur_m = rr.signedAmountEURm;
    if (rr.distribution) record.recovery_distribution_pct = rr.distribution;
  }
  if (dr && rr) record.expected_loss_pct = expectedLoss(dr.rate.value, rr.rate.value);
  return record;
}
