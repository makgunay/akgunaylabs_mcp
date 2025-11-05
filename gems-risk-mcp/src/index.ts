#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Sample data structure for GEMs Risk Database
// In a real implementation, this would connect to the actual GEMs API or database
interface RiskData {
  location: string;
  expectedAnnualLoss: number;
  averageAnnualLoss: number;
  probabilisticLoss: {
    returnPeriod: number;
    loss: number;
  }[];
}

interface HazardData {
  location: string;
  returnPeriod: number;
  peakGroundAcceleration: number;
  spectralAcceleration: {
    period: number;
    value: number;
  }[];
}

// Mock data for demonstration
const mockRiskData: Record<string, RiskData> = {
  turkey: {
    location: "Turkey",
    expectedAnnualLoss: 2.5e9,
    averageAnnualLoss: 2.3e9,
    probabilisticLoss: [
      { returnPeriod: 100, loss: 15e9 },
      { returnPeriod: 475, loss: 45e9 },
      { returnPeriod: 2475, loss: 120e9 },
    ],
  },
  california: {
    location: "California, USA",
    expectedAnnualLoss: 4.8e9,
    averageAnnualLoss: 4.5e9,
    probabilisticLoss: [
      { returnPeriod: 100, loss: 25e9 },
      { returnPeriod: 475, loss: 80e9 },
      { returnPeriod: 2475, loss: 200e9 },
    ],
  },
  japan: {
    location: "Japan",
    expectedAnnualLoss: 6.2e9,
    averageAnnualLoss: 5.9e9,
    probabilisticLoss: [
      { returnPeriod: 100, loss: 35e9 },
      { returnPeriod: 475, loss: 95e9 },
      { returnPeriod: 2475, loss: 250e9 },
    ],
  },
};

