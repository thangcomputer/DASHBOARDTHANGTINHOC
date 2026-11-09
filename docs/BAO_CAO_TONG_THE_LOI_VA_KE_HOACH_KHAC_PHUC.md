# Báo cáo tổng thể lỗi và kế hoạch khắc phục - DASHBOARDTHANGTINHOC

**Ngày lập:** 04/11/2026  
**Repository:** `thangcomputer/DASHBOARDTHANGTINHOC`  
**Cơ sở tổng hợp:** `FULL_WEBSITE_AUDIT_REPORT.md` (báo cáo audit ghi ngày 30/08/2026 và các cập nhật sau đó), `docs/AUDIT_LMS_THANG_TIN_HOC.md` (13/09/2026), `docs/QA_ENTERPRISE_E2E_REPORT.md` (29/07/2026), cùng danh sách pull request đang mở được kiểm tra khi lập báo cáo.

> **Lưu ý về độ mới:** Các phát hiện bên dưới được tổng hợp từ tài liệu có ngày audit trước ngày lập báo cáo. Chúng là danh sách việc cần xác minh và xử lý, không khẳng định mọi lỗi vẫn còn trên nhánh hiện tại. Trước khi sửa, chạy lại kiểm tra trên commit mới nhất và cập nhật trạng thái từng finding.

## 1. Tóm tắt điều hành

Tài liệu audit hiện có ghi nhận rủi ro đáng kể ở phân quyền/ownership, tính toàn vẹn nghiệp vụ (lịch, quiz, thanh toán), cách ly test và độ tin cậy CI. Một số lỗi liên quan kỳ thi đã được báo cáo là **đã sửa ở source nhưng còn chờ kiểm thử QA**; không nên coi là đóng cho tới khi có kết quả route/E2E trên môi trường test tách biệt.

**Khuyến nghị:** chưa lấy các tài liệu audit cũ làm căn cứ duy nhất để kết luận production-ready. Ưu tiên trước tiên là dựng môi trường test an toàn, xác minh lại finding trên HEAD, sau đó xử lý authorization/data-integrity và đóng các khoảng trống QA quan trọng. Không chạy full test nếu chưa xác nhận test runner dùng database disposable.

### Các ưu tiên cao nhất

1. Xác minh và xử lý phân quyền/ownership ở học viên, lịch, chi nhánh, đánh giá và file riêng tư.
2. Siết state machine cho buổi đã hoàn thành và quiz: trạng thái, hạn nộp, thời gian làm phải được kiểm tra phía server.
3. Bảo đảm test/CI không kết nối hoặc ghi vào database thật; loại bỏ false-green.
4. Hoàn tất QA route/E2E cho các bản sửa thi đã có; bổ sung E2E refund và đổi giáo viên.
5. Xử lý provisioning mật khẩu và rà soát dependency production có advisory.

## 2. Phạm vi và giới hạn

Báo cáo này tổng hợp những phát hiện đã có trong repository; không thực hiện kiểm thử xâm nhập, không truy cập production, không đọc secret và không thay đổi database. Một số kết quả là static/source review, một số là smoke/unit test, một số là hạng mục **chưa chạy**. Các mục “chưa chạy” là khoảng trống bằng chứng, không mặc định là lỗi đã tái hiện.

Các báo cáo gốc cũng ghi nhận chênh lệch số liệu test/lint theo từng thời điểm. Vì vậy, hãy chạy lại lệnh kiểm tra trên commit hiện tại và lưu log/artifact để có baseline đáng tin.

## 3. Danh sách phát hiện theo mức độ ưu tiên

