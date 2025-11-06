# IFC GEMs Risk MCP Server

**Access emerging markets credit risk data through your AI assistant**

The IFC GEMs Risk MCP (Model Context Protocol) server provides real-time access to the World Bank's IFC Global Emerging Markets (GEMs) Risk Database—a comprehensive source of credit risk analytics for emerging market lending.

---

## 🎯 What It Does

This MCP server enables AI assistants (like Claude) to query credit risk data for emerging markets across three economic sectors:

- **Sovereign** - National government debt and sovereign bonds (lowest risk)
- **Public Sector** - Sub-sovereign entities and state-owned enterprises (SOEs)
- **Private Sector** - Corporate and private sector lending (largest dataset)

You can analyze default rates, recovery rates, expected losses, and historical trends across 7 global regions, 15 economic sectors, and 40+ years of data.

---

## 💡 Use Cases

### For Financial Analysts
- **Portfolio Risk Assessment** - Evaluate credit risk for emerging market portfolios
- **Regional Comparison** - Compare default and recovery rates across regions
- **Sector Analysis** - Identify high-risk vs low-risk economic sectors
- **Country Risk** - Assess sovereign debt default probabilities

### For Development Finance
- **Project Evaluation** - Analyze historical performance by project type (infrastructure, manufacturing, etc.)
- **Seniority Analysis** - Compare senior vs subordinated debt recovery rates
- **Time Series Trends** - Track how credit risk has evolved over decades

### For Research & Education
- **Emerging Markets Research** - Access authoritative IFC credit risk data
- **Historical Analysis** - Study credit cycles from 1984-2024
- **Risk Modeling** - Use real-world data for credit risk models

---

## 🔧 How to Connect

### Prerequisites
- Claude Desktop (or any MCP-compatible client)
- The deployed MCP server URL (provided by your administrator)

### Configuration Steps

#### Option 1: Claude Desktop (Recommended)

1. **Open Claude Desktop configuration file:**
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux:** `~/.config/Claude/claude_desktop_config.json`

2. **Add the GEMs Risk server:**

```json
{
  "mcpServers": {
    "gems-risk": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://YOUR-SERVER-URL/api/mcp"
      ]
    }
  }
}
```

3. **Replace `YOUR-SERVER-URL`** with the actual server URL provided to you

4. **Restart Claude Desktop**

#### Option 2: Direct HTTP Connection

If your MCP client supports direct HTTP connections:

```json
{
  "mcpServers": {
    "gems-risk": {
      "url": "https://YOUR-SERVER-URL/api/mcp",
      "transport": "streamable-http"
    }
  }
}
```

---

## 📊 Available Tools

The server provides **9 specialized tools** for querying credit risk data:

### 1. `get_default_rates`
Query average default frequencies by region

**Example:**
```
What's the default rate for Latin America?
```

### 2. `get_recovery_rates`
Retrieve recovery rates for defaulted loans

**Example:**
```
What percentage do lenders recover in Sub-Saharan Africa when defaults occur?
```

### 3. `query_credit_risk`
Comprehensive credit risk profile with default, recovery, and expected loss

**Example:**
```
Show me the complete credit risk profile for MENA region
```

### 4. `compare_regions`
Compare default and recovery rates across all regions

**Example:**
```
Compare default rates across all regions for sovereign debt
```

### 5. `get_sector_analysis`
Analyze credit performance by economic sector (manufacturing, construction, etc.)

**Example:**
```
What's the default rate for infrastructure projects in East Asia?
```

### 6. `get_project_type_analysis`
Compare credit risk across project types (greenfield, expansion, privatization)

**Example:**
```
Compare greenfield vs expansion projects in terms of credit risk
```

### 7. `get_time_series`
Track default and recovery rates over time

**Example:**
```
Show me the 10-year default rate trend for South Asia
```

### 8. `get_seniority_analysis`
Compare senior vs subordinated debt recovery rates

**Example:**
```
How much better do senior loans perform than subordinated debt?
```

### 9. `query_multidimensional`
Advanced multi-dimensional queries across sector, project type, and seniority

