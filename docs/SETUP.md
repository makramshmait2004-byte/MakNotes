# MakNotes — setup (doable entirely from your phone)

MakNotes needs one free Supabase project. Everything else (database tables, security
policies, storage buckets, auth redirect URLs, build and deploy) is automated by
GitHub Actions in this repository.

## 1. Create the Supabase project (≈2 minutes)
1. Open **supabase.com** → sign in (GitHub login works) → **New project**.
2. Name: `MakNotes`. Choose a strong **database password** and keep it.
   Region: *Central EU (Frankfurt)* is closest to Beirut. Plan: **Free**.
3. When it's ready open **Project Settings → API** and note:
   - **Project URL** — `https://<ref>.supabase.co` (the `<ref>` part is the *project ref*)
   - **anon / publishable key**
4. Open **supabase.com/dashboard/account/tokens** → **Generate new token** → copy it.

## 2. Give GitHub the values
In **github.com/makramshmait2004-byte/MakNotes → Settings → Secrets and variables → Actions**:

**Secrets** tab (private, used only by the setup workflow):
| Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | the token from step 1.4 |
| `SUPABASE_PROJECT_REF` | the `<ref>` from your Project URL |
| `SUPABASE_DB_PASSWORD` | the database password |

**Variables** tab (public by design — shipped to the browser, protected by Row Level Security):
| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | the anon / publishable key |

> Never put the `service_role` key anywhere in GitHub or the app.

## 3. Turn on GitHub Pages
**Settings → Pages → Build and deployment → Source: GitHub Actions.**

## 4. Run the workflows
**Actions** tab:
1. **Supabase setup (database, security, storage)** → *Run workflow*. This applies
   `supabase/migrations`, sets the auth redirect URLs to the GitHub Pages site, runs the
   cross-user isolation test (`supabase/tests/rls_isolation.sql`) and generates TypeScript types.
2. **CI & Deploy** → *Run workflow* (it also runs on every push to `main`). It type-checks,
   runs unit + end-to-end tests, builds and publishes to
   **https://makramshmait2004-byte.github.io/MakNotes/**.

## 5. Install on your Samsung
Open the site in **Chrome** → create your account → confirm the email → tap **⋮ → Add to Home
screen** (or **Install app**). MakNotes then opens full-screen like a normal app and works offline.

## Hosting on Vercel instead of GitHub Pages
1. **vercel.com** → sign in with GitHub → **Add New… → Project** → import **MakNotes**.
   Vercel reads `vercel.json` (Vite, `npm run build`, output `dist`) — leave the defaults.
2. Before deploying, open **Environment Variables** and add (Production + Preview):
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the anon / publishable key |
   | `VITE_ENABLE_GOOGLE` | `false` (or `true` once Google is set up) |
3. **Deploy.** You get an address like `https://maknotes.vercel.app` (the app is served from the root there).
4. In GitHub add the repository variable `SITE_URL` = that address (with a trailing `/`) and run
   **Supabase setup** again, so sign-up / password-reset emails link back to Vercel.
   (Manual alternative: Supabase → Authentication → URL Configuration → Site URL + Redirect URLs.)
5. On your Samsung open the Vercel address in Chrome → ⋮ → **Add to Home screen**.

Every push to `main` redeploys on Vercel automatically.

## Optional: Google sign-in
Supabase → Authentication → Providers → Google (needs a Google Cloud OAuth client; free).
Then add the GitHub variable `ENABLE_GOOGLE` = `true` and re-run **CI & Deploy**.

## Manual alternative (no workflow)
Supabase → **SQL Editor** → paste and run each file in `supabase/migrations/` in order.
Then Authentication → URL Configuration: Site URL `https://makramshmait2004-byte.github.io/MakNotes/`
and add the same URL with `**` to Redirect URLs.

## Local development
```bash
cp .env.example .env.local   # fill in URL + anon key
npm install
npm run dev                  # http://localhost:5173/MakNotes/
npm test                     # unit + integration tests
npm run e2e                  # end-to-end (in-memory backend build)
```
