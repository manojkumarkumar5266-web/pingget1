# PingGET — Mobile App Build Guide (Capacitor)

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

## Step 3 — Build the web app

```bash
npm run build
```

This produces the `dist/` folder that Capacitor packages into native apps.

---

## Step 4 — Add native platforms (first time only)

```bash
# Android
npm run cap:add:android

# iOS (macOS only)
npm run cap:add:ios
```

---

## Step 5 — Apply Android API 35 configuration

After `cap add android` generates the `android/` folder, apply these changes:

### `android/variables.gradle` — update SDK versions

```groovy
ext {
    minSdkVersion = 23
    compileSdkVersion = 35
    targetSdkVersion = 35
    androidxActivityVersion = '1.9.3'
    androidxAppCompatVersion = '1.7.0'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.15.0'
    androidxFragmentVersion = '1.8.5'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.2.1'
    androidxEspressoCoreVersion = '1.5.0'
    cordovaAndroidVersion = '10.0.0'
}
```

### `android/build.gradle` — update Android Gradle Plugin

Find the `dependencies` block in the **project-level** `build.gradle` and set:

```groovy
classpath 'com.android.tools.build:gradle:8.7.3'
```

### `android/gradle/wrapper/gradle-wrapper.properties` — update Gradle wrapper

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.9-all.zip
```

### `android/app/build.gradle` — confirm SDK values are read from variables

The app-level `build.gradle` should already reference the variables. Verify it contains:

```groovy
compileSdkVersion rootProject.ext.compileSdkVersion
defaultConfig {
    ...
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    ...
}
```

---

## Step 6 — Sync web assets to native projects

Run this every time you change the web app:

```bash
npm run cap:sync
```

---

## Build for Android

```bash
# Build web + sync in one command
npm run build:android

# Open in Android Studio
npm run cap:open:android
```

**In Android Studio:**
1. Wait for Gradle sync to finish (can take a few minutes first time)
2. Make sure **Build > Select Build Variant** is set to `release`

---

## Generate Signed Android App Bundle (.aab) for Google Play

### Create a keystore (first time only)

Run this in your terminal and **keep the keystore file and passwords safe**:

```bash
keytool -genkey -v \
  -keystore pingget-release.keystore \
  -alias pingget \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You will be prompted for a keystore password, key password, and certificate details.

### Option A — Sign via Android Studio (recommended)

1. **Build → Generate Signed Bundle / APK**
2. Select **Android App Bundle (.aab)**
3. Point to your `pingget-release.keystore` file
4. Enter the keystore password, key alias (`pingget`), and key password
5. Select `release` build variant
6. Click **Finish** — the `.aab` will be in `android/app/release/`

### Option B — Sign via command line (CI/CD)

Add signing config to `android/app/build.gradle`:

```groovy
android {
    signingConfigs {
        release {
            storeFile file("../../pingget-release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "pingget"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

Then build:

```bash
cd android
KEYSTORE_PASSWORD=your_ks_pass KEY_PASSWORD=your_key_pass ./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Build for iOS

```bash
# Build web + sync in one command
npm run build:ios

# Open in Xcode
npm run cap:open:ios
```

**In Xcode:**
1. Select your Apple Developer Team under **Signing & Capabilities**
2. Set Bundle Identifier to `com.pingget.app`
3. **Product > Archive**
4. In the Organizer window: **Distribute App > App Store Connect**
5. Follow the upload wizard

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

---

## Environment variables

The app reads Supabase credentials from `.env` at build time:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

These are already populated. Do not commit `.env` to source control.

---

## Google Play Store checklist

- [ ] App signed with release keystore (keep keystore file and passwords safe)
- [ ] Android App Bundle (.aab) generated
- [ ] `compileSdkVersion` = 35 (set in `android/variables.gradle`)
- [ ] `targetSdkVersion` = 35 (set in `android/variables.gradle`)
- [ ] App icon 512×512 PNG uploaded in Play Console
- [ ] Screenshots: phone (at least 2), 7-inch tablet, 10-inch tablet
- [ ] Short description (80 chars) and full description
- [ ] Privacy policy URL
- [ ] Content rating questionnaire completed
- [ ] MSG91 credentials set in Supabase Edge Function secrets

## Apple App Store checklist

- [ ] Apple Developer account active ($99/year)
- [ ] Provisioning profile and signing certificate set up
- [ ] Bundle ID `com.pingget.app` registered in Apple Developer portal
- [ ] App archived and uploaded via Xcode Organizer
- [ ] Screenshots for iPhone 6.5", iPhone 5.5", iPad Pro 12.9" (if supporting iPad)
- [ ] App Review Information filled (demo account if needed)
- [ ] Privacy policy URL
- [ ] Export compliance information (No encryption beyond HTTPS)
- [ ] MSG91 credentials set in Supabase Edge Function secrets

---

## Troubleshooting

**OTP not received:**
- Confirm `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` are set in Supabase Edge Function secrets
- Check the template is approved in MSG91 dashboard
- Check Edge Function logs: Supabase Dashboard → Edge Functions → send-phone-otp → Logs

**Gradle sync fails:**
- Make sure Java JDK 17 is selected in Android Studio → Settings → Build → Gradle → Gradle JDK
- Confirm `gradle-wrapper.properties` points to Gradle 8.9

**`compileSdkVersion 35` not found:**
- Make sure Android SDK Platform 35 is installed: Android Studio → SDK Manager → Android 15.0 (VanillaIceCream)

**iOS build signing error:**
- Ensure your Apple Developer account is added in Xcode → Settings → Accounts

**White screen on device:**
- Run `npm run build` then `npm run cap:sync` before opening in IDE
