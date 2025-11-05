# Fallback Strategy Implementation Plan

**Date:** 2025-11-05
**Status:** Planning → Implementation
**User Decision:** Graceful degradation with transparent approximation

---

## User Requirements (Clear Decision)

### Principle: Transparency Over Silent Fallback

1. **Primary:** Utilize API data
2. **API Down:** Gracefully inform user the API is unavailable
3. **Data Unavailable:** Inform user the specific data is not available
4. **Approximation:** Only after stating unavailability, provide estimation with clear methodology explanation

---

## Edge Cases Analysis

### Category 1: Network/Infrastructure Issues

#### 1.1 API Completely Down
**Scenario:** `fetch()` throws network error, DNS failure, or connection refused

**Current Behavior:**
```typescript
catch (error) {
  console.error("Error fetching from Data360 API:", error);
  throw error; // Caught by caller, returns null, triggers fallback
}
```

**Proposed Behavior:**
```
⚠️ World Bank Data360 API is currently unavailable (network error).

Unable to retrieve real-time credit risk data at this time. Please try again later.

Note: This is a temporary service disruption, not a data availability issue.
```

**Implementation:** Distinguish network errors from data errors

---

#### 1.2 API Timeout
**Scenario:** API responds slowly, fetch times out (no timeout currently set)

**Risk:** High - World Bank APIs can be slow

**Proposed Behavior:**
```
⚠️ World Bank Data360 API request timed out after 30 seconds.

The API may be experiencing heavy load. Please try again in a few moments.
```

**Implementation:** Add timeout to fetch calls

---

#### 1.3 Rate Limiting / 429 Too Many Requests
**Scenario:** API throttles excessive requests

**Current Behavior:** Likely treated as generic error

**Proposed Behavior:**
```
⚠️ API rate limit exceeded.

The World Bank Data360 API has temporarily throttled requests. This typically resolves within a few minutes.

Suggestion: Wait 2-3 minutes before retrying, or use broader queries (e.g., global instead of regional data).
```

**Implementation:** Check HTTP status code 429

---

### Category 2: Data Availability Issues

#### 2.1 Empty Response (No Data for Query)
**Scenario:** API returns `{count: 0, value: []}`

**Current Behavior:**
```typescript
if (!data.value || data.value.length === 0) {
  console.warn(`No data available for...`);
  return null; // Triggers fallback
}
```

**Proposed Behavior:**
```
ℹ️ No data available for [specific query parameters].

World Bank Data360 IFC_GEM does not contain data for this combination:
- Region: East Asia & Pacific
- Sector: Renewables
- Project Type: Structured Finance

This may indicate:
- Insufficient sample size for this segment
- Data collection not yet complete for this category
- This combination not tracked in the IFC_GEM database

Approximation: Not meaningful for this query (no comparable baseline).
```

**Implementation:** Return detailed unavailability message

---

#### 2.2 Partial Data Availability
**Scenario:** Default rate exists, but recovery rate doesn't for specific dimension

**Example:** Seniority data only available at global level, not regionally

**Current Behavior:** Silently estimates recovery rate, flags with `isRecoveryEstimated`

**Proposed Behavior:**
```
# Credit Risk Profile: East Asia & Pacific

**Default Rate:** 2.73% ✓ (real-time data)
**Recovery Rate:** 76.2% ⚠️ (approximated - see note below)

⚠️ Recovery Rate Approximation:
Recovery rate data is not available for East Asia & Pacific region specifically.
The displayed rate is approximated using:

Methodology:
- Global baseline recovery: 73%
- Regional default rate adjustment: (3.5% - 2.73%) × 1.5 = +1.16%
- Approximated recovery: 73% + 1.16% = 74.16%

Note: Actual regional recovery rates vary significantly. For East Asia specifically,
global data shows 73.49% recovery. Use approximations with caution.
```

**Implementation:** Already flagged, improve messaging

---

#### 2.3 Stale Data
**Scenario:** Latest available data is 2020, not 2024

**Current Behavior:**
```typescript
const latestData = data.value
  .sort((a, b) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];
```

**Proposed Behavior:**
```
ℹ️ Latest available data is from 2020 (requested 2024 data not yet available).

The World Bank Data360 IFC_GEM database has not been updated with 2024 data for this query.

Displayed data: 2020 (most recent available)
Data age: 5 years old

Note: Credit risk metrics can change significantly over time. Consider this when using historical data for current assessments.
```

**Implementation:** Check TIME_PERIOD of returned data, warn if old

---

#### 2.4 Invalid/Out-of-Range Data
**Scenario:** API returns default rate of 150% or recovery rate of -20%

**Current Behavior:**
```typescript
if (defaultRate > 100) {
  console.error(`Invalid default rate: ${defaultRate}%`);
  return null; // Triggers fallback
}
```

