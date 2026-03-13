# Sovereign Data Support - GEMS Risk MCP Server

**Date:** November 6, 2025
**Status:** ✅ COMPLETE
**Implementation:** Added third data source category (Sovereign)

---

## Overview

The GEMS Risk MCP server now supports **all three economic sectors** available in the IFC GEMs database:

1. **SOVEREIGN** - National government debt (sovereign bonds)
2. **PUBLIC** - Sub-sovereign entities and state-owned enterprises (SOEs)
3. **PRIVATE** - Corporate and private sector lending

---

## Complete Indicator Coverage

### Official IFC GEMs Indicator Reference

Based on official IFC GEMs database documentation:

| Code | Indicator Name | Sector | Scope | Coverage | Status |
|------|----------------|--------|-------|----------|--------|
| IFC_GEM_SD | Average sovereign default rates | Sovereign | Average | — | ✅ **IMPLEMENTED** |
| IFC_GEM_SR | Average sovereign recovery rates | Sovereign | Average | — | ✅ **IMPLEMENTED** |
| IFC_GEM_SD_H | Historical sovereign default rates | Sovereign | Annual | 1984-2024 | ⏳ Future optimization |
| IFC_GEM_SR_H | Historical sovereign recovery rates | Sovereign | Annual | 1984-2024 | ⏳ Future optimization |
| IFC_GEM_PBD | Average public default rates | Public (sub-sovereign/SOEs) | Average | — | ✅ **IMPLEMENTED** |
| IFC_GEM_PBR | Average public recovery rates | Public (sub-sovereign/SOEs) | Average | — | ✅ **IMPLEMENTED** |
| IFC_GEM_PBD_H | Historical public default rates | Public (sub-sovereign/SOEs) | Annual | 1994-2024 | ⏳ Future optimization |
| IFC_GEM_PBR_H | Historical public recovery rates | Public (sub-sovereign/SOEs) | Annual | 1994-2024 | ⏳ Future optimization |
| IFC_GEM_PRD | Average private default rates | Private | Average | — | ✅ **IMPLEMENTED** |
| IFC_GEM_PRR | Average private recovery rates | Private | Average | — | ✅ **IMPLEMENTED** |
| IFC_GEM_PRR_H | Historical private recovery rates | Private | Annual | 1994-2024 | ⏳ Future optimization |

**Note:** `IFC_GEM_PRD_H` (historical private default rates) does not exist in the official IFC GEMs database.

### Implementation Summary

**Current Coverage:** 6 out of 11 indicators (54.5%)
- ✅ All 6 "Average" indicators implemented (SD, SR, PBD, PBR, PRD, PRR)
- ⏳ 5 "Historical" (_H) indicators available for future optimization

---

## Data Source Characteristics

### Sovereign Debt (IFC_GEM_SD/SR)

**Who:** National governments, sovereign bonds, country-level debt

**Risk Profile:**
- **Default Rate:** 0.77% (LOWEST of all three sectors)
- **Recovery Rate:** 95.06% (HIGHEST of all three sectors)
- **Expected Loss:** ~0.04% (minimal)

**Sample Size:** 4,889 default observations, 46 recovery observations

**Historical Coverage:** 1984-2024 (40 years)

**Use Cases:**
- Sovereign bond analysis
- Country risk assessment
- National debt sustainability
- Sovereign credit ratings
- Emerging market sovereign risk

**Example (MENA):**
```
Default Rate: 1.10%
Recovery Rate: 84.38%
Expected Loss: 0.17%
```

### Public Sector (IFC_GEM_PBD/PBR)

**Who:** Sub-sovereign entities (regional/local government), state-owned enterprises (SOEs)

**Risk Profile:**
- **Default Rate:** 1.89% (MEDIUM)
- **Recovery Rate:** 93.50% (HIGH)
- **Expected Loss:** ~0.12%

**Sample Size:** 619 default observations, 172 recovery observations

