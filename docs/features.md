# Features

[← Back to README](../README.md)

For accounts, sharing, offline mode, and installation, see [Using Jaunt](using-jaunt.md).

- **Today, automatically** — the dashboard opens on the current day with an “up next” card, countdown, progress, every plan, and every trip that is active today.
- **Accounts** — sign in with Google (OpenID Connect) or plain email + password. Sessions are HTTP-only cookies; passwords are hashed.
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
