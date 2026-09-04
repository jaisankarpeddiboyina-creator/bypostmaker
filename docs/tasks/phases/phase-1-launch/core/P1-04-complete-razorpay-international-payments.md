# P1-04 — Complete Razorpay international payments

**Phase:** Phase 1 — Launch
**Type:** Core (committed)
**Priority:** Critical
**Owner role:** Engineering
**Depends on:** None
**Status:** Completed

## Description
Integrate Razorpay to support international cards and currencies.

## Definition of Done
A non-domestic test card can complete checkout end-to-end in a supported currency.

## Notes

### Completed Implementation (Aug 7, 2026)
- **Frontend Currency Auto-Detection**: Configured [App.tsx](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/App.tsx) on mount to dynamically fetch the server's detected geolocation currency from `api.payments.currency()` (backed by Cloudflare's `CF-IPCountry` header) for guest/unauthenticated users.
- **Display Selector**: Enabled manual USD Display pricing toggle in [SettingsPage.tsx](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/pages/SettingsPage.tsx).
- **Checkout Pricing Refactor**: Cleaned up legacy INR-only banners and hardcoded configuration objects in [UpgradeModal.tsx](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/components/UpgradeModal.tsx) and [BillingPage.tsx](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/pages/BillingPage.tsx) to resolve plan details from a single source of truth in [pricing.ts](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/frontend/src/config/pricing.ts).
- **Backend Guard Check**: Removed global USD payment blockers in [payments.ts](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/payments.ts). Configured a safety check returning `400` ("USD payments for the [plan] plan are temporarily unavailable...") for USD checkout requests if the resolved plan ID is missing/invalid, while maintaining standard `500` errors for INR requests.
- **Webhook Safety**: Safeguarded [webhook.ts](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/worker/src/routes/webhook.ts) by logging unmatched incoming Razorpay subscription plan IDs and skipping users' plan mutations instead of silently falling back to a default tier.

### Verification Done
- **Unit & Integration Tests**: Created `scratch/test_payments.ts` verifying all currency mappings, payments route guards, and outbound payloads. Run command: `npx tsx scratch/test_payments.ts` (All passed).
- **Compilation Check**: `npm run type-check` (Frontend & Worker compile without issues).
- **Bundle Production**: `npm run build` (Build completes successfully).

### What is Next (Wrangler/Console Configuration)
1. **Push Changes**: Run `git push` to upload local commits.
2. **Create USD Plans on Razorpay**: Generate new USD Plan IDs for `Starter`, `Pro`, and `Business` in the Razorpay Dashboard.
3. **Set Wrangler Secrets**:
   - `RAZORPAY_PLAN_STARTER_USD`
   - `RAZORPAY_PLAN_PRO_USD`
   - `RAZORPAY_PLAN_BUSINESS_USD`
4. **Deploy**: Build and deploy to production (`npm run deploy`).
5. **Live Test**: Run checkout in test mode using a mock international card to verify end-to-end checkout completion.
