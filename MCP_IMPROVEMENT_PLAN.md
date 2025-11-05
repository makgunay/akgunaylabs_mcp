# GEMS Risk MCP Server - Comprehensive Improvement Plan

**Date:** 2025-11-05
**Status:** Research Complete - Ready for Implementation
**Priority:** HIGH - Multiple critical gaps identified

---

## Executive Summary

After comprehensive analysis of the World Bank Data360 API specification and IFC_GEM database, significant opportunities exist to enhance our MCP server's capabilities. Current implementation uses only ~10% of available data, relies on estimated recovery rates instead of real data, and lacks critical features like time series analysis, project type breakdowns, and proper sector data.

**Key Impact:**
- **Data Accuracy:** Switch from estimated to real recovery rates (73% estimated → actual API data)
- **Data Breadth:** Expand from 1 indicator to 5 available indicators
- **Data Depth:** Add project type, sector, and time series dimensions
- **Reliability:** Implement error handling, caching, and pagination

---

## Part 1: API Research Findings

### 1.1 World Bank Data360 API Capabilities

**Available Endpoints:**
- `/data360/data` - Primary data retrieval with extensive filtering
- `/data360/indicators` - List available indicators per database
- `/data360/disaggregation` - Get possible data breakdowns
- `/data360/metadata` - Retrieve metadata via POST
- `/data360/searchv2` - Full-text and vector search

**Query Parameters Supported:**
- Geographic: REF_AREA (country/region codes)
- Temporal: TIME_PERIOD, FREQ, timePeriodFrom/To
- Dimensional: SECTOR, PROJECT_TYPE, CREDIT_RATING, etc.
- Status: OBS_STATUS, LATEST_DATA flag
- Pagination: skip parameter (max 1000 records/call)

**Response Structure:**
```json
{
  "count": 5,
  "value": [
    {
      "DATABASE_ID": "IFC_GEM",
      "INDICATOR": "IFC_GEM_PBD",
      "METRIC": "ADR",
      "REF_AREA": "_T",
      "TIME_PERIOD": "2024",
      "OBS_VALUE": "2.6054477543955503",
      "UNIT_MEASURE": "PT",
      "SECTOR": "_T",
      "PROJECT_TYPE": "_T",
      "CREDIT_RATING": "_Z",
      ...
    }
  ]
}
```

**Authentication:** None required (public API)
**Rate Limits:** Not documented (needs testing)
**License:** Creative Commons 4.0 Attribution

### 1.2 IFC_GEM Database Structure

**Available Indicators:**

| Indicator | Description | Status |
|-----------|-------------|--------|
| **IFC_GEM_PBD** | Public default rates (current) | ✅ **IN USE** |
| **IFC_GEM_PBD_H** | Public default rates (historical) | ❌ Not used |
| **IFC_GEM_PBR** | Public recovery rates | ❌ Not used (currently ESTIMATED) |
| **IFC_GEM_PRD** | Private default rates (current) | ❌ Not used |
| **IFC_GEM_PRD_H** | Private default rates (historical) | ❌ Not used |

**Available Metrics per Indicator:**

| Metric | Description | Unit | Current Usage |
|--------|-------------|------|---------------|
| **ADR** | Average Default Rate | PT (%) | ✅ Used for defaults |
| **CP** | Counterparts (count) | CP | ✅ Used for loan counts |
| **DT** | Defaults (count) | CP | ❌ Not used |
| **SA** | Signed Amount (volume) | USD | ✅ Used for volumes |
| **OBS** | Observations | CP | ❌ Not used |
| **OBS_MAX** | Maximum observations | CP | ❌ Not used |
| **OBS_MIN** | Minimum observations | CP | ❌ Not used |
| **OY** | Observation years | CP | ❌ Not used |
| **ARR** | Average Recovery Rate | PT (%) | ❌ **CRITICAL: Should replace estimates!** |
| **MEDIAN** | Median recovery rate | PT (%) | ❌ Not used |
| **CT** | Count | CP | ❌ Not used |

