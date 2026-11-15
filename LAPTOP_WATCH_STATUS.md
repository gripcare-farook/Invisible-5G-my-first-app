# Laptop Watch status

**Updated:** 2026-11-15  
**Branch:** `feature/laptop-watch`  
**Latest Laptop Watch code commit:** `80f5b91` - `fix: harden laptop deal comparison and dependencies`  
**Earlier feature commits:** `d865a6c`, `d308a24`, `e4f3c78`

## 1. Completed work

The existing Laptop Watch implementation remains in place: nine exact US catalog listings, verified price and stock history, per-account follows and targets, deterministic target/drop/history-low/restock alerts, invite-only friend accounts with server-side business-data isolation, private user-reported observations, rate-limited retailer retry, Web Push/inbox delivery, hourly Render job configuration, and idempotent history import. These cloud and phone behaviors have not been verified against production.

This continuation adds a fail-closed cross-border savings evaluator in `artifacts/api-server/src/laptop-watch/cross-border.ts`. It:

- Uses the lowest supplied verified, purchasable, new Indian offer with matching structured configuration, a regional-SKU equivalence evidence link, source link and recent checked time.
- Calculates savings as `(India price - complete USA acquisition cost in INR) / India price x 100`.
- Includes US product price, US sales tax, US shipping, USD/INR exchange rate, forex fees, delivery to India, customs/duties, and other acquisition costs. Unknown amounts do not become zero; zero is accepted only as a sourced, checked "not applicable" entry.
- Separates confirmed from estimated savings and only sets `meetsThirtyPercent` for a confirmed result of at least 30%. Struck-through retailer prices are not part of the input model.
- Requires the caller to supply a freshness window; no production cutoff has been selected or hardcoded. The result retains India/US warranty details.

Tests cover the formula, the lowest comparable India offer, cost components, estimated versus confirmed results, unknown customs, mismatched configuration/condition, stale evidence, and savings below 30%.

This evaluator is not yet connected to a database, API route, dashboard, retailer feed, or notification rule. The India-versus-USA comparison is therefore **not implemented end to end**. No India offer was invented or stored.

Dependency fixes update vulnerable development/build-tool transitive packages to patched versions within their existing major versions, update Vite to the patched 7.3 line, and update Orval from 8.5.3 to 8.22.0. The lockfile was regenerated. No dependency installation scripts were bypassed in the final install.

Commit `80f5b91` contains only the cross-border evaluator/tests and dependency manifests/lockfile. Pre-existing calculator, Google Sheets, dashboard, and related test changes remain staged or unstaged in the worktree and were excluded from this commit. Nothing was pushed to `main`; nothing was deployed.

## 2. Final checks

Checks ran with Node 22.16.0 and pnpm 11.5.1:

- `node scripts/test-laptop-watch.mjs`: **21 rule/extraction tests and 10 isolated PGlite/API integration tests passed**. The test database is local and isolated; no Neon database was used.
- Existing calculator/business regression tests: **25 passed** (`mobile-number`, Sheets sync, OCR parser, vertical-channel calculations, and profit summary).
- Workspace library, API-server, web, and mobile-app TypeScript checks: **passed** using the workspace TypeScript compiler directly.
- Orval's generated-client codegen was not run. The updated Orval package declares Node `>=22.18.0`, while the installed runtime is 22.16.0; that developer-only codegen path remains unverified.
- API-server production build: **passed**.
- Web production build: **passed**. Vite emitted its existing large JavaScript chunk warning (about 712 kB minified) and Zod annotation-comment warnings; the bundle completed successfully.
- Production dependency audit: **zero known vulnerabilities**.
- Full workspace dependency audit: **22 findings remain** (5 low, 14 moderate, 3 high, 0 critical). The audit exits nonzero because of the remaining high findings below. It previously reported 155 findings (13 critical); patched, compatible upgrades removed the critical findings and most high findings.

### Remaining high dependency findings

- `decode-uri-component@0.2.2`, through `query-string@7.1.3` in the development-tool dependency graph, is vulnerable to quadratic-time processing of malformed percent-encoded input. The fixed `decode-uri-component@0.5.1` is ESM-only, while `query-string@7` is CommonJS. Forcing that transitive upgrade risks breaking the current consumer; moving the parent to the ESM-only `query-string@9` requires a separate compatibility change. This dependency is not in the production audit graph.
- `image-size@1.2.1`, used by Metro 0.83.3/0.83.6 for React Native development/build tooling, has two high denial-of-service advisories. Although the audit metadata lists `2.0.3` as patched, the upstream release list currently ends at `2.0.2`, and the GitHub advisory-database issue reports that `2.0.3` was never published. Version 2 also drops the synchronous API used by existing consumers. No unverified override was applied. This affects mobile bundling when processing crafted image input, not the deployed API dependency graph.

