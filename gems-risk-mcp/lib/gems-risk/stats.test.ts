// Regression tests against real Data360 rows (IFC_GEM, 2025 vintage), served through a fake data API that
// applies query parameters the way Data360 does: listed dimensions must match, omitted ones are unconstrained.

import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveCountry } from './catalog.ts';
import { clearObservationCache, Data360Error, fetchObservations, type Observation } from './data360.ts';
import { GLOBAL_TOTAL, getHistory, getRates, getReturns, getSovereignBenchmark } from './stats.ts';

const FIXTURE: Observation[] = JSON.parse(
  readFileSync(new URL('./__fixtures__/ifc-gem-2025.json', import.meta.url), 'utf8'),
);
const realFetch = globalThis.fetch;

function serve(rows: Observation[]): void {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const filters = [...url.searchParams].filter(([key]) => key !== 'top' && key !== 'skip');
    const matched = rows.filter((row) => filters.every(([key, value]) => row[key] === value));
    const skip = Number(url.searchParams.get('skip') ?? 0);
    const top = Number(url.searchParams.get('top') ?? 1000);
    return Response.json({ count: matched.length, value: matched.slice(skip, skip + top) });
  }) as typeof fetch;
}

beforeEach(() => {
  clearObservationCache();
  serve(FIXTURE);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  mock.timers.reset();
});

/** Serve `rows`, but answer the first `failures` requests with HTTP `status`. Returns the request counter. */
function serveAfterFailures(rows: Observation[], failures: number, status: number): { requests: number } {
  serve(rows);
  const healthy = globalThis.fetch;
  const counter = { requests: 0 };
  globalThis.fetch = (async (input: string | URL | Request) => {
    counter.requests += 1;
    return counter.requests <= failures ? new Response('', { status }) : healthy(input);
  }) as typeof fetch;
  return counter;
}

test('global private default rate is the full-sample headline, with its own confidence interval', async () => {
  const stat = (await getRates('private', 'default', GLOBAL_TOTAL)).get('WLD');
  assert.ok(stat);
  assert.equal(stat.rate.value, 3.45);
  assert.deepEqual(stat.rate.candidates, [3.45, 2.42]);
  assert.deepEqual(stat.ci90, [3.01, 3.88]);
  assert.equal(stat.counterparts, 7000);
  assert.equal(stat.vintage, '2025');
});

test('sector default rates resolve to the full-sample value, not the first listed', async () => {
  const sectors = await getRates('private', 'default', GLOBAL_TOTAL, 'SECTOR');
  // First-listed values for these keys are 5.6, 2.35 and 1.96.
  assert.equal(sectors.get('CS')?.rate.value, 4.16);
  assert.equal(sectors.get('U')?.rate.value, 2.69);
  assert.equal(sectors.get('F')?.rate.value, 1.83);
  assert.deepEqual(sectors.get('CS')?.ci90, [3.27, 5.06]);
});

test('regional default rate ignores unrounded sub-split rows listed before the headline', async () => {
  const stat = (await getRates('private', 'default', { ...GLOBAL_TOTAL, REF_AREA: 'SAS' })).get('SAS');
  assert.equal(stat?.rate.value, 2.78);
});

test('global private recovery rate matches the period average of the annual series', async () => {
  const stat = (await getRates('private', 'recovery', GLOBAL_TOTAL)).get('WLD');
  assert.ok(stat);
  assert.equal(stat.rate.candidates.length, 10);
  assert.equal(stat.rate.value, 69.75);
  assert.equal(stat.rate.method, 'historical-anchor');
  assert.equal(stat.defaults, 1659);
});

test('a newer publication vintage replaces the old one without mixing in its counts', async () => {
  const template = FIXTURE.find((r) => r.INDICATOR === 'IFC_GEM_PRD' && r.REF_AREA === 'WLD' && r.SECTOR === '_T')!;
  serve([...FIXTURE, { ...template, METRIC: 'ADR', TIME_PERIOD: '2026', OBS_VALUE: '4.1' }]);
  const stat = (await getRates('private', 'default', GLOBAL_TOTAL)).get('WLD');
  assert.equal(stat?.vintage, '2026');
  assert.equal(stat?.rate.value, 4.1);
  assert.equal(stat?.counterparts, undefined);
});