// Tool definitions
const tools: Tool[] = [
  {
    name: "query_risk_data",
    description:
      "Query earthquake risk data for a specific location. Returns expected annual losses, average annual losses, and probabilistic loss estimates for different return periods.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Country, region, or city name (e.g., 'Turkey', 'California', 'Japan')",
        },
        metric: {
          type: "string",
          description: "Specific metric to retrieve (optional): 'aal' (average annual loss), 'eal' (expected annual loss), or 'probabilistic'",
          enum: ["aal", "eal", "probabilistic", "all"],
        },
      },
      required: ["location"],
    },
  },
  {
    name: "get_hazard_info",
    description:
      "Retrieve seismic hazard information for a location, including peak ground acceleration and spectral acceleration values.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Location identifier",
        },
        return_period: {
          type: "number",
          description: "Return period in years (default: 475)",
        },
      },
      required: ["location"],
    },
  },
  {
    name: "get_exposure_data",
    description:
      "Access building inventory and population exposure data for a specific location.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Location identifier",
        },
        data_type: {
          type: "string",
          description: "Type of exposure data: 'buildings', 'population', or 'both'",
          enum: ["buildings", "population", "both"],
        },
      },
      required: ["location"],
    },
  },
  {
    name: "calculate_loss",
    description:
      "Calculate expected losses for a given earthquake scenario.",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Location identifier",
        },
        magnitude: {
          type: "number",
          description: "Earthquake magnitude (Mw)",
        },
        depth: {
          type: "number",
          description: "Earthquake depth in km (optional)",
        },
      },
      required: ["location", "magnitude"],
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
    if (name === "query_risk_data") {
      const location = (args.location as string).toLowerCase();
      const metric = (args.metric as string) || "all";

      const data = mockRiskData[location];
      if (!data) {
        return {
          content: [
            {
              type: "text",
              text: `No risk data available for location: ${args.location}. Available locations: ${Object.keys(mockRiskData).join(", ")}`,
            },
          ],
        };
      }

      let result = `# Earthquake Risk Data for ${data.location}\n\n`;

      if (metric === "eal" || metric === "all") {
        result += `**Expected Annual Loss (EAL):** $${(data.expectedAnnualLoss / 1e9).toFixed(2)} billion USD\n\n`;
      }

      if (metric === "aal" || metric === "all") {
        result += `**Average Annual Loss (AAL):** $${(data.averageAnnualLoss / 1e9).toFixed(2)} billion USD\n\n`;
      }

      if (metric === "probabilistic" || metric === "all") {
        result += `**Probabilistic Loss Estimates:**\n`;
        data.probabilisticLoss.forEach((item) => {
          result += `- ${item.returnPeriod}-year return period: $${(item.loss / 1e9).toFixed(2)} billion USD\n`;
        });
      }

      return {
        content: [{ type: "text", text: result }],
      };
    }

    if (name === "get_hazard_info") {
      const location = args.location as string;
      const returnPeriod = (args.return_period as number) || 475;

      // Mock hazard data
      const hazardData: HazardData = {
        location,
        returnPeriod,
        peakGroundAcceleration: 0.4 + Math.random() * 0.3,
        spectralAcceleration: [
          { period: 0.2, value: 0.8 + Math.random() * 0.4 },
          { period: 0.5, value: 0.6 + Math.random() * 0.3 },
          { period: 1.0, value: 0.4 + Math.random() * 0.2 },
          { period: 2.0, value: 0.2 + Math.random() * 0.1 },
        ],
      };

      let result = `# Seismic Hazard Information for ${location}\n\n`;
      result += `**Return Period:** ${returnPeriod} years\n\n`;
      result += `**Peak Ground Acceleration (PGA):** ${hazardData.peakGroundAcceleration.toFixed(2)}g\n\n`;
      result += `**Spectral Acceleration Values:**\n`;
      hazardData.spectralAcceleration.forEach((sa) => {
        result += `- Period ${sa.period}s: ${sa.value.toFixed(2)}g\n`;
      });

      return {
        content: [{ type: "text", text: result }],
      };
    }

    if (name === "get_exposure_data") {
      const location = args.location as string;
      const dataType = (args.data_type as string) || "both";

      let result = `# Exposure Data for ${location}\n\n`;

      if (dataType === "buildings" || dataType === "both") {
        result += `**Building Inventory:**\n`;
        result += `- Residential buildings: ${Math.floor(Math.random() * 500000 + 100000)}\n`;
        result += `- Commercial buildings: ${Math.floor(Math.random() * 50000 + 10000)}\n`;
        result += `- Industrial buildings: ${Math.floor(Math.random() * 20000 + 5000)}\n`;
        result += `- Total replacement value: $${(Math.random() * 200 + 50).toFixed(2)} billion USD\n\n`;
      }

      if (dataType === "population" || dataType === "both") {
        result += `**Population Exposure:**\n`;
        result += `- Total population: ${Math.floor(Math.random() * 10000000 + 1000000).toLocaleString()}\n`;
        result += `- Urban population: ${Math.floor(Math.random() * 7000000 + 500000).toLocaleString()}\n`;
        result += `- Population in high-risk zones: ${Math.floor(Math.random() * 2000000 + 100000).toLocaleString()}\n`;
      }

      return {
        content: [{ type: "text", text: result }],
      };
    }

    if (name === "calculate_loss") {
      const location = args.location as string;
      const magnitude = args.magnitude as number;
      const depth = (args.depth as number) || 10;

      // Simple mock calculation based on magnitude
      const baseLoss = Math.pow(10, magnitude - 3) * 1e9;
      const depthFactor = 1 - (depth - 10) / 100;
      const estimatedLoss = baseLoss * Math.max(0.5, depthFactor);

      let result = `# Loss Estimation for ${location}\n\n`;
      result += `**Scenario:**\n`;
      result += `- Magnitude: Mw ${magnitude}\n`;
      result += `- Depth: ${depth} km\n\n`;
      result += `**Estimated Losses:**\n`;
      result += `- Direct economic loss: $${(estimatedLoss / 1e9).toFixed(2)} billion USD\n`;
      result += `- Estimated casualties: ${Math.floor(estimatedLoss / 1e6)} people affected\n`;
      result += `- Buildings damaged: ${Math.floor(estimatedLoss / 1e5)}\n\n`;
      result += `*Note: This is a simplified estimation. Actual losses depend on many factors including building vulnerability, population density, and time of day.*\n`;

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
