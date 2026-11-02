# Store Release Checklist

Status: **NOT READY**. This checklist records repository evidence only; it does not certify store acceptance.

## Apple App Store

- [ ] Signed production archive uploaded from an Xcode/EAS build.
- [ ] Student and Teacher reviewer accounts provisioned and instructions supplied securely.
- [ ] In-app account deletion request backed by a verified backend deletion workflow (`BACKEND API REQUIRED`).
- [ ] Public privacy-policy URL configured in app and App Store Connect.
- [ ] Terms and support links configured with owner-approved HTTPS URLs.
- [ ] Camera, photo-library, and microphone purpose strings reviewed against actual use.
- [ ] Generated `PrivacyInfo.xcprivacy` and third-party SDK privacy declarations reviewed from the production archive.
- [ ] Chat report/block, admin moderation, and support path implemented (`BACKEND API REQUIRED`).
- [ ] Store payment rules reviewed for website payment directions and digital course/video access (`STORE PAYMENT REVIEW REQUIRED`).
- [ ] Push permission is requested only after explicit user action; APNs/EAS credentials configured and tested on a physical device.
- [ ] Notification taps and incoming-call handling tested when foregrounded, backgrounded, and terminated.
- [ ] Accessibility, safe areas, keyboard, small-screen layout, and crash tests completed on supported iPhone/iPad devices.
- [ ] No release build enables QA fixtures, preview accounts, or debug-only entry points.

## Google Play

- [ ] Signed production Android App Bundle (`.aab`) built and uploaded.
- [ ] Generated target SDK verified as Android 16 / API 36 or higher for submissions from August 31, 2026.
- [ ] ABI output includes supported 64-bit native libraries.
- [ ] All native libraries validated on a 16 KB page-size Android device/emulator.
- [ ] Student and Teacher reviewer accounts and setup instructions supplied securely.
- [ ] In-app account deletion request and public web deletion resource configured (`BACKEND API REQUIRED`).
- [ ] Privacy policy and Data safety declarations completed from actual collection/sharing behavior.
- [ ] Camera/photo/microphone/notification permissions and prominent disclosures reviewed.
- [ ] Chat report/block, moderation, and support paths implemented (`BACKEND API REQUIRED`).
- [ ] Store billing policy reviewed for course/video access and external website payment instructions (`STORE PAYMENT REVIEW REQUIRED`).
- [ ] FCM/EAS credentials and push behavior tested on a physical device.
- [ ] Accessibility, safe areas, keyboard, small-screen layout, and crash tests completed on supported Android devices.
- [ ] No release build enables QA fixtures, preview accounts, or debug-only entry points.

## Shared technical gates

- [ ] Resolve the `xlsx` high-severity dependency advisories; current parser caps files at 5 MB/1,000 worksheet rows but that does not remove the vulnerable library.
- [ ] Resolve or formally assess Expo/Metro transitive moderate advisories.
- [ ] Review `react-native-webrtc` New Architecture compatibility and validate native call builds.
- [ ] Complete API offline/timeout/error-state checks across all API-backed screens.
- [ ] Verify push unread badge behavior against backend unread counts; app-icon badge is currently disabled.
- [ ] Configure EAS project ID and public API base URL in the EAS build environment. Keep provider credentials in EAS, not source control.
- [ ] Configure the canonical HTTPS privacy, terms, and support URLs in the EAS build environment.
- [ ] Run `MOBILE_RELEASE_TEST_MATRIX.md` and record device, OS, build, and result for every row.

## Current observed build status

| Target | Status | Evidence |
|---|---|---|
| Android | NOT TESTED | No generated Android native project or signed AAB; EAS account/project and FCM credentials are not configured. |
| iOS | NOT TESTED | No generated iOS native project or signed archive; EAS account/project and APNs credentials are not configured. |
| TypeScript | PASS | `npm run typecheck` passed after the current code changes. |
| Expo Doctor | PARTIAL | Required peer and SDK patch mismatches were fixed; Expo Doctor still flags `react-native-webrtc` as untested on the New Architecture. |
| Production dependency audit | FAIL | High-severity `xlsx` advisories remain; transitive moderate advisories remain. |
