# Sai's Kitchen Tiffin & Invoice Tracker – Android + iPhone

- `expo/`  One React Native (Expo) codebase -> Android and iOS apps.
- `ios/`   Your original native Swift version (unchanged, optional).

## One-time setup (on your PC; Node.js required)
    npm i -g eas-cli
    cd expo
    npm install --legacy-peer-deps
    eas login                      # free Expo account
    eas init                       # links project
    eas update:configure           # writes the update URL into app.json

## Build the apps
Android APK (install directly on any Android phone, no Google account/fee):
    eas build -p android --profile preview
iPhone (needs Apple Developer account, ~99 USD/yr; install via TestFlight/App Store):
    eas build -p ios --profile production
    eas submit -p ios

## Push changes -> they appear in the apps
Edit code, then:
    eas update --channel preview --message "what changed"        # Android APK build above
    eas update --channel production --message "what changed"     # store builds
Phones download the update next time the app opens (no reinstall). Native changes (new packages/permissions)
need a new `eas build`. GitHub: push the same code to your repo; you can add the EAS GitHub Action to run `eas update` on every push.

## Notes
- Data is stored on each phone. Cloud sync points at a Rork backend (EXPO_PUBLIC_RORK_API_BASE_URL) that is not included,
  so Android and iPhone won't share data until a real backend is set up.
