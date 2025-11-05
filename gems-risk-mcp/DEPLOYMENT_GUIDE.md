# 🚀 GEMs Risk MCP - Vercel Deployment Guide

**Complete step-by-step guide to deploy your MCP to Vercel**

**Time to deploy:** 10-15 minutes

---

## 📋 Prerequisites

- [ ] GitHub account (free)
- [ ] Vercel account (free) - sign up at [vercel.com](https://vercel.com)
- [ ] Git installed on your machine
- [ ] Node.js 18+ installed

---

## 🎯 Deployment Methods

Choose one of three methods:

### ⭐ Method 1: GitHub + Vercel (RECOMMENDED)
**Best for:** Continuous deployment, automatic updates
**Time:** 10-15 minutes

### 🖥️ Method 2: Vercel CLI
**Best for:** Quick one-off deployments, testing
**Time:** 5-10 minutes

### 📦 Method 3: Manual Zip Upload
**Best for:** Beginners, no git experience needed
**Time:** 5 minutes

---

## ⭐ Method 1: GitHub + Vercel (Recommended)

### Step 1: Push to GitHub

```bash
# Navigate to the vercel project directory
cd gems-risk-mcp-vercel

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: GEMs Risk MCP for Vercel"

# Create a new repository on GitHub
# Go to: https://github.com/new
# Name it: gems-risk-mcp-vercel
# DON'T initialize with README (we have files already)

# Add remote (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/gems-risk-mcp-vercel.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 2: Connect Vercel to GitHub

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Select **"Import Git Repository"**
4. Find your `gems-risk-mcp-vercel` repository
5. Click **"Import"**

### Step 3: Configure (Auto-detected!)

Vercel automatically detects:
- ✅ Framework: Node.js API
- ✅ Build Command: None needed
- ✅ Output Directory: Auto
- ✅ API Routes: `/api` folder

**No configuration needed!** Click **"Deploy"**

### Step 4: Wait for Deployment

⏱️ Deployment takes 30-60 seconds

You'll see:
- ✅ Building...
- ✅ Deploying...
- 🎉 **Deployment successful!**

### Step 5: Get Your URL

Your MCP is now live at:
```
https://gems-risk-mcp-vercel-YOUR-USERNAME.vercel.app/api/mcp
```

Copy this URL - you'll need it!

### Step 6: Test Your MCP

```bash
# Test with curl
curl https://your-project.vercel.app/api/mcp

# Should return MCP protocol information
```

### ✅ Done! Your MCP is Live

**Benefits of GitHub method:**
- ✅ Auto-deploy on every git push
- ✅ Preview deployments for branches
- ✅ Easy rollbacks
- ✅ Collaboration-friendly

---

## 🖥️ Method 2: Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

### Step 3: Navigate to Project

```bash
cd gems-risk-mcp-vercel
```

### Step 4: Deploy

```bash
# First deployment (creates project)
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? [Your account]
# - Link to existing project? No
# - Project name? gems-risk-mcp-vercel
# - Directory? ./
# - Override settings? No

# This creates a preview deployment
```

### Step 5: Deploy to Production

```bash
# Deploy to production
vercel --prod
```

### Step 6: Get Your URL

```
✅ Production: https://gems-risk-mcp-vercel.vercel.app
```

### ✅ Done!

**To update:**
```bash
# Make changes, then:
vercel --prod
```

---

## 📦 Method 3: Manual Upload (Drag & Drop)

### Step 1: Prepare Files

```bash
cd gems-risk-mcp-vercel

# Install dependencies
npm install

# Create zip (excluding node_modules)
zip -r gems-risk-mcp.zip . -x "node_modules/*" -x ".git/*"
```

### Step 2: Upload to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Deploy from template or upload"**
3. Drag `gems-risk-mcp.zip` to upload area
4. Wait for upload
5. Click **"Deploy"**

### Step 3: Configure

Vercel auto-detects settings. Just click **"Deploy"**.

### ✅ Done!

---

## 🔧 Post-Deployment Configuration

### Add Custom Domain (Optional)

1. Go to your Vercel project dashboard
2. Click **"Settings"** → **"Domains"**
3. Add your domain: `mcp.yourdomain.com`
4. Follow DNS instructions
5. Vercel auto-provisions HTTPS certificate

### Add Environment Variables (Optional)

If you need custom configuration:

1. Project Settings → **"Environment Variables"**
2. Add variables:
   - `DATA360_API_BASE` = `https://data360api.worldbank.org`
   - `MCP_API_KEY` = `your-key` (if implementing auth)

### Enable Analytics

1. Project Settings → **"Analytics"**
2. Click **"Enable"**
3. See real-time usage data

---

## 🧪 Testing Your Deployment

### Test 1: Health Check

```bash
curl https://your-project.vercel.app/api/mcp
```

**Expected:** JSON response with MCP protocol info

### Test 2: Use MCP Inspector

```bash
npx @modelcontextprotocol/inspector https://your-project.vercel.app/api/mcp
```

**Expected:** Opens web interface to test tools

### Test 3: Connect to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gems-risk": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://your-project.vercel.app/api/mcp"
      ]
    }
  }
}
```

Restart Claude Desktop, then test:
```
Query: "What's the default rate for Latin America?"
```

### Test 4: Check All Tools

Using MCP Inspector, test each tool:
1. ✅ `get_default_rates` with region: "global"
2. ✅ `get_recovery_rates` with region: "east-asia"
3. ✅ `query_credit_risk` with region: "latin-america"
4. ✅ `get_sector_analysis` with sector: "Financial Services"
5. ✅ `compare_regions` with metric: "both"

---

## 🔄 Making Updates

### If Deployed via GitHub:

```bash
# 1. Make changes to api/mcp.ts
# 2. Commit and push
git add .
git commit -m "Updated default rate tool"
git push

