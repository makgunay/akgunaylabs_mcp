# IFC GEMs Risk MCP Server

**Access emerging markets credit risk data through your AI assistant**

The IFC GEMs Risk MCP (Model Context Protocol) server provides real-time access to the World Bank's IFC Global Emerging Markets (GEMs) Risk Database—a comprehensive source of credit risk analytics for emerging market lending.

---

## 🎯 What It Does

This MCP server enables AI assistants (like Claude) to query credit risk data for emerging markets across three economic sectors:

- **Sovereign** - National government debt and sovereign bonds (lowest risk)
- **Public Sector** - Sub-sovereign entities and state-owned enterprises (SOEs)
- **Private Sector** - Corporate and private sector lending (largest dataset)

You can analyze default rates, recovery rates, expected losses, and historical trends across 7 regions, 22 sector categories (IFC + GICS + mixed), 6 project types, and debt seniority, with annual history back to 1984 (sovereign) and 1994 (public and private).

---

## 💡 Use Cases

### For Financial Analysts
- **Portfolio Risk Assessment** - Evaluate credit risk for emerging market portfolios
- **Regional Comparison** - Compare default and recovery rates across regions
- **Sector Analysis** - Identify high-risk vs low-risk economic sectors
- **Country Risk** - Assess sovereign debt default probabilities

### For Development Finance
- **Project Evaluation** - Analyze historical performance by financing type (project finance, corporate finance, structured finance, etc.)
- **Seniority Analysis** - Compare senior vs subordinated debt recovery rates
- **Time Series Trends** - Track how credit risk has evolved over decades

### For Research & Education
- **Emerging Markets Research** - Access authoritative IFC credit risk data
- **Historical Analysis** - Study credit cycles from 1984 (sovereign) / 1994 (public, private) to 2025
- **Risk Modeling** - Use real-world data for credit risk models

---

## 🔧 How to Connect

### Prerequisites
- Claude Desktop (or any MCP-compatible client)

