import { VI_EN_EXACT } from './viEnDict.mjs';
import { VI_EN_EXTRA } from './viEnExtraDict.mjs';
import { VI_EN_TEACHER_SHARED } from './viEnTeacherSharedDict.mjs';

export const DEFAULT_LANGUAGE = 'vi';
export const SUPPORTED_LANGUAGES = ['vi', 'en'];
export const LANG_STORAGE_KEY = 'dewskill_lang';
export const MOBILE_LANG_STORAGE_KEY = '@dewskill_lang';

const VI_DIACRITIC_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

/** Bổ sung câu dài, thông báo, khảo sát, phòng thi, bài học & nút SHARE. */
const VI_EN_EXTENDED = {
  // Khảo sát / Đánh giá / Popup
  'Cài đặt và hỗ trợ': 'Settings & Support',
  'Cài đặt & hỗ trợ': 'Settings & Support',
  'Bật thông báo trên thiết bị': 'Enable Device Notifications',
  'Bật quyền thông báo cho trình duyệt này': 'Enable notifications for this browser',
  'Chỉ hỏi quyền khi bạn chọn bật': 'Only asks permission when you choose to enable',
  'Liên kết quyền riêng tư, điều khoản và hỗ trợ đang chờ Trung tâm cấu hình.': 'Privacy, terms, and support links are pending Center configuration.',
  'Cùng DewSkill thiết kế lộ trình dành riêng cho bạn': 'Design your personalized DewSkill path',
  'Cơ duyên nào đưa bạn đến với Thắng Tin Học?': 'How did you hear about Thang Tin Hoc?',
  'Hiện tại, kỹ năng Tin học của bạn đang ở mức nào?': 'What is your current Office IT skill level?',
  'Điều gì khiến bạn còn băn khoăn nhất khi học online?': 'What is your main concern with online learning?',
  'Tìm kiếm Google': 'Google Search',
  'Bạn bè / Người thân': 'Friends / Family',
  'Nguồn khác': 'Other sources',
  'Mới bắt đầu từ con số 0': 'Complete beginner',
  'Đã biết cơ bản, muốn học cho vững': 'Know basics, want solid foundations',
  'Đã có nền tảng, muốn luyện nâng cao': 'Good foundation, want advanced practice',
  'Lo ngại về độ uy tín & chất lượng khóa học': 'Concerned about course quality & trust',
  'Ngại đăng ký xong lại phải tự học một mình': 'Worried about self-studying alone',
  'Sợ học online xem video xong không hiểu bài': 'Worried video lessons may feel unclear',
  'Sợ gặp chỗ khó không có người giải đáp ngay': 'Concerned no one helps when stuck',
  'Mình rất hào hứng, chỉ muốn học thử ngay!': 'Super excited — ready to try now!',
  'Đã hiểu, bắt đầu học': 'Got it, start learning',
  'Cách mở các mục đang khóa': 'How to unlock locked items',
  'Tài khoản miễn phí có sẵn Luyện tập': 'Free accounts include Daily Practice',
  'Mục này đang khóa': 'This item is locked',
  'Đăng ký gói Meet để mở các mục đang khóa': 'Get Meet Plan to unlock locked items',
  'Lịch học đang khóa': 'Schedule is Locked',
  'Hộp thư đang khóa': 'Inbox is Locked',
  'Bài tập đang khóa': 'Assignments Locked',
  'Phòng thi đang khóa': 'Exam Room Locked',
  'Buổi học bị khóa': 'Lesson Locked',
  'Nhắn tin & hỏi bài 1 kèm 1 với Giảng viên': 'Chat 1-on-1 with teachers anytime',
  'Nhận tài liệu và bài tập theo tiến độ riêng': 'Receive tailored materials & assignments',
  'Hỗ trợ giải đáp thắc mắc học tập 24/7': '24/7 study support & Q&A',
  'Chào mừng bạn quay lại': 'Welcome back',
  'Hãy cố gắng chinh phục bài giảng tiếp theo nào.': 'Keep going and conquer the next lesson!',
  'QUAY LẠI LUYỆN TẬP': 'RESUME PRACTICE',
  'Chưa có khóa học được mở': 'No courses unlocked yet',
  'Chưa có khóa học được mở.': 'No courses unlocked yet.',
  'Chưa có khóa học': 'No courses yet',
  'Tất cả khóa học': 'All Courses',
  'Tất cả khóa': 'All Courses',
  'Tất cả trạng thái': 'All Statuses',
  'Tất cả môn': 'All Subjects',
  'Tất cả môn thi': 'All Exam Subjects',
  'Các bước bắt đầu và theo dõi khóa học của bạn.': 'Steps to start and track your course.',
  'Chọn khóa học, mở môn học và hoàn thành lần lượt từng buổi để theo dõi tiến độ.': 'Pick a course, open a subject, and complete each session in order to track progress.',
  'LỘ TRÌNH CỦA BẠN': 'YOUR COURSES',
  'CHỦ ĐỘNG HỌC TẬP': 'SELF-PACED LEARNING',
  'Học theo video bài giảng, linh hoạt theo thời gian của bạn.': 'Learn through video lessons at your own pace.',
  'HỌC CÙNG GIẢNG VIÊN': 'LIVE WITH TEACHER',
  'Học có giảng viên hướng dẫn và đồng hành.': 'Learn 1-on-1 with dedicated teacher guidance.',
  'KHÁM PHÁ KHÓA HỌC': 'EXPLORE COURSES',
  'Các khóa học đang mở để bạn tham khảo.': 'Available courses open for enrollment.',
  'KHÓA HỌC': 'COURSES',
  'MÔN HỌC': 'SUBJECT',
  'Khóa miễn phí': 'Free Courses',
  'Khóa có phí': 'Paid Courses',
  'Lọc khóa học': 'Filter Courses',
  'Lọc danh sách': 'Filter List',
  'Lọc học viên': 'Filter Students',
  'Lọc học viên theo khóa': 'Filter by Course',
  'Lọc lịch học theo khóa': 'Filter Schedule by Course',
  'Lọc tên học viên': 'Search student name',
  'Không có khóa khớp bộ lọc': 'No matching courses',
  'Không có khóa học trong bộ lọc': 'No courses match your filter',
  'Không có môn thi phù hợp bộ lọc': 'No subjects match filter',
  'Thử đổi trạng thái, học phí hoặc môn học.': 'Try changing status, fee type, or subject.',
  'Thử chọn một bộ lọc khác.': 'Try choosing a different filter.',
  'Bắt đầu luyện tập': 'Start Practice',
  'Sẵn sàng luyện tập?': 'Ready to Practice?',
  'Tiếp tục luyện tập?': 'Continue Practice?',
  'Bạn đã hết thời gian': 'Time is Up!',
  'Bạn là chuyên gia!': 'You’re a pro!',
  'Bậc thầy tin học!': 'IT Master!',
  'Như chuyên gia!': 'Like an expert!',
  'Quá chuyên nghiệp!': 'So professional!',
  'Trên cả tuyệt vời!': 'Beyond amazing!',
  'Cố lên nhé!': 'Keep going!',
  'Bạn đã chọn đúng đáp án!': 'You picked the right answer!',
  'Mình cùng xem lại câu hỏi rồi thử tiếp nhé.': 'Let’s review the question and try again.',
  'Tương đối tốt!': 'Nice work!',
  'Rất tốt!': 'Very good!',
  'Chỉ sai vài câu - xem lại phần giải thích để nhớ lâu hơn.': 'Only a few misses — review explanations to retain more.',
  'Cố lên!': 'Keep going!',
  'Bạn đang tiến bộ. Ôn lại các câu sai rồi chơi lại nhé.': 'You’re improving! Review missed questions and retry.',
  'Đừng nản nhé!': 'Don’t give up!',
  'Ai cũng bắt đầu từ đây. Thử độ khó Dễ để làm quen trước.': 'Everyone starts here. Try Easy mode first to build confidence.',
  'Lâu rồi bạn chưa luyện tập!': 'It’s been a while since your last practice!',
  'Hôm nay bạn chưa luyện tập - chuỗi sẽ về 0 lúc nửa đêm. Làm ngay 10 câu để giữ lửa!': 'You haven’t practiced today — keep your streak alive before midnight!',
  'Bạn nắm chủ đề này rất chắc. Thử độ khó cao hơn nhé!': 'You know this topic well. Try a higher difficulty!',
  'Ôn tập ngắt quãng': 'Spaced Review',
  'Kiếm 50 XP trong ngày': 'Earn 50 XP today',
  'Hoàn thành 1 lượt để giữ chuỗi ngày': 'Finish 1 run to keep your streak',
  'Hoàn thành để ghi nhận tiến độ': 'Complete to save progress',
  'Chọn độ khó để bắt đầu': 'Pick difficulty to start',
  'Vừa mở khóa': 'Just unlocked',
  'CHẶNG HIỆN TẠI': 'CURRENT UNIT',
  'Luyện bài đang mở': 'Practice Current',
  'Ôn lại lộ trình': 'Review Path',
  'Đã học hết': 'All Completed',
  'Đang mở khóa': 'Unlocked',
  'CHƯA MỞ KHÓA': 'LOCKED',
  'Chưa mở khóa': 'Locked',
  'Chặng hiện tại': 'Current Unit',
  'Hoàn thành xong': 'Completed',
  'Đã vượt chặng': 'Tested Out',
  'Xem lộ trình': 'View Path',
  'Chinh phục Cúp Vàng': 'Earn Gold Trophy',
  'Ôn tập theo lịch nhớ thông minh': 'Smart spaced repetition review',
  'Hỏi AI (VD: lỗi #N/A vlookup, hàm IF, căn lề Word...)': 'Ask AI (e.g. #N/A vlookup, IF formula, Word layout...)',
  'Trợ lý AI đang trả lời...': 'AI is replying...',
  'AI đang trả lời...': 'AI is thinking...',
  'Chưa có nội dung': 'No content yet',
  'Chưa có câu hỏi': 'No questions yet',
  'Chưa có bài tập': 'No assignments yet',
  'Chưa có thông báo': 'No notifications',
  'Không có thông báo': 'No notifications',
  'Không có thông báo mới nào': 'No new notifications',
  'Thông báo mới': 'New Notifications',
  'Bạn đã cập nhật!': 'You’re all caught up!',
  'Hiển thị tất cả thông báo': 'Show all notifications',
  'Thông báo hệ thống': 'System Notice',
  'Chạm để mở': 'Tap to open',
  'Nhấn để xem': 'Tap to view',
  'Nhấn để phát video': 'Tap to play video',
  'Bấm để xem lại đáp án': 'Tap to review answers',
  'Chọn đáp án': 'Select an answer',
  'Chọn một đáp án': 'Choose an answer',
  'Chọn một hoặc nhiều đáp án': 'Select one or more options',
  'Câu trả lời của bạn': 'Your answer',
  'Bạn chọn': 'Your pick',
  'Bạn chọn:': 'You picked:',
  'Đáp án': 'Answer',
  'Đáp án đúng': 'Correct answer',
  'Đáp án đúng:': 'Correct answer:',
  'Đáp án A': 'Option A',
  'Đáp án B': 'Option B',
  'Đáp án C': 'Option C',
  'Đáp án D': 'Option D',
  'Các lựa chọn': 'Options',
  'Nhận định': 'Statement',
  'Chuẩn bị bắt đầu': 'Get ready',
  'Bạn chuẩn bị bắt đầu': 'You are about to begin',
  'Sau khi bắt đầu, thời gian sẽ được tính.': 'The timer starts once you begin.',
  'Bạn có chắc muốn nộp bài?': 'Are you sure you want to submit?',
  'Không có câu hỏi trong bộ lọc này.': 'No questions in this filter.',
  'Đề thi': 'Exam',
  'Chọn level để xem đề thi': 'Choose a level to view exams',
  'Luyện tập và kiểm tra kiến thức theo từng cấp độ': 'Practice and test knowledge by level',
  'Đang tải phòng thi ôn MOS/IC3...': 'Loading MOS/IC3 exam room...',
  'Đang tải phòng thi trắc nghiệm...': 'Loading quiz room...',
  'Trắc nghiệm': 'Quiz',
  'Tự luận': 'Written',
  'Thực hành': 'Practical',
  'Tự luận / Thực hành': 'Written / Practical',
  'Môn thi': 'Subject',
  'Loại': 'Type',
  'Nội dung': 'Content',
  'Tiêu đề': 'Title',
  'Mô tả': 'Description',
  'Mô tả ngắn': 'Short description',
  'Trạng thái': 'Status',
  'Hình thức': 'Format',
  'Hình thức học': 'Study Mode',
  'Số tiền': 'Amount',
  'Giá gốc': 'Original Price',
  'Giảm giá': 'Discount',
  'Ngân hàng': 'Bank',
  'Số tài khoản': 'Account Number',
  'Chủ tài khoản': 'Account Holder',
  'Mã QR chuyển khoản': 'Bank Transfer QR',
  'Chuyển khoản theo thông tin bên dưới': 'Transfer using details below',
  'Đang chờ xác nhận thanh toán tự động…': 'Waiting for automatic payment confirmation…',
  'Đã xác nhận thanh toán': 'Payment confirmed',
  'Bạn đã thanh toán thành công': 'Payment successful!',
  'Khôi phục giao dịch mua': 'Restore Purchases',
  'Nhật ký điểm số': 'Score History',
  'Chưa có điểm': 'No score yet',
  'Chưa có kết quả': 'No results yet',
  'Chưa có kết quả bài thi.': 'No exam results yet.',
  'Chưa có dữ liệu điểm số': 'No score data yet',
  'Chưa có dữ liệu điểm thi.': 'No exam scores yet.',
  'Chưa có dữ liệu điểm danh.': 'No attendance records yet.',
  'Chưa có tin nhắn': 'No messages yet',
  'Chưa có liên hệ': 'No contacts yet',
  'Chưa có cuộc gọi': 'No calls yet',
  'Chưa có bài nào': 'No posts yet',
  'Chưa có bình luận': 'No comments yet',
  'Gửi bình luận': 'Post Comment',
  'Xóa bình luận': 'Delete Comment',
  'Chưa có đánh giá nào.': 'No reviews yet.',
  'Góp ý cho trung tâm (bắt buộc)...': 'Feedback for center (required)...',
  'Lời nhắn riêng cho Admin (bắt buộc)...': 'Private message for Admin (required)...',
  'Lời nhắn cho giảng viên (tùy chọn)': 'Note for teacher (optional)',
  'Gửi phản hồi': 'Send Feedback',
  'Trung tâm Lắng nghe Bạn!': 'We’re Listening!',
  'Đánh giá chất lượng': 'Quality Feedback',
  'Rất hài lòng': 'Very Satisfied',
  'Bình thường': 'Neutral',
  'Dễ hiểu': 'Clear & Easy',
  'Hơi khó hiểu': 'Needs Clarity',
  'Phản hồi của bạn giúp chúng tôi cải thiện chất lượng giảng dạy.': 'Your feedback helps us improve teaching quality.',
  'Chính sách quyền riêng tư': 'Privacy Policy',
  'Điều khoản sử dụng': 'Terms of Service',
  'Khởi động lại ngay': 'Restart Now',
  'Đồng bộ lại khóa học và gói thuê bao đã kích hoạt': 'Resync courses and active subscriptions',
  'Số ngày': 'Days',
  'Ngày': 'Day',
  'Tuần': 'Week',
  'Tháng': 'Month',
  'Năm': 'Year',
  'Giờ': 'Hour',
  'Phút': 'Min',
  'Chọn ngôn ngữ phù hợp khi sử dụng Web App & Mobile App': 'Choose your preferred language across Web & Mobile App',
  'Đã chuyển sang Tiếng Việt': 'Switched to Vietnamese',
  'Switched UI to English': 'Switched UI to English',
};

const ALL_EXACT = { ...VI_EN_EXACT, ...VI_EN_EXTRA, ...VI_EN_TEACHER_SHARED, ...VI_EN_EXTENDED };
const ALL_EXACT_LOWER = {};
for (const [k, v] of Object.entries(ALL_EXACT)) {
  const low = k.toLowerCase();
  if (!(low in ALL_EXACT_LOWER)) ALL_EXACT_LOWER[low] = v;
}

const PREFIX_VERBS = [
  ['Đang tải ', 'Loading '],
  ['Không tải được ', 'Unable to load '],
  ['Không thể ', 'Unable to '],
  ['Không tìm thấy ', 'Not found: '],
  ['Không có ', 'No '],
  ['Chưa có ', 'No '],
  ['Không còn ', 'No more '],
  ['Đóng ', 'Close '],
  ['Mở ', 'Open '],
  ['Xem lại ', 'Review '],
  ['Xem thêm ', 'View more '],
  ['Xem ', 'View '],
  ['Tìm ', 'Find '],
  ['Chọn ', 'Select '],
  ['Xóa ', 'Delete '],
  ['Xoá ', 'Delete '],
  ['Sửa ', 'Edit '],
  ['Chỉnh sửa ', 'Edit '],
  ['Cập nhật ', 'Update '],
  ['Lưu ', 'Save '],
  ['Tải ', 'Download '],
  ['Thêm ', 'Add '],
  ['Tạo ', 'Create '],
];

const VI_WEEKDAY_MAP = {
  'thứ hai': 'Monday',
  'thứ ba': 'Tuesday',
  'thứ tư': 'Wednesday',
  'thứ năm': 'Thursday',
  'thứ sáu': 'Friday',
  'thứ bảy': 'Saturday',
  'chủ nhật': 'Sunday',
  'thứ 2': 'Mon',
  'thứ 3': 'Tue',
  'thứ 4': 'Wed',
  'thứ 5': 'Thu',
  'thứ 6': 'Fri',
  'thứ 7': 'Sat',
  cn: 'Sun',
};

