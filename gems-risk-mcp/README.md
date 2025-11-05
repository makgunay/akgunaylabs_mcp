# GEMs Risk MCP - Vercel Deployment

This is the Vercel-optimized version of the GEMs Risk MCP server, using the official `mcp-handler` package for seamless integration with Vercel's serverless platform.

## 🚀 Quick Deploy to Vercel

### Option 1: Deploy from GitHub (Recommended)

1. **Push this folder to GitHub**
2. **Go to [Vercel](https://vercel.com)**
3. **Click "Add New Project"**
4. **Import your GitHub repository**
5. **Click "Deploy"** (Vercel auto-detects the configuration)

That's it! Your MCP will be live at: `https://your-project.vercel.app/api/mcp`

---

### Option 2: Deploy with Vercel CLI

```bash
# 1. Install dependencies
npm install

# 2. Install Vercel CLI (if not already installed)
npm install -g vercel

# 3. Login to Vercel
vercel login

# 4. Deploy
vercel --prod
```

---

## 📋 Features

This MCP server provides **5 tools** for querying credit risk data from the World Bank's IFC_GEM database:

### Available Tools:

1. **get_default_rates** - Query default frequencies by region
2. **get_recovery_rates** - Retrieve recovery rates for defaulted loans
3. **query_credit_risk** - Comprehensive credit risk statistics
4. **get_sector_analysis** - Credit performance by economic sector
5. **compare_regions** - Compare metrics across regions

### Supported Regions:

- Global
- East Asia & Pacific
- Latin America & Caribbean
- Sub-Saharan Africa
- South Asia
- Middle East & North Africa
- Europe & Central Asia

---

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Server will run at: http://localhost:3000/api/mcp
```

### Test with MCP Inspector

```bash
# In a separate terminal, run MCP inspector
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

---

## 🔗 Connect to Your MCP Server

### After Deployment

Once deployed, your MCP server URL will be:
```
https://your-project-name.vercel.app/api/mcp
```

### Option 1: Use with Claude Desktop (via mcp-remote bridge)

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "gems-risk": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://your-project-name.vercel.app/api/mcp"
      ]
    }
  }
}
```

### Option 2: Direct HTTP Access (for MCP clients with HTTP support)

```json
{
  "mcpServers": {
    "gems-risk": {
      "url": "https://your-project-name.vercel.app/api/mcp",
      "transport": "streamable-http"
    }
  }
}
```

---

## 📊 Data Source

The MCP fetches real-time credit risk data from:
- **API:** World Bank Data360 (data360api.worldbank.org)
- **Dataset:** IFC_GEM (Global Emerging Markets Risk Database)
- **No authentication required** for the World Bank API
- **Automatic fallback** to cached data if API is unavailable

---

## 🔐 Adding Authentication (Optional)

To secure your MCP server with OAuth 2.1:

### 1. Create OAuth metadata endpoint

Create `api/.well-known/oauth-protected-resource/route.ts`:

```typescript
export default function handler(req, res) {
  res.json({
    "resource": "https://your-project.vercel.app/api/mcp",
    "authorization_servers": ["https://your-auth-server.com"],
    "scopes_supported": ["read:data"]
  });
}
```

### 2. Add authentication to MCP handler

Update `api/mcp.ts`:

```typescript
import { withMcpAuth } from 'mcp-handler';

// Wrap your handler with authentication
export default withMcpAuth(handler, {
  validateToken: async (token) => {
    // Your token validation logic
    // Return user info and scopes
    return {
      userId: 'user-123',
      scopes: ['read:data']
    };
  },
  requiredScopes: ['read:data'],
  metadataPath: '/.well-known/oauth-protected-resource'
});
```

---

## 🎨 Customization

### Add New Tools

Edit `api/mcp.ts` and add tools using the pattern:

```typescript
server.tool(
  'tool_name',
  'Tool description',
  {
    parameter: z.string().describe('Parameter description')
  },
  async ({ parameter }) => {
    // Your tool logic
    return {
      content: [{
        type: 'text',
        text: 'Your response'
      }]
    };
  }
);
```

### Modify Regions or Data

Update the `REGION_NAMES` and `REGION_DISPLAY_NAMES` objects in `api/mcp.ts`.

---

## 📈 Monitoring

### View Logs

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click "Logs" tab
4. See real-time function invocations and errors

### Analytics

Vercel automatically provides:
- Function invocation counts
- Error rates
- Response times
- Bandwidth usage

---

## 💰 Pricing

### Free Tier (Hobby Plan)
- ✅ 100,000 serverless function invocations/month
- ✅ 100 GB bandwidth
- ✅ Perfect for testing and small-scale usage

### Pro Plan ($20/month)
- ✅ 1,000,000 invocations/month
- ✅ 1 TB bandwidth
- ✅ **Active CPU pricing** (only pay for actual execution time)
- ✅ **For your MCP:** Estimated $20-25/month for 300k requests

**Note:** Your MCP is I/O-bound (waiting for World Bank API), so Vercel's Active CPU pricing means you only pay for ~100ms of CPU per request, not the full wait time.

---

## 🔄 Update Your MCP

### From GitHub (Auto-Deploy)

If you deployed from GitHub, Vercel automatically deploys when you push:

```bash
# Make changes to api/mcp.ts
git add .
git commit -m "Updated tools"
git push

# Vercel automatically deploys!
```

### Manual Deploy

```bash
# Deploy to production
vercel --prod

# Or deploy to preview (for testing)
vercel
```

---

## 🚨 Troubleshooting

### MCP Server Not Responding

1. Check Vercel logs for errors
2. Verify URL: `https://your-project.vercel.app/api/mcp`
3. Test health: `curl https://your-project.vercel.app/api/mcp`

### World Bank API Timeout

The MCP has automatic fallback to cached data. Check if:
- World Bank API is down (try: `curl https://data360api.worldbank.org/data360/data?DATABASE_ID=IFC_GEM`)
- Your function is timing out (Vercel default: 10s, increase if needed)

### Cold Starts

First request after idle may be slower (200-500ms). This is normal for serverless.

---

## 📚 Resources

- **Vercel MCP Docs:** https://vercel.com/docs/mcp
- **mcp-handler Package:** npm package for MCP on Vercel
- **World Bank Data360 API:** https://data360api.worldbank.org
- **MCP Specification:** https://modelcontextprotocol.io

---

## 🎯 What's Different from Local Version?

| Feature | Local (stdio) | Vercel (HTTP) |
|---------|---------------|---------------|
| **Transport** | stdio (standard I/O) | Streamable HTTP |
| **Access** | Local only | Global URL |
| **Deployment** | Manual setup | One-click deploy |
| **Scaling** | Single instance | Auto-scaling |
| **Updates** | Manual restart | Auto-deploy from Git |
| **Cost** | Free (your machine) | $0-20/month |
| **Handler** | MCP SDK directly | `mcp-handler` package |

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub (optional, but recommended)
- [ ] Vercel project created
- [ ] Deployed successfully
- [ ] MCP URL working: `https://your-project.vercel.app/api/mcp`
- [ ] Tested with MCP inspector or client
- [ ] Added to Claude Desktop config (optional)
- [ ] Custom domain configured (optional)
- [ ] OAuth authentication added (optional)

---

## 🎉 Success!

Your GEMs Risk MCP is now live on Vercel!

**Next steps:**
1. Share the URL with users
2. Monitor usage in Vercel dashboard
3. Consider adding OAuth for production
4. Set up custom domain (optional)

**Questions?** Check the Vercel MCP documentation or open an issue.
