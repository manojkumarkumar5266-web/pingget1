# Legacy Firebase config (do not use)

This file was for package **`com.pingget.app`** (single combined Android project).

PingGet now uses two Android apps:

| App | Folder | Package |
|-----|--------|---------|
| Customer | `android-customer/` | `com.pingget.customer` |
| Delivery Partner | `android-dp/` | `com.pingget.dp` |

Download a fresh `google-services.json` for each package from Firebase Console and place it at:

- `android-customer/app/google-services.json`
- `android-dp/app/google-services.json`

Do not rename `package_name` in this legacy file — FCM app IDs will not match.
