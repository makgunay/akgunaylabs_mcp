# GEMs MCP Efficiency & Risk Remediation Roadmap

**Last updated:** 2025-11-09

This document replaces the lightweight checklist with a **delivery-ready roadmap** that can be copied verbatim into your backlog tool. Every item now ships with scope, priority, dependencies, acceptance metrics, and prompts you can paste into Claude/Copilot for implementation handoff.

### How to use this roadmap

1. **Start with the prioritisation table** to understand the order of attack and the measurable win for each task.
2. Copy the relevant **Implementation Prompt** into your issue tracker or AI pair-programmer as-is.
3. Use the **Acceptance Criteria & Telemetry** rows to decide when a task is truly done and instrument the right metrics.

---

## Portfolio Snapshot

| ID | Theme | Priority | Effort* | Primary Win | Key Metric | Dependencies |
|----|-------|----------|---------|-------------|------------|--------------|
| A1 | Cache timer removal | P0 | M | Eliminate runaway timers in serverless | 0 stray timers / instance (observed via logs) | none |
| A2 | Latest-period selection | P0 | S | Cut unnecessary sorts in hot paths | <5 ms helper runtime @ p95 | A1 (shared utils dir) |
| A3 | Parallelised history fetch | P1 | M | Shrink long-range query latency | 40% latency drop for 10-year queries | A1 (cache), A2 |
| A4 | Automatic latest-period detection | P0 | M | Keep data fresh without manual edits | MRV coverage audit passes | A2 |
| A5 | Layered caching & dedupe | P1 | L | Prevent duplicate requests & stampedes | 80%+ cache hit rate on repeated queries | A1, A4 |
| B1 | Region indicator mismatch | P0 | S | Correct data-source wiring | Contract tests green | A4 |
| B2 | Recovery data-source mismatch | P0 | S | Align recovery metrics | Contract tests green | B1 |
| B3 | SSR-safe endpoint detection | P1 | S | Fix environment-specific endpoint display | Playwright smoke passes | none |
| B4 | Route modularisation | P2 | L | Reduce 1,800-line file risk | Lint + tests pass post-refactor | A1–A5 |
| B5 | Schema validation coverage | P1 | M | Harden inputs/outputs | 100% tool schema coverage | B4 |
| B6 | Automated test scaffolding | P0 | M | Establish regression guard rails | `pnpm test` in CI | B5 |

\*Effort legend — **S:** ≤1 day; **M:** 1–3 days; **L:** >3 days.

---

## Workstream A — Efficiency & Performance

### A1. Replace per-instance `setInterval` cache cleanup
- **Symptom & Impact:** Every cold start of `app/api/gems-risk/[transport]/route.ts` creates a new `Map` cache and an idle `setInterval` timer. In serverless runtimes this wastes compute and can leak timers on rapid redeploys.
- **Deliverables:**
  - Introduce a cache module that performs TTL checks on read/write (lazy eviction) without global timers.
  - Document the eviction strategy inside the new module.
- **Acceptance Criteria & Telemetry:**
  - No `setInterval` registrations emitted in logs during load test (inspect `console.warn`/`console.info`).
  - Cache hit ratio instrumentation added (log or metric) and observed ≥50% in staging smoke test.
- **Implementation Prompt:**
  > **Goal:** migrate to lazy TTL eviction to avoid background timers.
  >
  > **Steps:**
  > 1. Create `lib/cache.ts` exporting `getWithTtl(key, loader, ttlMs)` and `clearExpired(key?)`.
  > 2. Refactor existing cache usage in `app/api/gems-risk/[transport]/route.ts` to consume the helper.
  > 3. Instrument cache hits/misses via `console.debug` (temporary) or OpenTelemetry counter.
  > 4. Remove the `setInterval` block and ensure no global timers remain.
- **Testing Hooks:**
  - Unit tests in `__tests__/lib/cache.test.ts` covering fresh hit, expired eviction, and concurrent requests (via fake timers).
  - Load the handler in dev mode and inspect process handles via `process._getActiveHandles()` (should show zero intervals).

