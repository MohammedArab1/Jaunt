# jaunt.

**Good days, planned.**

Jaunt is a self-hosted, installable day and trip planner. It opens on today, keeps tickets attached to the plans that need them, and lets you cross things off as the day unfolds.

It works two ways:

- **Signed in** — email + password accounts stored in PostgreSQL. Trips, plans, packing lists, completions, and ticket files sync across your devices, with an offline cache and queued changes.
- **Offline / guest mode** — no account, no server round-trips. Local profiles and data live only in this browser.

Built to live on a phone home screen.

---

## Features

- **Today, automatically** — the dashboard opens on the current day with an “up next” card, countdown, progress, every plan, and every trip that is active today.
- **Accounts** — plain email + password registration and sign-in. Sessions are HTTP-only cookies; passwords are hashed.
- **Cross-device sync** — account data is stored in PostgreSQL per user and pulled into each device. Works alongside an offline-first browser cache.
- **Offline-first** — fresh plans and edits are saved immediately in IndexedDB even when the network is down. They sync automatically when you reconnect.
- **Multi-day trips** — name a trip, pick the dates, choose a color and emoji, then build it out day by day. Multi-day plans show their start time on the first day, their end time on the last day, and appear as any-time in between. Day-part timing applies only to the first instance.
- **Multi-city destinations** — search live city suggestions through a server-side Open-Meteo proxy, pick several cities, or type a custom destination that isn’t listed. Suggestions need a connection; typed cities always work.
- **Packing lists** — each traveler gets their own per-trip checklist with categories, quantities, packed progress, and a one-tap essentials starter. Select whose list to view; you can edit yours, and everyone else’s stays read-only. Lists work offline.
- **Rich plans** — name, date, start/end time, location, type, notes, confirmation number, link, and multiple photo/PDF tickets. Plans can use a specific time, a day-part (**Early morning**, **Morning**, **Afternoon**, or **Evening**), or no time.
- **Time-first ordering** — timed and day-part plans interleave chronologically by default. Drag a plan to create a custom order; a **Custom order** chip appears and **Sort by time** returns to chronological order. Editing a time, day-part, or date automatically returns the affected day to time order.
- **Cross things off** — tap the circle; completed plans fade and progress updates.
- **Move things around** — drag the grip handle for a custom order, use **Sort by time** to restore chronological order, or edit a plan’s dates to move it.
- **Calendar view** — a month grid with color-coded activity dots; tap any day to see and edit its agenda.
- **Tickets & photos** — attach up to 12 files per plan. Photos are compressed on-device; PDFs are kept as-is. Open or download them later.
- **Public read-only links** — share a trip's itinerary with anyone, no account required. Tickets, confirmations, links, and notes stay private; revoke the link at any time.
- **Global search** — find trips, plans, packing items, places, confirmation numbers, and notes from one page. It reads the offline cache, so it works without a connection and includes shared trips.
- **Password management** — change your password from Settings. The current device stays signed in and every other session is signed out.
- **Local profiles + import** — keep guest profiles for offline use, then copy a guest profile into an account without deleting the original.
- **Backups** — export guest data as one JSON file including tickets and packing lists. Account data lives in PostgreSQL and can be dumped with `pg_dump`.
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
| `WEB_BIND` | Interface for the web port (default `0.0.0.0`; use `127.0.0.1` behind a proxy). |
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

### Deploying with Ansible

The `ansible/` directory deploys the stack to the host in
`ansible/inventory.ini` (`root@5.78.120.71` by default).

On the machine you deploy from:

```bash
ansible-galaxy collection install -r ansible/requirements.yml
ssh root@5.78.120.71 true
```

Create the optional secrets file. On this host, leaving the password empty
adopts the password already present in `/root/Jaunt/.env`:

```bash
cp ansible/vars/production.example.yml ansible/vars/production.yml
# edit it; the file is gitignored and can be ansible-vault encrypted
```

The GitHub repository is the source of truth. The deploy refuses to run if
your local working tree is dirty or if `HEAD` differs from
`origin/main`. Commit and push first:

```bash
git add -A
git commit -m "Describe the change"
git push origin main
./ansible/deploy.sh
# or
npm run deploy
```

The server keeps its own checkout at `/root/Jaunt`, fetches `origin/main`,
and hard-resets to it. Uncommitted local files are never copied to the server.
The repository is public, so the server fetches over HTTPS without
credentials. If you make it private, configure a read-only deploy key on the
server or point `jaunt_repo_url` at an authenticated URL.

Each run:

1. Ensures a 2 GB swap file exists (this is a small shared host).
2. Pulls the pushed `main` commit from
   `https://github.com/MohammedArab1/Jaunt.git` into `/root/Jaunt` with
   `git fetch` and a hard reset. Untracked files are removed, except the
   gitignored `.env`, `backups/`, dependencies, and build output.
3. Renders `.env` from `ansible/group_vars/all.yml` and the preserved
   database password.
4. Dumps PostgreSQL to `backups/` (14-day retention) and tests the archive.
5. Builds `api` then `web` with `--pull` and a cache-busting build argument.
6. Runs `docker compose down --remove-orphans`, then
   `docker compose up -d --remove-orphans --force-recreate --wait`.
7. Checks `/api/health`, adds/reloads the marked Caddy site block, and
   verifies the public HTTPS URL.
8. Removes dangling images and build cache older than 24 hours.
9. If the new containers fail to become healthy, retags the previous images
   and brings them back automatically.

The public URL is `https://jaunt.5.78.120.71.nip.io`. Caddy already owns
ports 80/443 on the host and handles the certificate. The web container is
bound to `127.0.0.1:8080`, so Caddy is the only public entry point. Replace
`jaunt_domain` in `ansible/group_vars/all.yml` with a real domain when you
have one. Set `jaunt_manage_caddy: false` to skip the proxy changes and
publish only on `WEB_PORT` (which the provider firewall currently blocks).

