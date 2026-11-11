# jaunt.

**Good days, planned.**

Jaunt is a self-hosted, installable day and trip planner. It opens on today, keeps tickets attached to the plans that need them, and lets you cross things off as the day unfolds.

It works two ways:

- **Signed in** — email + password accounts stored in PostgreSQL. Trips, plans, completions, and ticket files sync across your devices, with an offline cache and queued changes.
- **Offline / guest mode** — no account, no server round-trips. Local profiles and data live only in this browser.

Built to live on a phone home screen.

---

## Features

- **Today, automatically** — the dashboard opens on the current day with an “up next” card, countdown, progress, and every plan.
- **Accounts** — plain email + password registration and sign-in. Sessions are HTTP-only cookies; passwords are hashed.
- **Cross-device sync** — account data is stored in PostgreSQL per user and pulled into each device. Works alongside an offline-first browser cache.
- **Offline-first** — fresh plans and edits are saved immediately in IndexedDB even when the network is down. They sync automatically when you reconnect.
- **Multi-day trips** — name a trip, pick the dates, choose a color and emoji, then build it out day by day.
- **Rich plans** — name, date, start/end time, location, type, notes, confirmation number, link, and multiple photo/PDF tickets.
- **Cross things off** — tap the circle; completed plans fade and progress updates.
- **Move things around** — drag the grip handle to reorder, sort by start time, or edit a plan’s date to move it.
- **Calendar view** — a month grid with color-coded activity dots; tap any day to see and edit its agenda.
- **Tickets & photos** — attach up to 12 files per plan. Photos are compressed on-device; PDFs are kept as-is. Open or download them later.
- **Local profiles + import** — keep guest profiles for offline use, then copy a guest profile into an account without deleting the original.
- **Backups** — export guest data as one JSON file including tickets. Account data lives in PostgreSQL and can be dumped with `pg_dump`.
- **Installable PWA** — app icons, offline caching, update prompts, and a proper standalone display.

---

## Architecture

```
┌─────────────────────────┐       same-origin /api       ┌────────────────────┐
│ Phone / desktop browser │  ───────────────────────►   │  Node API           │
│ React + IndexedDB cache │                              │  Express + sessions │
└─────────────────────────┘                              └─────────┬──────────┘
          ▲                                                        │
          │ service worker precache                                ▼
┌─────────────────────────┐                              ┌────────────────────┐
│ nginx (web container)    │  serves app, proxies /api   │  PostgreSQL        │
└─────────────────────────┘                              └────────────────────┘
```

The web container serves the built app and proxies `/api` to the API container. The API owns accounts, sessions, sync, and attachment files. PostgreSQL is the durable account store. The browser keeps an IndexedDB mirror so a signed-in account still opens and works offline.

### Sync model

- Local writes mark rows dirty and queue deletions. The client pushes those first, then pulls everything new.
- Revision-changing operations (syncs, ticket uploads, invitations/membership changes) are serialized with a PostgreSQL advisory lock, so the revision cursor cannot skip a concurrent commit.
- Attachment metadata syncs with the plan data; file bytes upload/download separately.
- Conflicts resolve **last-sync-wins**. This is a personal planner, not a real-time collaborative editor; simultaneous edits of the same plan on two devices are not merged field-by-field.
- Signing out removes that account's offline cache from the browser. Server data remains.

---

## Docker quick start

Requirements: Docker and Docker Compose.

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | **Required.** Long random password for PostgreSQL. |
| `WEB_PORT` | Public port for the web app (default `8080`). |
| `DB_PORT` | Local-only host port for PostgreSQL development access (default `55432`). |
| `SESSION_DAYS` | How long login sessions last (default `90`). |
| `COOKIE_SECURE` | Keep `true` on HTTPS. Set `false` only for plain-HTTP localhost testing. |

Then:

```bash
docker compose up -d --build
```

Open `http://localhost:8080` (or your `WEB_PORT`). The first screen lets you create an account, sign in, or **Continue offline**. If you used an earlier local-only build, choose **Continue offline** once to reach your existing profiles.

The API applies its schema automatically on startup. The database lives in the `jaunt_db` Docker volume.

### Serving on your phone

Service workers, installation, and the full offline app require **HTTPS** (localhost is the exception). Put the web container behind a reverse proxy with TLS. A Caddy example is included:

```bash
# Point a domain at your server first.
docker compose up -d --build
cp Caddyfile.example Caddyfile
# edit the domain in Caddyfile
caddy run --config Caddyfile
```

