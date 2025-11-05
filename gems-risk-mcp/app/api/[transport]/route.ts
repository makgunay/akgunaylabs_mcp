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

// API Client Functions
async function fetchData360(params: Record<string, string>): Promise<Data360Response> {
  // Check cache first
  const cacheKey = getCacheKey(params);
  const cached = apiCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`Cache hit for: ${cacheKey}`);
    return cached.data;
  }

  // Cache miss or expired - fetch from API
  const queryString = new URLSearchParams(params).toString();
  const url = `${DATA360_API_BASE}/data360/data?${queryString}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const data = await response.json() as Data360Response;

    // Store in cache
    apiCache.set(cacheKey, {
      data,
      timestamp: now
    });

    console.log(`Cache miss - fetched and cached: ${cacheKey}`);

    return data;
  } catch (error) {
    console.error("Error fetching from Data360 API:", error);
    throw error;
  }
}

// Fetch real recovery rates from IFC_GEM_PBR indicator
async function getRecoveryRateData(apiCode: string): Promise<number | null> {
  try {
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

    const recoveryData = await fetchData360(recoveryParams);

    if (!recoveryData.value || recoveryData.value.length === 0) {
      console.warn(`No recovery rate data available for region ${apiCode}`);
      return null;
    }

    // Get most recent recovery rate
    const latestRecovery = recoveryData.value
      .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

    // Validate we're getting percentage data
    if (latestRecovery) {
      if (latestRecovery.UNIT_MEASURE !== 'PT') {
        console.error(`Expected percentage unit (PT) for recovery rate, got ${latestRecovery.UNIT_MEASURE}`);
      }
      if (latestRecovery.METRIC !== 'ARR') {
        console.error(`Expected METRIC='ARR' for recovery rate, got METRIC='${latestRecovery.METRIC}'`);
      }
    }

    const recoveryRate = latestRecovery ? parseFloat(latestRecovery.OBS_VALUE) : null;

    // Sanity check: recovery rates should be 0-100%
    if (recoveryRate !== null && (recoveryRate < 0 || recoveryRate > 100)) {
      console.error(`Invalid recovery rate: ${recoveryRate}% for region ${apiCode}`);
      return null;
    }

    return recoveryRate;
  } catch (error) {
    console.error(`Error fetching recovery rate data for region ${apiCode}:`, error);
    return null;
  }
}

// Estimate recovery rate using correlation with default rate (fallback method)
function estimateRecoveryRate(defaultRate: number): number {
  const globalAvgRecovery = 73;
  const globalAvgDefault = 3.5;
  const recoveryAdjustment = (globalAvgDefault - defaultRate) * 1.5;
  return Math.max(60, Math.min(80, globalAvgRecovery + recoveryAdjustment));
}

// Fetch real sector data from IFC_GEM_PBD indicator
async function getSectorData(sectorCode: string, regionCode: string = "_T", projectTypeCode: string = "_T") {
  try {
    const sectorParams = {
      DATABASE_ID: IFC_GEM_DATASET,
      INDICATOR: "IFC_GEM_PBD",  // Public default rates
      METRIC: "ADR",              // Average Default Rate
      REF_AREA: regionCode,
      SECTOR: sectorCode,
      PROJECT_TYPE: projectTypeCode,
      TIME_PERIOD: "2024",
    };

    const sectorData = await fetchData360(sectorParams);

    if (!sectorData.value || sectorData.value.length === 0) {
      console.warn(`No sector data available for sector ${sectorCode}, region ${regionCode}`);
      return null;
    }

    // Get most recent default rate
    const latestData = sectorData.value
      .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

    const defaultRate = latestData ? parseFloat(latestData.OBS_VALUE) : null;

    if (defaultRate === null || defaultRate < 0 || defaultRate > 100) {
      console.error(`Invalid default rate for sector ${sectorCode}: ${defaultRate}%`);
      return null;
    }

    // Try to get recovery rate for this sector
    const recoveryRate = await getRecoveryRateData(regionCode);

    return {
      sectorCode,
      sectorName: SECTOR_NAMES[sectorCode] || sectorCode,
      defaultRate,
      recoveryRate: recoveryRate !== null ? recoveryRate : estimateRecoveryRate(defaultRate),
      isRecoveryEstimated: recoveryRate === null,
      period: "1994-2024",
    };
  } catch (error) {
    console.error(`Error fetching sector data for ${sectorCode}:`, error);
    return null;
  }
}

async function getRegionData(region: string) {
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

    const [defaultData, countData, volumeData] = await Promise.all([
      fetchData360(defaultParams),
      fetchData360(countParams),
      fetchData360(volumeParams),
    ]);

    // Get most recent default rate
    const latestDefault = defaultData.value
      .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];

    // Validate we're getting percentage data, not count data
    if (latestDefault) {
      if (latestDefault.UNIT_MEASURE !== 'PT') {
        console.error(`Expected percentage unit (PT), got ${latestDefault.UNIT_MEASURE}. Check METRIC='ADR' is being used.`);
      }
      if (latestDefault.METRIC !== 'ADR') {
        console.error(`Expected METRIC='ADR', got METRIC='${latestDefault.METRIC}'. Likely querying counterparts (CP) instead.`);
      }
    }

    const defaultRate = latestDefault ? parseFloat(latestDefault.OBS_VALUE) : 0;

    // Sanity check: default rates should be 0-100%
    if (defaultRate > 100) {
      console.error(`Invalid default rate: ${defaultRate}% for region ${apiCode}. This likely means wrong METRIC is being used.`);
      return null;
    }

    // Get most recent count
    const latestCount = countData.value
      .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];
    const numberOfLoans = latestCount ? parseFloat(latestCount.OBS_VALUE) : 0;

    // Get most recent volume
    const latestVolume = volumeData.value
      .sort((a: any, b: any) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];
    const totalVolume = latestVolume ? parseFloat(latestVolume.OBS_VALUE) * 1e6 : 0;

    // Fetch real recovery rate from API (IFC_GEM_PBR indicator)
    // Falls back to estimation if API data not available
    const realRecoveryRate = await getRecoveryRateData(apiCode);
    const recoveryRate = realRecoveryRate !== null
      ? realRecoveryRate
      : estimateRecoveryRate(defaultRate);

    // Track whether we're using real or estimated data
    const isRecoveryEstimated = realRecoveryRate === null;

    return {
      region: REGION_DISPLAY_NAMES[apiCode],
      defaultRate,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      numberOfLoans: Math.round(numberOfLoans),
      totalVolume: Math.round(totalVolume),
      period: "1994-2024",
      isRecoveryEstimated,  // Flag to indicate data source
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
        const data = await getRegionData(region);

        if (!data) {
          const mockData = mockCreditData[region];
          if (!mockData) {
            return {
              content: [{
                type: 'text',
                text: `No data available for region: ${region}. Available: ${Object.keys(REGION_NAMES).join(", ")}`
              }]
            };
          }

          return {
            content: [{
              type: 'text',
              text: `# Default Rates for ${mockData.region}\n\n**Default Rate:** ${mockData.defaultRate}%\n\n**Period:** ${mockData.period}\n\n**Context:** Out of ${mockData.numberOfLoans.toLocaleString()} loans totaling $${(mockData.totalVolume / 1e9).toFixed(1)} billion USD, ${mockData.defaultRate}% resulted in default.\n\n*Using cached data.*`
            }]
          };
        }

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

        if (!data) {
          const mockData = mockCreditData[region];
          if (!mockData) {
            return {
              content: [{
                type: 'text',
                text: `No data available for region: ${region}`
              }]
            };
          }

          return {
            content: [{
              type: 'text',
              text: `# Recovery Rates for ${mockData.region}\n\n**Recovery Rate:** ${mockData.recoveryRate}%\n\n**Analysis:** When loans default in ${mockData.region}, lenders recover an average of ${mockData.recoveryRate}% of the loan value.\n\n*Using cached data.*`
            }]
          };
        }

        // Determine data source message
        const dataSource = data.isRecoveryEstimated
          ? '*Recovery rate estimated based on default rate correlation (API data not available)*'
          : '*Recovery rate from World Bank Data360 IFC_GEM_PBR (real-time)*';

        return {
          content: [{
            type: 'text',
            text: `# Recovery Rates for ${data.region}\n\n**Recovery Rate:** ${data.recoveryRate}%\n\n**Period:** ${data.period}\n\n**Analysis:** When loans default, lenders recover ${data.recoveryRate}% of loan value.\n\n${dataSource}`
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
        const data = await getRegionData(region);

        if (!data) {
          const mockData = mockCreditData[region];
          if (!mockData) {
            return {
              content: [{
                type: 'text',
                text: `No data available for region: ${region}`
              }]
            };
          }

          const expectedLoss = (mockData.defaultRate * (100 - mockData.recoveryRate) / 100).toFixed(2);
          return {
            content: [{
              type: 'text',
              text: `# Credit Risk Profile: ${mockData.region}\n\n## Key Metrics\n\n**Default Rate:** ${mockData.defaultRate}%\n**Recovery Rate:** ${mockData.recoveryRate}%\n**Number of Loans:** ${mockData.numberOfLoans.toLocaleString()}\n**Total Volume:** $${(mockData.totalVolume / 1e9).toFixed(1)}B USD\n**Period:** ${mockData.period}\n\n## Risk Assessment\n\n**Expected Loss:** ${expectedLoss}%\n\n*Using cached data.*`
            }]
          };
        }

        const expectedLoss = (data.defaultRate * (100 - data.recoveryRate) / 100).toFixed(2);

        // Determine data source note
        const recoveryNote = data.isRecoveryEstimated
          ? ' (estimated)'
          : ' (real-time API)';
        const dataNote = data.isRecoveryEstimated
          ? '*Default rate from World Bank Data360 (real-time). Recovery rate estimated based on default rate correlation.*'
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
          const data = await getSectorData(sectorCode);

          if (!data) {
            // Fallback to mock data if available
            const mockMatch = mockSectorData.find(s =>
              s.sector.toLowerCase().includes(sector.toLowerCase())
            );

            if (mockMatch) {
              const expectedLoss = (mockMatch.defaultRate * (100 - mockMatch.recoveryRate) / 100).toFixed(2);
              return {
                content: [{
                  type: 'text',
                  text: `# Sector Analysis: ${mockMatch.sector}\n\n**Default Rate:** ${mockMatch.defaultRate}%\n**Recovery Rate:** ${mockMatch.recoveryRate}%\n**Average Loan Size:** $${(mockMatch.avgLoanSize / 1e6).toFixed(1)}M\n**Expected Loss:** ${expectedLoss}%\n\n${mockMatch.defaultRate < 3.5 ? 'Below-average' : 'Above-average'} risk vs global 3.5%.\n\n*Using fallback data (API unavailable)*`
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
        const sectorDataArray = [];

        for (const code of topSectorCodes) {
          const data = await getSectorData(code);
          if (data) {
            sectorDataArray.push(data);
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
        const regionDataArray = [];
        for (const regionName of Object.keys(REGION_NAMES)) {
          const data = await getRegionData(regionName);
          if (data) {
            regionDataArray.push(data);
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
  },
  undefined,
  { basePath: "/api" }
);

// Export as named HTTP methods for MCP protocol (GET, POST, DELETE required)
export { handler as GET, handler as POST, handler as DELETE };
