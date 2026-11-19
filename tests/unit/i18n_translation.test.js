const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('i18n constants and normalization default safely to Vietnamese', async () => {
  const {
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    LANG_STORAGE_KEY,
    MOBILE_LANG_STORAGE_KEY,
    normalizeLanguage,
    viOrEn,
  } = await import('../../shared/i18n/translate.mjs');

  assert.equal(DEFAULT_LANGUAGE, 'vi');
  assert.deepEqual(SUPPORTED_LANGUAGES, ['vi', 'en']);
  assert.equal(LANG_STORAGE_KEY, 'dewskill_lang');
  assert.equal(MOBILE_LANG_STORAGE_KEY, '@dewskill_lang');

  assert.equal(normalizeLanguage(undefined), 'vi');
  assert.equal(normalizeLanguage(null), 'vi');
  assert.equal(normalizeLanguage(''), 'vi');
  assert.equal(normalizeLanguage('fr'), 'vi');
  assert.equal(normalizeLanguage('vi'), 'vi');
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage('EN'), 'en');
  assert.equal(normalizeLanguage('en-US'), 'en');

  assert.equal(viOrEn('vi', 'Trang chủ', 'Home'), 'Trang chủ');
  assert.equal(viOrEn('en', 'Trang chủ', 'Home'), 'Home');
});