**Available Dimensions:**

1. **PROJECT_TYPE** (Verified with API):
   - `_T` = Total/All projects (2.61% default rate)
   - `CF` = Corporate Finance (5.05% default rate)
   - `FI` = Financial Institution (3.16% default rate)
   - `O` = Other (1.74% default rate)
   - `PF` = Project Finance (1.65% default rate)

2. **SECTOR** (API returns values like 'F', 'I', etc.):
   - `_T` = Total/All sectors
   - `F` = Financial services (verified: 2.79% default rate)
   - Additional sectors need mapping

3. **REF_AREA** (Regions - Currently in use):
   - `_T` = Global
   - `SSF` = Sub-Saharan Africa
   - `EAS` = East Asia & Pacific
   - `ECS` = Europe & Central Asia
   - `LCN` = Latin America & Caribbean
   - `MEA` = Middle East & North Africa
   - `SAS` = South Asia

4. **Other Dimensions** (not yet explored):
   - CONTRACT_SIZE
   - CREDIT_RATING
   - TIME_DEFAULT
   - CURRENCY_TYPE
   - GEMS_RATING
   - DEFAULT_TYPE
   - SENIORITY
   - RR_BAND

---

## Part 2: Current Implementation Analysis

### 2.1 Existing Tools (5 total)

1. **get_default_rates(region)**
   - Uses: IFC_GEM_PBD, METRIC=ADR
   - Returns: Default rate % for region
   - ✅ Works correctly (after recent bug fix)

2. **get_recovery_rates(region)**
   - Uses: **ESTIMATED** recovery rates (NOT real data!)
   - Formula: `globalAvgRecovery + (globalAvgDefault - defaultRate) * 1.5`
   - ❌ Should use IFC_GEM_PBR with METRIC=ARR

3. **query_credit_risk(region)**
   - Combines default + recovery rates
   - Calculates expected loss
   - ⚠️ Recovery rates are estimated, not real

4. **get_sector_analysis(sector?)**
   - Uses: **MOCK DATA** (hardcoded mockSectorData array)
   - ❌ Should use real API data with SECTOR dimension

5. **compare_regions(metric)**
   - Compares default/recovery across regions
   - ⚠️ Recovery rates are estimated

### 2.2 Critical Gaps Identified

**DATA ACCURACY ISSUES:**
1. ❌ **Recovery rates are ESTIMATED, not real** (lines 202-206)
   ```typescript
   // Current (WRONG):
   const globalAvgRecovery = 73;
   const recoveryAdjustment = (globalAvgDefault - defaultRate) * 1.5;
   const recoveryRate = Math.max(60, Math.min(80, globalAvgRecovery + recoveryAdjustment));

   // Should be:
   // Fetch from IFC_GEM_PBR with METRIC=ARR
   ```

2. ❌ **Sector data is MOCK** (lines 89-97)
   ```typescript
   const mockSectorData = [
     { sector: "Financial Services", defaultRate: 2.8, ... }, // NOT REAL!
     ...
   ];
   ```

**MISSING FEATURES:**
3. ❌ No project type analysis (CF, FI, O, PF)
4. ❌ No time series / historical trends
5. ❌ No default count analysis (DT metric)
6. ❌ No private default rates (IFC_GEM_PRD)
7. ❌ No detailed sector breakdowns (real API data)
8. ❌ No observation count tracking (OBS metric)

**TECHNICAL LIMITATIONS:**
9. ❌ No pagination support (API max 1000 records)
10. ❌ No caching strategy (repeated API calls)
11. ❌ No rate limit handling
12. ❌ Limited error handling for API failures
13. ❌ Hardcoded TIME_PERIOD="2024" (no flexibility)

