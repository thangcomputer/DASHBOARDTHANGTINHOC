/**
 * Reset password GV THẮNG + Playwright click test:
 *   THẮNG333 → Hủy điểm danh
 *   LAN KHUÊ → Điểm danh bù (popup)
 *
 *   node scripts/_qa_click_attendance_buttons.cjs
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const Teacher = require('../models/Teacher');

const FE = (process.env.QA_FE_BASE || 'http://localhost:5173').replace(/\/$/, '');
const API = (process.env.QA_API_BASE || 'http://localhost:5000').replace(/\/$/, '');
const PASSWORD = 'Test@123';
const TEACHER_PHONE = '0902895000';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa-attendance-click');

async function resetTeacherPassword() {
  await mongoose.connect(process.env.MONGODB_URI);
  const hash = await bcrypt.hash(PASSWORD, 10);
  const r = await Teacher.updateOne(
    { _id: '6a7a04cdcb8547ec5edc6ef8' },
    { $set: { password: hash, status: 'active' } },
  );
  console.log('[qa] password reset modified=', r.modifiedCount);
  await mongoose.disconnect();
}

async function loginTeacher(page) {
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const roleBtn = page.locator('button:has-text("Giảng viên")').first();
  if (await roleBtn.count()) await roleBtn.click();
  await page.waitForTimeout(200);
  const idInput = page.locator('input[type="tel"], input[inputmode="numeric"], input[placeholder*="điện thoại" i], input[placeholder*="tài khoản" i]').first();
  await idInput.fill(TEACHER_PHONE);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();

  // Concurrent login modal (409)
  const forceBtn = page.getByRole('button', { name: /Đăng nhập,\s*đăng xuất máy kia|đăng xuất máy kia/i });
  try {
    await forceBtn.waitFor({ state: 'visible', timeout: 8000 });
    await forceBtn.click();
  } catch {
    /* no conflict modal */
  }

  await page.waitForURL(/\/teacher/, { timeout: 45000 });
  await page.waitForTimeout(800);
  const skip = page.getByRole('button', { name: 'Bỏ qua' });
  if (await skip.count()) await skip.first().click({ timeout: 2000 }).catch(() => {});
  const closeGuide = page.getByRole('button', { name: 'Đóng' });
  if (await closeGuide.count()) await closeGuide.first().click({ timeout: 2000 }).catch(() => {});
}

