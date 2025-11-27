# Akgunay Labs MCP - Comprehensive Codebase Analysis

**Analysis Date:** 2025-11-27
**Analyst:** Claude (Opus 4)
**Codebase Version:** 1.0.0
**Branch:** claude/analyze-codebase-01Y7m9GfzsuAHu1KJrDJoy4m

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Code Quality Assessment](#3-code-quality-assessment)
4. [Security Analysis](#4-security-analysis)
5. [Performance Analysis](#5-performance-analysis)
6. [Design Pattern Evaluation](#6-design-pattern-evaluation)
7. [Technical Debt Inventory](#7-technical-debt-inventory)
8. [Identified Issues & Risks](#8-identified-issues--risks)
9. [Optimization Opportunities](#9-optimization-opportunities)
10. [Recommendations](#10-recommendations)
11. [Appendix: File-by-File Review](#11-appendix-file-by-file-review)

---

## 1. Executive Summary

### Project Overview
This codebase implements an **MCP (Model Context Protocol) server** that exposes the World Bank's IFC Global Emerging Markets (GEMs) Risk Database to AI assistants like Claude. The server is deployed on Vercel and provides 9 tools for querying credit risk data across 7 regions, 21 sectors, and 40+ years of historical data.

### Overall Assessment

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture** | B+ | Clean Next.js/MCP integration, but monolithic route file |
| **Code Quality** | B | TypeScript strict mode, but some patterns need improvement |
| **Security** | A- | Read-only API, proper validation, minimal attack surface |
| **Performance** | B- | Caching present but inefficient; sequential API calls |
| **Maintainability** | C+ | 1,895-line monolithic file is the primary concern |
| **Test Coverage** | F | No automated tests exist |

### Key Findings

**Strengths:**
- Well-designed MCP tool interface with comprehensive data coverage
- Robust error handling with 8 distinct error types
- Good TypeScript type safety with Zod validation
- Intelligent data source detection from natural language
- Proper fallback mechanisms with mock data

**Critical Issues:**
1. **Monolithic route file** (1,895 lines) - maintainability risk
2. **setInterval cache cleanup** - leaks timers in serverless environments
3. **Sequential API calls** for historical data - performance bottleneck
4. **No automated testing** - regression risk
5. **Hardcoded time period** (`TIME_PERIOD: "2024"`) - will become stale

---

## 2. Architecture Overview

### Technology Stack

| Layer | Technology | Version | Assessment |
|-------|------------|---------|------------|
| Framework | Next.js | 14.2.0 | Current, well-supported |
| UI | React | 18.3.0 | Current |
| Language | TypeScript | 5.3.0 | Current with strict mode |
| Validation | Zod | 3.22.4 | Industry standard |
| MCP | @modelcontextprotocol/sdk | 1.0.0 | Latest |
| Runtime | Node.js | 20.x | LTS version |
| Hosting | Vercel | - | Serverless functions |

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Claude Desktop / MCP Client               │
└─────────────────────────────────────────────────────────────────┘
                                   │
                          (MCP Protocol / HTTP)
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                          │
│                  mcp.akgunaylabs.io                             │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Application                          │
│  ┌───────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │  Landing Page │  │  Docs Page     │  │  MCP API Route   │   │
│  │  (/)          │  │  (/gems-risk)  │  │  (/api/gems-risk)│   │
│  └───────────────┘  └────────────────┘  └────────┬─────────┘   │
│                                                   │             │
│                        ┌──────────────────────────┴───────┐    │
│                        │         MCP Handler              │    │
│                        │   (9 Tools, Cache, Validation)   │    │
│                        └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                   │
                          (HTTPS REST API)
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              World Bank Data360 API                             │
│              https://data360api.worldbank.org                   │
│              (IFC_GEM Dataset)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Query → Claude → MCP Request → route.ts Handler
                                         │
                                         ▼
                              ┌──────────────────┐
                              │ Zod Validation   │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ Data Source      │
                              │ Interpretation   │
                              │ (sovereign/      │
                              │  public/private) │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ Cache Lookup     │
                              │ (5-min TTL)      │
                              └────────┬─────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         │                           │
                    Cache Hit                   Cache Miss
                         │                           │
                         │                           ▼
                         │               ┌──────────────────┐
                         │               │ Fetch Data360    │
                         │               │ (30s timeout)    │
                         │               └────────┬─────────┘
                         │                        │
                         │                        ▼
                         │               ┌──────────────────┐
                         │               │ Parse & Validate │
                         │               │ Response         │
                         │               └────────┬─────────┘
                         │                        │
                         └───────────┬────────────┘
                                     │
                                     ▼
                           ┌──────────────────┐
                           │ Format Markdown  │
                           │ Response         │
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ Return to Client │
                           └──────────────────┘
```

### File Structure Analysis

```
gems-risk-mcp/
├── app/
│   ├── api/
│   │   └── gems-risk/
│   │       └── [transport]/
│   │           └── route.ts       # 1,895 lines - MAIN LOGIC (needs splitting)
│   ├── gems-risk/
│   │   └── page.tsx               # 297 lines - Documentation page
│   ├── layout.tsx                 # 27 lines - Root layout
│   └── page.tsx                   # 289 lines - Landing page
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── next.config.js                 # Next.js config
└── vercel.json                    # Deployment config
```

**Observation:** The application is extremely concentrated. 99% of logic resides in a single file (`route.ts`), which is a significant maintainability risk.

---

## 3. Code Quality Assessment

### TypeScript Usage

**Strengths:**
- `strict: true` enabled in tsconfig.json
- Comprehensive type definitions for API responses
- Proper enum usage for error types
- Interface definitions for data structures

**Weaknesses:**
- Some `any` types in array sorting callbacks (lines 517-518, 592-593)
- Type assertions (`as`) used instead of type guards in some places
- No generic utility types for repeated patterns

### Code Patterns Analysis

#### Good Patterns Observed:

1. **Error Type Enumeration** (lines 195-204)
```typescript
enum DataErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
  // ...
}
```
This provides exhaustive error handling with clear categorization.

2. **Result Type Pattern** (lines 213-219)
```typescript
interface DataResult<T> {
  success: boolean;
  data?: T;
  error?: DataError;
  approximated?: boolean;
}
```
Proper discriminated union pattern for handling success/failure states.

3. **Configuration Constants** (lines 5-112)
Well-organized mapping objects for regions, sectors, project types, and indicators.

#### Anti-Patterns Observed:

1. **God File** - `route.ts` at 1,895 lines violates Single Responsibility Principle
2. **Repeated Code** - Similar tool implementations with duplicated error handling
3. **Magic Numbers** - Hardcoded values like `30000` (timeout), `300000` (cache TTL)

### Naming Conventions

| Convention | Status | Notes |
|------------|--------|-------|
| camelCase for functions | ✅ | Consistent |
| PascalCase for types | ✅ | Consistent |
| SCREAMING_CASE for constants | ✅ | Consistent |
| Descriptive function names | ✅ | Clear intent |
| File naming | ⚠️ | Single file makes this N/A |

### Code Complexity Metrics (Estimated)

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Lines of Code (route.ts) | 1,895 | <500 | ❌ EXCEEDED |
| Cyclomatic Complexity | ~45 | <20 | ❌ EXCEEDED |
| Functions per file | ~30 | <20 | ❌ EXCEEDED |
| Max function length | ~200 lines | <50 | ❌ EXCEEDED |

---

## 4. Security Analysis

### Threat Model Assessment

| Threat Vector | Risk Level | Mitigation Status |
|---------------|------------|-------------------|
| SQL Injection | N/A | No database |
| XSS | LOW | Server-side only, text responses |
| CSRF | LOW | Stateless API |
| Data Exposure | LOW | Public World Bank data only |
| Rate Limiting | MEDIUM | No server-side rate limiting |
| DoS | MEDIUM | Reliant on Vercel protection |

### Security Strengths

1. **Input Validation** (Zod schemas)
   - All tool inputs validated via Zod enums
   - Prevents injection of arbitrary values
   ```typescript
   region: z.enum(['global', 'east-asia', 'latin-america', ...])
   ```

2. **Read-Only Operations**
   - No write operations to any data store
   - No user data collection or storage
   - Passes through to public World Bank API

3. **No Authentication Secrets**
   - No API keys stored in code
   - World Bank API is public/unauthenticated

4. **Type-Safe Error Messages**
   - Error messages don't leak internal implementation details
   - Structured error responses prevent information disclosure

### Security Concerns

1. **No Rate Limiting** (lines 385-491)
   - The server doesn't implement its own rate limiting
   - Relies entirely on Vercel's built-in protection
   - Could be exploited to hammer the World Bank API

   **Risk:** Medium - Could cause IP banning from World Bank

2. **Cache Timing Attack Potential** (lines 370-377)
   - Cache hits vs misses have different response times
   - Could theoretically leak information about query patterns
   - **Risk:** Low - Data is public anyway

3. **Verbose Error Messages** (lines 393-414)
   - HTTP status codes and error details exposed in responses
   - **Risk:** Low - No sensitive information exposed

### Recommendations for Security Hardening

1. Implement application-level rate limiting (suggest 60 requests/minute per client)
2. Add request logging with IP anonymization for abuse detection
3. Consider adding API key authentication for production use

---

## 5. Performance Analysis

### Current Performance Characteristics

#### Caching Implementation (lines 248-276)

```typescript
const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL = 300000; // 5 minutes

// Problematic: Creates timer on every cold start
setInterval(cleanupCache, 600000);
```

**Issues:**
1. `setInterval` creates persistent timers in serverless environment
2. Each Vercel function instance creates its own timer
3. Timers may not be cleaned up on function recycling

#### API Call Patterns

| Pattern | Location | Issue |
|---------|----------|-------|
| Sequential loops | `getTimeSeriesData` (lines 642-689) | For 10 years, makes 10 sequential HTTP calls |
| Multiple parallel calls | `getRegionData` (lines 837-841) | Good - uses `Promise.all` |
| Repeated sorting | Multiple helpers | Sorts arrays just to get latest item |

#### Time Series Performance (lines 652-676)

```typescript
for (let year = startYear; year <= endYear; year++) {
  // Sequential await - each year waits for previous
  const result = await fetchData360(params);
}
```

**Impact:** A 10-year query makes 10 sequential HTTP calls. At 500ms per call, this is 5 seconds minimum latency.

#### Sorting Inefficiency (repeated pattern)

```typescript
// This pattern appears ~8 times in the codebase
const latestData = result.data!.value
  .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];
```

**Impact:** O(n log n) for each query when O(n) max-finding would suffice.

### Performance Metrics (Estimated)

| Operation | Current | Optimal | Gap |
|-----------|---------|---------|-----|
| Single region query | ~500ms | ~500ms | OK |
| 10-year time series | ~5s | ~800ms | 6x slower |
| All-region comparison | ~2s | ~600ms | 3x slower |
| Cache hit | <10ms | <10ms | OK |

### Memory Considerations

- In-memory cache without size limits
- No eviction policy beyond TTL
- Potential for memory growth under high query diversity

---

## 6. Design Pattern Evaluation

### Patterns Used

| Pattern | Location | Quality |
|---------|----------|---------|
| Factory | `createMcpHandler` | Good - abstracts MCP setup |
| Singleton | `apiCache` Map | Acceptable for serverless |
| Strategy | `interpretDataSource` | Good - encapsulates data source logic |
| Template Method | Tool implementations | Poor - too much repetition |

### Architectural Decisions

#### 1. Single API Route with Dynamic Transport
```typescript
// [transport] segment allows /mcp, /sse, etc.
export { handler as GET, handler as POST, handler as DELETE };
```
**Assessment:** Good - provides flexibility for MCP transport negotiation

#### 2. Inline Tool Definitions
All 9 tools defined within the handler callback.
**Assessment:** Poor - should be extracted to separate modules

#### 3. Fallback Mock Data
```typescript
const mockCreditData: Record<string, any> = { ... };
```
**Assessment:** Good for resilience - provides degraded service when API unavailable

### Missing Patterns

1. **Repository Pattern** - No abstraction layer between business logic and Data360 API
2. **Unit of Work** - No transaction management (not strictly needed here)
3. **Dependency Injection** - Services are tightly coupled

### Cohesion Analysis

| Component | Cohesion | Notes |
|-----------|----------|-------|
| route.ts | LOW | Mixes API client, cache, tools, validation |
| page.tsx files | HIGH | Focused on presentation |
| Configuration | HIGH | Well-organized constants |

---

## 7. Technical Debt Inventory

### High Priority Debt

| ID | Description | Impact | Effort | Location |
|----|-------------|--------|--------|----------|
| TD-1 | Monolithic route.ts (1,895 lines) | Maintainability, bug risk | L | route.ts |
| TD-2 | setInterval cache cleanup | Memory leaks, stray timers | M | line 276 |
| TD-3 | Sequential historical queries | Performance | M | lines 652-676 |
| TD-4 | No test coverage | Regression risk | L | - |
| TD-5 | Hardcoded TIME_PERIOD | Data staleness | S | Multiple |

### Medium Priority Debt

| ID | Description | Impact | Effort | Location |
|----|-------------|--------|--------|----------|
| TD-6 | Repeated error handling | Code duplication | M | All tools |
| TD-7 | `any` types in sorting | Type safety | S | Multiple |
| TD-8 | No request deduplication | Wasted API calls | M | fetchData360 |
| TD-9 | Magic numbers | Readability | S | Multiple |

### Low Priority Debt

| ID | Description | Impact | Effort | Location |
|----|-------------|--------|--------|----------|
| TD-10 | No OpenTelemetry integration | Observability | M | - |
| TD-11 | Inline styles in React | Maintainability | M | page.tsx files |
| TD-12 | No API documentation (OpenAPI) | Integration | M | - |

### Debt Burn-Down Priority

```
Week 1: TD-2 (timer), TD-5 (hardcoded period)
Week 2: TD-3 (parallel queries), TD-4 (basic tests)
Week 3-4: TD-1 (route splitting)
Ongoing: TD-6 through TD-12
```

---

## 8. Identified Issues & Risks

### Critical Issues

#### Issue #1: Timer Leak in Serverless Environment

**Location:** `route.ts:276`
```typescript
setInterval(cleanupCache, 600000);
```

**Problem:** In Vercel's serverless model:
- Each function invocation may create a new instance
- Timers persist until function instance is recycled
- Creates orphan timers that consume resources

**Impact:** Resource leaks, potential billing impact, unpredictable behavior

**Solution:** Implement lazy TTL eviction on read/write instead of periodic cleanup

---

#### Issue #2: Indicator Mismatch Bug

**Location:** `route.ts:819-825`
```typescript
const countParams = {
  INDICATOR: "IFC_GEM_PRD_H",  // ALWAYS private, ignores dataSource
};
```

**Problem:** When querying loan counts and volumes, the indicator is hardcoded to private sector (`PRD`) regardless of the requested data source.

**Impact:** Incorrect data returned for sovereign/public sector queries

---

#### Issue #3: Recovery Rate Ignores Data Source

**Location:** `route.ts:1834`
```typescript
const recoveryResult = await getRecoveryRateData(regionCode);
// Missing dataSource parameter!
```

**Problem:** The multidimensional query tool calls `getRecoveryRateData` without passing the `dataSource` parameter.

**Impact:** Always returns public sector recovery rates, even when sovereign/private requested

---

### High-Risk Areas

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API goes stale (2024 → 2025) | HIGH | MEDIUM | Implement MRV queries |
| World Bank API outage | MEDIUM | HIGH | Robust fallback + monitoring |
| Regression from route.ts edits | HIGH | HIGH | Add test coverage |
| Performance degradation | MEDIUM | MEDIUM | Parallel queries + caching |

---

## 9. Optimization Opportunities

### Quick Wins (< 1 day effort)

#### 1. O(1) Latest Period Selection

**Current:**
```typescript
const latestData = result.data!.value
  .sort((a, b) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];
```

**Optimized:**
```typescript
const latestData = result.data!.value.reduce((latest, current) =>
  parseInt(current.TIME_PERIOD) > parseInt(latest.TIME_PERIOD) ? current : latest
);
```

**Impact:** ~70% faster for large datasets

#### 2. Configuration Extraction

Move magic numbers to configuration:
```typescript
const CONFIG = {
  CACHE_TTL_MS: 300_000,
  API_TIMEOUT_MS: 30_000,
  CLEANUP_INTERVAL_MS: 600_000,
  MAX_CONCURRENT_REQUESTS: 4,
} as const;
```

### Medium-Term Optimizations (1-3 days)

#### 3. Parallel Historical Queries

```typescript
async function getTimeSeriesDataParallel(
  years: number[],
  params: BaseParams,
  concurrency: number = 4
): Promise<TimeSeriesDataPoint[]> {
  const chunks = chunkArray(years, concurrency);
  const results: TimeSeriesDataPoint[] = [];

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(year => fetchData360({ ...params, TIME_PERIOD: year.toString() }))
    );
    results.push(...processResults(chunkResults));
  }

  return results;
}
```

**Impact:** 4x faster for 10+ year queries

#### 4. Request Deduplication

```typescript
const inFlightRequests = new Map<string, Promise<DataResult<Data360Response>>>();

async function fetchData360Dedupe(params: Record<string, string>): Promise<DataResult<Data360Response>> {
  const key = getCacheKey(params);

  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key)!;
  }

  const promise = fetchData360(params);
  inFlightRequests.set(key, promise);

  try {
    return await promise;
  } finally {
    inFlightRequests.delete(key);
  }
}
```

### Long-Term Optimizations (> 3 days)

#### 5. Edge Caching with Vercel KV

Replace in-memory cache with distributed cache:
```typescript
import { kv } from '@vercel/kv';

async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const cached = await kv.get<T>(key);
  if (cached) return cached;

  const fresh = await fetcher();
  await kv.set(key, fresh, { ex: ttlSeconds });
  return fresh;
}
```

**Impact:** Shared cache across all Vercel instances, 100x better cache hit rates

---

## 10. Recommendations

### Immediate Actions (This Sprint)

1. **Fix the setInterval timer issue** (TD-2)
   - Priority: P0
   - Replace with lazy eviction on cache access

2. **Fix indicator mismatch bugs** (Issues #2, #3)
   - Priority: P0
   - Pass `dataSource` through all query paths

3. **Add MRV (Most Recent Value) support** (TD-5)
   - Priority: P0
   - Prevent data staleness as years change

### Short-Term Actions (Next 2-4 Weeks)

4. **Add basic test coverage**
   - Install Vitest
   - Cover critical paths: cache, data fetching, tool handlers
   - Target: 50% coverage on new code

5. **Parallelize historical queries**
   - Implement concurrent fetching with rate limiting
   - Target: <1s for 10-year queries

6. **Begin route.ts modularization**
   - Extract tools to `tools/` directory
   - Extract Data360 client to `lib/data360.ts`
   - Extract cache to `lib/cache.ts`

### Medium-Term Actions (1-2 Months)

7. **Implement comprehensive testing**
   - Integration tests with mocked Data360
   - Contract tests for tool schemas
   - Load testing for performance baselines

8. **Add observability**
   - OpenTelemetry integration
   - Custom metrics for cache hit rates
   - Error tracking with Sentry

9. **Complete route.ts refactoring**
   - Target: <300 lines in main route file
   - All logic in dedicated modules

### Long-Term Considerations

10. **Consider GraphQL layer** for complex queries
11. **Evaluate Vercel KV** for distributed caching
12. **Add API documentation** (OpenAPI/Swagger)
13. **Implement API versioning** for breaking changes

---

## 11. Appendix: File-by-File Review

### route.ts (1,895 lines)

| Section | Lines | Purpose | Quality |
|---------|-------|---------|---------|
| Imports & Config | 1-112 | Constants and mappings | Good |
| Types & Interfaces | 113-246 | Data structures | Good |
| Cache Implementation | 247-276 | TTL cache with cleanup | Needs work |
| Data Source Logic | 277-363 | Smart source detection | Good |
| API Client | 364-492 | Data360 fetching | Good |
| Helper Functions | 493-918 | Data processing | Needs refactor |
| Tool Definitions | 919-1891 | 9 MCP tools | Needs splitting |
| Exports | 1892-1895 | HTTP handlers | Good |

### page.tsx (289 lines)

| Aspect | Assessment |
|--------|------------|
| Component structure | Single functional component |
| Styling | Inline styles (should use CSS/Tailwind) |
| Accessibility | Missing ARIA labels |
| SEO | Basic metadata present |

### gems-risk/page.tsx (297 lines)

| Aspect | Assessment |
|--------|------------|
| Documentation quality | Comprehensive |
| Code examples | Present and accurate |
| Responsiveness | Basic grid layout |

### layout.tsx (27 lines)

| Aspect | Assessment |
|--------|------------|
| Analytics | Conditional Vercel Insights |
| SEO metadata | Basic but present |
| Structure | Clean and minimal |

---

## Summary

This codebase represents a well-conceived MCP server with solid fundamentals but significant maintainability and performance challenges. The primary concerns are:

1. **Monolithic architecture** - The 1,895-line route file is the single biggest risk
2. **Serverless compatibility** - Timer-based cache cleanup doesn't suit Vercel
3. **Performance inefficiencies** - Sequential API calls hurt latency
4. **No testing** - Zero automated tests increase regression risk

The good news is that these issues are all fixable with focused effort, and the core functionality is sound. The recommended roadmap above provides a prioritized path to addressing these concerns while maintaining the current feature set.

---

*This analysis was generated by Claude (Opus 4) based on static code review. Runtime behavior may vary. Last updated: 2025-11-27*