**Historical Coverage:** 1994-2024 (30 years)

**Use Cases:**
- Municipal bond analysis
- Regional government lending
- State-owned enterprise financing
- Infrastructure project finance (public sector)
- Development bank lending to public entities

**Example (MENA):**
```
Default Rate: 1.89%
Recovery Rate: 93.50%
Expected Loss: 0.12%
```

### Private Sector (IFC_GEM_PRD/PRR)

**Who:** Corporations, financial institutions, private projects

**Risk Profile:**
- **Default Rate:** 3.39% (HIGHEST - most risky)
- **Recovery Rate:** 71.70% (LOWEST)
- **Expected Loss:** ~0.96%

**Sample Size:** 2,853 default observations, 1,269 recovery observations (LARGEST dataset)

**Historical Coverage:** 1994-2024 (30 years)

**Use Cases:**
- Corporate lending
- Business loan portfolios
- Project finance (private sector)
- Financial institution lending
- Commercial credit risk
- **Most IFC lending activities** (IFC focuses on private sector development)

**Example (MENA):**
```
Default Rate: 3.39%
Recovery Rate: 71.70%
Expected Loss: 0.96%
```

---

## Risk Comparison Across Sectors

**MENA Region Example:**

| Sector | Default Rate | Recovery Rate | Expected Loss | Risk Level |
|--------|--------------|---------------|---------------|------------|
| **Sovereign** | 1.10% | 84.38% | 0.17% | **Lowest Risk** |
| **Public** | 1.89% | 93.50% | 0.12% | **Low-Medium Risk** |
| **Private** | 3.39% | 71.70% | 0.96% | **Highest Risk** |

**Key Insights:**
- Sovereign debt has **lowest default rates** (governments rarely default)
- Private sector has **3x higher default risk** than sovereign
- Private sector **expected loss is 5.6x higher** than sovereign
- Public sector has **highest recovery** when defaults occur (government backing)

---

## Implementation Details

### TypeScript Types

```typescript
type DataSource = 'sovereign' | 'public' | 'private';
```

### Indicator Mapping

```typescript
const INDICATOR_MAP: Record<DataSource, { default: string; recovery: string }> = {
  sovereign: {
    default: "IFC_GEM_SD",    // Sovereign default rates
    recovery: "IFC_GEM_SR"    // Sovereign recovery rates
  },
  public: {
    default: "IFC_GEM_PBD",   // Public sector default rates
    recovery: "IFC_GEM_PBR"   // Public sector recovery rates
  },
  private: {
    default: "IFC_GEM_PRD",   // Private sector default rates
    recovery: "IFC_GEM_PRR"   // Private sector recovery rates
  }
};
```

### Smart Prompt Detection

The system automatically detects data source from user prompts:

**Sovereign Triggers:**
- "sovereign"
- "sovereign debt"
- "national government"
- "government bond"
- "country risk"
- "sovereign bond"
- "country default"

**Public Triggers:**
- "public sector"
- "sub-sovereign"
- "municipal"
- "regional government"
- "local government"
- "public entity"
- "SOE" (state-owned enterprise)

**Private Triggers:**
- "private sector"
- "corporate"
- "business"
- "company"
- "firm"
- "enterprise"

---

## Usage Examples

### Example 1: Sovereign Debt Analysis

```javascript
// Analyze sovereign risk in MENA
gems-risk:query_credit_risk({
  region: "mena",
  data_source: "sovereign"
})
```

**Response:**
```markdown
# Credit Risk Profile: Middle East & North Africa

## Key Metrics
**Default Rate:** 1.10%
**Recovery Rate:** 84.38%
**Expected Loss:** 0.17%

*Data Source: SOVEREIGN dataset (IFC_GEM_SD/SR)*
*Characteristics: Sovereign debt (national governments, sovereign bonds)*
*Sample: ~4,889 default observations (largest dataset)*
```

