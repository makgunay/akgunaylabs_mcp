# GEMs Risk MCP - Hosting & Deployment Plan

**Goal:** Enable users to access the MCP via a link without local installation

**Date:** November 5, 2025
**Current Status:** Local MCP server with stdio transport

---

## 🎯 Executive Summary

Your current MCP uses **stdio transport** (standard input/output), which only works locally. To enable remote access via URL, you need to:

1. **Migrate to Streamable HTTP transport** (recommended) or HTTP+SSE (legacy)
2. **Deploy to a cloud platform** with proper authentication
3. **Implement security measures** (OAuth 2.1, API keys, rate limiting)
4. **Choose deployment architecture** (serverless vs persistent)

---

## 🔄 Current Architecture vs Required Architecture

### Current (Local Only)
```
User's Machine
├── Claude Desktop (MCP Client)
└── Your MCP Server (stdio)
    └── Calls World Bank API
```

### Required (Remote Access)
```
User's Browser/Client
└── MCP Client (Claude Desktop with mcp-remote bridge OR AI Playground)
    └── HTTPS Request → Your Hosted MCP Server
        ├── OAuth 2.1 Authentication
        ├── Session Management
        └── Calls World Bank API
```

---

## 📡 Transport Protocol Options

### Option 1: **Streamable HTTP** (RECOMMENDED - Modern Standard)

**Specification:** MCP 2025-03-26 (March 26, 2025)

**Advantages:**
- ✅ Single endpoint (`/mcp`) - simpler architecture
- ✅ Works with serverless platforms (can scale to zero)
- ✅ Better for cost optimization
- ✅ Simpler session management via `Mcp-Session-Id` header
- ✅ Future-proof (official direction of MCP)
- ✅ Supports both streaming and standard HTTP responses

**Requirements:**
- Implement `/mcp` endpoint supporting POST and GET
- Handle `Mcp-Session-Id` header for session tracking
- Support both JSON and event-stream content types

**Best For:** New deployments, serverless platforms (Vercel, Cloudflare Workers)

---

### Option 2: **HTTP+SSE** (Server-Sent Events)

**Specification:** MCP 2024-11-05 (Legacy, still supported)

**Advantages:**
- ✅ Broader client compatibility currently
- ✅ Well-documented with more examples
- ✅ Maintains persistent connections

**Disadvantages:**
- ❌ Requires two endpoints: `/sse` (GET) and `/messages` (POST)
- ❌ Persistent connections prevent serverless scaling to zero
- ❌ Higher resource consumption
- ❌ More complex session management
- ❌ Being phased out

**Requirements:**
- GET `/sse` endpoint for Server-Sent Events
- POST `/messages` endpoint for requests
- Proper SSE headers (`text/event-stream`, `Cache-Control: no-cache`)

**Best For:** Transition period, compatibility with older clients

---

## 🏗️ Deployment Architecture Options

### Architecture 1: **Serverless (RECOMMENDED for your use case)**

**Platforms:**
- **Cloudflare Workers** (BEST for MCP)
- **Vercel** (good for Node.js)
- **Google Cloud Run** (flexible)
- **AWS Lambda** (if already using AWS)

**Pros:**
- ✅ Pay-per-use (no idle costs)
- ✅ Auto-scaling
- ✅ Built-in HTTPS
- ✅ Minimal maintenance
- ✅ Works well with Streamable HTTP

**Cons:**
- ❌ Cold starts (first request slower)
- ❌ Doesn't work well with HTTP+SSE (persistent connections)
- ❌ Limited to stateless operations

**Cost Estimate:**
- **Cloudflare Workers**: Free tier (100k requests/day), then $5/month + usage
- **Vercel**: Free for personal, $20/month Pro + usage
- **Google Cloud Run**: Free tier (2M requests/month), then pay-per-use

**BEST FOR:** Your GEMs Risk MCP (read-only API queries, no state needed)

#### Vercel Analytics Integration (Recommended if deploying on Vercel)

If you choose Vercel for hosting, enable **Vercel Analytics** to gain real-time visibility into MCP request volume and user experience without maintaining a separate metrics stack.

- **What you get:** Core Web Vitals, Speed Insights, and privacy-friendly Web Analytics aggregated automatically from your deployment.
- **Enablement:** Run `vercel analytics enable` (CLI) or toggle **Analytics** in the project dashboard. No code changes are required for Node.js/Edge functions.
- **Dashboards:** View analytics under **Analytics → Web** (traffic & referrers) and **Analytics → Speed Insights** (performance, Core Web Vitals).
- **Alerts & retention:** Usage-based retention (30 days on Pro by default) with upgrade paths for longer history; you can export reports for governance reviews.
- **Data privacy:** Built-in EU data residency options and first-party data collection meet compliance needs for World Bank-aligned projects.

