# Known limitations

[← Back to README](../README.md)

- **Last-sync-wins conflicts.** There is no field-level merge for simultaneous edits. It is built for personal use across your own devices and small shared trips.
- **Email/password accounts have no email verification or password reset.** Google sign-in uses Google's verified email. Password registration is plain email + password with no SMTP dependency.
- **One identity per provider; no disconnect UI yet.** An account can connect one Google identity. Removing that connection from Settings is not available yet.
- **Trip invitations are in-app only.** No email is sent; the invited person must already have an account and open their Trips page.
- **Public links are unlisted, not password-protected.** Anyone with the URL can view the itinerary. Revoke the link when you no longer want it shared.
- **Live city suggestions need a connection.** The destination field always accepts typed cities, but suggestions are fetched through the server from [Open-Meteo](https://open-meteo.com/) and are unavailable offline.
- **Weather has a 15-day forecast horizon.** Dates beyond that use a five-year climate average and are clearly labeled as typical weather, not a forecast. Weather is requested in ranges of up to 60 days.
- **Multi-city day weather follows plan locations.** A day shows only the cities used by that day’s plans, laid out on one or more lines. Days with plans but no locations show a short nudge when the trip has multiple destinations.
- **Plans without a trip location show no weather.** The free-text address is not used to guess a city. Single-destination trips still show that destination’s day weather.
- **Weather needs a connection to refresh.** The last successful response is cached and shown offline with its update time. Public share pages do not show weather; packing lists use weather only for item suggestions.
- **Weather data comes from Open-Meteo.** Forecasts and climate averages are best-effort, not official alerts or guarantees.
- **Owners manage the trip shell.** Only the owner can rename/redate a trip, manage members, or delete it; members can edit the itinerary itself.
- **Cross-day dragging is for single-day plans in the trip view.** Multi-day plans keep their duration and must be moved by editing their dates; the calendar month grid is not a drop target yet.
- **Theme settings are per browser.** They do not sync between devices or accounts.
- **Guest data is local to one browser.** Use backup/restore or import into an account to move it.
- **Signing out clears the offline account cache.** Sync first if changes have not gone up.
- **Attachments live in PostgreSQL.** Convenient for backups, but large ticket libraries increase database size.
- **Single-host deployment.** The web app and API are designed to share an origin and live at the domain root.
- **English interface.** Dates and times use native browser inputs.
