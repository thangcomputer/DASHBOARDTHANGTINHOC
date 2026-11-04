# Mobile push notifications

The app uses Expo Push Service for alert notifications. Device tokens are tied to the authenticated mobile session and removed on logout. Push payloads avoid including private message text or financial details.

## Link the EAS project

1. From this folder, run `npx eas-cli@latest init` and create or select the EAS project.
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` to the project ID in the local `.env` and in the EAS build environment. The ID is public configuration; do not put credentials in the repository.
3. Set `EXPO_PUBLIC_MOBILE_API_BASE_URL` in the EAS build environment to the backend URL reachable by installed devices.

## Configure provider credentials

- **Android:** In Firebase, enable Firebase Cloud Messaging HTTP v1 and create a service-account credential. Upload it to the EAS project with `npx eas-cli@latest credentials` (Android → Google Service Account). Do not commit the JSON key.
- **iOS:** Create an APNs authentication key in the Apple Developer account, then add its `.p8` file, Key ID, and Team ID to the EAS project with `npx eas-cli@latest credentials` (iOS → Push Notifications). Do not commit the key.

## Build and test

After credentials are configured, run `npx eas-cli@latest build --platform all --profile preview` from this folder and install the generated native build. Expo Go does not provide the native call and push behavior used by this app.

Standard push alerts can play the system notification sound while the app is backgrounded or closed. A tapped incoming-call alert opens the in-app call prompt while the server's 45-second call invitation remains active. Continuous lock-screen ringing, Android full-screen call UI, and iOS CallKit/PushKit VoIP behavior require separate native call integration and are not provided by standard Expo push.