**API USAGE INEFFICIENCIES:**
14. ⚠️ Fetches multiple metrics separately instead of single comprehensive query
15. ⚠️ No use of LATEST_DATA flag for efficiency
16. ⚠️ No use of disaggregation endpoint to discover available dimensions

---

## Part 3: Improvement Recommendations

### Priority 1: CRITICAL - Data Accuracy (Immediate)

#### 3.1.1 Replace Estimated Recovery Rates with Real Data

**Problem:** Currently using formula-based estimates (73% baseline)
**Solution:** Use IFC_GEM_PBR indicator with ARR metric

**Implementation:**
```typescript
// Add new function:
async function getRecoveryRateData(region: string) {
  const apiCode = REGION_NAMES[region.toLowerCase()];
  if (!apiCode) return null;

  const params = {
    DATABASE_ID: IFC_GEM_DATASET,
    INDICATOR: "IFC_GEM_PBR",  // Recovery rates indicator
    METRIC: "ARR",              // Average Recovery Rate
    REF_AREA: apiCode,
    SECTOR: "_T",
    PROJECT_TYPE: "_T",
    TIME_PERIOD: "2024",
  };

  try {
    const response = await fetchData360(params);
    const latest = response.value
      .sort((a, b) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

    return latest ? parseFloat(latest.OBS_VALUE) : null;
  } catch (error) {
    console.error(`Error fetching recovery data for ${region}:`, error);
    return null;
  }
}

// Update getRegionData() to use real recovery rates
const recoveryRate = await getRecoveryRateData(region) ||
                     estimateRecoveryRate(defaultRate); // Fallback
```

**Impact:** Provides accurate, real recovery rates instead of estimates
**Effort:** 2-3 hours
**Files:** route.ts (lines 202-206, new function)

#### 3.1.2 Replace Mock Sector Data with Real API Data

**Problem:** Sector analysis uses hardcoded mockSectorData
**Solution:** Query API with SECTOR dimension

**Implementation:**
```typescript
// Add new function:
async function getSectorData(sector: string, region: string = 'global') {
  const sectorCodes = {
    'Financial Services': 'F',
    'Infrastructure': 'I',
    'Manufacturing': 'M',
    // Map all sectors
  };

  const sectorCode = sectorCodes[sector] || '_T';
  const regionCode = REGION_NAMES[region.toLowerCase()] || '_T';

  const params = {
    DATABASE_ID: IFC_GEM_DATASET,
    INDICATOR: "IFC_GEM_PBD",
    METRIC: "ADR",
    REF_AREA: regionCode,
    SECTOR: sectorCode,
    PROJECT_TYPE: "_T",
    TIME_PERIOD: "2024",
  };

  const response = await fetchData360(params);
  // Process and return sector data
}

// Update get_sector_analysis tool to use real data
```

**Impact:** Accurate sector-specific default rates
**Effort:** 3-4 hours
**Files:** route.ts (lines 89-97, 314-362)

---

### Priority 2: HIGH - New Capabilities (1-2 weeks)

#### 3.2.1 Add Project Type Analysis Tool

**New Tool:** `get_project_type_analysis(projectType?, region?)`

**Features:**
- Query by project type: Corporate Finance, Financial Institution, Project Finance, Other
- Compare default rates across project types
- Regional breakdown by project type

**Example Query:**
```typescript
get_project_type_analysis('Corporate Finance', 'sub-saharan-africa')
// Returns: CF default rate for SSF region (likely higher risk than PF)
```

**Implementation:**
```typescript
server.tool(
  'get_project_type_analysis',
  'Analyze credit risk by project financing type',
  {
    projectType: z.enum(['all', 'corporate-finance', 'financial-institution',
                         'project-finance', 'other']).optional(),
    region: z.enum([...regions]).optional(),
  },
  async ({ projectType, region }) => {
    const projectCodes = {
      'corporate-finance': 'CF',
      'financial-institution': 'FI',
      'project-finance': 'PF',
      'other': 'O',
      'all': '_T',
    };

    // Query API with PROJECT_TYPE dimension
    // Format results as comparison table or specific analysis
  }
);
```