# Vercel automatically deploys! ✨
# Preview URL provided for testing
# Merge to main → auto-deploy to production
```

### If Deployed via CLI:

```bash
# 1. Make changes
# 2. Deploy preview
vercel

# 3. Test preview URL
# 4. Deploy to production
vercel --prod
```

---

## 📊 Monitoring

### View Logs

1. Vercel Dashboard → Your Project
2. Click **"Logs"** tab
3. Filter by:
   - Function: `/api/mcp`
   - Status: All/Errors only
   - Time range

### Check Analytics

1. Vercel Dashboard → Your Project
2. Click **"Analytics"** tab
3. See:
   - Request count
   - Response times
   - Error rates
   - Geographic distribution

### Set Up Alerts

1. Project Settings → **"Notifications"**
2. Configure:
   - Deployment failures
   - High error rates
   - Budget alerts

---

## 🚨 Troubleshooting

### Issue: Deployment Failed

**Check:**
1. Vercel build logs for errors
2. Ensure all dependencies in `package.json`
3. TypeScript compilation errors

**Fix:**
```bash
# Test build locally
npm install
npm run build

# Check for errors
```

### Issue: MCP Not Responding

**Check:**
1. URL is correct: `/api/mcp` not `/api/mcp.ts`
2. Function logs in Vercel dashboard
3. World Bank API status

**Fix:**
```bash
# Test World Bank API
curl "https://data360api.worldbank.org/data360/data?DATABASE_ID=IFC_GEM"
```

### Issue: Cold Starts Slow

**Solution:**
- Upgrade to Vercel Pro ($20/month) for faster cold starts
- Or accept 200-500ms delay on first request (normal for serverless)

### Issue: Rate Limiting

**Check:**
1. Vercel function invocation limits
2. World Bank API limits

**Fix:**
- Upgrade Vercel plan if needed
- Add caching for World Bank responses

---

## 💰 Cost Management

### Monitor Usage

1. Vercel Dashboard → **"Usage"** tab
2. Track:
   - Function executions
   - Bandwidth
   - Build minutes

### Free Tier Limits

- ✅ 100,000 invocations/month
- ✅ 100 GB bandwidth/month
- ⚠️ Your MCP at 300k requests = **needs Pro plan**

### Pro Plan ($20/month)

- ✅ 1,000,000 invocations/month
- ✅ 1 TB bandwidth
- ✅ Active CPU pricing (90% savings for I/O workloads)
- ✅ Priority support

### Optimize Costs

1. **Cache World Bank API responses** (reduce external calls)
2. **Use Active CPU pricing** (only pay for execution, not wait time)
3. **Monitor usage** (set budget alerts)

---

## 🔐 Adding OAuth (Production)

For production deployments with multiple users:

### Step 1: Create OAuth Endpoint

Create `api/.well-known/oauth-protected-resource/route.ts`:

```typescript
export default function handler(req: any, res: any) {
  res.json({
    "resource": "https://your-project.vercel.app/api/mcp",
    "authorization_servers": ["https://your-auth.vercel.app"],
    "scopes_supported": ["read:data", "read:all"]
  });
}
```

### Step 2: Update MCP Handler

In `api/mcp.ts`:

```typescript
import { withMcpAuth } from 'mcp-handler';

export default withMcpAuth(handler, {
  validateToken: async (token) => {
    // Validate JWT token or API key
    // Return user info
    return {
      userId: 'user-123',
      scopes: ['read:data']
    };
  },
  requiredScopes: ['read:data'],
  metadataPath: '/.well-known/oauth-protected-resource'
});
```

### Step 3: Test OAuth Flow

Use MCP Inspector with authentication:
```bash
npx @modelcontextprotocol/inspector https://your-project.vercel.app/api/mcp
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Code tested locally
- [ ] All dependencies installed
- [ ] TypeScript compiles without errors
- [ ] Environment variables configured

### Deployment
- [ ] Project deployed to Vercel
- [ ] Deployment successful (green checkmark)
- [ ] URL accessible
- [ ] Health check passes

### Testing
- [ ] MCP Inspector works
- [ ] All 5 tools tested
- [ ] Real-time data fetching works
- [ ] Fallback to cache works

### Production
- [ ] Custom domain configured (optional)
- [ ] OAuth enabled (optional)
- [ ] Monitoring enabled
- [ ] Budget alerts set

### Documentation
- [ ] URL shared with users
- [ ] Usage instructions provided
- [ ] Support contact set up

---

## 🎉 Success!

Your GEMs Risk MCP is now deployed on Vercel!

**Your MCP URL:**
```
https://your-project-name.vercel.app/api/mcp
```

**Next Steps:**
1. ✅ Share URL with users
2. ✅ Monitor usage in dashboard
3. ✅ Add OAuth for production
4. ✅ Consider custom domain
5. ✅ Set up budget alerts

---

## 📚 Additional Resources

- **Vercel Docs:** https://vercel.com/docs
- **MCP Specification:** https://modelcontextprotocol.io
- **World Bank API:** https://data360api.worldbank.org
- **Support:** https://vercel.com/support

---

## 🆘 Need Help?

**Common Issues:**
- Check Vercel build logs
- Test locally with `npm run dev`
- Verify World Bank API is accessible
- Review MCP protocol specification

**Community:**
- Vercel Discord: https://vercel.com/discord
- MCP GitHub Discussions

**Professional Support:**
- Vercel Pro plan includes priority support
- Enterprise options available

---

**Deployment Guide Version:** 1.0
**Last Updated:** November 5, 2025
