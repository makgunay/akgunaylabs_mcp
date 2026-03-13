# Fallback Strategy Review - To Revisit

**Date:** 2025-11-05
**Status:** ⚠️ FLAGGED FOR REVIEW
**Priority:** Review after Phase 1 completion

---

## Current Behavior

When recovery rate API is unavailable:
- System **silently falls back** to estimation formula
- Uses correlation: `recoveryRate = 73 + (3.5 - defaultRate) × 1.5`
- Constrained to 60-80% range
- Shows message: "*Recovery rate estimated... (API data not available)*"

**Code:** `route.ts:304-312`

```typescript
const realRecoveryRate = await getRecoveryRateData(apiCode);
const recoveryRate = realRecoveryRate !== null
  ? realRecoveryRate
  : estimateRecoveryRate(defaultRate);  // ← Silent fallback

const isRecoveryEstimated = realRecoveryRate === null;
```

---

## User Concern

**Question Raised:** Should we have a fallback where we estimate?

**Potential Issues:**
1. **Accuracy:** Estimated data may mislead users if not clearly indicated
2. **Transparency:** Users may not notice the difference in data source
3. **Reliability:** May mask underlying API issues
4. **Trust:** Users might prefer "no data" over "estimated data"

---

## Alternative Approaches

### Option 1: Keep Current (Silent Fallback)

**Pros:**
- ✅ Tool always works (no service interruption)
- ✅ Users get some value even when API down
- ✅ Clear messaging about estimation
- ✅ Conservative estimate (correlation-based)

**Cons:**
- ❌ May provide false confidence
- ❌ Hides API availability issues
- ❌ Estimated data less accurate than real

**User Experience:**
```
Recovery Rate: 72.1%
*Recovery rate estimated based on default rate correlation
(API data not available)*
```

---

### Option 2: Fail Gracefully (Show Error)

**Change:**
```typescript
const realRecoveryRate = await getRecoveryRateData(apiCode);
if (realRecoveryRate === null) {
  return {
    content: [{
      type: 'text',
      text: `# Recovery Rates for ${region}\n\n` +
            `**Error:** Recovery rate data temporarily unavailable.\n\n` +
            `The World Bank Data360 API is not responding. ` +
            `Please try again later or contact support if this persists.\n\n` +
            `*Default rates and other metrics are still available via other tools.*`
    }]
  };
}
```

**Pros:**
- ✅ Maximum transparency
- ✅ No risk of misleading users
- ✅ Alerts us to API issues immediately
- ✅ Users know exactly what's happening

**Cons:**
- ❌ Tool doesn't work when API down
- ❌ Poor user experience during outages
- ❌ Users can't get any recovery data

**User Experience:**
```
Error: Recovery rate data temporarily unavailable.

The World Bank Data360 API is not responding...
```

---

### Option 3: Hybrid (Partial Data)

**Change:**
```typescript
const realRecoveryRate = await getRecoveryRateData(apiCode);

return {
  content: [{
    type: 'text',
    text: realRecoveryRate !== null
      ? `# Recovery Rates for ${region}\n\n` +
        `**Recovery Rate:** ${realRecoveryRate}%\n\n` +
        `*Real-time data from World Bank Data360*`
      : `# Recovery Rates for ${region}\n\n` +
        `**Recovery Rate:** Data unavailable\n\n` +
        `**Alternative:** You can still query comprehensive ` +
        `credit risk via \`query_credit_risk('${region}')\` ` +
        `which includes default rates, loan volumes, and ` +
        `estimated recovery rates.\n\n` +
        `*World Bank API temporarily unavailable*`
  }]
};
```

**Pros:**
- ✅ Transparent about unavailability
- ✅ Guides users to alternative tools
- ✅ Doesn't provide potentially misleading estimates
- ✅ Maintains service for other tools

**Cons:**
- ❌ Tool provides no value when API down
- ❌ Extra complexity in messaging
- ❌ Users need to switch tools

**User Experience:**
```
Recovery Rate: Data unavailable

