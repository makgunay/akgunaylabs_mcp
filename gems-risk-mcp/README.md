# GEMs Risk Database MCP

A Model Context Protocol (MCP) server that provides access to the GEMs (Global Earthquake Model) Risk Database.

## Overview

This MCP server enables AI assistants to query and analyze global earthquake risk data from the GEMs Risk Database. It provides structured access to hazard, exposure, vulnerability, and risk information for regions worldwide.

## Features

- **Risk Data Queries**: Query earthquake risk metrics by region, country, or coordinates
- **Hazard Information**: Access seismic hazard data and ground motion parameters
- **Exposure Data**: Retrieve building inventory and population exposure information
- **Vulnerability Metrics**: Access vulnerability functions and fragility curves
- **Loss Estimations**: Calculate and retrieve expected loss metrics

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

1. **query_risk_data**: Query earthquake risk data by location
2. **get_hazard_info**: Retrieve seismic hazard information
3. **get_exposure_data**: Access building and population exposure data
4. **calculate_loss**: Calculate expected losses for a given scenario

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

#### query_risk_data

Query earthquake risk data for a specific location.

**Parameters:**
- `location` (string): Country, region, or city name
- `metric` (string, optional): Specific risk metric to retrieve

**Returns:** Risk data including expected annual losses and probability metrics

#### get_hazard_info

Retrieve seismic hazard information for a location.

**Parameters:**
- `location` (string): Location identifier
- `return_period` (number, optional): Return period in years (default: 475)

**Returns:** Hazard curves, ground motion values, and spectral data

## Data Source

This MCP server interfaces with the GEMs Risk Database, which provides comprehensive global earthquake risk information. For more information about the GEMs project, visit [https://www.globalquakemodel.org/](https://www.globalquakemodel.org/)

## License

MIT

## Contributing

This is a research project by Akgunay Labs. Contributions and feedback are welcome.

## Support

For issues and questions, please open an issue in the main repository.
