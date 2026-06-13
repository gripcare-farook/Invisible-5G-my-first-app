---
name: Drizzle + Express 5 param typing
description: TS error when passing req.params values to drizzle eq() — must cast to string first.
---

**Rule:** Always cast Express route params to `String()` before passing to drizzle `eq()`:
```typescript
const id = String(req.params["id"]);
```

**Why:** Express 5 types req.params values as `string | string[]` in some configs, but drizzle's `eq()` only accepts `string | SQLWrapper`. TypeScript TS2769 "no overload matches" error results.

**How to apply:** Any time you destructure `req.params` and use the value in a drizzle `where(eq(...))` clause, use `String(req.params["key"])` instead of `const { key } = req.params`.
