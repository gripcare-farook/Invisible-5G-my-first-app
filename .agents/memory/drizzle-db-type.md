---
name: Drizzle db type — NodePgDatabase vs PostgresJsDatabase
description: The API server db instance is NodePgDatabase (node-postgres driver), not PostgresJsDatabase. Use NodePgDatabase<any> in helpers that accept the db argument.
---

# Drizzle db type in this project

The `lib/db` package uses `drizzle-orm/node-postgres`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
export const db = drizzle(pool, { schema });
```

This produces `NodePgDatabase<typeof schema>`.

**Rule:** Any helper that accepts `db` as a parameter must type it as `NodePgDatabase<any>` (from `drizzle-orm/node-postgres`), NOT `PostgresJsDatabase<...>`. Using `PostgresJsDatabase` causes TS2345 incompatibility on the `_.schema` property.

**Why:** The two Drizzle adapter types (`NodePgDatabase` vs `PostgresJsDatabase`) are incompatible at the type level even though they share the same query API. The error manifests as `dbName: "users"` not assignable to `dbName: never`.

**How to apply:** In any new `lib/activity.ts`-style helper, import from `"drizzle-orm/node-postgres"` and type the db parameter as `NodePgDatabase<any>`.
