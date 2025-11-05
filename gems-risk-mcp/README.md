# GEMs Risk Database MCP

A Model Context Protocol (MCP) server that provides access to the GEMs (Global Emerging Markets) Risk Database from the World Bank.

## Overview

This MCP server enables AI assistants to query and analyze credit risk data for emerging market lending. GEMs is one of the world's largest credit risk databases for emerging markets, pooling anonymized data from 29 Multilateral Development Banks and Development Finance Institutions across 31 years (1998-2024).

The database challenges conventional perceptions about emerging market risk by providing evidence-based statistics on default rates, recovery rates, and credit performance across regions and sectors.

## Features

- **Default Rate Analysis**: Query default frequencies by region and sector
- **Recovery Rate Statistics**: Access recovery rates for defaulted loans
- **Regional Comparisons**: Compare credit risk metrics across emerging market regions
- **Sector Analysis**: Analyze credit performance by economic sector
- **Comprehensive Risk Profiles**: Get complete credit risk assessments including expected loss calculations

## Key Statistics

- **Global Default Rate**: 3.5% (private sector lending)
- **Global Recovery Rate**: 73%
- **Data Coverage**: 15,420+ loans totaling $425+ billion USD
- **Geographic Coverage**: East Asia & Pacific, Latin America & Caribbean, Sub-Saharan Africa, South Asia, MENA, Europe & Central Asia

## Installation

```bash
npm install
npm run build
```

## Usage

### As an MCP Server

Configure your MCP client (such as Claude Desktop) to connect to this server:

```json
{
  "mcpServers": {
    "gems-risk": {
      "command": "node",
      "args": ["/path/to/gems-risk-mcp/dist/index.js"]
    }
  }
}
```

### Available Tools

The server provides the following tools:

1. **get_default_rates**: Query default frequencies for emerging market lending by region
2. **get_recovery_rates**: Retrieve recovery rates for defaulted loans
3. **query_credit_risk**: Get comprehensive credit risk statistics for a region
4. **get_sector_analysis**: Analyze credit risk performance by economic sector
5. **compare_regions**: Compare credit risk metrics across multiple regions

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Development mode (watch for changes)
npm run dev

# Start the server
npm start
```

## API Reference

### Tools

#### get_default_rates

Query default frequencies for emerging market lending by region.

**Parameters:**
- `region` (string): Region identifier (e.g., 'global', 'east-asia', 'latin-america', 'sub-saharan-africa', 'south-asia', 'mena', 'europe-central-asia')

**Returns:** Default rate percentage and context about loan volumes

#### get_recovery_rates

Retrieve recovery rates showing what percentage of defaulted loan value was recovered.

**Parameters:**
- `region` (string): Region identifier

**Returns:** Recovery rate percentage and analysis

#### query_credit_risk

Get comprehensive credit risk statistics for a region.

**Parameters:**
- `region` (string): Region identifier

**Returns:** Full risk profile including default rates, recovery rates, loan volumes, and expected loss calculations

#### get_sector_analysis

Analyze credit risk performance by economic sector.

**Parameters:**
- `sector` (string, optional): Economic sector name. If not provided, returns analysis for all sectors.

**Returns:** Sector-specific default rates, recovery rates, and average loan sizes

**Available Sectors:**
- Financial Services
- Infrastructure
- Manufacturing
- Services
- Agriculture
- Energy
- Health & Education

#### compare_regions

Compare credit risk metrics across multiple regions.

**Parameters:**
- `metric` (string): Metric to compare - 'default-rate', 'recovery-rate', or 'both'

**Returns:** Regional comparison rankings and key findings

## Data Source

This MCP server interfaces with the World Bank's Data360 platform, specifically the IFC_GEM dataset (Global Emerging Markets Risk Database). The database is a joint initiative between the International Finance Corporation (IFC) and the European Investment Bank (EIB), pooling credit data from major development finance institutions.

**Data Sources:**
- World Bank Data360: [https://data360.worldbank.org/en/dataset/IFC_GEM](https://data360.worldbank.org/en/dataset/IFC_GEM)
- IFC GEMs Consortium: [https://www.ifc.org/gems](https://www.ifc.org/en/what-we-do/sector-expertise/syndicated-loans-and-mobilization/global-emerging-markets-risk-database-consortium)

## About GEMs

The Global Emerging Markets Risk Database (GEMs) was established in 2009 to address the lack of comprehensive credit risk data for emerging markets. By pooling anonymized loan data from 29 major development banks, GEMs provides evidence that challenges the conventional view of emerging markets as uniformly high-risk destinations for investment.

**Key Findings from GEMs:**
- Default rates in emerging markets are lower than commonly perceived
- Recovery rates are substantially higher than many investors assume
- Credit performance varies significantly by region and sector
- Emerging market lending can demonstrate strong risk-adjusted returns

## License

MIT

## Contributing

This is a research project by Akgunay Labs. Contributions and feedback are welcome.

## Support

For issues and questions, please open an issue in the main repository.
