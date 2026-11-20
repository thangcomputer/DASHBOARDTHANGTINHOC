const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const VI_DIACRITIC_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

test('All reported login, free-portal, lockout, textarea, and notification strings translate cleanly to English', async () => {
  const { translateText } = await import('../../shared/i18n/translate.mjs');

  const cases = [
    // Screenshot 1 - Notification Center
    ['Trang 1 / 31', 'Page 1 / 31'],
    ['📚 Học viên mới được giao', '📚 New Student Assigned'],
    ['✅ Học viên đã xác nhận điểm danh', '✅ Student Confirmed Attendance'],
    ['❌ Buổi điểm danh bù không được tính', '❌ Makeup Attendance Declined'],
    ['📋 Admin đã điểm danh bù', '📋 Admin Makeup Credited'],
    [
      'Admin (ADMIN HIGHT) đã điểm danh bù buổi thứ 4/10 cho NGUYỄN THỊ TUYẾT NHUNG - TIN HỌC VĂN PHÒNG NC (1 KÈM 1), ngày 19/11/2026. Buổi học được tính vào tiến độ và lương buổi.',
      'Admin (ADMIN HIGHT) marked makeup attendance (Session 4/10) for NGUYỄN THỊ TUYẾT NHUNG — TIN HỌC VĂN PHÒNG NC (1 KÈM 1) on 19/11/2026. Session counts toward progress and session pay.',
    ],
    [
      'Học viên BÙI THỊ DUNG (KHÓA HỌC EXCEL (1 KÈM 1)) đã được giao cho bạn.',
      'Student BÙI THỊ DUNG (KHÓA HỌC EXCEL (1 KÈM 1)) has been assigned to you.',
    ],
    [
      'HV VÕ THỊ NGỌC PHƯƠNG đồng ý buổi 7 - buổi đã được tính.',
      'Student VÕ THỊ NGỌC PHƯƠNG confirmed Session 7 — session credited.',
    ],
    [
      'Admin (ADMIN HIGHT) không tính buổi điểm danh bù của LƯU THỊ KIỀU LINH - TIN HỌC VĂN PHÒNG CB (1 KÈM 1), ngày 19/11/2026 (buổi 2). Buổi này không tính tiến độ/lương. Bạn được xếp thêm 1 ca cho học viên.',
      'Admin (ADMIN HIGHT) declined makeup attendance for LƯU THỊ KIỀU LINH — TIN HỌC VĂN PHÒNG CB (1 KÈM 1) on 19/11/2026 (Session 2). Not counted toward progress/pay; you may schedule 1 extra session.',
    ],
    // Screenshots 2 & 3 - Textarea placeholders
    ['Nhận xét cá nhân, ghi nhận đặc biệt về học viên này...', 'Private notes or observations on this student...'],
    ['Chia sẻ trải nghiệm học của bạn...', 'Share your learning experience...'],
    // Screenshots 4-7 - Login & FreePortal & Lock policy
    [
      'Tài khoản giảng viên không tồn tại. Vui lòng đăng ký hoặc liên hệ Học vụ để được cấp tài khoản.',
      'Teacher account does not exist. Please register or contact Academic Affairs to get an account.',
    ],
    [
      'Tài khoản không tồn tại. Vui lòng đăng ký tài khoản mới để bắt đầu học.',
      'Account does not exist. Please register a new account to start learning.',
    ],
    [
      'Lưu ý: Nhập sai mật khẩu quá 5 lần sẽ tạm khóa đăng nhập 900 giây (15 phút).',
      'Note: Entering the wrong password 5 times will temporarily lock login for 900 seconds (15 minutes).',
    ],
    [
      'Note: Nhập sai mật khẩu quá 5 lần sẽ tạm khóa đăng nhập 900 giây (15 phút).',
      'Note: Entering the wrong password 5 times will temporarily lock login for 900 seconds (15 minutes).',
    ],
    ['Địa chỉ Gmail này đã được sử dụng. Vui lòng đăng nhập.', 'This Gmail address is already in use. Please sign in.'],
    // Concise lockout banners & rate-limit messages
    ['Mật khẩu không đúng.', 'Incorrect password.'],
    ['Sai mật khẩu quá 5 lần.', 'Too many wrong password attempts (5).'],
    ['Còn 2/5 lần thử (khóa 900 giây).', '2/5 attempts left (900s lock).'],
    ['Tạm khóa 900 giây — thử lại sau 845s.', 'Locked 900s — retry in 845s.'],
    ['Còn 2/5 lần thử nữa sẽ bị tạm khóa 900 giây.', '2/5 attempts remaining before a 900-second temporary lock.'],
    ['Đang tạm khóa đăng nhập — còn 845 giây (thời gian khóa 900 giây).', 'Login temporarily locked — 845s remaining (900s lock).'],
    ['Thử lại sau 845s', 'Retry in 845s'],
    [
      'Bạn đã nhập sai mật khẩu quá 5 lần. Tài khoản tạm khóa 900 giây, vui lòng thử lại sau 900 giây.',
      'Too many wrong password attempts (5). Temporarily locked for 900s — please try again in 900s.',
    ],
    ['Quá nhiều yêu cầu từ địa chỉ này. Vui lòng thử lại sau một lúc.', 'Too many requests from this address. Please try again shortly.'],
    ['Phiên thiết bị đã bị đăng xuất từ xa. Vui lòng đăng nhập lại.', 'This device session was signed out remotely. Please sign in again.'],
    ['Nhập mã OTP 6 số đã gửi qua Zalo/Email (đã đăng ký)', 'Enter the 6-digit OTP sent via Zalo/Email (registered)'],
    ['Học viên · Gửi qua Gmail: demo@gmail.com', 'Student: Sent via Gmail: demo@gmail.com'],
    ['Giảng viên · Gửi qua tin nhắn SĐT: 0901234567', 'Teacher: Sent via SMS phone: 0901234567'],
    ['Học viên P*** đã đánh giá', 'Student P*** submitted a review'],
    ['Đã gửi lại mã xác thực tới 0935758462', 'Resent verification code to 0935758462'],
  ];

  for (const [vi, expectedEn] of cases) {
    const out = translateText(vi, 'en');
    assert.equal(out, expectedEn, `Expected "${vi}" -> "${expectedEn}", got "${out}"`);
  }

  const dynamicMessages = [
    'Admin (ADMIN HIGHT) đã điểm danh bù buổi thứ 4/10 cho NGUYỄN THỊ TUYẾT NHUNG - TIN HỌC VĂN PHÒNG NC (1 KÈM 1), ngày 19/11/2026. Buổi học được tính vào tiến độ và lương buổi.',
    'Học viên BÙI THỊ DUNG (KHÓA HỌC EXCEL (1 KÈM 1)) đã được giao cho bạn.',
    'HV VÕ THỊ NGỌC PHƯƠNG đồng ý buổi 7 - buổi đã được tính.',
    'Admin (ADMIN HIGHT) không tính buổi điểm danh bù của LƯU THỊ KIỀU LINH - TIN HỌC VĂN PHÒNG CB (1 KÈM 1), ngày 19/11/2026 (buổi 2). Buổi này không tính tiến độ/lương. Bạn được xếp thêm 1 ca cho học viên.',
    'HV THÁI ANH KIỆT đã hoàn thành khóa PYTHON (12 buổi).',
  ];
  for (const msg of dynamicMessages) {
    const out = translateText(msg, 'en');
    assert.notEqual(out, msg);
    assert.ok(!/buổi|đã được|đồng ý|không tính|đã điểm danh|tiến độ|lương/i.test(out), `Untranslated scaffolding in: ${out}`);
  }
});