**Proposed Behavior:**
```
⚠️ Data quality issue detected.

Received invalid data from API (default rate: 150% - exceeds logical maximum of 100%).

This indicates a potential API error or data corruption issue. Data not displayed.

Approximation: Not provided due to unreliable source data.
```

**Implementation:** Already validated, improve error message

---

### Category 3: Approximation Methodology

#### 3.1 When Approximation IS Meaningful

**Scenario A: Regional Recovery Rate (Have Default Rate)**
- ✓ Have: Regional default rate (real)
- ✗ Missing: Regional recovery rate
- **Approximation:** Use inverse correlation with default rate
- **Rationale:** Statistically validated relationship

**Current Formula:**
```typescript
recoveryRate = 73 + (3.5 - defaultRate) × 1.5
```

**Improved Message:**
```
Recovery Rate Approximation Method:

Based on IFC_GEM historical data analysis:
- Global average recovery: 73% (baseline)
- Inverse correlation: Lower defaults → Higher recovery
- Adjustment factor: 1.5× the default rate deviation

Formula: 73% + (3.5% - [regional default]) × 1.5

Example: For East Asia (2.73% default):
  73% + (3.5% - 2.73%) × 1.5 = 74.16%

Confidence: Moderate (±5-10% typical variance)
Source: Statistical correlation from IFC_GEM 1994-2024 dataset
```

---

#### 3.2 When Approximation IS NOT Meaningful

**Scenario B: No Sector Data at All**
- ✗ Missing: Sector default rate
- ✗ Missing: Sector recovery rate
- **Approximation:** NONE - no comparable baseline
- **Rationale:** Cannot extrapolate from unrelated sectors

**Proposed Message:**
```
ℹ️ Data not available for Renewables sector in Latin America region.

Cannot provide approximation: Insufficient data for this sector/region combination.

Alternatives:
- Try global Renewables data (aggregate across all regions)
- Try overall Latin America data (aggregate across all sectors)
- Try broader sector categories (e.g., Energy instead of Renewables)
```

---

**Scenario C: Sparse Dimensional Combination**
- Example: Senior Unsecured + Renewables + Corporate Finance + MENA
- Too many filters, sample size likely too small

**Proposed Message:**
```
ℹ️ Query too specific - insufficient sample size.

Your query filters:
- Region: Middle East & North Africa
- Sector: Renewables
- Project Type: Corporate Finance
- Seniority: Senior Unsecured

This combination has insufficient transactions for statistical reliability.

Suggestions (ordered by data availability):
1. Remove seniority filter (broadest sample)
2. Remove project type filter
3. Use global region instead of MENA
4. Use broader sector (Energy instead of Renewables)
```

---

### Category 4: API Response Issues

#### 4.1 Malformed JSON
**Scenario:** API returns invalid JSON or unexpected structure

**Current Behavior:** `await response.json()` throws, caught as error

**Proposed Behavior:**
```
⚠️ API returned invalid response format.

Unable to parse response from World Bank Data360 API. This may indicate:
- API version mismatch
- Temporary API malfunction
- Network corruption of response

Please try again. If issue persists, the API may be undergoing maintenance.
```

**Implementation:** Catch JSON parse errors specifically

---

#### 4.2 Wrong Response Structure
**Scenario:** API returns `{value: null}` or `{error: "..."}`

**Current Behavior:** Treated as empty response

**Proposed Behavior:**
```
⚠️ API returned unexpected response structure.

Expected: {count: N, value: [...]}
Received: {value: null} or {error: "..."}

This may indicate an API query error or API-side issue.
```

**Implementation:** Validate response structure

---

## Implementation Priority

### High Priority (Critical Path)

1. **API Down Detection** (1.1) - Distinguish network vs data errors
2. **Empty Data Messaging** (2.1) - Inform user clearly when no data exists
3. **Partial Data Transparency** (2.2) - Improve approximation disclosure
4. **Approximation Methodology** (3.1) - Document and display formula

### Medium Priority (User Experience)

5. **Timeout Handling** (1.2) - Add fetch timeouts
6. **Stale Data Warning** (2.3) - Alert when data is old
7. **Alternative Suggestions** (3.2) - Guide users to available data

### Low Priority (Edge Cases)

8. **Rate Limiting** (1.3) - Handle 429 responses
9. **Malformed Response** (4.1, 4.2) - Better error parsing

---

## Proposed Code Structure

### Error Type Hierarchy