| Ưu tiên | ID | Nhóm | Trạng thái theo tài liệu audit | Hướng xử lý |
|---|---|---|---|---|
| P0 | TEST-001/002, CI-001 | Test, database isolation, CI | Đã xác nhận ở lần audit; cần kiểm tra lại hiện trạng | Dựng DB disposable; chuẩn hóa runner; fail nếu không có test hoặc test lỗi; kiểm tra cleanup |
| P0 | SEC-007, SEC-009 | Ownership học viên, phân quyền/chi nhánh lịch | Được ghi nhận là chưa sửa | Kiểm tra quyền theo người phụ trách/enrollment; branch scope fail-closed cho mọi write |
| P0 | SEC-011 | Tải file riêng tư | Được ghi nhận là chưa sửa trong audit tổng thể; báo cáo LMS có bằng chứng test một số luồng certification riêng | Kiểm tra lại từng loại file/route; xác thực chủ sở hữu hoặc quyền thành viên trước khi trả file |
| P0 | SEC-008, SEC-017 | State machine lịch/quiz | Được ghi nhận là chưa sửa | Chặn mutation thường trên buổi hoàn tất; enforce trạng thái, deadline, start time và timeout ở server |
| P1 | SEC-010 | Đánh giá/rating | Được ghi nhận là chưa sửa | Chỉ đúng học viên được tạo đánh giá; thao tác đặc quyền tách riêng, có audit |
| P1 | SEC-012 | Provisioning mật khẩu | Được ghi nhận là chưa sửa | Mật khẩu ngẫu nhiên một lần, hết hạn, bắt đổi lần đầu; không suy ra từ thông tin liên hệ |
| P1 | SEC-016, DEP-001 | Dependency production | Audit ghi nhận advisory; cần audit lại lockfile hiện tại | Xác định package/đường sử dụng, nâng hoặc thay thế có regression test, ghi nhận risk acceptance nếu chưa có bản vá |
| P1 | SEC-001/002/003/006, SEC-018, FUN-002, CFG-001 | Bản sửa thi/submit/OAuth | Được báo cáo đã sửa một phần hoặc đã sửa ở source, còn chờ QA | Route matrix và E2E trên DB disposable; kiểm resume/retry/timeout/concurrency và quyền theo role |
| P1 | PAY-REF-01 | Hoàn tiền và đối soát | QA cũ ghi NOT RUN; audit tài chính nêu nguy cơ lệch Ledger/KPI | E2E hoàn một phần/toàn phần, retry/idempotency, hóa đơn và KPI cùng đối chiếu Ledger |
| P1 | REASSIGN-E2E-01 | Đổi giáo viên | QA cũ ghi NOT RUN | E2E đổi GV A→B; xác nhận lịch, tiến độ, bài tập và phần lương không bị mất/lệch |
| P2 | SEC-013/014/015 | Token, rate limit, upload | Audit tổng thể ghi nhận cần xử lý; xác minh lại sau thay đổi gần đây | Đánh giá lưu trữ token/media; quota không tin JWT chưa verify; kiểm tra loại/nội dung file theo policy |
| P2 | RBAC-001, FUN-001/003 | Frontend RBAC và đồng bộ session | Được ghi nhận trong audit tổng thể | Đồng bộ permission UI với backend; kiểm tra sync response và reset sạch session/token |
| P2 | CODE-001/002 | Lint và maintainability | Audit ghi nhận lint errors lớn và file/module cồng kềnh | Chạy lint mới; ưu tiên lỗi hành vi/hooks, sau đó refactor từng phần nhỏ với regression tests |
| P2 | PERF-001/002/003 | Bundle, phân trang, render | Audit source/build cũ ghi nhận | Đo lại bundle/API/UI; giới hạn phân trang và tối ưu chỉ dựa trên số liệu thực tế |
| P3 | A11Y-001, UI-001, SEO-001 | Accessibility, 404, SEO | Đã xác nhận source ở lần audit; cần kiểm tra lại | Bổ sung 404/main landmark/favicon; xác định rõ trang nội bộ và trang công khai cần index |

### Ghi chú cụ thể về bảo mật và nghiệp vụ

- **SEC-007:** audit ghi nhận teacher có thể cập nhật một số trường tiến độ/số buổi học viên mà thiếu ownership đầy đủ. Thiết kế mục tiêu: số buổi được suy ra từ attendance; mọi thao tác học viên phải ràng buộc giáo viên/enrollment và chi nhánh.
- **SEC-008:** buổi `completed` cần là trạng thái cuối đối với API cập nhật thông thường. Nếu có quy trình đảo trạng thái, cần quyền, lý do và audit/reversal nghiệp vụ.
- **SEC-009:** với write lịch, branch phải được lấy/kiểm tra từ dữ liệu đối tượng phía server; không tin branch gửi từ client.
- **SEC-010:** cần ràng buộc actor với học viên và loại đánh giá; tránh để role khác tạo thay người học.
- **SEC-011:** không coi việc có JWT là đủ cho file riêng tư. Mỗi download phải kiểm tra quyền đối với tài nguyên cụ thể; cần đánh giá riêng file public và private.
- **SEC-017:** quiz cần ghi nhận thời điểm bắt đầu đáng tin phía server, hạn nộp và trạng thái. Các lần nộp trễ/đã đóng phải bị từ chối nhất quán.
- **PAY-REF-01:** báo cáo QA cũ chưa chạy luồng refund đầy đủ; báo cáo tài chính chỉ ra nguy cơ Dashboard/report/API không đồng nhất với Ledger. Không chốt doanh thu là đúng cho tới khi đối soát một nguồn dữ liệu tài chính thống nhất.

