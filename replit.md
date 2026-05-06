# 5G Invisible Grille Smart Calculator

Contractor quoting tool for 5G invisible grille installations — calculates rope, channels, fasteners, stiffeners, labour, shipping, and profit per project. Supports multi-opening layouts, INR pricing, WhatsApp sharing, and Google Sheets sync. Based in Tambaram, Chennai.

## Run & Operate

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/grille-calc-web run dev` — run web app locally
- `pnpm --filter @workspace/grille-calc run dev` — run Expo app locally

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24 / TypeScript 5.9
- **Web app**: React + Vite + Tailwind v4 + lucide-react (localStorage)
- **Mobile app**: Expo Router + React Native (AsyncStorage)
- **API**: Express 5 + PostgreSQL + Drizzle ORM
- **Build**: esbuild (CJS bundle)

## Where things live

- `artifacts/grille-calc-web/` — React+Vite web app at `/grille-calc-web/`
  - `src/lib/calculations.ts` — all calculation logic (source of truth)
  - `src/lib/storage.ts` — Settings + SavedProject types, localStorage helpers
  - `src/lib/sheets.ts` — Google Sheets sync payload builder + fetch
  - `src/lib/share.ts` — WhatsApp share text builder
  - `src/pages/CalculatorPage.tsx` — main calculator UI
  - `src/pages/ProjectsPage.tsx` — saved projects list
  - `src/pages/SettingsPage.tsx` — defaults + Apps Script URL
  - `google-apps-script/Code.gs` — Apps Script to paste into Google Sheets

- `artifacts/grille-calc/` — Expo mobile app
  - `lib/calculations.ts` — mirror of web calculations
  - `lib/storage.ts` — AsyncStorage helpers, Settings, SavedProject
  - `lib/share.ts` — React Native Share wrapper
  - `app/(tabs)/index.tsx` — calculator screen
  - `app/(tabs)/projects.tsx` — saved projects screen
  - `app/(tabs)/settings.tsx` — settings screen
  - `components/` — OpeningCard, LabeledInput, Section, Segmented, StatRow

## Architecture decisions

- Calculations are duplicated between web and Expo (not shared lib) to avoid Expo Metro bundler issues with the pnpm workspace
- Google Sheets sync uses `no-cors` fetch + `text/plain` Content-Type — response is always opaque so UI shows "verify in sheet" message
- Connector cost is shown in UI but excluded from all Google Sheets payloads (business rule)
- Stock item codes are fixed: `SSWIRE_2MM`, `CHANNEL_STD`, `FASTENER_STD`, `STIFFNER_STD`
- Fastener qty = total channel feet (1 fastener per foot of channel)

## Product

- **Calculator** — multi-opening project with per-opening breakdown (rope lines, channel pcs, fasteners, stiffener meters, subtotal)
- **Grand Total** — combined materials + shipping + misc + profit vs. selling price
- **Save** — localStorage (web) / AsyncStorage (mobile), load/delete from Projects tab
- **WhatsApp Share** — formatted quotation text with project name, notes, all costs
- **Google Sheets Sync** — saves to Projects, OpeningDetails, WeeklySettlement sheets; deducts from Stock sheet
- **Notes** — freeform per-project notes, shown in WhatsApp share and synced to Google Sheets
- **New Project** — reset button (web header, mobile reset icon) clears all fields

## User preferences

- INR currency throughout
- Base: Tambaram, Chennai; default gap 2", stiffner ₹2/piece
- Connector cost: keep in UI but exclude from all Google Sheets outputs
- Misc cost is the single extra expense bucket

## Gotchas

- Do not run `pnpm dev` at workspace root — use `restart_workflow` or preview pane
- Web app tab switching unmounts/remounts components — settings reload on Calculator tab return is handled automatically
- Apps Script must be deployed as: Execute as Me, Access: Anyone (not "Anyone with Google account")
- Stock sheet deduction skips items with qty ≤ 0 silently

## Pointers

- Calculations source of truth: `artifacts/grille-calc-web/src/lib/calculations.ts`
- Apps Script deployment guide: `artifacts/grille-calc-web/google-apps-script/Code.gs` (top comment)
