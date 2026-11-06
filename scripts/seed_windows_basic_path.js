/**
 * Seed lộ trình «Windows cơ bản» — chặng + nút Học bài/Luyện + câu hỏi để test end-to-end.
 *
 *   node scripts/seed_windows_basic_path.js
 *   node scripts/seed_windows_basic_path.js --reset   # xóa chặng/câu cũ của chủ đề rồi tạo lại
 */
require('dotenv').config();
const mongoose = require('mongoose');
const DailyPracticeTopic = require('../models/DailyPracticeTopic');
const DailyPracticeUnit = require('../models/DailyPracticeUnit');
const DailyPracticeQuestion = require('../models/DailyPracticeQuestion');
const DailyPracticePathProgress = require('../models/DailyPracticePathProgress');

const RESET = process.argv.includes('--reset');
const TOPIC_NAME = 'Windows cơ bản';

const emptyStepVideos = () => ({ learn: [], practice: [], challenge: [] });

function defaultNodes(lessons = []) {
  return [
    {
      key: 'study',
      label: 'Học bài',
      icon: 'book',
      sortOrder: 0,
      active: true,
      stepVideos: {
        learn: lessons.map((lesson) => ({
          title: lesson.title,
          content: lesson.content || '',
          url: lesson.url || '',
        })),
        practice: [],
        challenge: [],
      },
    },
    { key: 'practice-1', label: 'Luyện tập', icon: 'dumbbell', sortOrder: 1, active: true, stepVideos: emptyStepVideos() },
    { key: 'challenge', label: 'Thử thách', icon: 'flame', sortOrder: 2, active: true, stepVideos: emptyStepVideos() },
    { key: 'practice-2', label: 'Luyện tập', icon: 'dumbbell', sortOrder: 3, active: true, stepVideos: emptyStepVideos() },
    { key: 'complete', label: 'Hoàn thành', icon: 'crown', sortOrder: 4, active: true, stepVideos: emptyStepVideos() },
  ];
}