> **Host note:** Caddy on this server is currently a manually started
> process, not the failed `caddy.service`. The deploy reloads it but does not
> change how it starts. Fix that systemd unit separately so HTTPS survives a
> reboot.

**Data safety:** the `jaunt_db` volume is never removed by this playbook.
`docker compose down -v` is never used. To restore a dump:

```bash
ssh root@5.78.120.71
cd /root/Jaunt
gunzip -c backups/jaunt-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U jaunt -d jaunt
```

To roll back manually:

```bash
ssh root@5.78.120.71
cd /root/Jaunt
docker tag jaunt-web:previous jaunt-web:latest
docker tag jaunt-api:previous jaunt-api:latest
docker compose up -d --force-recreate --remove-orphans
```

`COOKIE_SECURE` becomes `true` automatically when `jaunt_domain` is set. If
you disable Caddy and use plain HTTP, set `jaunt_cookie_secure: "false"` in
`ansible/group_vars/all.yml`; installation and service workers still require
HTTPS.

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
- **Packing lists are personal.** Everyone on the trip can select and view each other’s lists, but only the list owner can add, check off, edit, or remove items. A traveler’s list is removed if they leave or are removed from the trip.
- Members can leave a shared trip from the People sheet.
- Accepted shared trips sync down and work offline like any other trip. Removing someone from a trip clears the shared copy on their device the next time they sync.
- As with any other account data, invite acceptance and member changes require a connection.

### Public read-only links

A trip owner can open a trip → **Share** → **Create public link**. The link opens
a standalone read-only itinerary page for people who do not have a Jaunt
account. The page shows the trip name, destination, dates, and the day-by-day
itinerary (plan names, dates, times, locations, and types).

For privacy, public pages deliberately **do not** include trip/plan notes,
confirmation numbers, external links, or ticket/photo attachments. Revoking a
link from the Share sheet makes the old URL return “no longer available”
immediately. Anyone with the URL can view the page, so treat the link as
unlisted rather than password-protected.

Security details:

- Passwords are hashed with bcrypt (cost 12 by default).
- Passwords can be changed in **Settings → Password**. The change requires the current password and signs out every other session; the current device stays signed in.
- Sessions are random 32-byte tokens stored hashed in PostgreSQL and sent as `HttpOnly`, `SameSite=Lax` cookies.
- Sessions last 90 days by default and expired sessions are cleaned up.
- Login and registration are rate limited.
- Public share links use random 192-bit tokens stored on the trip; revoking a link clears the token and returns 404.
- The API is only reachable through the same-origin nginx proxy in the default setup.
- Cross-origin state-changing requests are rejected.
- Attachment downloads force non-image/non-PDF content types to download as octet-stream, so uploaded files cannot execute as app-origin HTML.

Change your password any time from **Settings → Password**. Because there is no reset email, **store your password safely**. If you lose it, an administrator with database access can help; there is no self-service recovery.

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

An account also works offline: after the first successful sync, account data and ticket files are cached in the browser. You can add, edit, complete, reorder, and delete plans offline. The app shows an offline banner and retries automatically. Changes queue until the next sync. Global search also reads this local cache, so it keeps working offline.

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

**Settings → Your data → Download backup** exports all **guest** profiles, trips, plans, packing lists, and ticket files into one JSON file. Account cache data is intentionally excluded. Restoring replaces guest data only; account data and sync cursors are left alone.

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

Covers: offline onboarding, local profiles, plan creation, drag/custom ordering, automatic time reordering, Early morning/Morning/Afternoon/Evening day-parts, specific-time and day-part interleaving, multiple active trips on the dashboard, multi-day plan instance timing, completion persistence, offline reload, trips, multi-city destinations, packing lists and essentials, guest backups/restore, empty time fields, light mode persistence, global search across trips/plans/packing/places/confirmations/notes, and the sign-in gate with “Continue offline.”

### Account / full-stack suite

Requires the full Docker Compose stack running (web + API + PostgreSQL). Use a disposable/test database because it creates real accounts.

```bash
docker compose up -d --build
E2E_BASE_URL=http://localhost:8080 npm run test:account
```

If you use a non-default port, set `E2E_BASE_URL` accordingly. Covers: registration, cross-device sync, ticket file upload/download, completion state, offline queued edits, packing-list sync, per-traveler read-only shared lists, service-worker offline reload, importing a guest profile into an account, inviting another account into a trip, creating/revoking a read-only public link, and changing a password with other sessions signed out.

Type-checking is part of `npm run build`; run `npm run typecheck` for the client and `cd server && npm run typecheck` for the API.

---

## Project structure

```
src/                    React app
  components/           UI, plans, trips, navigation, sheets, sync banner, members
  context/              auth, profiles, sync, theme, toasts, install prompt, activity sheets
  hooks/                today/now clocks
  lib/                  API client, sync engine, repos, backup, image prep, dates
  pages/                Auth, Today, Calendar, Search, Trips, Trip detail, Public trip, Settings, Onboarding
  db.ts                 Dexie schema (IndexedDB, offline cache)
  types.ts              shared client/sync types
server/                 Node + Express API
  src/auth.ts           sessions, password hashing, auth middleware
  src/routes/           auth, sync, attachments, sharing, public share links, city search
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
- **Public links are unlisted, not password-protected.** Anyone with the URL can view the itinerary. Revoke the link when you no longer want it shared.
- **Live city suggestions need a connection.** The destination field always accepts typed cities, but suggestions are fetched through the server from [Open-Meteo](https://open-meteo.com/) and are unavailable offline.
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
