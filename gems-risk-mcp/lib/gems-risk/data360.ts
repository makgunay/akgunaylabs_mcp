// Minimal client for the World Bank Data360 data API.

import { setTimeout as sleep } from 'node:timers/promises';

const API_URL = 'https://data360api.worldbank.org/data360/data';
const USER_AGENT = 'gems-risk-mcp (+https://mcp.akgunaylabs.io)';
const PAGE_SIZE = 1000;
// Data360 answers in under a second; one retry keeps the worst case per page near 30 s.
const TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 250;
// GEMs statistics are republished once a year; an hour keeps warm instances cheap without serving stale vintages.
const CACHE_TTL_MS = 3_600_000;
// After a failed refresh the previous response is served, and the refresh retried after this delay.
const FAILED_REFRESH_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 500;

export interface Observation {
  INDICATOR: string;
  METRIC: string;
  REF_AREA: string;
  TIME_PERIOD: string;
  OBS_VALUE: string;
  UNIT_MEASURE: string;
  DECIMALS?: string | null;
  SECTOR: string;
  PROJECT_TYPE: string;
  SENIORITY: string;
  [dimension: string]: string | null | undefined;
}

export type Filters = Record<string, string>;

export type Data360ErrorKind = 'timeout' | 'rate_limited' | 'unavailable' | 'http' | 'network' | 'malformed';

export class Data360Error extends Error {
  readonly kind: Data360ErrorKind;

  constructor(kind: Data360ErrorKind, message: string) {
    super(message);
    this.name = 'Data360Error';
    this.kind = kind;
  }
}

interface Page {
  count: number;
  value: Observation[];
}

interface CacheEntry {
  expires: number;
  rows: Promise<Observation[]>;
  /** Last successful response for this key. */
  good?: Observation[];
}

const cache = new Map<string, CacheEntry>();

/**
 * Fetch every observation matching `filters` (all pages). Dimensions left out of `filters` are not constrained.
 * Resolves to [] when Data360 has no matching data; rejects with Data360Error on transport/API failure unless an
 * earlier response for the same filters is cached, which is then served instead.
 * Concurrent calls with the same filters share one request.
 */
export function fetchObservations(filters: Filters): Promise<Observation[]> {
  const key = Object.keys(filters).sort().map((k) => `${k}=${filters[k]}`).join('&');
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.rows;

  const previous = hit?.good;
  const entry: CacheEntry = { expires: now + CACHE_TTL_MS, rows: Promise.resolve([]), good: previous };
  entry.rows = fetchAllPages(filters).then(
    (rows) => {
      entry.good = rows;
      return rows;
    },
    (error: unknown) => {
      if (previous) {
        console.warn(`Data360 refresh failed, serving cached data for ${key}:`, (error as Error).message);
        entry.expires = Date.now() + FAILED_REFRESH_TTL_MS;
        return previous;
      }
      if (cache.get(key) === entry) cache.delete(key);
      throw error;
    },
  );
  // Re-insert so Map order tracks recency of refresh; evict the stalest entry.
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  return entry.rows;
}

/** Test seam: forget cached responses. */
export function clearObservationCache(): void {
  cache.clear();
}

async function fetchAllPages(filters: Filters): Promise<Observation[]> {
  const first = await fetchPage(filters, 0);
  const skips: number[] = [];
  for (let skip = PAGE_SIZE; skip < first.count; skip += PAGE_SIZE) skips.push(skip);
  const rest = await Promise.all(skips.map((skip) => fetchPage(filters, skip)));
  return first.value.concat(...rest.map((page) => page.value));
}

/** One page, retried once after a timeout, network error or 5xx. */
async function fetchPage(filters: Filters, skip: number): Promise<Page> {
  try {
    return await requestPage(filters, skip);
  } catch (error) {
    const kind = error instanceof Data360Error ? error.kind : undefined;
    if (kind !== 'timeout' && kind !== 'unavailable' && kind !== 'network') throw error;
    await sleep(RETRY_DELAY_MS);
    return requestPage(filters, skip);
  }
}

async function requestPage(filters: Filters, skip: number): Promise<Page> {
  const params = new URLSearchParams({ ...filters, top: String(PAGE_SIZE), skip: String(skip) });
  const timeout = () => new Data360Error('timeout', `Data360 did not respond within ${TIMEOUT_MS / 1000}s`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') throw timeout();
    throw new Data360Error('network', `Unable to reach World Bank Data360: ${(error as Error).message}`);
  }

  if (response.status === 429) {
    throw new Data360Error('rate_limited', 'Data360 rate limit exceeded; retry in a few minutes');
  }
  if (response.status >= 500) {
    throw new Data360Error('unavailable', `Data360 is unavailable (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new Data360Error('http', `Data360 request failed with HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    // The timeout signal also covers reading the body.
    if (error instanceof Error && error.name === 'TimeoutError') throw timeout();
    throw new Data360Error('malformed', 'Data360 returned invalid JSON');
  }
  const page = body as Partial<Page>;
  if (!Array.isArray(page.value) || typeof page.count !== 'number') {
    throw new Data360Error('malformed', 'Data360 returned an unexpected response shape');
  }
  return page as Page;
}
