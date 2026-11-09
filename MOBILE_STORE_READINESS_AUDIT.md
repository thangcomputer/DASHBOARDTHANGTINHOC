# Mobile Store Readiness Audit

## Scope and method

Initial static audit of `thang-tin-hoc-mobile` and the existing Express routes/services used by the app. It covered the app manifests and dependencies, auth/session and API transport, profile/settings, chat/UGC, payment-related screens, notifications, permissions, environment/configuration, and the available native/release files. Expo Doctor, the mobile type check, and the production dependency audit were run. This is a code/configuration review, not a substitute for installed-device, Xcode, Play Console, or App Store Connect testing.

## Initial findings (recorded before remediation)

| ID | Area | Finding | Severity | Apple impact | Google impact | Evidence | Proposed safe action |
|---|---|---|---|---|---|---|---|
| A01 | Account deletion | No user-initiated self-service deletion flow or self-service API was found. Existing student/teacher delete routes are administrative and permission-gated. | CRITICAL | Store review blocker under account deletion requirement. | Store review blocker; Play also requires a web deletion resource for account-creating apps. | `src/screens/FeatureScreens.tsx`; `routes/studentRoutes.js`; `routes/teacherRoutes.js`; `routes/authRoutes.js` | Do not call admin routes from the app. Document `BACKEND API REQUIRED: DELETE ACCOUNT`; obtain product/data-retention approval and define the authenticated, re-authenticated deletion contract first. |
| A02 | Chat UGC safety | Mobile chat has messaging and attachment flows, but no report-message/user or block/unblock UI/API was found. | HIGH | User-generated-content review blocker until report/block and moderation paths exist. | User-generated-content policy risk; moderation and reporting need verification. | `src/screens/MessageScreens.tsx`; `src/services/messageApi.ts`; `routes/messageRoutes.js` | Document `BACKEND API REQUIRED` for reporting and blocking; do not simulate moderation in local storage. |
| A03 | Privacy, terms, support | No configured privacy-policy, terms, or support URLs or corresponding profile actions were found. No official URL can be inferred safely. | HIGH | Listing/review readiness blocker. | Privacy policy and data-safety listing readiness blocker. | `src/screens/FeatureScreens.tsx`; `app.config.js`; `.env.example` | Add URL configuration and only render links after the owner supplies verified canonical URLs. Mark `CONFIGURATION REQUIRED`. |
| A04 | Notification permission | The authenticated context invokes push registration immediately after login; registration requests OS notification permission without an explicit user action. | HIGH | Poor permission UX and consent timing; may harm review. | Permission disclosure/consent UX risk. | `src/app/AuthContext.tsx`; `src/services/mobilePushNotifications.ts` | Defer the OS prompt to an explicit “Bật thông báo” action. Keep token synchronization silent when permission is already granted. |
| A05 | Push release configuration | EAS project ID and FCM/APNs credentials are not configured; Expo CLI was unauthenticated during setup. Push has not been tested on physical release builds. | HIGH | Push capability unverified. | Push capability unverified. | `app.config.js`; `eas.json`; `.env.example`; `src/services/mobilePushNotifications.ts` | Keep secrets outside Git; configure the user-owned EAS project and provider credentials, then test foreground/background/terminated states on both platforms. |
| A06 | Payments / course access | Mobile displays tuition status but directs payment to the website; video course registration also directs users to register/pay on the web. Digital course/video access is present, but the exact product and market classification is not established by code alone. | HIGH | `STORE PAYMENT REVIEW REQUIRED`; external purchase direction may violate digital-content billing rules. | `STORE PAYMENT REVIEW REQUIRED`; external payment direction for in-app digital content may violate Play billing policy. | `src/screens/ParityScreens.tsx` (`TuitionScreen`); `src/screens/CourseVideosScreen.tsx` | Keep payment behavior unchanged pending a business decision. Classify live 1:1 instruction versus digital video/course/material access and choose store-compliant purchase flows before submission. |
| A07 | Dependencies | Production dependency audit reports 16 vulnerabilities. `xlsx@0.18.5` has two high-severity advisories and no upstream fix; `node-forge` and transitive Expo tool dependencies also have high-severity advisories. | HIGH | Release dependency review blocker until exposure is assessed and mitigated. | Release dependency review blocker until exposure is assessed and mitigated. | `package.json`; `package-lock.json`; `src/services/teacherQuizExcel.ts`; `npm audit --omit=dev` | Trace each vulnerable package to mobile runtime/build use. Replace or isolate the unmaintained spreadsheet parser only after checking feature/API compatibility; do not run `npm audit fix --force`. |
| A08 | Expo dependency health | Expo Doctor found missing `expo-asset` peer dependency and patch-level mismatches for Expo, React Native, and React Native Screens. | MEDIUM | Build stability risk. | Build stability risk. | `package.json`; `package-lock.json`; Expo Doctor output | Align only to SDK-supported patch versions and install the required peer package, then rerun Expo Doctor and type checks. |
| A09 | API resilience | Shared API client has no request timeout/abort policy and maps server-provided `message` directly into `MobileApiError`; screen-level error state coverage is not yet demonstrated for every API screen. | MEDIUM | Unresponsive/technical-error UX risk. | Unresponsive/technical-error UX risk. | `src/services/apiClient.ts`; `src/hooks/useMockResource.ts`; API-backed screens | Add bounded network timeouts and user-safe transport/status messages without changing response contracts; inventory individual screens before making broad UI changes. |
| A10 | Production data integrity | `ProfileScreen` synthesizes a primary enrollment from the auth profile when the profile API has no enrollments, including a fabricated ID/status/progress. This can make missing API data look real. | MEDIUM | Inaccurate user data. | Inaccurate user data. | `src/screens/FeatureScreens.tsx` (`ProfileScreen`) | Remove the synthetic production fallback; rely on the API response and existing empty state. Preserve explicit development QA fixtures. |
| A11 | App Store release config | `app.json` has no explicit iOS build number or Android version code; `eas.json` has preview and production profiles only, and preview produces an APK. Production profile lacks explicit auto-increment behavior. | MEDIUM | Release/versioning configuration incomplete. | Store bundle/versioning configuration incomplete. | `app.json`; `eas.json` | Configure release versioning and an AAB-producing production profile; preserve current bundle/package identifiers and version lineage. |
| A12 | Android target API | App config does not declare or verify the generated target SDK. Google Play states that from August 31, 2026, new apps and updates generally must target Android 16 / API 36. Generated native output and final AAB have not been inspected. | HIGH | N/A | Store review blocker if generated target is below the Play requirement. | `app.json`; Expo SDK/build configuration | Verify generated Android Gradle config/AAB target against the current Play deadline; configure through the supported Expo toolchain if needed. |
| A13 | Native compliance | No checked-in `android/`, `ios/`, or `PrivacyInfo.xcprivacy` was found. `react-native-webrtc` is reported by Expo Doctor as untested on the New Architecture. No native binary or 16 KB page-size validation was run. | HIGH | Privacy manifest and native release build unverified. | 16 KB/native compatibility unverified. | Mobile project file inventory; `package.json`; Expo Doctor output | Generate native prebuild in a disposable validation workspace and inspect the resulting privacy manifest, permissions, entitlements, ABI, and 16 KB compatibility. Do not claim compliance without a real build/test. |
| A14 | Mock and preview data | QA fixtures are gated by development configuration in service code; production route-by-route exclusion and preview-account access still need an end-to-end build audit. Teacher finance also shows a synthetic estimated commission row clearly labeled “Tạm tính”. | MEDIUM | Risk of misleading production data if a QA/preview path is reachable. | Risk of misleading production data if a QA/preview path is reachable. | `src/services/mockService.ts`; `src/screens/TeacherFinanceScreen.tsx`; `src/mocks/data.ts` | Trace production entry points and verify mock mode cannot be enabled in release builds. Confirm estimated finance calculation semantics with the product owner. |
| A15 | Accessibility and device UX | Static review shows some accessibility labels but does not establish coverage for all icon controls, touch targets, safe areas, or keyboard behavior. No device matrix was run. | MEDIUM | Accessibility and usability review risk. | Accessibility and usability review risk. | `src/screens/MessageScreens.tsx`; `src/screens/FeatureScreens.tsx`; `src/navigation/RootNavigator.tsx` | Run the release test matrix on small/large iOS and Android devices, then fix measured issues and add labels to high-impact controls. |
| A16 | Store review accounts | No reviewer instructions or controlled Student/Teacher review account process was found. No credentials were supplied. | HIGH | Reviewer may be unable to inspect authenticated functionality. | Reviewer may be unable to inspect authenticated functionality. | Mobile project documentation inventory | Create a review guide without secrets and provision non-production or dedicated review accounts in the appropriate backend. |

