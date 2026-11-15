# Laptop Watch deployment handoff

## Implemented

Nine original exact USA listings, deterministic MVP extraction with tighter system-RAM/SSD/GPU checks, shared PostgreSQL catalog/history, per-account follows/targets/preferences, merged inbox alerts, Web Push, single-use 48-hour revocable invites, protected detail routes, hourly independent Render job, failure visibility and idempotent read-only PC export/import. Manual retailer retry is limited to one request per listing per 10 minutes. User-reported observations are private, timestamped, separate from verified prices, and never create deal alerts. Repeated retrieval failures are shown as one streak warning.

Friends get `laptop_watch` accounts. A central backend allowlist rejects their business API requests; admin-only invitation operations also enforce roles. Account identifiers come from the server session. Invite tokens are stored as SHA-256 hashes, sent in URL fragments and consumed atomically. Login regenerates sessions; sessions persist in PostgreSQL. New API writes require the app origin. Push endpoints are restricted to known browser providers to prevent SSRF.

No production deployment or paid resource has been created. The existing working tree had calculator/Sheets/dashboard changes before this task; these remain separate and must not be accidentally included in Laptop Watch commits.

## Review and local checks

- Feature branch: `feature/laptop-watch` (based on the existing `codex/customer-calculator-bridge` checkout, preserving its work).
- Node 22 and pnpm 11.5.1; `packageManager` is pinned.
- `node scripts/test-laptop-watch.mjs`: fixture/rule tests and real isolated PostgreSQL WASM (PGlite) integration tests. No `DATABASE_URL`, Neon credentials or production data are used by these tests.
- `node --test tests/mobile-number.test.mjs tests/sheets-sync.test.mjs tests/vertical-channel.test.mjs tests/ocr-parser.test.mjs tests/profit-summary.test.mjs` on Node 22.
- `pnpm run typecheck:libs`, then API/web/mobile typechecks.
- `pnpm --filter @workspace/api-server build` and `BASE_PATH=/ pnpm --filter @workspace/grille-calc-web build`.
- Browser UI/mobile visual testing remains necessary: the computer-use browser host was unavailable during implementation. Physical Android/iPhone push delivery is unverified. PGlite does not replace final Neon connection, cross-process lock, cron or phone verification.

## Before deployment approval

1. Review the feature commits. Do not push/merge `main` until deployment is approved. This repository's `main` is connected to live Render auto-deploy.
2. In Render, inspect `grille-calc`'s actual plan, branch, build/start commands, environment and health check. Repository `render.yaml` says free; account configuration was not accessible in this session and may differ.
3. Create/use a separate development Neon database/branch for a hosted rehearsal. Do not run tests against `grille_calc` production. PGlite tests already provide an isolated local development database.
4. Apply the additive migration to that development database, run a web instance against it, verify login/invites and phone-sized layouts, and exercise separate worker processes with a **direct, unpooled Neon connection**.
5. Confirm paid budget and securely configure secrets below. The connected Codex Firecrawl tool is not a server API key.

## Database migration

Back up production first and verify the selected Neon project/database in its console. Base `users` and `notifications` tables must already exist. With `DATABASE_URL` set securely to the intended environment:

```sh
node scripts/laptop-watch-db.mjs migrate
```

This applies `lib/db/migrations/0001_laptop_watch.sql`, creating only `lw_*` tables/indexes and the persistent `session` table, then seeds catalog metadata (no invented observations/prices). It is repeatable. It does not delete, rewrite or test business/customer data. Roles are text in the existing schema, so no destructive enum conversion is needed.

`render.yaml` deliberately removes automatic `drizzle-kit push` from the build. Run the reviewed migrations **before** deploying the new web code, not automatically during a production build. `scripts/laptop-watch-db.mjs migrate` applies `0001_laptop_watch.sql` and `0002_laptop_manual_checks.sql`. Future schema changes need explicit migrations. Existing users will log in again when moving from the old in-memory session store.

## Server configuration

| Setting             | Web service                                                          | Hourly cron                                                               |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`      | Existing Neon database; pooled allowed                               | Same database, **direct/unpooled URL** required for session advisory lock |
| `SESSION_SECRET`    | Required strong stable secret, preserve existing value               | Not needed                                                                |
| `APP_ORIGIN`        | `https://grille-calc.onrender.com` (exact origin, no trailing slash) | Not needed                                                                |
| `VAPID_PUBLIC_KEY`  | Required                                                             | Same value                                                                |
| `VAPID_PRIVATE_KEY` | Required secret                                                      | Same secret                                                               |
| `VAPID_SUBJECT`     | Valid `mailto:` owner contact or HTTPS URL                           | Same value                                                                |
| `FIRECRAWL_API_KEY` | Not needed                                                           | Required server API key                                                   |
| `NODE_VERSION`      | 22.16.0 or compatible newer Node 22                                  | Same                                                                      |