/** Nội dung theo tiêu đề chặng — dùng để HV test Học bài → Luyện → Thử thách. */
const UNITS = [
  {
    title: 'Bắt đầu',
    description: 'Làm quen màn hình nền, nút Start và các biểu tượng cơ bản.',
    lessons: [
      {
        title: 'Màn hình nền Windows',
        content: 'Màn hình nền (Desktop) là nơi bạn thấy ngay sau khi đăng nhập.\nỞ đó có biểu tượng, thanh tác vụ (Taskbar) phía dưới và nút Start bên trái.\nHãy nhận biết: biểu tượng Thùng rác, thư mục, và đồng hồ góc phải.',
      },
      {
        title: 'Nút Start và tìm ứng dụng',
        content: 'Bấm nút Start (biểu tượng Windows) để mở danh sách ứng dụng.\nGõ tên chương trình (ví dụ: Notepad, Paint) để tìm nhanh.\nBấm một lần để mở ứng dụng.',
      },
    ],
    questions: [
      { difficulty: 'easy', prompt: 'Thanh tác vụ (Taskbar) thường nằm ở vị trí nào?', options: ['Phía dưới màn hình', 'Chỉ ở giữa màn hình', 'Chỉ trên cùng', 'Ẩn trong Thùng rác'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Nút Start dùng để làm gì?', options: ['Mở danh sách ứng dụng / tìm chương trình', 'Tắt máy ngay lập tức', 'Xóa hết tệp', 'Chỉ đổi hình nền'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Desktop còn được gọi là gì?', options: ['Màn hình nền', 'Ổ cứng', 'Trình duyệt', 'Máy in'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Đồng hồ và ngày thường hiện ở đâu?', options: ['Góc phải thanh tác vụ', 'Trong Thùng rác', 'Trên nút Start', 'Trong Paint'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Cách nhanh để tìm ứng dụng Notepad?', options: ['Bấm Start rồi gõ Notepad', 'Xóa Thùng rác', 'Tắt Wi‑Fi', 'Đổi mật khẩu'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Biểu tượng trên Desktop dùng để?', options: ['Mở thư mục hoặc chương trình', 'Tăng tốc CPU', 'Sửa lỗi RAM', 'Cài driver tự động'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Khi không thấy thanh tác vụ, thao tác phù hợp là?', options: ['Di chuyển chuột xuống mép dưới / kiểm tra chế độ tự ẩn', 'Format ổ C ngay', 'Gỡ nguồn máy', 'Xóa tài khoản người dùng'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Thùng rác trên Desktop dùng để?', options: ['Chứa tệp đã xóa tạm thời', 'Lưu mật khẩu Wi‑Fi', 'Cài Windows mới', 'Đổi ngôn ngữ bàn phím'], correctIndex: 0 },
    ],
  },
  {
    title: 'Bật tắt máy tính',
    description: 'Bật máy an toàn, khóa màn hình, khởi động lại và tắt máy đúng cách.',
    lessons: [
      {
        title: 'Bật máy và đăng nhập',
        content: 'Nhấn nút nguồn trên thùng máy hoặc laptop.\nĐợi Windows hiện màn hình đăng nhập, nhập mật khẩu (nếu có).\nKhông tắt nguồn đột ngột khi máy đang khởi động.',
      },
      {
        title: 'Tắt máy và khởi động lại',
        content: 'Bấm Start → nguồn → Shut down để tắt máy.\nChọn Restart khi cần khởi động lại sau cài đặt.\nSleep/Hibernate giúp tạm dừng mà không đóng hết ứng dụng.',
      },
    ],
    questions: [
      { difficulty: 'easy', prompt: 'Cách tắt máy đúng trong Windows?', options: ['Start → nguồn → Shut down', 'Rút điện khi đang làm việc', 'Xóa thư mục Windows', 'Đóng nắp laptop là đủ với mọi máy'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Restart nghĩa là gì?', options: ['Khởi động lại máy', 'Xóa toàn bộ dữ liệu', 'Chỉ tắt màn hình', 'Mở Task Manager'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Khi máy đang cập nhật Windows, nên?', options: ['Chờ cập nhật xong, không tắt nguồn đột ngột', 'Rút sạc ngay', 'Gỡ ổ cứng', 'Bấm Reset liên tục'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Lock (Win + L) dùng để?', options: ['Khóa màn hình khi rời chỗ', 'Xóa file vĩnh viễn', 'Tăng độ sáng', 'Đổi hình nền'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Sleep khác Shut down ở điểm nào?', options: ['Sleep tạm dừng nhanh, mở lại gần như ngay; Shut down tắt hẳn', 'Sleep xóa hết tệp', 'Shut down nhanh hơn Sleep', 'Không khác gì nhau'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Máy bị treo không thao tác được, bước hợp lý trước khi rút điện?', options: ['Thử Ctrl+Alt+Delete hoặc giữ nút nguồn vài giây theo hướng dẫn', 'Đập bàn phím', 'Xóa System32', 'Cắm thêm USB ngẫu nhiên'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Vì sao không nên rút điện khi đang ghi dữ liệu?', options: ['Có thể làm hỏng tệp / hệ thống', 'Làm máy chạy nhanh hơn', 'Giúp tiết kiệm RAM', 'Không ảnh hưởng gì'], correctIndex: 0 },
    ],
  },
  {
    title: 'Kết nối thiết bị',
    description: 'USB, chuột, bàn phím, tai nghe và kiểm tra thiết bị đã nhận.',
    lessons: [
      {
        title: 'Cổng USB và thiết bị ngoài',
        content: 'Cắm USB vào cổng phù hợp (USB‑A hoặc USB‑C).\nWindows thường tự nhận và hiện thông báo.\nAn toàn khi rút: dùng «Safely Remove Hardware» với ổ USB.',
      },
      {
        title: 'Chuột, bàn phím, tai nghe',
        content: 'Thiết bị có dây: cắm vào cổng USB.\nThiết bị không dây: bật nguồn, ghép đôi Bluetooth hoặc cắm đầu thu.\nKiểm tra trong Settings → Bluetooth & devices nếu chưa thấy.',
      },
    ],
    questions: [
      { difficulty: 'easy', prompt: 'Ổ USB thường cắm vào cổng nào?', options: ['Cổng USB trên máy', 'Cổng HDMI only', 'Khe thẻ SIM', 'Ổ CD'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Trước khi rút ổ USB đang chép tệp, nên?', options: ['Đợi chép xong / gỡ an toàn', 'Rút ngay giữa chừng', 'Tắt màn hình', 'Xóa ổ C'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Tai nghe 3.5mm thường cắm vào?', options: ['Jack âm thanh trên máy', 'Cổng LAN', 'Cổng nguồn', 'Khe SSD'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Thiết bị Bluetooth chưa hiện, nên kiểm tra?', options: ['Bluetooth đã bật và thiết bị ở chế độ ghép đôi', 'Xóa Windows', 'Tắt antivirus mãi mãi', 'Đổi mật khẩu Wi‑Fi'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Chuột máy tính không dây hết pin thường dẫn đến?', options: ['Không di chuyển / không nhận nút', 'Xóa thư mục Documents', 'Đổi ngôn ngữ hệ thống', 'Tự format USB'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Device Manager dùng để?', options: ['Xem / quản lý phần cứng và driver', 'Soạn văn bản', 'Vẽ tranh', 'Chỉ đổi hình nền'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Cắm USB nhưng không nhận, bước kiểm tra hợp lý?', options: ['Thử cổng khác / máy khác / cập nhật driver', 'Xóa ngay ổ Windows', 'Rót nước vào cổng', 'Gỡ thanh RAM'], correctIndex: 0 },
    ],
  },
  {
    title: 'Chuột & Bàn phím',
    description: 'Click, kéo thả, phím tắt cơ bản và gõ tiếng Việt.',
    lessons: [
      {
        title: 'Thao tác chuột cơ bản',
        content: 'Click trái: chọn. Click đôi: mở.\nClick phải: menu ngữ cảnh.\nKéo thả: giữ click trái rồi di chuyển để sao chép/di chuyển biểu tượng.',
      },
      {
        title: 'Bàn phím và phím tắt',
        content: 'Ctrl + C / Ctrl + V: sao chép / dán.\nAlt + Tab: chuyển cửa sổ.\nWin + E: mở File Explorer.\nWin + D: hiện Desktop.',
      },
    ],
    questions: [
      { difficulty: 'easy', prompt: 'Click đôi chuột trái thường để?', options: ['Mở tệp hoặc thư mục', 'Tắt máy', 'Xóa ổ đĩa', 'Đổi mật khẩu'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Click phải chuột dùng để?', options: ['Mở menu ngữ cảnh', 'Tắt Wi‑Fi', 'Cài Office', 'Định dạng ổ D'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Ctrl + C là phím tắt?', options: ['Sao chép', 'Dán', 'In', 'Tắt máy'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Ctrl + V dùng để?', options: ['Dán nội dung đã sao chép', 'Cắt', 'Hoàn tác', 'Lưu'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Alt + Tab giúp?', options: ['Chuyển nhanh giữa các cửa sổ', 'Xóa thư mục', 'Mở Paint', 'Đổi hình nền'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Win + L dùng để?', options: ['Khóa máy nhanh', 'Mở Excel', 'Chụp màn hình vùng chọn', 'Mở Settings âm thanh'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Win + E mở gì?', options: ['File Explorer (Quản lý tệp)', 'Task Manager', 'Paint', 'Calculator'], correctIndex: 0 },
    ],
  },
  {
    title: 'Quản lý tệp & thư mục',
    description: 'Tạo thư mục, đổi tên, sao chép, di chuyển và tìm tệp.',
    lessons: [
      {
        title: 'File Explorer cơ bản',
        content: 'Mở File Explorer (Win + E).\nThanh bên trái: This PC, Documents, Downloads…\nTạo thư mục mới: click phải → New → Folder.',
      },
      {
        title: 'Sao chép, di chuyển, xóa',
        content: 'Ctrl + C / Ctrl + X / Ctrl + V để sao chép, cắt, dán.\nDelete đưa vào Thùng rác; Shift + Delete xóa thẳng (cẩn thận).\nĐổi tên: chọn tệp → F2 hoặc click phải → Rename.',
      },
    ],
    questions: [
      { difficulty: 'easy', prompt: 'Win + E mở ứng dụng nào?', options: ['File Explorer', 'Word', 'Chrome', 'Zoom'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Cách tạo thư mục mới nhanh?', options: ['Click phải → New → Folder', 'Tắt máy', 'Xóa Desktop', 'Đổi mật khẩu'], correctIndex: 0 },
      { difficulty: 'easy', prompt: 'Phím F2 thường dùng để?', options: ['Đổi tên tệp/thư mục', 'Tắt máy', 'Mở Start', 'In màn hình'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Tệp vừa Delete thường vào đâu?', options: ['Thùng rác', 'BIOS', 'Registry', 'Task Scheduler'], correctIndex: 0 },
      { difficulty: 'medium', prompt: 'Ctrl + X rồi Ctrl + V là?', options: ['Cắt rồi dán (di chuyển)', 'Chỉ sao chép', 'In hai lần', 'Khóa máy'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Thanh địa chỉ trong File Explorer cho biết?', options: ['Đường dẫn thư mục đang mở', 'Tốc độ CPU', 'Dung lượng RAM trống', 'Mật khẩu Wi‑Fi'], correctIndex: 0 },
      { difficulty: 'hard', prompt: 'Ô Search trong File Explorer dùng để?', options: ['Tìm tệp/thư mục theo tên', 'Cài driver', 'Đổi độ phân giải', 'Tạo tài khoản Microsoft'], correctIndex: 0 },
    ],
  },
];

const FREE_QUESTIONS = [
  { difficulty: 'easy', prompt: '[Tự do] Biểu tượng Recycle Bin là gì?', options: ['Thùng rác', 'Máy in', 'Ổ cứng', 'Loa'], correctIndex: 0 },
  { difficulty: 'easy', prompt: '[Tự do] Thanh Taskbar thường nằm?', options: ['Dưới màn hình', 'Trong BIOS', 'Trên mây', 'Trong CPU'], correctIndex: 0 },
  { difficulty: 'medium', prompt: '[Tự do] Ctrl + Z thường là?', options: ['Hoàn tác', 'Lưu', 'In', 'Dán'], correctIndex: 0 },
  { difficulty: 'medium', prompt: '[Tự do] File có đuôi .txt thường mở bằng?', options: ['Notepad / trình soạn thảo văn bản', 'Excel tính toán', 'Paint vẽ', 'Media Player'], correctIndex: 0 },
  { difficulty: 'hard', prompt: '[Tự do] Ổ C: thường chứa gì?', options: ['Ổ chứa hệ thống Windows', 'Chỉ chứa ảnh', 'Chỉ chứa nhạc', 'Ổ ảo trên Internet'], correctIndex: 0 },
  { difficulty: 'hard', prompt: '[Tự do] Settings trong Windows dùng để?', options: ['Cài đặt hệ thống (mạng, tài khoản, hiển thị…)', 'Chỉ chơi game', 'Chỉ soạn email', 'Format bắt buộc mỗi ngày'], correctIndex: 0 },
];

async function connect() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URI;
  if (!uri) throw new Error('Thiếu MONGODB_URI / MONGO_URI trong .env');
  await mongoose.connect(uri);
}

async function ensureTopic() {
  let topic = await DailyPracticeTopic.findOne({ name: TOPIC_NAME }).lean();
  if (!topic) {
    topic = (await DailyPracticeTopic.create({
      name: TOPIC_NAME,
      description: 'Lộ trình làm quen Windows: màn hình nền, bật tắt máy, thiết bị, chuột bàn phím, quản lý tệp.',
      icon: 'monitor',
      color: 'blue',
      sortOrder: 1,
      active: true,
    })).toObject();
    console.log('✓ Đã tạo chủ đề', TOPIC_NAME);
  } else {
    console.log('✓ Dùng chủ đề có sẵn', TOPIC_NAME, String(topic._id));
  }
  return topic;
}

async function resetTopic(topicId) {
  const units = await DailyPracticeUnit.find({ topicId }).select('_id').lean();
  const unitIds = units.map((u) => u._id);
  await DailyPracticeQuestion.deleteMany({ topicId });
  await DailyPracticePathProgress.deleteMany({ topicId });
  await DailyPracticeUnit.deleteMany({ topicId });
  console.log(`✓ --reset: đã xóa ${unitIds.length} chặng + câu hỏi + tiến độ của chủ đề`);
}

function mcqDoc(topicId, unitId, q) {
  return {
    topicId,
    unitId: unitId || null,
    type: 'mcq',
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: q.options,
    correctIndex: q.correctIndex,
    hint: 'Đọc kỹ đề và loại trừ đáp án sai.',
    explanation: `Đáp án đúng: ${q.options[q.correctIndex]}`,
    status: 'published',
    source: 'starter',
  };
}

async function seedUnit(topicId, spec, sortOrder) {
  let unit = await DailyPracticeUnit.findOne({ topicId, title: spec.title });
  const pathNodes = defaultNodes(spec.lessons);
  if (!unit) {
    unit = await DailyPracticeUnit.create({
      topicId,
      title: spec.title,
      description: spec.description,
      sortOrder,
      active: true,
      pathNodes,
      videos: [],
    });
    console.log(`  + Tạo chặng: ${spec.title}`);
  } else {
    unit.title = spec.title;
    unit.description = spec.description;
    unit.sortOrder = sortOrder;
    unit.active = true;
    unit.pathNodes = pathNodes;
    await unit.save();
    console.log(`  ~ Cập nhật chặng: ${spec.title}`);
  }

  const existing = await DailyPracticeQuestion.countDocuments({ topicId, unitId: unit._id, status: 'published' });
  if (existing < 4) {
    await DailyPracticeQuestion.deleteMany({ topicId, unitId: unit._id, source: 'starter' });
    await DailyPracticeQuestion.insertMany(spec.questions.map((q) => mcqDoc(topicId, unit._id, q)));
    console.log(`    → Chèn ${spec.questions.length} câu trắc nghiệm (starter)`);
  } else {
    console.log(`    → Giữ ${existing} câu đã có (≥4)`);
  }
  return unit;
}

async function seedFree(topicId) {
  const n = await DailyPracticeQuestion.countDocuments({ topicId, unitId: null, status: 'published' });
  if (n >= 4) {
    console.log(`✓ Luyện tự do: đã có ${n} câu (unitId=null)`);
    return;
  }
  await DailyPracticeQuestion.deleteMany({ topicId, unitId: null, source: 'starter' });
  await DailyPracticeQuestion.insertMany(FREE_QUESTIONS.map((q) => mcqDoc(topicId, null, q)));
  console.log(`✓ Luyện tự do: chèn ${FREE_QUESTIONS.length} câu riêng`);
}

async function main() {
  await connect();
  const topic = await ensureTopic();
  if (RESET) await resetTopic(topic._id);

  console.log('→ Seed các chặng lộ trình…');
  for (let i = 0; i < UNITS.length; i += 1) {
    await seedUnit(topic._id, UNITS[i], i + 1);
  }
  await seedFree(topic._id);

  const units = await DailyPracticeUnit.find({ topicId: topic._id }).sort({ sortOrder: 1 }).lean();
  for (const unit of units) {
    const counts = await DailyPracticeQuestion.aggregate([
      { $match: { unitId: unit._id, status: 'published' } },
      { $group: { _id: '$difficulty', n: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    const total = (map.easy || 0) + (map.medium || 0) + (map.hard || 0);
    const lessons = unit.pathNodes?.find((n) => n.icon === 'book')?.stepVideos?.learn?.length || 0;
    console.log(`  • ${unit.title}: ${total} câu (Dễ ${map.easy || 0}/Vừa ${map.medium || 0}/Khó ${map.hard || 0}) · ${lessons} bài học · ${(unit.pathNodes || []).length} nút`);
  }

  console.log('\nXong. Vào Admin → Luyện tập → Windows cơ bản → Cấu hình để xem; HV vào Theo lộ trình để test.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Lỗi seed:', err.message || err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
