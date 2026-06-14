---
name: Role-based auth expansion
description: Lessons from expanding the auth system to 4 roles (admin, transport, labour_contractor, labour_worker).
---

**Rule 1 — Rebuild lib before typecheck:** After changing a Drizzle schema enum in `lib/db/src/schema/users.ts`, you must run `pnpm run typecheck:libs` (which runs `tsc --build`) BEFORE running leaf-package typechecks. The `@workspace/db` package is composite and emits to `dist/`; without rebuilding, downstream packages see the old enum type.

**Rule 2 — Mobile numbers as usernames:** The `email` column in `usersTable` doubles as a username field. Non-admin users log in with their mobile number (e.g. "8122676635") stored in the `email` column. The login form input must be `type="text"`, not `type="email"`, to accept mobile numbers.

**Rule 3 — Render-time navigate:** Never call `navigate()` synchronously during React render. Wrap in `useEffect` to avoid "Cannot update a component while rendering a different component" error.

**Rule 4 — Static user seeding:** Non-admin users (transport, labour_contractor, labour_worker) are seeded with hardcoded credentials in `seed.ts` (mobile number + default "admin" password), not from env vars. Only admin comes from ADMIN_EMAIL/ADMIN_PASSWORD secrets.

**Rule 5 — rolesDashboard helper:** Export a `roleDashboard(role: UserRole): string` helper from `auth-context.tsx` to centralize the role → URL mapping so LoginPage, App.tsx redirect logic, and any nav component all use the same mapping.