**How this helps:**

- Monitor adoption as you onboard external users to the hosted MCP.
- Catch latency regressions that might stem from upstream World Bank API slowdowns.
- Support stakeholder reporting by exporting traffic and performance summaries during quarterly reviews.

---

### Architecture 2: **Container/Persistent Service**

**Platforms:**
- **Railway** ($5-20/month + usage)
- **Render** ($19/month baseline)
- **DigitalOcean App Platform** ($5-12/month)
- **Northflank** (production-grade, ~$20+/month)
- **Fly.io** (pay-per-use)

**Pros:**
- ✅ Always running (no cold starts)
- ✅ Works with both HTTP+SSE and Streamable HTTP
- ✅ Can maintain state
- ✅ More control

**Cons:**
- ❌ Pay even when idle
- ❌ Manual scaling management
- ❌ More maintenance

**Cost Estimate:**
- **Railway**: $5/month hobby + ~$10-20 usage = $15-25/month
- **Render**: $7/month for basic service
- **Northflank**: $20-50/month (production-grade)

**BEST FOR:** Stateful applications, complex workflows, guaranteed uptime

---

### Architecture 3: **Kubernetes (Enterprise)**

**Platforms:**
- **Google Kubernetes Engine (GKE)**
- **AWS EKS**
- **Azure AKS**
- **DigitalOcean Kubernetes**

**Pros:**
- ✅ Maximum scalability
- ✅ Full control
- ✅ Multi-region support
- ✅ Advanced orchestration

**Cons:**
- ❌ Expensive ($50-500+/month)
- ❌ Complex setup
- ❌ Requires DevOps expertise
- ❌ Overkill for single MCP

**Cost Estimate:** $100-500+/month minimum

**BEST FOR:** Large organizations, multiple MCPs, enterprise needs

---

## 🔐 Security Requirements

### 1. **Authentication (Who is the user?)**

**Options:**

#### Option A: **OAuth 2.1** (RECOMMENDED - Industry Standard)
- ✅ Most secure
- ✅ Required by MCP specification for production
- ✅ Supports multiple users
- ✅ Token expiration and refresh
- ✅ Scoped permissions

**Implementation:**
- Use Cloudflare's `workers-oauth-provider` library
- Or integrate with Auth0, Firebase Auth, Clerk, Supabase
- Required endpoints:
  - `/.well-known/oauth-authorization-server`
  - `/.well-known/oauth-protected-resource`
  - `/authorize` (login page)
  - `/callback` (post-login)
  - `/token` (exchange codes for tokens)

**Best For:** Production deployments, multiple users

---

#### Option B: **API Key Authentication**
- ✅ Simple to implement
- ✅ Good for limited users/testing
- ❌ Less secure (no expiration)
- ❌ All-or-nothing access

**Implementation:**
- Generate unique API keys per user
- Validate via `Authorization: Bearer <api_key>` header
- Store keys securely (environment variables, secrets manager)

**Best For:** MVP, internal tools, limited users

---

#### Option C: **JWT (JSON Web Tokens)**
- ✅ Stateless authentication
- ✅ Include user info in token
- ✅ Token expiration
- ❌ More complex than API keys
- ❌ Less secure than OAuth 2.1

**Best For:** Internal applications, known users

---

### 2. **Authorization (What can they access?)**

**Implement:**
- ✅ **Scoped permissions**: Limit tools per user/role
- ✅ **Resource-level access**: Control which regions/data accessible
- ✅ **Token scopes**: OAuth scopes like `read:global`, `read:regional`

**Example Scopes for GEMs MCP:**
- `read:default-rates` - Query default rates
- `read:recovery-rates` - Query recovery rates
- `read:all-regions` - Access all regions
- `read:sector-analysis` - Sector breakdowns

---

### 3. **Rate Limiting**

**Why:** Prevent abuse, control costs (World Bank API calls)

**Implementation:**
- ✅ Requests per minute/hour per user
- ✅ Requests per API key
- ✅ Global rate limits

**Recommended Limits:**
- **Free tier**: 100 requests/hour
- **Paid tier**: 1,000-10,000 requests/hour
- **Enterprise**: Unlimited with SLA

**Tools:**
- Cloudflare: Built-in rate limiting
- Express.js: `express-rate-limit` middleware
- Redis: For distributed rate limiting

---

### 4. **Additional Security**

**Required:**
- ✅ **HTTPS/TLS**: Encrypt all traffic (automatic on most platforms)
- ✅ **CORS**: Configure allowed origins
- ✅ **Input validation**: Sanitize all parameters
- ✅ **Secret management**: Use platform secrets (not .env files)
- ✅ **Logging & monitoring**: Track usage and errors
- ✅ **Error handling**: Don't expose internal errors

