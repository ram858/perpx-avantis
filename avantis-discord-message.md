# Message for Avantis Discord Team

## Version 1: Detailed (For Support Channel or GitHub Issues)

---

**Subject: SDK Integration Issues - Position Opening Failures**

Hi Avantis team,

I'm experiencing issues with the SDK integration for programmatic position opening. I've reviewed the documentation but am encountering persistent validation errors.

**Current Issues:**

1. **Transaction Execution Order & Validation**
   - When opening positions via SDK, the USDC transfer executes successfully first
   - However, leverage parameter validation fails after the transfer completes
   - Since the transaction doesn't revert, funds remain locked in the contract without a position being created
   - This creates a state where capital is committed but no position exists

2. **BLEOW_MIN_POSITION Error**
   - After fixing leverage parameter issues, I'm still encountering `BLEOW_MIN_POSITION` errors
   - This occurs when attempting to open positions with $15 USD or higher
   - The error persists despite following the documented position size requirements

**What I've Tried:**
- Reviewed and implemented SDK documentation for position opening
- Verified leverage parameters match contract requirements
- Tested with various position sizes above the apparent minimum threshold
- Confirmed USDC approval and balance are sufficient

**Questions:**
1. What is the exact minimum position size requirement for the mainnet contract?
2. Are there additional validation checks in the main UI that aren't documented in the SDK?
3. What's the recommended approach to handle the transaction execution order issue (transfer before validation)?
4. Is there a way to query the contract for minimum position requirements programmatically?

I'd appreciate any guidance on these issues or if there are known differences between the web UI and SDK implementations.

Thank you.

---

## Version 2: Concise (For Discord Chat)

---

**SDK Position Opening Issues**

Hi team, experiencing two issues with SDK integration:

1. **Transaction execution order**: USDC transfer succeeds first, then leverage validation fails. Transaction doesn't revert, leaving funds locked without a position. Any workaround for this execution order?

2. **BLEOW_MIN_POSITION error**: Getting this error with $15+ positions even after fixing leverage params. What's the exact minimum position size on mainnet?

I've followed the SDK docs and verified leverage/approvals. The web UI works fine, so wondering if there are undocumented validations or different requirements for SDK vs UI.

Thanks!

---