test('translateText & translateInterpolatedParts translate core Web/Mobile UI phrases accurately and preserve data', async () => {
  const { translateText, translateInterpolatedParts } = await import('../../shared/i18n/translate.mjs');

  // Default / 'vi' leaves text byte-for-byte intact
  assert.equal(translateText('Đăng nhập tài khoản', 'vi'), 'Đăng nhập tài khoản');
  assert.equal(translateText('  Luyện tập hàng ngày  ', 'vi'), '  Luyện tập hàng ngày  ');

  // Core UI phrases translate cleanly in 'en'
  for (const vi of [
    'Đăng nhập',
    'Đăng xuất',
    'Trang chủ',
    'Hồ sơ',
    'Cài đặt và hỗ trợ',
    'Luyện tập',
    'Tiếp tục',
    'Bắt đầu',
  ]) {
    const en = translateText(vi, 'en');
    assert.ok(en && en !== vi, `Expected English translation for "${vi}", got "${en}"`);
  }

  // Preserves surrounding whitespace & punctuation
  assert.match(translateText('  Đăng nhập  ', 'en'), /^\s+Sign [Ii]n\s+$/);

  // Interpolated JSX child parts preserve numeric values
  const partsVi = ['Đạt ', 8, '/', 10, ' câu đúng'];
  assert.deepEqual(translateInterpolatedParts(partsVi, 'vi'), partsVi);
  const partsEn = translateInterpolatedParts(partsVi, 'en');
  assert.ok(Array.isArray(partsEn));
  assert.ok(partsEn.includes(8) && partsEn.includes(10));
  const joinedEn = partsEn.map((p) => String(p)).join('');
  assert.ok(!/[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(joinedEn), joinedEn);

  // Emails, URLs, and raw codes stay untouched
  assert.equal(translateText('hotro@thangtinhoc.vn', 'en'), 'hotro@thangtinhoc.vn');
  assert.equal(translateText('https://dewskill.vn/practice', 'en'), 'https://dewskill.vn/practice');
  assert.equal(translateText('TTH-XXXX-XXXX', 'en'), 'TTH-XXXX-XXXX');
});

test('Web app wires LanguageProvider, DOM auto-translator, logout persistence, and switchers', () => {
  const logoutStorage = read('client/src/utils/logoutStorage.js');
  assert.match(logoutStorage, /'dewskill_lang'/);

  const appJsx = read('client/src/App.jsx');
  assert.match(appJsx, /import\s+\{\s*LanguageProvider\s*\}\s+from\s+'\.\/context\/LanguageContext'/);
  assert.match(appJsx, /<LanguageProvider>[\s\S]*<\/LanguageProvider>/);

  const switcher = read('client/src/components/LanguageSwitcher.jsx');
  assert.match(switcher, /data-no-translate="true"/);
  assert.match(switcher, /Tiếng Việt/);
  assert.match(switcher, /English/);

  for (const rel of [
    'client/src/components/LoginPage.jsx',
    'client/src/components/FreePortalPage.jsx',
    'client/src/components/AdminLoginPage.jsx',
    'client/src/components/student/StudentProfileTab.jsx',
    'client/src/components/teacher/TeacherProfileTab.jsx',
  ]) {
    assert.match(read(rel), /<LanguageSwitcher\b/, `${rel} should render <LanguageSwitcher />`);
  }
  assert.doesNotMatch(read('client/src/components/DashboardLayout.jsx'), /<LanguageSwitcher\b/);

  const webShare = read('client/src/components/student/ShareAchievementModal.jsx');
  assert.match(webShare, /useLanguage/);
  assert.match(webShare, /translateText/);
});

test('Mobile app wires LanguageProvider, Metro react-native wrapper, switchers, and native share translation', () => {
  const appTsx = read('thang-tin-hoc-mobile/App.tsx');
  assert.match(appTsx, /<LanguageProvider>[\s\S]*<NavigationContainer[\s\S]*<\/LanguageProvider>/);

  const metroConfig = read('thang-tin-hoc-mobile/metro.config.js');
  assert.match(metroConfig, /moduleName === 'react-native'/);
  assert.match(metroConfig, /moduleName === 'react-native-web'/);
  assert.match(metroConfig, /webShims/);
  assert.match(metroConfig, /reactNativeTranslated\.ts/);

  for (const shimName of ['Alert', 'Animated', 'Button', 'RefreshControl', 'Share', 'Text', 'TextInput']) {
    const shimRel = `thang-tin-hoc-mobile/src/i18n/webShims/${shimName}.ts`;
    assert.equal(fs.existsSync(path.join(ROOT, shimRel)), true, `Missing web shim: ${shimRel}`);
  }

  const rnWrapper = read('thang-tin-hoc-mobile/src/i18n/reactNativeTranslated.ts');
  for (const symbol of ['RawText', 'Text', 'TextInput', 'Animated', 'Alert', 'translateInterpolatedParts', 'translateText']) {
    assert.match(rnWrapper, new RegExp(`\\b${symbol}\\b`), `reactNativeTranslated.ts missing ${symbol}`);
  }

  const mobileSwitcher = read('thang-tin-hoc-mobile/src/components/LanguageSwitcher.tsx');
  assert.match(mobileSwitcher, /RawText/);
  assert.match(mobileSwitcher, /Tiếng Việt/);
  assert.match(mobileSwitcher, /English/);

  for (const rel of [
    'thang-tin-hoc-mobile/src/screens/LoginScreen.tsx',
    'thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx',
    'thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx',
    'thang-tin-hoc-mobile/src/screens/ParityScreens.tsx',
  ]) {
    assert.match(read(rel), /<LanguageSwitcher\b/, `${rel} should render <LanguageSwitcher />`);
  }
  assert.doesNotMatch(read('thang-tin-hoc-mobile/src/components/ui.tsx'), /<LanguageSwitcher\b/);

  const rootNav = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  assert.match(rootNav, /translateText\(/);

  const mobileShare = read('thang-tin-hoc-mobile/src/components/ShareAchievementModal.tsx');
  assert.match(mobileShare, /useLanguage/);
  assert.match(mobileShare, /translateText/);
});

test('Settings & support card defaults collapsed and expands on click across Mobile and Web profiles', () => {
  const mobileProfile = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  assert.match(mobileProfile, /useState\(false\);\s*[\r\n]/);
  assert.match(mobileProfile, /const \[showSupportSettings, setShowSupportSettings\] = useState\(false\)/);
  assert.match(mobileProfile, /accessibilityState=\{\{\s*expanded:\s*showSupportSettings\s*\}\}/);
  assert.match(mobileProfile, /\{showSupportSettings \?/);

  const webStudentProfile = read('client/src/components/student/StudentProfileTab.jsx');
  assert.match(webStudentProfile, /support:\s*false/);
  assert.match(webStudentProfile, /toggleSection\('support'\)/);
  assert.match(webStudentProfile, /\{openSections\.support &&/);

  const webTeacherProfile = read('client/src/components/teacher/TeacherProfileTab.jsx');
  assert.match(webTeacherProfile, /const \[showSupportSettings, setShowSupportSettings\] = useState\(false\)/);
  assert.match(webTeacherProfile, /\{showSupportSettings &&/);
});

test('Student, Teacher, Shared, and Mobile regression phrases translate completely to English without mixed fragments', async () => {
  const { translateText, translateInterpolatedParts } = await import('../../shared/i18n/translate.mjs');
  const VI_ACCENT_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

  const expectedCases = [
    ['3/3 xong', '3/3 done'],
    ['0/4 ngày', '0/4 days'],
    ['2 giờ 20 phút', '2 hr 20 min'],
    ['Lên Bạc: 58p', 'Next (Silver): 58m'],
    ['Rank Kim Cương · Mục tiêu 5g/ngày', 'Diamond Rank · Goal: 5h/day'],
    ['0 bạn · +0 XP', '0 invited · +0 XP'],
    ['0 ngày đạt · 2 phút — Học thêm 5 phút để vượt #4.', '0 goal days · 2 min — Study 5 min more to pass #4.'],
    ['ĐÃ HOÀN THÀNH HÔM NAY', 'COMPLETED TODAY'],
    ['ÔN TẬP THÊM', 'PRACTICE MORE'],
    ['Gửi mã cho bạn bè cùng học — cả 2 nhận ngay +50 XP!', 'Share your code with friends — both get +50 XP!'],
    ['MÃ CỦA BẠN', 'YOUR CODE'],
    ['Nhận XP', 'Claim XP'],
    ['Cập nhật mật khẩu đăng nhập', 'Update your sign-in password'],
    ['Phiên bản 1.0.0 • Kênh web', 'Version 1.0.0 • Channel web'],
    ['Tháng 1', 'Month 1'],
    ['Tháng 12', 'Month 12'],
    ['Mở khóa thi lại', 'Unlock Retake'],
    ['KHÔNG GIAN LÀM VIỆC', 'WORKSPACE'],
    ['KHÔNG GIAN HỌC TẬP', 'LEARNING SPACE'],
    ['Tiến độ: 4/10 buổi', 'Progress: 4/10 sessions'],
    ['Đúng', 'Correct'],
    ['Chưa làm', 'Not Started'],
    ['Nâng cấp', 'Upgrade'],
    ['Vào lớp ngay', 'Join Class Now'],
  ];

  for (const [vi, enExpected] of expectedCases) {
    const out = translateText(vi, 'en');
    assert.equal(out, enExpected, `Expected "${vi}" -> "${enExpected}", got "${out}"`);
    assert.ok(!VI_ACCENT_RE.test(out), `Leaked Vietnamese diacritics for "${vi}": "${out}"`);
  }

  // Mixed interpolated parts matching JSX fragments like {done}/{total} xong and {count} bạn · +{xp} XP
  const questParts = translateInterpolatedParts([3, '/', 3, ' xong'], 'en');
  assert.equal(questParts.map(String).join(''), '3/3 done');

  const refParts = translateInterpolatedParts([2, ' bạn · +', 50, ' XP'], 'en');
  assert.equal(refParts.map(String).join(''), '2 invited · +50 XP');

  // Verify Metro Windows normalization & DOM grouped element translation helpers are wired
  const metroConfig = read('thang-tin-hoc-mobile/metro.config.js');
  assert.match(metroConfig, /normPath/);
  const rnWrapper = read('thang-tin-hoc-mobile/src/i18n/reactNativeTranslated.ts');
  assert.match(rnWrapper, /flattenChildren/);
  const domTranslator = read('client/src/i18n/domAutoTranslator.js');
  assert.match(domTranslator, /syncTextGroupElement/);
  assert.match(domTranslator, /getDirectTextNodes/);
});

test('weekday dates, subscription plan cycles, AI welcome message, and AI query language detection', async () => {
  const { translateText } = await import('../../shared/i18n/translate.mjs');
  const { detectQueryLanguage } = require('../../services/aiSupportService');

  const VI_ACCENT_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

  const exactCases = [
    ['Gói 3 tháng', '3-Month Plan'],
    ['500 XP mỗi ngày · Còn 81 ngày', '500 XP/day · 81 days left'],
    ['500 XP mỗi ngày · 81 days left', '500 XP/day · 81 days left'],
    ['Thứ Năm, 19/11/2026', 'Thursday, 19/11/2026'],
    ['Chủ Nhật, 22/11/2026', 'Sunday, 22/11/2026'],
  ];

  for (const [input, expected] of exactCases) {
    const out = translateText(input, 'en');
    assert.equal(out, expected, `Expected "${input}" -> "${expected}", got "${out}"`);
    assert.ok(!VI_ACCENT_RE.test(out), `Leaked Vietnamese diacritics for "${input}": "${out}"`);
  }

  const viWelcome = 'Xin chào 0988888888! Mình là Trợ lý AI Tin Học của Thắng Tin Học. Mình hỗ trợ Word, Excel, PowerPoint, MOS, LMS và học tập. Bạn hỏi gì về tin học cũng được nhé!';
  const enWelcome = translateText(viWelcome, 'en');
  assert.ok(!VI_ACCENT_RE.test(enWelcome), `Welcome message still had Vietnamese: "${enWelcome}"`);
  assert.match(enWelcome, /Hello 0988888888!/);
  assert.match(enWelcome, /Office IT AI Assistant at Thang Tin Hoc/);

  assert.equal(detectQueryLanguage('hello what is sumif do you'), 'en');
  assert.equal(detectQueryLanguage('hàm sumif dùng thế nào'), 'vi');
  assert.equal(
    detectQueryLanguage(
      '[Hình ảnh]',
      [{ senderId: 'u1', messageType: 'text', content: 'please help me with this VLOOKUP error' }],
    ),
    'en',
  );
});

test('mobile app strings and dynamic templates translate without leaking Vietnamese diacritics', async () => {
  const { translateText } = await import('../../shared/i18n/translate.mjs');
  const VI_DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
  const cases = [
    ['7 ngày', '7 days'],
    ['Hôm nay đã đạt 50 XP', '50 XP earned today'],
    ['Đạt 80% · Chu kỳ đã kết thúc', '80% achieved · Cycle ended'],
    ['Chặng 2 · Lộ trình trong chặng', 'Unit 2 · Unit Path'],
    ['Chặng 2 · Đạt 80% để vượt chặng', 'Unit 2 · Score 80% to pass'],
    ['Đăng ký gói để mở Chặng 2', 'Subscribe to unlock Unit 2'],
    ['19 tháng 11, 2 buổi', '19/11 — 2 sessions'],
    ['Hạn: 25/11/2026 · còn 6 ngày', 'Expires: 25/11/2026 · 6 days left'],
    ['Buổi 3: Đã điểm danh hoàn thành buổi học', 'Session 3: Marked session as completed'],
    ['Không thể tải tài nguyên: tài khoản mobile không hợp lệ.', 'Unable to load materials: invalid account.'],
    ['Tạo bài\ntập mới', 'New\nAssignment'],
    ['Lưu mục tiêu', 'Save Goal'],
    ['Lưu ghi chú', 'Save Notes'],
    ['Lưu thông tin', 'Save Info'],
    ['Lưu tiến độ', 'Save Progress'],
    ['45 min / 2 giờ', '45 min / 2 hr'],
    ['1 giờ 30 phút / 2 giờ', '1 hr 30 min / 2 hr'],
    ['Gia hạn tài khoản 3 tháng', 'Renew Account (3 months)'],
    ['Gói tài khoản của Alex đã hết hạn ngày 25/11/2026. Gia hạn để tiếp tục học - tiến độ học vẫn được giữ nguyên.', "Alex's account plan expired on 25/11/2026. Renew to continue learning — all your progress is saved."],
    ['AI chưa chấp nhận (−5 XP). Hãy gửi ảnh mới.', 'Not accepted by AI (−5 XP). Please submit a new screenshot.'],
    ['Chưa đúng (−5 XP). Hãy chọn lại nhé!', 'Incorrect (−5 XP). Please try choosing again!'],
    ['Đúng lần đầu +5 XP và xem tiếp. Sai mất 5 XP rồi nhập lại.', 'First try +5 XP and continue. Wrong deducts 5 XP before entering again.'],
    ['Chưa có câu đến hạn hôm nay (5 câu sẽ nhắc lại từ 25/11/2026). Bạn vẫn có thể ôn sớm ngay!', 'None due today (5 upcoming starting 25/11/2026). Review early anytime!'],
    ['Đạt 80% để vượt chặng', 'Score 80% to pass'],
    ['Chưa qua bước Excel', 'Did not pass step Excel'],
    ['Chưa qua bài kiểm tra vượt chặng', 'Did not pass the jump-ahead test'],
    ['Thực hành: Chờ chấm', 'Practice: Pending grading'],
    ['Thoát giữa giờ · Chuyển tab', 'Left mid-quiz · Switched tab'],
    ['Chống tua video', 'Fast-forward disabled'],
    ['Đã thêm 10 câu. Bỏ qua 2 dòng không hợp lệ.', 'Added 10 questions. Skipped 2 invalid rows.'],
    ['Tích lũy 1.250 XP, bấm để mua thêm XP', 'Total 1.250 XP accumulated, tap to buy more XP'],
    ['BẢNG KÊ THU NHẬP THÁNG 11/2026', 'INCOME STATEMENT — MONTH 11/2026'],
    ['Tổng 4 buổi', 'Total 4 sessions'],
    ['6 học viên tham gia', '6 learners'],
    ['6 HV', '6 learners'],
    ['16/11 – 22/11 · 6 học viên tham gia', '16/11 – 22/11 · 6 learners'],
    ['Xem video', 'Watch Video'],
    ['Xem video YouTube', 'Watch YouTube Video'],
    ['Tải lại trang sẽ mất XP!', 'Reloading will cost XP!'],
    ['Lượt luyện tập trước đã hủy', 'Previous Practice Session Canceled'],
    ['Mất tối đa −25 XP nếu tải lại', 'Up to −25 XP penalty if reloading'],
    [
      'Bạn vừa tải lại hoặc rời trang khi đang luyện. Lượt đó đã bị hủy (có thể mất tối đa −25 XP). Lần sau bấm Thoát hoặc F5 để xác nhận trước khi rời.',
      'You reloaded or left during practice. That session was canceled (up to −25 XP lost). Please confirm via Exit next time.',
    ],
    [
      'Bạn vừa tải lại hoặc rời trang khi đang luyện. Lượt trước đã bị hủy — hãy bắt đầu lượt mới khi sẵn sàng.',
      'You reloaded or left during practice. The previous session was canceled — start a new one when ready.',
    ],
    [
      'Bạn vừa tải lại hoặc rời trang khi đang luyện. Lượt trước đã bị hủy — bắt đầu lượt mới khi sẵn sàng.',
      'You reloaded or left during practice. The previous session was canceled — start a new one when ready.',
    ],
    [
      'Đây là lượt bắt buộc. Tải lại trang lúc này sẽ hủy lượt và mất tối đa −25 XP.',
      'Mandatory round. Reloading now cancels the session and loses up to −25 XP.',
    ],
    [
      'Tải lại trang lúc này sẽ hủy lượt luyện tập và mất tối đa −25 XP.',
      'Reloading now cancels the practice session and loses up to −25 XP.',
    ],
    [
      'Tải lại trang lúc này sẽ hủy tiến độ lượt luyện tập hiện tại.',
      'Reloading now will cancel your current practice progress.',
    ],
    ['Tải lại và mất tối đa 25 XP', 'Reload & Lose up to 25 XP'],
    ['Địa chỉ URL', 'URL Address'],
    ['Thay đổi chưa lưu', 'Unsaved Changes'],
    ['Chỉ chọn file ảnh (JPG, PNG, WEBP, GIF).', 'Please select an image file only (JPG, PNG, WEBP, GIF).'],
  ];

  for (const [vi, expected] of cases) {
    const out = translateText(vi, 'en');
    assert.equal(out, expected);
    assert.equal(VI_DIACRITIC.test(out), false, `Vietnamese leak in "${vi}" -> "${out}"`);
  }
});