const PATTERN_RULES = [
  // ─ Thứ trong tuần & Ngày tháng tiếng Việt ─
  [/^(?:📅\s*)?(Thứ\s*(?:Hai|Ba|Tư|Năm|Sáu|Bảy|[2-7])|Chủ\s*nhật|CN)\s*[,-]\s*(?:ngày\s*)?(.+)$/i, (m, wd, rest) => `${m.trim().startsWith('📅') ? '📅 ' : ''}${VI_WEEKDAY_MAP[wd.replace(/\s+/g, ' ').trim().toLowerCase()] || wd}, ${translateCore(rest, 1)}`],
  [/^(Thứ\s*(?:Hai|Ba|Tư|Năm|Sáu|Bảy|[2-7])|Chủ\s*nhật|CN)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/i, (_, wd, d) => `${VI_WEEKDAY_MAP[wd.replace(/\s+/g, ' ').trim().toLowerCase()] || wd} ${d}`],
  [/^(?:ngày\s+)?(\d{1,2})\s+(?:tháng|thg)\s+(\d{1,2})(?:,?\s+năm|\s*,)?\s+(\d{4})$/i, '$1/$2/$3'],
  [/^tháng\s+(\d{1,2})\s+năm\s+(\d{4})$/i, 'Month $1, $2'],
  [/^Truy cập\s+(.+)$/i, 'Last seen $1'],

  // ─ Thời lượng & Ngày giờ ─
  [/^(\d+)\s*ngày\s+(\d+)\s*giờ\s+(\d+)\s*phút\s+(\d+)\s*s$/i, '$1d $2h $3m $4s'],
  [/^(\d+)\s*ngày\s+(\d+)\s*giờ$/i, '$1d $2h'],
  [/^(\d+)\s*giờ\s+(\d+)\s*phút$/i, '$1 hr $2 min'],
  [/^(\d+)\s*phút\s+(\d+)\s*giây$/i, '$1 min $2 sec'],
  [/^(\d+)\s*ngày\s+(\d{1,2}:\d{2}(?::\d{2})?)$/i, '$1d $2'],
  [/^(\d+)s\s+trước$/i, '$1s ago'],
  [/^(\d+)p\s+trước$/i, '$1m ago'],
  [/^(\d+)h\s+trước$/i, '$1h ago'],
  [/^(\d+)\s*phút\s+trước$/i, '$1m ago'],
  [/^(\d+)\s*giờ\s+trước$/i, '$1h ago'],
  [/^(\d+)\s*ngày\s+trước$/i, '$1d ago'],
  [/^Tháng\s+(\d+)\s*\/\s*(\d+)$/i, 'Month $1/$2'],
  [/^tháng\s+(\d+)\s*\/\s*(\d+)$/i, 'Month $1/$2'],
  [/^Thu nhập\s+T(\d+)$/i, 'Month $1 Income'],
  [/^Lịch dạy\s+ngày\s+(\d+)\/(\d+)\/(\d+)$/i, 'Schedule for $1/$2/$3'],
  [/^Ngày\s+(\d+)\/(\d+)\/(\d+)$/i, '$1/$2/$3'],
  [/^Hôm nay đã đạt\s+(\d+)\s*XP$/i, '$1 XP earned today'],
  [/^Hôm nay:\s*(\d+)\s*XP$/i, 'Today: $1 XP'],
  [/^Vào lúc\s+(.+)$/i, 'At $1'],
  [/^Hôm nay\s+(.+)$/i, 'Today $1'],
  [/^Sắp tới\s+(.+)$/i, (_, rest) => `Next: ${translateCore(rest, 1)}`],
  [/^Ca\s+([0-9:–\-\s]+)\s*·\s*(.+)$/i, (_, c, r) => `Slot ${c.trim()} · ${translateCore(r, 1)}`],
  [/^(\d+)\s*tháng(?:\s+học)?$/i, '$1 mo'],
  [/^(\d+)\s*năm$/i, '$1 yr'],
  [/^(\d+)\s*tuần$/i, '$1 wk'],
  [/^(\d+)\s*giây$/i, '$1 sec'],
  [/^(\d+)\s*giây\s+đã\s+xem$/i, '$1s watched'],
  [/^(\d+)\s*phút$/i, '$1 min'],
  [/^(\d+)\s*phút\s+đọc$/i, '$1 min read'],
  [/^(\d+)\s*giờ$/i, '$1 hr'],
  [/^(\d+)\s*tiếng$/i, '$1 hr'],
  [/^(\d+)\s*tuổi$/i, '$1 yrs old'],
  [/^(\d+)\s*từ$/i, '$1 words'],
  [/^Thử lại sau\s+(\d+)\s*giây$/i, 'Retry in $1s'],
  [/^Gửi lại(?:\s+sau)?\s*\((\d+)s\)$/i, 'Resend ($1s)'],
  [/^Hủy điểm danh\s*\((\d+)s\)$/i, 'Undo attendance ($1s)'],
  [/^Hủy điểm danh trong\s+(\d+)s\s*-\s*buổi chưa tính$/i, 'Cancel within $1s — session not counted'],
  [/^Đang tự động kiểm tra(?:\s+thanh toán)?(\.{3}|…)\s*\((\d+)s\)$/i, 'Checking payment... ($2s)'],

  // ─ Bảng xếp hạng, Mục tiêu, Giới thiệu & Tổng quan ─
  [/^(\d+)\s*\/\s*(\d+)\s*xong$/i, '$1/$2 done'],
  [/^(\d+)\s*\/\s*(\d+)\s*đã xong$/i, '$1/$2 done'],
  [/^(\d+)\s*\/\s*(\d+)\s*hoàn\s+thành$/i, '$1/$2 completed'],
  [/^(\d+)\s*\/\s*(\d+)\s*ngày$/i, '$1/$2 days'],
  [/^(\d+)\s*ngày\s+đạt$/i, '$1 goal days'],
  [/^Lên\s+([^:]+):\s*(\d+)p$/i, (_, tier, m) => `Next (${translateCore(tier, 1)}): ${m}m`],
  [/^Hạng\s+(Đồng|Bạc|Vàng|Bạch Kim|Kim Cương)$/i, (_, tier) => `${translateCore(tier.trim(), 1)} League`],
  [/^Hạng\s+([A-Za-zÀ-ỹ\s]+)$/i, (_, tier) => `${translateCore(tier.trim(), 1)} League`],
  [/^Rank\s+(Đồng|Bạc|Vàng|Bạch Kim|Kim Cương)$/i, (_, tier) => `${translateCore(tier.trim(), 1)} Rank`],
  [/^Mục tiêu\s*:?\s*([\d.,]+)\s*(?:g|giờ)\/ngày$/i, 'Goal: $1h/day'],
  [/^([\d.,]+)\s*giờ\s*\/\s*ngày$/i, '$1h/day'],
  [/^([\d.,]+)\s*giờ\s+mỗi\s+ngày$/i, '$1h per day'],
  [/^Mục tiêu\s*:\s*([^/]+)\/\s*([\d.,]+)\s*giờ$/i, (_, cur, target) => `Goal: ${translateCore(cur.trim(), 1)} / ${target}h`],
  [/^(.+?)\s*\/\s*([\d.,]+)\s*giờ$/i, (_, cur, target) => `${translateCore(cur.trim(), 1)} / ${target} hr`],
  [/^Mục tiêu ngày\s*·\s*(.+)$/i, (_, rest) => `Daily Goal · ${translateCore(rest, 1)}`],
  [/^(\d+)\s*bạn\s*·\s*\+(\d+)\s*XP$/i, '$1 invited · +$2 XP'],
  [/^(\d+)\s*bạn$/i, '$1 friends'],
  [/^Mã của bạn là\s+(.+)$/i, 'Your code is $1'],
  [/^Đã nhận\s*\+(\d+)\s*XP\s+cho cả bạn và\s+(.+)!?$/i, 'Claimed +$1 XP for you and $2!'],
  [/^Đã áp dụng mã giới thiệu\s*(.*)\.?$/i, 'Applied referral code $1.'],
  [/^Học thêm\s+(.+?)\s+để vượt\s+#(\d+)$/i, (_, dur, r) => `Study ${translateCore(dur, 1)} more to pass #${r}`],
  [/^Đạt thêm\s+(\d+)\s*ngày mục tiêu để vượt\s+#(\d+)$/i, 'Hit goal $1 more days to pass #$2'],
  [/^Cơ sở\s+(.+)$/i, 'Branch $1'],
  [/^Ví\s*:?\s*([\d.,]+)\s*XP$/i, 'Wallet: $1 XP'],
  [/^Cược\s+(\d+)\s*XP$/i, 'Stake $1 XP'],
  [/^(\d+)\s*XP\/câu$/i, '$1 XP/q'],
  [/^\+(\d+)\s*XP\/câu\s*đúng$/i, '+$1 XP/correct'],
  [/^tối đa\s+(\d+)\s*XP$/i, 'max $1 XP'],
  [/^Đạt\s+(\d+)%\s*·\s*(.+)$/i, (_, pct, rest) => `${pct}% achieved · ${translateCore(rest, 1)}`],
  [/^Chu kỳ:\s*(.+)$/i, (_, rest) => `Cycle: ${translateCore(rest, 1)}`],
  [/^Cả kỳ:\s*(.+)$/i, (_, rest) => `Term: ${translateCore(rest, 1)}`],
  [/^Duy trì chuỗi\s+(\d+)\s*ngày$/i, 'Keep $1-day streak'],
  [/^Giữ chuỗi\s+(\d+)\s*ngày(?:\s+luyện tập liên tiếp)?$/i, 'Maintain $1-day streak'],
  [/^Chuỗi\s+(\d+)\s*ngày rồi!.*$/i, '$1-day streak! Keep the momentum going every day!'],
  [/^(\d+)\s*ngày có học tháng này$/i, '$1 active days this month'],
  [/^Kỷ lục\s+(\d+)\s*ngày$/i, 'Best: $1 days'],

  // ─ Luyện tập, Câu hỏi, Bài học, Phòng thi ─
  [/^Câu(?:\s+hỏi)?\s+(?:số\s+)?(\d+)\s*\/\s*(\d+)$/i, 'Question $1/$2'],
  [/^Câu(?:\s+hỏi)?\s+(?:số\s+)?(\d+)$/i, 'Question $1'],
  [/^Câu\s+(\d+):\s*(.+)$/i, 'Q$1: $2'],
  [/^(\d+)\s*\/\s*(\d+)\s*câu đúng$/i, '$1/$2 correct'],
  [/^(\d+)\s*\/\s*(\d+)\s*câu(?:\s+hỏi)?$/i, '$1/$2 questions'],
  [/^(\d+)\s*\/\s*(\d+)\s*buổi$/i, '$1/$2 sessions'],
  [/^(\d+)\s*\/\s*(\d+)\s*bài$/i, '$1/$2 lessons'],
  [/^(\d+)\s*\/\s*(\d+)\s*bài đã hoàn thành$/i, '$1/$2 lessons completed'],
  [/^(\d+)\s*\/\s*(\d+)\s*phần$/i, '$1/$2 sections'],
  [/^(\d+)\s*\/\s*(\d+)\s*chặng$/i, '$1/$2 units'],
  [/^(\d+)\s*\/\s*(\d+)\s*mức$/i, '$1/$2 levels'],
  [/^(\d+)\s*\/\s*(\d+)\s*cấp(?:\s*\((.+)\))?$/i, '$1/$2 tiers ($3)'],
  [/^(\d+)\s*\/\s*(\d+)\s*mốc\s*(?:đã mở|câu hỏi)$/i, '$1/$2 milestones'],
  [/^(\d+)\s*\/\s*(\d+)\s*môn$/i, '$1/$2 subjects'],
  [/^(\d+)\s*\/\s*(\d+)\s*lần$/i, '$1/$2 attempts'],
  [/^(\d+)\s*\/\s*(\d+)\s*đã\s+(?:làm|trả lời)$/i, '$1/$2 answered'],
  [/^(\d+)\s*\/\s*(\d+)\s*thiết bị\s+được phép$/i, '$1/$2 authorized devices'],
  [/^Đã hoàn thành\s+(\d+)\s*\/\s*(\d+)(.*)$/i, (_, a, b, tail) => `Completed ${a}/${b}${tail ? ` ${translateCore(tail.trim(), 1)}` : ''}`],
  [/^Hoàn thành\s+(\d+)\s*\/\s*(\d+)(.*)$/i, (_, a, b, tail) => `Completed ${a}/${b}${tail ? ` ${translateCore(tail.trim(), 1)}` : ''}`],
  [/^Hoàn tất\s+(\d+)\s*\/\s*(\d+)$/i, 'Completed $1/$2'],
  [/^Chờ thi\s*\((\d+)\s*\/\s*(\d+)\s*môn\)$/i, 'Pending exam ($1/$2)'],
  [/^Đạt\s+(\d+)\s*\/\s*(\d+)\s*môn$/i, 'Passed $1/$2 subjects'],
  [/^Đạt\s+(\d+)\s*\/\s*(\d+)\s*câu đúng$/i, 'Scored $1/$2 correct'],
  [/^Đạt\s+(\d+)\s*\/\s*(\d+)$/i, 'Scored $1/$2'],
  [/^Đúng\s+(\d+)\s*\/\s*(\d+)(?:\s*câu)?$/i, 'Correct $1/$2'],
  [/^Sai\s+(\d+)\s*câu$/i, '$1 incorrect'],
  [/^Đã chọn\s*:?\s*(\d+)\s*\/\s*(\d+)\s*(?:học viên)?$/i, 'Selected $1/$2'],
  [/^Còn\s+(\d+)\s*phút(?:\s+nữa)?$/i, '$1 min left'],
  [/^Còn\s+(\d+)\s*giờ$/i, '$1 hr left'],
  [/^Còn\s+(\d+)\s*ngày(?:\s+nữa\s+là\s+hết)?$/i, '$1 days left'],
  [/^Còn\s+(\d+)\s*câu(?:\s+chưa trả lời|\s+nữa thôi)?!?$/i, '$1 questions left'],
  [/^Còn\s+(\d+)\s*buổi$/i, '$1 sessions left'],
  [/^Còn\s+(\d+)\s*bài$/i, '$1 lessons left'],
  [/^Còn\s+(\d+)\s*lần\s+thử$/i, '$1 attempts left'],
  [/^Còn\s+(\d+)\s*ảnh\s+hôm\s+nay$/i, '$1 photos left today'],
  [/^Hết\s+(\d+)\s*ảnh\s+hôm\s+nay$/i, 'Used all $1 photos today'],
  [/^Trước\s+(\d+)\s*phút$/i, '$1 min before'],
  [/^Trước\s+(\d+)\s*giờ$/i, '$1 hr before'],
  [/^(\d+)\s*ngày\s+liên\s+tiếp$/i, '$1-day streak'],
  [/^Mốc\s+(\d+)\s*ngày$/i, '$1-day milestone'],
  [/^Mốc\s+(\d+)\s*s$/i, '$1s checkpoint'],
  [/^Mốc\s+(\d+)\s*ngày\s+liên\s+tiếp!?$/i, '$1-day streak milestone!'],
  [/^Chuỗi\s+(\d+)\s*ngày!?$/i, '$1-day streak!'],
  [/^(\d+)\s*câu(?:\s+hỏi)?$/i, '$1 questions'],
  [/^(\d+)\s*câu\s+hỏi\s+mức\s+(.+)$/i, (_, n, l) => `${n} ${translateCore(l, 1)} questions`],
  [/^(\d+)\s*câu\s+đã\s+làm$/i, '$1 answered'],
  [/^(\d+)\s*câu\s+đến\s+hạn$/i, '$1 due today'],
  [/^(\d+)\s*câu\s+chờ\s+lịch$/i, '$1 queued'],
  [/^(\d+)\s*câu\s+Dễ$/i, '$1 Easy'],
  [/^(\d+)\s*câu\s+Vừa$/i, '$1 Medium'],
  [/^(\d+)\s*câu\s+Khó$/i, '$1 Hard'],
  [/^(\d+)\s*mốc\s+trắc\s+nghiệm$/i, '$1 quiz checkpoints'],
  [/^(\d+)\s*tài liệu(?:\s+đính kèm)?$/i, '$1 attachments'],
  [/^(\d+)\s*bài(?:\s+học)?(?:\s+xem thử)?$/i, '$1 lessons'],
  [/^(\d+)\s*buổi(?:\s+học|\s+trên lịch)?$/i, '$1 sessions'],
  [/^(\d+)\s*chặng$/i, '$1 units'],
  [/^(\d+)\s*phần$/i, '$1 sections'],
  [/^(\d+)\s*cấp độ$/i, '$1 levels'],
  [/^(\d+)\s*môn(?:\s+học)?$/i, '$1 subjects'],
  [/^\+(\d+)\s*môn$/i, '+$1 subjects'],
  [/^(\d+)\s*thiết bị$/i, '$1 devices'],
  [/^(\d+)\s*thành viên(?:\s+hiện tại)?$/i, '$1 members'],
  [/^(\d+)\s*học viên\s+tham\s+gia$/i, '$1 learners'],
  [/^(\d+)\s*HV$/i, '$1 learners'],
  [/^(\d+)\s*học viên(?:\s+cần quan tâm)?$/i, '$1 students'],
  [/^(\d+)\s*ca\s+sắp\s+tới$/i, '$1 upcoming slots'],
  [/^(\d+)\s*ca\s+hôm\s+nay$/i, '$1 classes today'],
  [/^(\d+)\s*lượt\s+đọc$/i, '$1 views'],
  [/^(\d+)\s*lượt\s+xem$/i, '$1 views'],
  [/^(\d+)\s*lượt$/i, '$1 reviews'],
  [/^(\d+)\s*đánh giá$/i, '$1 reviews'],
  [/^(\d+)\s*bình luận$/i, '$1 comments'],
  [/^(\d+)\s*kết quả$/i, '$1 results'],
  [/^(\d+)\s*giao dịch$/i, '$1 transactions'],
  [/^(\d+)\s*mục\s+ưu\s+tiên$/i, '$1 priority items'],
  [/^(\d+)\s*mục\s+đang\s+có$/i, '$1 items available'],
  [/^(\d+)\s*tin\s+(?:chưa đọc|nhắn\s+mới\s+chưa đọc|nhắn\s+trả lời)$/i, '$1 unread'],
  [/^(\d+)\s*thông báo(?:\s+mới\s+chưa đọc)?$/i, '$1 notifications'],
  [/^(\d+)\s*chưa đọc$/i, '$1 unread'],
  [/^(\d+)\s*tổng cộng$/i, '$1 total'],
  [/^Đã xem\s+(\d+)%$/i, 'Watched $1%'],

  // ─ Mobile high-priority templates & accessibility/action patterns ─
  [/^Chưa có câu đến hạn hôm nay \((\d+)\s*câu sẽ nhắc lại\s+từ\s+([^)]+)\)\.\s*Bạn vẫn có thể ôn sớm ngay!?$/i, (_, cnt, d) => `None due today (${cnt} upcoming starting ${translateCore(d.trim(), 1)}). Review early anytime!`],
  [/^AI chưa chấp nhận(\s*\([^)]+\))?\.\s*Hãy gửi ảnh mới\.?$/i, 'Not accepted by AI$1. Please submit a new screenshot.'],
  [/^AI chưa chấp nhận(\s*\([^)]+\))?\.\s*Hãy tải đáp án mới\.?$/i, 'Not accepted by AI$1. Please upload a new answer.'],
  [/^Chưa đúng ý(\s*\([^)]+\))?\.\s*Hãy nhập lại\.?$/i, 'Not quite right$1. Please enter again.'],
  [/^Chưa đúng(\s*\([^)]+\))?\.\s*Hãy chọn lại\.?$/i, 'Incorrect$1. Please choose again.'],
  [/^Chưa đúng(\s*\([^)]+\))?\.\s*Hãy chọn lại nhé!?$/i, 'Incorrect$1. Please try choosing again!'],
  [/^Chưa đúng(\s*\([^)]+\))?\.\s*Hãy nhập lại nhé!?$/i, 'Incorrect$1. Please try typing again!'],
  [/^Đúng lần đầu \+(\d+)\s*XP và xem tiếp\.\s*Sai mất (\d+)\s*XP rồi tải đáp án mới\.?$/i, 'First try +$1 XP and continue. Wrong deducts $2 XP before uploading a new answer.'],
  [/^Đúng lần đầu \+(\d+)\s*XP và xem tiếp\.\s*Sai mất (\d+)\s*XP rồi chọn lại\.?$/i, 'First try +$1 XP and continue. Wrong deducts $2 XP before choosing again.'],
  [/^Đúng lần đầu \+(\d+)\s*XP và xem tiếp\.\s*Sai mất (\d+)\s*XP rồi nhập lại\.?$/i, 'First try +$1 XP and continue. Wrong deducts $2 XP before entering again.'],
  [/^(Gia hạn|Nâng cấp|Đổi gói|Đăng ký|Renew|Upgrade|Change Plan|Subscribe)\s+tài khoản(?:\s+(.+))?$/i, (_, act, rest) => `${translateCore(act, 1)} Account${rest ? ` (${translateCore(rest.trim(), 1)})` : ''}`],
  [/^Gói tài khoản của\s+(.+?)\s+đã hết hạn ngày\s+([^.]+)\.\s*Gia hạn để tiếp tục học - tiến độ học vẫn được giữ nguyên\.?$/i, (_, name, dt) => `${name}'s account plan expired on ${dt.trim()}. Renew to continue learning — all your progress is saved.`],
  [/^Đăng ký khóa\s+"([^"]+)"\s+với giá\s+([\d.,]+)\s*đ\??$/i, 'Enroll in "$1" for $2 VND?'],
  [/^Nội dung trọng tâm của\s+"([^"]+)"\s+là gì\??$/i, 'What is the key focus of "$1"?'],
  [/^Nội dung trọng tâm của\s+(.+?)\.\s*Hãy nắm vững lý thuyết trước khi sang các bài luyện tập trắc nghiệm\.?$/i, (_, u) => `Key focus of ${translateCore(u.trim(), 1)}. Master the theory before moving on to the practice quizzes.`],
  [/^Hoàn thành\s+(\d+)\s*hoạt động học tập\s*·\s*mục tiêu\s+([\d.,]+)\s*giờ\/ngày\.?$/i, 'Complete $1 study activities · goal $2h/day.'],
  [/^Đăng ký gói để mở Chặng\s+(\d+)$/i, 'Subscribe to unlock Unit $1'],
  [/^Chặng\s+(\d+)\s*·\s*Lộ trình trong chặng$/i, 'Unit $1 · Unit Path'],
  [/^Chặng\s+(\d+)\s*·\s*Đạt\s+(\d+)%\s*để vượt chặng$/i, 'Unit $1 · Score $2% to pass'],
  [/^Đạt\s+(\d+)%\s*để vượt chặng$/i, 'Score $1% to pass'],
  [/^Chưa qua bước\s+(.+)$/i, (_, s) => `Did not pass step ${translateCore(s.trim(), 1)}`],
  [/^Buổi\s+(\d+):\s*Đã điểm danh hoàn thành buổi học$/i, 'Session $1: Marked session as completed'],
  [/^Đánh dấu đã đọc:\s*(.+)$/i, 'Mark as read: $1'],
  [/^Cuộc gọi (đi|đến)\s*·\s*(.+)$/i, (_, dir, who) => `${dir.toLowerCase() === 'đi' ? 'Outgoing Call' : 'Incoming Call'} · ${who}`],
  [/^Đã thêm\s+(\d+)\s*câu\.\s*Bỏ qua\s+(\d+)\s*dòng không hợp lệ\.?$/i, 'Added $1 questions. Skipped $2 invalid rows.'],
  [/^Đã thêm\s+(\d+)\s*câu\.?$/i, 'Added $1 questions.'],
  [/^Thoát giữa giờ\s*·\s*(.+)$/i, (_, reason) => `Left mid-quiz · ${translateCore(reason.trim(), 1)}`],
  [/^Đã hoàn thành bài học\s+(.+)$/i, 'Completed lesson $1'],
  [/^Phát bài học\s+(.+)$/i, 'Play lesson $1'],
  [/^Thực hành:\s*(.+)$/i, (_, v) => `Practice: ${translateCore(v.trim(), 1)}`],
  [/^Bài tập của khóa\s+(.+?),\s*bấm để đổi khóa$/i, (_, c) => `Assignments for ${c.trim().toLowerCase() === 'chưa chọn' ? 'unselected course' : c}, tap to switch course`],
  [/^Bài tập của khóa\s+chưa chọn$/i, 'Assignments for unselected course'],
  [/^(.+?),\s*(đã đọc|chưa đọc)$/i, (_, title, st) => `${title}, ${st.toLowerCase() === 'đã đọc' ? 'read' : 'unread'}`],
  [/^Câu hỏi\s+(\d+),\s*(đã trả lời|chưa trả lời)$/i, (_, idx, st) => `Question $1, ${st.toLowerCase() === 'đã trả lời' ? 'answered' : 'unanswered'}`],
  [/^(.+?),\s*(Thứ\s*(?:Hai|Ba|Tư|Năm|Sáu|Bảy|[2-7])|Chủ\s*nhật|CN)\s+(\d{1,2}),\s*(.+?)(,\s*đã khóa)?$/i, (_, name, wd, d, tm, lk) => `${name}, ${VI_WEEKDAY_MAP[wd.replace(/\s+/g, ' ').trim().toLowerCase()] || wd} ${d}, ${translateCore(tm.trim(), 1)}${lk ? ', locked' : ''}`],
  [/^(Đổi giờ|Xếp ca)\s+(.+)$/i, (_, act, rest) => `${act.toLowerCase() === 'đổi giờ' ? 'Reschedule' : 'Schedule slot'} ${translateCore(rest.trim(), 1)}`],
  [/^(Đã gửi Admin|Điểm danh bù)\s+(.+)$/i, (_, act, name) => `${act.toLowerCase().startsWith('đã gửi') ? 'Sent to Admin:' : 'Makeup attendance:'} ${name}`],
  [/^Gửi Gmail:\s*(.+)$/i, 'Send Gmail: $1'],
  [/^Gửi tin nhắn SĐT:\s*(.+)$/i, 'Send SMS to phone: $1'],
  [/^Tích lũy\s+([\d.,]+)\s*XP,\s*bấm để mua thêm XP$/i, 'Total $1 XP accumulated, tap to buy more XP'],
  [/^Lưu bảng kê\s+(.+)$/i, (_, m) => `Save statement ${translateCore(m.trim(), 1)}`],
  [/^BẢNG KÊ THU NHẬP\s+(.+)$/i, (_, m) => `INCOME STATEMENT — ${translateCore(m.trim(), 1).toUpperCase()}`],
  [/^Tổng\s+(\d+)\s*buổi$/i, 'Total $1 sessions'],
  [/^Lưu\s+(.+\.[a-z0-9]{2,6})$/i, 'Save $1'],
  [/^Chứng chỉ Thắng Tin Học\s*·\s*Học viên:\s*(.+?)\s*·\s*Khóa:\s*(.+?)\s*·\s*Mã xác thực:\s*(.+?)\s*·\s*Link:\s*(.+)$/i, 'Thang Tin Hoc Certificate · Student: $1 · Course: $2 · Verification Code: $3 · Link: $4'],
  [/^#\s*Sổ tay ghi chú:\s*(.+)$/i, '# Study Notebook: $1'],
  [/^Báo cáo:\s*(.+)$/i, 'Report: $1'],
  [/^Hỏi DewSkill AI:\s*“(.+)”$/i, 'Ask DewSkill AI: “$1”'],
  [/^Hỏi DewSkill AI:\s*"(.+)"$/i, 'Ask DewSkill AI: "$1"'],
  [/^Tiến độ(?:\s+học|\s+khóa học)?\s*:?\s*(\d+)%$/i, 'Progress: $1%'],
  [/^(\d+)%\s+hoàn\s+thành$/i, '$1% complete'],
  [/^Đạt\s+(\d+)%$/i, 'Scored $1%'],
  [/^Đạt\s+(\d+)%\s+chính\s+xác$/i, '$1% accuracy'],
  [/^Cần đúng\s+(\d+)%$/i, 'Pass ≥ $1%'],
  [/^Điểm\s+đạt:\s*(.+)$/i, 'Passing score: $1'],
  [/^Điểm TB\s+(.+)$/i, 'Avg Score $1'],
  [/^Mở khóa sau\s+(\d+)\s*buổi$/i, 'Unlocks after $1 sessions'],
  [/^Lần\s+(\d+)$/i, 'Attempt $1'],
  [/^Mục lục\s*\((\d+)\s*buổi\)$/i, 'Contents ($1)'],
  [/^Đang hiện\s+(\d+)\s*câu(?:\s*hỏi|\s+cần ôn lại)?$/i, 'Showing $1 questions'],
  [/^Nhấn để xem chi tiết đáp án\s*\((\d+)\s*câu\)$/i, 'Tap to review answers ($1 questions)'],
  [/^Bấm để xem lại đáp án\s*\((\d+)\s*câu\)$/i, 'Tap to review answers ($1 questions)'],
  [/^Đề(?:\s+thi)?\s+(?:số\s+)?(\d+)(.*)$/i, 'Exam $1$2'],
  [/^Chặng\s+(\d+)\s*[:·-]\s*(.+)$/i, (_, n, t) => `Unit ${n}: ${translateCore(t, 1)}`],
  [/^Chặng\s+(\d+)$/i, 'Unit $1'],
  [/^Bài(?:\s+học)?\s+(\d+)\s*[:·-]\s*(.+)$/i, (_, n, t) => `Lesson ${n}: ${translateCore(t, 1)}`],
  [/^Bài(?:\s+học)?\s+(\d+)$/i, 'Lesson $1'],
  [/^BÀI(?:\s+HỌC)?\s+(\d+)$/i, 'LESSON $1'],
  [/^Buổi(?:\s+học|\s+thứ)?\s+(\d+)\s*[:·-]\s*(.+)$/i, (_, n, t) => `Session ${n}: ${translateCore(t, 1)}`],
  [/^Buổi(?:\s+học|\s+thứ)?\s+(\d+\/\d+|\d+)$/i, 'Session $1'],
  [/^Nấc\s+(\d+)\s*·\s*(.+)$/i, (_, n, t) => `Step ${n} · ${translateCore(t, 1)}`],
  [/^Bước\s+(\d+(?:\/\d+)?)(.*)$/i, (_, b, tail) => `Step ${b}${tail ? ` ${translateCore(tail.trim(), 1)}` : ''}`],
  [/^Cấp\s+(\d+)$/i, 'Level $1'],
  [/^Lên cấp\s+(\d+):\s*(.+)$/i, (_, lv, t) => `Level Up ${lv}: ${translateCore(t, 1)}`],
  [/^Phần\s+(\d+)$/i, 'Part $1'],

  // ─ Gói học, Thanh toán, Nhãn Key:Value ─
  [/^Gói\s+(\d+)\s*tháng$/i, '$1-Month Plan'],
  [/^Gói\s+(\d+)\s*năm$/i, '$1-Year Plan'],
  [/^Gói\s+(\d+)\s*tuần$/i, '$1-Week Plan'],
  [/^Gói\s+Meet\s+(.+)$/i, (_, p) => `Meet Plan ${translateCore(p, 1)}`],
  [/^Gói\s+(.+)$/i, (_, g) => {
    const low = g.trim().toLowerCase();
    if (low.includes('khóa học')) return 'Course Plan';
    if (low.includes('vĩnh viễn')) return 'Lifetime Plan';
    return `${translateCore(g, 1)} Plan`;
  }],
  [/^(\d+(?:[–-]\d+)?)\s*XP\s+mỗi\s+ngày$/i, '$1 XP/day'],
  [/^(\d+(?:[–-]\d+)?)\s*XP\s+mỗi\s+tháng$/i, '$1 XP/month'],
  [/^(\d+(?:[–-]\d+)?)\s*XP\s+tặng\s+kèm$/i, '$1 bonus XP'],
  [/^(\d+)\s*XP\s+(?:mỗi ngày|mỗi tháng|tặng kèm)\s+khi gói còn hạn$/i, '$1 XP/day while plan is active'],
  [/^Hết hạn thì tài khoản\s+(?:miễn phí|Dewskill)\s+về\s+(\d+)\s*XP\s*(?:mỗi ngày|mỗi tháng|tặng kèm)\.?$/i, 'Reverts to $1 XP/day on free tier after expiry'],
  [/^mỗi ngày có\s+(.+?)\s*XP$/i, '$1 XP/day'],
  [/^mỗi tháng có\s+(.+?)\s*XP$/i, '$1 XP/month'],
  [/^nhận\s+(.+?)\s*XP\s+tặng\s+kèm$/i, 'get $1 bonus XP'],
  [/^Thanh toán hoặc nhập mã đều kích hoạt gói Meet\..*$/i, 'Pay or redeem a code to activate your Meet Plan. Time stacks onto your current expiry, and purchased XP is always kept.'],
  [/^([\d.,]+)\s*TB$/i, '$1 Avg'],
  [/^Mua gói\s+(.+)$/i, (_, g) => `Get ${translateCore(g, 1)}`],
  [/^Gia hạn(?:\s+gói)?\s+(.+)$/i, (_, g) => `Renew ${translateCore(g, 1)}`],
  [/^Thanh toán gói\s+(.+)$/i, (_, g) => `Pay for ${translateCore(g, 1)}`],
  [/^Đăng ký gói\s+(.+)$/i, (_, g) => `Subscribe to ${translateCore(g, 1)}`],
  [/^Hạn:\s*(.+?)\s*·\s*còn\s*(\d+)\s*ngày$/i, 'Expires: $1 · $2 days left'],
  [/^Hạn(?:\s+(?:đến|nộp|chót|hiện tại))?\s*:\s*(.+)$/i, 'Due: $1'],
  [/^Đã hết hạn\s+(.+)$/i, 'Expired on $1'],
  [/^Hết hạn\s+(.+)$/i, 'Expired $1'],
  [/^Mở sau:\s*(.+)$/i, 'Opens in: $1'],
  [/^Hết hạn sau:\s*(.+)$/i, 'Closes in: $1'],
  [/^Chủ đề\s*[:·]\s*(.+)$/i, (_, rest) => `Topic: ${translateCore(rest, 1)}`],
  [/^Giảng viên\s*[:·]\s*(.+)$/i, (_, rest) => `Teacher: ${translateCore(rest, 1)}`],
  [/^Học viên\s*[:·]\s*(.+)$/i, (_, rest) => `Student: ${translateCore(rest, 1)}`],
  [/^GV\s*[:·]\s*(.+)$/i, (_, rest) => `Teacher: ${translateCore(rest, 1)}`],
  [/^Môn(?:\s+học)?\s*[:·]\s*(.+)$/i, (_, rest) => `Subject: ${translateCore(rest, 1)}`],
  [/^Khóa(?:\s+học)?\s*[:·]\s*(.+)$/i, (_, rest) => `Course: ${translateCore(rest, 1)}`],
  [/^Lớp\s*[:·]\s*(.+)$/i, (_, rest) => `Class: ${translateCore(rest, 1)}`],
  [/^Lịch\s*[:·]\s*(.+)$/i, (_, rest) => `Schedule: ${translateCore(rest, 1)}`],
  [/^Lịch tới:\s*(.+)$/i, (_, rest) => `Next class: ${translateCore(rest, 1)}`],
  [/^Lịch Meet tới:\s*(.+)$/i, (_, rest) => `Next Meet: ${translateCore(rest, 1)}`],
  [/^Buổi tới:\s*(.+)$/i, (_, rest) => `Next class: ${translateCore(rest, 1)}`],
  [/^Ca tới:\s*(.+)$/i, (_, rest) => `Next session: ${translateCore(rest, 1)}`],
  [/^Đang dạy:\s*(.+)$/i, (_, rest) => `Teaching: ${translateCore(rest, 1)}`],
  [/^Đang học:\s*(.+)$/i, (_, rest) => `Studying: ${translateCore(rest, 1)}`],
  [/^Tiếp theo:\s*(.+)$/i, (_, rest) => `Next: ${translateCore(rest, 1)}`],
  [/^Học tiếp:\s*(.+)$/i, (_, rest) => `Continue: ${translateCore(rest, 1)}`],
  [/^Học tiếp\s*:\s*(.+)$/i, (_, rest) => `Continue: ${translateCore(rest, 1)}`],
  [/^Hỏi trợ lý:\s*(.+)$/i, 'Ask Assistant: $1'],
  [/^Trả lời:\s*(.+)$/i, 'Reply: $1'],
  [/^Trả lời\s+(.+)$/i, 'Reply $1'],
  [/^Đang trả lời\s+(.+)$/i, 'Replying to $1'],
  [/^Ghi chú:\s*(.+)$/i, 'Note: $1'],
  [/^Góp ý:\s*(.+)$/i, 'Feedback: $1'],
  [/^Nhận xét:\s*(.+)$/i, 'Comment: $1'],
  [/^Lý do:\s*(.+)$/i, 'Reason: $1'],
  [/^Lý do chuyển:\s*(.+)$/i, 'Transfer reason: $1'],
  [/^Lưu ý:\s*(.+)$/i, 'Note: $1'],
  [/^Trọng tâm:\s*(.+)$/i, 'Key focus: $1'],
  [/^Trạng thái:\s*(.+)$/i, (_, rest) => `Status: ${translateCore(rest, 1)}`],
  [/^Chi nhánh:\s*(.+)$/i, 'Branch: $1'],
  [/^Bộ phận:\s*(.+)$/i, 'Department: $1'],
  [/^Chuyên môn:\s*(.+)$/i, 'Specialty: $1'],
  [/^Kinh nghiệm:\s*(.+)$/i, 'Experience: $1'],
  [/^Phụ trách:\s*(.+)$/i, 'Managed by: $1'],
  [/^Thời lượng:\s*(.+)$/i, (_, rest) => `Duration: ${translateCore(rest, 1)}`],
  [/^Hình thức:\s*(.+)$/i, (_, rest) => `Format: ${translateCore(rest, 1)}`],
  [/^Học phí:\s*(.+)$/i, 'Tuition: $1'],
  [/^Giờ\s*[:·]\s*(.+)$/i, 'Time: $1'],
  [/^Ngày cấp\s*:\s*(.+)$/i, 'Issued: $1'],
  [/^Ngày nộp\s*:\s*(.+)$/i, 'Submitted: $1'],
  [/^Điểm(?:\s+TB)?\s*:\s*(.+)$/i, 'Score: $1'],
  [/^Loại\s*:\s*(.+)$/i, (_, rest) => `Grade: ${translateCore(rest, 1)}`],
  [/^Mã(?:\s+(?:CN|CC|HĐ|xác thực))?\s*:\s*(.+)$/i, (_, rest) => `Code: ${translateCore(rest, 1)}`],
  [/^Mức(?:\s+độ)?\s+([A-Za-zÀ-ỹ]+)$/i, (_, lvl) => `Level ${translateCore(lvl, 1)}`],
  [/^Đáp án đúng:\s*(.+)$/i, 'Correct answer: $1'],
  [/^Đáp án\s+([A-Za-z0-9]+)$/i, 'Option $1'],
  [/^HOÀN THÀNH CHẶNG\s*·\s*(.+)$/i, 'STAGE COMPLETED · $1'],
  [/^Hoàn thành chặng\s*·\s*(.+)$/i, 'Stage Completed · $1'],
  [/^XONG MỨC\s+(.+)$/i, (_, lvl) => `COMPLETED ${translateCore(lvl, 1).toUpperCase()}`],
  [/^Tiến độ học tập\s*\((.+)\)$/i, (_, lvl) => `Study Progress (${translateCore(lvl, 1)})`],
  [/^Tiếp\s*:\s*(.+)$/i, (_, rest) => `Next: ${translateCore(rest, 1)}`],
  [/^Ôn lại\s*·\s*(.+)$/i, (_, rest) => `Review · ${translateCore(rest, 1)}`],
  [/^(.+?)\s*·\s*Ôn lại$/i, (_, lvl) => `${translateCore(lvl, 1)} · Review`],
  [/^Chạm vào\s+mốc\s+(.+)$/i, 'Tap milestone $1'],
  [/^Đang xem tại\s+(.+)$/i, 'Watching at $1'],
  [/^Mở rộng\s+(.+)$/i, 'Expand $1'],
  [/^Còn lại:\s*(.+)$/i, (_, rest) => `Remaining: ${translateCore(rest, 1)}`],
  [/^Thời gian:\s*(.+)$/i, (_, rest) => `Duration: ${translateCore(rest, 1)}`],
  [/^Bắt đầu:\s*(.+)$/i, 'Started: $1'],
  [/^Nộp bài:\s*(.+)$/i, 'Submitted: $1'],
  [/^Thời gian làm(?:\s+bài)?:\s*(.+)$/i, (_, rest) => `Time spent: ${translateCore(rest, 1)}`],
  [/^Thời gian giới hạn:\s*(.+)$/i, (_, rest) => `Time limit: ${translateCore(rest, 1)}`],
  [/^Đã hoàn thành:\s*(.+)$/i, 'Completed: $1'],
  [/^Tổng\s+(\d+)\s*buổi$/i, 'Total $1 sessions'],
  [/^BẢNG KÊ THU NHẬP\s+(.+)$/i, (_, m) => `INCOME STATEMENT ${translateCore(m, 1).toUpperCase()}`],
  [/^Lưu bảng kê\s+(.+)$/i, (_, m) => `Save statement ${translateCore(m, 1)}`],
  [/^Chờ\s+(\d+)h$/i, 'Wait $1h'],
  [/^Phiên bản\s+([^\s•]+)\s*•\s*Kênh\s+(.+)$/i, 'Version $1 • Channel $2'],
  [/^(\d+)\/3 thiết bị được phép\s*•\s*Bảo vệ tài khoản$/i, '$1/3 authorized devices • Account protection'],
  [/^Hệ thống tự động ghi nhớ tối đa 3 thiết bị quen thuộc \((\d+)\/3 đang dùng\) để bảo vệ tiến độ học tập và ngăn đăng nhập trái phép\.$/i, 'Automatically remembers up to 3 trusted devices ($1/3 in use) to protect your progress and block unauthorized logins.'],

  // ─ Thành tích Share & Chúc mừng ─
  [/^Đạt (\d+)% bài luyện tập!$/i, 'Scored $1% in practice!'],
  [/^Đạt 100% hoàn hảo tại DewSkill!$/i, 'Scored a perfect 100% on DewSkill!'],
  [/^Hoàn thành lượt luyện tập đạt (\d+)%!$/i, 'Completed DewSkill practice with $1%!'],
  [/^Chinh phục trọn vẹn lộ trình (.+)!$/i, 'Conquered the entire "$1" learning path!'],
  [/^Vượt qua xuất sắc (.+)!$/i, 'Passed "$1" with flying colors!'],
  [/^Hoàn thành bước (.+) tại DewSkill!$/i, (_, lvl) => `Completed ${translateCore(lvl, 1)} step on DewSkill!`],
  [/^Tôi vừa mở rương hoàn thành (.+)!$/i, 'I just unlocked the reward chest for $1!'],
  [/^Tôi đã chinh phục cả 3 cấp độ bài "(.+)"!$/i, 'I mastered all 3 levels of "$1"!'],
  [/^Hoàn thành mức ([^\s]+) bài "(.+)"!$/i, (_, l, n) => `Completed ${translateCore(l, 1)} level of "${n}"!`],
  [/^Kết quả kiểm tra năng lực Tin học:\s*(.+)!$/i, 'IT Placement Result: $1!'],
  [/^Hoàn hảo 100% bài "(.+)"!$/i, 'Perfect 100% on "$1"!'],
  [/^Đã hoàn thành bài luyện tập "(.+)"!$/i, 'Completed practice "$1"!'],
  [/^Tôi đã thi đạt "(.+)" tại Thắng Tin Học!$/i, 'I passed "$1" at Thang Tin Hoc!'],
  [/^Tôi vừa hoàn thành bài thi "(.+)"!$/i, 'I just finished "$1"!'],
  [/^(.+?) đã hoàn thành (?:môn học|khóa học) "(.+)"!$/i, '$1 completed "$2"!'],
  [/^Tôi đã hoàn thành (?:môn học|khóa học) "(.+)" tại Thắng Tin Học!$/i, 'I completed "$1" at Thang Tin Hoc!'],
  [/^Thống kê DewSkill · Thắng Tin Học · (.+)$/i, 'DewSkill Stats · Thang Tin Hoc · $1'],
  [/^Tài khoản hết hạn · (.+)$/i, 'Account expired · $1'],

  // ─ Trợ lý AI & Hộp thư Hỗ trợ ─
  [/^Xin chào\s+(.+?)!\s*Mình là Trợ lý AI Tin Học của Thắng Tin Học\.\s*Mình hỗ trợ Word, Excel, PowerPoint, MOS, LMS và học tập\.\s*Bạn hỏi gì về tin học cũng được nhé!$/i, (_, who) => `Hello ${/^(bạn|học viên)$/i.test(who.trim()) ? 'there' : who.trim()}! I am the Office IT AI Assistant at Thang Tin Hoc. I can help with Word, Excel, PowerPoint, MOS, LMS, and your studies. Feel free to ask me any IT question!`],
  [/^Xin chào\s+(.+?)!\s*Em là Trợ lý AI Tin Học của Thắng Tin Học\.\s*Em hỗ trợ Word, Excel, PowerPoint, MOS, LMS và giảng dạy\.\s*Thầy\/Cô hỏi gì ạ\?$/i, (_, who) => {
    const clean = who.replace(/^Thầy\/Cô\s*/i, '').trim();
    return `Hello ${clean || 'Instructor'}! I am the Office IT AI Assistant at Thang Tin Hoc. I can help with Word, Excel, PowerPoint, MOS, LMS, and teaching. How can I assist you today?`;
  }],
  [/^Em là Trợ lý AI Tin Học của Thắng Tin Học\.\s*Câu hỏi này nằm ngoài phạm vi em hỗ trợ\.?$/i, 'I am the Office IT AI Assistant at Thang Tin Hoc. This question is outside my scope of support.'],
  [/^Trợ lý AI đang bận\.\s*Bạn chọn "Cần nhân viên hỗ trợ" bên dưới nếu muốn gặp người thật\.?$/i, 'AI Assistant is currently busy. Tap "Need Support Agent" below to chat with our staff.'],
  [/^Trợ lý AI chưa kết nối được Gemini.*$/i, 'AI Assistant cannot connect to Gemini right now. You can tap "Need Support Agent" below to speak with a support specialist.'],
  [/^Xin lỗi, mình chưa trả lời được lúc này\.\s*Bạn thử hỏi lại giúp mình nhé\.?$/i, 'Sorry, I could not generate a reply right now. Please try asking again.'],
  [/^Bạn đã hết\s+(\d+)\s*lượt hỏi Trợ lý AI hôm nay\..*$/i, 'You have used all $1 AI Assistant questions for today. Tap **Need Support Agent** below for live help, or ask AI again tomorrow.'],
  [/^Em không tạo hình ảnh\.\s*Bạn gửi ảnh màn hình Word, Excel hoặc PowerPoint nếu cần em xem giúp\.?$/i, 'I do not generate images. You can send a screenshot of Word, Excel, or PowerPoint if you need help troubleshooting.'],
  [/^Em chỉ hướng dẫn cách làm.*Em không viết hộ tiểu luận, báo cáo hay văn bản hành chính\.?$/i, 'I only provide step-by-step guidance and outlines. I do not ghostwrite essays, reports, or administrative documents.'],
  [/^Phiên hỗ trợ đã kết thúc\.?$/i, 'Support session has ended.'],
  [/^Phiên hỗ trợ với Trợ lý AI đã kết thúc\.?$/i, 'AI Assistant support session has ended.'],
  [/^Phiên trả lời với Trợ lý AI đã kết thúc\.?$/i, 'AI Assistant session has ended'],
  [/^Xin chào, hẹn gặp lại bạn\.?$/i, 'Goodbye! See you next time.'],
  [/^Đã chuyển yêu cầu tới nhân viên hỗ trợ\..*$/i, 'Your request has been transferred to a support agent. You can continue messaging here — our staff will review the conversation.'],
  [/^Nhân viên hỗ trợ\s+(.+?)\s+đã tiếp nhận yêu cầu\.?$/i, 'Support agent $1 has joined the conversation.'],
  [/^Vấn đề đã được xử lý\.\s*Bạn có thể tiếp tục dùng Trợ lý AI nếu cần\.?$/i, 'Your request has been resolved. You can continue using the AI Assistant anytime.'],
  [/^\*\*Bước\s+(\d+):\*\*\s*(.+)$/i, (_, n, rest) => `**Step ${n}:** ${translateCore(rest, 1)}`],
  [/^Bước\s+(\d+):\s*(.+)$/i, (_, n, rest) => `Step ${n}: ${translateCore(rest, 1)}`],

  // ─ Bổ sung toàn bộ Template Học viên, Giảng viên, Tin nhắn, LMS & Luyện tập ─
  [/^Sắp đến giờ vào lớp! \(Còn (\d+) phút\)$/i, 'Class starts soon! ($1 min left)'],
  [/^CÒN (\d+) PHÚT - Vào lớp ngay!$/i, '$1 MIN LEFT — Join Class Now!'],
  [/^Có bài viết mới:\s*['"“]?(.+?)['"”]?$/i, 'New feed post: "$1"'],
  [/^Tranh chấp điểm danh:\s*(.+?)\s*-\s*buổi\s*(.+?)\.?\s*(.*)$/i, 'Attendance dispute: $1 — Session $2. $3'],
  [/^Lớp tới:\s*(.+)$/i, (_, rest) => `Next class: ${translateCore(rest, 1)}`],
  [/^Còn (\d+) lần,\s*lần sau bài thi sẽ bị hủy\.?$/i, '$1 warnings left — next time cancels exam.'],
  [/^- còn (\d+) lần,\s*lần sau bài thi sẽ bị hủy\.?$/i, '— $1 warnings left before exam cancellation.'],
  [/^Đã dán (\d+) ảnh xem trước\.?$/i, 'Pasted $1 preview image(s).'],
  [/^Đã chỉnh sửa lúc\s+(.+)$/i, 'Edited at $1'],
  [/^Đã chỉnh sửa$/i, 'Edited'],
  [/^Chat với\s+(.+?)\.\s*Có thể gửi ảnh.*$/i, 'Chat with $1. Send images, screenshots, or links.'],
  [/^Bạn đã hết (\d+) lượt hỏi và (\d+) lượt gửi ảnh hôm nay\.?$/i, 'Daily limit reached ($1 AI queries & $2 photos used).'],
  [/^Bạn đã hết (\d+) lượt hỏi AI hôm nay\.?$/i, 'Reached today’s limit of $1 AI questions.'],
  [/^Bạn đã hết (\d+) lượt gửi ảnh hôm nay\.?$/i, 'Reached today’s limit of $1 photos.'],
  [/^Hết (\d+) ảnh hôm nay\s*-\s*ngày mai gửi tiếp$/i, 'Used all $1 photos today — try again tomorrow'],
  [/^Hết (\d+) lượt hỏi AI hôm nay$/i, 'Used all $1 AI questions today'],
  [/^Mã xác thực đã được gửi tới\s+(.+)$/i, 'Verification code sent to $1'],
  [/^Đã gửi lại mã mới tới\s+(.+)$/i, 'Resent new code to $1'],
  [/^Đã dọn (\d+) tin nhắn từ tài khoản đã xóa$/i, 'Cleaned $1 messages from deleted accounts'],
  [/^(.+?)\s+đã ghim\s+(.+?)\.?$/i, '$1 pinned $2.'],
  [/^(.+?)\s+đã bỏ ghim\s+(.+?)\.?$/i, '$1 unpinned $2.'],
  [/^Nhóm ["“](.+)["”] đã bị giải tán\.?$/i, 'Group "$1" has been disbanded.'],
  [/^File quá lớn\.\s*Giới hạn\s+(.+?)\.?$/i, 'File too large. Limit: $1.'],
  [/^Đã gửi tệp:\s*(.+)$/i, 'Sent file: $1'],
  [/^Không tải được tệp\s*\(HTTP\s*(\d+)\)\.?$/i, 'Failed to download file (HTTP $1).'],
  [/^\((\d+) tin với Trợ lý AI\)$/i, '($1 messages with AI Assistant)'],
  [/^Hiển thị thêm (\d+) tin nhắn với Trợ lý AI$/i, 'Show $1 more AI Assistant messages'],
  [/^Cảm xúc\s+(.+?),\s*(\d+)$/i, (_, e, c) => `${translateCore(e, 1)}, ${c}`],
  [/^Cảm xúc\s+(.+)$/i, (_, e) => `Reaction: ${translateCore(e, 1)}`],
  [/^Trợ lý bài ["“](.+)["”]$/i, 'Lesson AI Tutor "$1"'],
  [/^Xin chào! Mình là Trợ lý AI cho ["“](.+)["”]$/i, 'Hi! I’m the AI Tutor for "$1"'],
  [/^Ghi chú nhanh tại mốc\s+(.+?)(?:\.{3}|…)?$/i, 'Quick note at $1…'],
  [/^Tua video đến\s+(.+)$/i, 'Jump video to $1'],
  [/^Phản hồi\s*·\s*(.+)$/i, (_, rest) => `Feedback · ${translateCore(rest, 1)}`],
  [/^Chào mừng\s+(.+?):\s*(.+?)!?$/i, (_, role, name) => `Welcome ${translateCore(role, 1)}: ${name}!`],
  [/^Đã chèn (\d+) ảnh vào bài$/i, 'Inserted $1 image(s)'],
  [/^Đã đính kèm (\d+) tệp$/i, 'Attached $1 file(s)'],
  [/^Xóa bài viết ["“](.+)["”]\?$/i, 'Delete post "$1"?'],
  [/^Mã PIN không đúng\.\s*Còn (\d+) lần thử\.?$/i, 'Incorrect PIN. $1 attempts remaining.'],
  [/^(.+?),\s*nhập mã PIN để mở khóa$/i, '$1, enter PIN to unlock'],
  [/^Đã nhập (\d+) trên (\d+) số$/i, 'Entered $1 of $2 digits'],
  [/^Số (\d+)$/i, 'Digit $1'],
  [/^Chèn emoji\s+(.+)$/i, 'Insert emoji $1'],
  [/^Gửi sticker:\s*(.+)$/i, 'Send sticker: $1'],
  [/^Ghép\s+(.+)$/i, 'Match $1'],
  [/^(\d+)\/(\d+)\s*đã làm$/i, '$1/$2 answered'],
  [/^(\d+)\/(\d+)\s*đã trả lời$/i, '$1/$2 answered'],
  [/^Bạn đã làm:\s*(\d+)\s*\/\s*(\d+)\s*lần$/i, 'Attempts used: $1/$2'],
  [/^Chinh phục thành công\s+(.+?)!?$/i, 'Successfully conquered $1!'],
  [/^Xuất sắc! Bạn đã mở khóa Chặng\s*(\d+):\s*(.+?)\.?$/i, 'Awesome! Unlocked Unit $1: $2.'],
  [/^Đã mở khóa Chặng\s*(\d+):\s*(.+)$/i, 'Unlocked Unit $1: $2'],
  [/^(\d+) CÂU ĐÚNG LIÊN TIẾP\s*[–-]\s*KHÔNG THỂ CẢN PHÁ!.*$/i, '$1 CORRECT IN A ROW — UNSTOPPABLE! ⚡'],
  [/^mục tiêu\s+([\d.,]+)\s*giờ\/ngày$/i, 'goal $1h/day'],
  [/^còn\s+(\d+)\s*ngày$/i, '$1 days left'],
  [/^(.+?):\s*Đã hoàn thành\s*\(Chuỗi (\d+) ngày\)$/i, '$1: Completed ($2-day streak)'],
  [/^(.+?):\s*Hôm nay\s*\(Chưa hoàn thành lượt luyện\)$/i, '$1: Today (Practice pending)'],
  [/^Bạn có (\d+) câu từng làm sai đã tới lịch nhắc lại hôm nay\s*\(tổng (\d+) câu đang theo dõi\)\.?$/i, 'You have $1 missed questions due for review today ($2 tracked total).'],
  [/^Chưa có câu đến hạn hôm nay\s*\((\d+) câu sẽ nhắc lại(.*?)\)\.?\s*Bạn vẫn có thể ôn sớm ngay!?$/i, 'None due today ($1 upcoming$2). Review early anytime!'],
  [/^Ôn tập ngay\s*\((\d+) câu\)$/i, 'Review Now ($1 questions)'],
  [/^Đây là lượt bắt buộc\.\s*Thoát bây giờ bạn mất thêm XP còn lại\s*\(tối đa [−-](\d+) XP cho các câu chưa làm\)\.?$/i, 'Mandatory round. Exiting now loses up to −$1 XP on remaining questions.'],
  [/^Thoát bây giờ bạn mất thêm XP\s*\(tối đa [−-](\d+) XP\)\.?$/i, 'Exiting now deducts extra XP (up to −$1 XP).'],
  [/^Thoát và mất tối đa (\d+) XP$/i, 'Exit & Lose up to $1 XP'],
  [/^Đây là lượt bắt buộc\.\s*Tải lại trang lúc này sẽ hủy lượt luyện tập và mất thêm XP còn lại\s*\(tối đa [−-](\d+) XP cho các câu chưa làm\)\.?$/i, 'Mandatory round. Reloading now cancels the session and loses up to −$1 XP on remaining questions.'],
  [/^Tải lại trang lúc này sẽ hủy lượt luyện tập và mất thêm XP\s*\(tối đa [−-](\d+) XP\)\.?$/i, 'Reloading now cancels the session and deducts up to −$1 XP.'],
  [/^Lượt luyện tập vẫn đang mở\.\s*Nếu hủy lượt lúc này,\s*bạn sẽ mất tối đa [−-](\d+) XP cho các câu chưa làm\.\s*Chọn "Tiếp tục làm bài" để làm tiếp mà không mất thêm XP\.?$/i, 'Your practice session is still open. Canceling now loses up to −$1 XP on remaining questions. Select "Continue Practice" to resume without losing XP.'],
  [/^Tải lại trang và mất tối đa (\d+) XP$/i, 'Reload & Lose up to $1 XP'],
  [/^Hủy lượt và mất tối đa (\d+) XP$/i, 'Cancel & Lose up to $1 XP'],
  [/^Mất tối đa [−-](\d+) XP nếu tải lại$/i, 'Up to −$1 XP penalty if reloading'],
  [/^Mất tối đa [−-](\d+) XP nếu hủy lượt$/i, 'Up to −$1 XP penalty if canceling'],
  [/^Bạn vừa tải lại hoặc rời trang khi đang luyện\.\s*Lượt đó đã bị hủy\s*\(có thể mất tối đa [−-](\d+) XP\)\.\s*(?:Lần sau bấm Thoát hoặc F5 để xác nhận trước khi rời|Lần sau xác nhận trước khi rời)\.?$/i, 'You reloaded or left during practice. That session was canceled (up to −$1 XP lost). Please confirm via Exit next time.'],
  [/^Đây là lượt bắt buộc\.\s*Tải lại trang lúc này sẽ hủy lượt và mất tối đa [−-](\d+) XP\.?$/i, 'Mandatory round. Reloading now cancels the session and loses up to −$1 XP.'],
  [/^Tải lại trang lúc này sẽ hủy lượt luyện tập và mất tối đa [−-](\d+) XP\.?$/i, 'Reloading now cancels the practice session and loses up to −$1 XP.'],
  [/^Tải lại và mất tối đa (\d+) XP$/i, 'Reload & Lose up to $1 XP'],
  [/^Xóa mốc "(.+)"\?$/i, 'Delete milestone "$1"?'],
  [/^Xóa chặng "(.+)"\?\s*Câu hỏi trong chặng sẽ chuyển về "Chưa xếp chặng",\s*tiến độ học viên ở chặng này bị xóa\.?$/i, 'Delete unit "$1"? Its questions will move to "Unassigned" and learner progress for this unit will be removed.'],
  [/^Xóa chủ đề "(.+)" và toàn bộ câu hỏi trong đó\?$/i, 'Delete topic "$1" and all of its questions?'],
  [/^Xóa "(.+)" khỏi tài nguyên tài khoản miễn phí\?$/i, 'Delete "$1" from free account resources?'],
  [/^Xóa câu hỏi "(.+)"\?$/i, 'Delete question "$1"?'],
  [/^Thu hồi mã (\S+)\?\s*Mã sẽ không dùng được nữa\.?$/i, 'Revoke code $1? It will no longer be usable.'],
  [/^Tổng (\d+) XP\s*·\s*(\d+) XP đang cược.*$/i, 'Total $1 XP · $2 XP staked. Pass to earn it back!'],
  [/^Ví (\d+) XP\s*·\s*(\d+) XP\/câu,\s*sai trừ ngay\s*·\s*đạt nhận \+(\d+)\/câu đúng$/i, 'Wallet $1 XP · $2 XP/q (-XP on wrong, +$3/correct if passed)'],
  [/^Phục hồi\s*·\s*đạt nhận tối đa (\d+) XP$/i, 'Recovery · pass to earn up to $1 XP'],
  [/^Gợi ý,\s*trừ ngay\s*[−-]?(\d+) XP$/i, 'Hint (−$1 XP)'],
  [/^Gợi ý thêm\s*·\s*(\d+) XP$/i, 'Extra Hint · $1 XP'],
  [/^Bài tập này yêu cầu (\d+) XP.*Hiện bạn chỉ có (\d+) XP trong ví\..*$/i, 'Requires $1 XP (you have $2 XP). Upgrade your plan or top up XP to continue!'],
  [/^Đặt (\d+) XP\..*$/i, 'Stake $1 XP. Pass the stage to reclaim your stake; quitting or failing forfeits it.'],
  [/^Mỗi câu (\d+) XP:.*nhận \+(\d+) XP\/câu đúng\.?$/i, '$1 XP/q: wrong deducts immediately; passing awards +$2 XP per correct answer.'],
  [/^Gói của bạn còn (\d+) ngày nữa là hết$/i, 'Your plan expires in $1 days'],
  [/^Nhận (.+?) luyện tập$/i, 'Get $1 practice XP'],
  [/^Hết hạn tài khoản Dewskill về (\d+) XP\s*(.*)$/i, 'Expired free tier resets to $1 XP $2'],
  [/^Mất (\d+) XP\.?$/i, 'Lost $1 XP.'],
  [/^Cảnh báo mất (\d+) XP$/i, 'Warning: Lose $1 XP'],
  [/^Bỏ qua câu hỏi mốc video này sẽ bị trừ (\d+) XP để tiếp tục xem\.\s*Bạn có chắc muốn bỏ qua\?$/i, 'Skipping this video checkpoint costs $1 XP. Are you sure?'],
  [/^Bỏ qua\s*\([−-](\d+) XP\)$/i, 'Skip (−$1 XP)'],
  [/^AI chưa chấp nhận\.?(.*)$/i, (_, rest) => `Not accepted by AI.${rest ? ` ${translateCore(rest, 1)}` : ''}`],
  [/^Chưa đúng ý\.?(.*)$/i, (_, rest) => `Not quite right.${rest ? ` ${translateCore(rest, 1)}` : ''}`],
  [/^Chưa đúng\.?(.*)$/i, (_, rest) => `Incorrect.${rest ? ` ${translateCore(rest, 1)}` : ''}`],
  [/^Đúng lần đầu \+(\d+) XP(?: và xem tiếp|\s*·\s*Sai [−-](\d+) XP rồi (.+))\.?$/i, 'First try +$1 XP! Wrong deducts XP before retry.'],
  [/^Video luyện tập\s*·\s*(.+)$/i, 'Practice Video · $1'],
  [/^(\d+)\/(\d+) mốc đã mở(.*)$/i, '$1/$2 milestones unlocked'],
  [/^Video chặng\s+(\d+)$/i, 'Unit $1 Video'],
  [/^Đã xong\s*·\s*Ôn lại\s*\(0 XP\)\s*·\s*cần đúng (\d+)%$/i, 'Completed · Free Review (0 XP) · pass ≥ $1%'],
  [/^Cần đúng (\d+)%\s*·\s*(\d+) XP\/câu$/i, 'Pass ≥ $1% · $2 XP/q'],
  [/^Chặng (\d+)\s*·\s*Đạt (\d+)% để vượt chặng$/i, 'Unit $1 · Score $2% to pass'],
  [/^Bước (\d+)\/(\d+)\s*·\s*Cần đúng (\d+)%$/i, 'Step $1/$2 · Pass ≥ $3%'],
  [/^Đạt thì được (\d+) XP và vượt chặng\.\s*Không đạt hoặc thoát thì mất (\d+) XP\.?$/i, 'Pass to win $1 XP & unlock unit. Fail/exit forfeits $2 XP.'],
  [/^(\d+) XP\/câu\s*·\s*Đạt % yêu cầu nhận \+(\d+) XP\/câu đúng.*$/i, '$1 XP/q · Pass target earns +$2 XP/correct (free review).'],
  [/^(\d+)\/câu$/i, '$1/question'],
  [/^Cúp Vàng Danh Dự\s*-\s*(.+)$/i, 'Honor Gold Trophy — $1'],
  [/^Chưa qua\s+(.+)$/i, 'Did not pass $1'],
  [/^Bạn đạt (\d+)%\s*\(cần (\d+)%\)\.\s*Mất (\d+) XP\..*$/i, 'Scored $1% (need $2%). Lost $3 XP — review and retry!'],
  [/^Bạn đạt (\d+)%,\s*cần từ (\d+)%\.\s*Sai [−-](\d+)\/câu.*$/i, 'Scored $1% (need ≥$2%). Missed −$3/q. Try again!'],
  [/^Đã hoàn thành đến chặng ["“](.+)["”]\.\s*Bạn được \+(\d+) XP\.?$/i, 'Completed up to "$1"! Earned +$2 XP.'],
  [/^Hoàn thành chặng ["“](.+)["”]!$/i, 'Completed Unit "$1"!'],
  [/^Qua bước\s+(.+)$/i, (_, r) => `Passed step ${translateCore(r, 1)}`],
  [/^Bước tiếp theo:\s*(.+)$/i, (_, r) => `Next step: ${translateCore(r, 1)}`],
  [/^Đã mở rương\s*·\s*\+(\d+) XP$/i, 'Chest Opened · +$1 XP'],
  [/^Mở rương chặng\s*·\s*\+(\d+) XP$/i, 'Open Unit Chest · +$1 XP'],
  [/^Đã mở rương chặng,\s*\+(\d+) XP$/i, 'Opened unit chest, +$1 XP'],
  [/^Mở rương chặng,\s*nhận (\d+) XP$/i, 'Open unit chest, claim $1 XP'],
  [/^Rương phần thưởng chặng(.*)$/i, 'Unit Reward Chest$1'],
  [/^Chúc mừng nhận (\d+) XP rương chặng$/i, 'Congrats! Claimed $1 XP from unit chest'],
  [/^✨?\s*(\d+) XP đã được cộng vào tài khoản của bạn!$/i, '✨ $1 XP added to your wallet!'],
  [/^Đang tải ảnh lên\s*(\d+)%$/i, 'Uploading image $1%'],
  [/^TIẾN ĐỘ:\s*(\d+)%\s*\/\s*100%$/i, 'PROGRESS: $1% / 100%'],
  [/^Chưa xong\s*\((\d+)%\)$/i, 'Incomplete ($1%)'],
  [/^Hoàn thành 100% để tải về\s*\((\d+)%\)$/i, 'Reach 100% to download ($1%)'],
  [/^Tiến độ khóa học\s*(\d+)%$/i, 'Course Progress $1%'],
  [/^Khuyến mãi kết thúc sau\s+(.+)$/i, 'Promo ends in $1'],
  [/^Tư vấn (?:Zalo khóa học|khóa học qua Zalo)\s+(.+)$/i, 'Zalo Consult: $1'],
  [/^(\d+) môn học\s*·\s*Khóa lẻ$/i, '$1 subjects · Single Course'],
  [/^Tuyệt vời! Bạn đã đúng (\d+) câu liên tiếp!$/i, 'Awesome! $1 correct in a row!'],
  [/^Chuỗi đúng(?:\s+hiện tại)?:?\s*(\d+)$/i, 'Current streak: $1'],
  [/^Tiến trình câu hỏi,\s*(\d+) trên (\d+) câu$/i, 'Question $1 of $2'],
  [/^Luyện tập(?:\s+bài học)?\s*·\s*Phần\s*(.+)$/i, 'Practice · Part $1'],
  [/^Nội dung\s+(.+)$/i, 'Content: $1'],
  [/^(\d+) XP\s*·\s*cấp tối đa$/i, '$1 XP · Max Level'],
  [/^(\d+) XP\s*·\s*(\d+)\/(\d+) tới\s+(.+)$/i, '$1 XP · $2/$3 to $4'],
  [/^(\d+) XP học bài(.*)$/i, '$1 Lesson XP$2'],
  [/^Đã cộng\s*\+(\d+) XP!?$/i, 'Added +$1 XP!'],
  [/^Đã trừ\s*[−-](\d+) XP từ ví của bạn\.?$/i, 'Deducted −$1 XP from wallet.'],
  [/^Cần (\d+) XP để xem gợi ý\.\s*Bạn hiện có (\d+) XP\.?$/i, 'Need $1 XP for hint (you have $2 XP).'],
  [/^Chính xác!\s*\+(\d+) XP$/i, 'Correct! +$1 XP'],
  [/^Khó quá bỏ qua\s*\(mất (\d+) XP\)$/i, 'Too hard? Skip (−$1 XP)'],
  [/^Ví:\s*(\d+) XP$/i, 'Wallet: $1 XP'],
  [/^Combo (\d+) câu đúng liên tiếp$/i, '$1-answer streak combo'],
  [/^\+(\d+) XP nếu ≥70%$/i, '+$1 XP if ≥70%'],
  [/^Mất tối đa [−-](\d+) XP nếu thoát$/i, 'Up to −$1 XP penalty if exiting'],
  [/^Đã làm (\d+)\/(\d+) câu\s*-\s*chỉ còn (\d+) câu nữa thôi!?$/i, 'Completed $1/$2 — only $3 left!'],
  [/^Bạn đã hoàn thành (\d+)\/(\d+) câu\.\s*(.*)$/i, (_, a, b, rest) => `Completed ${a}/${b} questions. ${translateCore(rest, 1)}`],
  [/^Bạn mới hoàn thành (\d+)\/(\d+) câu\.\s*(.*)$/i, (_, a, b, rest) => `Completed ${a}/${b} questions so far. ${translateCore(rest, 1)}`],
  [/^Bạn chưa trả lời câu nào\s*\((\d+)\/(\d+)\)\..*$/i, 'Unanswered ($1/$2). Submit anyway?'],
  [/^Đúng (\d+)\/(\d+)\s*(?:câu\s*)?·\s*Sai (\d+)(?:\s*câu)?(?:\s*·\s*(\d+)\/100 điểm)?$/i, 'Correct $1/$2 · Missed $3'],
  [/^Học viên\s+(.+?)\s+đã (?:cập nhật lại đánh giá|đánh giá bạn)\s+(.+?)\s+sao$/i, 'Student $1 rated you $2 stars'],
  [/^Học viên\s+(.+?)\s*\*\*\* đã đánh giá$/i, 'Student $1*** submitted a review'],
  [/^Đã hủy buổi học với\s+(.+?)\s+ngày\s+(.+)$/i, 'Cancelled class with $1 on $2'],
  [/^Lịch học mới:\s*(.+)$/i, 'New schedule: $1'],
  [/^Lịch học đã cập nhật\s*-\s*(.+)$/i, 'Updated schedule: $1'],
  [/^Buổi học ngày\s+(.+?)\s+đã bị hủy\.\s*Lý do:\s*(.+)$/i, 'Class on $1 cancelled. Reason: $2'],
  [/^Thông báo,\s*(\d+) chưa đọc$/i, 'Notifications, $1 unread'],
  [/^Mở thông báo,\s*(\d+) chưa đọc$/i, 'Open notifications, $1 unread'],
  [/^Mở cuộc trò chuyện với\s+(.+)$/i, 'Open chat with $1'],
  [/^Tùy chọn cuộc trò chuyện với\s+(.+)$/i, 'Chat options for $1'],
  [/^Nhắn tin với\s+(.+)$/i, 'Message $1'],
  [/^Mở hồ sơ(?:\s+học viên\s*-)?\s*(.+)$/i, 'Open student profile: $1'],
  [/^Truy cập(?:\s+lần cuối)?:?\s*(.+)$/i, (_, rest) => `Last seen: ${translateCore(rest, 1)}`],
  [/^Lần cuối:\s*(.+)$/i, (_, rest) => `Last active: ${translateCore(rest, 1)}`],
  [/^(.+?)\s+đang nhập\.{3}$/i, '$1 is typing...'],
  [/^Chọn thành viên\s*\((\d+)\)$/i, 'Select members ($1)'],
  [/^Đã thêm (\d+) thành viên vào nhóm\.?$/i, 'Added $1 members to the group.'],
  [/^Thêm (\d+) thành viên$/i, 'Add $1 members'],
  [/^Bỏ ghim\s+(.+)$/i, 'Unpin $1'],
  [/^Xem ảnh\s+(.+)$/i, 'View image $1'],
  [/^Mở tệp(?:\s+đính kèm)?\s+(.+)$/i, 'Open file $1'],
  [/^Mở tài liệu\s+(.+)$/i, 'Open material $1'],
  [/^Mở phần mềm\s+(.+)$/i, 'Open software $1'],
  [/^Đang tải & mã hóa:\s*(\d+)%$/i, 'Downloading & encrypting: $1%'],
  [/^Đã tải offline\s*\(Mã hóa\s*•\s*(.+)\)$/i, 'Saved offline (Encrypted • $1)'],
  [/^Xem đến mốc\s+(.+?)\s+để mở Câu\s+(\d+)$/i, 'Watch to $1 to unlock Q$2'],
  [/^Chính xác! Tiếp tục xem video đến mốc\s+(.+?)\s+để mở Câu\s+(\d+)\.?$/i, 'Correct! Keep watching to $1 for Q$2.'],
  [/^Tạm dừng mốc\s+(\d+)s\s*·\s*Trả lời câu hỏi bên dưới$/i, 'Paused at $1s · Answer checkpoint below'],
  [/^Câu hỏi mốc\s+(\d+)s$/i, 'Checkpoint Question ($1s)'],
  [/^ĐĂNG KÝ GÓI\s+(.+?)\s*\((.+)\)$/i, (_, p, d) => `SUBSCRIBE ${translateCore(p, 1).toUpperCase()} (${translateCore(d, 1)})`],
  [/^(\d+) ngày đạt\s*·\s*(.+)$/i, (_, n, dur) => `${n} goal days · ${translateCore(dur, 1)}`],
  [/^Quét QR \/ Meet$/i, 'QR / Meet'],
  [/^Còn (\d+) lần thanh toán khác.*$/i, '$1 more payout notice(s) waiting — close to view next.'],
  [/^Admin đã chuyển tiền hoa hồng cho bạn(.*)$/i, 'Admin transferred your commission payout$1.'],
  [/^Cần thêm (\d+) HV đánh giá 5★$/i, 'Need $1 more 5★ student reviews'],
  [/^Không xếp lịch trước ngày hôm nay\s*\((.+)\)\.?$/i, 'Cannot schedule before today ($1).'],
  [/^Đã xuất (\d+) ca sắp tới\s*\(\.ics\).*$/i, 'Exported $1 upcoming slots (.ics) from today onward.'],
  [/^Đã mở (\d+) ca sắp tới trên Google Calendar.*$/i, 'Opened $1 upcoming slots in Google Calendar.'],
  [/^Đang có (\d+) ca sắp tới sẵn sàng.*$/i, '$1 upcoming slots ready to sync & scan QR.'],
  [/^Đã ghi nhận - còn (\d+) giây để hủy điểm danh.*$/i, 'Recorded — $1s remaining to undo before counting.'],
  [/^Đã điểm danh\.\s*Mở khóa sau (\d+) tiếng\.?$/i, 'Attended. Next check-in unlocks in $1h.'],
  [/^Chọn khóa học,\s*hiện tại\s+(.+)$/i, 'Select course (current: $1)'],
  [/^Chọn sắp xếp lịch theo giờ\s+(.+)$/i, 'Sort schedule by time ($1)'],
  [/^Xem thêm (\d+) học viên$/i, 'View $1 more students'],
  [/^Không tìm thấy kết quả phù hợp cho [“"](.+)[”"]$/i, 'No results found for “$1”'],
  [/^Đã nhập (\d+) câu từ Excel$/i, 'Imported $1 questions from Excel'],
  [/^Đã soạn (\d+) câu\..*$/i, 'Drafted $1 questions. Review before creating quiz.'],
  [/^Chưa chọn học viên\s*\((\d+) HV\)$/i, 'No students selected ($1)'],
  [/^Đặt lại mật khẩu mới$/i, 'Set New Password'],
  [/^Đã sử dụng$/i, 'Used'],

  // ─ Tháng / Chương / Bước / Mức / Phiên bản / Nhãn động ─
  [/^Tháng\s+(\d+)$/i, 'Month $1'],
  [/^Chương\s+(\d+)$/i, 'Chapter $1'],
  [/^Bước\s+(\d+)(?:\s*\/\s*(\d+))?$/i, (_, a, b) => (b ? `Step ${a}/${b}` : `Step ${a}`)],
  [/^Lần\s+(\d+)$/i, 'Attempt $1'],
  [/^Xem lần\s+(\d+)$/i, 'View attempt $1'],
  [/^Bài\s+(\d+)$/i, 'Lesson $1'],
  [/^Phần\s+(\d+)(?:\s*:\s*(.+))?$/i, (_, n, rest) => (rest ? `Part ${n}: ${translateCore(rest, 1)}` : `Part ${n}`)],
  [/^Mức(?:\s+độ)?\s+([^\s:]+)(.*)$/i, (_, lvl, tail) => `Level ${translateCore(lvl, 1)}${tail ? ` ${translateCore(tail.trim(), 1)}` : ''}`],
  [/^Chặng\s+(\d+)\s*:\s*(.+)$/i, (_, n, rest) => `Unit ${n}: ${translateCore(rest, 1)}`],
  [/^Chặng\s+(\d+)\s*·\s*(.+)$/i, (_, n, rest) => `Unit ${n} · ${translateCore(rest, 1)}`],
  [/^Chặng\s+(\d+)$/i, 'Unit $1'],
  [/^Đăng ký gói(?:\s+để mở)?\s+(.+)$/i, (_, rest) => `Subscribe ${translateCore(rest, 1)}`],
  [/^Kích hoạt thành công gói\s+(.+?)!?$/i, 'Successfully activated $1!'],
  [/^Phiên bản\s+([^\s•]+)\s*•\s*Kênh\s+(.+)$/i, 'Version $1 • Channel $2'],
  [/^Phiên bản\s+(.+)$/i, 'Version $1'],
  [/^Thành lập\s+(.+)$/i, 'Founded $1'],
  [/^Hoàn thành lần lượt Dễ\s*→\s*Vừa\s*→\s*Khó\s*\((\d+\/\d+\s*mức)\)$/i, (_, r) => `Complete Easy → Medium → Hard (${translateCore(r, 1)})`],

  // ─ Tiến độ, Đếm, Mục tiêu, Thiết bị, Hạn ─
  [/^(\d+)\s*bài$/i, '$1 lessons'],
  [/^(\d+)\s*câu\s*(?:Dễ|Vừa|Khó)$/i, (m) => {
    const [, n, lv] = m.match(/^(\d+)\s*câu\s*(.+)$/i);
    return `${n} ${translateCore(lv, 1)}`;
  }],
  [/^Đủ khoảng\s*(\d+)\s*lượt luyện$/i, 'Enough for ~$1 practice runs'],
  [/^Hoàn thành\s*(\d+)\s*hoạt động học tập(.*)$/i, (_, n, tail) => `Complete ${n} study activities${tail}`],
  [/^Tiến độ mục tiêu:\s*luyện\s*(\d+)\/(\d+)\s*câu\s*(.*)$/i, (_, a, b, rest) => `Goal progress: ${a}/${b} questions ${rest.replace(/\bvideo\b/i, 'videos')}`.trim()],
  [/^Bạn:\s*hạng\s*(\d+)\s*·\s*(\d+)\s*XP$/i, 'You: Rank #$1 · $2 XP'],
  [/^Hạng của bạn:\s*#?(\d+)\s*·\s*(\d+)\s*XP$/i, 'Your rank: #$1 · $2 XP'],
  [/^Chúc mừng!?\s*Bạn lên Cấp\s*(\d+):?\s*(.*)$/i, (_, lvl, name) => `Congrats! Reached Level ${lvl}${name ? `: ${translateCore(name, 1)}` : ''}`],
  [/^Bạn đã trả lời\s*(\d+)\s*\/\s*(\d+)\s*câu\.?$/i, 'You answered $1/$2 questions.'],
  [/^Còn\s*(\d+)\s*câu chưa trả lời\.?$/i, '$1 unanswered questions left.'],
  [/^Đã làm\s*(\d+)\/(\d+)\s*câu,\s*còn\s*(\d+)\s*câu nữa thôi!?$/i, 'Completed $1/$2 — $3 left!'],
  [/^Khóa học gồm\s*(\d+)\s*môn:?$/i, 'Course includes $1 subjects:'],
  [/^Cần học ít nhất\s*(\d+)\/(\d+)\s*buổi\s*\(hiện\s*(\d+)\/(\d+)\)\.?$/i, 'Requires at least $1/$2 sessions (currently $3/$4).'],
  [/^Hoàn thành số buổi chưa đủ\s*[—-]\s*cần thi đạt tất cả\s*(\d+)\s*môn để nhận chứng nhận\.?$/i, 'More sessions needed — pass all $1 subjects to earn your certificate.'],
  [/^(\d+)\/(\d+)\s*thiết bị được phép\s*•\s*Bảo vệ tài khoản$/i, '$1/$2 authorized devices • Account protection'],
  [/^Hệ thống tự động ghi nhớ tối đa\s*(\d+)\s*thiết bị quen thuộc\s*\((\d+\/\d+)\s*đang dùng\)$/i, 'Tracks up to $1 trusted devices ($2 active)'],
  [/^Đang dùng\s*(.+)$/i, 'Active: $1'],
  [/^Khóa học đang xem\s*·\s*(\d+)\s*khóa$/i, 'Viewing course · $1 courses'],
  [/^(\d+)\s*khóa đang học$/i, '$1 active courses'],
  [/^(\d+)\s*khóa học\s*·\s*(\d+)\s*kết quả$/i, '$1 courses · $2 results'],
  [/^Tiến độ(?:\s+hiện tại)?:\s*(\d+)\/(\d+)\s*buổi$/i, 'Progress: $1/$2 sessions'],
  [/^Tiến độ khóa đang chọn:\s*(\d+)%\s*·\s*(.+)$/i, (_, p, r) => `Course progress: ${p}% · ${translateCore(r, 1)}`],
  [/^(\d+)\s*buổi ghi nhận trước$/i, '$1 prior logged sessions'],
  [/^(\d+)\s*lần thanh toán khác\s*-\s*đóng để xem tiếp\.?$/i, '$1 more payout notice(s) — close to view next.'],
  [/^Kết quả làm bài của học viên\s*\((\d+)\s*bài\)$/i, 'Student quiz submissions ($1)'],
  [/^Chỉ đồng bộ các ca từ hôm nay trở đi\s*\((\d+)\s*ngày\),\s*bỏ qua các ngày đã qua\.?$/i, 'Syncs upcoming slots ($1 days) from today, skipping past dates.'],
  [/^Sắp lịch tuần trực tiếp cho học viên\s*\((\d+)\s*khóa đang học\)$/i, 'Schedule weekly slots for student ($1 active courses)'],
  [/^Số tiền hoàn\s*\(tối đa\s*(.+?)đ\)$/i, 'Refund amount (max $1₫)'],
  [/^Hủy & hoàn\s*(.+?)đ$/i, 'Cancel & refund $1₫'],
  [/^(\d+)\/(\d+)\s*buổi$/i, '$1/$2 sessions'],
  [/^Bạn đã hoàn thành trọn vẹn\s*(\d+)\s*câu hỏi mà không hề sai một câu nào\.?.*$/i, 'You aced all $1 questions with zero mistakes. Flawless!'],
  [/^Bạn đã vượt qua toàn bộ\s*(\d+)\/(\d+)\s*câu hỏi liên tiếp.*$/i, 'You aced all $1/$2 questions in a row! Top form!'],
  [/^Bạn đã kiên trì vượt qua toàn bộ\s*(\d+)\/(\d+)\s*chặng học.*$/i, 'You conquered all $1/$2 stages! This Gold Trophy celebrates your dedication!'],
  [/^Hoàn thành đủ\s*(\d+)\s*chặng để thắp sáng Cúp Vàng Vinh Danh\s*\((\d+)\/(\d+)\s*chặng\)!?$/i, 'Complete all $1 units to unlock the Honor Gold Trophy ($2/$3)!'],
  [/^(\d+)\s*học viên đã luyện tập hôm nay.*$/i, '$1 students practiced today — don’t fall behind!'],
  [/^Bạn đã lỡ chuỗi\s*(?:🔥\s*)?(\d+)\s*ngày!?$/i, 'You missed your $1-day streak!'],
  [/^Chuỗi\s*(?:🔥\s*)?(\d+)\s*ngày sắp mất!?$/i, 'Your $1-day streak is about to expire!'],
  [/^Hạn:\s*(.+?)\s*·\s*còn\s*(\d+)\s*ngày$/i, 'Expires: $1 · $2 days left'],
  [/^Lời\s*\+(\d+)\s*XP(.*)$/i, 'Profit +$1 XP$2'],
  [/^Mất trắng\s*[−-](\d+)\s*XP$/i, 'Forfeited −$1 XP'],
  [/^Hoàn\s*(\d+)\s*XP cược\s*·\s*ví giữ nguyên(.*)$/i, 'Refunded $1 XP stake · balance unchanged$2'],
  [/^Hoàn cược\s*·\s*ví giữ nguyên(.*)$/i, 'Stake refunded · balance unchanged$1'],
  [/^Ròng\s*([−+-]?\d+)\s*XP\s*·\s*không đạt.*$/i, 'Net $1 XP · pass threshold not reached'],

  // ─ Nhãn "Key: Value" phổ biến trong Student, Teacher & Shared ─
  [/^Môn:\s*(.+)$/i, 'Subject: $1'],
  [/^Khóa:\s*(.+)$/i, 'Course: $1'],
  [/^Lớp:\s*(.+)$/i, 'Class: $1'],
  [/^Mã:\s*(.+)$/i, 'Code: $1'],
  [/^Lý do:\s*(.+)$/i, 'Reason: $1'],
  [/^Hạn(?:\s+nộp)?:\s*(.+)$/i, 'Due: $1'],
  [/^Hạn đến\s+(.+)$/i, 'Valid until $1'],
  [/^Nộp lúc:\s*(.+)$/i, 'Submitted: $1'],
  [/^Nộp:\s*(.+)$/i, 'Submitted: $1'],
  [/^Giao bởi:\s*(.+)$/i, 'Assigned by: $1'],
  [/^Giờ học:\s*(.+)$/i, 'Class time: $1'],
  [/^Lịch:\s*(.+)$/i, 'Schedule: $1'],
  [/^Người chuyển:\s*(.+)$/i, 'Sender: $1'],
  [/^Người tạo:\s*(.+)$/i, 'Created by: $1'],
  [/^Biết qua:\s*(.+)$/i, (_, r) => `Source: ${translateCore(r, 1)}`],
  [/^Trình độ:\s*(.+)$/i, (_, r) => `Level: ${translateCore(r, 1)}`],
  [/^Lo nhất:\s*(.+)$/i, (_, r) => `Main concern: ${translateCore(r, 1)}`],
  [/^Đăng ký:\s*(.+)$/i, 'Registered: $1'],
  [/^Phòng thi:\s*(.+)$/i, 'Exam Room: $1'],
  [/^Kết quả\s*-\s*(.+)$/i, 'Result — $1'],
  [/^Đáp án:\s*(.+)$/i, (_, r) => `Answer: ${translateCore(r, 1)}`],
  [/^Hướng dẫn:\s*(.+)$/i, (_, r) => `Guide: ${translateCore(r, 1)}`],
  [/^Bài tập của khóa\s+(.+)$/i, 'Assignments for $1'],
  [/^Bài nộp:\s*(.+)$/i, 'Submission: $1'],
  [/^Bài trước:\s*(.+)$/i, 'Previous: $1'],
  [/^Bài tiếp theo:\s*(.+)$/i, 'Next: $1'],
  [/^Mục trước:\s*(.+)$/i, 'Prev section: $1'],
  [/^Mục tiếp theo:\s*(.+)$/i, 'Next section: $1'],
  [/^Xem bài trước\s*≥\s*(.+?)\s*để mở$/i, 'Watch ≥ $1 of previous lesson to unlock'],
  [/^Cần xem\s*≥\s*(.+?)\s*để mở bài tiếp$/i, 'Watch ≥ $1 to unlock next lesson'],
  [/^Còn\s*(\d+)\s*giây nữa để(?: được)? mở bài tiếp$/i, '$1s remaining to unlock next lesson'],
  [/^Điểm TB thấp\s*\((.+)\)$/i, 'Low average score ($1)'],
  [/^Điểm gần nhất yếu\s*\((.+)\)$/i, 'Weak latest score ($1)'],
  [/^Không truy cập\s*(\d+)\s*ngày$/i, 'Inactive for $1 days'],
  [/^Còn\s*(\d+)\s*buổi chưa xếp lịch\s*\((\d+)\s*ngày\)$/i, '$1 unscheduled sessions ($2 days)'],
  [/^Buổi\s+(\d+):\s*(.+)$/i, (_, n, r) => `Session ${n}: ${translateCore(r, 1)}`],
  [/^Buổi:\s*(\d+)\/(\d+)$/i, 'Session: $1/$2'],
  [/^Điểm danh\s+(.+)$/i, 'Check in $1'],
  [/^Chờ xác nhận\s*-\s*còn\s*(\d+)s\s*để hủy$/i, 'Pending — $1s left to undo'],
  [/^Đang chờ xác nhận\s*-\s*còn\s*(\d+)s\s*để hủy$/i, 'Pending confirmation — $1s left to undo'],
  [/^Admin điểm danh bù(.*)$/i, 'Admin makeup attendance$1'],
  [/^Điểm danh bù\s+bởi\s+(.+?)\s+lúc\s+(.+)$/i, 'Makeup attendance by $1 at $2'],
  [/^Hủy điểm danh buổi\s+(\d+)(.*)$/i, 'Cancelled attendance for session $1$2'],
  [/^Hủy ca ngày\s+(.+)$/i, 'Cancelled slot on $1'],
  [/^Trắc nghiệm:\s*(.+?)\s*\((\d+\/\d+)\s*câu\)$/i, 'Quiz: $1 ($2 questions)'],
  [/^Trắc nghiệm:\s*(.+?)\s*-\s*Rớt\s*\(thoát giữa giờ\)$/i, 'Quiz: $1 — Failed (left mid-exam)'],
  [/^Trắc nghiệm:\s*(.+)$/i, (_, r) => `Quiz: ${translateCore(r, 1)}`],
  [/^Tự luận:\s*(.+)$/i, (_, r) => `Practical: ${translateCore(r, 1)}`],
  [/^Chấm điểm:\s*(.+)$/i, 'Graded: $1'],
  [/^Cập nhật điểm:\s*(.+)$/i, 'Updated grade: $1'],
  [/^Đã đánh trượt\s+(.+?)\s+và khóa quyền vào phòng thi\.?$/i, 'Failed $1 and locked Exam Room access.'],
  [/^Phòng thi của\s+(.+?)\s+sẽ bị khóa ngay lập tức\.?$/i, '$1’s Exam Room will be locked immediately.'],
  [/^Không cập nhật được khóa\s+(.+)$/i, 'Unable to update course $1'],
  [/^Mở khóa thi lại$/i, 'Unlock Retake'],
  [/^([\d.,]+)\s*đ$/i, '$1₫'],
  [/^[−-](\d+)\s*cược$/i, '−$1 stake'],
  [/^Tiếp:\s*(.+)$/i, (_, r) => `Next: ${translateCore(r, 1)}`],
  [/^Dừng ở giây\s+(\d+)$/i, 'Paused at ${1}s'.replace('${1}', '$1')],
  [/^Hạng\s+#?(\d+)$/i, 'Rank #$1'],
  [/^Cả kỳ\s+(.+)$/i, (_, r) => `Term ${translateCore(r, 1)}`],
  [/^(\d+)\s*đã trả lời$/i, '$1 answered'],
  [/^(\d+)\s*đã làm$/i, '$1 answered'],
  [/^Còn\s+(\d+)$/i, '$1 left'],
  [/^Đã dùng hết\s*(\d+)\s*XP miễn phí hôm nay$/i, 'Used all $1 free XP today'],
  [/^Học viên nhắn:\s*(.+)$/i, 'Student message: $1'],
  [/^SĐT:\s*(.+?)\s*·\s*Ngày nộp:\s*(.+)$/i, 'Phone: $1 · Submitted: $2'],
  [/^⭐\s*Thưởng sao:\s*(.+?)đ?$/i, '⭐ Star Bonus: $1₫'],
  [/^📅\s*([^,]+),\s*ngày\s*(.+)$/i, (_, wd, d) => `📅 ${translateCore(wd, 1)}, ${d}`],
  [/^Bạn đã vượt qua phần trắc nghiệm\s*\(≥\s*(\d+)\s*điểm\)\.\s*Tiếp theo làm phần tự luận\.?$/i, 'Passed quiz (≥ $1 pts). Proceed to practical section.'],
  [/^Thời gian làm bài:\s*(.+)$/i, (_, r) => `Duration: ${translateCore(r, 1)}`],
  [/^Bạn đã đủ điều kiện thưởng sao\s*(.*?)\s*\(≥\s*(\d+)\s*HV đạt\s*(\d+)★ trong tháng\)\.?$/i, 'Qualified for $1 Star Bonus (≥$2 students rated $3★ this month).'],
  [/^Bài tập cần nộp\s*\((\d+)\)$/i, 'Assignments Due ($1)'],
  [/^Trắc nghiệm chưa làm\s*\((\d+)\)$/i, 'Pending Quizzes ($1)'],
  [/^Lịch học giảng viên xếp\s*\((\d+)\)$/i, 'Instructor Scheduled ($1)'],
  [/^Ca chưa điểm danh\s*\((\d+)\)$/i, 'Unmarked Sessions ($1)'],
  [/^Bài chờ chấm\s*\((\d+)(?:\s*HV)?\)$/i, 'Awaiting Grading ($1)'],
  [/^Thêm lịch hôm nay\s*\((\d+)\)$/i, 'More Today ($1)'],
  [/^Việc khác cần làm\s*\((\d+)\)$/i, 'Other Tasks ($1)'],
  [/^DANH SÁCH VIDEO\s*\((\d+)\)$/i, 'VIDEO LIST ($1)'],
  [/^Xem\s+(\d+)\s*câu trả lời$/i, 'View $1 replies'],
  [/^Thêm ảnh vào bình luận\s*\((\d+\/\d+)\)$/i, 'Add photo to comment ($1)'],
  [/^Tích lũy\s*(\d+)\s*XP,\s*bấm để mua thêm XP$/i, 'Earned $1 XP — tap to top up XP'],
  [/^Mua\s*\+(\d+)\s*XP luyện tập$/i, 'Buy +$1 Practice XP'],
  [/^Gói:\s*\+(\d+)\s*XP\s*·\s*(.+?)đ$/i, 'Pack: +$1 XP · $2₫'],
  [/^Ngân hàng:\s*(.+?)\s*·\s*STK:\s*(.+)$/i, 'Bank: $1 · Account: $2'],
  [/^Phục hồi\s*·\s*không cược\s*·\s*nhận\s*\+(\d+)\s*XP$/i, 'Recovery · no stake · earn +$1 XP'],
  [/^Yes,\s*nhận định\s*(\d+)$/i, 'Yes — Statement $1'],
  [/^No\s*-\s*nhận định\s*(\d+)$/i, 'No — Statement $1'],
  [/^Thời điểm bắt đầu:\s*(.+)$/i, 'Start time: $1'],
  [/^Xóa câu hỏi\s*(\d+)$/i, 'Delete question $1'],
  [/^Đánh dấu phương án\s*([^\s]+)\s*câu\s*(\d+)\s*là đáp án đúng$/i, 'Mark option $1 on Q$2 as correct'],
  [/^Tải(?:\s+file)?\s+thất bại\s*\((.+)\)$/i, 'Download/Upload failed ($1)'],
  [/^Lưu\s+(.+?)\s+thất bại\s*\((.+)\)$/i, (_, target, err) => `Failed to save ${translateCore(target, 1)} (${err})`],
  [/^Đã đủ\s*(\d+)\s*ca trong ngày$/i, 'Daily limit of $1 slots reached'],
  [/^Hủy lịch\s+(.+)$/i, 'Cancel schedule $1'],
  [/^Mở khóa thi lại$/i, 'Unlock Retake'],

  // ─ Bổ sung toàn diện Mobile Template Literals ─
  [/^(\d+)\s+Tháng\s+(\d+),\s*(\d+)\s*buổi$/i, '$1/$2 — $3 sessions'],
  [/^(\d+)\s+Tháng\s+(\d+),\s*không có lịch$/i, '$1/$2 — no classes'],
  [/^(\d+)\s+Tháng\s+(\d+)\s+năm\s+(\d+)$/i, '$1/$2/$3'],
  [/^(\d+)\s+Tháng\s+(\d+)$/i, 'Day $1, Month $2'],
  [/^Thứ\s+(\d+)$/i, (_, d) => (Number(d) === 8 ? 'Sunday' : ({ 2: 'Monday', 3: 'Tuesday', 4: 'Wednesday', 5: 'Thursday', 6: 'Friday', 7: 'Saturday' }[Number(d)] || `Day ${d}`))],
  [/^Học viên đã có ca\s+(.+?)\s+trong ngày\.?$/i, 'Student already has a $1 slot on this day.'],
  [/^GV gửi yêu cầu:\s*(.+)$/i, 'Teacher requested: $1'],
  [/^Buổi tiếp theo\s*\(đã học\s*(\d+)\)$/i, 'Next session ($1 completed)'],
  [/^Học viên đang xác nhận\s+(.+)$/i, 'Student confirming: $1'],
  [/^Xác nhận điểm danh\s+(.+)$/i, 'Confirm attendance: $1'],
  [/^Hủy ca\s+(.+)$/i, 'Cancel slot: $1'],
  [/^Vào học\s+(.+)$/i, 'Join class: $1'],
  [/^Mở chi tiết\s+(.+)$/i, 'Open details: $1'],
  [/^Học ngày\s+(.+)$/i, 'Studied on $1'],
  [/^([\d.,]+)\s*ngày$/i, '$1 days'],
  [/^Mốc\s*(\d+)$/i, 'Day $1'],
  [/^Hoàn thành dự kiến\s*(.+)$/i, 'Estimated completion: $1'],
  [/^Đạt\s*([\d.,]+)%\s*·\s*Chu kỳ đã kết thúc$/i, '$1% achieved · Cycle ended'],
  [/^Hôm nay đã đạt\s*([\d.,]+)\s*XP$/i, 'Earned $1 XP today'],
  [/^Chu kỳ 1[–-]3[–-]7 ngày\s*·\s*Đạt\s*≥\s*(\d+)%\s*nhận\s*\+(\d+)\s*XP$/i, '1–3–7 day review cycle · Score ≥ $1% to earn +$2 XP'],
  [/^Đã\s*(\d+)\s*ngày bạn chưa luyện tập[\s\S]*$/i, 'You have not practiced for $1 days! Take a quick 5-minute round now to rebuild your momentum.'],
  [/^Đã\s*(\d+)\s*ngày rồi đó[\s\S]*$/i, 'It has been $1 days! Refresh your skills with a quick 10-question round before they fade.'],
  [/^10 câu trắc nghiệm,\s*kéo thả vui như trò chơi[\s\S]*$/i, '10 fun multiple-choice & drag-and-drop questions. Start your first streak today!'],
  [/^Chặng\s+(\d+)\s*·\s*Lộ trình trong chặng$/i, 'Unit $1 · Unit Learning Path'],
  [/^Đăng ký gói để mở Chặng\s*(\d+)$/i, 'Subscribe to unlock Unit $1'],
  [/^Chặng\s*(\d+)\s*·\s*Đạt\s*(\d+)%\s*để vượt chặng$/i, 'Unit $1 · Score $2% to pass unit'],
  [/^·\s*đang có\s*([\d.,]+)$/i, '· balance: $1'],
  [/^Video có\s*(\d+)\s*mốc trắc nghiệm tương tác\.\s*Trả lời đúng từng mốc để tiếp tục!?$/i, 'Video includes $1 interactive quiz checkpoints. Answer each one to continue!'],
  [/^Mua thêm để luyện tiếp trong hôm nay\.\s*Ngày mai bạn được lại\s*([\d.,]+)\s*XP,\s*XP đã mua vẫn được giữ\.?$/i, 'Top up to keep practicing today. Tomorrow refills $1 XP, and purchased XP never expires.'],
  [/^(.+?)\s*·\s*Video cấp$/i, '$1 · Video Lesson'],
  [/^\(\s*[−-]\s*(\d+)\s*gợi ý\s*\)$/i, '(−$1 hint)'],
  [/^\(Kỹ năng cần củng cố nhất:\s*(.+?)\)\.?$/i, '(Key skill to improve: $1).'],
  [/^Nội dung trọng tâm của\s+"?([^"?]+)"?\s+là gì\?$/i, 'What is the main topic of "$1"?'],
  [/^Nội dung trọng tâm của\s+(.+?)\.\s*Hãy nắm vững lý thuyết trước khi sang các bài luyện tập trắc nghiệm\.?$/i, 'Core concepts of $1. Master the theory before moving to the quizzes.'],
  [/^Hãy xem lại phần hướng dẫn chính trong\s+"([^"]+)"\s+để chọn đáp án đúng nhất\.?$/i, 'Review the main walkthrough in "$1" to pick the best answer.'],
  [/^Với nội dung\s+\*\*(.+?)\*\*,\s*bạn hãy chia nhỏ bài tập thành 3 bước:[\s\S]*$/i, 'For **$1**, break the task into 3 steps:\n1) Review formatting requirements and input data carefully.\n2) Apply each formula or action from simple to complex.\n3) Use `Ctrl + Z` to experiment safely and verify results before submitting.'],
  [/^Công thức\s+(\d+)$/i, 'Formula $1'],
  [/^Câu\s+(\d+)\s*✓$/i, 'Q$1 ✓'],
  [/^Vị trí đã chọn\s*\((\d+)%,\s*(\d+)%\)$/i, 'Selected position ($1%, $2%)'],
  [/^Nhảy tới\s+(.+)$/i, 'Jump to $1'],
  [/^Tạo ghi chú mới tại\s+(.+)$/i, 'New note at $1'],
  [/^Chèn thẻ\s+(.+)$/i, 'Insert tag $1'],
  [/^Xem lại tại\s+(.+)$/i, 'Revisit at $1'],
  [/^# Sổ tay ghi chú:\s*(.+)$/i, '# Study Notebook: $1'],
  [/^# Ghi chú bài học:\s*(.+)$/i, '# Lesson Notes: $1'],
  [/^Tài khoản đã được gia hạn gói\s+(.+?)\.?$/i, (_, p) => `Account renewed with ${translateCore(p, 1)}.`],
  [/^(Gia hạn|Nâng cấp|Mở khóa|Đăng ký)\s+tài khoản(?:\s+(.+))?$/i, (_, act, rest) => `${translateCore(act, 1)} account${rest ? ` ${translateCore(rest, 1)}` : ''}`],
  [/^[\s\S]*Hết hạn thì tài khoản Dew[sS]kill về\s*([\d.,]+)\s*XP\s+(.+?)\.\s*XP đã mua vẫn được giữ\.?$/i, ' After expiry, free accounts revert to $1 XP $2. Purchased XP is always kept.'],
  [/^Gói tài khoản của\s+(.+?)\s+đã hết hạn ngày\s+(.+?)\.\s*Gia hạn để tiếp tục học\s*-\s*tiến độ học vẫn được giữ nguyên\.?$/i, '$1’s plan expired on $2. Renew to keep learning — your progress is always saved.'],
  [/^Nhập mã giới thiệu\s+(\S+)\s+trên DewSkill để nhận ngay\s+\+(\d+)\s*XP!$/i, 'Enter referral code $1 on DewSkill to get +$2 XP!'],
  [/^·?\s*([\d.,]+)\/([\d.,]+)\s+tới\s+(.+)$/i, '· $1/$2 to $3'],
  [/^Xin chào\s+(.+?)\s*·\s*(?:Xác thực OTP thành công|OTP Verified)$/i, 'Hello $1 · OTP Verified'],
  [/^Xác thực đăng ký\s*·\s*(.+)$/i, 'Verify registration · $1'],
  [/^Mã thử nghiệm \(Dev\):\s*(\S+)\s*·\s*Nhấn để điền$/i, 'Dev test OTP: $1 · Tap to fill'],
  [/^Đăng nhập(?: nhanh bằng)?\s+(.+)$/i, (_, m) => `Sign in with ${translateCore(m, 1)}`],
  [/^Đang bật cho\s+(.+?)\s*•\s*Chạm để quản lý$/i, 'Enabled for $1 • Tap to manage'],
  [/^Đang lưu đăng nhập nhanh cho\s+(.+?)\.?$/i, 'Quick sign-in saved for $1.'],
  [/^Đổi ảnh đại diện cho\s+(.+)$/i, 'Change avatar for $1'],
  [/^Ngân hàng\s+(.+?),\s*chạm để chọn ngân hàng$/i, '$1 Bank, tap to select bank'],
  [/^Máy chủ ngân hàng phản hồi HTTP\s+(\d+)\.?$/i, 'Bank server responded with HTTP $1.'],
  [/^Hạn nộp\s+(.+)$/i, 'Due $1'],
  [/^Đã giao\s*(\d+)\s*bài tập\.?$/i, 'Assigned $1 assignment(s).'],
  [/^Đã tạo\s*(\d+)\/(\d+)\s*bài tập\.\s*Phần còn lại thất bại:\s*(.+)$/i, 'Created $1/$2 assignments. Failed remaining: $3'],
  [/^Đã tạo\s*(\d+)\s*câu\.\s*Hãy kiểm tra trước khi giao bài\.?$/i, 'Generated $1 questions. Review before assigning.'],
  [/^Mới nhất:\s*(.+)$/i, 'Latest: $1'],
  [/^(?:·\s*)?Tự luận\s*([\d.,]+(?:\/10)?)$/i, 'Written $1'],
  [/^(\d+)\/(\d+)\s*câu trắc nghiệm$/i, '$1/$2 quiz questions'],
  [/^Bài trắc nghiệm\s+(\d+)$/i, 'Quiz $1'],
  [/^Bài trắc nghiệm thứ\s*(\d+)\s*thiếu mã định danh\.?$/i, 'Quiz #$1 is missing an ID.'],
  [/^Bài nộp thứ\s*(\d+)\s*của\s*"([^"]+)"\s*thiếu điểm hợp lệ\.?$/i, 'Submission #$1 of "$2" is missing a valid grade.'],
  [/^Câu hỏi AI thứ\s*(\d+)\s*có dữ liệu không hợp lệ\.?$/i, 'AI question #$1 has invalid data.'],
  [/^Câu hỏi\s*(\d+)\s*chưa có phương án trả lời hợp lệ\.?$/i, 'Question $1 has no valid answer options.'],
  [/^Đáp án đúng của câu\s*(\d+)\s*không hợp lệ\.?$/i, 'Correct answer for question $1 is invalid.'],
  [/^Dòng\s*(\d+):\s*cần đủ 4 phương án và đáp án đúng A-D hoặc 1-4\.?$/i, 'Row $1: requires 4 options and correct answer A–D or 1–4.'],
  [/^Hoa hồng\s*(\d+)\s*buổi dạy đã hoàn thành\s*-\s*chờ Admin chuyển$/i, 'Commission for $1 completed sessions — awaiting Admin payout'],
  [/^Mặc định:\s*cả lớp\s*\((\d+)\s*HV\)$/i, 'Default: whole class ($1 students)'],
  [/^(.+?)\s*\(Bản sao\)$/i, '$1 (Copy)'],
  [/^Loại kỳ thi:\s*(.+)$/i, 'Exam type: $1'],
  [/^Sức chứa:\s*(.+)$/i, 'Capacity: $1'],
  [/^Đơn vị cấp:\s*(.+)$/i, 'Issuer: $1'],
  [/^Thời hạn:\s*(.+)$/i, 'Validity: $1'],
  [/^Mục đang chọn:\s*(.+)$/i, (_, s) => `Selected section: ${translateCore(s, 1)}`],
  [/^Đăng ký khóa\s+"([^"]+)"\s+với giá\s+(.+)\?$/i, 'Enroll in "$1" for $2?'],
  [/^Xóa bản mã hóa\s+"([^"]+)"\s+khỏi thiết bị\?$/i, 'Delete encrypted copy "$1" from this device?'],
  [/^Xóa bài\s+"([^"]+)"\?\s*Bài nộp của học viên cũng sẽ bị xóa\.?$/i, 'Delete "$1"? Student submissions will also be deleted.'],
  [/^Bài\s+"([^"]+)"\s+sẽ bị xóa khỏi danh sách\.?$/i, '"$1" will be removed from the list.'],
  [/^Xem chứng nhận QR khóa(?:\s+học)?\s+(.+)$/i, 'View QR certificate for $1'],
  [/^Xem thông tin khóa học\s+(.+)$/i, 'View course info: $1'],
  [/^Mở khóa học\s+(.+)$/i, 'Open course $1'],
  [/^\[THẮNG TIN HỌC\] Tôi muốn được tư vấn khóa học 1 kèm 1:\s*(.+)$/i, '[THANG TIN HOC] I would like 1-on-1 consultation for: $1'],
  [/^(.+?)\s+chưa có liên kết để mở\.?$/i, '$1 does not have a link yet.'],
  [/^Liên kết phần mềm\s+(.+?)\s+chưa có$/i, 'Software link for $1 is not available yet'],
  [/^Tài liệu\s+(.+?)\s+chưa có liên kết$/i, 'Material $1 does not have a link yet'],
  [/^Vui lòng thử lại hoặc liên hệ Trung tâm để xem\s+(.+?)\.?$/i, 'Please try again or contact the Center to view $1.'],
  [/^Trung tâm chưa cấu hình liên kết\s+(.+?)\.?$/i, 'Center has not configured the link for $1 yet.'],
  [/^Đổi khóa học,\s*đang xem\s+(.+)$/i, 'Switch course (viewing $1)'],
  [/^Đã thả\s+(.+)$/i, 'Reacted $1'],
  [/^Cuộc gọi đến(?:\s*·\s*(.+))?$/i, (_, n) => (n ? `Incoming call · ${n}` : 'Incoming call')],
  [/^Cột mốc:\s*(.+)$/i, (_, m) => `Milestone: ${translateCore(m, 1)}`],
  [/^Lỗi lưu:\s*(.+)$/i, 'Save error: $1'],
  [/^(.+),\s*chỉ sử dụng trên máy tính$/i, '$1, desktop only'],
  [/^Mở ảnh\s+(\d+)\s+trong bài đăng$/i, 'Open image $1 in post'],
  [/^Mở ảnh\s+(\d+)\s*(.*)$/i, (_, n, l) => `Open image ${n}${l ? ` ${translateCore(l, 1)}` : ''}`],
  [/^Bỏ ảnh bình luận\s+(\d+)$/i, 'Remove comment photo $1'],
  [/^Bỏ ảnh\s+(\d+)$/i, 'Remove photo $1'],
  [/^Không thể tải danh sách bài đã ẩn:\s*(.+)$/i, 'Unable to load hidden posts: $1'],
  [/^Không thể tải bài viết đã ghim:\s*(.+)$/i, 'Unable to load pinned posts: $1'],
  [/^Không thể lưu bài viết đã ghim:\s*(.+)$/i, 'Unable to save pinned post: $1'],
  [/^Không thể thêm\s+(.+?)\s+vào nhóm vì thiếu thông tin tài khoản\.?$/i, 'Cannot add $1 to group: missing account info.'],
  [/^Phản hồi bài tập của khóa\s+(.+?)\s+không hợp lệ\.?$/i, 'Invalid assignment response for $1.'],
  [/^Phản hồi danh sách học viên ở trang\s*(\d+)\s*không hợp lệ\.?$/i, 'Invalid student list response on page $1.'],
  [/^Chỉ được tải lên tối đa\s*(\d+)\s*ảnh\.?$/i, 'You can upload up to $1 images.'],
  [/^Mã PIN gồm đúng\s*(\d+)\s*chữ số\.?$/i, 'PIN must be exactly $1 digits.'],
  [/^Lưu\s+(.+)$/i, 'Save $1'],
  [/^(.+?)\s+học viên đã được cập nhật\.?$/i, (_, lbl) => `Student ${translateCore(lbl, 1)} updated.`],
  [/^(Tệp đính kèm|Tài liệu|Phần mềm|Khóa học|Khóa đào tạo|Quy trình|Tin tức demo)\s+(\d+)$/i, (_, w, n) => `${translateCore(w, 1)} ${n}`],
  [/^Tóm tắt nội dung bản tin demo\s+(\d+)\.?$/i, 'Summary of demo news article $1.'],
  [/^Danh sách\s+(.+?)\s+từ máy chủ không hợp lệ\.?$/i, 'Invalid $1 list from server.'],
  [/^(\d+)\s*buổi(?:\s*học)?$/i, '$1 sessions'],
  [/^(.+?)\s+với\s+(.+?),\s*(.+)$/i, (_, a, b, c) => `${translateCore(a, 1)} with ${b}, ${translateCore(c, 1)}`],
  [/^Thêm\s+(.+)$/i, (_, r) => `Add ${translateCore(r, 1)}`],

  [/^Mở\s+(.+)$/i, 'Open $1'],
  [/^Tải\s+(.+)$/i, 'Download $1'],
  [/^Xóa\s+(.+)$/i, 'Delete $1'],
  [/^Tìm\s+(.+?)(?:\.{3}|…)?$/i, 'Search $1...'],

  // ─ Fallback tiền tố an toàn (chỉ ghép khi phần sau dịch được trọn vẹn) ─
  [/^Không thể\s+(.+)$/i, (m, rest) => {
    const tr = translateCore(rest, 1);
    return tr !== rest.trim() && !VI_DIACRITIC_RE.test(tr) ? `Unable to ${tr}` : m;
  }],
  [/^Không tải được\s+(.+)$/i, (m, rest) => {
    const tr = translateCore(rest, 1);
    return tr !== rest.trim() && !VI_DIACRITIC_RE.test(tr) ? `Unable to load ${tr}` : m;
  }],
  [/^Chưa có\s+(.+)$/i, (m, rest) => {
    const tr = translateCore(rest, 1);
    return tr !== rest.trim() && !VI_DIACRITIC_RE.test(tr) ? `No ${tr}` : m;
  }],
  [/^Không có\s+(.+)$/i, (m, rest) => {
    const tr = translateCore(rest, 1);
    return tr !== rest.trim() && !VI_DIACRITIC_RE.test(tr) ? `No ${tr}` : m;
  }],
  [/^Đang tải\s+(.+)$/i, (m, rest) => {
    const tr = translateCore(rest, 1);
    return tr !== rest.trim() && !VI_DIACRITIC_RE.test(tr) ? `Loading ${tr}` : m;
  }],
];

