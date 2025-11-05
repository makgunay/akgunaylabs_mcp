#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Data structures for GEMs Credit Risk Database
// In a real implementation, this would connect to the World Bank Data360 API
interface CreditRiskData {
  region: string;
  defaultRate: number; // percentage
  recoveryRate: number; // percentage
  numberOfLoans: number;
  totalVolume: number; // USD
  period: string;
}

interface SectorRisk {
  sector: string;
  defaultRate: number;
  recoveryRate: number;
  avgLoanSize: number;
}

// Mock data for demonstration - represents typical GEMs statistics
const mockCreditData: Record<string, CreditRiskData> = {
  global: {
    region: "Global Emerging Markets",
    defaultRate: 3.5,
    recoveryRate: 73,
    numberOfLoans: 15420,
    totalVolume: 425e9,
    period: "1998-2024",
  },
  "east-asia": {
    region: "East Asia & Pacific",
    defaultRate: 2.8,
    recoveryRate: 76,
    numberOfLoans: 4200,
    totalVolume: 145e9,
    period: "1998-2024",
  },
  "latin-america": {
    region: "Latin America & Caribbean",
    defaultRate: 4.2,
    recoveryRate: 68,
    numberOfLoans: 3800,
    totalVolume: 120e9,
    period: "1998-2024",
  },
  "sub-saharan-africa": {
    region: "Sub-Saharan Africa",
    defaultRate: 5.1,
    recoveryRate: 65,
    numberOfLoans: 2600,
    totalVolume: 85e9,
    period: "1998-2024",
  },
  "south-asia": {
    region: "South Asia",
    defaultRate: 3.9,
    recoveryRate: 70,
    numberOfLoans: 2400,
    totalVolume: 75e9,
    period: "1998-2024",
  },
  "mena": {
    region: "Middle East & North Africa",
    defaultRate: 3.2,
    recoveryRate: 72,
    numberOfLoans: 1800,
    totalVolume: 68e9,
    period: "1998-2024",
  },
  "europe-central-asia": {
    region: "Europe & Central Asia",
    defaultRate: 3.0,
    recoveryRate: 75,
    numberOfLoans: 620,
    totalVolume: 42e9,
    period: "1998-2024",
  },
};

const mockSectorData: SectorRisk[] = [
  { sector: "Financial Services", defaultRate: 2.8, recoveryRate: 78, avgLoanSize: 32e6 },
  { sector: "Infrastructure", defaultRate: 3.1, recoveryRate: 75, avgLoanSize: 85e6 },
  { sector: "Manufacturing", defaultRate: 3.6, recoveryRate: 72, avgLoanSize: 28e6 },
  { sector: "Services", defaultRate: 4.0, recoveryRate: 70, avgLoanSize: 22e6 },
  { sector: "Agriculture", defaultRate: 4.8, recoveryRate: 65, avgLoanSize: 18e6 },
  { sector: "Energy", defaultRate: 3.3, recoveryRate: 74, avgLoanSize: 95e6 },
  { sector: "Health & Education", defaultRate: 2.9, recoveryRate: 76, avgLoanSize: 25e6 },
];

// Tool definitions for GEMs Credit Risk Database
const tools: Tool[] = [
  {
    name: "get_default_rates",
    description:
      "Query default frequencies for emerging market lending by region. Returns default rates as percentage of loans that defaulted.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "Region name (e.g., 'global', 'east-asia', 'latin-america', 'sub-saharan-africa', 'south-asia', 'mena', 'europe-central-asia')",
        },
      },
      required: ["region"],
    },
  },
  {
    name: "get_recovery_rates",
    description:
      "Retrieve recovery rates for defaulted loans showing what percentage of defaulted loan value was recovered.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "Region name (e.g., 'global', 'east-asia', 'latin-america')",
        },
      },
      required: ["region"],
    },
  },
  {
    name: "query_credit_risk",
    description:
      "Get comprehensive credit risk statistics for a region including default rates, recovery rates, loan volumes, and number of loans.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "Region identifier",
        },
      },
      required: ["region"],
    },
  },
  {
    name: "get_sector_analysis",
    description:
      "Analyze credit risk performance by economic sector. Returns default rates, recovery rates, and average loan sizes across different sectors.",
    inputSchema: {
      type: "object",
      properties: {
        sector: {
          type: "string",
          description: "Economic sector (optional). If not provided, returns all sectors. Options: 'Financial Services', 'Infrastructure', 'Manufacturing', 'Services', 'Agriculture', 'Energy', 'Health & Education'",
        },
      },
      required: [],
    },
  },
  {
    name: "compare_regions",
    description:
      "Compare credit risk metrics across multiple regions to identify relative risk profiles.",
    inputSchema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          description: "Metric to compare: 'default-rate', 'recovery-rate', or 'both'",
          enum: ["default-rate", "recovery-rate", "both"],
        },
      },
      required: ["metric"],
    },
  },
];