## 4. Khoảng trống kiểm thử cần đóng

### Bắt buộc trước khi coi bản sửa bảo mật là hoàn tất

- Role matrix: Admin, Staff, Teacher, Student; thử truy cập đúng quyền, sai quyền và khác chi nhánh.
- Exam: cấp đề answer-free, start/submit/forfeit, forged data bị bỏ qua/từ chối, reload/retry, timeout, hai request đồng thời.
- File: chủ file/người không liên quan/thành viên được phép; token hết hạn/revoke; file hết hạn; metadata thiếu hoặc file vật lý không tồn tại.
- Schedule/attendance: ownership, branch scope, completed-state mutation và quy trình reversal.
- Quiz: trước giờ mở, đang mở, hết hạn, đóng thủ công, quá thời lượng, submit trùng.
- Finance: refund 0%, một phần, toàn phần, retry/webhook lặp, hủy và đăng ký lại; đối chiếu Ledger, Invoice, API và Dashboard.
- CI: chạy trong môi trường sạch với DB test disposable; xác minh test không nạp `.env` production/local và teardown không xóa dữ liệu ngoài fixture.

### Cần có bằng chứng trước production

- Frontend E2E cho các role chính và trạng thái loading/error/empty/401/403/404/409.
- Redis/session/readiness cho deployment nhiều instance nếu đó là cấu hình vận hành dự kiến.
- Socket reconnect/offline/duplicate event, thông báo và tải dưới concurrency theo ngưỡng đã thống nhất.
- Dependency audit mới, frontend/backend build, lint và full test trên đúng Node version CI.

## 5. Kế hoạch khắc phục đề xuất

### Giai đoạn 0 - Baseline an toàn

1. Chốt commit/branch được đánh giá và ghi lại phiên bản Node/npm, thời gian, cấu hình test.
2. Xác nhận `TEST_DATABASE_URI` là database disposable; không chạy test với `.env` chứa URI dữ liệu thật.
3. Chạy riêng unit tests không cần DB; xác nhận runner thoát khác 0 khi test fail hoặc không tìm thấy test.
4. Ghi lại kết quả lint, test, build và audit dependency theo từng package.

**Điều kiện hoàn tất:** có log tái lập được và không có kết nối/ghi dữ liệu ngoài môi trường test.

### Giai đoạn 1 - Authorization và tính toàn vẹn nghiệp vụ

1. Tạo regression tests cho SEC-007/009/010/011 trước khi thay đổi handler.
2. Bổ sung ownership/permission/branch checks ở backend; fail-closed khi không xác định được branch/owner.
3. Khóa state transition lịch và quiz; tách workflow reversal có quyền và audit nếu cần.
4. Sửa provisioning mật khẩu theo cơ chế one-time/expire/forced rotation.
5. Chạy lại test theo role/branch trên DB disposable.

**Điều kiện hoàn tất:** các ca trái quyền trả lỗi phù hợp, không thay đổi dữ liệu; các ca hợp lệ vẫn hoạt động; có audit cho thao tác nhạy cảm.

### Giai đoạn 2 - Đóng QA tài chính, thi và file

1. Kiểm thử route/E2E các sửa đổi SEC-001/002/003/006/018 và FUN-002.
2. Thêm E2E refund partial/full và đối chiếu sổ; kiểm idempotency khi retry.
3. Thêm E2E reassignment giáo viên và xác nhận lịch/tiến độ/liên quan tài chính.
4. Chạy file authorization matrix và kiểm tra upload validation trên từng loại file.

**Điều kiện hoàn tất:** report QA có kết quả pass/fail, môi trường/commit, dữ liệu fixture và log; không dùng smoke test đơn lẻ để kết luận pass toàn module.

### Giai đoạn 3 - CI, dependency và chất lượng

1. Chuẩn hóa test runner; chuyển test Jest-style sang runner được hỗ trợ hoặc khai báo đúng dependency/config.
2. Bổ sung frontend test job; sửa workflow gọi script không tồn tại; loại bỏ false-green.
3. Đánh giá advisory từ lockfile mới; cập nhật package từng nhóm và chạy regression.
4. Sửa lint theo nhóm nhỏ, không auto-fix hàng loạt trước khi review.