test('annual history is ordered by year and flags years with conflicting values', async () => {
  const history = await getHistory('sovereign', 'recovery', 'WLD');
  const years = history.points.map((p) => p.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
  assert.equal(new Set(years).size, years.length);
  assert.deepEqual(history.points[0], { year: 1984, rate: 91.8, candidates: [91.8] });
  // A conflicting year keeps every distinct value in API order and shows the first.
  assert.deepEqual(history.points.find((p) => p.year === 2000), { year: 2000, rate: 99.04, candidates: [99.04, 57.54, 88.67] });
  assert.deepEqual(history.conflictingYears, [2000, 2018, 2022, 2023, 2025]);
});

test('a value repeated for the same year is not a conflict', async () => {
  const row = FIXTURE.find(
    (r) => r.INDICATOR === 'IFC_GEM_SR_H' && r.METRIC === 'ARR' && r.REF_AREA === 'WLD' && r.TIME_PERIOD === '1984' && r.SECTOR === '_T',
  )!;
  assert.equal(row.OBS_VALUE, '91.8');
  serve([...FIXTURE, { ...row }]);
  const history = await getHistory('sovereign', 'recovery', 'WLD');
  assert.deepEqual(history.points[0], { year: 1984, rate: 91.8, candidates: [91.8] });
  assert.equal(history.conflictingYears.includes(1984), false);
});

test('failed requests surface as Data360Error and are not cached', async () => {
  globalThis.fetch = (async () => new Response('', { status: 429 })) as typeof fetch;
  await assert.rejects(getRates('private', 'default', GLOBAL_TOTAL), (error: unknown) => {
    return error instanceof Data360Error && error.kind === 'rate_limited';
  });
  serve(FIXTURE);
  const stat = (await getRates('private', 'default', GLOBAL_TOTAL)).get('WLD');
  assert.equal(stat?.rate.value, 3.45);
});

test('a transient Data360 failure is retried once', async () => {
  const counter = serveAfterFailures(FIXTURE, 1, 503);
  const stat = (await getRates('private', 'default', GLOBAL_TOTAL)).get('WLD');
  assert.equal(stat?.rate.value, 3.45);
  assert.equal(counter.requests, 2);
});

test('when a cache refresh fails, the last good response is served', async () => {
  mock.timers.enable({ apis: ['Date'], now: 0 });
  assert.equal((await getRates('private', 'default', GLOBAL_TOTAL)).get('WLD')?.rate.value, 3.45);
  mock.timers.tick(2 * 3_600_000);
  const counter = serveAfterFailures(FIXTURE, Infinity, 503);
  assert.equal((await getRates('private', 'default', GLOBAL_TOTAL)).get('WLD')?.rate.value, 3.45);
  assert.equal(counter.requests, 2, 'the expired entry must be refreshed (and retried) before falling back');
});

test('responses larger than one page are fetched completely and in order', async () => {
  const rows = Array.from({ length: 2345 }, (_, i) => ({ ...FIXTURE[0], DATABASE_ID: 'PAGED', OBS_VALUE: String(i) }));
  serve(rows);
  const fetched = await fetchObservations({ DATABASE_ID: 'PAGED' });
  assert.deepEqual(fetched.map((r) => r.OBS_VALUE), rows.map((r) => r.OBS_VALUE));
});

test('confidence intervals published with swapped bounds are reported in order', async () => {
  const stat = (await getRates('private', 'default', { ...GLOBAL_TOTAL, REF_AREA: 'EAS', SECTOR: 'BK' })).get('EAS');
  assert.equal(stat?.rate.value, 2.48366);
  assert.deepEqual(stat?.ci90, [0.566996, 4.400324]);
});

test('country names resolve to ISO3 codes without matching word prefixes', () => {
  assert.deepEqual(resolveCountry('ken'), { code: 'KEN' });
  assert.deepEqual(resolveCountry('Côte d’Ivoire'), { code: 'CIV' });
  assert.deepEqual(resolveCountry("Cote d'Ivoire"), { code: 'CIV' });
  assert.deepEqual(resolveCountry('Turkiye'), { code: 'TUR' });
  assert.deepEqual(resolveCountry('Viet Nam'), { code: 'VNM' });
  assert.deepEqual(resolveCountry('Egypt'), { code: 'EGY' });
  assert.deepEqual(resolveCountry('Bosnia'), { code: 'BIH' });
  assert.deepEqual(resolveCountry('Turkey'), { code: 'TUR' });
  assert.deepEqual(resolveCountry('DRC'), { code: 'COD' });
  assert.ok('error' in resolveCountry('Niger'), 'Niger must not resolve to Nigeria');
});

test('default and recovery rates break down by loan currency, each with its own interval', async () => {
  const defaults = await getRates('private', 'default', GLOBAL_TOTAL, 'CURRENCY_TYPE');
  assert.equal(defaults.get('FC')?.rate.value, 3.26);
  assert.deepEqual(defaults.get('FC')?.ci90, [2.9, 3.62]);
  assert.equal(defaults.get('LC_P')?.rate.value, 6.32);
  assert.deepEqual(defaults.get('LC_P')?.ci90, [5.31, 7.33]);
  assert.equal(defaults.get('_T')?.rate.value, 3.45);
  const recoveries = await getRates('private', 'recovery', GLOBAL_TOTAL, 'CURRENCY_TYPE');
  assert.equal(recoveries.get('LC_P')?.rate.value, 72.57);
});

test('recovery percentiles are reported only when each has a single published value', async () => {
  const eas = (await getRates('private', 'recovery', { ...GLOBAL_TOTAL, REF_AREA: 'EAS' })).get('EAS');
  assert.deepEqual(eas?.distribution, { p10: 22.203054, p25: 43.167597, median: 86.784158, p75: 99.129323, p90: 100 });
  assert.equal(eas?.distributionOmitted, undefined);
  // The global percentiles are split by a dimension the API does not expose.
  const wld = (await getRates('private', 'recovery', GLOBAL_TOTAL)).get('WLD');
  assert.equal(wld?.distribution, undefined);
  assert.equal(wld?.distributionOmitted, true);
});

test('a recovery breakdown without percentile rows reports no distribution and no omission', async () => {
  serve(FIXTURE.filter((r) => !(r.INDICATOR === 'IFC_GEM_PRR' && r.REF_AREA === 'EAS' && r.METRIC !== 'ARR')));
  const eas = (await getRates('private', 'recovery', { ...GLOBAL_TOTAL, REF_AREA: 'EAS' })).get('EAS');
  assert.ok(eas);
  assert.equal(eas.distribution, undefined);
  assert.equal(eas.distributionOmitted, undefined);
});

test('sovereign benchmark pairs GEMs and S&P default rates and drops the ambiguous global aggregate', async () => {
  const benchmark = await getSovereignBenchmark();
  assert.deepEqual(benchmark.get('EAS'), { gems: 3.64, sovereign: 3.12, vintage: '2025' });
  assert.deepEqual(benchmark.get('LIC'), { gems: 6.764915, sovereign: 28.151879, vintage: '2025' });
  assert.equal(benchmark.has('WLD'), false);
});

test('spreads and loss rates exclude values dated outside the publication vintage', async () => {
  const returns = await getReturns();
  assert.equal(returns.vintage, '2025');
  assert.deepEqual(returns.entries[0], {
    dimension: 'TOTAL',
    code: '_T',
    totalSpread: { value: 3.765236, candidates: [3.765236], method: 'unique' },
    lossRate: { value: 0.9, candidates: [0.9], method: 'unique' },
  });
  const pf = returns.entries.find((e) => e.dimension === 'PROJECT_TYPE' && e.code === 'PF');
  assert.equal(pf?.lossRate?.value, 0.952409);
  assert.equal(pf?.totalSpread, undefined);
  assert.deepEqual(returns.misdated, [{ dimension: 'PROJECT_TYPE', code: 'PF', metric: 'TS', timePeriod: '2006' }]);
});

test('an older-dated value is not reported as hidden once the vintage publishes that metric', async () => {
  const pfSpread = FIXTURE.find((r) => r.INDICATOR === 'IFC_GEM_PR_RTNS' && r.PROJECT_TYPE === 'PF' && r.METRIC === 'TS')!;
  serve([...FIXTURE, { ...pfSpread, TIME_PERIOD: '2025', OBS_VALUE: '4.2' }]);
  const returns = await getReturns();
  const pf = returns.entries.find((e) => e.dimension === 'PROJECT_TYPE' && e.code === 'PF');
  assert.equal(pf?.totalSpread?.value, 4.2);
  assert.deepEqual(returns.misdated, []);
});

test('sector history is the annual series of that sector', async () => {
  // An all-sector row for the same indicator must not leak into the sector series.
  const row = FIXTURE.find((r) => r.INDICATOR === 'IFC_GEM_PRD_H' && r.SECTOR === 'IN')!;
  serve([...FIXTURE, { ...row, SECTOR: '_T', OBS_VALUE: '9.99' }]);
  const history = await getHistory('private', 'default', 'WLD', 'IN');
  assert.equal(history.points.length, 32);
  assert.deepEqual(history.points[0], { year: 1994, rate: 0, candidates: [0] });
  assert.deepEqual(history.points.at(-1), { year: 2025, rate: 1.84, candidates: [1.84] });
});
