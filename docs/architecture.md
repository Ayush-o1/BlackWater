# Architecture

One Node.js process serves the API, the Socket.IO connection and the web pages, backed by PostgreSQL.

```
Browser ── HTTP /api, WebSocket ──> Express ──> Prisma ──> PostgreSQL
   │                                   │
   └── HTML, CSS, JS (public/) <───────┘
```

## A request, step by step

`PATCH /api/incidents/:id/status` as an example:

1. **Rate limit and body parsing** (`/api` only).
2. **Route** (`src/routes/incident.routes.js`) lists the middleware for the URL.
3. **`requireAuth`** verifies the JWT, then reloads the user from the database. The role and organization used from here on come from that row, not from the token.
4. **`requireRole`** compares the role with the allowed list (403 otherwise).
5. **`validateRequest`** runs the zod schema from `src/validators/` over body, query and params and replaces them with the cleaned values (400 otherwise).
6. **Controller** passes `req.user.orgId`, `req.user.id` and the validated input to a service. Controllers contain no logic.
7. **Service** (`src/services/incident.service.js`) opens a transaction, locks the incident, checks the transition, updates the incident and inserts the timeline event. After the transaction commits it emits a socket event.
8. **Error handler** turns anything thrown into the standard error response.

## Rules worth knowing

**Organization isolation.** Services receive `orgId` as an argument and put it in every `where`. Looking up another organization's record finds nothing, so it answers 404, never 403, and reveals nothing.

**Incident lifecycle.** The allowed moves are a lookup table in `incident.service.js`. It is checked inside the transaction, after the row lock, so concurrent requests cannot both pass the same check.

**Audit trail.** Each write to an incident inserts its `TimelineEvent` in the same transaction, so a change and its record succeed or fail together. The actor is `req.user.id`; nothing the client sends can set it.

**Service health** is a pure function (`src/utils/serviceHealth.js`) over the severities of a service's open incidents, applied on every read. Nothing stores it, so it cannot be stale or disagree with the incidents. The dashboard, service pages and public page all use it; the browser contains no copy of the rule.

**Visibility.** `Incident.isPublic` gates the public API. The public queries filter on it and calculate health from published incidents only, so a private incident has no effect on anything a visitor can see. Public output is built field by field in `src/utils/publicDto.js` (an allow-list), so a column added later stays private until it is added there.

**Invitations.** The token is 32 random bytes; the database keeps only its SHA-256 hash. The link carries the token in the URL fragment, which browsers do not send to servers, so it stays out of access logs. Accepting claims the row with one conditional `UPDATE` inside the transaction that creates the user.

**Real-time.** A socket joins one room, `organization:<orgId>`, chosen by the server from the authenticated user. Services emit after commit, with only an id in the payload. A browser that hears an event refetches through the normal API, so live data is always exactly what the API would return to that user. Every time the socket connects (the first time included) pages refetch once, because anything that changed between loading the page and connecting, or while disconnected, was announced to nobody. Public status pages have no socket and poll every 30 seconds.

## Web interface

`public/` is static files: one HTML page per screen and ES modules, with no bundler.

| Module | Role |
|---|---|
| `js/api.js` | `fetch` wrapper: adds the token, unwraps the response, turns failures into `ApiError`, signs the user out on a rejected token |
| `js/auth.js` | The session in `localStorage` or `sessionStorage`, redirect helpers, role checks for showing or hiding buttons |
| `js/dom.js` | `h()`, which builds elements; text is only ever inserted as text nodes |
| `js/ui.js`, `js/components.js` | Dialogs (native `<dialog>`), toasts, form fields, badges, shared rows and dialogs |
| `js/realtime.js` | The socket, debounced subscriptions, resync after reconnect |
| `js/shell.js` | The sidebar and top bar around every signed-in page; on narrow screens the sidebar is a drawer that makes the rest of the page `inert` while open |
| `js/theme-init.js`, `js/theme.js` | Light and dark themes: a blocking script in `<head>` sets `data-theme` before first paint (a file, because the CSP forbids inline scripts); the module saves the System / Light / Dark choice and follows the OS |
| `js/pages/*.js` | One module per page |

Styles are three files: `css/base.css` (design tokens and reset), `css/layout.css` (page frames) and `css/components.css`. Components use only semantic colour tokens (CSS custom properties); the dark theme redefines the same tokens on `:root[data-theme='dark']`. See [ui-ux/IMPLEMENTATION_GUIDE.md](ui-ux/IMPLEMENTATION_GUIDE.md).

No code anywhere assigns to `innerHTML`, and the Content-Security-Policy forbids inline scripts, event-handler attributes and inline styles, so text a user types can never execute. Hiding a button for a role is a convenience; the server enforces every rule regardless.
