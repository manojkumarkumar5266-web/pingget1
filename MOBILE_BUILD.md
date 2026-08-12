# PingGET — Mobile App Build Guide (Capacitor)

PingGet ships **two** Android apps (same Supabase backend):

| App | Config | Native folder | Package / Play ID |
|-----|--------|---------------|-------------------|
| Customer | `capacitor.config.ts` | `android-customer/` | `com.pingget.customer` |
| Delivery Partner | `capacitor.dp.config.ts` | `android-dp/` | `com.pingget.dp` |

## Prerequisites

Install these on your local machine before starting:

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Bundled with Node |
| Android Studio | Hedgehog (2023.1.1) or newer | For Android builds |
| Java JDK | 17 | Required by Android Studio (Gradle 8.7 requires JDK 17) |
| Xcode | 15+ | macOS only, for iOS builds |
| Apple Developer Account | — | $99/year, for App Store |

---

## Step 1 — Configure MSG91 secrets

Before the OTP flow works, add your MSG91 credentials in the Supabase dashboard:

1. Go to **Supabase Dashboard → Edge Functions → Manage Secrets**
2. Add these two secrets:

| Secret name | Where to find it |
|-------------|-----------------|
| `MSG91_AUTH_KEY` | MSG91 Dashboard → API → Auth Key |
| `MSG91_TEMPLATE_ID` | MSG91 Dashboard → SMS → OTP Templates → your template ID |

**MSG91 OTP template setup:**
- Create a new template in MSG91 → SMS → OTP Templates
- The template body must include `##OTP##` as the placeholder, e.g.:
  `Your PingGET verification code is ##OTP##. Valid for 10 minutes. Do not share.`
- Note the Template ID once approved

---

## Step 2 — Clone and install

```bash
git clone <your-repo-url>
cd pingget
npm install
```

---

## Step 3 — Firebase `google-services.json` (required for FCM)

In Firebase Console, create **two** Android apps (or download existing ones):

1. Package **`com.pingget.customer`** → save as:

   ```
   android-customer/app/google-services.json
   ```

2. Package **`com.pingget.dp`** → save as:

   ```
   android-dp/app/google-services.json
   ```

Do **not** reuse the old `com.pingget.app` file or only change `package_name` — FCM `mobilesdk_app_id` must match each app.

See `android-customer/app/README-google-services.md`, `android-dp/app/README-google-services.md`, and `docs/firebase/README.md`.

---

## Step 4 — Build web targets

```bash
npm run build:user   # → dist-user/  (customer Capacitor webDir)
npm run build:dp     # → dist-dp/    (partner Capacitor webDir)
```

Or unified web (Vercel): `npm run build:web` → `dist/`.

---

## Step 5 — Sync / open Android projects

Native folders already exist in the repo. After web changes:

```bash
npm run build:android:user   # build:user + cap sync → android-customer
npm run build:android:dp     # build:dp + cap sync → android-dp

npm run cap:open:android:user
npm run cap:open:android:dp
```

Equivalent sync-only helpers: `npm run cap:sync:user` / `npm run cap:sync:dp`.

Capacitor 6 only loads `capacitor.config.ts`. DP commands use `scripts/run-cap.mjs` to temporarily apply `capacitor.dp.config.ts` (then restore).

**In Android Studio:**
1. Open the folder (`android-customer` or `android-dp`)
2. Wait for Gradle sync
3. **Build > Select Build Variant** → `release` for Play uploads

---

## Step 6 — Android API / Gradle notes

Both projects use the same Gradle layout. Prefer keeping SDK versions aligned in each project's `variables.gradle`:

```groovy
ext {
    minSdkVersion = 23
    compileSdkVersion = 35
    targetSdkVersion = 35
    // ... androidx versions as in repo
}
```

Project-level AGP / Google Services classpaths live in each `android-*/build.gradle`.

---

## Generate Signed Android App Bundle (.aab) for Google Play

Use a **separate** keystore (or at least a separate alias) per Play listing if you publish two apps.

### Create a keystore (first time only)

```bash
keytool -genkey -v \
  -keystore pingget-release.keystore \
  -alias pingget \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Option A — Sign via Android Studio (recommended)

1. **Build → Generate Signed Bundle / APK**
2. Select **Android App Bundle (.aab)**
3. Point to your keystore
4. Select `release` build variant
5. Finish — `.aab` under `android-customer/app/release/` or `android-dp/app/release/`

### Option B — Sign via command line

Add signing config to `android-customer/app/build.gradle` or `android-dp/app/build.gradle`, then:

```bash
cd android-customer   # or android-dp
KEYSTORE_PASSWORD=your_ks_pass KEY_PASSWORD=your_key_pass ./gradlew bundleRelease
```

Output example: `android-customer/app/build/outputs/bundle/release/app-release.aab`

---

## Build for iOS

```bash
npm run cap:open:ios
```

**In Xcode:**
1. Select your Apple Developer Team under **Signing & Capabilities**
2. Customer bundle ID: `com.pingget.customer` (partner: `com.pingget.dp` when you add a second iOS target)
3. **Product > Archive** → Distribute to App Store Connect

---

## App Icons & Splash Screens

Place source files in an `assets/` folder at the project root, then generate:

```bash
npm install -g @capacitor/assets
npx capacitor-assets generate
```

Required source files:

| File | Size | Format |
|------|------|--------|
| `assets/icon.png` | 1024×1024 px | PNG, no transparency |
| `assets/splash.png` | 2732×2732 px | PNG |
| `assets/icon-foreground.png` | 1024×1024 px | PNG (adaptive icon foreground) |
| `assets/icon-background.png` | 1024×1024 px | PNG (adaptive icon background) |

Run generate once per Capacitor config / native project as needed.

---

## Environment variables

The app reads Supabase credentials from `.env` at build time:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Do not commit `.env` to source control.

---

## Google Play Store checklist

- [ ] Two Play listings (or internal tracks) for `com.pingget.customer` and `com.pingget.dp`
- [ ] Each app has its own `google-services.json`
- [ ] App signed with release keystore
- [ ] Android App Bundle (.aab) generated per app
- [ ] `compileSdkVersion` / `targetSdkVersion` = 35 in each `variables.gradle`
- [ ] Icons, screenshots, privacy policy, content rating
- [ ] MSG91 credentials set in Supabase Edge Function secrets

## Apple App Store checklist

- [ ] Apple Developer account active
- [ ] Bundle IDs registered (`com.pingget.customer`, and partner when ready)
- [ ] Screenshots, privacy policy, review info
- [ ] MSG91 credentials set in Supabase Edge Function secrets

---

## Troubleshooting

**OTP not received:**
- Confirm `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` are set in Supabase Edge Function secrets
- Check the template is approved in MSG91 dashboard
- Check Edge Function logs: Supabase Dashboard → Edge Functions → send-phone-otp → Logs

**Push / FCM not working:**
- Confirm `google-services.json` package_name matches `applicationId` exactly
- Confirm server uses the same Firebase project and the correct Android app

**Gradle sync fails:**
- Make sure Java JDK 17 is selected in Android Studio → Settings → Build → Gradle → Gradle JDK

**White screen on device:**
- Run `npm run build:android:user` or `npm run build:android:dp` before opening in Android Studio
- Confirm you opened the matching folder (`android-customer` vs `android-dp`)