// Server implementation
const server = new Server(
  {
    name: "gems-risk-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_default_rates") {
      const region = (args.region as string).toLowerCase();
      const data = mockCreditData[region];

      if (!data) {
        return {
          content: [
            {
              type: "text",
              text: `No data available for region: ${args.region}. Available regions: ${Object.keys(mockCreditData).join(", ")}`,
            },
          ],
        };
      }

      const result = `# Default Rates for ${data.region}\n\n**Default Rate:** ${data.defaultRate}%\n\n**Period:** ${data.period}\n\n**Context:** Out of ${data.numberOfLoans.toLocaleString()} loans totaling $${(data.totalVolume / 1e9).toFixed(1)} billion USD, ${data.defaultRate}% resulted in default.\n\nThis represents one of the lowest default rates globally, challenging the perception of emerging markets as high-risk destinations.`;

      return {
        content: [{ type: "text", text: result }],
      };
    }

    if (name === "get_recovery_rates") {
      const region = (args.region as string).toLowerCase();
      const data = mockCreditData[region];

      if (!data) {
        return {
          content: [
            {
              type: "text",
              text: `No data available for region: ${args.region}. Available regions: ${Object.keys(mockCreditData).join(", ")}`,
            },
          ],
        };
      }

      const result = `# Recovery Rates for ${data.region}\n\n**Recovery Rate:** ${data.recoveryRate}%\n\n**Period:** ${data.period}\n\n**Analysis:** When loans default in ${data.region}, lenders recover an average of ${data.recoveryRate}% of the loan value.\n\nThis recovery rate is calculated based on ${data.numberOfLoans.toLocaleString()} loans worth $${(data.totalVolume / 1e9).toFixed(1)} billion USD.`;

      return {
        content: [{ type: "text", text: result }],
      };
    }

    if (name === "query_credit_risk") {
      const region = (args.region as string).toLowerCase();
      const data = mockCreditData[region];

      if (!data) {
        return {
          content: [
            {
              type: "text",
              text: `No data available for region: ${args.region}. Available regions: ${Object.keys(mockCreditData).join(", ")}`,
            },
          ],
        };
      }

      const result = `# Credit Risk Profile: ${data.region}\n\n## Key Metrics\n\n**Default Rate:** ${data.defaultRate}%\n**Recovery Rate:** ${data.recoveryRate}%\n**Number of Loans:** ${data.numberOfLoans.toLocaleString()}\n**Total Loan Volume:** $${(data.totalVolume / 1e9).toFixed(1)} billion USD\n**Data Period:** ${data.period}\n\n## Risk Assessment\n\n**Expected Loss:** ${(data.defaultRate * (100 - data.recoveryRate) / 100).toFixed(2)}%\n\nThe expected loss rate represents the percentage of loan value expected to be lost after accounting for both defaults and recoveries.\n\n## Insights\n\nWith a ${data.defaultRate}% default rate and ${data.recoveryRate}% recovery rate, ${data.region} demonstrates ${data.defaultRate < 4 ? "strong" : "moderate"} credit performance for emerging market lending.`;

      return {
        content: [{ type: "text", text: result }],
      };
    }

    if (name === "get_sector_analysis") {
      const sector = args.sector as string;

      if (sector) {
        const sectorData = mockSectorData.find(s => s.sector === sector);
        if (!sectorData) {
          return {
            content: [
              {
                type: "text",
                text: `Sector not found: ${sector}. Available sectors: ${mockSectorData.map(s => s.sector).join(", ")}`,
              },
            ],
          };
        }

        const result = `# Sector Analysis: ${sectorData.sector}\n\n**Default Rate:** ${sectorData.defaultRate}%\n**Recovery Rate:** ${sectorData.recoveryRate}%\n**Average Loan Size:** $${(sectorData.avgLoanSize / 1e6).toFixed(1)} million USD\n\n**Expected Loss:** ${(sectorData.defaultRate * (100 - sectorData.recoveryRate) / 100).toFixed(2)}%\n\n## Risk Profile\n\nThe ${sectorData.sector} sector shows ${sectorData.defaultRate < 3.5 ? "below-average" : "above-average"} default risk compared to the overall emerging markets default rate of 3.5%.`;

        return {
          content: [{ type: "text", text: result }],
        };
      }

      // Return all sectors
      let result = `# Credit Risk by Sector - Emerging Markets\n\n`;
      result += `| Sector | Default Rate | Recovery Rate | Avg Loan Size | Expected Loss |\n`;
      result += `|--------|--------------|---------------|---------------|---------------|\n`;

      mockSectorData
        .sort((a, b) => a.defaultRate - b.defaultRate)
        .forEach((s) => {
          const expectedLoss = (s.defaultRate * (100 - s.recoveryRate) / 100).toFixed(2);
          result += `| ${s.sector} | ${s.defaultRate}% | ${s.recoveryRate}% | $${(s.avgLoanSize / 1e6).toFixed(1)}M | ${expectedLoss}% |\n`;
        });

      result += `\n**Expected Loss** = Default Rate × (1 - Recovery Rate)\n\n`;
      result += `## Key Insights\n\n`;
      result += `- Lowest risk: **${mockSectorData.reduce((min, s) => s.defaultRate < min.defaultRate ? s : min).sector}** (${mockSectorData.reduce((min, s) => s.defaultRate < min.defaultRate ? s : min).defaultRate}% default rate)\n`;
      result += `- Highest risk: **${mockSectorData.reduce((max, s) => s.defaultRate > max.defaultRate ? s : max).sector}** (${mockSectorData.reduce((max, s) => s.defaultRate > max.defaultRate ? s : max).defaultRate}% default rate)\n`;
      result += `- Best recovery: **${mockSectorData.reduce((max, s) => s.recoveryRate > max.recoveryRate ? s : max).sector}** (${mockSectorData.reduce((max, s) => s.recoveryRate > max.recoveryRate ? s : max).recoveryRate}% recovery)\n`;

      return {
        content: [{ type: "text", text: result }],
      };
    }

    if (name === "compare_regions") {
      const metric = args.metric as string;

      let result = `# Regional Credit Risk Comparison\n\n`;

      if (metric === "default-rate" || metric === "both") {
        result += `## Default Rates by Region\n\n`;
        const sorted = Object.values(mockCreditData).sort((a, b) => a.defaultRate - b.defaultRate);
        sorted.forEach((region, idx) => {
          result += `${idx + 1}. **${region.region}:** ${region.defaultRate}%\n`;
        });
        result += `\n`;
      }

      if (metric === "recovery-rate" || metric === "both") {
        result += `## Recovery Rates by Region\n\n`;
        const sorted = Object.values(mockCreditData).sort((a, b) => b.recoveryRate - a.recoveryRate);
        sorted.forEach((region, idx) => {
          result += `${idx + 1}. **${region.region}:** ${region.recoveryRate}%\n`;
        });
        result += `\n`;
      }

      result += `## Key Findings\n\n`;
      result += `The data demonstrates that emerging markets show significant variation in credit risk profiles, with some regions performing better than developed market averages.\n\n`;
      result += `**Note:** Based on ${Object.values(mockCreditData).reduce((sum, r) => sum + r.numberOfLoans, 0).toLocaleString()} loans across 29 development banks over 31 years (1998-2024).`;

      return {
        content: [{ type: "text", text: result }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool: ${error}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GEMs Risk MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