async function goStudentsTab(page) {
  await page.goto(`${FE}/teacher#students`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // ensure hash applied
  await page.evaluate(() => { window.location.hash = 'students'; });
  await page.waitForTimeout(1200);
}

async function selectStudent(page, name) {
  const row = page.locator(`div[role="button"]:has-text("${name}"), button:has-text("${name}")`).first();
  // sidebar list items are div role=button
  const listItem = page.locator('.overflow-y-auto').locator(`text=${name}`).first();
  if (await listItem.count()) {
    await listItem.click({ timeout: 8000 });
  } else if (await row.count()) {
    await row.click({ timeout: 8000 });
  } else {
    // fallback: any element with name
    await page.getByText(name, { exact: false }).first().click({ timeout: 8000 });
  }
  await page.waitForTimeout(1000);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await resetTeacherPassword();

  // reseed pair
  require('child_process').execSync('node scripts/seed_attendance_test_pair.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));

  const result = {
    ok: false,
    steps: [],
    consoleErrors: [],
    shots: [],
  };

  try {
    await loginTeacher(page);
    result.steps.push({ step: 'login', ok: true, url: page.url() });
    await page.screenshot({ path: path.join(OUT_DIR, '01-login-ok.png') });

    await goStudentsTab(page);
    result.steps.push({ step: 'students_tab', ok: true, url: page.url(), hash: await page.evaluate(() => window.location.hash) });
    await page.screenshot({ path: path.join(OUT_DIR, '02-students.png'), fullPage: true });

    // ── THẮNG333: Hủy điểm danh ────────────────────────────────────────────
    await selectStudent(page, 'THẮNG333');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, '03-thang333.png'), fullPage: true });

    const bodyText333 = await page.locator('body').innerText();
    const hasHuyDiemDanh = /Hủy điểm danh|HỦY\s*ĐIỂM\s*DANH/i.test(bodyText333);
    const hasDaDiemDanh = /Đã điểm danh|ĐÃ ĐIỂM DANH|Chờ\s*\d/i.test(bodyText333);
    result.steps.push({
      step: 'thang333_labels',
      ok: hasHuyDiemDanh,
      hasHuyDiemDanh,
      hasDaDiemDanh,
      snippet: bodyText333.replace(/\s+/g, ' ').slice(0, 500),
    });

    const huyDdBtn = page.getByRole('button', { name: /Hủy điểm danh/i }).first();
    if (await huyDdBtn.count()) {
      await huyDdBtn.click({ timeout: 5000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, '04-thang333-modal.png') });
      const modalVisible = await page.locator('[role="dialog"], .cms-sheet').count();
      const confirmBtn = page.getByRole('button', { name: /XÁC NHẬN HỦY/i }).first();
      const confirmCount = await confirmBtn.count();
      result.steps.push({
        step: 'thang333_click_huy_diem_danh',
        ok: modalVisible > 0 && confirmCount > 0,
        modalVisible,
        confirmCount,
      });
      // đóng modal — không confirm để giữ data cho lần sau
      const dong = page.getByRole('button', { name: /^Đóng$/i }).first();
      if (await dong.count()) await dong.click();
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else {
      result.steps.push({ step: 'thang333_click_huy_diem_danh', ok: false, error: 'Button not found' });
    }

    // ── LAN KHUÊ: Điểm danh bù ─────────────────────────────────────────────
    await selectStudent(page, 'LAN KHUÊ');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, '05-lankhue.png'), fullPage: true });

    const bodyLan = await page.locator('body').innerText();
    const hasMakeup = /Điểm danh bù|ĐIỂM DANH\s*BÙ/i.test(bodyLan);
    const hasHuyCa = /Hủy ca|HỦY CA/i.test(bodyLan);
    result.steps.push({
      step: 'lankhue_labels',
      ok: hasMakeup,
      hasMakeup,
      hasHuyCa,
      snippet: bodyLan.replace(/\s+/g, ' ').slice(0, 500),
    });

    const makeupBtn = page.getByRole('button', { name: /Điểm danh bù|ĐIỂM DANH/i }).filter({ hasText: /bù|BÙ/i }).first();
    let makeupClicked = false;
    if (await makeupBtn.count()) {
      await makeupBtn.click({ timeout: 5000 });
      makeupClicked = true;
    } else {
      // try any amber button / text
      const alt = page.locator('button:has-text("Điểm danh bù"), button:has-text("ĐIỂM DANH")').first();
      if (await alt.count()) {
        const t = await alt.innerText();
        if (/bù|BÙ/i.test(t)) {
          await alt.click();
          makeupClicked = true;
        }
      }
    }
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT_DIR, '06-lankhue-makeup-modal.png') });
    const makeupModal = await page.locator('text=Giảng viên lưu ý').count();
    const guiBtn = page.getByRole('button', { name: /^Gửi$/i }).first();
    result.steps.push({
      step: 'lankhue_click_diem_danh_bu',
      ok: makeupClicked && makeupModal > 0,
      makeupClicked,
      makeupModal,
      hasGui: await guiBtn.count(),
    });
    if (await guiBtn.count()) {
      // không gửi thật — đóng bằng Hủy
      const huy = page.getByRole('button', { name: /^Hủy$/i }).first();
      if (await huy.count()) await huy.click();
    }

    // Hủy ca button
    const huyCa = page.getByRole('button', { name: /Hủy ca|HỦY CA/i }).first();
    if (await huyCa.count()) {
      await huyCa.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT_DIR, '07-lankhue-huyca-modal.png') });
      const confirmCa = await page.getByRole('button', { name: /XÁC NHẬN HỦY CA/i }).count();
      result.steps.push({ step: 'lankhue_click_huy_ca', ok: confirmCa > 0, confirmCa });
      await page.keyboard.press('Escape');
    } else {
      result.steps.push({ step: 'lankhue_click_huy_ca', ok: false, error: 'Hủy ca button not found' });
    }

    result.ok = result.steps.every((s) => s.ok !== false);
  } catch (e) {
    result.ok = false;
    result.error = String(e.message || e);
    await page.screenshot({ path: path.join(OUT_DIR, '99-error.png'), fullPage: true }).catch(() => {});
  }

  result.consoleErrors = consoleErrors.slice(0, 30);
  result.shots = fs.readdirSync(OUT_DIR);
  fs.writeFileSync(path.join(OUT_DIR, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