const NOUN_MAP = {
  'học viên': 'students',
  'giảng viên': 'teachers',
  'khóa học': 'courses',
  'môn học': 'subjects',
  'bài học': 'lessons',
  'buổi học': 'sessions',
  'bài tập': 'assignments',
  'câu hỏi': 'questions',
  'tài liệu': 'materials',
  'thông báo': 'notifications',
  'lịch học': 'schedule',
  'lịch dạy': 'teaching schedule',
  'tin nhắn': 'messages',
  'bài viết': 'posts',
  'đánh giá': 'reviews',
  'hồ sơ': 'profile',
  'kết quả': 'results',
  'danh sách': 'list',
  'chi nhánh': 'branches',
  'ngân hàng': 'banks',
  'dữ liệu': 'data',
  'phần mềm': 'software',
  'gói học': 'plans',
  'chứng nhận': 'certificates',
  'chủ đề': 'topics',
  'lộ trình': 'learning path',
  'hướng dẫn': 'guide',
  'thiết bị': 'devices',
  'ghi chú': 'notes',
  'file': 'file',
  'ảnh': 'image',
  'video': 'video',
  'cài đặt': 'settings',
  'tài khoản': 'account',
  'mật khẩu': 'password',
};

const WORD_TRANSLATIONS = { ...VI_EN_EXACT, ...VI_EN_EXTENDED };

