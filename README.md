# MakNotes

A mobile-first, installable personal operating system: daily planner, journal, notebooks,
S Pen handwriting and sketching, tasks, calendar, habits, goals, projects, focus timer and
honest analytics — built around **one workspace per day**.

**Live:** https://makramshmait2004-byte.github.io/MakNotes/ · **Setup:** [docs/SETUP.md](docs/SETUP.md)

## Stack
React 18 + TypeScript + Vite · Tailwind CSS + shadcn/ui-style components (Radix) · Lucide ·
Zustand · TanStack Query · Tiptap · Dexie (IndexedDB) · HTML Canvas + Pointer Events ·
vite-plugin-pwa · Supabase (Postgres, Auth, Storage, Realtime, RLS, pg_cron) · GitHub Actions + Pages.

## Architecture
- **Local-first data** (`src/data`): every write goes to IndexedDB first, then a persistent
  outbox is pushed to Supabase. Pulls are incremental by server `updated_at`; Realtime pushes
  changes from your other devices instantly.
- **Conflict handling**: updates are conditional on the server version
  (`update … where updated_at = base`). If another device changed the row, a three-way merge
  applies non-overlapping field edits automatically; true conflicts are parked and shown in
  *Settings → Sync* with "keep this device / keep other device". Nothing is silently overwritten.
- **No duplicates**: rows with natural keys (one daily page per date, one habit log per day,
  settings, tags) use deterministic UUIDv5 ids, so two offline devices converge on the same row.
- **Soft deletes** (`deleted_at`) propagate to all devices; a pg_cron job purges them after 30 days.
- **Security**: RLS on every table (`user_id = auth.uid()`), composite foreign keys
  `(parent_id, user_id)` so child rows can never reference another user's parent, private
  storage buckets scoped to `<user_id>/…`, `user_id` immutable by trigger.
- **Ink engine** (`src/features/sketch`): pressure-sensitive outlines from coalesced pointer
  events, streamlining, pen-only mode with best-effort palm rejection, S Pen side button =
  eraser, lasso select/move/recolor, undo/redo, pinch zoom/pan, paper styles, PNG export.
  Strokes are stored as editable vectors (`drawing_strokes.points = [x, y, pressure, …]`).
- **Dates** are plain `YYYY-MM-DD` strings computed in the user's timezone (default
  Asia/Beirut), so no UTC shift ever moves an entry to the wrong day.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm run typecheck` | TypeScript |
| `npm test` | unit + integration tests (Vitest, fake IndexedDB, in-memory Supabase) |
| `npm run e2e` | end-to-end tests (Playwright, desktop + Galaxy viewport) |
| `npm run build` | production build → `dist/` |
| `npm run icons` | regenerate PWA icons |

## Known platform limits (honest)
- **Reminders** fire while MakNotes is open or in the background. A web app cannot wake itself
  when fully closed without a push server; reminders due while closed appear on next open.
- **PDF export** uses the system print dialog ("Save as PDF"), which works on Android Chrome
  and desktop and renders Arabic correctly.
- **Palm rejection** is best-effort: browsers expose pointer type and contact size, not true
  palm detection. Pen-only mode (auto-enabled when an S Pen is detected) is the reliable option.
- **Backups** (JSON) contain all records; binary attachments stay in your private Storage.
