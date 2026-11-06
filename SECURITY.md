# Security

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). Include what you found, how to reproduce it and what it affects.

## How the application protects itself

| Area | What is done | Where |
|---|---|---|
| Passwords | Hashed with bcrypt (cost 10). Length limited to 72 characters, bcrypt's real limit, instead of silently truncating. Login takes the same time for unknown emails, and gives the same message. | `services/auth.service.js` |
| Sessions | JWT signed with HS256, with the algorithm pinned when verifying. The user is reloaded from the database on every request, so deleted accounts and changed roles take effect immediately. The secret must be at least 32 characters or the server will not start. | `utils/jwt.js`, `middleware/auth.middleware.js` |
| Authorization | Role checks on every route, enforced on the server. Hiding a button in the interface is only a convenience. | `middleware/rbac.middleware.js`, `routes/` |
| Tenant isolation | Every query filters by the signed-in user's organization; other organizations' records answer 404. Covered by tests for each resource. | `services/`, `tests/integration/` |
| Input validation | Every request body, query and parameter is validated with zod; unknown fields are dropped, so fields such as `status`, `orgId` or `role` cannot be smuggled into an edit. | `validators/` |
| Invitations | 256-bit random tokens; only the SHA-256 hash is stored. One use, 7-day expiry, claimed atomically so parallel attempts cannot both succeed. Invitations cannot create administrators, enforced in the validator, in the service and by a database `CHECK`. Unknown, expired and used links are indistinguishable. The token travels in the URL fragment and in POST bodies, never in a query string. | `services/invitation.service.js` |
| Organization deletion | Administrators only, and it needs the administrator's own password and the organization's exact name, so a stolen token alone cannot erase an organization. Wrong attempts share the login rate limit. The deletion runs in one transaction and cuts the organization's live connections; operators get a log line with ids only. | `services/organization.service.js` |
| Last admin | A lock on the organization's admin rows prevents demoting the last administrator, even under concurrent requests. | `services/user.service.js` |
| Public data | The public API reads only published incidents and builds its output field by field from an allow-list. Health shown publicly is calculated from published incidents only. Actors and user ids never appear. | `services/status.service.js`, `utils/publicDto.js` |
| Cross-site scripting | No `innerHTML` anywhere: user text is inserted only as text nodes. A strict Content-Security-Policy allows scripts and styles from the same origin only, and no inline scripts, handlers or styles. Tested in a real browser with hostile input. | `public/js/dom.js`, `app.js` |
| Open redirects | The post-login destination is accepted only if it is a same-site path. | `public/js/auth.js` |
| Transport and headers | `helmet` defaults (HSTS, no-sniff, frame protection, and more). `upgrade-insecure-requests` in production. | `app.js` |
| Abuse | Per-IP rate limits: 20 per 15 minutes for registration, invitation links and failed logins (successful logins are not counted, so people sharing an address are not locked out by each other), and a looser one for the rest of the API. Behind a proxy `TRUST_PROXY` must be set or all visitors share one counter. | `middleware/rateLimit.middleware.js`, `routes/auth.routes.js` |
| Cross-origin requests | No CORS is enabled: the pages, API and socket share one origin, so no other website can read a signed-in user's responses. Tested. | `app.js` |
| Caching | Every `/api` response carries `Cache-Control: no-store`; the data is private and differs per user. | `app.js` |
| Errors | Responses use one shape. Unexpected errors are logged and returned as a generic message in production, so SQL, paths and stack traces never reach clients. Invalid JSON gets 400, not 500. | `middleware/error.middleware.js` |
| Cross-site WebSockets | The socket is authenticated by the token in its handshake, not by a cookie, so another site cannot connect as a visitor. Each socket joins only its own organization's room. | `socket/` |
| Database | Queries go through Prisma (parameterised). The three raw queries (two row locks and the health check) use tagged templates, which bind their values. Migrations are plain SQL under version control. | `prisma/`, `services/` |
| Dependencies | `npm audit` reports no known vulnerabilities at the time of writing. | |

## Known limitations

- **Tokens are not revocable.** A stolen token works until it expires (`JWT_EXPIRES_IN`, default one day). There is no refresh-token flow and no "sign out everywhere". Keep the lifetime short if this matters to you.
- **The token is kept in the browser's storage** (`localStorage`, or `sessionStorage` when "keep me signed in" is off), so cross-site scripting would expose it. The Content-Security-Policy and the text-only rendering are the defences against that. An HttpOnly cookie would remove the exposure at the price of CSRF handling.
- **Registration is open.** Anyone who can reach the server can create an organization.
- **No multi-factor authentication, password reset or account lockout.** The per-IP limit on failed logins is the only brake on password guessing; it does not stop a slow attack spread over many addresses.
- **Rate limits and sockets are per process.** Do not run several instances without moving both to a shared store.
- **Public status pages are addressed by the organization id.** The id is a random UUID and is not a secret; the protection is that only published data is served.
- **Individual users cannot be removed.** An administrator can reduce a person to Viewer but not delete them; only a whole organization can be deleted, which is permanent.

## Operating it safely

- Use a long random `JWT_SECRET` and keep it out of version control. `.env` files are git-ignored.
- Serve over HTTPS and set `TRUST_PROXY` correctly behind a proxy.
- Give the application a database user with only the rights it needs, and allow connections to the database only from the application where the provider lets you (the Render Blueprint does).
- Take a backup before each release that adds a migration (see [Deployment](docs/deployment.md#backup-and-recovery)).
- Keep dependencies current (`npm audit`).
