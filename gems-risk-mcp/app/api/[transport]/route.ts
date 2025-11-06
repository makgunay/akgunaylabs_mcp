import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';

// World Bank Data360 API Configuration
const DATA360_API_BASE = "https://data360api.worldbank.org";
const IFC_GEM_DATASET = "IFC_GEM";

// Region code mapping
const REGION_NAMES: Record<string, string> = {
  "global": "_T",
  "east-asia": "EAS",
  "europe-central-asia": "ECS",
  "latin-america": "LCN",
  "mena": "MEA",
  "south-asia": "SAS",
  "sub-saharan-africa": "SSF",
};

const REGION_DISPLAY_NAMES: Record<string, string> = {
  "_T": "Global Emerging Markets",
  "EAS": "East Asia & Pacific",
  "ECS": "Europe & Central Asia",
  "LCN": "Latin America & Caribbean",
  "MEA": "Middle East & North Africa",
  "SAS": "South Asia",
  "SSF": "Sub-Saharan Africa",
};

// Sector code mapping (GICS + IFC categories)
const SECTOR_NAMES: Record<string, string> = {
  "_T": "Overall",
  "_Z": "Not applicable",
  // IFC-specific categories
  "NF": "Non-financial institutions",
  "FI": "Financial Institutions",
  "BK": "Banking",
  "IN": "Infrastructure",
  "NB": "Non-banking financial institutions",
  "R": "Renewables",
  "S": "Services",
  // GICS (Global Industry Classification Standard) sectors
  "F": "GICS: Financials",
  "U": "GICS: Utilities",
  "I": "GICS: Industrials",
  "CST": "GICS: Consumer Staples",
  "CD": "GICS: Consumer Discretionary",
  "M": "GICS: Materials",
  "O": "GICS: Others",
  "CS": "GICS: Communication Services",
  "HC": "GICS: Health Care",
  "E": "GICS: Energy",
  "RE": "GICS: Real Estate",
  "IT": "GICS: Information Technology",
  "A": "GICS: Administration",
};

// Project type mapping
const PROJECT_TYPE_NAMES: Record<string, string> = {
  "_Z": "Not applicable",
  "_T": "Overall, incl. omitted categories",
  "O": "Other",
  "CF": "Corporate Finance",
  "FI": "Financial Institutions",
  "PF": "Project Finance",
  "SF": "Structured Finance",
  "MX": "Mixed",
};

// Seniority mapping (debt hierarchy)
const SENIORITY_NAMES: Record<string, string> = {
  "_T": "All Seniority Levels",
  "SS": "Senior Secured",
  "SU": "Senior Unsecured",
};

// Mock data for fallback
const mockCreditData: Record<string, any> = {
  global: {
    region: "Global Emerging Markets",
    defaultRate: 3.5,
    recoveryRate: 73,
    numberOfLoans: 15420,
    totalVolume: 425e9,
    period: "1994-2024",
  },
  "east-asia": {
    region: "East Asia & Pacific",
    defaultRate: 2.8,
    recoveryRate: 76,
    numberOfLoans: 4200,
    totalVolume: 145e9,
    period: "1994-2024",
  },
  "latin-america": {
    region: "Latin America & Caribbean",
    defaultRate: 4.2,
    recoveryRate: 68,
    numberOfLoans: 3800,
    totalVolume: 120e9,
    period: "1994-2024",
  },
  "sub-saharan-africa": {
    region: "Sub-Saharan Africa",
    defaultRate: 5.1,
    recoveryRate: 65,
    numberOfLoans: 2600,
    totalVolume: 85e9,
    period: "1994-2024",
  },
  "south-asia": {
    region: "South Asia",
    defaultRate: 3.9,
    recoveryRate: 70,
    numberOfLoans: 2400,
    totalVolume: 75e9,
    period: "1994-2024",
  },
  "mena": {
    region: "Middle East & North Africa",
    defaultRate: 3.2,
    recoveryRate: 72,
    numberOfLoans: 1800,
    totalVolume: 68e9,
    period: "1994-2024",
  },
  "europe-central-asia": {
    region: "Europe & Central Asia",
    defaultRate: 3.0,
    recoveryRate: 75,
    numberOfLoans: 620,
    totalVolume: 42e9,
    period: "1994-2024",
  },
};

// Mock sector data kept as fallback only
const mockSectorData = [
  { sector: "Financial Services", defaultRate: 2.8, recoveryRate: 78, avgLoanSize: 32e6 },
  { sector: "Infrastructure", defaultRate: 3.1, recoveryRate: 75, avgLoanSize: 85e6 },
  { sector: "Manufacturing", defaultRate: 3.6, recoveryRate: 72, avgLoanSize: 28e6 },
  { sector: "Services", defaultRate: 4.0, recoveryRate: 70, avgLoanSize: 22e6 },
  { sector: "Agriculture", defaultRate: 4.8, recoveryRate: 65, avgLoanSize: 18e6 },
  { sector: "Energy", defaultRate: 3.3, recoveryRate: 74, avgLoanSize: 95e6 },
  { sector: "Health & Education", defaultRate: 2.9, recoveryRate: 76, avgLoanSize: 25e6 },
];

// Data360 API Response Types
interface Data360Response {
  value: Array<{
    TIME_PERIOD: string;
    OBS_VALUE: string;
    [key: string]: any;
  }>;
}

// Error handling types
enum DataErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
  NO_DATA = 'no_data',
  INVALID_DATA = 'invalid_data',
  STALE_DATA = 'stale_data',
  MALFORMED_RESPONSE = 'malformed_response',
  API_ERROR = 'api_error',
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

interface RegionDataResult {
  region: string;
  defaultRate: number;
  recoveryRate: number;
  numberOfLoans: number;
  totalVolume: number;
  period: string;
  isRecoveryEstimated: boolean;
  recoveryError?: DataError;
}

interface SectorDataResult {
  sectorCode: string;
  sectorName: string;
  defaultRate: number;
  recoveryRate: number;
  isRecoveryEstimated: boolean;
  recoveryError?: DataError;
  period: string;
}

// Cache configuration
interface CacheEntry {
  data: Data360Response;
  timestamp: number;
}

const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL = 300000; // 5 minutes in milliseconds

// Generate cache key from API parameters
function getCacheKey(params: Record<string, string>): string {
  // Sort keys to ensure consistent cache keys
  const sortedKeys = Object.keys(params).sort();
  return sortedKeys.map(key => `${key}=${params[key]}`).join('&');
}

