# Using Jaunt

[← Back to README](../README.md)

## Accounts

You can create an account with Google or with an email and password. Password accounts have no email verification and no password-reset email flow because Jaunt does not assume you have SMTP configured.

### Signing in with Google

Choose **Continue with Google** on the sign-in screen. A new Jaunt account is created the first time. If an account already exists for that email, Jaunt does not link it automatically: sign in with the method already on that account, then connect Google from **Settings → Sign-in & security**.

Google-only accounts can add a password in Settings so they can also sign in with email or keep a fallback.

### Shared trips

Any account owner can open a trip → **People** → invite another user by email. Invitations require the other person to already have a Jaunt account; nothing is sent by email. Instead, pending invitations appear on their **Trips** page the next time they open it. They can accept or decline.

- **Owners** can edit trip details, invite/remove people, and delete the trip.
- **Members** can view the trip and add, edit, complete, reorder, or delete plans and ticket files. They cannot change trip details or manage members.
- **Packing lists are personal.** Everyone on the trip can select and view each other’s lists, but only the list owner can add, check off, edit, or remove items. A traveler’s list is removed if they leave or are removed from the trip.
- Members can leave a shared trip from the People sheet.
- Accepted shared trips sync down and work offline like any other trip. Removing someone from a trip clears the shared copy on their device the next time they sync.
- As with any other account data, invite acceptance and member changes require a connection.

### Public read-only links

A trip owner can open a trip → **Share** → **Create public link**. The link opens a standalone read-only itinerary page for people who do not have a Jaunt account. The page shows the trip name, destination, dates, and the day-by-day itinerary (plan names, dates, times, locations, and types).

For privacy, public pages deliberately **do not** include trip/plan notes, confirmation numbers, external links, or ticket/photo attachments. Revoking a link from the Share sheet makes the old URL return “no longer available” immediately. Anyone with the URL can view the page, so treat the link as unlisted rather than password-protected.

## Security

- Passwords are hashed with bcrypt (cost 12 by default).
- Passwords can be changed in **Settings → Sign-in & security**. The change requires the current password and signs out every other session; the current device stays signed in.
- Google-only accounts can set a password from **Settings → Sign-in & security**.
- Sessions are random 32-byte tokens stored hashed in PostgreSQL and sent as `HttpOnly`, `SameSite=Lax` cookies.
- Sessions last 90 days by default and expired sessions are cleaned up.
- Login and registration are rate limited.
- Public share links use random 192-bit tokens stored on the trip; revoking a link clears the token and returns 404.
- The API is only reachable through the same-origin nginx proxy in the default setup.
- State-changing API requests require a same-origin fetch header and a matching `Origin`, in addition to `SameSite=Lax` cookies.
- Activity links are restricted to `http` and `https` URLs before they are stored or rendered.
- Attachment downloads force non-image/non-PDF content types to download as octet-stream, so uploaded files cannot execute as app-origin HTML.

Change or set your password from **Settings → Sign-in & security**. Because there is no reset email, **store your password safely**. If you lose it, an administrator with database access can help; there is no self-service recovery. Google-only accounts can still sign in with Google.

Account display name and color start from the email and can be changed in **Settings → Edit account profile**.

## Deleting an account

You can delete your own account from **Settings → Your data → Delete account**. Type **Delete** to confirm. This permanently removes the account, trips, plans, packing lists, and ticket files from the server and this device. The action cannot be undone, so use **Download my data** first if you want a copy.

The confirmation is a typed **Delete**, not your password, so only do this on a device you trust.

Deleting your account also removes you from shared trips. Trips you own are removed from the other members' devices on their next sync.

If you have server access and need to remove an account manually, deleting the user row removes the account and its owned rows, but it bypasses the tombstones that tell other members' devices to drop shared trips. Prefer the Settings flow:

```bash
docker compose exec db psql -U jaunt -d jaunt \
  -c "DELETE FROM users WHERE email = 'you@example.com';"
```

## Offline and guest mode

Choose **Continue offline** on the first screen (or from sign-in). Guest mode:

- Creates local profiles stored in IndexedDB.
- Never contacts the account API for data.
- Works fully offline after the app has been loaded/installed.
- Can be backed up from **Settings → Download backup**.
- Can be imported into an account from **Settings → Bring your offline plans along**.

An account also works offline: after the first successful sync, account data and ticket files are cached in the browser. You can add, edit, complete, reorder, and delete plans offline. The app shows an offline banner and retries automatically. Changes queue until the next sync. Global search also reads this local cache, so it keeps working offline.

Signing out removes the account cache from that browser. Anything not yet synced would be lost, so the app warns you to sync first.

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

## Guest profile backups

**Settings → Your data → Download backup** exports all **guest** profiles, trips, plans, packing lists, and ticket files into one JSON file. Account cache data is intentionally excluded. Restoring replaces guest data only; account data and sync cursors are left alone.

Account data lives in PostgreSQL; see [Database backups](self-hosting.md#database-backups) in the self-hosting guide.
