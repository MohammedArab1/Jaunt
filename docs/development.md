# Development

[← Back to README](../README.md)

## Local development

Requirements: Node.js 20+ (developed on Node 24), npm, and Docker for PostgreSQL.

```bash
cp .env.example .env          # set POSTGRES_PASSWORD
npm install
npm run api:install           # installs the server/ package
docker compose up -d db       # PostgreSQL only, on 127.0.0.1:55432
```

Start the API (reads the root `.env` and listens on port `3100`):

```bash
npm run api:dev
```

Start the web app in another terminal:

```bash
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://127.0.0.1:3100`. For plain-HTTP localhost testing, set `COOKIE_SECURE=false` in `.env` if your browser does not accept Secure cookies over localhost.

You can develop offline/guest mode without the API running, but account sign-in and sync need it.

## Other commands

```bash
npm run build          # type-check + production client build
npm run preview        # serve the production client build
npm run api:build      # build the server
npm run typecheck      # client type-check
npm run test:e2e       # guest/offline Playwright tests (starts its own preview server)
```

## Tests

### Guest / offline suite

No running API or database required; Playwright builds the app and starts a preview server.

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

Covers: offline onboarding, local profiles, plan creation, drag/custom ordering, automatic time reordering, Early morning/Morning/Afternoon/Evening day-parts, specific-time and day-part interleaving, multiple active trips on the dashboard, multi-day plan instance timing, completion persistence, offline reload, trips, multi-city destinations, packing lists and essentials, packing suggestions from weather, per-city trip averages and plan-driven daily weather cards with multi-city filtering and location nudges, climate labels, destination-linked plan weather, calendar weather lines, cached weather offline, PDF attachments in the in-app viewer including offline reload, guest backups/restore, empty time fields, light mode persistence, global search across trips/plans/packing/places/confirmations/notes, and the sign-in gate with “Continue offline.”

### Account / full-stack suite

Requires the full Docker Compose stack running (web + API + PostgreSQL). Use a disposable/test database because it creates real accounts.

```bash
docker compose up -d --build
E2E_BASE_URL=http://localhost:8080 npm run test:account
```

If you use a non-default port, set `E2E_BASE_URL` accordingly. Covers: registration, cross-device sync, ticket file upload/download, PDF viewer rendering, completion state, offline queued edits, packing-list sync, per-traveler read-only shared lists, service-worker offline reload, importing a guest profile into an account, inviting another account into a trip, creating/revoking a read-only public link, and changing a password with other sessions signed out.

Type-checking is part of `npm run build`; run `npm run typecheck` for the client and `cd server && npm run typecheck` for the API.

## Project structure

```
src/                    React app
  components/           UI, plans, trips, packing, weather, navigation, sheets, sync banner, members
  context/              auth, profiles, sync, theme, toasts, install prompt, activity sheets
  hooks/                today/now clocks, trip weather
  lib/                  API client, sync engine, repos, backup, image prep, dates, weather
  pages/                Auth, Today, Calendar, Search, Trips, Trip detail, Public trip, Settings, Onboarding
  db.ts                 Dexie schema (IndexedDB, offline cache)
  types.ts              shared client/sync types
server/                 Node + Express API
  src/auth.ts           sessions, password hashing, auth middleware
  src/routes/           auth, sync, attachments, sharing, public share links, city search, weather
  src/weather.ts        Open-Meteo forecast, archive, and climate-average service
  src/schema.ts         PostgreSQL schema + startup migrations
  src/db.ts             pg pool + retry logic
  src/tripAccess.ts     shared-trip access, tombstones, revision bumps
deploy/nginx.conf       static app + /api reverse proxy + caching
Dockerfile              web image
server/Dockerfile       API image
docker-compose.yml      web + api replicas + db
ansible/rollout.sh      rolling API container replacement
docs/                   user and operator guides
tests/                  guest/offline Playwright tests
tests/account/          full-stack account Playwright tests
```

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Dexie / IndexedDB for offline data, attachment cache, and weather cache
- dnd-kit for reorderable plans
- PDF.js for offline-capable PDF previews
- Open-Meteo for city search, forecasts, historical weather, and climate averages
- Radix Dialog for accessible sheets
- Theme tokens + `theme-init.js` for instant light/dark/accent loading
- Node 24 + Express 5 + `pg`
- PostgreSQL 17
- Cloudflare Tunnel for public HTTPS ingress
- bcryptjs, HTTP-only session cookies
- vite-plugin-pwa / Workbox
- Playwright

## Browser support

Jaunt targets **Baseline 2023** (Chrome/Edge 111+, Firefox 115+, Safari 16.2+). Features that are Baseline 2023 or earlier may be used without fallbacks; newer platform features need progressive enhancement or a fallback.

## Customizing

- App name/title: `index.html`, `vite.config.ts` (PWA manifest), and `package.json`.
- Brand colors/theme: CSS variables in `src/index.css`, accent choices in `src/context/ThemeContext.tsx`.
- Profile/trip color swatches: `src/lib/palette.ts`.
- Activity types and colors: `src/lib/activityMeta.tsx`.
- App icon: replace `public/logo.svg`, then run `npm run icons`.
- API schema: `server/src/schema.ts` (applied with `CREATE TABLE IF NOT EXISTS` on API startup).
- Session length / bcrypt cost: environment variables; see [Self-hosting](self-hosting.md#environment-variables).
