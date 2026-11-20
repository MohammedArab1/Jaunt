# jaunt.

**Good days, planned.**

Jaunt is a self-hosted, installable day and trip planner. It opens on today, keeps tickets attached to the plans that need them, and lets you cross things off as the day unfolds.

It works two ways:

- **Signed in** — email + password accounts stored in PostgreSQL. Trips, plans, packing lists, completions, and ticket files sync across your devices, with an offline cache and queued changes.
- **Offline / guest mode** — no account and no server-side data. Local profiles, trips, and plans live only in this browser. Optional city search and weather still use the read-only Open-Meteo proxy when online.

Built to live on a phone home screen.

---

## Features

- **Today, automatically** — the dashboard opens on the current day with an “up next” card, countdown, progress, every plan, and every trip that is active today.
- **Accounts** — plain email + password registration and sign-in. Sessions are HTTP-only cookies; passwords are hashed.
- **Cross-device sync** — account data is stored in PostgreSQL per user and pulled into each device. Works alongside an offline-first browser cache.
- **Offline-first** — fresh plans and edits are saved immediately in IndexedDB even when the network is down. They sync automatically when you reconnect.
- **Multi-day trips** — name a trip, pick the dates, choose a color and emoji, then build it out day by day. Multi-day plans show their start time on the first day, their end time on the last day, and appear as any-time in between. Day-part timing applies only to the first instance.
- **Multi-city destinations** — search live city suggestions through a server-side Open-Meteo proxy, pick several cities, or type a custom destination that isn’t listed. Suggestions need a connection; typed cities always work.
- **Packing lists** — each traveler gets their own per-trip checklist with categories, quantities, packed progress, and a one-tap essentials starter. Select whose list to view; you can edit yours, and everyone else’s stays read-only. Lists work offline, and weather can suggest rain, cold, heat, UV, wind, or snow items for your own list.
- **Trip weather** — per-city weather for every trip date: daily forecasts within 15 days, 5-year climate averages for dates beyond that, recorded weather for past days, and near-term hourly detail. The top trip section shows a per-city trip average; open it for day-by-day detail. Each day gets a compact weather strip before its plans based on the locations selected on that day’s plans; all relevant cities are shown and may wrap onto multiple lines. Single-destination trips use that destination automatically. Day weather is hidden for past trips, and plan cards in the calendar can show weather for their selected destination. A °C/°F toggle and offline cache are included. Powered by Open-Meteo.
- **Rich plans** — name, date, start/end time, trip destination, address/place, type, notes, confirmation number, link, and multiple photo/PDF tickets. Plans can use a specific time, a day-part (**Early morning**, **Morning**, **Afternoon**, or **Evening**), or no time.
- **Time-first ordering** — timed and day-part plans interleave chronologically by default. Drag a plan to create a custom order; a **Custom order** chip appears and **Sort by time** returns to chronological order. Editing a time, day-part, or date automatically returns the affected day to time order.
- **Cross things off** — tap the circle; completed plans fade and progress updates.
- **Move things around** — drag the grip handle for a custom order, use **Sort by time** to restore chronological order, or edit a plan’s dates to move it.
- **Calendar view** — a month grid with color-coded activity dots; tap any day to see and edit its agenda.
- **Tickets & photos** — attach up to 12 files per plan. Photos are compressed on-device; PDFs are kept as-is and open in an offline-capable in-app viewer. Download them whenever you need.
- **Public read-only links** — share a trip's itinerary with anyone, no account required. Tickets, confirmations, links, and notes stay private; revoke the link at any time.
- **Global search** — find trips, plans, packing items, places, confirmation numbers, and notes from one page. It reads the offline cache, so it works without a connection and includes shared trips.
- **Password management** — change your password from Settings. The current device stays signed in and every other session is signed out.
- **Local profiles + import** — keep guest profiles for offline use, then copy a guest profile into an account without deleting the original.
- **Backups** — export guest data as one JSON file including tickets and packing lists. Account data lives in PostgreSQL and can be dumped with `pg_dump`.
- **Installable PWA** — app icons, offline caching, update prompts, and a proper standalone display.

---

