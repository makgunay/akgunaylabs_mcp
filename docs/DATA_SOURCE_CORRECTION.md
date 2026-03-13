# Data Source Terminology Correction

**Date:** November 6, 2025

## IMPORTANT CLARIFICATION

The `data_source` parameter refers to **SECTOR OF ECONOMY**, not data disclosure status:

### Correct Interpretation

- **`data_source: "public"`** = **PUBLIC SECTOR / GOVERNMENT LENDING**
  - Sovereign debt
  - Sub-sovereign (regional/municipal governments)
  - Public entities and institutions
  - Dataset: IFC_GEM_PBD (Public sector Default rates), IFC_GEM_PBR (Public sector Recovery rates)

- **`data_source: "private"`** = **PRIVATE SECTOR / CORPORATE LENDING**
  - Corporations
  - Financial institutions
  - Private projects
  - Business lending
  - Dataset: IFC_GEM_PRD (Private sector Default rates), IFC_GEM_PRR (Private sector Recovery rates)

### Why This Matters

Government lending and corporate lending have **fundamentally different risk profiles**:

**Government (Public Sector):**
- Lower default rates (governments rarely default)
- Higher recovery rates when defaults occur
- Sovereign risk factors
- ~619 observations in IFC GEMs

**Corporations (Private Sector):**
- Higher default rates (businesses fail more often)
- Lower recovery rates
- Market and operational risk factors
- ~2,853 observations in IFC GEMs (4-7x more data)

### Example: MENA Region

**Public Sector Lending (government bonds, sovereign debt):**
- Default Rate: 1.89%
- Recovery Rate: 93.5%
- Expected Loss: 0.12%

**Private Sector Lending (corporate loans, business financing):**
- Default Rate: 3.39%
- Recovery Rate: 71.7%
- Expected Loss: 0.96%

**Interpretation:** Lending to governments in MENA has 8x lower expected loss than lending to corporations.

---

## Updated Tool Descriptions

All 9 MCP tools now correctly describe the data sources:

```
Data sources: "public" (public sector/government lending) or "private" (private sector/corporate lending, 4x more observations)
```

Parameter descriptions:
```
data_source: "public" (public sector lending) or "private" (private sector lending, recommended). Default: public
```

---

## Use Cases

### Use `data_source: "public"` for:
- Sovereign debt analysis
- Government bond risk assessment
- Public entity lending
- Sub-sovereign credit analysis
- Municipal finance

### Use `data_source: "private"` for:
- Corporate lending
- Business loan portfolios
- Project finance (private sector)
- Financial institution lending
- Commercial credit risk
- **Most IFC lending activities** (private sector focus)

---

## Recommendation

**For most IFC use cases, use `data_source: "private"`** as IFC primarily focuses on private sector development and has significantly more data (4-7x) for private sector lending.

Use `data_source: "public"` only when specifically analyzing sovereign or government-related lending.

---

## Code Changes Made

✅ Updated `DATA_SOURCE_INFO` constant with correct sector descriptions
✅ Updated all 9 tool descriptions to clarify public/private sector
✅ Updated all 9 parameter descriptions
✅ Build validated successfully

The technical implementation is correct - only the descriptions needed clarification.