### A2. O(1) latest-period selection
- **Symptom & Impact:** Several helper functions sort full indicator arrays just to pick the latest record. Sorting inside hot paths adds unnecessary `O(n log n)` cost.
- **Deliverables:**
  - Replace sort-and-slice patterns with single-pass max-date selection.
  - Centralize the logic in a utility (`selectLatestObservation`).
- **Acceptance Criteria & Telemetry:**
  - Unit benchmarks show ≥70% speedup over sort-based approach at 5k observations.
  - No helper mutates the original array (verified in tests).
- **Implementation Prompt:**
  > **Goal:** drop expensive sorts from hot paths.
  >
  > **Steps:**
  > 1. Add `lib/timeSeries.ts` with `selectLatestObservation<T extends { period: string }>(items: T[]): T | undefined` using a single pass.
  > 2. Replace `.sort().at(0)` patterns in data helpers (`getRegionData`, `getSectorData`, etc.).
  > 3. Include optional comparator hook for non-standard period formats (pass via options).
- **Testing Hooks:**
  - Snapshot tests feeding unsorted arrays (including duplicates) and verifying immutability.
  - Micro-benchmark with Vitest `bench` comparing old vs new helper.

### A3. Parallelize historical fetch loops
- **Symptom & Impact:** Historical analyzers loop over multi-year ranges with sequential `await`s, multiplying latency for large windows.
- **Deliverables:**
  - Batch requests with `Promise.allSettled` (or a pool) and configurable concurrency limits.
  - Guard against API rate limits with a small concurrency (e.g., 3–5).
- **Acceptance Criteria & Telemetry:**
  - p95 latency for 20-year historical request ≤60% of current baseline (record baseline before change).
  - No increase in 429 responses from Data360 (track via error counter).
- **Implementation Prompt:**
  > **Goal:** reduce latency for historical aggregations.
  >
  > **Steps:**
  > 1. Build `lib/concurrency.ts` exporting `runWithConcurrency(items, limit, worker)` using a bounded queue.
  > 2. Refactor historical loops to use the helper (default limit 4, configurable via env var `GEMS_CONCURRENCY_LIMIT`).
  > 3. Log queue start/end timestamps for observability (remove or downgrade post verification).
- **Testing Hooks:**
  - Integration test stubbing Data360 client that asserts simultaneous calls (capture timestamps).
  - Failure path test ensuring partial errors surface aggregated message with affected years.

### A4. Automatic “latest available” period detection
- **Symptom & Impact:** All indicator payloads force `TIME_PERIOD: "2024"`, so the API goes stale as soon as the dataset updates.
- **Deliverables:**
  - Add support for MRV (Most Recent Value) queries or dynamic period detection per indicator.
  - Surface the resolved period in tool responses for transparency.
- **Acceptance Criteria & Telemetry:**
  - Tool responses include `resolvedPeriod` property validated in schema.
  - Nightly MRV audit job (script) finds zero indicators stuck on stale year.
- **Implementation Prompt:**
  > **Goal:** automatically stay on the most recent data without manual edits.
  >
  > **Steps:**
  > 1. Extend the Data360 client signature to accept `{ period?: string; mrv?: number }`.
  > 2. Default to `{ mrv: 1 }` and pass through to the API layer when no explicit year provided.
  > 3. Augment tool responses with `resolvedPeriod` and update Zod schema accordingly.
  > 4. Write a small `scripts/audit-latest-period.ts` that calls critical indicators nightly and alerts if stale.
- **Testing Hooks:**
  - Contract test verifying the client requests `MRV=1` when no period is supplied and correctly surfaces the returned year.
  - Unit test ensuring explicit `period` overrides MRV behaviour.

