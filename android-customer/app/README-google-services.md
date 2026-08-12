# Firebase — Customer (`com.pingget.customer`)

Place the Android `google-services.json` downloaded from Firebase Console here:

```
android-customer/app/google-services.json
```

1. Firebase Console → project **pingget-fe189** (or your PingGet project)
2. Add Android app with package name **`com.pingget.customer`** (or download existing)
3. Download `google-services.json` and put it in this folder (`app/`)
4. Do **not** reuse the old `com.pingget.app` file — package name must match exactly or FCM will fail

Until this file exists, the Google Services Gradle plugin is skipped and push notifications will not work.
