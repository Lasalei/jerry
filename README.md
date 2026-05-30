# Draktlager

Phone-first web app for tracking football jersey inventory and sales.

## Kom i gang (Phase 1 — local only)

```bash
npm install
npm run dev
```

Open the printed URL on your computer, or on your phone (same Wi-Fi) using the
**Network** URL Vite prints. Data is stored in the browser's `localStorage` on
that device — nothing leaves your machine yet (that's Phase 2).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck + production build into `dist/`
- `npm run preview` — preview the production build
- `npm run typecheck` — TypeScript check only

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- Fonts: Oswald (display) + Hanken Grotesk (body), accent **kit green** `#0B8457`

## Architecture

All persistence goes through **one module**: [`src/lib/db.ts`](src/lib/db.ts).
It exposes the async `DraktlagerDB` interface and a `db` singleton (currently the
localStorage implementation). Phase 2 swaps in a Supabase implementation of the
same interface — no other file changes.

```
src/
  lib/
    db.ts          ← persistence interface + localStorage impl (swap point)
    types.ts       ← domain model
    constants.ts   ← variants, sizes, channels, payments (Norwegian)
    format.ts      ← nb-NO currency/date formatting
    exporters.ts   ← JSON backup, sales CSV (semicolon), JSON import
    stats.ts       ← basic statistics
  components/      ← BottomNav, StylePicker, QtyStepper, StyleEditor, ui, Toast, Confirm
  screens/         ← NyttSalg, Lager, Logg, Mer
  store.tsx        ← React layer over db (state + actions + selectors)
  App.tsx          ← tab shell
```

## Domain model

- **Style** = one team/design (e.g. "Liverpool 24/25").
- **SKU** = style + variant + size → integer qty.
  - variants: Hjemme – Fan, Hjemme – Player, Borte – Fan, Borte – Player
  - sizes: S, M, L, XL, XXL, 3XL
- **Transaction** = a sale (`salg`) or giveaway (`gitt_bort`). Saving decrements
  stock; deleting restores it. Each item snapshots `styleName` so history
  survives style deletion.

## Phase 2 — Supabase (shared live data)

The app runs local-only until you add Supabase env vars. With them set, both
phones share one live dataset.

### 1. Create the project
1. Sign up at [supabase.com](https://supabase.com) and create a free project.
2. Wait for it to finish provisioning.

### 2. Create the schema
1. In the dashboard go to **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and **Run**.
   This creates the 4 tables, the atomic RPCs (`create_transaction`,
   `delete_transaction`, `import_data`), the RLS policies, and enables Realtime.

### 3. Wire up the env vars
1. Dashboard → **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.
2. In the project root: `cp .env.example .env`
3. Fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-anon-key
   VITE_APP_PASSCODE=          # optional shared passcode; leave blank to disable
   ```
4. Restart the dev server (`npm run dev`). The **Mer** tab footer should now show
   a green dot + "synkronisert live (Supabase)".

### How sync / offline work
- All persistence still goes through `db.ts`, which now picks the **Supabase**
  backend automatically when the env vars exist, else falls back to localStorage.
- Sales + stock changes go through Postgres RPCs so a sale and its stock
  decrement can never get out of sync.
- **Realtime**: each device subscribes to row changes on all four tables, so a
  sale logged on one phone appears on the other within ~1s.
- **Offline**: every successful load is cached to localStorage. If the network
  is down, the app serves the cached data read-only so you can still view stock
  and history. (Full offline editing comes with the PWA work in Phase 3.)

### Optional: migrate your Phase-1 data
If you already entered styles in local-only mode: open **Mer → Eksporter JSON**
*before* adding the env vars, then after switching to Supabase use
**Mer → Importer JSON** to push that data up.

## Phase 3 — PWA + deploy to Vercel

The app is now an installable PWA: it precaches its shell with a service worker
(via `vite-plugin-pwa` + Workbox), so it opens offline and can be added to your
home screen like a native app. A small banner offers "Oppdater" when a new
version is deployed.

> The service worker is **disabled during `npm run dev`** (to avoid stale-cache
> confusion) and only active in production / `npm run preview`. To test the PWA
> locally: `npm run build && npm run preview`.

### Deploy to Vercel

You need a [vercel.com](https://vercel.com) account (free). Pick **one** path.

#### Path A — Git + Vercel dashboard (recommended; auto-deploys on every push)

1. Put the project on GitHub:
   ```bash
   git init
   git add .
   git commit -m "Draktlager"
   # create an empty repo on github.com, then:
   git remote add origin https://github.com/YOU/draktlager.git
   git branch -M main
   git push -u origin main
   ```
   (`.env` is gitignored, so your keys stay private.)
2. On Vercel: **Add New → Project → Import** your GitHub repo. It auto-detects
   Vite (build `npm run build`, output `dist` — already pinned in `vercel.json`).
3. Before the first deploy, add the env vars (next section), then **Deploy**.
4. Every `git push` to `main` now redeploys automatically.

#### Path B — Vercel CLI (no GitHub needed)

```bash
npm i -g vercel       # one-time
vercel                # first run: links/creates the project, follow prompts
vercel --prod         # deploy to the production URL
```

### Set the environment variables on Vercel

Your local `.env` is **not** uploaded. Add the same keys in Vercel:

- Dashboard: **Project → Settings → Environment Variables**, or
- CLI: `vercel env add VITE_SUPABASE_URL` (repeat for each), then redeploy.

Add these for the **Production** (and Preview) environment:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://pidfzknulxjcslgmxilp.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your `eyJ…` anon key |
| `VITE_APP_PASSCODE` | optional shared passcode (or leave unset) |

After setting them, trigger a redeploy (push a commit, or `vercel --prod`, or
"Redeploy" in the dashboard) so they're baked into the build.

> No Supabase config change is needed — the anon key already permits browser
> access from any origin, so your Vercel URL works immediately.

### Add to Home Screen — iPhone (Safari)

1. Open your Vercel URL (e.g. `https://draktlager.vercel.app`) in **Safari**
   (must be Safari, not Chrome, for iOS install).
2. Tap the **Share** button (square with an up-arrow, bottom centre).
3. Scroll down and tap **"Legg til på Hjem-skjerm" / "Add to Home Screen"**.
4. The name **Draktlager** and the green jersey icon appear — tap **Legg til / Add**.
5. Launch it from the home-screen icon: it opens full-screen with no Safari
   chrome, like a native app, and works offline for viewing.

Repeat on your brother's phone. Both installs talk to the same Supabase data, so
sales and stock stay in sync live.

### Add to Home Screen — Android (Chrome)

Open the URL in Chrome → menu (⋮) → **"Install app" / "Legg til på startskjerm"**.
Chrome usually also shows an automatic install prompt.

## Phases

- **Phase 1 — done:** local-only, all four screens working, localStorage behind `db.ts`.
- **Phase 2 — done:** Supabase schema + client + realtime, localStorage offline fallback, optional passcode.
- **Phase 3 — done:** installable PWA (offline viewing, home-screen icon, update prompt) + Vercel deploy config.