### A5. Layered caching & response de-duplication
- **Symptom & Impact:** Repeated identical queries (same indicator, filters) re-hit Data360 even when results are cached locally.
- **Deliverables:**
  - Introduce a normalized cache key builder for tool requests.
  - Implement request de-duplication (in-flight promise reuse) to prevent stampedes.
- **Acceptance Criteria & Telemetry:**
  - Cache hit rate ≥80% for repeated dashboard queries (measured via added metric).
  - Zero duplicate upstream requests observed under synthetic 10× concurrency test.
- **Implementation Prompt:**
  > **Goal:** avoid hammering Data360 for identical queries.
  >
  > **Steps:**
  > 1. Add `lib/cacheKeys.ts` with deterministic serialization (`sortedCountryCodes`, stable JSON stringify).
  > 2. Create `lib/promiseCache.ts` to memoise in-flight calls and clear on rejection.
  > 3. Wrap each tool’s Data360 request path with the memoiser + TTL cache.
  > 4. Emit metrics (`cache.hit`, `cache.miss`, `dedupe.collisions`) via OpenTelemetry.
- **Testing Hooks:**
  - Concurrency test faking 10 simultaneous identical requests verifies only one Data360 call.
  - Chaos test: force the upstream promise to reject and ensure memoiser clears entry for retries.

---

## Workstream B — Potential Bugs & Risky Behaviour

### B1. Wrong indicator for regional private/public splits
- **Symptom & Impact:** `getRegionData` always queries `IFC_GEM_PRD_H` (private defaults) even when the caller requests sovereign or public sectors, producing mixed datasets.
- **Deliverables:**
  - Route region requests to sector-appropriate indicator codes.
  - Add exhaustive mappings for sovereign/public/private combinations.
- **Acceptance Criteria & Telemetry:**
  - Regression suite proves correct indicator selection for each `data_source`.
  - Telemetry log for each response includes `indicatorUsed`, allowing production sanity checks.
- **Implementation Prompt:**
  > **Goal:** align regional queries with the requested data source.
  >
  > **Steps:**
  > 1. Create `lib/gemsIndicators.ts` with explicit mappings from `(analysisType, dataSource)` to indicator codes.
  > 2. Update `getRegionData` to consume the mapping and throw on unsupported combinations.
  > 3. Attach `indicatorUsed` to the tool response payload for observability.
- **Testing Hooks:**
  - Contract tests covering sovereign/public/private paths with mocks verifying correct indicator is passed.
  - Negative test ensuring unsupported sources raise descriptive error.

### B2. Recovery tool ignores requested data source
- **Symptom & Impact:** The multidimensional analysis tool defaults to public recovery metrics, even when sovereign/private is requested.
- **Deliverables:**
  - Align recovery indicator selection with the caller’s `data_source`.
  - Ensure metadata/tool responses identify the indicator actually used.
- **Acceptance Criteria & Telemetry:**
  - Contract tests green for every `data_source` with correct indicator selection.
  - Response payload exposes `indicatorUsed` aligning with inputs.
- **Implementation Prompt:**
  > **Goal:** stop returning mismatched recovery metrics.
  >
  > **Steps:**
  > 1. Reuse the mapping in `lib/gemsIndicators.ts` for recovery tools.
  > 2. Adjust tool schema to include `indicatorUsed`.
  > 3. Add guard rails that throw when mapping is missing instead of silent fallback.
- **Testing Hooks:**
  - Unit test mocking each `data_source` path to assert correct indicator.
  - Regression test verifying sovereign requests no longer return public figures.

### B3. SSR-safe endpoint detection on `/gems-risk`
- **Symptom & Impact:** The marketing page references `window.location` during server render, breaking local previews and alternate domains.
- **Deliverables:**
  - Gate `window` usage behind client-only checks or use `headers().get("host")` on the server.
  - Ensure the UI displays the correct MCP endpoint in all environments.
- **Acceptance Criteria & Telemetry:**
  - Playwright smoke test passes when visiting `/gems-risk` with custom host header.
  - No hydration warnings in Next.js dev console.
