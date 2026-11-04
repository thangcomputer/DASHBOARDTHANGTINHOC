'use strict';

const DailyPracticeTopic = require('../models/DailyPracticeTopic');
const DailyPracticeQuestion = require('../models/DailyPracticeQuestion');
const rules = require('./dailyPracticeRules');

/** Bộ câu hỏi mẫu để trung tâm dùng ngay — admin có thể sửa / xóa / thêm. */
const STARTER_TOPICS = [
  {
    name: 'Windows cơ bản',
    description: 'Thao tác máy tính, tệp và thư mục',
    icon: 'monitor',
    color: 'blue',
    questions: [
      { type: 'mcq', difficulty: 'easy', prompt: 'Phím nào mở menu Start trên Windows?', options: ['Phím Windows', 'Phím Alt', 'Phím Shift', 'Phím Tab'], correctIndex: 0, hint: 'Phím có biểu tượng logo của hệ điều hành.', explanation: 'Phím Windows (logo cửa sổ) mở menu Start.' },
      { type: 'truefalse', difficulty: 'easy', prompt: 'Xóa tệp bằng phím Delete sẽ đưa tệp vào Thùng rác (Recycle Bin).', answerBool: true, hint: 'Nghĩ xem có khôi phục lại được tệp không.', explanation: 'Delete đưa vào Thùng rác; Shift + Delete mới xóa vĩnh viễn.' },
      { type: 'order', difficulty: 'medium', prompt: 'Sắp xếp các bước tạo thư mục mới trên Desktop', items: ['Nhấp chuột phải vào vùng trống trên Desktop', 'Chọn New', 'Chọn Folder', 'Gõ tên thư mục và nhấn Enter'], hint: 'Bắt đầu bằng chuột phải.', explanation: 'Chuột phải → New → Folder → đặt tên → Enter.' },
      { type: 'sort', difficulty: 'medium', prompt: 'Phân loại các thiết bị sau', groups: [{ name: 'Thiết bị nhập', items: ['Bàn phím', 'Chuột', 'Máy quét'] }, { name: 'Thiết bị xuất', items: ['Màn hình', 'Máy in', 'Loa'] }], hint: 'Thiết bị nhập đưa dữ liệu VÀO máy tính.', explanation: 'Bàn phím, chuột, máy quét đưa dữ liệu vào; màn hình, máy in, loa đưa kết quả ra.' },
      { type: 'fill', difficulty: 'medium', prompt: 'Kéo phím thích hợp vào chỗ trống', text: 'Nhấn {{Windows}} + {{E}} để mở File Explorer.', distractors: ['Ctrl', 'R'], hint: 'E là chữ cái đầu của Explorer.', explanation: 'Windows + E mở nhanh File Explorer.' },
      { type: 'match', difficulty: 'hard', prompt: 'Ghép tổ hợp phím với chức năng trên Windows', pairs: [{ left: 'Windows + D', right: 'Hiện màn hình Desktop' }, { left: 'Windows + L', right: 'Khóa máy tính' }, { left: 'Alt + Tab', right: 'Chuyển giữa các cửa sổ' }, { left: 'Windows + I', right: 'Mở Cài đặt (Settings)' }], hint: 'L = Lock, D = Desktop.', explanation: 'Windows + D hiện Desktop, Windows + L khóa máy, Alt + Tab chuyển cửa sổ, Windows + I mở Settings.' },
      { type: 'mcq', difficulty: 'hard', prompt: 'Muốn xóa tệp vĩnh viễn, không qua Thùng rác, dùng tổ hợp nào?', options: ['Shift + Delete', 'Ctrl + Delete', 'Alt + Delete', 'Ctrl + D'], correctIndex: 0, hint: 'Giữ phím dùng để viết hoa rồi nhấn Delete.', explanation: 'Shift + Delete xóa vĩnh viễn, không thể khôi phục từ Thùng rác.' },
    ],
  },
  {
    name: 'Microsoft Word',
    description: 'Soạn thảo và định dạng văn bản',
    icon: 'file-text',
    color: 'sky',
    questions: [
      { type: 'mcq', difficulty: 'easy', prompt: 'Tổ hợp phím in đậm chữ trong Word là?', options: ['Ctrl + B', 'Ctrl + I', 'Ctrl + U', 'Ctrl + E'], correctIndex: 0, hint: 'B là chữ đầu của Bold.', explanation: 'Ctrl + B in đậm, Ctrl + I in nghiêng, Ctrl + U gạch chân.' },
      { type: 'truefalse', difficulty: 'easy', prompt: 'Ctrl + Z dùng để hoàn tác (Undo) thao tác vừa làm.', answerBool: true, hint: 'Phím này giúp "quay lại" khi lỡ tay.', explanation: 'Ctrl + Z là Undo, hoàn tác thao tác gần nhất.' },
      { type: 'match', difficulty: 'medium', prompt: 'Ghép phím tắt với kiểu căn lề đoạn văn', pairs: [{ left: 'Ctrl + L', right: 'Căn trái' }, { left: 'Ctrl + E', right: 'Căn giữa' }, { left: 'Ctrl + R', right: 'Căn phải' }, { left: 'Ctrl + J', right: 'Căn đều hai bên' }], hint: 'L = Left, R = Right.', explanation: 'L trái, E giữa (cEnter), R phải, J đều hai bên (Justify).' },
      { type: 'order', difficulty: 'medium', prompt: 'Sắp xếp các bước chèn ảnh từ máy tính vào Word', items: ['Đặt con trỏ tại vị trí cần chèn', 'Chọn thẻ Insert', 'Chọn Pictures → This Device', 'Chọn ảnh và bấm Insert'], hint: 'Luôn chọn vị trí trước khi chèn.', explanation: 'Đặt con trỏ → Insert → Pictures → This Device → chọn ảnh → Insert.' },
      { type: 'fill', difficulty: 'medium', prompt: 'Kéo từ thích hợp vào chỗ trống', text: 'Để chèn số trang, vào thẻ {{Insert}} rồi chọn {{Page Number}}.', distractors: ['Layout', 'View', 'Margins'], hint: 'Số trang là thứ được "chèn" vào văn bản.', explanation: 'Insert → Page Number để đánh số trang.' },
      { type: 'sort', difficulty: 'hard', prompt: 'Phân loại các lệnh theo thẻ (tab) trong Word', groups: [{ name: 'Home', items: ['Bold', 'Font Size', 'Paste'] }, { name: 'Insert', items: ['Table', 'Pictures'] }, { name: 'Layout', items: ['Margins', 'Orientation'] }], hint: 'Định dạng chữ nằm ở thẻ đầu tiên.', explanation: 'Home: định dạng chữ, dán; Insert: bảng, ảnh; Layout: lề, hướng giấy.' },
      { type: 'mcq', difficulty: 'hard', prompt: 'Muốn ngắt sang trang mới ngay tại vị trí con trỏ, nhấn tổ hợp nào?', options: ['Ctrl + Enter', 'Shift + Enter', 'Alt + Enter', 'Ctrl + Space'], correctIndex: 0, hint: 'Kết hợp Ctrl với phím xuống dòng.', explanation: 'Ctrl + Enter chèn ngắt trang (Page Break); Shift + Enter chỉ xuống dòng.' },
    ],
  },
  {
    name: 'Microsoft Excel',
    description: 'Bảng tính, hàm và biểu đồ',
    icon: 'sheet',
    color: 'green',
    questions: [
      { type: 'mcq', difficulty: 'easy', prompt: 'Công thức trong Excel thường bắt đầu bằng ký tự nào?', options: ['=', '#', '@', '&'], correctIndex: 0, hint: 'Ký tự dùng trong phép so sánh bằng.', explanation: 'Công thức Excel bắt đầu bằng dấu "=".' },
      { type: 'truefalse', difficulty: 'easy', prompt: 'Ô B3 nằm ở cột B, hàng 3.', answerBool: true, hint: 'Chữ là cột, số là hàng.', explanation: 'Địa chỉ ô = tên cột (chữ) + số hàng.' },
      { type: 'fill', difficulty: 'medium', prompt: 'Kéo tên hàm vào chỗ trống', text: 'Hàm {{SUM}} tính tổng, hàm {{AVERAGE}} tính trung bình cộng.', distractors: ['COUNT', 'MAX'], hint: 'Tổng tiếng Anh là "sum".', explanation: 'SUM tính tổng, AVERAGE tính trung bình cộng.' },
      { type: 'match', difficulty: 'medium', prompt: 'Ghép hàm Excel với chức năng', pairs: [{ left: 'MAX', right: 'Giá trị lớn nhất' }, { left: 'MIN', right: 'Giá trị nhỏ nhất' }, { left: 'COUNT', right: 'Đếm ô chứa số' }, { left: 'IF', right: 'Kiểm tra điều kiện' }], hint: 'IF nghĩa là "nếu".', explanation: 'MAX lớn nhất, MIN nhỏ nhất, COUNT đếm ô số, IF kiểm tra điều kiện.' },
      { type: 'order', difficulty: 'medium', prompt: 'Sắp xếp các bước tạo biểu đồ cột', items: ['Bôi đen vùng dữ liệu', 'Chọn thẻ Insert', 'Chọn biểu tượng biểu đồ cột', 'Chọn kiểu biểu đồ mong muốn'], hint: 'Phải có dữ liệu được chọn trước.', explanation: 'Chọn dữ liệu → Insert → biểu đồ cột → chọn kiểu.' },
      { type: 'mcq', difficulty: 'hard', prompt: 'Địa chỉ nào là địa chỉ tuyệt đối?', options: ['$A$1', 'A1', 'A$1', '$A1'], correctIndex: 0, hint: 'Cố định cả cột lẫn hàng.', explanation: '$A$1 có $ trước cả cột và hàng nên không đổi khi sao chép công thức.' },
      { type: 'sort', difficulty: 'hard', prompt: 'Phân loại các địa chỉ ô', groups: [{ name: 'Tuyệt đối', items: ['$A$1', '$C$5'] }, { name: 'Tương đối', items: ['A1', 'C5'] }, { name: 'Hỗn hợp', items: ['$A1', 'C$5'] }], hint: 'Đếm số dấu $ trong địa chỉ.', explanation: 'Hai dấu $ = tuyệt đối, không có $ = tương đối, một dấu $ = hỗn hợp.' },
    ],
  },
  {
    name: 'PowerPoint',
    description: 'Thiết kế và trình chiếu bài thuyết trình',
    icon: 'presentation',
    color: 'orange',
    questions: [
      { type: 'mcq', difficulty: 'easy', prompt: 'Phím nào trình chiếu từ slide đầu tiên?', options: ['F5', 'F2', 'F7', 'F12'], correctIndex: 0, hint: 'Cùng phím dùng để tải lại trang web.', explanation: 'F5 trình chiếu từ đầu; Shift + F5 trình chiếu từ slide hiện tại.' },
      { type: 'truefalse', difficulty: 'easy', prompt: 'Shift + F5 trình chiếu từ slide đang chọn.', answerBool: true, hint: 'Thêm Shift vào phím trình chiếu.', explanation: 'Shift + F5 bắt đầu trình chiếu từ slide hiện tại.' },
      { type: 'mcq', difficulty: 'medium', prompt: 'Thoát chế độ trình chiếu bằng phím nào?', options: ['Esc', 'Enter', 'Space', 'Tab'], correctIndex: 0, hint: 'Phím "thoát" ở góc trái trên bàn phím.', explanation: 'Esc thoát khỏi chế độ trình chiếu.' },
      { type: 'order', difficulty: 'medium', prompt: 'Sắp xếp các bước thêm hiệu ứng cho một đối tượng', items: ['Chọn đối tượng trên slide', 'Mở thẻ Animations', 'Chọn hiệu ứng mong muốn', 'Bấm Preview để xem thử'], hint: 'Chọn đối tượng trước tiên.', explanation: 'Chọn đối tượng → Animations → chọn hiệu ứng → Preview.' },
      { type: 'match', difficulty: 'medium', prompt: 'Ghép thẻ (tab) với chức năng', pairs: [{ left: 'Transitions', right: 'Hiệu ứng chuyển slide' }, { left: 'Animations', right: 'Hiệu ứng cho đối tượng' }, { left: 'Design', right: 'Chủ đề và màu sắc' }, { left: 'Slide Show', right: 'Trình chiếu' }], hint: 'Transition nghĩa là "chuyển tiếp".', explanation: 'Transitions chuyển slide, Animations hiệu ứng đối tượng, Design giao diện, Slide Show trình chiếu.' },
      { type: 'fill', difficulty: 'hard', prompt: 'Kéo phím thích hợp vào chỗ trống', text: 'Nhấn {{Ctrl}} + {{M}} để thêm slide mới.', distractors: ['Alt', 'N'], hint: 'Không phải chữ N như nhiều người nghĩ.', explanation: 'Ctrl + M thêm slide mới trong PowerPoint.' },
      { type: 'sort', difficulty: 'hard', prompt: 'Hiệu ứng nào thuộc Transitions, hiệu ứng nào thuộc Animations?', groups: [{ name: 'Transitions', items: ['Morph', 'Push'] }, { name: 'Animations', items: ['Fly In', 'Spin'] }], hint: 'Morph biến đổi mượt giữa hai slide.', explanation: 'Morph, Push là chuyển slide; Fly In, Spin là hiệu ứng cho đối tượng.' },
    ],
  },
  {
    name: 'Phím tắt văn phòng',
    description: 'Thao tác nhanh dùng chung mọi phần mềm',
    icon: 'keyboard',
    color: 'purple',
    questions: [
      { type: 'mcq', difficulty: 'easy', prompt: 'Ctrl + C dùng để làm gì?', options: ['Sao chép', 'Dán', 'Cắt', 'Xóa'], correctIndex: 0, hint: 'C là Copy.', explanation: 'Ctrl + C sao chép, Ctrl + X cắt, Ctrl + V dán.' },
      { type: 'truefalse', difficulty: 'easy', prompt: 'Ctrl + V dùng để cắt (Cut) văn bản.', answerBool: false, hint: 'Cắt là Ctrl + X.', explanation: 'Ctrl + V là Dán (Paste); cắt là Ctrl + X.' },
      { type: 'match', difficulty: 'medium', prompt: 'Ghép phím tắt với chức năng', pairs: [{ left: 'Ctrl + X', right: 'Cắt' }, { left: 'Ctrl + V', right: 'Dán' }, { left: 'Ctrl + A', right: 'Chọn tất cả' }, { left: 'Ctrl + F', right: 'Tìm kiếm' }], hint: 'A = All, F = Find.', explanation: 'X cắt, V dán, A chọn tất cả, F tìm kiếm.' },
      { type: 'fill', difficulty: 'medium', prompt: 'Kéo phím thích hợp vào chỗ trống', text: 'Nhấn {{Ctrl}} + {{P}} để in tài liệu.', distractors: ['Alt', 'I'], hint: 'P là Print.', explanation: 'Ctrl + P mở hộp thoại in.' },
      { type: 'order', difficulty: 'medium', prompt: 'Sắp xếp các bước sao chép một đoạn văn sang vị trí khác', items: ['Bôi đen đoạn văn', 'Nhấn Ctrl + C', 'Đặt con trỏ tại vị trí mới', 'Nhấn Ctrl + V'], hint: 'Chọn trước, sao chép sau.', explanation: 'Bôi đen → Ctrl + C → đặt con trỏ → Ctrl + V.' },
      { type: 'sort', difficulty: 'hard', prompt: 'Phân loại các phím tắt', groups: [{ name: 'Định dạng chữ', items: ['Ctrl + B', 'Ctrl + I', 'Ctrl + U'] }, { name: 'Thao tác tệp', items: ['Ctrl + S', 'Ctrl + O', 'Ctrl + N'] }], hint: 'S = Save, O = Open, N = New.', explanation: 'B/I/U định dạng chữ; S lưu, O mở, N tạo tệp mới.' },
      { type: 'mcq', difficulty: 'hard', prompt: 'Ctrl + Y thường dùng để làm gì?', options: ['Làm lại thao tác vừa hoàn tác (Redo)', 'Hoàn tác (Undo)', 'Lưu tệp', 'Mở tệp mới'], correctIndex: 0, hint: 'Ngược lại với Ctrl + Z.', explanation: 'Ctrl + Y là Redo — làm lại thao tác vừa bị hoàn tác.' },
    ],
  },
  {
    name: 'Internet & An toàn thông tin',
    description: 'Email, trình duyệt và bảo mật tài khoản',
    icon: 'shield',
    color: 'teal',
    questions: [
      { type: 'mcq', difficulty: 'easy', prompt: 'Mật khẩu nào an toàn nhất?', options: ['Th@ng2026!Hoc', '123456', 'matkhau', 'ngaysinh01011990'], correctIndex: 0, hint: 'Mật khẩu mạnh trộn chữ hoa, số và ký tự đặc biệt.', explanation: 'Mật khẩu mạnh dài, có chữ hoa, chữ thường, số và ký tự đặc biệt.' },
      { type: 'truefalse', difficulty: 'easy', prompt: 'Nên bấm vào đường link lạ gửi qua tin nhắn để nhận quà.', answerBool: false, hint: 'Quà miễn phí từ người lạ thường là bẫy.', explanation: 'Link lạ có thể là lừa đảo, đánh cắp tài khoản hoặc cài mã độc.' },
      { type: 'sort', difficulty: 'medium', prompt: 'Phân loại các hành vi khi dùng Internet', groups: [{ name: 'An toàn', items: ['Bật xác thực 2 lớp', 'Cập nhật phần mềm thường xuyên', 'Kiểm tra địa chỉ trang web'] }, { name: 'Rủi ro', items: ['Dùng chung một mật khẩu', 'Đưa mã OTP cho người lạ', 'Tải phần mềm crack'] }], hint: 'OTP không bao giờ được chia sẻ.', explanation: 'Xác thực 2 lớp, cập nhật, kiểm tra địa chỉ giúp an toàn; các hành vi còn lại dễ bị mất tài khoản.' },
      { type: 'match', difficulty: 'medium', prompt: 'Ghép thuật ngữ email với ý nghĩa', pairs: [{ left: 'CC', right: 'Gửi bản sao công khai' }, { left: 'BCC', right: 'Gửi bản sao ẩn người nhận' }, { left: 'Attach', right: 'Đính kèm tệp' }, { left: 'Reply All', right: 'Trả lời tất cả người nhận' }], hint: 'Chữ B trong BCC là "Blind" (ẩn).', explanation: 'CC hiện người nhận, BCC ẩn danh sách, Attach đính kèm, Reply All trả lời tất cả.' },
      { type: 'order', difficulty: 'medium', prompt: 'Sắp xếp các bước gửi email có tệp đính kèm', items: ['Bấm Soạn thư (Compose)', 'Nhập người nhận và tiêu đề', 'Bấm biểu tượng đính kèm và chọn tệp', 'Bấm Gửi (Send)'], hint: 'Gửi luôn là bước cuối.', explanation: 'Soạn thư → nhập người nhận, tiêu đề → đính kèm → Gửi.' },
      { type: 'fill', difficulty: 'hard', prompt: 'Kéo từ thích hợp vào chỗ trống', text: 'Trang web an toàn thường có địa chỉ bắt đầu bằng {{https}} và biểu tượng {{ổ khóa}} trên thanh địa chỉ.', distractors: ['http', 'ngôi sao'], hint: 'Chữ "s" cuối nghĩa là secure (bảo mật).', explanation: 'https và biểu tượng ổ khóa cho biết kết nối được mã hóa.' },
      { type: 'mcq', difficulty: 'hard', prompt: 'Email giả mạo để lừa lấy thông tin gọi là gì?', options: ['Phishing', 'Spam', 'Backup', 'Firewall'], correctIndex: 0, hint: 'Đọc gần giống "câu cá" trong tiếng Anh.', explanation: 'Phishing là lừa đảo giả mạo để đánh cắp thông tin.' },
    ],
  },
];

/** Thêm bộ mẫu; bỏ qua chủ đề đã có cùng tên để không tạo trùng. */
async function installStarterContent() {
  let topics = 0;
  let questions = 0;
  const existing = await DailyPracticeTopic.find({}).select('name sortOrder').lean();
  const names = new Set(existing.map((topic) => topic.name.trim().toLocaleLowerCase('vi')));
  let sortOrder = existing.reduce((max, topic) => Math.max(max, topic.sortOrder || 0), 0);
  for (const starter of STARTER_TOPICS) {
    if (names.has(starter.name.toLocaleLowerCase('vi'))) continue;
    sortOrder += 1;
    const topic = await DailyPracticeTopic.create({
      name: starter.name, description: starter.description, icon: starter.icon, color: starter.color, sortOrder,
    });
    const docs = starter.questions.map((q) => ({
      ...rules.validateQuestion(q), topicId: topic._id, status: 'published', source: 'starter',
    }));
    await DailyPracticeQuestion.insertMany(docs);
    topics += 1;
    questions += docs.length;
  }
  return { topics, questions };
}

module.exports = { STARTER_TOPICS, installStarterContent };
