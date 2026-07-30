/**
 * Playwright — walk each role sidebar top-to-bottom, screenshots, console errors.
 * Usage: node scripts/_qa_ui_roles_playwright.cjs
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const FE = (process.env.QA_FE_BASE || 'http://127.0.0.1:5173').replace(/\/$/, '');
const API = (process.env.QA_API_BASE || 'http://127.0.0.1:5000').replace(/\/$/, '');
const OUT = path.join(__dirname, '..', 'docs', 'QA_LIVE_DEEP_RESULT.json');
const SHOTS = path.join(__dirname, '..', 'docs', 'qa-live-shots');

const PASSWORD = 'Test@123';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'admin123';

const ROLES = [
  {
    key: 'student',
    loginPath: '/login',
    home: '/student',
    identifier: '0900000010',
    uiRole: 'student',
    isAdminPortal: false,
  },
  {
    key: 'teacher',
    loginPath: '/login',
    home: '/teacher',
    identifier: '0910000010',
    uiRole: 'teacher',
    isAdminPortal: false,
  },
  {
    key: 'staff',
    loginPath: '/admin/login',
    home: '/admin',
    identifier: '0920000010',
    uiRole: 'admin',
    isAdminPortal: true,
  },
  {
    key: 'super_admin',
    loginPath: '/admin/login',
    home: '/admin',
    identifier: 'admin',
    uiRole: 'admin',
    isAdminPortal: true,
  },
];

function slug(s) {
  return String(s).replace(/[^\w\-]+/g, '_').slice(0, 48);
}

async function fetchCaptchaInPage(page) {
  return page.evaluate(async (apiOrigin) => {
    const r = await fetch(`${apiOrigin}/api/auth/captcha`, { credentials: 'include' });
    return r.json();
  }, API);
}

async function loginAdmin(page, { identifier }) {
  const capPromise = page.waitForResponse(
    (r) => r.url().includes('/auth/captcha') && r.status() === 200,
    { timeout: 15000 },
  );
  await page.goto(`${FE}/admin/login`, { waitUntil: 'domcontentloaded' });
  const capResponse = await capPromise.catch(() => null);
  const cap = capResponse ? await capResponse.json().catch(() => ({})) : await fetchCaptchaInPage(page);
  await page.waitForTimeout(400);
  await page.fill('input[placeholder*="tài khoản" i], input[type="text"]', identifier);
  await page.locator('input[type="password"]').first().fill(identifier === 'admin' ? ADMIN_PASSWORD : PASSWORD);
  const capInput = page.locator('input[placeholder*="bảo vệ" i], input[placeholder*="CAPTCHA" i], input[maxlength="6"]').first();
  if (await capInput.count()) {
    await capInput.fill(cap.answer || '');
  }
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 45000 }).catch(() => {});
}

async function loginPublic(page, { identifier, uiRole }) {
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const roleBtn = page.locator(`button:has-text("${uiRole === 'student' ? 'Học viên' : 'Giảng viên'}")`).first();
  if (await roleBtn.count()) await roleBtn.click();
  await page.fill('input[type="tel"], input[inputmode="numeric"], input[placeholder*="điện thoại" i], input[placeholder*="tài khoản" i]', identifier);
  const pwd = page.locator('input[type="password"]').first();
  await pwd.fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(student|teacher)/, { timeout: 45000 }).catch(() => {});
}

async function dismissGuide(page) {
  const skip = page.getByRole('button', { name: 'Bỏ qua' });
  if (await skip.count()) {
    await skip.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  const dialog = page.locator('[aria-label="Hướng dẫn menu LMS"]');
  if (await dialog.count()) {
    await page.getByRole('button', { name: 'Đóng' }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

async function expandSidebar(page) {
  await page.evaluate(() => {
    try { localStorage.setItem('cms_sidebar_collapsed', '0'); } catch { /* */ }
  });
  const expand = page.locator('button[aria-label="Mở rộng menu"]');
  if (await expand.count()) await expand.first().click();
}

async function walkSidebar(page, roleKey) {
  await dismissGuide(page);
  await expandSidebar(page);
  const nav = page.locator('nav[aria-label="Menu chính"]');
  await nav.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

  const groupLabels = ['Quản lý', 'Đào tạo', 'Tài chính', 'Hệ thống'];
  for (const g of groupLabels) {
    const gb = nav.getByRole('button', { name: new RegExp(g) }).first();
    if (await gb.count()) {
      await gb.click({ timeout: 4000, force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  const buttons = nav.locator('button');
  const count = await buttons.count();
  const clicks = [];
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const label = (await btn.innerText().catch(() => '')).trim().split('\n')[0];
    if (!label || label.length < 2) continue;
    if (/Đăng xuất|Trợ giúp|Thu gọn|Mở rộng/i.test(label)) continue;
    if (groupLabels.includes(label)) continue;
    try {
      await btn.click({ timeout: 8000, force: true });
      clicks.push({ label, ok: true });
      await page.waitForTimeout(700);
      await dismissGuide(page);
      const shot = path.join(SHOTS, `${roleKey}-${slug(label)}.png`);
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    } catch (e) {
      clicks.push({ label, ok: false, error: String(e.message || e).slice(0, 120) });
    }
  }
  return clicks;
}

async function runRole(browser, roleDef) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err.message || err)));

  try {
    if (roleDef.isAdminPortal) {
      await loginAdmin(page, roleDef);
    } else {
      await loginPublic(page, roleDef);
    }
    await page.waitForTimeout(1200);
    const menuClicks = await walkSidebar(page, roleDef.key);
    const homeShot = path.join(SHOTS, `${roleDef.key}-home.png`);
    await page.screenshot({ path: homeShot, fullPage: false }).catch(() => {});

    const url = page.url();
    const loggedIn = !url.includes('/login') && url.includes(roleDef.home.split('/')[1] || roleDef.key);

    return {
      role: roleDef.key,
      loggedIn,
      finalUrl: url,
      menuClicks,
      consoleErrors: [...new Set(consoleErrors)].slice(0, 40),
      screenshots: fs.readdirSync(SHOTS).filter((f) => f.startsWith(`${roleDef.key}-`)),
    };
  } catch (e) {
    return {
      role: roleDef.key,
      loggedIn: false,
      error: e.message,
      consoleErrors: [...new Set(consoleErrors)].slice(0, 40),
    };
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  console.log(`\n=== QA UI ROLES (Playwright) @ ${FE} ===\n`);

  const browser = await chromium.launch({ headless: true });
  const roleResults = [];
  for (const def of ROLES) {
    console.log(`Role: ${def.key}...`);
    const r = await runRole(browser, def);
    roleResults.push(r);
    console.log(`  loggedIn=${r.loggedIn} menus=${r.menuClicks?.length || 0} consoleErr=${r.consoleErrors?.length || 0}`);
  }
  await browser.close();

  const uiPass = roleResults.filter((r) => r.loggedIn && (r.menuClicks || []).some((c) => c.ok)).length;
  const uiFail = roleResults.length - uiPass;

  let existing = {};
  try {
    if (fs.existsSync(OUT)) existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch { /* */ }

  const payload = {
    ...existing,
    uiFinishedAt: new Date().toISOString(),
    feBase: FE,
    ui: {
      roles: roleResults,
      summary: { pass: uiPass, fail: uiFail, total: roleResults.length },
    },
    summary: {
      ...(existing.summary || {}),
      uiPass,
      uiFail,
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nWrote ${OUT}`);
  process.exit(uiFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