Other audit fixes include the critical Orval code-generation findings and the `shell-quote`/`tar` findings in Expo/React Native tools. The targeted upgrades were followed by passing type checks and production builds.

## 3. Browser and phone verification

The browser access host reported unavailable when checked, so the local dashboard, login, role isolation, target settings, and notification-setup flow were **not visually/browser tested** in this session. Account isolation and target APIs have automated integration coverage, but that does not replace browser QA.

No physical Android or iPhone was available for a permission or push-delivery test. Handset delivery, notification tap-through, iOS Home Screen behavior, and Android delivery are **unverified**. Provider acceptance is not evidence of handset delivery.

## 4. AI deal review

AI deal review is **planned only; it is not implemented**. There is no OpenAI request, candidate selection, evidence cache, budget enforcement, AI-result validation, or AI recommendation alert. Existing deterministic target, price-drop, historical-low, and restock alerts continue to work independently.

Current official OpenAI API documentation lists the exact model identifier `gpt-6-astra` and the Responses API. Standard short-context text pricing is $10 per million input tokens and $50 per million output tokens. An illustrative request of 2,000 input and 400 output tokens would cost about **$0.04** before any other charges; this is not measured app usage. Expected monthly spend cannot be estimated until candidate-call frequency and budget caps are implemented and agreed. No API key or account-level model entitlement was available to verify here. No billable call was made and no alternate model was substituted.

Sources: [GPT-6 Astra model/API documentation](https://developers.openai.com/api/docs/models/gpt-6-astra) and [OpenAI API pricing](https://developers.openai.com/api/docs/pricing).

## 5. India-versus-USA comparison

The core calculation and its tests are present, but the feature is **not available in the app yet**. It has no India retailer retrieval, persistent India offer/cost records, comparison UI, comparison history, or cross-border alert. The existing dashboard still shows the tracked US price before tax and shipping. It does not show or claim 30% India savings.

The separate evidence-backed "good price" recommendation below 30% is also **not implemented**. Existing US target and deterministic price alerts remain. AI recommendations and their notification controls are not present.

## 6. Pending decisions and deployment blockers

The full comparison and good-price alert work needs these product choices before a safe end-to-end implementation:

1. **Acquisition route:** whether a friend will carry the laptop or it will be shipped to India. Customs must be checked for either route; carrying it does not default customs to zero.
2. **Indian retailer sources:** a source set for current, purchasable offers (for example Amazon.in, Flipkart, Croma, and Reliance Digital). The lowest price can only be claimed among sources that are actually checked.
3. **Evidence rules:** an acceptable offer freshness window and the definition of sufficient price history/comparable-offer advantage. A suggested option presented for review was offers no older than 2 hours, at least 5 verified new/in-stock observations over 90 days for history-based evidence, and a 3% lead over at least one other comparable offer. These are not enabled pending your decision.
4. **AI spending approval and access:** provide an explicit monthly API budget and confirm API account/model access before any billable GPT-6 Astra request is enabled. Add `OPENAI_API_KEY` only in Render's encrypted environment settings; do not send its value in chat.

Before deployment, review the feature commits, inspect the actual Render/Neon configuration, create/use a separate development Neon database, and apply the existing additive Laptop Watch migrations there first. No migration for the India comparison has been prepared because persistence and source rules are not yet finalized. Production database changes and deployment have not occurred.

Existing deployment configuration still requires the server-side secrets documented in `LAPTOP_WATCH_HANDOFF.md` (`DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN`, VAPID keys/subject, and `FIRECRAWL_API_KEY` for the worker). Enter them directly in Render's encrypted environment settings after approval; do not paste secret values into chat or source control. The Render cron and Firecrawl recurring costs documented in the handoff also require approval before provisioning. The full workspace audit's three high development-tool findings and the unverified browser/phone/cloud checks above remain open.

No production database was modified, no paid service was provisioned, no billable AI call was enabled, no live deployment occurred, and no local/PC automation was stopped.