test('domAutoTranslator translates textarea attributes while skipping user-typed textarea text nodes', async () => {
  const makeEl = (tag, attrs = {}) => {
    const attrMap = new Map(Object.entries(attrs));
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      parentElement: null,
      parentNode: null,
      childNodes: [],
      dataset: {},
      className: '',
      isConnected: true,
      get attributes() {
        return Array.from(attrMap.entries()).map(([name, value]) => ({ name, value }));
      },
      hasAttribute(name) {
        return attrMap.has(name);
      },
      getAttribute(name) {
        return attrMap.has(name) ? attrMap.get(name) : null;
      },
      setAttribute(name, val) {
        attrMap.set(name, String(val));
      },
      removeAttribute(name) {
        attrMap.delete(name);
      },
      matches(selector) {
        const parts = String(selector || '').split(',').map((s) => s.trim().toLowerCase());
        return parts.includes(el.tagName.toLowerCase());
      },
      closest(selector) {
        const parts = String(selector || '').split(',').map((s) => s.trim().toLowerCase());
        let cur = el;
        while (cur) {
          if (cur.tagName && parts.includes(cur.tagName.toLowerCase())) return cur;
          if (parts.some((p) => p.startsWith('[') && cur.hasAttribute && cur.hasAttribute(p.slice(1, -1).split('=')[0]))) {
            return cur;
          }
          cur = cur.parentElement;
        }
        return null;
      },
      append(child) {
        child.parentElement = el;
        child.parentNode = el;
        el.childNodes.push(child);
      },
    };
    return el;
  };

  const makeText = (val) => ({
    nodeType: 3,
    nodeValue: val,
    parentElement: null,
    parentNode: null,
  });

  const container = makeEl('div');
  const ta1 = makeEl('textarea', {
    placeholder: 'Nhận xét cá nhân, ghi nhận đặc biệt về học viên này...',
    title: 'Ghi chú học viên',
  });
  const ta1UserText = makeText('Học viên làm bài tốt, giữ nguyên nội dung này');
  ta1.append(ta1UserText);

  const ta2 = makeEl('textarea', {
    placeholder: 'Chia sẻ trải nghiệm học của bạn...',
    'aria-label': 'Đánh giá khóa học',
  });

  const pager = makeEl('span');
  const pagerText = makeText('Trang 1 / 31');
  pager.append(pagerText);

  container.append(ta1);
  container.append(ta2);
  container.append(pager);

  const walkNodes = (node, list = []) => {
    list.push(node);
    for (const ch of node.childNodes || []) walkNodes(ch, list);
    return list;
  };

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevNodeFilter = globalThis.NodeFilter;
  try {
    globalThis.NodeFilter = { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1 };
    globalThis.document = {
      title: 'Đăng nhập',
      documentElement: { lang: 'vi', setAttribute() {} },
      body: container,
      createTreeWalker(root, whatToShow) {
        const all = walkNodes(root, []);
        const filtered = all.filter((n) => {
          if (n === root) return false;
          if (n.nodeType === 1 && (whatToShow & 1)) return true;
          if (n.nodeType === 3 && (whatToShow & 4)) return true;
          return false;
        });
        let idx = -1;
        return {
          nextNode() {
            idx += 1;
            return idx < filtered.length ? filtered[idx] : null;
          },
        };
      },
    };
    globalThis.window = globalThis;

    const { translateSubtree } = await import('../../client/src/i18n/domAutoTranslator.js');
    translateSubtree(container, 'en');

    assert.equal(ta1.getAttribute('placeholder'), 'Private notes or observations on this student...');
    assert.equal(ta1.getAttribute('title'), 'Student Notes');
    assert.equal(ta1UserText.nodeValue, 'Học viên làm bài tốt, giữ nguyên nội dung này');
    assert.equal(ta2.getAttribute('placeholder'), 'Share your learning experience...');
    assert.equal(ta2.getAttribute('aria-label'), 'Course Review');
    assert.equal(pagerText.nodeValue, 'Page 1 / 31');

    translateSubtree(container, 'vi');
    assert.equal(ta1.getAttribute('placeholder'), 'Nhận xét cá nhân, ghi nhận đặc biệt về học viên này...');
    assert.equal(ta2.getAttribute('placeholder'), 'Chia sẻ trải nghiệm học của bạn...');
    assert.equal(pagerText.nodeValue, 'Trang 1 / 31');
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.NodeFilter = prevNodeFilter;
  }
});