/**
 * Chuẩn hóa mã ngôn ngữ ('vi' mặc định hoặc 'en').
 * @param {unknown} raw
 * @returns {'vi' | 'en'}
 */
export function normalizeLanguage(raw) {
  const code = String(raw || '').trim().toLowerCase();
  return code === 'en' || code.startsWith('en-') || code.startsWith('en_') ? 'en' : DEFAULT_LANGUAGE;
}

/**
 * Helper chọn nhanh chuỗi hiển thị theo ngôn ngữ.
 * @param {'vi' | 'en'} lang
 * @param {string} vi
 * @param {string} en
 * @returns {string}
 */
export function viOrEn(lang, vi, en) {
  return lang === 'en' ? (en || vi) : vi;
}

function preserveCase(source, target) {
  if (!source || !target) return target;
  if (source === source.toUpperCase() && source !== source.toLowerCase()) {
    return target.toUpperCase();
  }
  return target;
}

function translateCore(core, depth = 0) {
  if (!core || typeof core !== 'string') return core;
  const trimmed = core.trim();
  if (!trimmed) return core;
  if (depth > 4) return trimmed;

  if (Object.prototype.hasOwnProperty.call(ALL_EXACT, trimmed)) {
    return ALL_EXACT[trimmed];
  }
  const low = trimmed.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ALL_EXACT_LOWER, low)) {
    return preserveCase(trimmed, ALL_EXACT_LOWER[low]);
  }

  for (const [re, rep] of PATTERN_RULES) {
    if (re.test(trimmed)) {
      return typeof rep === 'function' ? trimmed.replace(re, rep) : trimmed.replace(re, rep);
    }
  }

  // Strip leading visual badge/icon prefix cleanly (gồm cả dấu · / — / – / ,)
  const leadSym = trimmed.match(/^((?:[✓✗✕•·★⚡●←→▶🔴🔒🎉📋📅📢✨📝↳⏰—–,-]|⚠️)\s*)(.+)$/u);
  if (leadSym) {
    const restTr = translateCore(leadSym[2], depth + 1);
    if (restTr !== leadSym[2].trim()) {
      return `${leadSym[1]}${restTr}`;
    }
  }

  // Strip trailing sentence punctuation (..., …, ., :, !, ?, ›) and recurse across rules
  const punctMatch = trimmed.match(/^(.+?)(\s*(?:\.{3}|…|[.:!?›]))$/);
  if (punctMatch) {
    const base = punctMatch[1].trim();
    const tail = punctMatch[2];
    const baseTr = translateCore(base, depth + 1);
    if (baseTr !== base) {
      return `${baseTr}${tail}`;
    }
  }

  // Standalone parenthetical "(3 câu)" -> "(3 questions)"
  if (trimmed.startsWith('(') && trimmed.endsWith(')') && !trimmed.slice(1, -1).includes('(')) {
    const inner = trimmed.slice(1, -1).trim();
    const innerTr = translateCore(inner, depth + 1);
    if (innerTr !== inner) {
      return `(${innerTr})`;
    }
  }

  // Trailing parenthetical "Ôn tập ngay (10 câu)" -> "Practice Now (10 questions)"
  const parenMatch = trimmed.match(/^(.+?)(\s*)\(([^()]+)\)$/);
  if (parenMatch) {
    const left = parenMatch[1].trim();
    const sp = parenMatch[2];
    const right = parenMatch[3].trim();
    const leftTr = translateCore(left, depth + 1);
    const rightTr = translateCore(right, depth + 1);
    if (leftTr !== left || rightTr !== right) {
      return `${leftTr}${sp}(${rightTr})`;
    }
  }

  // Split compound metadata phrases ("A · B", "A • B", "A | B", "A — B", "A - B", "A → B")
  for (const sep of [' · ', ' • ', ' | ', ' — ', ' – ', ' - ', ' → ']) {
    if (trimmed.includes(sep)) {
      const parts = trimmed.split(sep);
      const translatedParts = parts.map((p) => translateCore(p, depth + 1));
      if (translatedParts.some((tp, i) => tp !== parts[i].trim())) {
        return translatedParts.join(sep);
      }
    }
  }

  // Quy tắc tiền tố + danh từ UI quen thuộc (chỉ khi danh từ cũng khớp)
  for (const [viPrefix, enPrefix] of PREFIX_VERBS) {
    if (trimmed.startsWith(viPrefix)) {
      const rest = trimmed.slice(viPrefix.length).trim();
      const restLow = rest.toLowerCase().replace(/[.!?…]+$/, '');
      const trailPunct = rest.match(/([.!?…]+)$/)?.[1] || '';
      if (Object.prototype.hasOwnProperty.call(NOUN_MAP, restLow)) {
        return `${enPrefix}${NOUN_MAP[restLow]}${trailPunct}`;
      }
      const mappedRest = ALL_EXACT[rest] || ALL_EXACT_LOWER[restLow];
      if (mappedRest) {
        return `${enPrefix}${mappedRest}${trailPunct}`;
      }
    }
  }

  // Fallback ghép nhiều dòng (Alert / Banner có \n)
  if (trimmed.includes('\n')) {
    const lines = trimmed.split('\n');
    const trLines = lines.map((ln) => translateCore(ln, depth + 1));
    if (trLines.some((tl, idx) => tl !== lines[idx].trim())) {
      return trLines.join('\n');
    }
  }

  return trimmed;
}

