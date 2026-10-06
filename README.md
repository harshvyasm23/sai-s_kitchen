# Sai's Kitchen – Tiffin & Invoice Tracker

Two fully native apps, no Expo, no Rork, no server, no accounts. All data stays on the phone.

| Platform | Folder | Language / UI | Open with |
|----------|--------|---------------|-----------|
| iPhone   | `ios/`     | Swift + SwiftUI          | Xcode (on a Mac) |
| Android  | `android/` | Kotlin + Jetpack Compose | Android Studio   |

Both apps have the same screens: Dashboard, Customers, New Entry (tiffin / catering), Reports, Invoices (PDF + share,
outstanding report) and Settings (theme, defaults, test data, clear data).

## Android
1. Install Android Studio. File > Open > select the `android` folder. Wait for Gradle sync.
2. Run on an emulator or a phone (USB debugging). Build > Build APK(s) to get an installable `.apk`
   (`android/app/build/outputs/apk/debug/app-debug.apk`) you can send to any Android phone.

## iPhone
1. On a Mac with Xcode: open `ios/SaiSKitchen.xcodeproj`, choose your iPhone/simulator, press Run.
2. Free Apple ID is enough to run on your own phone (re-sign every 7 days). TestFlight / App Store needs
   an Apple Developer account (~99 USD/year).

## Notes
- Data is stored on each device separately (no cloud sync). Android and iPhone do not share data.
- Invoice bank details are in `android/.../InvoicePdf.kt` (`PaymentDetails`) and `ios/.../InvoicePDFGenerator.swift`.