### MCP Server URL
```
https://mcp.akgunaylabs.io/api/gems-risk/mcp
```

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
        "https://mcp.akgunaylabs.io/api/gems-risk/mcp"
      ]
    }
  }
}
```

3. **Restart Claude Desktop**

#### Option 2: Direct HTTP Connection

If your MCP client supports direct HTTP connections:

```json
{
  "mcpServers": {
    "gems-risk": {
      "url": "https://mcp.akgunaylabs.io/api/gems-risk/mcp",
      "transport": "streamable-http"
    }
  }
}
```

---

## 📊 Available Tools

The server provides **13 specialized tools** for querying credit risk data. `region` parameters accept the 7 regions and 4 World Bank income groups (`high-income`, `upper-middle-income`, `lower-middle-income`, `low-income`). Default rates come with their 90% confidence interval where GEMs publishes one.

**Structured output:** every tool returns, alongside the markdown answer, a JSON `structuredContent` object described by its `outputSchema`: `status` (`ok`, `no_data`, `invalid_input`, `error`), `data_source`, publication `vintage`, Data360 `indicators`, effective `filters`, `records` (one per region, sector, project type, seniority level, loan currency or year, with `default_rate`/`recovery_rate` as `{ value_pct, candidates_pct, method }`, confidence interval, recovery distribution, expected loss and sample counts; `sovereign_benchmark_pct`, `total_spread` and `loss_rate` for the benchmark and spread tools) and `notes` (the same warnings as the ⚠️ lines in the text). `candidates_pct` lists every value Data360 returned for the key; more than one means the breakdown was ambiguous and `method` tells how the shown value was chosen.

### 1. `get_default_rates`
Query average default rates by region or income group, with confidence interval and sample size

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
Rank regions, income groups (`grouping: "income"`) or countries (`grouping: "country"`) by default and/or recovery rate, with sample sizes

**Example:**
```
Compare default rates across all regions for sovereign debt
Rank countries by private sector default rate
```

### 5. `get_sector_analysis`
Default and recovery rates by sector (IFC categories such as banking, infrastructure, renewables; GICS sectors such as energy, utilities) for a region (`region`, default global). Private sector data is published per region; public sector data only globally; income groups have no sector breakdown.

**Example:**
```
What's the private sector default rate for infrastructure lending?
Compare sectors in Latin America
```

### 6. `get_project_type_analysis`
Compare credit risk across financing types (corporate finance, project finance, financial institutions, structured finance, real estate finance)

**Example:**
```
Compare project finance vs corporate finance in terms of credit risk
```

### 7. `get_time_series`
Track annual default or recovery rates over time, optionally for one sector (`sector`, e.g. infrastructure; sector history is published for the global aggregate only)

**Example:**
```
Show me the 10-year default rate trend for South Asia
How has the infrastructure default rate evolved since 2010?
```

### 8. `get_seniority_analysis`
Compare recovery rates by seniority (senior secured, senior unsecured, subordinated; global level)

**Example:**
```
How much better do senior loans perform than subordinated debt?
```

### 9. `query_multidimensional`
Combine region, sector, and project type filters (most multi-filter combinations are not published)

**Example:**
```
What's the private sector default rate for energy companies globally?
```

### 10. `get_country_risk`
Country profile: default rate with confidence interval, recovery rate, expected loss, sample size, sector breakdown and annual default rates. Accepts ISO3 codes or English names; private sector data covers 90 countries, public sector 14, sovereign none. Defaults to `data_source: "private"`.

**Example:**
```
What's the credit risk of lending to Kenyan companies?
```

Recovery tools (`get_recovery_rates`, `query_credit_risk`, `get_country_risk`) also show the recovery distribution (10th, 25th, median, 75th and 90th percentile) where Data360 publishes a single one for the breakdown.

### 11. `get_currency_analysis`
Default and recovery rates by loan currency: foreign currency, local currency, pegged local currency, mixed currency. Per region for private and public data; sovereign lending and income groups have no currency split.

**Example:**
```
Are local-currency loans riskier than foreign-currency loans in Sub-Saharan Africa?
```

### 12. `get_sovereign_benchmark`
GEMs default rate per region and income group next to the S&P default rate of sovereigns with the same rating as the project's country (`IFC_GEM_DRVSVG`). The global aggregate is omitted because Data360 returns several values for it.

**Example:**
```
Do GEMs loans default more or less often than sovereign ratings imply?
```

### 13. `get_spreads_and_losses`
Average total spread and average loss rate (default rate × (1 − recovery rate)) of private sector lending, overall and by currency, project type and seniority (`IFC_GEM_PR_RTNS`, global only). Values Data360 dates outside the publication vintage are flagged and not shown.

**Example:**
```
How do spreads compare with loss rates for project finance vs corporate finance?
```

---

## 🌍 Coverage

### Geographic Regions
- **Global** - Worldwide aggregate
- **East Asia & Pacific** (EAP)
- **Latin America & Caribbean** (LAC)
- **Sub-Saharan Africa** (SSA)
- **South Asia** (SAR)
- **Middle East, North Africa, Afghanistan & Pakistan** (`mena`; World Bank region `MEA`, which includes Afghanistan and Pakistan)
- **Europe & Central Asia** (ECA)

### Income Groups
High, upper-middle, lower-middle and low income (World Bank classification).

### Countries
90 countries for private sector lending (default rates, with recoveries for 55), 14 for public sector lending.

### Sectors (22 categories)
IFC categories: Banking, Financial Institutions, Non-banking Financial Institutions, Non-financial Institutions, Infrastructure, Renewables, Services, Mixed. GICS sectors: Financials, Utilities, Industrials, Consumer Staples, Consumer Discretionary, Materials, Communication Services, Health Care, Energy, Real Estate, Information Technology, Administration, Others. Private lending sectors are also published per region and for many countries — use `get_sector_analysis` with `region`, `query_multidimensional` (e.g. infrastructure in Latin America) or `get_country_risk`; public sector data is global only, and sovereign data has no sector split. Labels follow the Data360 dimensions API (`POST /data360/portal/v1/dimensions`).

### Project Types
Corporate Finance, Project Finance, Financial Institutions, Structured Finance, Real Estate Finance (private), Other (public recovery only).

### Data Sources (3 Economic Sectors)

All tools accept an optional `data_source` parameter:

- **`"sovereign"`** - Sovereign and sovereign-guaranteed debt (0.79% default rate, 1984–2025)
- **`"public"`** - Sub-sovereign/SOE lending (1.92% default rate, 80.35% recovery)
- **`"private"`** - Corporate lending (3.45% default rate, 69.75% recovery) - **largest sample**

Figures are the global averages from the 2025 GEMs publication on Data360.

**Default:** If not specified, queries use "private" sector data: the largest sample, the only source published by region × sector, and the broadest country coverage (90 countries vs. 14 for public).

**Migration note:** every tool except `get_country_risk` (which already defaulted to "private") used to default to "public". Clients that omit `data_source` now receive private sector figures; set `data_source: "public"` explicitly to keep the previous behavior.

---

## 📈 Data Source

### World Bank IFC GEMs Database

- **Source:** World Bank Data360 API
- **Dataset:** IFC_GEM (Global Emerging Markets Risk Database)
- **Authority:** International Finance Corporation (IFC) - World Bank Group
- **Coverage:** sovereign 1984–2025, public and private sector 1994–2025 (2025 publication vintage)
- **Units:** rates in percent; signed amounts in EUR millions, as published by GEMs

### How the server reads Data360

- **Snapshot vs. history:** `IFC_GEM_SD/PBD/PRD` (defaults) and `IFC_GEM_SR/PBR/PRR` (recoveries) hold one `TIME_PERIOD` — the publication vintage — with period averages. Annual values come from the `_H` indicators. The server always reads the latest vintage present, so a new publication is picked up without code changes.
- **Global aggregate:** `REF_AREA=WLD`.
- **Hidden breakdowns:** some snapshot rows are split by dimensions the Data360 API neither returns nor filters (e.g. credit enhancement), so one query can match several values. Default rates resolve exactly: the headline equals defaults ÷ observations of the full sample. Recovery rates use the period average reconstructed from the annual series (exact for global totals), else the value at published precision, else the first listed. Single-value responses list every value Data360 returned; ranking and breakdown tables mark ambiguous rates with † (resolved) or ‡ (uncertain).
- **Confidence intervals:** Data360 publishes some regional sector intervals with lower and upper bounds swapped; the server orders them.
- **Reliability:** responses are cached for an hour per instance; timeouts, network errors and 5xx responses are retried once; if a refresh fails, the last good response is served.

## 🧪 Development

```bash
npm test     # regression tests on real Data360 rows (lib/gems-risk/__fixtures__)
npm run dev  # MCP endpoint at http://localhost:3000/api/gems-risk/mcp
```

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
What's the default rate for infrastructure lending?
Which GICS sectors have the highest private sector default rates?
Compare banking vs utilities sector credit risk
```

