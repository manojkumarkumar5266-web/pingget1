# PingGET — Three products, one Supabase

| Product | Platform (now) | URL / package | Build |
|---------|----------------|---------------|-------|
| **Customer (User)** | Web (Android later) | `/` | part of `build:web` |
| **Partner (DP)** | Web (Android later) | `/dp` | part of `build:web` |
| **Admin** | Web | `/admin` | part of `build:web` |

All three use the **same** Supabase project (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env`).

## Unified web (recommended deploy)

```bash
npm install
npm run dev          # one server — open /, /dp, /admin
npm run build:web    # → dist/  (Vercel)
```

Vercel: `buildCommand = npm run build:web`, `outputDirectory = dist`.

## Separate targets (Capacitor later)

```bash
npm run dev:user     # :5173
npm run dev:dp       # :5174
npm run dev:admin    # :5175

npm run build:user   # → dist-user/
npm run build:dp     # → dist-dp/
npm run build:admin  # → dist-admin/
```

## Images

Replace PNGs under `public/images/` with the same filenames. See `public/images/README.md`.
When your art zip is ready, unpack there — screens pick up assets automatically.

## Maps

Leaflet removed. Scanning + tracking use **MapLibre** + **OpenFreeMap** (free OSM tiles, no API key).