**Example:**
```
What's the default rate for senior infrastructure loans in Latin America?
```

---

## 🌍 Coverage

### Geographic Regions
- **Global** - Worldwide aggregate
- **East Asia & Pacific** (EAP)
- **Latin America & Caribbean** (LAC)
- **Sub-Saharan Africa** (SSA)
- **South Asia** (SAR)
- **Middle East & North Africa** (MENA)
- **Europe & Central Asia** (ECA)

### Economic Sectors (15 total)
Agriculture, Manufacturing, Construction, Utilities, Commerce, Transportation, Financial Institutions, Health/Education, Infrastructure, Mining, Oil & Gas, Services, Telecom, Tourism, and more.

### Project Types
Greenfield, Expansion, Modernization, Privatization, Financial Restructuring, and more.

### Data Sources (3 Economic Sectors)

All tools accept an optional `data_source` parameter:

- **`"sovereign"`** - National government debt (0.77% default rate, 95% recovery)
- **`"public"`** - Sub-sovereign/SOE lending (1.89% default rate, 93% recovery)
- **`"private"`** - Corporate lending (3.39% default rate, 72% recovery) - **Most common**

**Default:** If not specified, queries use `"public"` sector data for backward compatibility.

---

## 📈 Data Source

### World Bank IFC GEMs Database

- **Source:** World Bank Data360 API
- **Dataset:** IFC_GEM (Global Emerging Markets Risk Database)
- **Authority:** International Finance Corporation (IFC) - World Bank Group
- **Coverage:** 40+ years of emerging market credit data (1984-2024)
- **Data Points:** 8,000+ default and recovery observations

### Data Quality

- **Real-time:** Live API connection to World Bank servers
- **Authoritative:** Official IFC development finance data
- **Comprehensive:** Covers sovereign, public, and private sector lending
- **Historical:** Decades of credit cycle data for trend analysis

---

## 💬 Example Queries

Once connected, you can ask Claude natural questions like:

### Basic Queries
```
What's the default rate in Latin America?
What's the recovery rate for sovereign debt in MENA?
Show me credit risk statistics for East Asia
```

### Comparative Analysis
```
Compare default rates across all regions
Which region has the highest recovery rates for private sector lending?
Compare sovereign vs corporate default risk in Sub-Saharan Africa
```

### Sector-Specific
```
What's the default rate for infrastructure projects?
How risky is manufacturing sector lending in South Asia?
Compare construction vs utilities sector credit risk
```

### Time Series
```
Show me the 10-year default rate trend for global emerging markets
How has MENA's recovery rate changed over the last 5 years?
Track sovereign default rates from 2014-2024
```

### Advanced Queries
```
What's the recovery rate for senior infrastructure debt in Latin America?
Compare greenfield vs expansion projects for default risk
Analyze subordinated debt recovery across all regions
```

---

## 🔍 Understanding the Metrics

### Default Rate (ADR)
**What it is:** Percentage of loans that default (fail to repay)
**Interpretation:** Lower is better. 1% means 1 in 100 loans default.
**Range:** Typically 0.5% - 5% for emerging markets

### Recovery Rate (ARR)
**What it is:** Percentage of loan value recovered when defaults occur
**Interpretation:** Higher is better. 80% means lenders recover 80 cents per dollar.
**Range:** Typically 50% - 95% for emerging markets

### Expected Loss
**What it is:** Combined measure accounting for both default probability and loss severity
**Calculation:** `Default Rate × (1 - Recovery Rate)`
**Interpretation:** Overall expected loss on a portfolio. Lower is better.

**Example (MENA Region - Private Sector):**
- Default Rate: 3.39%
- Recovery Rate: 71.70%
- Expected Loss: 3.39% × (1 - 0.717) = **0.96%**

---

## 🚀 Quick Start Examples

### Example 1: Regional Risk Comparison

**You ask Claude:**
```
Compare the credit risk across all emerging market regions
```