**API Verified Data:**
- Corporate Finance: 5.05% default rate (highest risk)
- Financial Institution: 3.16%
- Project Finance: 1.65% (lowest risk)
- Other: 1.74%

**Impact:** Enables project type risk analysis
**Effort:** 4-6 hours
**Value:** HIGH - Project type is major risk differentiator

#### 3.2.2 Add Time Series Analysis Tool

**New Tool:** `get_historical_trends(metric, region, years?)`

**Features:**
- Historical default rate trends (1994-2024)
- Recovery rate trends over time
- Identify improving/deteriorating regions
- Calculate trend slopes and volatility

**Example Queries:**
```typescript
get_historical_trends('default-rate', 'sub-saharan-africa', 10)
// Returns: Last 10 years of default rates for SSF

get_historical_trends('recovery-rate', 'east-asia')
// Returns: Full historical recovery rates for EAS
```

**Implementation:**
```typescript
server.tool(
  'get_historical_trends',
  'Analyze historical trends in credit risk metrics',
  {
    metric: z.enum(['default-rate', 'recovery-rate', 'loan-volume', 'counterparty-count']),
    region: z.enum([...regions]),
    years: z.number().optional().describe('Number of years to analyze (default: all)'),
  },
  async ({ metric, region, years }) => {
    const params = {
      DATABASE_ID: IFC_GEM_DATASET,
      INDICATOR: metric === 'recovery-rate' ? 'IFC_GEM_PBR' : 'IFC_GEM_PBD',
      METRIC: getMetricCode(metric),
      REF_AREA: REGION_NAMES[region],
      SECTOR: "_T",
      PROJECT_TYPE: "_T",
      // No TIME_PERIOD filter = get all years
    };

    const response = await fetchData360(params);
    const sorted = response.value.sort((a, b) =>
      parseInt(a.TIME_PERIOD) - parseInt(b.TIME_PERIOD)
    );

    if (years) {
      const recent = sorted.slice(-years);
      return formatTrendAnalysis(recent, metric, region);
    }

    return formatTrendAnalysis(sorted, metric, region);
  }
);
```

**Impact:** Historical context for risk assessment
**Effort:** 6-8 hours
**Value:** HIGH - Trends reveal risk direction

#### 3.2.3 Add Default Count Analysis Tool

**New Tool:** `get_default_statistics(region?, projectType?)`

**Features:**
- Actual count of defaults (DT metric)
- Observation counts (OBS metric)
- Calculate default rates from raw counts
- Validate API default rate calculations

**Example:**
```typescript
get_default_statistics('latin-america', 'corporate-finance')
// Returns: Number of defaults, observations, calculated rate vs API rate
```

**Implementation:**
```typescript
server.tool(
  'get_default_statistics',
  'Get detailed default counts and observation statistics',
  {
    region: z.enum([...regions]).optional(),
    projectType: z.enum([...projectTypes]).optional(),
  },
  async ({ region, projectType }) => {
    // Fetch DT (defaults), OBS (observations), ADR (rate) in parallel
    // Compare calculated rate (DT/OBS) with API-provided ADR
    // Return comprehensive statistics
  }
);
```

**Impact:** Transparency into calculation methods
**Effort:** 4-5 hours
**Value:** MEDIUM - Useful for data validation

#### 3.2.4 Add Private Default Rates Tool

**New Tool:** `get_private_default_rates(region?)`

**Features:**
- Query IFC_GEM_PRD (private default rates)
- Compare public vs private default rates
- Understand public/private risk differences

**Note:** API testing showed parse errors for IFC_GEM_PRD - needs investigation

**Implementation Priority:** MEDIUM (pending API investigation)

---

### Priority 3: MEDIUM - Technical Improvements (Ongoing)

#### 3.3.1 Implement Response Caching

