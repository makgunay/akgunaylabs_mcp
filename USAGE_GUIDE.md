# GEMs Risk MCP - Usage Guide

## 🎯 Your MCP is Live!

**Production URL:** `https://akgunaylabs-mcp.vercel.app/api/mcp`

**Deployment:** ✅ Successfully deployed on Vercel
- Branch: `claude/setup-mcp-gems-risk-011CUpPcNah2x8v1oTMcf3KJ`
- Commit: `4fd234d` (Fix Vercel deployment warnings)
- Status: Production Ready

---

## 🧪 Test Your MCP

### Option 1: Browser Test (Quickest)

Open your browser and visit:
```
https://akgunaylabs-mcp.vercel.app/api/mcp
```

**Expected:** You should see JSON response (might show error without proper MCP request, which is normal)

### Option 2: MCP Inspector (Recommended)

The official MCP testing tool:

```bash
npx @modelcontextprotocol/inspector https://akgunaylabs-mcp.vercel.app/api/mcp
```

This opens a web interface where you can:
1. See all 5 tools available
2. Test each tool with different parameters
3. View real responses from World Bank API

**Example tests:**
- `get_default_rates` with region: `global`
- `get_recovery_rates` with region: `latin-america`
- `query_credit_risk` with region: `east-asia`
- `compare_regions` with metric: `both`

### Option 3: Command Line Test

```bash
curl https://akgunaylabs-mcp.vercel.app/api/mcp
```

---

## 🖥️ Use with Claude Desktop

### Step 1: Install Claude Desktop

Download from: https://claude.ai/download

### Step 2: Configure MCP

**macOS/Linux:**
```bash
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
notepad %APPDATA%\Claude\claude_desktop_config.json
```

### Step 3: Add Configuration

```json
{
  "mcpServers": {
    "gems-risk": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://akgunaylabs-mcp.vercel.app/api/mcp"
      ]
    }
  }
}
```

### Step 4: Restart Claude Desktop

Quit and reopen the Claude Desktop app.

### Step 5: Test in Claude

Try these prompts:

**Simple queries:**
- "What's the current default rate for Latin America?"
- "Show me recovery rates for all regions"
- "What's the credit risk profile for East Asia?"

**Complex queries:**
- "Compare default rates across all emerging market regions and tell me which region has the lowest risk"
- "What sectors have the highest default rates in emerging markets?"
- "Give me a comprehensive risk assessment for Sub-Saharan Africa"

---

## 📊 Available Tools

Your MCP provides 5 tools with real World Bank Data360 data:

### 1. **get_default_rates**
Query default frequencies for emerging market lending by region.

**Parameters:**
- `region`: global, east-asia, europe-central-asia, latin-america, mena, south-asia, sub-saharan-africa

**Example:**
```
"What's the default rate for Latin America?"
```

### 2. **get_recovery_rates**
Query recovery rates on defaulted emerging market loans.

**Parameters:**
- `region`: (same as above)

**Example:**
```
"What's the recovery rate for East Asia?"
```

### 3. **query_credit_risk**
Get comprehensive credit risk statistics including defaults, recovery rates, and loss expectations.

**Parameters:**
- `region`: (same as above)

**Example:**
```
"Give me the full credit risk profile for Sub-Saharan Africa"
```

### 4. **get_sector_analysis**
Analyze credit risk performance by industry sector.

**Parameters:**
- `sector`: Financial Services, Infrastructure, Manufacturing, Services, Agriculture, Energy, Health & Education

**Example:**
```
"Which sector has the highest default rate?"
```

### 5. **compare_regions**
Compare credit risk metrics across all emerging market regions.

**Parameters:**
- `metric`: default-rate, recovery-rate, both

**Example:**
```
"Compare default rates across all regions"
```

---

## 🌐 Data Sources

### Real-Time Data
- **World Bank Data360 API**
- **IFC Global Emerging Markets Risk Database** (IFC_GEM)
- **Coverage:** 1994-2024
- **Metrics:** Default rates (ADR), Loan counts (CP), Loan volumes (SA)

### Estimated Data
- **Recovery rates:** Estimated based on IFC documentation (73% global baseline)
- **Sector analysis:** Based on industry patterns and historical data

### Fallback Behavior
If the World Bank API is unavailable, the MCP automatically falls back to cached data to ensure reliability.

---

## 🔍 Vercel Deployment Details

### Monitoring