const MEMO_LIMIT = 4000;
const translateMemo = new Map();

/**
 * Dịch một chuỗi tiếng Việt sang tiếng Anh khi `lang === 'en'`.
 * An toàn với chuỗi không dấu, URL, email, mã định danh.
 * @param {string} raw
 * @param {'vi' | 'en'} [lang]
 * @returns {string}
 */
export function translateText(raw, lang = DEFAULT_LANGUAGE) {
  if (lang !== 'en' || typeof raw !== 'string' || !raw) return raw;
  const cached = translateMemo.get(raw);
  if (cached !== undefined) return cached;

  // Bỏ qua URL/email thuần túy
  if (/^(https?:\/\/|mailto:|tel:)/i.test(raw.trim())) return raw;

  const lead = raw.match(/^\s*/)?.[0] || '';
  const trail = raw.match(/\s*$/)?.[0] || '';
  const core = raw.slice(lead.length, raw.length - trail.length);
  if (!core) return raw;

  // Chỉ dịch nếu có dấu tiếng Việt, nằm trong từ điển ASCII (VD: SĐT, SHARE), hoặc khớp PATTERN_RULES (VD: 3/3 xong)
  const inDict = Object.prototype.hasOwnProperty.call(ALL_EXACT, core)
    || Object.prototype.hasOwnProperty.call(ALL_EXACT_LOWER, core.toLowerCase());
  const hasViDiacritic = VI_DIACRITIC_RE.test(core);
  if (!inDict && !hasViDiacritic) {
    const hasPatternMatch = PATTERN_RULES.some(([re]) => re.test(core));
    if (!hasPatternMatch) return raw;
  }

  const outCore = translateCore(core);
  const res = `${lead}${outCore}${trail}`;

  if (translateMemo.size >= MEMO_LIMIT) translateMemo.clear();
  translateMemo.set(raw, res);
  return res;
}

