---
name: Transport module architecture
description: Key decisions for the transport/auth module added to the 5G Grille Calculator.
---

Auth uses express-session + bcryptjs. SESSION_SECRET is already a Replit secret. Users are seeded from 4 env vars at API server startup (ADMIN_EMAIL, ADMIN_PASSWORD, JAVITH_BAI_EMAIL, JAVITH_BAI_INITIAL_PASSWORD) — if any are missing, that user is silently skipped.

**Why:** No OAuth provider; simple credential seeding keeps the driver workflow self-contained without an admin UI for user management.

**How to apply:** To add more users, add new env var pairs and extend seedUsers() in `artifacts/api-server/src/lib/seed.ts`.

ShippingMode "route" uses shippingCostManual under the hood — calcTransport() result is passed as transportCostOverride to settingsToSharedInputs(), so transport total flows into project totals without a separate useEffect.

Expo Metro crash fix: installing react-router-dom at workspace level causes Metro to watch a temp dir that gets deleted. Fixed by adding a blockList regex in `artifacts/grille-calc/metro.config.js`:
```js
blockList: [...blockList, /node_modules\/.*react-router.*_tmp.*/]
```