**Advanced:**
- ✅ **DDoS protection**: Cloudflare, AWS Shield
- ✅ **WAF (Web Application Firewall)**: Block malicious requests
- ✅ **SBOM**: Software Bill of Materials for dependencies
- ✅ **Image scanning**: For Docker containers

---

## 💰 Cost Analysis

### Scenario 1: **Small Scale (100-1,000 users)**

**Recommended Stack:**
- **Platform**: Cloudflare Workers (Streamable HTTP)
- **Auth**: Cloudflare OAuth Provider
- **Database**: Workers KV (for sessions) - included
- **Cost**: $5-10/month

**Pros:** Cheapest, auto-scaling, minimal maintenance
**Cons:** Vendor lock-in, learning curve

---

### Scenario 2: **Medium Scale (1,000-10,000 users)**

**Recommended Stack:**
- **Platform**: Railway or Google Cloud Run (Container)
- **Auth**: Auth0 or Firebase (external)
- **Database**: PostgreSQL for sessions
- **Cost**: $30-100/month

**Pros:** More control, easier migration, better monitoring
**Cons:** Higher base cost, more maintenance

---

### Scenario 3: **Enterprise (10,000+ users)**

**Recommended Stack:**
- **Platform**: Kubernetes (GKE/EKS)
- **Auth**: Enterprise SSO integration
- **Database**: Managed PostgreSQL + Redis
- **Monitoring**: Datadog, New Relic
- **Cost**: $200-1,000+/month

**Pros:** Maximum scalability, SLA guarantees, multi-region
**Cons:** Complex, expensive, requires DevOps team

---

## 📋 Implementation Phases

### Phase 1: **MVP - Quick Remote Access** (1-2 weeks)

**Goals:**
- Get remote URL working
- Basic security
- Test with limited users

**Steps:**
1. Migrate to **Streamable HTTP transport**
2. Deploy to **Cloudflare Workers** or **Vercel**
3. Implement **API Key authentication**
4. Add **basic rate limiting** (100 req/hour)
5. Test with `mcp-remote` bridge tool

**Cost:** $0-10/month
**Security Level:** ⭐⭐ (Suitable for testing)

---

### Phase 2: **Production Ready** (2-4 weeks)

**Goals:**
- OAuth 2.1 authentication
- Multi-user support
- Production security

**Steps:**
1. Implement **OAuth 2.1** (Cloudflare library or Auth0)
2. Add **session management** with cleanup
3. Implement **scoped permissions**
4. Add **monitoring and logging**
5. Create **user dashboard** (optional)
6. Set up **proper rate limiting** per user
7. Add **health check endpoint**

**Cost:** $20-50/month
**Security Level:** ⭐⭐⭐⭐ (Production-ready)

---

### Phase 3: **Scale & Polish** (ongoing)

**Goals:**
- Handle growth
- Advanced features
- Compliance

**Steps:**
1. Add **caching layer** (Redis) for API responses
2. Implement **analytics dashboard**
3. Multi-region deployment
4. CDN for static assets
5. Advanced monitoring (error tracking, performance)
6. Compliance (GDPR, SOC2 if needed)
7. Auto-scaling policies

**Cost:** $100-500+/month
**Security Level:** ⭐⭐⭐⭐⭐ (Enterprise-grade)

---

## 🎯 Recommended Approach for Your GEMs MCP

### **Best Option: Cloudflare Workers + Streamable HTTP**

**Why:**
1. ✅ **Perfect fit for read-only API**: Your MCP just queries World Bank API
2. ✅ **Cost-effective**: Free tier covers most small-medium usage
3. ✅ **Built-in security**: OAuth library, DDoS protection, HTTPS
4. ✅ **Auto-scaling**: Handles traffic spikes automatically
5. ✅ **Fast deployment**: Minutes, not hours
6. ✅ **Global edge network**: Low latency worldwide

**Implementation Roadmap:**

**Week 1:**
- Convert stdio transport → Streamable HTTP transport
- Create single `/mcp` endpoint
- Add session management

**Week 2:**
- Deploy to Cloudflare Workers
- Implement OAuth 2.1 with Cloudflare provider
- Add API key fallback for testing

**Week 3:**
- Add rate limiting (100/hour free, 1000/hour paid)
- Implement basic logging
- Create health check endpoint

**Week 4:**
- Testing with multiple clients
- Documentation for users
- Launch beta

**Monthly Cost Breakdown:**
- Cloudflare Workers: $5/month (after free tier)
- Domain (optional): $10-15/year
- **Total: $5-6/month**

---

## 🔗 User Access Methods

### Method 1: **Direct MCP Client** (Future - Limited Support Now)

**Ideal:** User adds your URL to Claude Desktop config