**Problem:** Repeated API calls for same data
**Solution:** In-memory cache with TTL

**Implementation:**
```typescript
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // milliseconds
}

const apiCache = new Map<string, CacheEntry>();

function getCacheKey(params: Record<string, string>): string {
  return JSON.stringify(params);
}

async function fetchData360Cached(
  params: Record<string, string>,
  ttlMinutes: number = 60
): Promise<Data360Response> {
  const key = getCacheKey(params);
  const cached = apiCache.get(key);

  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    console.log(`Cache hit: ${key}`);
    return cached.data;
  }

  console.log(`Cache miss: ${key}`);
  const data = await fetchData360(params);

  apiCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMinutes * 60 * 1000,
  });

  return data;
}
```

**Impact:** Reduced API calls, faster responses
**Effort:** 2-3 hours
**Value:** HIGH for production use

#### 3.3.2 Add Pagination Support

**Problem:** API returns max 1000 records
**Solution:** Implement skip-based pagination

**Implementation:**
```typescript
async function fetchData360Paginated(
  params: Record<string, string>,
  maxRecords: number = 5000
): Promise<Data360Response> {
  const allValues = [];
  let skip = 0;
  const limit = 1000;

  while (allValues.length < maxRecords) {
    const paginatedParams = { ...params, skip: skip.toString() };
    const response = await fetchData360(paginatedParams);

    if (response.value.length === 0) break;

    allValues.push(...response.value);

    if (response.value.length < limit) break; // Last page

    skip += limit;
  }

  return {
    count: allValues.length,
    value: allValues,
  };
}
```

**Impact:** Access to complete historical datasets
**Effort:** 2-3 hours
**Value:** MEDIUM - Needed for full time series

#### 3.3.3 Implement Rate Limit Handling

**Problem:** No rate limit awareness
**Solution:** Exponential backoff + retry logic

**Implementation:**
```typescript
async function fetchData360WithRetry(
  params: Record<string, string>,
  maxRetries: number = 3
): Promise<Data360Response> {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchData360(params);
    } catch (error: any) {
      lastError = error;

      // Check if rate limit error (429)
      if (error.message.includes('429')) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.warn(`Rate limit hit, waiting ${waitTime}ms before retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Non-rate-limit error, don't retry
      throw error;
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError}`);
}
```

**Impact:** Resilience to API issues
**Effort:** 2 hours
**Value:** MEDIUM - Production readiness

#### 3.3.4 Add Flexible Time Period Support

**Problem:** Hardcoded TIME_PERIOD="2024"
**Solution:** Add time period parameter to tools

**Implementation:**
```typescript
// Add to tool parameters:
{
  region: z.enum([...]),
  timePeriod: z.string().optional().describe('Year (default: 2024)'),
}

// Use in API calls:
TIME_PERIOD: timePeriod || "2024",
```

**Impact:** Flexibility to query any year
**Effort:** 1-2 hours
**Value:** MEDIUM - Enables historical queries

---

### Priority 4: LOW - Enhanced Features (Future)

#### 3.4.1 Add Dimension Discovery Tool

**New Tool:** `get_available_breakdowns(indicator, region?)`

Uses `/data360/disaggregation` endpoint to show available dimensions.

#### 3.4.2 Add Credit Rating Analysis

Query by CREDIT_RATING dimension to analyze risk by rating.

#### 3.4.3 Add Currency Type Analysis

Query by CURRENCY_TYPE dimension to analyze FX risk impact.

#### 3.4.4 Add Seniority Analysis

Query by SENIORITY dimension for secured vs unsecured lending.

---

## Part 4: Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)
**Goal:** Fix data accuracy issues

- [ ] Replace estimated recovery rates with real IFC_GEM_PBR data (3.1.1)
- [ ] Replace mock sector data with real API queries (3.1.2)
- [ ] Add response caching (3.3.1)
- [ ] Testing and validation

**Deliverables:**
- Accurate recovery rates from API
- Real sector analysis data
- Basic caching layer
- Updated tests