Caddy gets a certificate automatically and proxies to the web container. A Cloudflare Tunnel or Tailscale Serve also works for HTTPS.

Keep `COOKIE_SECURE=true` in production so session cookies are only sent over HTTPS. The app and API are intentionally same-origin; keep both under the same hostname.

---

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

### Other commands

```bash
npm run build          # type-check + production client build
npm run preview        # serve the production client build
npm run api:build      # build the server
npm run typecheck      # client type-check
npm run test:e2e       # guest/offline Playwright tests (starts its own preview server)
```

---

## Accounts

Registration is deliberately plain: **email + password**. There is no email verification and no password-reset email flow because Jaunt does not assume you have SMTP configured.

### Shared trips

Any account owner can open a trip → **People** → invite another user by email. Invitations require the other person to already have a Jaunt account; nothing is sent by email. Instead, pending invitations appear on their **Trips** page the next time they open it. They can accept or decline.

- **Owners** can edit trip details, invite/remove people, and delete the trip.
- **Members** can view the trip and add, edit, complete, reorder, or delete plans and ticket files. They cannot change trip details or manage members.
- Members can leave a shared trip from the People sheet.
- Accepted shared trips sync down and work offline like any other trip. Removing someone from a trip clears the shared copy on their device the next time they sync.
- As with any other account data, invite acceptance and member changes require a connection.

Security details:

- Passwords are hashed with bcrypt (cost 12 by default).
- Sessions are random 32-byte tokens stored hashed in PostgreSQL and sent as `HttpOnly`, `SameSite=Lax` cookies.
- Sessions last 90 days by default and expired sessions are cleaned up.
- Login and registration are rate limited.
- The API is only reachable through the same-origin nginx proxy in the default setup.
- Cross-origin state-changing requests are rejected.
- Attachment downloads force non-image/non-PDF content types to download as octet-stream, so uploaded files cannot execute as app-origin HTML.

Because there is no reset email, **store your password safely**. If you lose it, an administrator with database access can help; there is no self-service recovery.

Account display name and color start from the email and can be changed in **Settings → Edit account profile**.

### Deleting an account

There is no self-service “delete account” button yet. Deleting the user row cascades to trips, plans, attachments, sessions, and shared-trip memberships:

```bash
docker compose exec db psql -U jaunt -d jaunt \
  -c "DELETE FROM users WHERE email = 'you@example.com';"
```

---

## Offline and guest mode

Choose **Continue offline** on the first screen (or from sign-in). Guest mode:

- Creates local profiles stored in IndexedDB.
- Never contacts the account API for data.
- Works fully offline after the app has been loaded/installed.
- Can be backed up from **Settings → Download backup**.
- Can be imported into an account from **Settings → Bring your offline plans along**.

An account also works offline: after the first successful sync, account data and ticket files are cached in the browser. You can add, edit, complete, reorder, and delete plans offline. The app shows an offline banner and retries automatically. Changes queue until the next sync.

Signing out removes the account cache from that browser. Anything not yet synced would be lost, so the app warns you to sync first.

---

## Install on your home screen

**iPhone / iPad (Safari):**

1. Open the HTTPS URL in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.

**Android (Chrome):**

1. Open the HTTPS URL in Chrome.
2. Open the menu.
3. Choose **Install app** or **Add to Home screen**.

Settings includes a home-screen section with an install button where supported. The app works offline once installed.

---

## Backups

### Guest profiles

**Settings → Your data → Download backup** exports all **guest** profiles, trips, plans, and ticket files into one JSON file. Account cache data is intentionally excluded. Restoring replaces guest data only; account data and sync cursors are left alone.

### Accounts

Account data lives in PostgreSQL:

```bash
# Back up
docker compose exec -T db pg_dump -U jaunt -d jaunt > jaunt-$(date +%F).sql

# Restore (into an empty/fresh database is safest)
cat jaunt-2026-11-10.sql | docker compose exec -T db psql -U jaunt -d jaunt
```

The Docker volume should also be included in your normal server backup routine. Attachment files (photos and PDFs) are stored in PostgreSQL alongside their metadata, so a database dump includes tickets.

Signing out does **not** delete server data. Deleting a user row does.

---

## Tests

### Guest / offline suite

No running API or database required; Playwright builds the app and starts a preview server.

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

Covers: offline onboarding, local profiles, plan creation, drag reorder, completion persistence, offline reload, trips, guest backups/restore, multi-day plans, day-part timing, empty time fields, light mode persistence, and the sign-in gate with “Continue offline.”