/**
 * Hỗ trợ dịch mảng children JSX xen kẽ biểu thức động hoặc phần tử inline:
 * VD: ["Hoàn thành ", 3, "/", 5, " buổi"] -> ["Completed ", 3, "/", 5, " sessions"].
 * @param {Array<unknown>} parts
 * @param {'vi' | 'en'} [lang]
 * @returns {Array<unknown>}
 */
export function translateInterpolatedParts(parts, lang = DEFAULT_LANGUAGE) {
  if (lang !== 'en' || !Array.isArray(parts) || parts.length === 0) return parts;

  const vals = [];
  const template = parts.map((p) => {
    if (typeof p === 'string') return p;
    const token = `__V${vals.length}__`;
    vals.push(p);
    return token;
  }).join('');

  if (vals.length > 0 && !template.includes('880')) {
    const trimmed = template.trim();
    const lead = template.match(/^\s*/)?.[0] || '';
    const trail = template.match(/\s*$/)?.[0] || '';
    const normalizedTpl = trimmed.replace(/__V(\d+)__/g, (_, i) => `880${i}88`);
    const candidate = translateText(normalizedTpl, 'en');
    if (candidate !== normalizedTpl && candidate.includes('880')) {
      const seen = new Set();
      const restored = `${lead}${candidate}${trail}`;
      const reSplit = [];
      let cursor = 0;
      let valid = true;
      for (const m of restored.matchAll(/880(\d+)88/g)) {
        const idx = Number(m[1]);
        if (idx < 0 || idx >= vals.length || seen.has(idx)) {
          valid = false;
          break;
        }
        seen.add(idx);
        if (m.index > cursor) reSplit.push(restored.slice(cursor, m.index));
        reSplit.push(vals[idx]);
        cursor = m.index + m[0].length;
      }
      if (valid && seen.size === vals.length) {
        if (cursor < restored.length) reSplit.push(restored.slice(cursor));
        return reSplit;
      }
    }
  }

  return parts.map((part) => (typeof part === 'string' ? translateText(part, 'en') : part));
}

export { ALL_EXACT, WORD_TRANSLATIONS };