```json
{
  "mcpServers": {
    "gems-risk": {
      "url": "https://your-mcp-server.com/mcp",
      "oauth": {
        "client_id": "your-client-id"
      }
    }
  }
}
```

**Status:** ⚠️ Most MCP clients don't support remote servers natively yet

---

### Method 2: **Bridge Tool** (Current Best Option)

**How it works:**
1. User installs `mcp-remote` (npx tool)
2. Configures local bridge to your remote server
3. Bridge translates stdio ↔ HTTP

**User config:**
```json
{
  "mcpServers": {
    "gems-risk": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-mcp-server.com/mcp"]
    }
  }
}
```

**Pros:**
- ✅ Works with current Claude Desktop
- ✅ No local server download
- ✅ Automatic authentication flow

**Cons:**
- ❌ Still requires npx/Node.js installed
- ❌ Extra abstraction layer

---

### Method 3: **Web Interface** (Simplest for End Users)

**Create a web UI:**
- User visits your website
- Logs in with OAuth
- Queries data through web interface
- No MCP client needed

**Examples:**
- Cloudflare AI Playground
- Custom React/Vue dashboard
- ChatGPT-like interface

**Pros:**
- ✅ Zero installation for users
- ✅ Works in any browser
- ✅ Full control over UX

**Cons:**
- ❌ Not integrated with Claude Desktop
- ❌ Requires building separate UI

---

## ⚠️ Important Considerations

### 1. **World Bank API Rate Limits**

Your MCP calls `data360api.worldbank.org`. Check if they have:
- Rate limits per IP
- Authentication requirements
- Terms of Service for reselling/proxying

**Mitigation:**
- ✅ Cache API responses (1-24 hours)
- ✅ Implement request coalescing (dedupe simultaneous requests)
- ✅ Rate limit your users accordingly

---

### 2. **Session Management**

**Challenge:** HTTP is stateless, but MCP conversations need context

**Solutions:**
- ✅ Use session IDs in headers
- ✅ Store transport instances in memory (Map)
- ✅ Implement session timeout (30-60 minutes)
- ✅ Clean up abandoned sessions

---

### 3. **Error Handling**

**What happens when:**
- World Bank API is down? → Graceful fallback to cached data
- User exceeds rate limit? → Clear 429 error with retry-after
- Authentication fails? → Proper OAuth error codes

---

### 4. **Monitoring & Observability**

**Must track:**
- ✅ Request counts per user/endpoint
- ✅ Error rates and types
- ✅ Response times
- ✅ World Bank API calls
- ✅ Authentication failures

**Tools:**
- Cloudflare Analytics (built-in)
- Sentry (error tracking)
- Datadog (enterprise monitoring)

---

## 📚 Resources & Documentation

### Official MCP Documentation
- Specification: https://modelcontextprotocol.io/specification/2025-03-26/
- Transports: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports

### Deployment Guides
- Cloudflare MCP: https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/
- Northflank Guide: https://northflank.com/blog/how-to-build-and-deploy-a-model-context-protocol-mcp-server
- Complete Guide: https://simplescraper.io/blog/how-to-mcp

### Tools
- mcp-remote bridge: https://github.com/modelcontextprotocol/mcp-remote
- Cloudflare OAuth Provider: Built into Workers SDK
- MCP SDK (TypeScript): @modelcontextprotocol/sdk

---

## ✅ Next Steps

1. **Decide on platform**: Cloudflare Workers (recommended) vs Railway/Render
2. **Choose authentication**: OAuth 2.1 (production) vs API Keys (MVP)
3. **Set timeline**: MVP in 1-2 weeks vs full production in 4-6 weeks
4. **Budget approval**: $5-50/month depending on scale
5. **Review World Bank API terms**: Ensure compliance
6. **Test transport migration**: stdio → Streamable HTTP locally first

---

## 🎬 Conclusion

**Recommended Path Forward:**

1. **Immediate (MVP):**
   - Deploy to Cloudflare Workers with Streamable HTTP
   - Use API key auth for initial testing
   - Cost: $0-5/month
   - Time: 1-2 weeks

2. **Short-term (Production):**
   - Add OAuth 2.1 authentication
   - Implement rate limiting and monitoring
   - Launch to beta users
   - Cost: $5-20/month
   - Time: 3-4 weeks

3. **Long-term (Scale):**
   - Add caching and optimizations
   - Multi-region if needed
   - Advanced analytics
   - Cost: $20-100+/month based on usage

**Key Advantages of Remote Hosting:**
- ✅ Users access via URL (no download)
- ✅ Centralized updates (fix once, affects all)
- ✅ Better security (control authentication)
- ✅ Usage analytics and monitoring
- ✅ Can monetize if desired

**Security Level:** With OAuth 2.1 + rate limiting + HTTPS, you'll have **production-grade security** suitable for public deployment.
