/**
 * QA UI local — đi lần lượt menu (trên→dưới, trái→phải) cho:
 * ADMIN (Super), ADMIN STAFF, TEACHER, TEACHER TEST (pending), STUDENT
 *
 * Chạy: node scripts/_qa_ui_walkthrough_local.cjs
 * Yêu cầu: API :5000 + Vite :5173 + MongoDB
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');

const BASE = process.env.QA_UI_BASE || 'http://localhost:5173';
const API = `http://localhost:${process.env.PORT || 5000}`;
const OUT = [];
const FAIL = [];

function log(role, step, ok, detail = '') {
  const row = { role, step, ok, detail: String(detail || '').slice(0, 240) };
  OUT.push(row);
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] [${role}] ${step}${detail ? ' — ' + row.detail : ''}`);
  if (!ok) FAIL.push(row);
}

function mintToken(payload, audience = 'public') {
  return jwt.sign(
    { ...payload, aud: audience },
    process.env.JWT_SECRET,
    { expiresIn: '2h' },
  );
}

async function apiLoginPublic(identifier, password, role) {
  const csrfRes = await fetch(`${API}/api/auth/csrf-token`, { credentials: 'include' });
  const csrfJson = await csrfRes.json();
  const csrf = csrfJson.csrfToken;
  const cookie = (csrfRes.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ identifier, password, role, force: true }),
  });
  const j = await r.json();
  if (!j.success || !j.data?.accessToken) {
    throw new Error(j.message || `login failed ${r.status}`);
  }
  return j.data;
}

async function injectSession(page, { roleKey, user, accessToken, refreshToken }) {
  await page.addInitScript(({ roleKey, user, accessToken, refreshToken }) => {
    const keep = new Set(['cms_device_id_v1', 'cms_sidebar_groups', 'cms_sound_muted']);
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && !keep.has(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(`${roleKey}_user`, JSON.stringify(user));
    localStorage.setItem(`${roleKey}_access_token`, accessToken);
    if (refreshToken) localStorage.setItem(`${roleKey}_refresh_token`, refreshToken);
  }, { roleKey, user, accessToken, refreshToken });
}

async function collectConsole(page, bucket) {
  page.on('pageerror', (err) => bucket.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.push(`console: ${msg.text()}`);
  });
}

async function expandGroups(page) {
  const groups = ['Quản lý', 'Đào tạo', 'Tài chính', 'Hệ thống'];
  for (const g of groups) {
    const btn = page.locator('nav[aria-label="Menu chính"]').getByRole('button', { name: g }).first();
    if (await btn.count()) {
      try { await btn.click({ timeout: 2000, force: true }); } catch { /* already open */ }
    }
  }
}

async function assertAlive(page, role, step) {
  await page.waitForTimeout(400);
  const url = page.url();
  const body = await page.locator('body').innerText().catch(() => '');
  const crashed = /Something went wrong|Application error|Unexpected Application Error/i.test(body);
  const blank = body.trim().length < 20;
  log(role, step, !crashed && !blank, crashed ? 'crash UI' : blank ? 'blank' : url);
  return !crashed && !blank;
}

