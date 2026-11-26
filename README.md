# Jaunt

**Good days, planned.**

Jaunt is a self-hosted, installable day and trip planner. It opens on today, keeps tickets attached to the plans that need them, and lets you cross things off as the day unfolds.

It works two ways: signed in with Google or an email and password, with trips and plans syncing across devices through a small API and PostgreSQL, or entirely offline as a guest with data stored only in the browser.

## Highlights

- **Today, automatically** — the dashboard opens on the current day with an “up next” card, countdown, progress, and every active trip.
- **Google sign-in** — sign in with Google, or use an email and password and connect Google later from Settings.
- **Trips and plans** — multi-day trips, multi-city destinations, day-part or exact times, drag-to-reorder and move plans between days, and a calendar view.
- **Offline-first** — plans and edits are saved locally in IndexedDB and sync when you reconnect.
- **Tickets and packing lists** — attach photos and PDFs to plans, and keep a personal packing list for each traveler.
- **Weather for every stop** — forecasts, historical weather, and climate averages for each destination.
- **Sharing** — invite other accounts to a trip, or publish a read-only itinerary link without exposing notes, confirmations, or tickets.
- **Installable PWA** — a proper home-screen app with offline caching and update prompts.

## Quick start

Requires Docker and Docker Compose.

```bash
cp .env.example .env
# set POSTGRES_PASSWORD in .env
docker compose up -d --build
```

Open [http://localhost:8080](http://localhost:8080). For plain-HTTP localhost testing, set `COOKIE_SECURE=false` in `.env`.

For HTTPS, phones, configuration, and backups, see [Self-hosting](docs/self-hosting.md).

## Documentation

| Guide | Contents |
| --- | --- |
| [Features](docs/features.md) | The full feature list |
| [Using Jaunt](docs/using-jaunt.md) | Accounts, shared trips, public links, offline mode, install, guest backups |
| [Self-hosting](docs/self-hosting.md) | Docker, environment variables, HTTPS, database backups |
| [Deployment](docs/deployment.md) | Ansible, rolling updates, rollback |
| [Architecture](docs/architecture.md) | System design and sync model |
| [Development](docs/development.md) | Local setup, tests, project structure, customization |
| [Known limitations](docs/known-limitations.md) | Current constraints |

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Dexie/IndexedDB, Node 24, Express 5, PostgreSQL 17, and Playwright. See [Development](docs/development.md#stack) for the full list.

## License

Jaunt is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](LICENSE) for the full text.
