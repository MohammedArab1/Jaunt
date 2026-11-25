# Deployment

[← Back to README](../README.md)

This guide covers the included Ansible workflow. For a first-time Docker setup, environment variables, HTTPS, and database backups, see [Self-hosting](self-hosting.md).

## Prerequisites

The `ansible/` directory deploys the stack to the host in `ansible/inventory.ini`.

On the machine you deploy from:

```bash
ansible-galaxy collection install -r ansible/requirements.yml
ssh <deploy-user>@<host> true
```

The deploy user must be able to run Docker without sudo (normally membership in the `docker` group; log out and back in after adding it) and must own `jaunt_app_dir`. The playbook runs without privilege escalation and does not manage swap.

## Configuration

Create the optional secrets file:

```bash
cp ansible/vars/production.example.yml ansible/vars/production.yml
# edit it; the file is gitignored and can be ansible-vault encrypted
```

If the server checkout already has a `.env` with the database password, leaving `jaunt_postgres_password` empty adopts that password. If you are moving an existing deployment, copy its `.env` into the new `jaunt_app_dir` (or set `jaunt_postgres_password`) so the app keeps using the same database password. The Compose project name is unchanged, so an existing `jaunt` database volume on the same host is reused.

### Google sign-in (optional)

Set the OAuth client values in `ansible/vars/production.yml` (the file is gitignored and can be ansible-vault encrypted):

```yaml
jaunt_google_client_id: "1234567890-abc.apps.googleusercontent.com"
jaunt_google_client_secret: "replace-me"
```

`jaunt_public_url` defaults to `https://<jaunt_domain>` and is rendered into the API as `PUBLIC_URL`. Register this authorized redirect URI in Google Cloud exactly:

```text
<jaunt_public_url>/api/auth/oauth/google/callback
```

Keep the client secret out of `group_vars` and out of the repository. See [Self-hosting](self-hosting.md#google-sign-in-optional) for the Google Cloud setup.

The repository is the source of truth. The deploy refuses to run if your local working tree is dirty or if `HEAD` differs from the deploy branch. Commit and push first:

```bash
git add -A
git commit -m "Describe the change"
git push origin main
./ansible/deploy.sh
# or
npm run deploy
```

The server keeps its own checkout at `jaunt_app_dir`, fetches the configured branch, and hard-resets to it. Uncommitted local files are never copied to the server. If the repository is private, configure a read-only deploy key on the server or point `jaunt_repo_url` at an authenticated URL.

## What each run does

1. Pulls the pushed commit from `jaunt_repo_url` into `jaunt_app_dir` with `git fetch` and a hard reset. Untracked files are removed, except the gitignored `.env`, `backups/`, dependencies, and build output.
2. Renders `.env` from `ansible/group_vars/all.yml` and the preserved database password.
3. Dumps PostgreSQL to `backups/` (14-day retention) and tests the archive.
4. Builds `api` then `web` with `--pull` and a cache-busting build argument.
5. Rolls the API replicas onto the new image one container at a time, then recreates the web container. PostgreSQL is left running.
6. Checks `/api/health` on the host's web port.
7. Removes dangling images and build cache older than 24 hours.
8. If the rollout or health check fails, retags the previous images and rolls the API back one container at a time, then recreates web on the previous image.

## Rolling updates

API updates are rolling: `ansible/rollout.sh` replaces one API container at a time and waits for it to become healthy before continuing, so the other replicas keep serving. PostgreSQL is never restarted by a deploy. The web container owns the published host port, so it is recreated rather than rolled and a release can briefly interrupt the web layer; true zero-downtime web updates would need a separate ingress and multiple web replicas.

Database service changes are deliberately not applied by a deploy. PostgreSQL is left running; if you change the `db` service definition, restart it deliberately with `docker compose up -d db`.

The playbook does not manage Cloudflare Tunnel, DNS, or TLS. Configure the tunnel to forward to `http://127.0.0.1:8080` (the default `jaunt_web_bind`) and create the corresponding DNS route in Cloudflare. If you instead expose the port directly, set `jaunt_web_bind: 0.0.0.0` in `ansible/group_vars/all.yml`. `jaunt_domain` only decides whether session cookies are marked secure, so it requires HTTPS to be working.

## Data safety

The `jaunt_db` volume is never removed by this playbook. `docker compose down -v` is never used. To restore a dump:

```bash
ssh <deploy-user>@<host>
cd <jaunt_app_dir>
gunzip -c backups/jaunt-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U jaunt -d jaunt
```

To roll back manually:

```bash
ssh <deploy-user>@<host>
cd <jaunt_app_dir>
docker tag jaunt-web:previous jaunt-web:latest
docker tag jaunt-api:previous jaunt-api:latest
# Use your configured API_REPLICAS value instead of 3 if it differs.
bash ansible/rollout.sh api 3 "$PWD" jaunt "$PWD/docker-compose.yml"
docker compose up -d --no-deps --force-recreate --wait web
```

`COOKIE_SECURE` becomes `true` automatically when `jaunt_domain` is set. For a plain-HTTP deployment, set `jaunt_cookie_secure: "false"` in `ansible/group_vars/all.yml`; installation and service workers still require HTTPS.
