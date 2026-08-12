# PingGET — Three products, one Supabase

| Product | Platform | URL / package | Build |
|---------|----------|---------------|-------|
| **Customer (User)** | Web + Android | `/` · `com.pingget.customer` | `build:web` / `build:android:user` |
| **Partner (DP)** | Web + Android | `/dp` · `com.pingget.dp` | `build:web` / `build:android:dp` |
| **Admin** | Web | `/admin` | part of `build:web` |

All three use the **same** Supabase project (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env`).

## Unified web (recommended deploy)

```bash
npm install
npm run dev          # one server — open /, /dp, /admin
npm run build:web    # → dist/  (Vercel)
```

Vercel: `buildCommand = npm run build:web`, `outputDirectory = dist`.

## Separate targets (Capacitor)

```bash
npm run dev:user     # :5173
npm run dev:dp       # :5174
npm run dev:admin    # :5175

npm run build:user   # → dist-user/
npm run build:dp     # → dist-dp/
npm run build:admin  # → dist-admin/
```

Native Android projects:

| App | Capacitor config | Native folder | Package |
|-----|------------------|---------------|---------|
| Customer | `capacitor.config.ts` | `android-customer/` | `com.pingget.customer` |
| Partner | `capacitor.dp.config.ts` | `android-dp/` | `com.pingget.dp` |

```bash
npm run build:android:user   # sync dist-user → android-customer
npm run build:android:dp     # sync dist-dp → android-dp
npm run cap:open:android:user
npm run cap:open:android:dp
```

Place Firebase configs (download from Console — do not invent):

- `android-customer/app/google-services.json` ← `com.pingget.customer`
- `android-dp/app/google-services.json` ← `com.pingget.dp`

See `MOBILE_BUILD.md` and `docs/firebase/README.md`.

## Images

Replace PNGs under `public/images/` with the same filenames. See `public/images/README.md`.
When your art zip is ready, unpack there — screens pick up assets automatically.

## Maps

Leaflet removed. Scanning + tracking use **MapLibre** + **OpenFreeMap** (free OSM tiles, no API key).