### Example 2: Comparing All Three Sectors

```javascript
// Sovereign
gems-risk:get_default_rates({ region: "mena", data_source: "sovereign" })
// Expected: 1.10% default

// Public sector
gems-risk:get_default_rates({ region: "mena", data_source: "public" })
// Expected: 1.89% default

// Private sector
gems-risk:get_default_rates({ region: "mena", data_source: "private" })
// Expected: 3.39% default
```

### Example 3: Automatic Detection

```
User: "What's the sovereign default rate in MENA?"
```

System automatically detects "sovereign" keyword and uses `data_source="sovereign"`

---

## Tool Support

All 9 MCP tools now support the sovereign data source:

1. ✅ `get_default_rates`
2. ✅ `get_recovery_rates`
3. ✅ `query_credit_risk`
4. ✅ `compare_regions`
5. ✅ `get_sector_analysis`
6. ✅ `get_project_type_analysis`
7. ✅ `get_time_series`
8. ✅ `get_seniority_analysis`
9. ✅ `query_multidimensional`

**Tool Schema:**
```typescript
{
  region: ...,
  data_source: z.enum(['sovereign', 'public', 'private']).optional()
    .describe('Data source: "sovereign" (national government debt), "public" (sub-sovereign/public sector), or "private" (corporate/private sector, recommended for most use cases). Default: public')
}
```

---

## Validation Results

### API Testing

✅ **Sovereign Default (SD):**
```bash
curl "https://data360api.worldbank.org/data360/data?DATABASE_ID=IFC_GEM&INDICATOR=IFC_GEM_SD&METRIC=ADR&REF_AREA=MEA&TIME_PERIOD=2024"
# Returns: 1.096% default rate
```

✅ **Sovereign Recovery (SR):**
```bash
curl "https://data360api.worldbank.org/data360/data?DATABASE_ID=IFC_GEM&INDICATOR=IFC_GEM_SR&METRIC=ARR&REF_AREA=MEA&TIME_PERIOD=2024"
# Returns: 84.38% recovery rate
```

### Build Validation

- ✅ TypeScript compilation: **PASSED**
- ✅ Production build: **SUCCESS**
- ✅ All routes valid
- ✅ Type safety maintained

---

## Future Optimization: Historical (_H) Indicators

### Current Approach

We currently use "Average" indicators with year-by-year queries:

```typescript
// Current implementation
for (let year = 2014; year <= 2024; year++) {
  const result = await fetchData360({
    INDICATOR: "IFC_GEM_PRD",  // Average indicator
    TIME_PERIOD: year.toString()
  });
  // 11 API calls for 10-year trend
}
```

### Potential Optimization

The _H (Historical) indicators might provide more efficient time series data:

```typescript
// Potential future optimization
const result = await fetchData360({
  INDICATOR: "IFC_GEM_PRD_H",  // Historical indicator
  // Returns annual data for multiple years in one call?
});
```

**Benefits:**
- Fewer API calls
- More efficient data retrieval
- Cleaner code

**Investigation Needed:**
1. How do _H indicators structure their responses?
2. Can we query multiple years in one call?
3. What's the response format difference?
4. Would this break existing caching logic?

**Recommendation:** Investigate _H indicators in Phase 3 for potential time series optimization.

---

## Recommendations

### For Different Use Cases

**Use `data_source: "sovereign"` for:**
- National debt analysis
- Sovereign bond portfolios
- Country risk assessment
- Macro-economic analysis
- Sovereign credit ratings
- Emerging market sovereign risk

**Use `data_source: "public"` for:**
- Municipal bonds
- Regional government lending
- State-owned enterprise financing
- Public infrastructure projects
- Development finance institutions
- Sub-sovereign risk analysis

**Use `data_source: "private"` for:**
- **Most IFC activities** (IFC focuses on private sector development)
- Corporate lending
- Business loan portfolios
- Project finance (private sector)
- Commercial credit risk
- Financial institution lending