**Effort:** 12-16 hours

### Phase 2: New Capabilities (Weeks 2-3)
**Goal:** Add project type and time series analysis

- [ ] Implement project type analysis tool (3.2.1)
- [ ] Implement time series analysis tool (3.2.2)
- [ ] Add pagination support (3.3.2)
- [ ] Add rate limit handling (3.3.3)
- [ ] Add flexible time period support (3.3.4)

**Deliverables:**
- 2 new MCP tools
- Pagination for large datasets
- Production-ready error handling
- Time period flexibility

**Effort:** 20-25 hours

### Phase 3: Advanced Features (Week 4+)
**Goal:** Default statistics and private rates

- [ ] Implement default count analysis tool (3.2.3)
- [ ] Investigate and implement private default rates (3.2.4)
- [ ] Add dimension discovery tool (3.4.1)
- [ ] Comprehensive documentation

**Deliverables:**
- 2-3 additional tools
- Complete API coverage
- User documentation
- API usage guide

**Effort:** 15-20 hours

---

## Part 5: Testing Strategy

### 5.1 Validation Tests

**Recovery Rate Accuracy:**
```bash
# Test real vs estimated recovery rates
curl "https://data360api.worldbank.org/data360/data?\
DATABASE_ID=IFC_GEM&INDICATOR=IFC_GEM_PBR&METRIC=ARR&\
REF_AREA=SSF&SECTOR=_T&PROJECT_TYPE=_T&TIME_PERIOD=2024"

# Expected: Real percentage value, not estimated
```

**Sector Data Accuracy:**
```bash
# Test Financial sector real data
curl "https://data360api.worldbank.org/data360/data?\
DATABASE_ID=IFC_GEM&INDICATOR=IFC_GEM_PBD&METRIC=ADR&\
REF_AREA=_T&SECTOR=F&PROJECT_TYPE=_T&TIME_PERIOD=2024"

# Expected: 2.79% (verified)
```

**Project Type Data:**
```bash
# Test Corporate Finance project type
curl "https://data360api.worldbank.org/data360/data?\
DATABASE_ID=IFC_GEM&INDICATOR=IFC_GEM_PBD&METRIC=ADR&\
REF_AREA=_T&SECTOR=_T&PROJECT_TYPE=CF&TIME_PERIOD=2024"

# Expected: 5.05% (verified)
```

### 5.2 Integration Tests

**MCP Tool Tests:**
```typescript
// Test recovery rate tool with real data
const response = await get_recovery_rates('sub-saharan-africa');
assert(response.recoveryRate !== 73); // Not estimated
assert(response.recoveryRate > 0 && response.recoveryRate <= 100);
assert(response.dataSource === 'IFC_GEM_PBR'); // Real source

// Test project type tool
const cfResponse = await get_project_type_analysis('corporate-finance');
assert(cfResponse.defaultRate > 4.5); // CF has higher risk
```

### 5.3 Performance Tests

- Cache hit rate monitoring
- API response time tracking
- Pagination performance
- Rate limit testing (intentionally trigger to test backoff)

---

## Part 6: Documentation Needs

### 6.1 User-Facing Documentation

**Update landing page (app/page.tsx):**
- List all new tools
- Explain project types and sectors
- Show example queries for time series
- Document data sources and update frequencies

**Create API guide:**
- Available dimensions and their meanings
- Data freshness and update schedule
- Known limitations
- Best practices for querying

### 6.2 Developer Documentation

**Code comments:**
- Document IFC_GEM indicator meanings
- Explain metric types (ADR, ARR, CP, etc.)
- Document dimension codes
- Add examples to each function

**Architecture docs:**
- Caching strategy and TTLs
- Error handling flow
- Pagination approach
- Rate limit handling

---

## Part 7: Risk Assessment

### 7.1 Implementation Risks

