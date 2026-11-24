# Self-hosting

[← Back to README](../README.md)

## Docker quick start

Requirements: Docker and Docker Compose.

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | **Required.** Long random password for PostgreSQL. |
| `API_REPLICAS` | Number of API containers behind nginx (default `3`). |
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

For plain-HTTP localhost testing, set `COOKIE_SECURE=false` in `.env` if your browser does not accept Secure cookies.

The API applies its schema automatically on startup. The database lives in the `jaunt_db` Docker volume. The web container serves the app and load-balances `/api` across the API replicas.

## HTTPS and phones

Service workers, installation, and the full offline app require **HTTPS** (localhost is the exception). A typical production setup uses a Cloudflare Tunnel; TLS is terminated at Cloudflare, and the only proxy inside this repository is the nginx web container that serves the app and forwards `/api`.

1. Keep `WEB_BIND=127.0.0.1` (or `jaunt_web_bind: 127.0.0.1` in Ansible) so the web container is not exposed directly.
2. Route your hostname through a Cloudflare Tunnel to `http://127.0.0.1:8080`.
3. Keep `COOKIE_SECURE=true` in production.

A minimal `cloudflared` config looks like this:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: jaunt.example.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Run `cloudflared tunnel run <TUNNEL_NAME>`, or manage the tunnel from the Cloudflare dashboard. The app and API are intentionally same-origin; keep both under the same hostname. nginx restores the real client IP from Cloudflare's `CF-Connecting-IP` header for loopback and private Docker/LAN tunnel networks; keep the web port bound to `127.0.0.1`, and adjust `set_real_ip_from` in `deploy/nginx.conf` if `cloudflared` runs elsewhere.

## Environment variables

| Variable | Service | Description |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | db, api | Required database password. |
| `API_REPLICAS` | api | Number of API containers behind nginx (default `3`). |
| `WEB_PORT` | web | Public host port (default `8080`). |
| `WEB_BIND` | web | Interface for the web port (default `0.0.0.0`; use `127.0.0.1` behind a tunnel or proxy). |
| `DB_PORT` | db | Local-only host port mapped for development (default `55432`). |
| `COOKIE_SECURE` | api | `true` for HTTPS, `false` for plain HTTP localhost. |
| `SESSION_DAYS` | api | Session lifetime in days (default `90`). |
| `PORT` | api | API port, default `3100` in development. |
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | api | Standard PostgreSQL connection settings. Compose sets these; local dev falls back to the root `.env`. |
| `BCRYPT_ROUNDS` | api | bcrypt cost (default `12`). |

## Database backups

Account data lives in PostgreSQL:

```bash
# Back up
docker compose exec -T db pg_dump -U jaunt -d jaunt > jaunt-$(date +%F).sql

# Restore (into an empty/fresh database is safest)
cat jaunt-2026-11-10.sql | docker compose exec -T db psql -U jaunt -d jaunt
```

The Docker volume should also be included in your normal server backup routine. Attachment files (photos and PDFs) are stored in PostgreSQL alongside their metadata, so a database dump includes tickets.

Signing out does **not** delete server data. Deleting your account does; see [Deleting an account](using-jaunt.md#deleting-an-account).

For the included Ansible deployment, rolling updates, restore procedures, and rollback, see [Deployment](deployment.md).

For local development, tests, project structure, and customization, see [Development](development.md).