## Confirmed strengths

- Native session data is persisted through Expo SecureStore; browser storage is used only for the web platform.
- Access, refresh, and session ID are kept together; refresh requests use a single in-flight promise, and a retried request is not refreshed indefinitely.
- Socket.IO authenticates with the access token; the auth provider disconnects it when the user session is removed.
- Camera/photo selection permission requests are initiated by the corresponding user action rather than at app launch.
- Chat, schedule, profile, and notification services have API-backed paths; mock fixtures are selected through development QA flags or explicit preview modes rather than as the normal API fallback.
- Existing iOS and Android package identifiers are configured, and the project includes brand icon/adaptive-icon assets.

## Official policy references checked

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple account deletion guideline 5.1.1(v)](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion)
- [Google Play target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Android 16 KB page-size guidance](https://developer.android.com/guide/practices/page-sizes)

## Audit status

The findings above preserve the pre-remediation snapshot. Current remediation and validation status:

| Finding | Current status |
|---|---|
| A01 Account deletion | BLOCKED - backend deletion API and retention policy decision required. |
| A02 Chat UGC safety | BLOCKED - backend report/block/moderation API required. |
| A03 Privacy, terms, support | PARTIAL - settings only show owner-supplied valid HTTPS URLs; canonical URLs still need configuration. |
| A04 Notification permission | FIXED IN APP - registration no longer prompts automatically; explicit settings action requests permission. Physical-device behavior not tested. |
| A05 Push release configuration | BLOCKED - EAS project and APNs/FCM credentials are not configured. |
| A06 Payments / course access | BLOCKED - product classification and platform billing review required; existing behavior intentionally unchanged. |
| A07 Dependencies | OPEN - current `npm audit --omit=dev`: 14 vulnerabilities (13 moderate, 1 high); `xlsx` high advisories have no upstream fix. |
| A08 Expo dependency health | PARTIAL - required SDK packages/patch versions and `expo-asset` were aligned; Expo Doctor is 19/20 because `react-native-webrtc` is untested on New Architecture. |
| A09 API resilience | PARTIAL - shared client now bounds requests to 20 seconds and maps errors to safe user-facing messages; every screen's offline/error state is not fully validated. |
| A10 Production data integrity | FIXED IN APP - removed the synthetic primary enrollment fallback; automated regression test passes. |
| A11 App Store release config | PARTIAL - EAS production uses remote auto-increment and Android App Bundle; native version output still needs build verification. |
| A12 Android target API | BLOCKED - no generated Gradle project or AAB inspected; target API 36 not verified. |
| A13 Native compliance | BLOCKED - no signed native artifacts, privacy-manifest archive review, or 16 KB page-size test. |
| A14 Mock and preview data | OPEN - no release-build end-to-end exclusion audit completed; teacher finance estimate still needs product-owner validation. |
| A15 Accessibility and device UX | OPEN - device-level matrix remains unrun. |
| A16 Store review accounts | PARTIAL - non-secret reviewer guide drafted; dedicated accounts still need to be provisioned. |

Validation completed: mobile TypeScript check, targeted regression suite (21/21), Android JavaScript export, and backend JavaScript syntax checks. The Android export is not a native build. No native signed build or device test was run, so this is not store-readiness certification.

No readiness percentage or “ready” claim should be treated as certification.
