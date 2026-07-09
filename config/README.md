# Per-environment runtime config (ADR-0024)

One web build serves every environment (ADR-0014). At startup `ConfigService`
(`src/app/core/config.ts`) fetches `/config.json`; the deploy drops the right
file. These `config.<env>.json` files are the **tracked, secret-free templates**
(the hostnames are the authoritative ADR-0024 map); the served `config.json`
itself is gitignored because it also carries the per-env publishable keys.

| Env | `apiBaseUrl` | Web-app origin (where this build is served) |
|---|---|---|
| dev (local) | `https://api-dev.localhost.com:8000` | `https://app-dev.localhost.com` |
| uat | `https://api-uat.roadtravel.info` | `https://app-uat.roadtravel.info` |
| prod | `https://api.roadtravel.info` | `https://app.roadtravel.info` |

Marketing/legal stay on the apex `roadtravel.info` (+ `www`).

## Selecting a config

```bash
# Deploy pipeline: copy the target env's template into the served web root as config.json,
# then fill supabaseAnonKey / mapboxToken / revenueCatWebApiKey from that env's secrets.
cp config/config.<env>.json <served-root>/config.json

# Local dev, pointed at DEV Supabase:
cp config/config.dev.json public/config.json   # then fill supabaseAnonKey locally (gitignored)
```

`supabaseUrl`/`supabaseAnonKey`/`mapboxToken`/`revenueCatWebApiKey` are left blank
in uat/prod (and the anon key blank in dev) — fill them from that environment's
secrets at deploy time, never commit real keys. `config.example.json` is the
generic slot list.

## Local-dev caveat (ADR-0024)

`app-dev.localhost.com` / `api-dev.localhost.com` are **not** automatically
loopback and a custom HTTP domain breaks Secure cookies + passkeys/WebAuthn, and
an HTTPS app page calling an HTTP API triggers mixed-content blocking. To use the
dev domain as specified:

1. `/etc/hosts`: `127.0.0.1 app-dev.localhost.com api-dev.localhost.com`
2. Serve local **HTTPS** with a locally-trusted cert (`mkcert`): the web app on
   `https://app-dev.localhost.com`, and run core on `https://api-dev.localhost.com:8000`
   via `uvicorn … --ssl-keyfile … --ssl-certfile …`. Set the passkey **RP ID** to
   `app-dev.localhost.com`.

**Simpler fallback** (fewer moving parts, same code): point the dev `config.json`
at `http://localhost:8000` and serve the app at `http://localhost:4200` (or use
the auto-loopback `*.localhost` variants). The build honors whatever host is in
`config.json` + the hosts file.