**HIGH RISK:**
1. IFC_GEM_PRD private rates API returns parse errors
   - **Mitigation:** Investigate root cause, may need World Bank support

**MEDIUM RISK:**
2. Recovery rate API (IFC_GEM_PBR) may have data gaps
   - **Mitigation:** Keep estimated fallback, flag data source
3. Sector code mappings not fully documented
   - **Mitigation:** Test all sectors, create comprehensive mapping

**LOW RISK:**
4. Rate limits unknown (not in API spec)
   - **Mitigation:** Conservative backoff, monitoring
5. Cache invalidation complexity
   - **Mitigation:** Short TTLs initially (1 hour)

### 7.2 Breaking Changes

**None expected** - All improvements are additive:
- Existing tools maintain same interface
- New parameters are optional
- Fallback behavior for API failures
- Mock data removal improves accuracy (not breaking)

---

## Part 8: Success Metrics

### 8.1 Accuracy Improvements

- ✅ Recovery rates: Estimated → Real API data
- ✅ Sector data: Mock → Real API data
- ✅ Project type: None → Full breakdown available
- ✅ Time series: None → Historical trends available

### 8.2 Performance Metrics

- Cache hit rate: Target >60% for repeated queries
- API response time: <2s for cached, <5s for fresh
- Error rate: <1% (with retry logic)
- Time to first result: <3s (with caching)

### 8.3 Feature Completeness

**Current State:**
- 5 tools
- 1 indicator (IFC_GEM_PBD)
- 3 metrics (ADR, CP, SA)
- 1 dimension (REF_AREA)
- 0% API capability usage

**Target State (Post-Phase 3):**
- 9-10 tools
- 3+ indicators (PBD, PBR, PRD)
- 8+ metrics (ADR, ARR, CP, SA, DT, OBS, etc.)
- 4+ dimensions (REF_AREA, SECTOR, PROJECT_TYPE, TIME_PERIOD)
- 70%+ API capability usage

---

## Part 9: Cost-Benefit Analysis

### 9.1 Development Cost

**Total Effort Estimate:**
- Phase 1: 12-16 hours
- Phase 2: 20-25 hours
- Phase 3: 15-20 hours
- **Total: 47-61 hours** (6-8 workdays)

### 9.2 Business Value

**HIGH VALUE:**
1. **Data Accuracy** - Real recovery rates vs estimates
   - Impact: Correct risk calculations for users
   - ROI: Critical for financial decisions

2. **Project Type Analysis** - CF vs PF risk differences
   - Impact: 3x risk difference (5.05% vs 1.65%)
   - ROI: Enables project-type-specific risk strategies

**MEDIUM VALUE:**
3. **Time Series Analysis** - Historical trends
   - Impact: Identify improving/declining regions
   - ROI: Forward-looking risk assessment

4. **Real Sector Data** - Replace mock data
   - Impact: Accurate sector risk profiles
   - ROI: Sector allocation decisions

**TECHNICAL VALUE:**
5. **Caching & Error Handling**
   - Impact: Production reliability
   - ROI: Reduced API costs, better UX

### 9.3 Maintenance Burden

**Minimal:**
- World Bank API is stable (public dataset)
- No authentication/keys to manage
- Caching reduces API dependency
- Error handling makes system resilient

**Ongoing:**
- Monitor for API changes (low frequency)
- Update sector/dimension mappings as needed
- Cache tuning based on usage patterns

---

## Part 10: Immediate Next Steps

### For Implementation:

1. **START HERE** - Phase 1, Task 1:
   - File: `gems-risk-mcp/app/api/[transport]/route.ts`
   - Lines: 202-206 (recovery rate estimation)
   - Action: Add `getRecoveryRateData()` function
   - Test: Compare estimated vs real recovery rates