- **Implementation Prompt:**
  > **Goal:** make endpoint discovery resilient to SSR.
  >
  > **Steps:**
  > 1. Move endpoint derivation into a server utility using `headers().get("host")`.
  > 2. Pass computed base URL as prop to client component.
  > 3. Add client fallback to handle dynamic host changes post-hydration.
- **Testing Hooks:**
  - Playwright test with overridden host verifying rendered endpoint.
  - React Testing Library unit test ensuring component accepts injected endpoint prop.

### B4. Monolithic MCP route maintainability risk
- **Symptom & Impact:** `route.ts` exceeds 1,800 lines, making regressions likely when editing multiple tools.
- **Deliverables:**
  - Split the route into cohesive modules (tool registrations, shared utilities, Data360 client).
  - Introduce a barrel export that keeps the API surface unchanged.
- **Acceptance Criteria & Telemetry:**
  - All lint/test pipelines pass after refactor with zero behavioural regressions.
  - File length of `route.ts` reduced to <300 lines; new modules documented in README.
- **Implementation Prompt:**
  > **Goal:** improve maintainability without breaking transport interface.
  >
  > **Steps:**
  > 1. Create `app/api/gems-risk/[transport]/tools/` folder; move each tool into its own module.
  > 2. Export `registerTools(server)` from `tools/index.ts` and consume in `route.ts`.
  > 3. Relocate shared utilities to `lib/` and update imports.
- **Testing Hooks:**
  - Smoke test asserting the handler still registers all expected tool names.
  - Lint check ensuring no circular dependencies introduced.

### B5. Validation gaps & misaligned schema enforcement
- **Symptom & Impact:** Without strict input validation per tool, malformed parameters may slip through, triggering runtime errors.
- **Deliverables:**
  - Define Zod schemas for every tool input/output.
  - Return structured error payloads when validation fails.
- **Acceptance Criteria & Telemetry:**
  - Schema coverage report shows 100% of tools with explicit input & output schemas.
  - Error logs now emit structured payload with `reason`, `hint`, and `status`.
- **Implementation Prompt:**
  > **Goal:** harden tool interface contracts.
  >
  > **Steps:**
  > 1. Create `lib/schemas.ts` exporting Zod schemas per tool.
  > 2. Refactor each `server.tool` registration to reference the schema and coerce outputs.
  > 3. Wrap tool execution in try/catch that maps Zod errors to MCP-compliant error responses.
- **Testing Hooks:**
  - Negative integration tests sending invalid payloads assert clean MCP error response.
  - Unit tests confirming schema rejects malformed parameters (e.g., wrong enum value).

### B6. Missing automated test scaffolding
- **Symptom & Impact:** `package.json` lacks test scripts; regressions go undetected.
- **Deliverables:**
  - Add Vitest (or Jest) with ts-node/tsx support.
  - Provide `pnpm test` and `pnpm test:integration` scripts, plus CI wiring.
- **Acceptance Criteria & Telemetry:**
  - `pnpm test` passes locally and in CI GitHub Action.
  - Coverage report generated for unit tests (target ≥70% for new modules).
- **Implementation Prompt:**
  > **Goal:** establish the baseline for automated testing.
  >
  > **Steps:**
  > 1. Install Vitest + Testing Library for Node; add `vitest.config.ts` with `testEnvironment: 'node'`.
  > 2. Create sample tests for cache helper and indicator mapping to prevent regressions.
  > 3. Update `package.json` scripts and add GitHub Action workflow `ci.yml` running lint + test.
- **Testing Hooks:**
  - Ensure `pnpm test` runs locally and in CI with at least one passing unit test.
  - Document test commands in `README.md` testing section.

---

## Tracking & Next Steps
1. **Log these items** in your issue tracker using the provided prompts.
2. **Prioritize** Workstream A items before B to unlock performance headroom for future features.
3. **Review** this roadmap after the first implementation sprint and adjust based on telemetry (latency, cache hit rate, bug count).