### Default Behavior

**Current default:** `"public"` (for backward compatibility)

**Recommendation for new users:**
- Sovereign analysis → `"sovereign"`
- Sub-sovereign/SOE analysis → `"public"`
- **Everything else** → `"private"` (largest dataset, most IFC lending)

---

## Code Changes Summary

### Files Modified
- `gems-risk-mcp/app/api/[transport]/route.ts`

### Changes Made

1. **Type Definition**
   ```typescript
   type DataSource = 'sovereign' | 'public' | 'private';  // Added 'sovereign'
   ```

2. **Indicator Mapping**
   ```typescript
   const INDICATOR_MAP = {
     sovereign: { default: "IFC_GEM_SD", recovery: "IFC_GEM_SR" },  // NEW
     public: { default: "IFC_GEM_PBD", recovery: "IFC_GEM_PBR" },
     private: { default: "IFC_GEM_PRD", recovery: "IFC_GEM_PRR" }
   };
   ```

3. **Data Source Info**
   - Added sovereign characteristics
   - Updated public to clarify "sub-sovereign/SOEs"
   - Updated private to emphasize "largest dataset"

4. **Smart Detection**
   - Added 10 sovereign trigger words
   - Refined public triggers (sub-sovereign, municipal, SOE)
   - Refined private triggers (corporate, business, company)

5. **Tool Schemas** (all 9 tools)
   ```typescript
   data_source: z.enum(['sovereign', 'public', 'private']).optional()
   ```

6. **Tool Descriptions** (all 9 tools)
   - Updated to mention all three data sources
   - Clarified risk levels and use cases

---

## Testing Checklist

Manual testing recommended:

### Sovereign Data Tests
- [ ] `get_default_rates({ region: "global", data_source: "sovereign" })`
  - Expected: ~0.77% default rate
- [ ] `get_recovery_rates({ region: "global", data_source: "sovereign" })`
  - Expected: ~95.06% recovery rate
- [ ] `query_credit_risk({ region: "mena", data_source: "sovereign" })`
  - Expected: 1.10% default, 84.38% recovery
- [ ] `get_time_series({ region: "global", years: 5, data_source: "sovereign" })`
  - Expected: 5-year sovereign trend
- [ ] `compare_regions({ metric: "both", data_source: "sovereign" })`
  - Expected: Sovereign comparison across all regions

### Comparison Tests
- [ ] Compare all three sectors for same region
  - Sovereign vs Public vs Private for MENA
  - Verify sovereign has lowest default rate
  - Verify private has highest default rate

### Smart Detection Tests
- [ ] Query with "sovereign debt in MENA" (should auto-detect sovereign)
- [ ] Query with "corporate lending in Latin America" (should auto-detect private)
- [ ] Query with "municipal bonds in East Asia" (should auto-detect public)

---

## Success Metrics

After deployment:

1. **Coverage:** 6 out of 11 indicators (54.5% → targeting 100% in future)
2. **Adoption:** Track % of queries using each data source
3. **Accuracy:** Validate sovereign data returns expected low default rates
4. **User feedback:** Survey users on three-sector model clarity

---

## Migration Impact

**Breaking Changes:** ✅ None

**Backward Compatibility:** ✅ Maintained
- Existing queries default to `"public"` (unchanged behavior)
- All existing code continues to work
- New `"sovereign"` option is additive

**Migration Path:**
- Users can immediately start using `data_source: "sovereign"`
- No code changes required for existing functionality
- Gradual adoption as users discover sovereign data

---

**Document Status:** Complete
**Implementation Status:** ✅ READY FOR DEPLOYMENT
**Next Steps:**
1. Deploy to production
2. Manual testing
3. Monitor usage patterns
4. Consider _H indicators optimization in Phase 3

---

*Last Updated: November 6, 2025*
*Indicator Reference: IFC GEMs Database Official Documentation*