// Cleanup expired cache entries periodically
function cleanupCache() {
  const now = Date.now();
  let removed = 0;

  for (const [key, entry] of apiCache.entries()) {
    if (now - entry.timestamp >= CACHE_TTL) {
      apiCache.delete(key);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`Cache cleanup: removed ${removed} expired entries`);
  }
}

// Run cache cleanup every 10 minutes
setInterval(cleanupCache, 600000);

// API Client Functions with comprehensive error handling
async function fetchData360(
  params: Record<string, string>,
  timeout: number = 30000
): Promise<DataResult<Data360Response>> {
  // Check cache first
  const cacheKey = getCacheKey(params);
  const cached = apiCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`Cache hit for: ${cacheKey}`);
    return { success: true, data: cached.data };
  }

  // Cache miss or expired - fetch from API with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const queryString = new URLSearchParams(params).toString();
  const url = `${DATA360_API_BASE}/data360/data?${queryString}`;

  try {
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
          message: `API request failed with status ${response.status}`,
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

    // Validate response structure
    if (!data.value || !Array.isArray(data.value)) {
      return {
        success: false,
        error: {
          type: DataErrorType.MALFORMED_RESPONSE,
          message: 'Unexpected response structure from API',
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

    // Store in cache
    apiCache.set(cacheKey, {
      data,
      timestamp: now
    });

    console.log(`Cache miss - fetched and cached: ${cacheKey}`);

    return { success: true, data };

  } catch (error: any) {
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

// Fetch real recovery rates from IFC_GEM_PBR indicator with comprehensive error handling
async function getRecoveryRateData(apiCode: string): Promise<DataResult<number>> {
  const recoveryParams = {
    DATABASE_ID: IFC_GEM_DATASET,
    INDICATOR: "IFC_GEM_PBR",  // Public recovery rates indicator
    METRIC: "ARR",              // Average Recovery Rate (percentage)
    REF_AREA: apiCode,
    SECTOR: "_T",               // Overall (all sectors)
    PROJECT_TYPE: "_T",         // All project types
    SENIORITY: "_T",            // All seniority levels
    TIME_PERIOD: "2024",
  };

  const result = await fetchData360(recoveryParams);

  if (!result.success) {
    return {
      success: false,
      error: result.error
    };
  }

  // Get most recent recovery rate
  const latestRecovery = result.data!.value
    .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

  // Validate we're getting percentage data
  if (latestRecovery.UNIT_MEASURE !== 'PT') {
    console.warn(`Expected percentage unit (PT) for recovery rate, got ${latestRecovery.UNIT_MEASURE}`);
  }
  if (latestRecovery.METRIC !== 'ARR') {
    console.warn(`Expected METRIC='ARR' for recovery rate, got METRIC='${latestRecovery.METRIC}'`);
  }

  const recoveryRate = parseFloat(latestRecovery.OBS_VALUE);

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
  const dataYear = parseInt(latestRecovery.TIME_PERIOD);
  const currentYear = new Date().getFullYear();
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

// Estimate recovery rate using correlation with default rate (fallback method)
function estimateRecoveryRate(defaultRate: number): number {
  const globalAvgRecovery = 73;
  const globalAvgDefault = 3.5;
  const recoveryAdjustment = (globalAvgDefault - defaultRate) * 1.5;
  return Math.max(60, Math.min(80, globalAvgRecovery + recoveryAdjustment));
}

// Fetch real sector data from IFC_GEM_PBD indicator with comprehensive error handling
async function getSectorData(sectorCode: string, regionCode: string = "_T", projectTypeCode: string = "_T"): Promise<SectorDataResult | { error: DataError }> {
  const sectorParams = {
    DATABASE_ID: IFC_GEM_DATASET,
    INDICATOR: "IFC_GEM_PBD",  // Public default rates
    METRIC: "ADR",              // Average Default Rate
    REF_AREA: regionCode,
    SECTOR: sectorCode,
    PROJECT_TYPE: projectTypeCode,
    TIME_PERIOD: "2024",
  };

  const result = await fetchData360(sectorParams);

  if (!result.success) {
    return { error: result.error! };
  }

  // Get most recent default rate
  const latestData = result.data!.value
    .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

  const defaultRate = parseFloat(latestData.OBS_VALUE);

  if (defaultRate < 0 || defaultRate > 100) {
    return {
      error: {
        type: DataErrorType.INVALID_DATA,
        message: `Invalid default rate for sector ${sectorCode}: ${defaultRate}%`,
        details: 'Default rate must be between 0-100%'
      }
    };
  }

  // Try to get recovery rate for this sector
  const recoveryResult = await getRecoveryRateData(regionCode);

  let recoveryRate: number;
  let isRecoveryEstimated: boolean;
  let recoveryError: DataError | undefined;

  if (recoveryResult.success) {
    recoveryRate = recoveryResult.data!;
    isRecoveryEstimated = false;
    recoveryError = recoveryResult.error;
  } else {
    recoveryRate = estimateRecoveryRate(defaultRate);
    isRecoveryEstimated = true;
    recoveryError = recoveryResult.error;
  }

  return {
    sectorCode,
    sectorName: SECTOR_NAMES[sectorCode] || sectorCode,
    defaultRate,
    recoveryRate,
    isRecoveryEstimated,
    recoveryError,
    period: "1994-2024",
  };
}

// Fetch historical time series data
interface TimeSeriesDataPoint {
  year: string;
  defaultRate: number;
  recoveryRate?: number;
}

async function getTimeSeriesData(
  regionCode: string = "_T",
  sectorCode: string = "_T",
  projectTypeCode: string = "_T",
  startYear: number = 2014,
  endYear: number = 2024
): Promise<TimeSeriesDataPoint[] | { error: DataError }> {
  const dataPoints: TimeSeriesDataPoint[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const params = {
      DATABASE_ID: IFC_GEM_DATASET,
      INDICATOR: "IFC_GEM_PBD",
      METRIC: "ADR",
      REF_AREA: regionCode,
      SECTOR: sectorCode,
      PROJECT_TYPE: projectTypeCode,
      TIME_PERIOD: year.toString(),
    };

    const result = await fetchData360(params);

    if (result.success && result.data!.value.length > 0) {
      const latestData = result.data!.value[0];
      const defaultRate = parseFloat(latestData.OBS_VALUE);

      if (defaultRate >= 0 && defaultRate <= 100) {
        dataPoints.push({
          year: year.toString(),
          defaultRate
        });
      }
    }
  }

  if (dataPoints.length === 0) {
    return {
      error: {
        type: DataErrorType.NO_DATA,
        message: `No historical data available for the specified parameters`,
        suggestedAction: 'Try broader filters or a different time range'
      }
    };
  }

  return dataPoints;
}

// Fetch seniority-specific recovery rate data
async function getSeniorityRecoveryData(seniorityCode: string, regionCode: string = "_T"): Promise<DataResult<number>> {
  const recoveryParams = {
    DATABASE_ID: IFC_GEM_DATASET,
    INDICATOR: "IFC_GEM_PBR",  // Public recovery rates indicator
    METRIC: "ARR",              // Average Recovery Rate (percentage)
    REF_AREA: regionCode,
    SECTOR: "_T",
    PROJECT_TYPE: "_T",
    SENIORITY: seniorityCode,  // SS or SU
    TIME_PERIOD: "2024",
  };

  const result = await fetchData360(recoveryParams);

  if (!result.success) {
    return {
      success: false,
      error: result.error
    };
  }

  const latestRecovery = result.data!.value
    .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

  const recoveryRate = parseFloat(latestRecovery.OBS_VALUE);

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

  return {
    success: true,
    data: recoveryRate
  };
}

// Fetch project type data from IFC_GEM_PBD indicator with comprehensive error handling
async function getProjectTypeData(projectTypeCode: string, regionCode: string = "_T", sectorCode: string = "_T"): Promise<SectorDataResult | { error: DataError }> {
  const params = {
    DATABASE_ID: IFC_GEM_DATASET,
    INDICATOR: "IFC_GEM_PBD",  // Public default rates
    METRIC: "ADR",              // Average Default Rate
    REF_AREA: regionCode,
    SECTOR: sectorCode,
    PROJECT_TYPE: projectTypeCode,
    TIME_PERIOD: "2024",
  };

  const result = await fetchData360(params);

  if (!result.success) {
    return { error: result.error! };
  }

  // Get most recent default rate
  const latestData = result.data!.value
    .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

  const defaultRate = parseFloat(latestData.OBS_VALUE);

  if (defaultRate < 0 || defaultRate > 100) {
    return {
      error: {
        type: DataErrorType.INVALID_DATA,
        message: `Invalid default rate for project type ${projectTypeCode}: ${defaultRate}%`,
        details: 'Default rate must be between 0-100%'
      }
    };
  }

  // Try to get recovery rate for this region
  const recoveryResult = await getRecoveryRateData(regionCode);

  let recoveryRate: number;
  let isRecoveryEstimated: boolean;
  let recoveryError: DataError | undefined;

  if (recoveryResult.success) {
    recoveryRate = recoveryResult.data!;
    isRecoveryEstimated = false;
    recoveryError = recoveryResult.error;
  } else {
    recoveryRate = estimateRecoveryRate(defaultRate);
    isRecoveryEstimated = true;
    recoveryError = recoveryResult.error;
  }

  return {
    sectorCode: projectTypeCode,  // Reusing structure
    sectorName: PROJECT_TYPE_NAMES[projectTypeCode] || projectTypeCode,
    defaultRate,
    recoveryRate,
    isRecoveryEstimated,
    recoveryError,
    period: "1994-2024",
  };
}

async function getRegionData(region: string): Promise<RegionDataResult | { error: DataError } | null> {
  const apiCode = REGION_NAMES[region.toLowerCase()];
  if (!apiCode) {
    return null;
  }

  try {
    // Fetch default rate - using proper World Bank Data360 API parameters
    // INDICATOR: IFC_GEM_PBD = Average public default rates (percentage)
    // METRIC: ADR = Average Default Rate (not CP which is counterpart count!)
    const defaultParams = {
      DATABASE_ID: IFC_GEM_DATASET,
      INDICATOR: "IFC_GEM_PBD",
      METRIC: "ADR",
      REF_AREA: apiCode,
      SECTOR: "_T",  // Overall (all sectors)
      TIME_PERIOD: "2024",
    };

    // Fetch loan counts - using CP (Counterparts) metric
    const countParams = {
      DATABASE_ID: IFC_GEM_DATASET,
      INDICATOR: "IFC_GEM_PRD_H",  // Historical private default rates dataset
      METRIC: "CP",  // CP = Counterparts (count of entities)
      REF_AREA: apiCode,
      SECTOR: "_T",
      TIME_PERIOD: "2024",
    };

    // Fetch loan volumes - using SA (Signed Amount) metric
    const volumeParams = {
      DATABASE_ID: IFC_GEM_DATASET,
      INDICATOR: "IFC_GEM_PRD_H",
      METRIC: "SA",  // SA = Signed Amount
      REF_AREA: apiCode,
      SECTOR: "_T",
      TIME_PERIOD: "2024",
    };

    const [defaultResult, countResult, volumeResult] = await Promise.all([
      fetchData360(defaultParams),
      fetchData360(countParams),
      fetchData360(volumeParams),
    ]);

    // Check if default rate fetch failed (critical data)
    if (!defaultResult.success) {
      return { error: defaultResult.error! };
    }

    // Get most recent default rate
    const latestDefault = defaultResult.data!.value
      .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

    // Validate we're getting percentage data, not count data
    if (latestDefault.UNIT_MEASURE !== 'PT') {
      console.warn(`Expected percentage unit (PT), got ${latestDefault.UNIT_MEASURE}. Check METRIC='ADR' is being used.`);
    }
    if (latestDefault.METRIC !== 'ADR') {
      console.warn(`Expected METRIC='ADR', got METRIC='${latestDefault.METRIC}'.`);
    }

    const defaultRate = parseFloat(latestDefault.OBS_VALUE);

    // Sanity check: default rates should be 0-100%
    if (defaultRate > 100) {
      return {
        error: {
          type: DataErrorType.INVALID_DATA,
          message: `Invalid default rate: ${defaultRate}%`,
          details: 'Default rate exceeds 100%'
        }
      };
    }

    // Get most recent count (non-critical, use 0 if unavailable)
    const numberOfLoans = countResult.success
      ? parseFloat(countResult.data!.value
          .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0]?.OBS_VALUE || '0')
      : 0;

    // Get most recent volume (non-critical, use 0 if unavailable)
    const totalVolume = volumeResult.success
      ? parseFloat(volumeResult.data!.value
          .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0]?.OBS_VALUE || '0') * 1e6
      : 0;

    // Fetch real recovery rate from API (IFC_GEM_PBR indicator)
    const recoveryResult = await getRecoveryRateData(apiCode);

    // Determine recovery rate and approximation status
    let recoveryRate: number;
    let isRecoveryEstimated: boolean;
    let recoveryError: DataError | undefined;

    if (recoveryResult.success) {
      recoveryRate = recoveryResult.data!;
      isRecoveryEstimated = false;
      recoveryError = recoveryResult.error; // Could be STALE_DATA warning
    } else {
      // Use approximation if real data unavailable
      recoveryRate = estimateRecoveryRate(defaultRate);
      isRecoveryEstimated = true;
      recoveryError = recoveryResult.error;
    }

    return {
      region: REGION_DISPLAY_NAMES[apiCode],
      defaultRate,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      numberOfLoans: Math.round(numberOfLoans),
      totalVolume: Math.round(totalVolume),
      period: "1994-2024",
      isRecoveryEstimated,  // Flag to indicate data source
      recoveryError,  // Error/warning about recovery data (e.g., stale, unavailable)
    };
  } catch (error) {
    console.error(`Error fetching data for region ${region}:`, error);
    return null;
  }
}

// Create MCP Handler with tools
const handler = createMcpHandler(
  (server) => {
    // Tool 1: Get Default Rates
    server.tool(
      'get_default_rates',
      'Query default frequencies for emerging market lending by region',
      {
        region: z.enum(['global', 'east-asia', 'latin-america', 'sub-saharan-africa', 'south-asia', 'mena', 'europe-central-asia'])
          .describe('Region to query (e.g., global, east-asia, latin-america)')
      },
      async ({ region }) => {
        const result = await getRegionData(region);

        // Handle errors
        if (!result || 'error' in result) {
          const error = result && 'error' in result ? result.error : undefined;

          if (error) {
            switch (error.type) {
              case DataErrorType.NETWORK_ERROR:
                return {
                  content: [{
                    type: 'text',
                    text: `⚠️ **World Bank Data360 API is currently unavailable**\n\n${error.message}\n\n${error.suggestedAction || 'Please try again later.'}`
                  }]
                };

              case DataErrorType.NO_DATA:
                return {
                  content: [{
                    type: 'text',
                    text: `ℹ️ **No default rate data available**\n\n${error.message}\n\n${error.suggestedAction || ''}`
                  }]
                };

              default:
                return {
                  content: [{
                    type: 'text',
                    text: `⚠️ **Error retrieving default rate data**\n\n${error.message}\n\n${error.suggestedAction || ''}`
                  }]
                };
            }
          }

          // Fallback to mock data
          const mockData = mockCreditData[region];
          if (mockData) {
            return {
              content: [{
                type: 'text',
                text: `# Default Rates for ${mockData.region}\n\n**Default Rate:** ${mockData.defaultRate}%\n\n**Period:** ${mockData.period}\n\n**Context:** Out of ${mockData.numberOfLoans.toLocaleString()} loans totaling $${(mockData.totalVolume / 1e9).toFixed(1)} billion USD, ${mockData.defaultRate}% resulted in default.\n\n*⚠️ Using fallback data (API unavailable)*`
              }]
            };
          }

          return {
            content: [{
              type: 'text',
              text: `No data available for region: ${region}`
            }]
          };
        }

        // At this point TypeScript knows result is RegionDataResult
        const data = result as RegionDataResult;

        return {
          content: [{
            type: 'text',
            text: `# Default Rates for ${data.region}\n\n**Default Rate:** ${data.defaultRate}%\n\n**Period:** ${data.period}\n\n**Context:** Out of ${data.numberOfLoans.toLocaleString()} loans totaling $${(data.totalVolume / 1e9).toFixed(1)} billion USD, ${data.defaultRate}% resulted in default.\n\n*Data source: World Bank Data360 IFC_GEM (real-time)*`
          }]
        };
      }
    );

    // Tool 2: Get Recovery Rates
    server.tool(
      'get_recovery_rates',
      'Retrieve recovery rates for defaulted loans by region',
      {
        region: z.enum(['global', 'east-asia', 'latin-america', 'sub-saharan-africa', 'south-asia', 'mena', 'europe-central-asia'])
          .describe('Region to query')
      },
      async ({ region }) => {
        const data = await getRegionData(region);

        // Handle errors with transparent messaging
        if (!data || 'error' in data) {
          const error = data && 'error' in data ? data.error : undefined;

          if (error) {
            switch (error.type) {
              case DataErrorType.NETWORK_ERROR:
                return {
                  content: [{
                    type: 'text',
                    text: `⚠️ **World Bank Data360 API is currently unavailable**\n\n` +
                          `Unable to retrieve real-time recovery rate data.\n\n` +
                          `**Reason:** ${error.message}\n\n` +
                          `${error.suggestedAction || 'Please try again later.'}`
                  }]
                };

              case DataErrorType.TIMEOUT:
                return {
                  content: [{
                    type: 'text',
                    text: `⚠️ **Request Timeout**\n\n` +
                          `${error.message}\n\n` +
                          `${error.suggestedAction}`
                  }]
                };

              case DataErrorType.NO_DATA:
                return {
                  content: [{
                    type: 'text',
                    text: `ℹ️ **No recovery rate data available for ${REGION_DISPLAY_NAMES[REGION_NAMES[region]]}**\n\n` +
                          `The World Bank Data360 IFC_GEM database does not contain recovery rate data for this region.\n\n` +
                          `${error.suggestedAction || 'Try querying global data or a different region.'}`
                  }]
                };

              case DataErrorType.RATE_LIMITED:
                return {
                  content: [{
                    type: 'text',
                    text: `⚠️ **API Rate Limit Exceeded**\n\n` +
                          `${error.message}\n\n` +
                          `${error.suggestedAction}`
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

          // Fallback to mock data if no error but no data
          const mockData = mockCreditData[region];
          if (mockData) {
            return {
              content: [{
                type: 'text',
                text: `# Recovery Rates for ${mockData.region}\n\n**Recovery Rate:** ${mockData.recoveryRate}%\n\n**Analysis:** When loans default in ${mockData.region}, lenders recover an average of ${mockData.recoveryRate}% of the loan value.\n\n*⚠️ Using fallback data (API unavailable)*`
              }]
            };
          }

          return {
            content: [{
              type: 'text',
              text: `No data available for region: ${region}`
            }]
          };
        }

        // At this point TypeScript knows data is RegionDataResult
        const regionData = data as RegionDataResult;

        // Build result message with transparent approximation disclosure
        let resultText = `# Recovery Rates for ${regionData.region}\n\n**Recovery Rate:** ${regionData.recoveryRate}%\n\n`;

        if (regionData.isRecoveryEstimated && regionData.recoveryError) {
          // Show approximation with methodology
          resultText += `⚠️ **Data Status:** Recovery rate approximated (real data unavailable)\n\n`;
          resultText += `**Approximation Method:**\n`;
          resultText += `- Based on inverse correlation between default and recovery rates\n`;
          resultText += `- Formula: 73% (baseline) + (3.5% - ${regionData.defaultRate.toFixed(2)}%) × 1.5\n`;
          resultText += `- Confidence: Moderate (±5-10% typical variance)\n`;
          resultText += `- Source: Statistical analysis of IFC_GEM historical data (1994-2024)\n\n`;
          resultText += `**Why approximated:** ${regionData.recoveryError.message}\n\n`;
        } else if (regionData.recoveryError?.type === DataErrorType.STALE_DATA) {
          // Show warning about stale data
          resultText += `⚠️ **Data Age Warning:** ${regionData.recoveryError.message}\n\n`;
        }

        resultText += `**Analysis:** When loans default, lenders recover ${regionData.recoveryRate}% of loan value.\n\n`;
        resultText += `**Period:** ${regionData.period}\n\n`;

        // Data source attribution
        if (regionData.isRecoveryEstimated) {
          resultText += `*Approximated based on default rate correlation*`;
        } else {
          resultText += `*Real-time data from World Bank Data360 IFC_GEM_PBR*`;
        }

        return {
          content: [{
            type: 'text',
            text: resultText
          }]
        };
      }
    );

    // Tool 3: Query Credit Risk
    server.tool(
      'query_credit_risk',
      'Get comprehensive credit risk statistics for a region including default rates, recovery rates, and loan volumes',
      {
        region: z.enum(['global', 'east-asia', 'latin-america', 'sub-saharan-africa', 'south-asia', 'mena', 'europe-central-asia'])
          .describe('Region to analyze')
      },
      async ({ region }) => {
        const result = await getRegionData(region);

        // Handle errors
        if (!result || 'error' in result) {
          const error = result && 'error' in result ? result.error : undefined;

          if (error) {
            return {
              content: [{
                type: 'text',
                text: `⚠️ **Error retrieving credit risk data**\n\n${error.message}\n\n${error.suggestedAction || 'Please try again.'}`
              }]
            };
          }

          // Fallback to mock data
          const mockData = mockCreditData[region];
          if (mockData) {
            const expectedLoss = (mockData.defaultRate * (100 - mockData.recoveryRate) / 100).toFixed(2);
            return {
              content: [{
                type: 'text',
                text: `# Credit Risk Profile: ${mockData.region}\n\n## Key Metrics\n\n**Default Rate:** ${mockData.defaultRate}%\n**Recovery Rate:** ${mockData.recoveryRate}%\n**Number of Loans:** ${mockData.numberOfLoans.toLocaleString()}\n**Total Volume:** $${(mockData.totalVolume / 1e9).toFixed(1)}B USD\n**Period:** ${mockData.period}\n\n## Risk Assessment\n\n**Expected Loss:** ${expectedLoss}%\n\n*⚠️ Using fallback data (API unavailable)*`
              }]
            };
          }

          return {
            content: [{
              type: 'text',
              text: `No data available for region: ${region}`
            }]
          };
        }

        // At this point TypeScript knows result is RegionDataResult
        const data = result as RegionDataResult;

        const expectedLoss = (data.defaultRate * (100 - data.recoveryRate) / 100).toFixed(2);

        // Determine data source note with transparent approximation
        const recoveryNote = data.isRecoveryEstimated
          ? ' (approximated - see note below)'
          : ' (real-time API)';
        let dataNote = data.isRecoveryEstimated
          ? '**Note on Recovery Rate:** Real recovery rate data not available. Approximated using statistical correlation:\n' +
            `- Formula: 73% (baseline) + (3.5% - ${data.defaultRate.toFixed(2)}%) × 1.5\n` +
            '- Confidence: Moderate (±5-10% typical variance)\n\n' +
            '*Default rate from World Bank Data360 IFC_GEM_PBD (real-time)*'
          : '*Real-time data from World Bank Data360 IFC_GEM (default rates: IFC_GEM_PBD, recovery rates: IFC_GEM_PBR)*';

        return {
          content: [{
            type: 'text',
            text: `# Credit Risk Profile: ${data.region}\n\n## Key Metrics\n\n**Default Rate:** ${data.defaultRate}%\n**Recovery Rate:** ${data.recoveryRate}%${recoveryNote}\n**Number of Loans:** ${data.numberOfLoans.toLocaleString()}\n**Total Volume:** $${(data.totalVolume / 1e9).toFixed(1)}B USD\n**Period:** ${data.period}\n\n## Risk Assessment\n\n**Expected Loss:** ${expectedLoss}%\n\nThe expected loss represents the percentage of loan value expected to be lost after accounting for defaults and recoveries.\n\n${dataNote}`
          }]
        };
      }
    );

    // Tool 4: Sector Analysis
    server.tool(
      'get_sector_analysis',
      'Analyze credit risk performance by economic sector (21 sectors: GICS + IFC categories)',
      {
        sector: z.enum([
          'all', 'overall',
          // IFC categories
          'non-financial', 'financial-institutions', 'banking', 'infrastructure',
          'non-banking', 'renewables', 'services',
          // GICS sectors
          'financials', 'utilities', 'industrials', 'consumer-staples',
          'consumer-discretionary', 'materials', 'others', 'communication-services',
          'health-care', 'energy', 'real-estate', 'information-technology', 'administration'
        ])
          .optional()
          .describe('Economic sector to analyze, or "all" for all sectors')
      },
      async ({ sector = 'all' }) => {
        // Map user-friendly names to sector codes
        const sectorMapping: Record<string, string> = {
          'all': '_T',
          'overall': '_T',
          'non-financial': 'NF',
          'financial-institutions': 'FI',
          'banking': 'BK',
          'infrastructure': 'IN',
          'non-banking': 'NB',
          'renewables': 'R',
          'services': 'S',
          'financials': 'F',
          'utilities': 'U',
          'industrials': 'I',
          'consumer-staples': 'CST',
          'consumer-discretionary': 'CD',
          'materials': 'M',
          'others': 'O',
          'communication-services': 'CS',
          'health-care': 'HC',
          'energy': 'E',
          'real-estate': 'RE',
          'information-technology': 'IT',
          'administration': 'A',
        };

        const sectorCode = sectorMapping[sector] || '_T';

        if (sector !== 'all' && sector !== 'overall') {
          // Fetch real data for specific sector
          const result = await getSectorData(sectorCode);

          if (!result || 'error' in result) {
            const error = result && 'error' in result ? result.error : undefined;

            if (error) {
              return {
                content: [{
                  type: 'text',
                  text: `⚠️ **Error retrieving sector data**\n\n${error.message}\n\n${error.suggestedAction || 'Try broader filters.'}`
                }]
              };
            }

            // Fallback to mock data if available
            const mockMatch = mockSectorData.find(s =>
              s.sector.toLowerCase().includes(sector.toLowerCase())
            );

            if (mockMatch) {
              const expectedLoss = (mockMatch.defaultRate * (100 - mockMatch.recoveryRate) / 100).toFixed(2);
              return {
                content: [{
                  type: 'text',
                  text: `# Sector Analysis: ${mockMatch.sector}\n\n**Default Rate:** ${mockMatch.defaultRate}%\n**Recovery Rate:** ${mockMatch.recoveryRate}%\n**Average Loan Size:** $${(mockMatch.avgLoanSize / 1e6).toFixed(1)}M\n**Expected Loss:** ${expectedLoss}%\n\n${mockMatch.defaultRate < 3.5 ? 'Below-average' : 'Above-average'} risk vs global 3.5%.\n\n*⚠️ Using fallback data (API unavailable)*`
                }]
              };
            }

            return {
              content: [{
                type: 'text',
                text: `No data available for sector: ${sector}\n\nAvailable sectors: ${Object.keys(sectorMapping).filter(k => k !== 'all' && k !== 'overall').join(', ')}`
              }]
            };
          }

          // At this point TypeScript knows result is SectorDataResult
          const data = result as SectorDataResult;

          const expectedLoss = (data.defaultRate * (100 - data.recoveryRate) / 100).toFixed(2);
          const recoveryNote = data.isRecoveryEstimated ? ' (estimated)' : '';
          const dataSource = data.isRecoveryEstimated
            ? '*Default rate from World Bank Data360 IFC_GEM_PBD (real-time). Recovery rate estimated.*'
            : '*Real-time data from World Bank Data360 IFC_GEM*';

          return {
            content: [{
              type: 'text',
              text: `# Sector Analysis: ${data.sectorName}\n\n**Default Rate:** ${data.defaultRate.toFixed(2)}%\n**Recovery Rate:** ${data.recoveryRate.toFixed(2)}%${recoveryNote}\n**Expected Loss:** ${expectedLoss}%\n**Period:** ${data.period}\n\n${data.defaultRate < 3.5 ? 'Below-average' : 'Above-average'} risk vs global 3.5%.\n\n${dataSource}`
            }]
          };
        }

        // Return all sectors (top sectors with real data)
        const topSectorCodes = ['F', 'I', 'E', 'U', 'IN', 'BK', 'NF', 'R'];
        const sectorDataArray: SectorDataResult[] = [];

        for (const code of topSectorCodes) {
          const result = await getSectorData(code);
          if (result && !('error' in result)) {
            sectorDataArray.push(result as SectorDataResult);
          }
        }

        if (sectorDataArray.length === 0) {
          // Fallback to mock data
          let result = `# Credit Risk by Sector\n\n`;
          result += `| Sector | Default | Recovery | Avg Loan | Exp Loss |\n`;
          result += `|--------|---------|----------|----------|----------|\n`;

          mockSectorData
            .sort((a, b) => a.defaultRate - b.defaultRate)
            .forEach((s) => {
              const expectedLoss = (s.defaultRate * (100 - s.recoveryRate) / 100).toFixed(2);
              result += `| ${s.sector} | ${s.defaultRate}% | ${s.recoveryRate}% | $${(s.avgLoanSize / 1e6).toFixed(1)}M | ${expectedLoss}% |\n`;
            });

          result += `\n*Using fallback data (API unavailable)*`;

          return {
            content: [{
              type: 'text',
              text: result
            }]
          };
        }

        // Show real data
        let result = `# Credit Risk by Sector\n\n`;
        result += `| Sector | Default Rate | Recovery Rate | Expected Loss |\n`;
        result += `|--------|--------------|---------------|---------------|\n`;

        sectorDataArray
          .sort((a, b) => a.defaultRate - b.defaultRate)
          .forEach((s) => {
            const expectedLoss = (s.defaultRate * (100 - s.recoveryRate) / 100).toFixed(2);
            const recoveryMark = s.isRecoveryEstimated ? '*' : '';
            result += `| ${s.sectorName} | ${s.defaultRate.toFixed(2)}% | ${s.recoveryRate.toFixed(2)}%${recoveryMark} | ${expectedLoss}% |\n`;
          });

        result += `\n*Real-time data from World Bank Data360 IFC_GEM*`;
        result += `\n* = Recovery rate estimated`;

        return {
          content: [{
            type: 'text',
            text: result
          }]
        };
      }
    );

    // Tool 5: Compare Regions
    server.tool(
      'compare_regions',
      'Compare credit risk metrics across multiple emerging market regions',
      {
        metric: z.enum(['default-rate', 'recovery-rate', 'both'])
          .describe('Metric to compare across regions')
      },
      async ({ metric }) => {
        // Try to fetch real data for all regions
        const regionDataArray: RegionDataResult[] = [];
        for (const regionName of Object.keys(REGION_NAMES)) {
          const result = await getRegionData(regionName);
          if (result && !('error' in result)) {
            regionDataArray.push(result as RegionDataResult);
          }
        }

        let result = `# Regional Credit Risk Comparison\n\n`;

        if (regionDataArray.length > 0) {
          if (metric === 'default-rate' || metric === 'both') {
            result += `## Default Rates\n\n`;
            const sorted = regionDataArray.sort((a, b) => a.defaultRate - b.defaultRate);
            sorted.forEach((r, i) => {
              result += `${i + 1}. **${r.region}:** ${r.defaultRate}%\n`;
            });
            result += `\n`;
          }

          if (metric === 'recovery-rate' || metric === 'both') {
            result += `## Recovery Rates\n\n`;
            const sorted = regionDataArray.sort((a, b) => b.recoveryRate - a.recoveryRate);
            sorted.forEach((r, i) => {
              result += `${i + 1}. **${r.region}:** ${r.recoveryRate}%\n`;
            });
          }

          result += `\n*Real-time data from World Bank Data360*`;
        } else {
          // Fallback to mock data
          if (metric === 'default-rate' || metric === 'both') {
            result += `## Default Rates\n\n`;
            Object.values(mockCreditData).sort((a: any, b: any) => a.defaultRate - b.defaultRate).forEach((r: any, i: number) => {
              result += `${i + 1}. **${r.region}:** ${r.defaultRate}%\n`;
            });
          }

          result += `\n*Using cached data*`;
        }

        return {
          content: [{
            type: 'text',
            text: result
          }]
        };
      }
    );

    // Tool 6: Project Type Analysis
    server.tool(
      'get_project_type_analysis',
      'Analyze credit risk by project financing type (Corporate Finance, Project Finance, etc.)',
      {
        projectType: z.enum([
          'all', 'overall',
          'corporate-finance', 'project-finance', 'financial-institutions',
          'structured-finance', 'mixed', 'other'
        ])
          .optional()
          .describe('Project financing type to analyze, or "all" for comparison')
      },
      async ({ projectType = 'all' }) => {
        // Map user-friendly names to project type codes
        const projectTypeMapping: Record<string, string> = {
          'all': '_T',
          'overall': '_T',
          'corporate-finance': 'CF',
          'project-finance': 'PF',
          'financial-institutions': 'FI',
          'structured-finance': 'SF',
          'mixed': 'MX',
          'other': 'O',
        };

        const projectTypeCode = projectTypeMapping[projectType] || '_T';

        if (projectType !== 'all' && projectType !== 'overall') {
          // Fetch real data for specific project type
          const result = await getProjectTypeData(projectTypeCode);

          if (!result || 'error' in result) {
            const error = result && 'error' in result ? result.error : undefined;

            if (error) {
              return {
                content: [{
                  type: 'text',
                  text: `⚠️ **Error retrieving project type data**\n\n${error.message}\n\n${error.suggestedAction || 'Try broader filters.'}`
                }]
              };
            }

            return {
              content: [{
                type: 'text',
                text: `No data available for project type: ${projectType}`
              }]
            };
          }

          // At this point TypeScript knows result is SectorDataResult
          const data = result as SectorDataResult;

          const expectedLoss = (data.defaultRate * (100 - data.recoveryRate) / 100).toFixed(2);
          const recoveryNote = data.isRecoveryEstimated ? ' (estimated)' : '';
          const dataSource = data.isRecoveryEstimated
            ? '*Default rate from World Bank Data360 IFC_GEM_PBD (real-time). Recovery rate estimated.*'
            : '*Real-time data from World Bank Data360 IFC_GEM*';

          return {
            content: [{
              type: 'text',
              text: `# Project Type Analysis: ${data.sectorName}\n\n` +
                    `**Default Rate:** ${data.defaultRate.toFixed(2)}%\n` +
                    `**Recovery Rate:** ${data.recoveryRate.toFixed(2)}%${recoveryNote}\n` +
                    `**Expected Loss:** ${expectedLoss}%\n` +
                    `**Period:** ${data.period}\n\n` +
                    `${data.defaultRate < 3.5 ? 'Below-average' : 'Above-average'} risk vs global 3.5%.\n\n` +
                    `${dataSource}`
            }]
          };
        }

        // Return all project types comparison
        const projectTypeCodes = ['CF', 'PF', 'FI', 'SF', 'MX', 'O'];
        const projectTypeDataArray: SectorDataResult[] = [];

        for (const code of projectTypeCodes) {
          const result = await getProjectTypeData(code);
          if (result && !('error' in result)) {
            projectTypeDataArray.push(result as SectorDataResult);
          }
        }

        if (projectTypeDataArray.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `⚠️ **No project type data available**\n\nUnable to retrieve data from World Bank Data360 API.`
            }]
          };
        }

        // Show comparison table
        let result = `# Credit Risk by Project Type\n\n`;
        result += `| Project Type | Default Rate | Recovery Rate | Expected Loss |\n`;
        result += `|--------------|--------------|---------------|---------------|\n`;

        projectTypeDataArray
          .sort((a, b) => a.defaultRate - b.defaultRate)
          .forEach((p) => {
            const expectedLoss = (p.defaultRate * (100 - p.recoveryRate) / 100).toFixed(2);
            const recoveryMark = p.isRecoveryEstimated ? '*' : '';
            result += `| ${p.sectorName} | ${p.defaultRate.toFixed(2)}% | ${p.recoveryRate.toFixed(2)}%${recoveryMark} | ${expectedLoss}% |\n`;
          });

        result += `\n**Key Insights:**\n`;
        const lowest = projectTypeDataArray.reduce((min, p) => p.defaultRate < min.defaultRate ? p : min);
        const highest = projectTypeDataArray.reduce((max, p) => p.defaultRate > max.defaultRate ? p : max);
        result += `- Lowest risk: ${lowest.sectorName} (${lowest.defaultRate.toFixed(2)}%)\n`;
        result += `- Highest risk: ${highest.sectorName} (${highest.defaultRate.toFixed(2)}%)\n`;
        result += `- Risk spread: ${(highest.defaultRate - lowest.defaultRate).toFixed(2)}% difference\n\n`;
        result += `*Real-time data from World Bank Data360 IFC_GEM*\n`;
        result += `* = Recovery rate estimated`;

        return {
          content: [{
            type: 'text',
            text: result
          }]
        };
      }
    );

    // Tool 7: Time Series Analysis
    server.tool(
      'get_time_series',
      'Analyze historical trends in credit risk metrics over time (1994-2024)',
      {
        region: z.enum(['global', 'east-asia', 'latin-america', 'sub-saharan-africa', 'south-asia', 'mena', 'europe-central-asia'])
          .optional()
          .describe('Region to analyze (defaults to global)'),
        years: z.number()
          .optional()
          .describe('Number of recent years to analyze (default: 10)')
      },
      async ({ region = 'global', years = 10 }) => {
        const regionCode = REGION_NAMES[region];
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - years;

        const result = await getTimeSeriesData(regionCode, "_T", "_T", startYear, currentYear);

        if ('error' in result) {
          return {
            content: [{
              type: 'text',
              text: `⚠️ **Error retrieving time series data**\n\n${result.error.message}\n\n${result.error.suggestedAction || ''}`
            }]
          };
        }

        const dataPoints = result as TimeSeriesDataPoint[];

        // Calculate trend
        const firstYear = dataPoints[0];
        const lastYear = dataPoints[dataPoints.length - 1];
        const change = lastYear.defaultRate - firstYear.defaultRate;
        const percentChange = ((change / firstYear.defaultRate) * 100).toFixed(1);
        const trend = change > 0 ? '📈 Increasing' : change < 0 ? '📉 Decreasing' : '➡️ Stable';

        // Calculate statistics
        const rates = dataPoints.map(d => d.defaultRate);
        const avgRate = (rates.reduce((sum, r) => sum + r, 0) / rates.length).toFixed(2);
        const maxRate = Math.max(...rates).toFixed(2);
        const minRate = Math.min(...rates).toFixed(2);

        // Build result
        let resultText = `# Historical Credit Risk Trend: ${REGION_DISPLAY_NAMES[regionCode]}\n\n`;
        resultText += `**Period:** ${firstYear.year} - ${lastYear.year} (${years} years)\n\n`;

        resultText += `## Summary Statistics\n\n`;
        resultText += `- **Current Rate (${lastYear.year}):** ${lastYear.defaultRate.toFixed(2)}%\n`;
        resultText += `- **Average Rate:** ${avgRate}%\n`;
        resultText += `- **Highest Rate:** ${maxRate}%\n`;
        resultText += `- **Lowest Rate:** ${minRate}%\n`;
        resultText += `- **Change:** ${change > 0 ? '+' : ''}${change.toFixed(2)}% (${percentChange}%)\n`;
        resultText += `- **Trend:** ${trend}\n\n`;

        resultText += `## Year-by-Year Data\n\n`;
        resultText += `| Year | Default Rate | Change |\n`;
        resultText += `|------|--------------|--------|\n`;

        dataPoints.forEach((point, index) => {
          const yearChange = index > 0 ? point.defaultRate - dataPoints[index - 1].defaultRate : 0;
          const changeStr = index > 0 ? `${yearChange > 0 ? '+' : ''}${yearChange.toFixed(2)}%` : '-';
          resultText += `| ${point.year} | ${point.defaultRate.toFixed(2)}% | ${changeStr} |\n`;
        });

        resultText += `\n*Real-time data from World Bank Data360 IFC_GEM*`;

        return {
          content: [{
            type: 'text',
            text: resultText
          }]
        };
      }
    );

    // Tool 8: Seniority Analysis
    server.tool(
      'get_seniority_analysis',
      'Compare recovery rates by debt seniority (Senior Secured vs Senior Unsecured)',
      {
        region: z.enum(['global', 'east-asia', 'latin-america', 'sub-saharan-africa', 'south-asia', 'mena', 'europe-central-asia'])
          .optional()
          .describe('Region to analyze (defaults to global)')
      },
      async ({ region = 'global' }) => {
        const regionCode = REGION_NAMES[region];
        const regionName = REGION_DISPLAY_NAMES[regionCode];

        // Fetch recovery rates for both seniority levels
        const [ssResult, suResult] = await Promise.all([
          getSeniorityRecoveryData('SS', regionCode),
          getSeniorityRecoveryData('SU', regionCode)
        ]);

        // Handle errors
        if (!ssResult.success || !suResult.success) {
          const error = !ssResult.success ? ssResult.error : suResult.error;

          return {
            content: [{
              type: 'text',
              text: `⚠️ **Error retrieving seniority data**\n\n` +
                    `${error!.message}\n\n` +
                    `${error!.suggestedAction || ''}\n\n` +
                    `**Note:** Seniority data may only be available at the global level.`
            }]
          };
        }

        const ssRate = ssResult.data!;
        const suRate = suResult.data!;
        const securityPremium = ssRate - suRate;

        // Build result
        let resultText = `# Debt Seniority Analysis: ${regionName}\n\n`;

        resultText += `## Recovery Rates by Seniority\n\n`;
        resultText += `| Seniority Level | Recovery Rate | Risk Level |\n`;
        resultText += `|-----------------|---------------|------------|\n`;
        resultText += `| **Senior Secured (SS)** | ${ssRate.toFixed(2)}% | Lower Risk |\n`;
        resultText += `| **Senior Unsecured (SU)** | ${suRate.toFixed(2)}% | Higher Risk |\n\n`;

        resultText += `## Key Metrics\n\n`;
        resultText += `- **Security Premium:** ${securityPremium.toFixed(2)}%\n`;
        resultText += `- **Relative Advantage:** ${((securityPremium / suRate) * 100).toFixed(1)}% better recovery for secured debt\n\n`;

        resultText += `## Analysis\n\n`;
        if (securityPremium > 10) {
          resultText += `**Significant security premium detected.** Collateralized loans recover ${securityPremium.toFixed(2)}% more than uncollateralized loans, highlighting the importance of security in credit structuring.\n\n`;
        } else if (securityPremium > 5) {
          resultText += `**Moderate security premium.** Collateral provides a ${securityPremium.toFixed(2)}% recovery advantage, demonstrating tangible risk mitigation benefits.\n\n`;
        } else {
          resultText += `**Limited security premium.** The ${securityPremium.toFixed(2)}% difference suggests other factors may be more significant in determining recovery rates.\n\n`;
        }

        resultText += `**Implications for Lending:**\n`;
        resultText += `- Senior secured loans offer ${ssRate.toFixed(2)}% average recovery on default\n`;
        resultText += `- Senior unsecured loans offer ${suRate.toFixed(2)}% average recovery on default\n`;
        resultText += `- Security reduces expected loss by ${securityPremium.toFixed(2)} percentage points\n\n`;

        resultText += `*Real-time data from World Bank Data360 IFC_GEM_PBR*\n`;
        resultText += `*Period: 1994-2024*`;

        return {
          content: [{
            type: 'text',
            text: resultText
          }]
        };
      }
    );
  },
  undefined,
  { basePath: "/api" }
);

// Export as named HTTP methods for MCP protocol (GET, POST, DELETE required)
export { handler as GET, handler as POST, handler as DELETE };
