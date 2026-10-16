# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

QSolicit is an internal tracker for incoming solicitations (requests from organizations for events). It's a React 19 + TypeScript + Vite SPA with no backend server of its own. Supabase handles auth, Postgres and edge functions. File attachments are stored in Cloudflare R2.

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b (type check) && vite build
npm run lint      # oxlint (config in .oxlintrc.json)
npm run preview   # serve the production build
```

There is no test suite. Run `npm run build` to type-check, since it fails on TS errors.

The Supabase edge functions run on Deno and are deployed with the Supabase CLI, e.g. `npx supabase functions deploy send-telegram`. Secrets are set with `npx supabase secrets set KEY=value`.

The frontend needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.

## Architecture

**Data access.** All database access happens from the browser through the Supabase JS client (`src/lib/supabaseClient.ts`) using the anon key. Access control relies on Supabase RLS policies, which live in the hosted database and are not in this repo: there is no `supabase/migrations` folder, and `db_dump.sql` is empty. Query helpers are grouped by table in `src/lib/`:
- `solicitations.ts`: the main `solicitations` table. It has server-side paginated, filtered and sorted queries (`fetchPaginatedSolicitations`), count-only dashboard queries, and CRUD. `fetchSolicitations` loads every row in pages of 1000 and is only used for the Excel export.
- `fieldConfigs.ts`: the `field_configs` table. It also holds a special sentinel row, `field_name = 'enable_excel_download'`, which is used as a boolean app setting. Its value is stored in `is_required`, and `fetchFieldConfigs` filters this row out.
- `telegram.ts`: the `app_settings` key/value table (for example `telegram_chat_id`), plus a call to the `send-telegram` edge function.
- `settings.ts`: the per-user `user_settings` table (`receive_notifications`).

**Active vs. history.** A solicitation is "history" when `status` is `'Done'` or `'Discontinued'`, and "active" otherwise. This rule is repeated in several queries in `solicitations.ts`, in the dashboard, and in `send-reminders` (which compares lowercased statuses). Keep them all consistent if statuses change. `/solicits` and `/history` render the same `SolicitationsPage` component with a different `showHistory` prop and `key`.

**Admin-configurable fields.** Superadmins edit `field_configs` rows on `/admin` (`AdminPage` / `FieldConfigSheet`). Each row sets a solicitation column's label, input type, select options, required flag, default value, and `color_mappings`. `SolicitationDialog` builds its form from these rows, and the list and detail views use `color_mappings` to color values (for example `control_number_color`). To add a solicitation field, add the DB column, the `Solicitation` interface field, and a `field_configs` row.

**Auth and roles.** `AuthContext` loads the Supabase session along with the user's row from `profiles` (`role: 'user' | 'superadmin'`) and exposes `isSuperAdmin`. Unauthenticated users see `<Auth />` and no routes. Superadmin-only nav items and pages check `isSuperAdmin` on the client.

**Edge functions (`supabase/functions/`, Deno):**
- `generate-r2-upload-url`: returns presigned R2 PUT URLs under `attachments/<uuid>.<ext>`. `FileUpload.tsx` uploads directly to R2 and then stores `{name, url, key}` in `solicitations.attachments` (JSONB).
- `send-telegram`: formats a solicitation and posts it to a Telegram chat with the bot token. Attachments are sent as captioned media.
- `send-reminders`: calls the `get_reminders_to_send` RPC, filters out done/discontinued items, and emails users through Gmail SMTP (nodemailer). Dates use Manila time (UTC+8). It has `verify_jwt = false` and its own import map, both set in `supabase/config.toml`, so it can be triggered by a scheduler.
- Shared CORS headers are in `_shared/cors.ts`.

**Backups.** `.github/workflows/db-backup.yml` runs `pg_dump` daily, uploads a gzipped dump to R2 under `backups/`, and deletes backups older than 7 days.

## Conventions

- Use the `@/` path alias for `src/` (configured in `vite.config.ts` and tsconfig).
- UI components are shadcn (`base-nova` style, built on `@base-ui/react` rather than Radix) in `src/components/ui/`. Add new ones with the shadcn CLI. Styling uses Tailwind v4 through `@tailwindcss/vite`, with theme tokens in `src/index.css`.
- Use `sonner` toasts (`toast(...)`) for user feedback.
- `check_status.js` is a standalone Node debugging script that prints the distinct `status` values. It is not part of the app.