### Time Series
```
Show me the 10-year default rate trend for global emerging markets
How has MENA's recovery rate changed over the last 5 years?
Track sovereign default rates since 1984
```

### Advanced Queries
```
What's the recovery rate for senior secured private sector debt?
Compare project finance vs corporate finance for default risk
How do subordinated recoveries compare with senior unsecured?
```

---

## 🔍 Understanding the Metrics

### Default Rate (ADR)
**What it is:** Average annual share of counterparts that default, weighted by observations over the coverage period
**Interpretation:** Lower is better. 1% means 1 in 100 performing counterparts defaults in a typical year.
**Range:** Roughly 0.5% - 6.5% across regions and sectors

### Recovery Rate (ARR)
**What it is:** Discounted post-default cash flows as a share of the outstanding amount at default
**Interpretation:** Higher is better. 80% means lenders recover 80 cents per unit of exposure.
**Range:** Roughly 40% - 95% across breakdowns

### Expected Loss
**What it is:** Combined measure accounting for both default probability and loss severity
**Calculation:** `Default Rate × (1 - Recovery Rate)`
**Interpretation:** Overall expected loss on a portfolio. Lower is better.

**Example (Global - Private Sector, 2025 vintage):**
- Default Rate: 3.45%
- Recovery Rate: 69.75%
- Expected Loss: 3.45% × (1 - 0.6975) = **1.04%**

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
I'm considering private infrastructure lending. What's the credit risk?
```

**Claude uses:**
- `get_sector_analysis` for the infrastructure sector (global)
- `get_seniority_analysis` to show secured vs unsecured recoveries
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
Rank regions by private sector default rate,
then show me the 5-year default trend for the riskiest region
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

### "No data published" responses
- Many breakdowns (e.g. sector × region, sovereign by sector) are not published by IFC GEMs; the response lists the filters that had no data
- Try region `global` or `data_source: "private"`, which has the widest coverage

### "Data360 request failed" errors
- The World Bank Data360 API was unreachable, slow (timeouts, network errors and 5xx are retried once automatically), or rate limited (HTTP 429 is not retried), and no earlier response was cached; retry in a few minutes

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

**Current Version:** 1.3.0
**Data Coverage:** 2025 GEMs publication (sovereign 1984–2025, public and private 1994–2025)
**Tools Available:** 13
**Supported Regions:** 7 regions + 4 income groups + 90 countries
**Sector Categories:** 21
**Data Sources:** 3 (Sovereign, Public, Private)

---

## ✨ What's New in 1.3.0

- ✅ **Private by default** - Tools default to `data_source: "private"` (see the migration note under Data Sources)
- ✅ **Structured output** - Every tool returns typed JSON (`structuredContent` with an `outputSchema`) alongside the text
- ✅ **New tools** - `get_currency_analysis` (loan currency), `get_sovereign_benchmark` (GEMs vs S&P sovereign default rates), `get_spreads_and_losses` (average total spread and loss rate)
- ✅ **Recovery distribution** - Percentiles of recoveries where Data360 publishes them unambiguously
- ✅ **Regional sectors & sector history** - `get_sector_analysis` takes `region`; `get_time_series` takes `sector`
- ✅ **MCP SDK v2** - mcp-handler 2, MCP SDK v2 and zod 4 (fixes a high-severity zod 3 advisory); Streamable HTTP at `/api/gems-risk/mcp` serves both 2025- and 2026-era clients

## ✨ What's New in 1.2.0

- ✅ **Live data restored** - Queries read the latest publication vintage instead of the current calendar year, and the global aggregate uses `WLD`; every tool returned "no data" before
- ✅ **No synthetic numbers** - Removed hard-coded fallback figures and the formula-based recovery estimate; unpublished breakdowns are reported as such
- ✅ **Correct recoveries** - Sector and project-type recoveries come from the matching breakdown instead of the regional total
- ✅ **Ambiguity resolved** - Rows split by dimensions the Data360 API hides are resolved (exactly, for default rates) and disclosed (see "How the server reads Data360")
- ✅ **Countries & income groups** - New `get_country_risk` tool; `compare_regions` ranks income groups and countries; region parameters accept income groups
- ✅ **Confidence intervals** - Default rates include GEMs' 90% confidence interval
- ✅ **Time series from annual indicators** - One request per series instead of one per year; recovery-rate history added
- ✅ **Seniority & project types** - All published seniority levels (incl. subordinated) and project types (incl. real estate); the non-existent "mixed" project type was removed
- ✅ **Units** - Signed amounts reported in EUR as published, sample sizes in counterparts/defaults instead of "loans"
- ✅ **Benchmarks** - Comparisons use the live global average of the same data source instead of a fixed 3.5%
- ✅ **Reliability** - One automatic retry on transient Data360 failures, last-good-response fallback, parallel page fetches
- ✅ **Trends** - Time-series trend uses a least-squares slope (pp per year) instead of first-vs-last year
- ✅ **Transport** - Streamable HTTP at `/api/gems-risk/mcp` only; the Redis-backed SSE endpoint (which returned HTTP 500 without Redis) is disabled
- ✅ **Tests** - `npm test` runs regression tests against real Data360 rows

---

**Ready to explore emerging markets credit risk? Connect the MCP server and start asking Claude your questions!**