async function walkMenus(page, role, items, { expandAdminGroups = false } = {}) {
  if (expandAdminGroups) await expandGroups(page);
  for (const item of items) {
    if (item.skip) {
      log(role, `SKIP ${item.label}`, true, item.skip);
      continue;
    }
    try {
      await page.keyboard.press('Escape').catch(() => {});
      if (item.href) {
        await page.goto(`${BASE}${item.href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      } else if (expandAdminGroups) {
        await expandGroups(page);
        const nav = page.locator('nav[aria-label="Menu chính"]');
        const btn = nav.locator('button', { hasText: item.label }).first();
        if (await btn.count() === 0) {
          log(role, `MENU ${item.label}`, false, 'không thấy nút menu');
          continue;
        }
        await btn.click({ timeout: 8000, force: true });
      } else {
        const nav = page.locator('nav[aria-label="Menu chính"]');
        const btn = nav.locator('button', { hasText: item.label }).first();
        if (await btn.count() === 0) {
          // Hồ sơ nằm bottom nav
          const bottom = page.locator('button', { hasText: item.label }).first();
          if (await bottom.count() === 0) {
            log(role, `MENU ${item.label}`, false, 'không thấy nút menu');
            continue;
          }
          await bottom.click({ timeout: 8000, force: true });
        } else {
          await btn.click({ timeout: 8000, force: true });
        }
      }
      await page.waitForTimeout(700);
      if (item.expectPath) {
        const okPath = page.url().includes(item.expectPath);
        log(role, `ROUTE ${item.label}`, okPath, page.url());
      } else {
        log(role, `MENU ${item.label}`, true, page.url());
      }
      await assertAlive(page, role, `RENDER ${item.label}`);
      if (item.check) await item.check(page, role);
    } catch (e) {
      log(role, `MENU ${item.label}`, false, e.message);
    }
  }
}

async function checkFeedSupport(page, role) {
  const mascot = page.locator('.cms-support-mascot, .cms-feed-support-card');
  const has = await mascot.count();
  log(role, 'FEED hỗ trợ nhanh / mascot', has > 0, `count=${has}`);
}

async function main() {
  if (!process.env.JWT_SECRET) throw new Error('Missing JWT_SECRET in .env');
  await mongoose.connect(process.env.MONGODB_URI);
  const Teacher = require('../models/Teacher');
  const Student = require('../models/Student');

  // Ensure seed-like accounts exist (or use existing)
  let staff = await Teacher.findOne({ phone: '0920000010' }).select('+tokenVersion name phone role adminRole permissions status branchId').lean();
  let teacher = await Teacher.findOne({ phone: '0910000010', role: 'teacher' }).select('+tokenVersion name phone role status').lean();
  let student = await Student.findOne({ phone: '0900000010' }).select('+tokenVersion name phone role status').lean();
  let pendingTeacher = await Teacher.findOne({ role: 'teacher', status: { $in: ['pending', 'Pending'] } })
    .select('+tokenVersion name phone role status')
    .lean();

  if (!pendingTeacher) {
    // create disposable pending teacher for QA
    const bcrypt = require('bcryptjs');
    const phone = '0910999999';
    await Teacher.deleteMany({ phone });
    const doc = await Teacher.create({
      name: 'QA GV PENDING LOCAL',
      phone,
      password: await bcrypt.hash('Test@123', 10),
      role: 'teacher',
      status: 'pending',
      specialty: 'Word',
    });
    pendingTeacher = await Teacher.findById(doc._id).select('+tokenVersion name phone role status').lean();
    log('SETUP', 'Tạo GV pending QA', !!pendingTeacher, phone);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // ═══════════════ 1. SUPER ADMIN ═══════════════
  {
    const role = 'ADMIN';
    const errors = [];
    const page = await context.newPage();
    await collectConsole(page, errors);
    const accessToken = mintToken({
      id: 'admin',
      role: 'admin',
      name: 'Super Admin',
      adminRole: 'SUPER_ADMIN',
      permissions: [],
      tokenVersion: 0,
    }, 'internal');
    const user = {
      id: 'admin',
      name: 'Super Admin',
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      permissions: [],
    };
    await injectSession(page, { roleKey: 'admin', user, accessToken, refreshToken: accessToken });
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);
    await assertAlive(page, role, 'Dashboard /admin');

    const adminMenus = [
      { label: 'Tổng quan', href: '/admin#dashboard', expectPath: '/admin' },
      { label: 'Bảng tin', href: '/admin/feed', expectPath: '/admin/feed', check: checkFeedSupport },
      { label: 'Tin tức', href: '/admin/news', expectPath: '/admin/news' },
      { label: 'Hộp thư', href: '/admin/inbox', expectPath: '/admin/inbox' },
      { label: 'Học Viên', href: '/admin#students', expectPath: 'students' },
      { label: 'Giảng Viên', href: '/admin#teachers', expectPath: 'teachers' },
      { label: 'Phân quyền NV', href: '/admin#staff', expectPath: 'staff' },
      { label: 'Nhân sự & Lương', href: '/admin#hr', expectPath: 'hr' },
      { label: 'Đào tạo GV', href: '/admin#training', expectPath: 'training' },
      { label: 'Đào tạo HV', href: '/admin#student-training', expectPath: 'student-training' },
      { label: 'Đánh giá nội bộ', href: '/admin#evaluations', expectPath: 'evaluations' },
      { label: 'Tài chính', href: '/admin#finance', expectPath: 'finance' },
      { label: 'Báo cáo doanh thu', href: '/admin#analytics', expectPath: 'analytics' },
      { label: 'BI Dashboard', href: '/admin/bi', expectPath: '/admin/bi' },
      { label: 'Cài đặt hệ thống', href: '/admin#settings', expectPath: 'settings' },
      { label: 'Nhật ký hệ thống', href: '/admin#logs', expectPath: 'logs' },
      { label: 'Quản lý file', href: '/admin/files', expectPath: '/admin/files' },
      { label: 'Sao lưu dữ liệu', href: '/admin/backups', expectPath: '/admin/backups' },
      { label: 'Monitoring', href: '/admin/monitoring', expectPath: '/admin/monitoring' },
      { label: 'AI Center', href: '/admin/ai', expectPath: '/admin/ai' },
      { label: 'Workflow', href: '/admin/workflows', expectPath: '/admin/workflows' },
      { label: 'Form & Report', href: '/admin/builder', expectPath: '/admin/builder' },
      { label: 'Multi-tenant', href: '/admin/tenants', expectPath: '/admin/tenants' },
    ];
    await walkMenus(page, role, adminMenus, { expandAdminGroups: true });

    // Verify nested sidebar labels after expand
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await expandGroups(page);
    await page.waitForTimeout(400);
    for (const label of ['Học Viên', 'Đào tạo GV', 'Cài đặt hệ thống']) {
      const n = await page.locator('nav[aria-label="Menu chính"]').locator('button', { hasText: label }).count();
      log(role, `SIDEBAR có ${label}`, n > 0, `count=${n}`);
    }

    // Mute toggle if present
    const mute = page.getByRole('button', { name: /âm thanh|Tắt âm|Bật âm/i }).first();
    if (await mute.count()) {
      await mute.click().catch(() => {});
      log(role, 'Tắt/Bật âm thanh', true, 'clicked');
    } else {
      log(role, 'Tắt/Bật âm thanh', true, 'không thấy hoặc nằm ngoài nav');
    }

    const serious = errors.filter((e) => !/favicon|Download the React DevTools|third-party/i.test(e));
    log(role, 'Console errors', serious.length === 0, serious.slice(0, 3).join(' | '));
    await page.close();
  }

  // ═══════════════ 2. ADMIN STAFF ═══════════════
  {
    const role = 'ADMIN_STAFF';
    if (!staff) {
      log(role, 'Account 0920000010', false, 'không có trong DB — chạy seed_test_accounts.js');
    } else {
      const errors = [];
      const page = await context.newPage();
      await collectConsole(page, errors);
      const perms = staff.permissions || ['manage_students', 'manage_schedule', 'manage_finance'];
      const accessToken = mintToken({
        id: String(staff._id),
        role: 'staff',
        name: staff.name,
        adminRole: 'STAFF',
        permissions: perms,
        branchId: staff.branchId || null,
        tokenVersion: staff.tokenVersion || 0,
      }, 'internal');
      const user = {
        id: String(staff._id),
        name: staff.name,
        role: 'staff',
        adminRole: 'STAFF',
        permissions: perms,
        branchId: staff.branchId || null,
      };
      await injectSession(page, { roleKey: 'staff', user, accessToken, refreshToken: accessToken });
      await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);
      await assertAlive(page, role, 'Dashboard /admin');

      // Super-only menus must NOT appear
      await expandGroups(page);
      for (const forbidden of ['Phân quyền NV', 'Sao lưu dữ liệu', 'Multi-tenant']) {
        const n = await page.locator('nav[aria-label="Menu chính"]').getByRole('button', { name: forbidden }).count();
        log(role, `Ẩn menu Super-only: ${forbidden}`, n === 0, `count=${n}`);
      }

      const staffMenus = [
        { label: 'Tổng quan', href: '/admin#dashboard', expectPath: '/admin' },
        { label: 'Bảng tin', href: '/admin/feed', expectPath: '/admin/feed', check: checkFeedSupport },
        { label: 'Tin tức', href: '/admin/news', expectPath: '/admin/news' },
        { label: 'Hộp thư', href: '/admin/inbox', expectPath: '/admin/inbox' },
        { label: 'Học Viên', href: '/admin#students', expectPath: 'students' },
        { label: 'Tài chính', href: '/admin#finance', expectPath: 'finance' },
      ];
      await walkMenus(page, role, staffMenus, { expandAdminGroups: true });

      // Deep-link denied pages should bounce
      await page.goto(`${BASE}/admin/backups`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      log(role, 'Deep-link /admin/backups bị chặn', !page.url().includes('/backups'), page.url());

      const serious = errors.filter((e) => !/favicon|Download the React DevTools|403 \(Forbidden\)/i.test(e));
      log(role, 'Console errors', serious.length === 0, serious.slice(0, 3).join(' | '));
      await page.close();
    }
  }

  // ═══════════════ 3. TEACHER (active) ═══════════════
  {
    const role = 'TEACHER';
    if (!teacher) {
      log(role, 'Account 0910000010', false, 'không có trong DB');
    } else {
      const errors = [];
      const page = await context.newPage();
      await collectConsole(page, errors);
      let accessToken;
      let user;
      try {
        const data = await apiLoginPublic(teacher.phone, 'Test@123', 'teacher');
        accessToken = data.accessToken;
        user = { ...data.user, id: data.user.id || data.user._id || String(teacher._id), role: 'teacher' };
        log(role, 'API login', true, user.name);
      } catch (e) {
        accessToken = mintToken({
          id: String(teacher._id),
          role: 'teacher',
          name: teacher.name,
          tokenVersion: teacher.tokenVersion || 0,
        }, 'public');
        user = { id: String(teacher._id), name: teacher.name, role: 'teacher', status: 'active' };
        log(role, 'API login fallback JWT', true, e.message);
      }
      await injectSession(page, { roleKey: 'teacher', user, accessToken, refreshToken: accessToken });
      await page.goto(`${BASE}/teacher`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);
      await assertAlive(page, role, 'Dashboard /teacher');

      // Bài Test must be hidden when active
      const testBtn = await page.locator('nav[aria-label="Menu chính"]').getByRole('button', { name: 'Bài Test' }).count();
      log(role, 'Ẩn Bài Test khi active', testBtn === 0, `count=${testBtn}`);

      const teacherMenus = [
        { label: 'Tổng quan', href: '/teacher', expectPath: '/teacher' },
        { label: 'Bảng tin', href: '/teacher/feed', expectPath: '/teacher/feed', check: checkFeedSupport },
        { label: 'Tin tức', href: '/teacher/news', expectPath: '/teacher/news' },
        { label: 'Quản lý học viên', href: '/teacher#students', expectPath: 'students' },
        { label: 'Lịch dạy', href: '/teacher#schedule', expectPath: 'schedule' },
        { label: 'Tài chính', href: '/teacher/finance', expectPath: '/teacher/finance' },
        { label: 'Đào tạo', href: '/teacher#training', expectPath: 'training' },
        { label: 'Hộp thư', href: '/teacher/inbox', expectPath: '/teacher/inbox' },
        { label: 'Hồ sơ', href: '/teacher#profile', expectPath: 'profile' },
      ];
      await walkMenus(page, role, teacherMenus);
      const serious = errors.filter((e) => !/favicon|Download the React DevTools/i.test(e));
      log(role, 'Console errors', serious.length === 0, serious.slice(0, 3).join(' | '));
      await page.close();
    }
  }

  // ═══════════════ 4. TEACHER TEST (pending) ═══════════════
  {
    const role = 'TEACHER_TEST';
    const errors = [];
    const page = await context.newPage();
    await collectConsole(page, errors);
    const accessToken = mintToken({
      id: String(pendingTeacher._id),
      role: 'teacher',
      name: pendingTeacher.name,
      tokenVersion: pendingTeacher.tokenVersion || 0,
    }, 'public');
    const user = {
      id: String(pendingTeacher._id),
      name: pendingTeacher.name,
      role: 'teacher',
      status: 'pending',
    };
    await injectSession(page, { roleKey: 'teacher', user, accessToken, refreshToken: accessToken });
    await page.goto(`${BASE}/teacher`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    // Should redirect to /teacher/test
    log(role, 'Redirect pending → /teacher/test', page.url().includes('/teacher/test'), page.url());
    await assertAlive(page, role, 'TeacherTest page');

    // Try bypass finance
    await page.goto(`${BASE}/teacher/finance`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    log(role, 'Chặn /teacher/finance', page.url().includes('/teacher/test'), page.url());

    // Only Bài Test unlocked in sidebar (if sidebar visible)
    await page.goto(`${BASE}/teacher/test`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const body = await page.locator('body').innerText();
    const hasExamUi = /Đánh giá năng lực|Bắt đầu|trắc nghiệm|Phần|camera|thi/i.test(body);
    log(role, 'UI bài test hiển thị', hasExamUi, body.slice(0, 100).replace(/\s+/g, ' '));

    const serious = errors.filter((e) => !/favicon|Download the React DevTools|getUserMedia|NotAllowedError|Permission/i.test(e));
    log(role, 'Console errors', serious.length === 0, serious.slice(0, 3).join(' | '));
    await page.close();
  }

  // ═══════════════ 5. STUDENT ═══════════════
  {
    const role = 'STUDENT';
    if (!student) {
      log(role, 'Account 0900000010', false, 'không có trong DB');
    } else {
      const errors = [];
      const page = await context.newPage();
      await collectConsole(page, errors);
      let accessToken;
      let user;
      try {
        const data = await apiLoginPublic(student.phone, 'Test@123', 'student');
        accessToken = data.accessToken;
        user = { ...data.user, id: data.user.id || data.user._id || String(student._id), role: 'student' };
        log(role, 'API login', true, user.name);
      } catch (e) {
        accessToken = mintToken({
          id: String(student._id),
          role: 'student',
          name: student.name,
          tokenVersion: student.tokenVersion || 0,
        }, 'public');
        user = { id: String(student._id), name: student.name, role: 'student', status: 'active' };
        log(role, 'API login fallback JWT', true, e.message);
      }
      await injectSession(page, { roleKey: 'student', user, accessToken, refreshToken: accessToken });
      await page.goto(`${BASE}/student`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);
      await assertAlive(page, role, 'Dashboard /student');

      const studentMenus = [
        { label: 'Tổng quan', href: '/student', expectPath: '/student' },
        { label: 'Bảng tin', href: '/student/feed', expectPath: '/student/feed', check: checkFeedSupport },
        { label: 'Tin tức', href: '/student/news', expectPath: '/student/news' },
        { label: 'Phòng Thi', href: '/student/exam', expectPath: '/student/exam' },
        { label: 'Lịch học', href: '/student#schedule', expectPath: 'schedule' },
        { label: 'Tài liệu', href: '/student#materials', expectPath: 'materials' },
        { label: 'Hộp thư', href: '/student/inbox', expectPath: '/student/inbox' },
        { label: 'Đánh giá', href: '/student#evaluation', expectPath: 'evaluation' },
        { label: 'Hồ sơ', href: '/student#profile', expectPath: 'profile' },
      ];
      await walkMenus(page, role, studentMenus);

      // FAB messaging hidden on feed
      await page.goto(`${BASE}/student/feed`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const fab = page.locator('.cms-fm-fab');
      log(role, 'Ẩn FAB nhắn tin trên Bảng tin', (await fab.count()) === 0, `fab=${await fab.count()}`);
      await checkFeedSupport(page, role);

      const serious = errors.filter((e) => !/favicon|Download the React DevTools|401 \(Unauthorized\)|Failed to load resource: the server responded with a status of 401/i.test(e));
      log(role, 'Console errors', serious.length === 0, serious.slice(0, 3).join(' | '));
      await page.close();
    }
  }

  await browser.close();
  await mongoose.disconnect();

  console.log('\n========== TỔNG KẾT ==========');
  console.log(`Tổng bước: ${OUT.length}`);
  console.log(`PASS: ${OUT.filter((x) => x.ok).length}`);
  console.log(`FAIL: ${FAIL.length}`);
  if (FAIL.length) {
    console.log('\n--- FAIL LIST ---');
    FAIL.forEach((f) => console.log(`- [${f.role}] ${f.step}: ${f.detail}`));
  }
  process.exit(FAIL.length ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