### Account / full-stack suite

Requires the full Docker Compose stack running (web + API + PostgreSQL). Use a disposable/test database because it creates real accounts.

```bash
docker compose up -d --build
E2E_BASE_URL=http://localhost:8080 npm run test:account
```

If you use a non-default port, set `E2E_BASE_URL` accordingly. Covers: registration, cross-device sync, ticket file upload/download, completion state, offline queued edits, service-worker offline reload, importing a guest profile into an account, and inviting another account into a trip.

Type-checking is part of `npm run build`; run `npm run typecheck` for the client and `cd server && npm run typecheck` for the API.

---

## Project structure

```
src/                    React app
  components/           UI, plans, trips, navigation, sheets, sync banner, members
  context/              auth, profiles, sync, theme, toasts, install prompt, activity sheets
  hooks/                today/now clocks
  lib/                  API client, sync engine, repos, backup, image prep, dates
  pages/                Auth, Today, Calendar, Trips, Trip detail, Settings, Onboarding
  db.ts                 Dexie schema (IndexedDB, offline cache)
  types.ts              shared client/sync types
server/                 Node + Express API
  src/auth.ts           sessions, password hashing, auth middleware
  src/routes/           auth, sync, attachments, sharing/invitations
  src/schema.ts         PostgreSQL schema + startup migrations
  src/db.ts             pg pool + retry logic
  src/tripAccess.ts     shared-trip access, tombstones, revision bumps
deploy/nginx.conf       static app + /api reverse proxy + caching
Dockerfile              web image
server/Dockerfile       API image
docker-compose.yml      web + api + db
tests/                  guest/offline Playwright tests
tests/account/          full-stack account Playwright tests
Caddyfile.example       automatic HTTPS reverse proxy example
```

### Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Dexie / IndexedDB for offline data and attachment cache
- dnd-kit for reorderable plans
- Radix Dialog for accessible sheets
- Theme tokens + `theme-init.js` for instant light/dark/accent loading
- Node 24 + Express 5 + `pg`
- PostgreSQL 17
- bcryptjs, HTTP-only session cookies
- vite-plugin-pwa / Workbox
- Playwright

---

## Environment variables

| Variable | Service | Description |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | db, api | Required database password. |
| `WEB_PORT` | web | Public host port (default `8080`). |
| `DB_PORT` | db | Local-only host port mapped for development (default `55432`). |
| `COOKIE_SECURE` | api | `true` for HTTPS, `false` for plain HTTP localhost. |
| `SESSION_DAYS` | api | Session lifetime in days (default `90`). |
| `PORT` | api | API port, default `3100` in development. |
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | api | Standard PostgreSQL connection settings. Compose sets these; local dev falls back to the root `.env`. |
| `BCRYPT_ROUNDS` | api | bcrypt cost (default `12`). |

---

## Customizing

- App name/title: `index.html`, `vite.config.ts` (PWA manifest), and `package.json`.
- Brand colors/theme: CSS variables in `src/index.css`, accent choices in `src/context/ThemeContext.tsx`.
- Profile/trip color swatches: `src/lib/palette.ts`.
- Activity types and colors: `src/lib/activityMeta.tsx`.
- App icon: replace `public/logo.svg`, then run `npm run icons`.
- API schema: `server/src/schema.ts` (applied with `CREATE TABLE IF NOT EXISTS` on API startup).
- Session length / bcrypt cost: environment variables.

---

## Known limitations

- **Last-sync-wins conflicts.** There is no field-level merge for simultaneous edits. It is built for personal use across your own devices and small shared trips.
- **No email verification or password reset.** Registration is plain email + password, as requested; no SMTP dependency.
- **No self-service account deletion UI.** Use the SQL command above.
- **Trip invitations are in-app only.** No email is sent; the invited person must already have an account and open their Trips page.
- **Owners manage the trip shell.** Only the owner can rename/redate a trip, manage members, or delete it; members can edit the itinerary itself.
- **Theme settings are per browser.** They do not sync between devices or accounts.
- **Guest data is local to one browser.** Use backup/restore or import into an account to move it.
- **Signing out clears the offline account cache.** Sync first if changes have not gone up.
- **Attachments live in PostgreSQL.** Convenient for backups, but large ticket libraries increase database size.
- **Single-host deployment.** The web app and API are designed to share an origin and live at the domain root.
- **English interface.** Dates and times use native browser inputs.

---

## License

Personal self-hosted project. Add a license if you plan to publish it.