**Claude uses:**
- `compare_regions` tool with default and recovery metrics
- Automatically formats the comparison table
- Highlights high-risk vs low-risk regions

### Example 2: Sector Deep-Dive

**You ask Claude:**
```
I'm considering infrastructure lending in Latin America. What's the credit risk?
```

**Claude uses:**
- `get_sector_analysis` for infrastructure sector in LAC region
- `get_seniority_analysis` to show senior vs subordinated performance
- Provides context comparing to other sectors

### Example 3: Historical Trend Analysis

**You ask Claude:**
```
Has credit risk in emerging markets improved over the last decade?
```

**Claude uses:**
- `get_time_series` for 10-year global data
- Analyzes default and recovery rate trends
- Summarizes key changes and turning points

---

## 🎓 Tips for Best Results

### Be Specific About Data Source
When querying, specify which economic sector you're interested in:
```
What's the sovereign default rate in MENA?
Show me private sector credit risk for East Asia
Analyze public sector lending in Sub-Saharan Africa
```

### Combine Tools for Rich Analysis
Claude can chain multiple tools together:
```
Compare infrastructure vs manufacturing credit risk across all regions,
then show me the 5-year trend for the riskiest combination
```

### Use Natural Language
You don't need to know the technical parameters:
```
❌ Don't say: "Use get_sector_analysis with REF_AREA=LAC and SECTOR=IFR"
✅ Instead say: "What's the default rate for infrastructure in Latin America?"
```

---

## 🔐 Data Privacy & Security

- **No authentication required** - World Bank data is publicly available
- **No data storage** - Queries fetch real-time data from World Bank API
- **No personal information** - All data is aggregated regional/sectoral statistics
- **Read-only access** - The MCP can only read data, not modify anything

---

## 📚 Additional Resources

### World Bank / IFC Resources
- **IFC GEMs Database:** [World Bank Data360](https://data360.worldbank.org)
- **IFC Development Impact:** [IFC.org](https://www.ifc.org)
- **Emerging Markets Research:** [World Bank Open Data](https://data.worldbank.org)

### Model Context Protocol (MCP)
- **MCP Specification:** [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Claude Desktop Setup:** [docs.anthropic.com](https://docs.anthropic.com)

---

## 🐛 Troubleshooting

### "Tool not found" errors
- Verify the MCP server is correctly configured in your client
- Restart your MCP client (e.g., Claude Desktop)
- Check that the server URL is correct

### Slow responses
- First query may take 2-3 seconds (World Bank API connection)
- Subsequent queries are faster (server warm-up)
- This is normal for real-time API data

### "No data available" responses
- World Bank API may be temporarily unavailable
- The server has automatic fallback to cached data
- Try again in a few moments

### Connection issues
- Verify your internet connection
- Check that the server URL is accessible
- Contact your administrator for server status

---

## 📞 Support

### For Users
- Contact your MCP server administrator for connection issues
- Check this README for tool usage and examples

### For Administrators
- Review server logs for API or connection errors
- Verify World Bank API accessibility: `curl https://data360api.worldbank.org/data360/data?DATABASE_ID=IFC_GEM`
- Check MCP server health endpoint

---

## 📖 Version Information

**Current Version:** 2.0
**Data Coverage:** 1984-2024 (40 years)
**Tools Available:** 9
**Supported Regions:** 7
**Economic Sectors:** 15
**Data Sources:** 3 (Sovereign, Public, Private)
**Total Indicators:** 6 of 11 implemented (54.5% coverage)

---

## ✨ What's New in Version 2.0

- ✅ **Three Economic Sectors** - Added sovereign and private sector data sources
- ✅ **Enhanced Tool Coverage** - Expanded from 5 to 9 specialized tools
- ✅ **Smart Detection** - Automatic data source selection from query context
- ✅ **Time Series Analysis** - Multi-year trend tracking
- ✅ **Seniority Analysis** - Senior vs subordinated debt comparison
- ✅ **Multidimensional Queries** - Complex cross-sector analysis

---

**Ready to explore emerging markets credit risk? Connect the MCP server and start asking Claude your questions!**
