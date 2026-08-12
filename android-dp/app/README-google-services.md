# Firebase — Delivery Partner (`com.pingget.dp`)

Place the Android `google-services.json` downloaded from Firebase Console here:

```
android-dp/app/google-services.json
```

1. Firebase Console → project **pingget-fe189** (or your PingGet project)
2. Add Android app with package name **`com.pingget.dp`** (or download existing)
3. Download `google-services.json` and put it in this folder (`app/`)
4. Each app needs its **own** Firebase Android app entry — do not copy the customer JSON and change only `package_name`

Until this file exists, the Google Services Gradle plugin is skipped and push notifications will not work.