View your deployment logs and analytics:
1. Go to [vercel.com](https://vercel.com)
2. Select your project: `akgunaylabs-mcp`
3. Click on the latest deployment
4. View:
   - **Logs** - See MCP requests in real-time
   - **Analytics** - Track usage patterns
   - **Function Invocations** - Monitor API calls

### Domains

Your MCP is accessible via these URLs (all point to same deployment):

**Primary (Use This):**
```
https://akgunaylabs-mcp.vercel.app/api/mcp
```

**Branch Preview:**
```
https://akgunaylabs-mcp-git-claude-setup-mcp-gems-r-a0c6a7-akgunay-labs.vercel.app/api/mcp
```

**Deployment-Specific:**
```
https://akgunaylabs-idlhw3nfe-akgunay-labs.vercel.app/api/mcp
```

### Cost Tracking

**Current Plan:** Free Tier
- ✅ 100,000 function invocations/month
- ✅ 100 GB bandwidth/month

**Monitor usage:**
1. Vercel Dashboard → Your Project
2. Click "Usage" tab
3. Set budget alerts if needed

**If you exceed free tier:**
- Upgrade to Pro ($20/month) for 1M invocations

---

## 🚀 Making Updates

### Edit the MCP

1. Modify code in `gems-risk-mcp/api/mcp.ts`
2. Commit changes:
   ```bash
   git add gems-risk-mcp/
   git commit -m "Update MCP tools"
   git push
   ```
3. Vercel automatically deploys (takes ~30 seconds)
4. Test the updated version

### Add New Tools

Edit `api/mcp.ts` and add new tools using this pattern:

```typescript
server.tool(
  'tool_name',
  'Tool description for AI to understand when to use it',
  {
    parameter: z.string().describe('Parameter description'),
  },
  async ({ parameter }) => {
    // Your logic here
    return {
      content: [{
        type: 'text',
        text: 'Response text'
      }]
    };
  }
);
```

---

## 📝 Example Conversation

Here's what a conversation might look like in Claude Desktop:

**You:** "What's the credit risk situation in Latin America?"

**Claude:** *Uses get_default_rates and get_recovery_rates tools*

"Based on the latest World Bank data for Latin America & Caribbean:
- Default Rate: 4.2%
- Recovery Rate: 68%
- This gives an expected loss of about 1.34%

This is slightly higher than the global emerging market average of 3.5% default rate. The region has moderate credit risk compared to other emerging markets."

**You:** "How does that compare to East Asia?"

**Claude:** *Uses compare_regions tool*

"East Asia has notably better credit metrics:
- Default Rate: 2.8% (vs 4.2% for Latin America)
- Recovery Rate: 76% (vs 68% for Latin America)

East Asia shows lower default risk and better recovery performance, making it a relatively safer region for emerging market lending."

---

## 🔧 Troubleshooting

### MCP Not Showing in Claude Desktop

1. **Check config file location**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Verify JSON syntax**
   - Use https://jsonlint.com to validate your config
   - Common error: missing commas between server definitions

3. **Restart Claude Desktop**
   - Fully quit (Cmd+Q on Mac)
   - Reopen the app

### MCP Shows Errors

1. **Check Vercel deployment status**
   - Visit https://vercel.com/dashboard
   - Ensure latest deployment shows "Ready"

2. **Test the URL directly**
   ```bash
   curl https://akgunaylabs-mcp.vercel.app/api/mcp
   ```

3. **Check Vercel function logs**
   - Vercel Dashboard → Project → Logs
   - Look for errors during MCP calls

### Slow Response Times

**Normal:** First request after idle may take 1-2 seconds (cold start)
**Solution:** Upgrade to Vercel Pro for faster cold starts

---

## 🎉 Next Steps

Now that your MCP is deployed and working:

1. ✅ Test it with MCP Inspector
2. ✅ Set up Claude Desktop integration
3. ✅ Try out all 5 tools
4. ✅ Monitor usage in Vercel dashboard
5. ✅ Share the URL with collaborators (optional)
6. ✅ Add more tools/data sources (future)

---

## 📚 Resources

- **MCP Specification:** https://modelcontextprotocol.io
- **Vercel Documentation:** https://vercel.com/docs
- **World Bank Data360:** https://data360.worldbank.org
- **IFC GEM Database:** https://data360.worldbank.org/en/api?datasetid=IFC_GEM

---

**Deployment Date:** November 5, 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
