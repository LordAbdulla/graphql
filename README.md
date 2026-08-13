# GraphQL Profile

A personal profile page for the Reboot01 learning platform. It signs in against
the platform's auth endpoint, queries the GraphQL API with the resulting JWT,
and renders the results as hand-built SVG charts.

No framework, no build step, no dependencies.

## Running locally

ES modules are blocked over `file://`, so the page must be served over HTTP.
Opening `index.html` directly will fail with a CORS error.

```bash
python -m http.server 5500
# then open http://localhost:5500
```

## Layout

```
index.html
css/style.css
js/
  config.js     endpoints and the cursus path prefix
  auth.js       signin, JWT storage/decode, logout
  api.js        GraphQL fetch wrapper
  queries.js    the GraphQL queries
  data.js       fetching and reshaping for the charts
  charts.js     the two SVG charts
  app.js        view switching and rendering
```

## Authentication

`POST` to `/api/auth/signin` with an `Authorization: Basic base64(id:password)`
header, where `id` is either a username or an email. The endpoint returns a JWT,
stored in `localStorage` and sent as `Authorization: Bearer <jwt>` on every
GraphQL request. Logging out clears it; an expired or rejected token returns to
the login view.

## Queries

All three required querying styles are used, in `js/queries.js`:

| Style | Query | What it does |
|---|---|---|
| Plain | `PROFILE` → `user` | bare `{ user { … } }`, no arguments |
| Arguments | `PROFILE` → `xp`, `level`; `AUDIT_TOTALS` | `where` / `order_by` / `limit`, passed as variables |
| Nested | `PROFILE` → `xp → object` | `transaction → object`, plus `where` and `order_by` |

The user ID is read out of the JWT (`auth.js` → `getUserId`) and passed as the
`$userId` variable, so every query is explicitly scoped to the signed-in user.

`PROFILE` is a single request: GraphQL aliases let it resolve the user record,
the XP timeline, and the level all in one round trip, rather than firing one
HTTP request per query. `AUDIT_TOTALS` and `XP_PATHS` are fallbacks that only
fire when something's actually missing — if `totalUp`/`totalDown`/`auditRatio`
aren't on the `user` row, audit totals are summed from the `transaction` table
instead; if the configured path matches zero transactions, the page reports the
path prefixes your account actually has.

`js/config.js` holds `MODULE_PATH`, the path prefix of the main curriculum. XP
earned outside it (the standalone entry piscine) is excluded so totals match
the platform's own profile page. If it matches nothing, the page says so and
lists the path prefixes your account actually has, rather than rendering empty.

One nested exception: `/bahrain/bh-module/piscine-js` is a single lump
transaction (~70 kB) awarded *inside* the module for finishing piscine-js. The
platform counts that lump, not the individual piscine-js exercises nested
under it (`/bahrain/bh-module/piscine-js/quest-01/…`) — their XP is already
inside the lump. `PISCINE_JS_EXCLUDE_PATH` drops just that subtree (note the
trailing slash, so it excludes the exercises but not the lump itself), and
`xp` and `level` in `PROFILE` both filter through the same `$path`/
`$excludePath` pair so the two never describe a different set of work.

## Charts

Written directly against the SVG DOM — no charting library.

1. **XP over time** — cumulative area + line, with a hover crosshair and tooltip.
2. **XP by project** — horizontal bars, top ten, value labelled at each tip.
3. **Audit ratio** — audit points given against points received, on one shared
   scale, with the ratio called out below.

## Hosting

The site is static, so any static host works, and all asset paths are relative
so it runs from a project subpath too.

Note that `origin` points at the school's Gitea repo — that's the submission
target, not a host. Hosting needs a separate remote or upload.

**GitHub Pages** — create an empty repo, then:

```bash
git remote add github https://github.com/<user>/<repo>.git
git push -u github main
```

Then **Settings → Pages → Deploy from a branch**, `main`, `/ (root)`.

**Netlify** — drag the project folder onto <https://app.netlify.com/drop>.

Either way, open the published URL in a private window and sign in there.