### Giai đoạn 4 - Hiệu năng và trải nghiệm

1. Đo bundle, API payload/latency, query plan và thời gian render trước khi tối ưu.
2. Áp dụng pagination có giới hạn; lazy-load phần export nặng; virtualize bảng lớn nếu đo đạc xác nhận cần thiết.
3. Bổ sung NotFound, keyboard/accessibility checks và favicon; quyết định SEO theo mục đích của từng route.

## 6. Tiêu chí nghiệm thu tổng thể

Chỉ đóng một finding khi có đủ:

- Mã finding, commit xử lý và người xác nhận.
- Test hồi quy tự động cho trường hợp hợp lệ và trường hợp bị từ chối.
- Test chạy trên DB disposable hoặc môi trường QA được phê duyệt; không động vào production data.
- Kết quả CI xanh cho các job liên quan, không có false-green.
- E2E/HTTP evidence cho những lỗi authorization, payment, exam và file; unit test đơn lẻ không thay thế được.
- Cập nhật trạng thái tài liệu audit, ghi rõ “đã sửa”, “đã QA” hay “chấp nhận rủi ro”.

### Definition of Done cho báo cáo tài chính

KPI doanh thu trên Dashboard, API, báo cáo và đối soát phải nhất quán với quy tắc tài chính được nghiệp vụ phê duyệt. Nếu Ledger là nguồn chuẩn, cần xác nhận rõ cách tính payment/refund, chi nhánh, khoảng thời gian và các trường hợp hủy/hoàn trước khi chốt.

## 7. Danh sách việc có thể giao ngay

| Việc | Kết quả mong muốn |
|---|---|
| Kiểm tra HEAD và tái xác minh finding | Bảng trạng thái hiện tại: còn lỗi / đã sửa / không tái hiện / cần thêm bằng chứng |
| Dựng DB test disposable và sửa CI | Có thể chạy unit/integration an toàn, không chạm DB thật |
| Vá ownership/branch cho student, schedule, evaluation, file | Test ma trận role/branch xanh |
| Khóa quiz và schedule state machine | Test deadline, completed, timeout và reversal xanh |
| Bổ sung E2E refund và reassignment | Có bằng chứng đầy đủ cho các luồng nghiệp vụ P0 |
| QA lại exam fixes đã có | Route/E2E trên DB sạch, gồm retry/concurrency |
| Rà soát dependency và lint | Báo cáo mới theo lockfile hiện tại, không làm thay đổi hàng loạt thiếu kiểm soát |

## 8. Pull request đang mở được thấy khi lập báo cáo

Danh sách pull request được truy vấn trong repository có các tiêu đề sau. Dựa trên tiêu đề, chúng tập trung vào giao diện/parity và local development; cần đọc diff trước khi kết luận phạm vi thực tế, và hiện không nên xem là bằng chứng đã đóng các finding P0 bên trên.

- [#25 - Wip/student home parity transfer](https://github.com/thangcomputer/DASHBOARDTHANGTINHOC/pull/25)
- [#24 - Feature/mobile UI parity](https://github.com/thangcomputer/DASHBOARDTHANGTINHOC/pull/24)
- [#2 - feat: local:up + faster admin login (no Docker)](https://github.com/thangcomputer/DASHBOARDTHANGTINHOC/pull/2)

## 9. Tài liệu tham chiếu

- [FULL_WEBSITE_AUDIT_REPORT.md](../FULL_WEBSITE_AUDIT_REPORT.md)
- [docs/AUDIT_LMS_THANG_TIN_HOC.md](AUDIT_LMS_THANG_TIN_HOC.md)
- [docs/QA_ENTERPRISE_E2E_REPORT.md](QA_ENTERPRISE_E2E_REPORT.md)
- [docs/FINANCE_AUDIT_REPORT_2026-07-29.md](FINANCE_AUDIT_REPORT_2026-07-29.md)

---

**Kết luận:** Báo cáo hiện có đủ căn cứ để ưu tiên xử lý authorization, test isolation/CI và các luồng tài chính/quiz chưa có E2E hoàn chỉnh. Tuy nhiên, do nguồn audit có ngày cũ và một số bản sửa đã được ghi nhận sau đó, bước đầu tiên cần làm là đối chiếu từng finding với HEAD hiện tại; không triển khai thay đổi lớn hoặc chạy test có nguy cơ ghi dữ liệu trước khi môi trường test được cô lập.