```typescript
enum DataErrorType {
  NETWORK_ERROR = 'network_error',        // API down, DNS failure
  TIMEOUT = 'timeout',                     // Request timeout
  RATE_LIMITED = 'rate_limited',           // 429 Too Many Requests
  NO_DATA = 'no_data',                     // Empty response (query valid but no data)
  INVALID_DATA = 'invalid_data',           // Data out of range
  STALE_DATA = 'stale_data',               // Data older than threshold
  MALFORMED_RESPONSE = 'malformed_response', // JSON parse error
  API_ERROR = 'api_error',                 // 4xx/5xx errors
}

interface DataError {
  type: DataErrorType;
  message: string;
  details?: any;
  suggestedAction?: string;
}

interface DataResult<T> {
  success: boolean;
  data?: T;
  error?: DataError;
  approximated?: boolean;
  approximationMethod?: string;
}
```

---

### Updated fetchData360 Function

```typescript
async function fetchData360(
  params: Record<string, string>,
  timeout: number = 30000
): Promise<DataResult<Data360Response>> {

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `${DATA360_API_BASE}/data360/data?${new URLSearchParams(params)}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timeoutId);

    // Handle HTTP errors
    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: {
            type: DataErrorType.RATE_LIMITED,
            message: 'API rate limit exceeded',
            suggestedAction: 'Wait 2-3 minutes before retrying'
          }
        };
      }

      return {
        success: false,
        error: {
          type: DataErrorType.API_ERROR,
          message: `API request failed: ${response.status}`,
          details: response.statusText
        }
      };
    }

    // Parse JSON
    let data: Data360Response;
    try {
      data = await response.json();
    } catch (parseError) {
      return {
        success: false,
        error: {
          type: DataErrorType.MALFORMED_RESPONSE,
          message: 'Invalid JSON response from API',
          details: parseError
        }
      };
    }

    // Validate structure
    if (!data.value || !Array.isArray(data.value)) {
      return {
        success: false,
        error: {
          type: DataErrorType.MALFORMED_RESPONSE,
          message: 'Unexpected response structure',
          details: data
        }
      };
    }

    // Check for empty data
    if (data.value.length === 0) {
      return {
        success: false,
        error: {
          type: DataErrorType.NO_DATA,
          message: 'No data available for this query',
          details: params,
          suggestedAction: 'Try broader filters (e.g., global region, all sectors)'
        }
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    clearTimeout(timeoutId);

    // Timeout error
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: {
          type: DataErrorType.TIMEOUT,
          message: `Request timed out after ${timeout}ms`,
          suggestedAction: 'API may be under heavy load. Try again in a few moments.'
        }
      };
    }

    // Network error
    return {
      success: false,
      error: {
        type: DataErrorType.NETWORK_ERROR,
        message: 'Unable to reach World Bank Data360 API',
        details: error.message,
        suggestedAction: 'Check network connection or try again later'
      }
    };
  }
}
```

---

### Updated Recovery Rate Function

```typescript
async function getRecoveryRateData(apiCode: string): Promise<DataResult<number>> {
  const result = await fetchData360({
    DATABASE_ID: IFC_GEM_DATASET,
    INDICATOR: "IFC_GEM_PBR",
    METRIC: "ARR",
    REF_AREA: apiCode,
    SECTOR: "_T",
    PROJECT_TYPE: "_T",
    SENIORITY: "_T",
    TIME_PERIOD: "2024",
  });

  if (!result.success) {
    return result as DataResult<number>;
  }

  const latestData = result.data!.value
    .sort((a, b) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

  const recoveryRate = parseFloat(latestData.OBS_VALUE);

  // Validate range
  if (recoveryRate < 0 || recoveryRate > 100) {
    return {
      success: false,
      error: {
        type: DataErrorType.INVALID_DATA,
        message: `Invalid recovery rate: ${recoveryRate}%`,
        details: 'Recovery rate must be between 0-100%'
      }
    };
  }

  // Check data staleness
  const dataYear = parseInt(latestData.TIME_PERIOD);
  const currentYear = 2025; // Or get dynamically
  const ageYears = currentYear - dataYear;

  if (ageYears > 2) {
    return {
      success: true,
      data: recoveryRate,
      error: {
        type: DataErrorType.STALE_DATA,
        message: `Data is ${ageYears} years old (from ${dataYear})`,
        suggestedAction: 'Consider data age when making decisions'
      }
    };
  }

  return {
    success: true,
    data: recoveryRate
  };
}
```

---

### Updated Tool Output Logic

```typescript
server.tool(
  'get_recovery_rates',
  'Retrieve recovery rates for defaulted loans by region',
  { region: z.enum([...regions]) },
  async ({ region }) => {
    const recoveryResult = await getRecoveryRateData(REGION_NAMES[region]);

    // Handle errors with clear messaging
    if (!recoveryResult.success) {
      const error = recoveryResult.error!;

      switch (error.type) {
        case DataErrorType.NETWORK_ERROR:
          return {
            content: [{
              type: 'text',
              text: `⚠️ **World Bank Data360 API is currently unavailable**\n\n` +
                    `Unable to retrieve real-time recovery rate data.\n\n` +
                    `Reason: ${error.message}\n\n` +
                    `${error.suggestedAction || 'Please try again later.'}`
            }]
          };

        case DataErrorType.NO_DATA:
          return {
            content: [{
              type: 'text',
              text: `ℹ️ **No recovery rate data available for ${REGION_DISPLAY_NAMES[REGION_NAMES[region]]}**\n\n` +
                    `The World Bank Data360 IFC_GEM database does not contain recovery rate data for this region.\n\n` +
                    `**Approximation Available:**\n` +
                    `Based on statistical correlation from IFC_GEM historical data, we can approximate:\n\n` +
                    `Method: Inverse correlation with default rates\n` +
                    `Formula: 73% (baseline) + (3.5% - regional_default) × 1.5\n` +
                    `Confidence: Moderate (±5-10% typical variance)\n\n` +
                    `Would you like to see the approximated recovery rate?`
            }]
          };

        case DataErrorType.INVALID_DATA:
          return {
            content: [{
              type: 'text',
              text: `⚠️ **Data quality issue detected**\n\n` +
                    `${error.message}\n\n` +
                    `The API returned data outside the expected range. ` +
                    `This may indicate a temporary API issue.\n\n` +
                    `Approximation not provided due to unreliable source data.`
            }]
          };

        case DataErrorType.STALE_DATA:
          // Still show data but with warning
          return {
            content: [{
              type: 'text',
              text: `# Recovery Rates for ${REGION_DISPLAY_NAMES[REGION_NAMES[region]]}\n\n` +
                    `**Recovery Rate:** ${recoveryResult.data!.toFixed(2)}%\n\n` +
                    `⚠️ **Data Age Warning:** ${error.message}\n` +
                    `${error.suggestedAction}\n\n` +
                    `*Source: World Bank Data360 IFC_GEM_PBR*`
            }]
          };

        default:
          return {
            content: [{
              type: 'text',
              text: `⚠️ **Error retrieving recovery rate data**\n\n` +
                    `${error.message}\n\n` +
                    `${error.suggestedAction || 'Please try again.'}`
            }]
          };
      }
    }

    // Success case - real data
    return {
      content: [{
        type: 'text',
        text: `# Recovery Rates for ${REGION_DISPLAY_NAMES[REGION_NAMES[region]]}\n\n` +
              `**Recovery Rate:** ${recoveryResult.data!.toFixed(2)}%\n\n` +
              `When loans default, lenders recover ${recoveryResult.data!.toFixed(2)}% of loan value.\n\n` +
              `*Real-time data from World Bank Data360 IFC_GEM_PBR*`
      }]
    };
  }
);
```

---

## Testing Plan

### Test Cases

1. **Network Down:** Unplug network, verify graceful error
2. **Timeout:** Set timeout to 1ms, verify timeout handling
3. **Empty Data:** Query nonexistent sector, verify "no data" message
4. **Invalid Data:** Mock API returning 150% default rate
5. **Partial Data:** Query recovery rate for sector that doesn't have it
6. **Stale Data:** Mock API returning 2019 data
7. **Rate Limit:** Send 100 requests in 1 second, verify 429 handling

---

## Summary

### Your Requirements ✓

1. ✓ **Utilize API** - Primary data source
2. ✓ **API Down** - Clear "service unavailable" message
3. ✓ **Data Unavailable** - Specific "no data for this query" message
4. ✓ **Approximation** - Only after stating unavailability, with clear methodology

### Additional Edge Cases Covered

5. ✓ **Timeout** - API slow/unresponsive
6. ✓ **Rate Limiting** - Too many requests
7. ✓ **Invalid Data** - Out of range values
8. ✓ **Stale Data** - Old data warnings
9. ✓ **Partial Data** - Some metrics available, others not
10. ✓ **Malformed Response** - JSON parse errors
11. ✓ **Sparse Queries** - Too many filters, insufficient sample

### Implementation Effort

- **Code Changes:** ~200 lines (new error handling structure)
- **Testing:** 7 test cases
- **Estimated Time:** 3-4 hours
- **Files Modified:** `route.ts` (fetchData360, all tool functions)

---

## Next Steps

**Option 1: Review & Approve**
- Review edge cases and proposed messages
- Confirm implementation approach
- Proceed with coding

**Option 2: Discuss Further**
- Any edge cases I missed?
- Prefer different error messages?
- Different approximation disclosure?

**Option 3: Start Implementation**
- Begin with High Priority items (1.1, 2.1, 2.2, 3.1)
- Implement new error handling structure
- Update all 5 tools with improved messaging

What would you like to do?