Generate VAPID keys once using `node scripts/generate-laptop-vapid.mjs`. It writes an ignored local env file without printing keys. Copy values directly into Render's secret settings. Keep a secure backup; rotating keys requires devices to subscribe again. Public VAPID key is intentionally returned to authenticated browsers; private key never leaves the server.

Use `render.laptop-watch.yaml` as a separately approved cron Blueprint. UTC `0 * * * *`; command `node artifacts/api-server/dist/laptop-watch-job.mjs`. It runs independently of the sleeping web service. Do not provision it until paid-service approval. Use the reviewed feature revision for staging, then the approved production revision.

The worker takes a PostgreSQL advisory lock using a dedicated direct connection. A concurrent worker exits without running checks. Each retailer gets at most two retrieval attempts (45-second provider timeout, 55-second client deadline per attempt). One failure records an error and retains the last observation. Push deliveries use atomic database claims, at most three attempts, one-hour retry spacing; 404/410 subscriptions are removed while delivery records remain. Provider acceptance is not proof of handset delivery. An ambiguous send/crash can retry; the stable notification tag replaces duplicate displayed notifications where supported.

## Recurring costs — quote before provisioning

Verified official pricing on 2026-11-14:

- [Render cron jobs](https://render.com/docs/cronjobs): metered running time, minimum **US$1 per month per cron service**. Actual cost can exceed the minimum with slow retailer checks. Existing web service billing is unchanged by this feature's configuration.
- [Firecrawl pricing](https://www.firecrawl.dev/pricing): basic scrape is 1 credit/page. Hobby monthly is **US$19/month for 5,000 credits**, with **1,000 extra credits per US$5** on paid plans. Nine hourly listings need 6,480 credits over 30 days before retries: about **US$29/month** with two extra blocks. If every check uses both billable attempts, 12,960 credits would be about **US$59/month** (eight extra blocks). Confirm current account entitlements, credit billing and a spend cap before enabling paid overages. No paid subscription or overage setting was changed.
- Neon: uses the existing project, but hourly compute wakeups, storage and a development branch can affect quota/billing. Actual plan and remaining allowance require account access; no zero-cost claim is made.
- Standard Web Push requires no separate messaging subscription. No WhatsApp/email delivery integration exists.

## Acceptance after approval

1. Deploy web after migration. Verify `/api/healthz`, existing calculator, business dashboard, customer projects and Google Sheets sync using appropriate test data in staging first.
2. Log in as owner → **Laptop Watch** → follow a laptop → set target and preferences. Prices are USD before tax/shipping; stale and failed checks are explicit.
3. Create invite → copy link → share it yourself. Friend accepts with name/email/password then logs in. Verify a friend receives 403 from business endpoints and cannot create/revoke owner invites or access another account's preferences/inbox.
4. Trigger one real cron run with the API key. Inspect persisted `lw_runs`, `lw_checks`, `lw_observations`, provider errors and timestamps. The fixture prices are historical test evidence and are never seeded as current offers.
5. **Wait for an actual automatic hourly run**, compare Render Runs evidence with a new database `lw_runs` record and listing checks. Do not claim scheduling works based only on the manual run.
6. Android: Chrome → install/add to Home Screen → log in → Enable notifications. iPhone: iOS 16.4+ → Safari Share → Add to Home Screen → open installed app → log in → Enable notifications. Permission must be granted by each person on each phone. [WebKit guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Chrome/Web Push flow](https://web.dev/articles/push-notifications-subscribing-a-user).
7. On each actual phone, press **Send test notification**, close the dashboard, confirm the notification arrives and tapping it opens the protected laptop page (or login then that page). Test permission denial, logout and an expired subscription. Record Android and iPhone results separately; desktop/browser simulation is insufficient.
8. Inspect overdue monitoring, failed retailer checks and delivery statuses in the UI. There is no promise of real-time delivery while the free web service wakes; the cron sends independently, but opening a detail page may incur Render cold-start latency.

## Import old PC history later

After approval and a backup, stop the local tracker server briefly, export read-only, restart it until cloud handover is proven:

```sh
python scripts/export-laptop-history.py <old-tracker.db> <private-laptop-export.json>
node scripts/laptop-watch-db.mjs import <private-laptop-export.json>
```

Use a private path outside the repository for DB and export. Import validates listing, integer USD cents, seller, condition, stock and timezone-aware timestamps; it computes a stable content receipt and uses `ON CONFLICT DO NOTHING`. Reimport creates no duplicates. Old observations do not replace newer ones and never generate retrospective push alerts. Invalid data rolls back the import. No old history was accessible/imported in this session.

Only after successful automatic cloud checks, confirmed phone delivery and owner approval, pause the existing Codex automation **Laptop Watch — hourly price and stock checks** in Codex's automation settings. Also disable any local tracker schedule if it had been enabled. Neither was changed here.

## Rollback

Suspend the cron first. Redeploy the previous approved web revision. Preserve all new tables and history; this is the default non-destructive rollback. Old business tables are unchanged. Keep database backup and VAPID keys. If rolling back sessions, users may need to log in again. Do not run `drizzle push` from the old revision: it can propose dropping the new tables. Do not delete `lw_*` tables or imported history without explicit approval and backup. Previously installed service workers cache no API data and cannot expose private detail pages without backend authentication.

## Outstanding verification

Actual Render account/plan and Neon dev/prod settings; live retailer retrieval through the cloud API; direct-Neon multi-process lock behavior; visual/mobile browser QA; actual automatic scheduled run; Android and iPhone handset delivery; PC history migration. No production deployment or old automation shutdown is claimed.

## Dependency audit findings and disposition

On 2026-11-15, the production audit reported no known vulnerabilities. The prior Zod high advisory was fixed by updating the workspace catalog to Zod 4.6.6+ (lock resolved 4.6.7); `drizzle-zod@0.8.3` accepts Zod 4 and application code uses no Zod 3-only API. Compatible prior fixes remain: `proxy-addr@2.0.8`, `body-parser@2.4.0`, `qs@6.16.1`, `path-to-regexp@8.4.0`, and React Router `7.18.2`. A full development-dependency audit did not complete in this environment; only the production audit completed successfully.

## Manual checks and deal policy status

Manual retry requires a latest automatic failure, retains the prior verified observation on failure, records a successful retailer retrieval through the normal verified pipeline, and is globally rate-limited per listing for 10 minutes. Manual user-reported prices use `lw_manual_observations`, are account-private, and cannot overwrite verified history or trigger alerts. Migration `0002_laptop_manual_checks.sql` adds both storage tables. No retailer crossed-out price is currently used as a discount baseline.

The remaining 30% reference-price and cross-retailer deal thresholds are awaiting owner approval. Proposed: same exact configuration, seller and new condition; at least five verified in-stock observations over the prior 90 days; median as reference; ignore retailer struck-through prices. Proposed cross-retailer evidence requires at least two same-configuration new/in-stock offers, checked within two hours, with at least a 3% price advantage; a tracked low alert uses a 1% improvement, and repeat alerts require a 1% actual price change. These values must not be enabled until the owner confirms or revises them.

## GPT-6 Astra status

Official OpenAI documentation lists API model ID `gpt-6-astra`, available through the Responses and Chat Completions endpoints. Standard short-context text pricing is $10 per million input tokens and $50 per million output tokens. An illustrative 2,000-input/400-output-token review would cost about $0.04; 125 such calls are about $5 and 250 are about $10. This estimate is an assumption, not measured usage. ChatGPT/Codex model access does not provide a deployed API key. No `OPENAI_API_KEY` was present in the local process environment, so account-level API access could not be verified. No AI integration or billable API call has been enabled; wait for an approved monthly budget and the pending deal-policy decision. The key belongs only in Render's encrypted environment settings, never in source code or the browser.

The new Laptop Watch suite passed 16 extraction/rule tests and 10 isolated PGlite integration tests, including manual observation privacy, verified-price preservation and retry throttling. Existing app regression tests passed 25/25. Library, API, web and mobile typechecks passed; API and web production builds passed (the web build reports its existing large-chunk warning). The production dependency audit passed with zero known vulnerabilities. Browser access was unavailable again, so no visual dashboard/login/target/notification setup QA is claimed. Cloud checks, automatic schedule, Neon connection, push delivery on physical phones, and history import remain unverified until staging/deployment.