## Architecture

```
Browser (HTTPS)
   │
   ▼
Cloudflare edge (DNS + TLS)
   │ Cloudflare Tunnel
   ▼
cloudflared on the VPS
   │ http://127.0.0.1:8080
   ▼
nginx web container
   ├── serves the React app + service worker
   └── proxies /api ──► Node API (Express + sessions) ──► PostgreSQL
```

Cloudflare terminates TLS and routes `planjaunt.com` through a Cloudflare Tunnel to `cloudflared` on the host. `cloudflared` forwards to nginx on `127.0.0.1:8080`; nginx serves the built app and proxies `/api` to the API container. The API owns accounts, sessions, sync, and attachment files. PostgreSQL is the durable account store. The browser keeps an IndexedDB mirror so a signed-in account still opens and works offline.

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
| `WEB_BIND` | Interface for the web port (default `0.0.0.0`; use `127.0.0.1` behind a Cloudflare Tunnel or another local proxy). |
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

Service workers, installation, and the full offline app require **HTTPS** (localhost is the exception). The production setup uses a Cloudflare Tunnel; TLS is terminated at Cloudflare, and the only proxy inside this repository is the nginx web container that serves the app and forwards `/api`.

1. Keep `WEB_BIND=127.0.0.1` (or `jaunt_web_bind: 127.0.0.1` in Ansible) so the web container is not exposed directly.
2. Route `planjaunt.com` through a Cloudflare Tunnel to `http://127.0.0.1:8080`.
3. Keep `COOKIE_SECURE=true` in production.

A minimal `cloudflared` config looks like this:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: planjaunt.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Run `cloudflared tunnel run <TUNNEL_NAME>`, or manage the tunnel from the Cloudflare dashboard. The app and API are intentionally same-origin; keep both under the same hostname. nginx restores the real client IP from Cloudflare's `CF-Connecting-IP` header for the local tunnel; adjust `set_real_ip_from` in `deploy/nginx.conf` if `cloudflared` runs on a different network.

### Deploying with Ansible

The `ansible/` directory deploys the stack to the host in
`ansible/inventory.ini` (`mohammed-arab@10.0.0.251` by default).

On the machine you deploy from:

```bash
ansible-galaxy collection install -r ansible/requirements.yml
ssh mohammed-arab@10.0.0.251 true
```

The deploy user must be able to run Docker without sudo (normally membership
in the `docker` group; log out and back in after adding it) and must own
`jaunt_app_dir`. The playbook runs without privilege escalation and does not
manage swap.

Create the optional secrets file. On this host, leaving the password empty
adopts the password already present in the server checkout's `.env`:

```bash
cp ansible/vars/production.example.yml ansible/vars/production.yml
# edit it; the file is gitignored and can be ansible-vault encrypted
```

If you are moving an existing deployment, copy its `.env` into the new
`jaunt_app_dir` (or set `jaunt_postgres_password`) so the app keeps using the
same database password. The Compose project name is unchanged, so an existing
`jaunt` database volume on the same host is reused.

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

The server keeps its own checkout at `jaunt_app_dir`
(`/home/mohammed-arab/Desktop/Programming/Jaunt` by default), fetches
`origin/main`, and hard-resets to it. Uncommitted local files are never copied
to the server.
The repository is public, so the server fetches over HTTPS without
credentials. If you make it private, configure a read-only deploy key on the
server or point `jaunt_repo_url` at an authenticated URL.

Each run:

1. Pulls the pushed `main` commit from
   `https://github.com/MohammedArab1/Jaunt.git` into `jaunt_app_dir` with
   `git fetch` and a hard reset. Untracked files are removed, except the
   gitignored `.env`, `backups/`, dependencies, and build output.
2. Renders `.env` from `ansible/group_vars/all.yml` and the preserved
   database password.
3. Dumps PostgreSQL to `backups/` (14-day retention) and tests the archive.
4. Builds `api` then `web` with `--pull` and a cache-busting build argument.
5. Runs `docker compose down --remove-orphans`, then
   `docker compose up -d --remove-orphans --force-recreate --wait`.
