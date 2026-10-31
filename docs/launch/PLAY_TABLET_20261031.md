# Google Play tablet screenshots

Requested: 7-inch and 10-inch tablet assets, Korean / Japanese / Traditional Chinese.

Capture target: isolated Android emulator `emoti_promo_x86`, serial `emulator-5554`.
Native app is rendered at 1080×1920 / 1440×2560, density 280 dpi, both tablet-width viewports and 9:16.
Sample project contains eight real transparent Corn illustrations from `assets/mascot`.
The previous emulator store is backed up under `verification/release-handoff-20261030/tablet-before`.

Delivery must contain RGB PNGs under 8 MB each, grouped by locale and tablet size.
Do not use iPhone screenshots as Android tablet captures. No store upload or publication is part of this capture task.

Capture APK rebuilt successfully (4m 55s), versionCode 25, internalReview=true, bundled JS 4,690,364 bytes.
APK SHA-256: `5b8c4f537829b39067237ec6cf42709ca1953ab0893575574dbe5b8db590da07`.
This APK is capture-only; the archived production AAB is untouched.

Existing vc25 AAB remains unchanged. Its archived manifest includes `com.google.android.gms.permission.AD_ID`.
Owner's Play Console error refers to an active artifact; the exact offending artifact has not been identified.

## Completed

All 30 screenshots were captured and reviewed: five screens × three languages × two tablet categories.
Screens: home, project board, drawing tools, lessons, export.
Seven-inch categories use a 617 dp-wide native viewport; ten-inch categories use 823 dp.
Actual emulator captures are under `verification/play-tablet-20261031`, including APK provenance.
Store-ready RGB copies, language ZIPs, preview and upload instructions: `dist/google-play-tablets-20261031`.
No changes to `App.tsx`, `src`, lesson assets, canvas design, or the archived production vc25 AAB.
