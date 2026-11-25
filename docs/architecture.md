# Architecture

[← Back to README](../README.md)

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
   └── proxies /api ──► Node API replicas (Express + sessions) ──► PostgreSQL
```

Cloudflare terminates TLS and routes the public hostname through a Cloudflare Tunnel to `cloudflared` on the host. `cloudflared` forwards to nginx on `127.0.0.1:8080`; nginx serves the built app and load-balances `/api` across the API replicas (`API_REPLICAS`, default 3). The API owns accounts, sessions, sync, and attachment files. PostgreSQL is the durable account store, so any API replica can serve any request. Schema initialization is serialized with a PostgreSQL advisory lock when replicas start together. The browser keeps an IndexedDB mirror so a signed-in account still opens and works offline.

See [Self-hosting](self-hosting.md) for the Cloudflare Tunnel configuration and [Deployment](deployment.md) for the rolling API replacement.

## Sign-in

Password accounts use bcrypt hashes and the PostgreSQL-backed session cookie. External sign-in uses the OIDC authorization-code flow with PKCE. `oauth_transactions` stores short-lived state, nonce, and verifier rows shared by all API replicas, and `user_identities` maps a provider's stable subject to a user. Google is the first provider; add another in `server/src/oauth/providers.ts` and the frontend will render its button automatically.

## Sync model

- Local writes mark rows dirty and queue deletions. The client pushes those first, then pulls everything new.
- Revision-changing operations (syncs, ticket uploads, invitations/membership changes) are serialized with a PostgreSQL advisory lock, so the revision cursor cannot skip a concurrent commit.
- Attachment metadata syncs with the plan data; file bytes upload/download separately.
- Conflicts resolve **last-sync-wins**. This is a personal planner, not a real-time collaborative editor; simultaneous edits of the same plan on two devices are not merged field-by-field.
- Signing out removes that account's offline cache from the browser. Server data remains.

For the implementation stack and project layout, see [Development](development.md).