6. Checks `/api/health` on the host's web port.
7. Removes dangling images and build cache older than 24 hours.
8. If the new containers fail to become healthy, retags the previous images
   and brings them back automatically.

The playbook does not manage Cloudflare Tunnel, DNS, or TLS. For
`planjaunt.com`, configure the Cloudflare Tunnel to forward to
`http://127.0.0.1:8080` (the default `jaunt_web_bind`) and create the
corresponding DNS route in Cloudflare. If you instead expose the port
directly, set `jaunt_web_bind: 0.0.0.0` in `ansible/group_vars/all.yml`.
`jaunt_domain` only decides whether session cookies are marked secure, so it
requires HTTPS to be working.

**Data safety:** the `jaunt_db` volume is never removed by this playbook.
`docker compose down -v` is never used. To restore a dump:

```bash
ssh mohammed-arab@10.0.0.251
cd /home/mohammed-arab/Desktop/Programming/Jaunt
gunzip -c backups/jaunt-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U jaunt -d jaunt
```

To roll back manually:

```bash
ssh mohammed-arab@10.0.0.251
cd /home/mohammed-arab/Desktop/Programming/Jaunt
docker tag jaunt-web:previous jaunt-web:latest
docker tag jaunt-api:previous jaunt-api:latest
docker compose up -d --force-recreate --remove-orphans
```

`COOKIE_SECURE` becomes `true` automatically when `jaunt_domain` is set. For a
plain-HTTP deployment, set `jaunt_cookie_secure: "false"` in
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

Covers: offline onboarding, local profiles, plan creation, drag/custom ordering, automatic time reordering, Early morning/Morning/Afternoon/Evening day-parts, specific-time and day-part interleaving, multiple active trips on the dashboard, multi-day plan instance timing, completion persistence, offline reload, trips, multi-city destinations, packing lists and essentials, packing suggestions from weather, per-city trip averages and plan-driven daily weather cards with multi-city filtering and location nudges, climate labels, destination-linked plan weather, calendar weather lines, cached weather offline, PDF attachments in the in-app viewer including offline reload, guest backups/restore, empty time fields, light mode persistence, global search across trips/plans/packing/places/confirmations/notes, and the sign-in gate with “Continue offline.”

### Account / full-stack suite

Requires the full Docker Compose stack running (web + API + PostgreSQL). Use a disposable/test database because it creates real accounts.

```bash
docker compose up -d --build
E2E_BASE_URL=http://localhost:8080 npm run test:account
```

If you use a non-default port, set `E2E_BASE_URL` accordingly. Covers: registration, cross-device sync, ticket file upload/download, PDF viewer rendering, completion state, offline queued edits, packing-list sync, per-traveler read-only shared lists, service-worker offline reload, importing a guest profile into an account, inviting another account into a trip, creating/revoking a read-only public link, and changing a password with other sessions signed out.

Type-checking is part of `npm run build`; run `npm run typecheck` for the client and `cd server && npm run typecheck` for the API.

---

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
docker-compose.yml      web + api + db
tests/                  guest/offline Playwright tests
tests/account/          full-stack account Playwright tests
```

### Stack

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

### Browser support

Jaunt targets **Baseline 2023** (Chrome/Edge 111+, Firefox 115+, Safari 16.2+). Features that are Baseline 2023 or earlier may be used without fallbacks; newer platform features need progressive enhancement or a fallback.

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
- **Weather has a 15-day forecast horizon.** Dates beyond that use a five-year climate average and are clearly labeled as typical weather, not a forecast. Weather is requested in ranges of up to 60 days.
- **Multi-city day weather follows plan locations.** A day shows only the cities used by that day’s plans, laid out on one or more lines. Days with plans but no locations show a short nudge when the trip has multiple destinations.
- **Plans without a trip location show no weather.** The free-text address is not used to guess a city. Single-destination trips still show that destination’s day weather.
- **Weather needs a connection to refresh.** The last successful response is cached and shown offline with its update time. Public share pages do not show weather; packing lists use weather only for item suggestions.
- **Weather data comes from Open-Meteo.** Forecasts and climate averages are best-effort, not official alerts or guarantees.
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
