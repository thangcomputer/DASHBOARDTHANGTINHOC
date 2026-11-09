# Mobile Payment Compliance Audit

Status: **STORE PAYMENT REVIEW REQUIRED**. This is a technical inventory, not legal advice or a store-policy exception.

| Mobile surface | Observed behavior | Product category evidence | Store risk |
|---|---|---|---|
| `src/screens/ParityScreens.tsx` - `TuitionScreen` | Shows API-backed tuition/payment status and tells the user to complete payment or confirmation on the website. It does not show a QR or invoke a payment SDK in this screen. | Backend account/course tuition may relate to live teacher-led lessons, but could also gate digital course/video/material access. The UI/API evidence alone does not classify the specific purchase. | External payment direction from a store app needs policy review; potential blocker if payment unlocks digital content. |
| `src/screens/CourseVideosScreen.tsx` | Registration action says to register and pay on the web app. Mobile exposes video/training content access and reads purchase state through existing APIs. | Video course, lesson, or premium digital access is digital content; direct live one-to-one teaching may be a different service category. Current business mapping is not explicit. | High risk under Apple/Google digital-content billing rules; remove or redesign the external payment direction only after deciding the product/billing model and market rules. |
| `src/screens/TeacherFinanceScreen.tsx` | Displays teacher finance/commission data; no purchase flow observed in the screen. A derived pending amount is labeled “Tạm tính”. | Teacher compensation/finance view, not a student purchase surface. | Validate that the estimate matches finance business semantics; not itself an in-app purchase. |

## Required business decisions

1. List each student-facing paid product available from mobile: live 1:1 instruction, group/live lessons, recorded videos, digital lessons, downloadable materials, subscriptions, and any mixed bundles.
2. Identify whether the payment purchases access to a service consumed outside the app or unlocks digital functionality/content consumed in the app.
3. Identify the supported countries/regions and whether any applicable Apple/Google alternative-billing program is intentionally used.
4. Decide the platform-specific purchase flow before store submission. Do not silently route digital purchases to the website and do not add IAP/Play Billing without an approved product design.

## Recommendation

Keep the current payment behavior unchanged during this audit. Treat the web-payment instructions as a release blocker until the owner classifies the products and obtains platform-policy review. If the flow is approved for external payment, document the applicable policy basis and market restrictions; otherwise design native store billing or remove the purchase CTA while preserving account access to eligible previously purchased content.
