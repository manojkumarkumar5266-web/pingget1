# PingGET — Three products, one Supabase

| Product | Platform | Package / deploy | Build |
|---------|----------|------------------|-------|
| **Customer (User)** | Android / iOS Capacitor | `com.pingget.app` (existing) | `npm run build:user` → `dist-user/` |
| **Partner (DP)** | Android / iOS Capacitor | `com.pingget.dp` (new native project) | `npm run build:dp` → `dist-dp/` |
| **Admin** | Web only (Vercel/browser) | — | `npm run build:admin` → `dist-admin/` |

All three use the **same** Supabase project (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env`).

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  PingGET        │  │  PingGET Partner│  │  PingGET Admin  │
│  (Customer app) │  │  (DP app)       │  │  (Web console)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  One Supabase    │
                    │  Auth + DB + RLS │
                    └──────────────────┘
```

## Dev

```bash
npm install

# Customer app (port 5173)
npm run dev:user

# Partner app (port 5174)
npm run dev:dp

# Admin web (port 5175)
npm run dev:admin
```

## Build

```bash
npm run build:user    # → dist-user/
npm run build:dp      # → dist-dp/
npm run build:admin   # → dist-admin/  (deploy this to Vercel)
npm run build:all
```

## Capacitor — Customer app

Default `capacitor.config.ts` points at `dist-user` / `com.pingget.user`.

```bash
npm run build:user
npx cap sync android   # uses existing android/ project
npx cap open android
```

Update `android/app/src/main/res/values/strings.xml` package to `com.pingget.user` if migrating from the old single-app id.

## Capacitor — Partner app (separate native project)

Use a **second** Android/iOS folder so both apps can be installed on one device:

```bash
# 1. Build DP web assets
npm run build:dp

# 2. First time only — add a dedicated native project
#    Copy capacitor.dp.config.ts over capacitor.config.ts temporarily, OR:
npx cap add android --config capacitor.dp.config.ts
# Prefer: create android-dp/ by copying android/ then:
#   - change applicationId to com.pingget.dp
#   - set app_name to "PingGET Partner"
#   - point Capacitor to webDir dist-dp

# 3. Sync
npx cap sync android --config capacitor.dp.config.ts
```

Recommended layout after setup:

```
android/       → Customer (com.pingget.user, webDir dist-user)
android-dp/    → Partner  (com.pingget.dp,   webDir dist-dp)
```

## Admin web deploy

Deploy **`dist-admin`** only (not the mobile bundles):

```bash
npm run build:admin
# Point Vercel/Netlify output directory to dist-admin
```

Set the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host env.

## Role locking

- Customer build (`VITE_APP_TARGET=user`) only signs in `role=user`
- Partner build (`VITE_APP_TARGET=dp`) only signs in `role=dp`
- Admin build only signs in `role=admin`

Wrong-role accounts are signed out with a clear message.

## Shared code

```
src/lib/supabase.ts     # one client / one project
src/lib/customImages.ts  # shared image paths
src/pages/user|dp|admin  # role UIs
src/apps/*/…Shell.tsx    # product entry shells
src/pages/shared/        # chat, order details
```