2. **Verify API Access:**
   ```bash
   # Test recovery rate API works
   curl "https://data360api.worldbank.org/data360/data?\
   DATABASE_ID=IFC_GEM&INDICATOR=IFC_GEM_PBR&METRIC=ARR&\
   REF_AREA=_T&SECTOR=_T&PROJECT_TYPE=_T&TIME_PERIOD=2024"
   ```

3. **Create Feature Branch:**
   ```bash
   git checkout -b feature/mcp-improvements
   ```

4. **Track Progress:**
   - Use this document as checklist
   - Update status after each task
   - Test after each major change

### For Review:

1. **Stakeholder Review:**
   - Present project type risk differences (CF=5.05% vs PF=1.65%)
   - Explain estimated vs real recovery rate impact
   - Demonstrate time series value for trend analysis

2. **Technical Review:**
   - Validate caching strategy
   - Review error handling approach
   - Confirm pagination implementation

3. **Prioritization:**
   - Confirm Phase 1-2-3 order
   - Identify any must-have features for earlier phases
   - Agree on success metrics

---

## Appendix A: API Reference Quick Guide

### Indicator Codes
- `IFC_GEM_PBD` = Public default rates (current)
- `IFC_GEM_PBR` = Public recovery rates
- `IFC_GEM_PRD` = Private default rates (current)
- `IFC_GEM_PBD_H` = Public default rates (historical)
- `IFC_GEM_PRD_H` = Private default rates (historical)

### Metric Codes
- `ADR` = Average Default Rate (%)
- `ARR` = Average Recovery Rate (%)
- `CP` = Counterparts (count)
- `DT` = Defaults (count)
- `SA` = Signed Amount (USD millions)
- `OBS` = Observations (count)
- `MEDIAN` = Median value

### Project Type Codes
- `_T` = Total/All
- `CF` = Corporate Finance
- `FI` = Financial Institution
- `PF` = Project Finance
- `O` = Other

### Sector Codes (Verified)
- `_T` = Total/All sectors
- `F` = Financial services
- (Others need mapping)

### Region Codes (Current)
- `_T` = Global
- `SSF` = Sub-Saharan Africa
- `EAS` = East Asia & Pacific
- `ECS` = Europe & Central Asia
- `LCN` = Latin America & Caribbean
- `MEA` = Middle East & North Africa
- `SAS` = South Asia

---

## Appendix B: Example API Calls

### Get Recovery Rate (CRITICAL)
```bash
curl "https://data360api.worldbank.org/data360/data?\
DATABASE_ID=IFC_GEM&\
INDICATOR=IFC_GEM_PBR&\
METRIC=ARR&\
REF_AREA=SSF&\
SECTOR=_T&\
PROJECT_TYPE=_T&\
TIME_PERIOD=2024"
```

### Get Project Type Data
```bash
curl "https://data360api.worldbank.org/data360/data?\
DATABASE_ID=IFC_GEM&\
INDICATOR=IFC_GEM_PBD&\
METRIC=ADR&\
REF_AREA=_T&\
SECTOR=_T&\
PROJECT_TYPE=CF&\
TIME_PERIOD=2024"
```

### Get Time Series (All Years)
```bash
curl "https://data360api.worldbank.org/data360/data?\
DATABASE_ID=IFC_GEM&\
INDICATOR=IFC_GEM_PBD&\
METRIC=ADR&\
REF_AREA=EAS&\
SECTOR=_T&\
PROJECT_TYPE=_T"
# No TIME_PERIOD = returns all years
```

### Get Sector-Specific Data
```bash
curl "https://data360api.worldbank.org/data360/data?\
DATABASE_ID=IFC_GEM&\
INDICATOR=IFC_GEM_PBD&\
METRIC=ADR&\
REF_AREA=_T&\
SECTOR=F&\
PROJECT_TYPE=_T&\
TIME_PERIOD=2024"
```

---

**END OF IMPROVEMENT PLAN**

**Status:** Ready for implementation
**Next Action:** Review and approve Phase 1
**Contact:** Claude Code MCP Development Team
**Last Updated:** 2025-11-05