test('Static UI copy across Login, FreePortal, AdminLogin, ForgotPassword, and NotificationCenter has zero untranslated Vietnamese strings', async () => {
  const { translateText } = await import('../../shared/i18n/translate.mjs');
  const rootDir = path.resolve(__dirname, '..', '..');
  const files = [
    'client/src/components/LoginPage.jsx',
    'client/src/components/FreePortalPage.jsx',
    'client/src/components/AdminLoginPage.jsx',
    'client/src/components/ForgotPasswordModal.jsx',
    'client/src/components/NotificationCenterPage.jsx',
    'client/src/components/student/StudentNoActiveCoursePage.jsx',
    'client/src/components/ui/LoginLockNotice.jsx',
  ];

  const literalRe = /(['"`])((?:\\.|(?!\1).)+)\1/g;
  const leftover = [];

  for (const rel of files) {
    const src = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    src.split(/\r?\n/).forEach((line, idx) => {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
      let m;
      while ((m = literalRe.exec(line)) !== null) {
        const val = m[2].trim();
        if (!VI_DIACRITIC_RE.test(val) || val.includes('${')) continue;
        const tr = translateText(val, 'en');
        if (VI_DIACRITIC_RE.test(tr)) {
          leftover.push(`${rel}:${idx + 1}: "${val}" -> "${tr}"`);
        }
      }
    });
  }

  assert.deepEqual(leftover, []);
});
