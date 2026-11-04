# Store Review Guide

This guide intentionally contains no passwords, personal data, or invented policy URLs.

## Sign-in

- The app supports two roles: **Student** and **Teacher**.
- Reviewers need separate, active accounts provisioned in the designated review/staging environment.
- Sign in with the phone number and password issued to the reviewer by the app owner.
- Admin is not a supported mobile review role.
- **Review accounts: CONFIGURATION REQUIRED.** Never add production credentials to this repository or app bundle.

## Student review

After signing in, review the schedule, learning/lessons, assignments, materials, notifications, chat, and profile using data seeded for the dedicated review account.

## Teacher review

After signing in, review the teacher dashboard, schedule, assigned students, notifications, chat, and profile using data assigned to the dedicated review account.

## Permission-dependent features

- Photo selection is requested only when the reviewer chooses an image/file action.
- Camera permission is requested only when the reviewer starts camera capture in chat.
- Microphone permission is used for audio calls.
- Notification permission should be requested only after the reviewer selects **Bật thông báo trên thiết bị** in the profile.
- Reviewers may decline any optional permission; core sign-in and non-permission-dependent screens should remain usable.

## Chat and notifications

- Message, image, file, and call testing requires a second review account in the opposite role.
- Reporting and blocking are not ready until backend moderation APIs are available (`BACKEND API REQUIRED`).
- Push testing requires an installed EAS native build, a configured EAS project, FCM credentials for Android, and APNs credentials for iOS.
- Standard push alerts do not provide continuous native VoIP ringing.

## Account and support

- In-app account deletion is not available until the backend deletion workflow is implemented (`BACKEND API REQUIRED`).
- Privacy policy, terms, and support URLs require owner-approved canonical HTTPS addresses (`CONFIGURATION REQUIRED`).
- Do not submit to review until these blockers are resolved or the relevant platform confirms an applicable exception.
