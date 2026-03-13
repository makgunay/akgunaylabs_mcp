# Akgunay Labs MCP Repository

This repository contains Model Context Protocol (MCP) servers developed by Akgunay Labs.

## What is MCP?

Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to Large Language Models (LLMs). MCP servers expose data and functionality to LLM clients through a standardized interface.

## Available MCPs

### 1. GEMs Risk Database MCP

Located in `gems-risk-mcp/`

A Model Context Protocol server that provides access to the GEMs (Global Emerging Markets) Risk Database from the World Bank, enabling AI assistants to query and analyze credit risk data for emerging market lending.

**Features:**
- Query default rates and recovery rates by region
- Analyze credit risk by economic sector
- Compare credit performance across emerging markets
- Access comprehensive risk statistics from 29 development banks
- Retrieve data covering $425+ billion in loans across 31 years

## Repository Structure

```
akgunaylabs_mcp/
├── README.md (this file)
├── USAGE_GUIDE.md
├── .gitignore
└── gems-risk-mcp/          # GEMs Risk Database MCP
    ├── app/                 # Next.js App Router
    │   ├── api/gems-risk/   # MCP server endpoint
    │   ├── page.tsx         # Landing page
    │   └── gems-risk/       # Documentation page
    ├── package.json
    ├── next.config.js
    └── README.md
```

## Getting Started

Each MCP server is in its own directory with its own README and setup instructions. Navigate to the specific MCP folder to get started.

The server is deployed at [mcp.akgunaylabs.io](https://mcp.akgunaylabs.io).

## Contributing

This repository is maintained by Akgunay Labs for research and development purposes.

## License

See individual MCP folders for specific licensing information.