Alternative: You can still query comprehensive credit risk
via query_credit_risk('sub-saharan-africa')...
```

---

### Option 4: Explicit Fallback (Ask User)

**Change:**
```typescript
// Add parameter to tools
server.tool(
  'get_recovery_rates',
  'Query recovery rates. If real data unavailable, optionally use estimation.',
  {
    region: z.enum([...]),
    useEstimateIfUnavailable: z.boolean().optional()
      .describe('Use estimation if real data unavailable (default: false)')
  },
  async ({ region, useEstimateIfUnavailable = false }) => {
    const realRecoveryRate = await getRecoveryRateData(apiCode);

    if (realRecoveryRate === null && !useEstimateIfUnavailable) {
      return { /* Error: data unavailable */ };
    }

    const recoveryRate = realRecoveryRate ?? estimateRecoveryRate(defaultRate);
    // ...
  }
);
```

**Pros:**
- ✅ User controls behavior
- ✅ Maximum transparency
- ✅ Flexible for different use cases
- ✅ Clear what data is being used

**Cons:**
- ❌ More complex interface
- ❌ Users need to understand options
- ❌ Default behavior needs careful choice
- ❌ Breaking change to existing tools

**User Experience:**
```
User: get_recovery_rates('sub-saharan-africa')
→ Error: Data unavailable

User: get_recovery_rates('sub-saharan-africa', useEstimateIfUnavailable=true)
→ Recovery Rate: 72.1% (estimated)
```

---

## Recommendation Pending

**Decision Deferred Until:**
- Phase 1 completion
- User testing feedback
- API reliability assessment
- Stakeholder input

**Questions to Answer:**
1. How often does the API actually fail? (Monitor for 1-2 weeks)
2. What do users prefer: estimate or error?
3. Is estimation formula accurate enough to be useful?
4. Do other financial data tools use fallback estimation?

**Data to Collect:**
- API uptime percentage
- Response time statistics
- Error rate by region
- User feedback on estimation accuracy

---

## Current Status

**Implementation:** Option 1 (Silent Fallback) is live

**Monitoring Needed:**
- Track how often fallback is used
- Compare estimated vs real values when both available
- User complaints about inaccurate estimates

**Next Review:** After Phase 1 complete (all 5 tasks done)

---

## Technical Details

### Where Fallback Occurs

**File:** `gems-risk-mcp/app/api/[transport]/route.ts`

**Lines:**
- 169-217: `getRecoveryRateData()` - Returns null on failure
- 219-225: `estimateRecoveryRate()` - Fallback formula
- 304-312: Decision point - real vs estimated

**Tools Affected:**
- `get_recovery_rates(region)` - Lines 401-410
- `query_credit_risk(region)` - Lines 448-460

### Easy to Change

The decision point is isolated to one location:

```typescript
// Current (Option 1)
const recoveryRate = realRecoveryRate !== null
  ? realRecoveryRate
  : estimateRecoveryRate(defaultRate);

// Could easily change to (Option 2)
if (realRecoveryRate === null) {
  throw new Error("Recovery rate data unavailable");
}
const recoveryRate = realRecoveryRate;

// Or (Option 3)
const recoveryRate = realRecoveryRate ?? "unavailable";
```

**Effort to change:** ~30 minutes

---

## Related Issues

**Similar Pattern in Code:**
- Default rates: Also falls back to mock data if API fails
- Sector analysis: Uses mock data (Phase 1 Task 2 will replace)
- Should we have consistent policy across all tools?

**Consistency Question:**
- If recovery rates fall back to estimates, should default rates?
- If sector analysis shows error, should recovery rates?
- Need unified fallback strategy

---

## Action Items (After Phase 1)

1. [ ] Monitor API reliability for 1-2 weeks
2. [ ] Compare estimated vs real recovery rates (accuracy check)
3. [ ] Survey users: prefer estimate or error?
4. [ ] Research industry best practices (financial data APIs)
5. [ ] Decide on unified fallback strategy for all tools
6. [ ] Implement chosen approach
7. [ ] Update documentation

---

**END OF REVIEW DOCUMENT**

**Status:** Flagged for review, not blocking current work
**Next Action:** Continue with Phase 1 tasks, revisit after completion
**Last Updated:** 2025-11-05
