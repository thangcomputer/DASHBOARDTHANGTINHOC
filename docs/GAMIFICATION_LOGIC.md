# XP và phần thưởng

Nguồn: `services/dailyPracticeRules.js` và `models/DailyPracticeProfile.js`. UI phải đọc các hằng này, không chép số.

## Ví

`DailyPracticeProfile` theo từng học viên.

- `dailyXp`: phần XP trong ngày, được đặt lại theo gói.
- `purchasedXp`: XP mua, giữ qua ngày.
- `xpTotal`: ví tiêu dùng, bằng phần ngày cộng phần đã mua trong các hàm cộng của service.
- `studyXpTotal`: XP học tập tích lũy, chỉ tăng.

## Mức ngày

| Tình huống | Hằng | Mức |
| --- | --- | ---: |
| Tài khoản miễn phí, không gói Meet | `FREE_PORTAL_DAILY_XP` | 60 |
| Mức ngày mặc định trong code | `DAILY_ALLOWANCE_XP` | 200 |
| Gói Meet còn hạn | `MEET_PLAN_DAILY_XP` | 300 |

Cài đặt runtime có thể ghi đè mức miễn phí qua `xpConfig.freeAccountXp` nếu số đó lớn hơn 0. Xem `resolve` trong cùng file trước khi đổi UI.

## Trong một lượt luyện

- Mỗi câu sai trừ `QUESTION_STAKE_XP` (5).
- Đạt ngưỡng thì cộng 5 mỗi câu đúng.
- Một lượt mặc định 10 câu, cược tối đa `SESSION_STAKE_XP` (50).
- Kiểm tra vượt chặng: đạt hoặc trượt đều 40 XP (`TEST_OUT_XP`).
- Mở rương cuối chặng: `UNIT_CHEST_REWARD_XP` (50).
- Ôn lại bài hoặc video đã xong: không cộng và không trừ, kể cả gợi ý và nút bỏ qua.

## Mốc video

- Trả lời mốc: 5 XP (`VIDEO_CHECK_ANSWER_XP`) khi chưa hoàn thành.
- Bỏ qua mốc: 15 XP (`VIDEO_CHECK_SKIP_XP`).
- `videoCheckXpConfig` trả 0 nếu `isReview`.

Độ khó câu hỏi `easy` 10, `medium` 15, `hard` 20 là bảng `XP_BY_DIFFICULTY` cho nội dung luyện, không thay cho cược 5 XP ở trên. Đọc hàm gọi trước khi cộng vào ví.

## Chống cộng đôi

Request ghi không được gộp ở `apiFetch`. Service luyện cần khóa theo attempt hoặc session đã có trong code đường dẫn nộp bài. Không thêm retry tự động cho POST nộp đáp án.

Làm mới trang không được gọi lại API cộng XP. XP chỉ đổi khi có lệnh ghi thành công.
