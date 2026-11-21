#!/usr/bin/env node
'use strict';

/**
 * scripts/verify-phase5-web-ui-playwright.cjs
 *
 * Kiểm thử giao diện thực tế bằng trình duyệt Chromium (Playwright) trên:
 * 1. Website Desktop (1440x900)
 * 2. Website Mobile Responsive (390x844)
 * Chạy trên Frontend Staging (http://localhost:5174) nối Backend Staging (http://127.0.0.1:5055, Redis + Canary RAG thật).
 * Tự dọn sạch mọi bản ghi feedback test khỏi MongoDB sau khi chạy xong.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { chromium } = require('playwright');
const AiQuickAskFeedback = require('../models/AiQuickAskFeedback');

const WEB_URL = process.env.PHASE5_UI_URL || 'http://localhost:5174';
const PILOT_STUDENT_ID = '6aca2e6ff58fe1c6ceacf611';
const OUT_JSON = path.resolve(__dirname, '../ai-knowledge/reports/phase5-web-ui-playwright-report.json');
const SHOT_DESKTOP = path.resolve(__dirname, '../ai-knowledge/reports/phase5-ui-desktop.png');
const SHOT_MOBILE = path.resolve(__dirname, '../ai-knowledge/reports/phase5-ui-mobile-responsive.png');

async function main() {
  const startedAt = new Date().toISOString();
  const createdFeedbackIds = [];
  let browser = null;

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const stu = await mongoose.connection.db.collection('students').findOne({
    _id: new mongoose.Types.ObjectId(PILOT_STUDENT_ID),
  });
  if (!stu) throw new Error('Pilot student not found');

  const token = jwt.sign(
    {
      id: String(stu._id),
      role: 'student',
      name: 'Học viên thử nghiệm',
      tokenVersion: Number(stu.tokenVersion || 0),
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );
  const safeUserObj = {
    _id: String(stu._id),
    id: String(stu._id),
    role: 'student',
    name: 'Học viên thử nghiệm',
    status: stu.status || 'active',
    freePortal: false,
    freeUnlocked: true,
  };

  const consoleErrors = [];
  const pageErrors = [];
  const startedTs = new Date();

  try {
    try {
      browser = await chromium.launch({ headless: true, channel: 'chrome' });
    } catch {
      browser = await chromium.launch({ headless: true, channel: 'msedge' });
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Track newly created feedback IDs from server response so we clean ONLY our test docs
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/ai-support/quick-ask/feedback') && [200, 201].includes(resp.status())) {
        try {
          const json = await resp.json();
          if (json?.data?.id) createdFeedbackIds.push(json.data.id);
        } catch { /* ignore */ }
      }
    });

    // 1. Authenticate via localStorage & open /student on Desktop 1440x900
    await page.goto(`${WEB_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate(({ tok, usr }) => {
      localStorage.setItem('student_access_token', tok);
      localStorage.setItem('student_user', JSON.stringify(usr));
    }, { tok: token, usr: safeUserObj });

    await page.goto(`${WEB_URL}/student`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
    await page.waitForSelector('button[aria-label="Tìm kiếm bằng AI"]', { timeout: 15000 });

    // --- DESKTOP (1440x900) ---
    await page.click('button[aria-label="Tìm kiếm bằng AI"]');
    const dialog = page.locator('[role="dialog"][aria-label="DewSkill AI và tìm kiếm nhanh"]');
    await dialog.waitFor({ state: 'visible', timeout: 8000 });

    const heroTitleVisible = await dialog.getByText('DewSkill AI, trợ lý cá nhân').isVisible();
    const composerInput = dialog.locator('input[type="text"]').first();
    await composerInput.waitFor({ state: 'visible' });

    // D1: Ask table + formula question
    await composerInput.fill('So sánh hàm VLOOKUP và XLOOKUP trong Excel bằng bảng ngắn gọn và nêu ví dụ cú pháp');
    await composerInput.press('Enter');

    const feedbackBars = dialog.locator('[data-testid="ai-feedback-bar"]');
    await feedbackBars.first().waitFor({ state: 'visible', timeout: 20000 });

    const d1Metrics = await dialog.evaluate((el) => {
      const tables = el.querySelectorAll('table');
      const rows = el.querySelectorAll('table tr');
      const codes = el.querySelectorAll('code');
      const strongs = el.querySelectorAll('strong');
      return {
        tableCount: tables.length,
        tableRowCount: rows.length,
        codeCount: codes.length,
        strongCount: strongs.length,
      };
    });

    // Click "Hữu ích" on first answer & check status + disabled duplicate guard
    const firstBar = feedbackBars.first();
    const helpfulBtn = firstBar.getByRole('button', { name: 'Hữu ích' });
    await helpfulBtn.click();
    await firstBar.getByText(/Cảm ơn bạn đã đánh giá hữu ích/i).waitFor({ state: 'visible', timeout: 8000 });
    const helpfulDisabledAfterClick = await helpfulBtn.isDisabled();

    // D2: Ask long multi-part question -> check scroll + click "Chưa chính xác" + enter short reason -> submit
    const chatInput = dialog.locator('input[type="text"]').last();
    await chatInput.fill('Trong Excel hãy hướng dẫn: 1) Cách dùng SUMIFS nhiều điều kiện, 2) Cách cố định dòng tiêu đề Freeze Panes, 3) Phím tắt bật tắt Filter');
    await chatInput.press('Enter');
    await feedbackBars.nth(1).waitFor({ state: 'visible', timeout: 20000 });

    const scrollMetrics = await dialog.evaluate((el) => {
      const scroller = el.querySelector('.overflow-y-auto');
      if (!scroller) return { found: false, scrollHeight: 0, clientHeight: 0, scrollable: false };
      scroller.scrollTop = 0;
      const topAfterUp = scroller.scrollTop;
      scroller.scrollTop = scroller.scrollHeight;
      const topAfterDown = scroller.scrollTop;
      return {
        found: true,
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        scrollable: scroller.scrollHeight > scroller.clientHeight,
        scrollWorks: topAfterDown > topAfterUp,
      };
    });

    const secondBar = feedbackBars.nth(1);
    await secondBar.getByRole('button', { name: 'Chưa chính xác' }).click();
    const reasonInput = secondBar.locator('input[type="text"]');
    await reasonInput.waitFor({ state: 'visible', timeout: 5000 });
    await reasonInput.fill('Kiểm thử UI Giai đoạn 5: cần thêm bảng ví dụ minh họa');
    await secondBar.getByRole('button', { name: 'Gửi' }).click();
    await secondBar.getByText(/Đã gửi góp ý để Admin kiểm tra/i).waitFor({ state: 'visible', timeout: 8000 });
    const reasonBoxCollapsedAfterSend = !(await reasonInput.isVisible().catch(() => false));

    // Save desktop screenshot showing Markdown table + formulas + feedback statuses cleanly
    await dialog.screenshot({ path: SHOT_DESKTOP });

    // D3: Network failure -> fallback error + "Thử lại" button -> recover on retry!
    let shouldFailQuickAsk = true;
    await page.route('**/api/ai-support/quick-ask', async (route) => {
      if (shouldFailQuickAsk) {
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await chatInput.fill('Cách tạo PivotChart kết hợp Slicer nâng cao trong Excel 365');
    await chatInput.press('Enter');

    const retryBtn = dialog.getByRole('button', { name: 'Thử lại' });
    await retryBtn.waitFor({ state: 'visible', timeout: 20000 });
    const retryBtnVisibleOnError = await retryBtn.isVisible();

    // Restore network and click Retry!
    shouldFailQuickAsk = false;
    await page.unroute('**/api/ai-support/quick-ask');
    await retryBtn.click();
    await feedbackBars.nth(2).waitFor({ state: 'visible', timeout: 20000 });
    const retryRecoveredRealAnswer = (await feedbackBars.count()) >= 3;

    // Close popup via X button
    await dialog.locator('button[aria-label="Đóng bảng lệnh"]').click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    const desktopCloseOk = !(await dialog.isVisible().catch(() => false));

    // --- MOBILE RESPONSIVE (390x844) ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);

    // Open popup via Ctrl+K (works even if compact header hides text) or AI button
    const aiBtnMobile = page.locator('button[aria-label="Tìm kiếm bằng AI"]').first();
    if (await aiBtnMobile.isVisible().catch(() => false)) {
      await aiBtnMobile.click();
    } else {
      await page.keyboard.press('Control+k');
    }
    await dialog.waitFor({ state: 'visible', timeout: 8000 });

    const mobileInput = dialog.locator('input[type="text"]').first();
    await mobileInput.fill('So sánh hàm VLOOKUP và XLOOKUP trong Excel bằng bảng ngắn gọn và nêu ví dụ cú pháp');
    await mobileInput.press('Enter');
    await dialog.locator('[data-testid="ai-feedback-bar"]').first().waitFor({ state: 'visible', timeout: 20000 });

    // Click "Chưa chính xác" on mobile viewport to inspect stacked reason box fit
    const mobileBar = dialog.locator('[data-testid="ai-feedback-bar"]').first();
    await mobileBar.getByRole('button', { name: 'Chưa chính xác' }).click();
    await mobileBar.locator('input[type="text"]').waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForTimeout(100);
    const mobileLayoutMetrics = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"][aria-label="DewSkill AI và tìm kiếm nhanh"]');
      const dlgRect = dialogEl ? dialogEl.getBoundingClientRect() : null;
      const fbBar = dialogEl ? dialogEl.querySelector('[data-testid="ai-feedback-bar"]') : null;
      const fbRect = fbBar ? fbBar.getBoundingClientRect() : null;
      const tableEl = dialogEl ? dialogEl.querySelector('table') : null;
      return {
        viewportWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        noHorizontalPageOverflow: document.documentElement.scrollWidth <= window.innerWidth + 2,
        dialogFitsViewport: Boolean(dlgRect && dlgRect.left >= 0 && dlgRect.right <= window.innerWidth + 1),
        feedbackBarFitsViewport: Boolean(fbRect && fbRect.right <= window.innerWidth + 1),
        tableRenderedOnMobile: Boolean(tableEl),
      };
    });

    await page.screenshot({ path: SHOT_MOBILE });

    // Cancel reason box & close with Escape
    await mobileBar.getByRole('button', { name: 'Hủy' }).click();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    const mobileCloseOk = !(await dialog.isVisible().catch(() => false));

    // Verify DB records created by real browser clicks had autoPromotedToKnowledge=false
    const dbFeedbackDocs = await AiQuickAskFeedback.find({
      userId: PILOT_STUDENT_ID,
      createdAt: { $gte: startedTs },
    }).lean();
    const allAutoPromoteFalse = dbFeedbackDocs.length >= 2
      && dbFeedbackDocs.every((d) => d.autoPromotedToKnowledge === false && d.reviewStatus === 'pending_admin_review');

    const report = {
      executedAt: startedAt,
      completedAt: new Date().toISOString(),
      url: `${WEB_URL}/student`,
      desktop1440x900: {
        heroLayoutIntact: heroTitleVisible,
        markdownTableRendered: d1Metrics.tableCount >= 1 && d1Metrics.tableRowCount >= 3,
        markdownMetrics: d1Metrics,
        helpfulSubmitAndDisableDuplicateOk: helpfulDisabledAfterClick,
        longContentScrollOk: scrollMetrics.scrollable && scrollMetrics.scrollWorks,
        scrollMetrics,
        inaccurateReasonSubmitAndCollapseOk: reasonBoxCollapsedAfterSend,
        networkErrorRetryButtonVisible: retryBtnVisibleOnError,
        retryRecoveredRealAiAnswer: retryRecoveredRealAnswer,
        popupCloseOk: desktopCloseOk,
        screenshot: SHOT_DESKTOP,
      },
      mobileResponsive390x844: {
        ...mobileLayoutMetrics,
        popupCloseWithEscapeOk: mobileCloseOk,
        screenshot: SHOT_MOBILE,
      },
      dbIntegrity: {
        feedbackDocsCaptured: dbFeedbackDocs.length,
        allAutoPromotedFalseAndPendingAdmin: allAutoPromoteFalse,
      },
      runtimeErrors: {
        pageErrorsCount: pageErrors.length,
        pageErrors,
        consoleErrorsCount: consoleErrors.length,
        consoleErrorsSample: consoleErrors.slice(0, 5),
      },
    };

    const allPassed = report.desktop1440x900.heroLayoutIntact
      && report.desktop1440x900.markdownTableRendered
      && report.desktop1440x900.helpfulSubmitAndDisableDuplicateOk
      && report.desktop1440x900.longContentScrollOk
      && report.desktop1440x900.inaccurateReasonSubmitAndCollapseOk
      && report.desktop1440x900.networkErrorRetryButtonVisible
      && report.desktop1440x900.retryRecoveredRealAiAnswer
      && report.desktop1440x900.popupCloseOk
      && report.mobileResponsive390x844.noHorizontalPageOverflow
      && report.mobileResponsive390x844.dialogFitsViewport
      && report.mobileResponsive390x844.feedbackBarFitsViewport
      && report.mobileResponsive390x844.tableRenderedOnMobile
      && report.mobileResponsive390x844.popupCloseWithEscapeOk
      && report.dbIntegrity.allAutoPromotedFalseAndPendingAdmin
      && report.runtimeErrors.pageErrorsCount === 0;

    report.allPassed = allPassed;
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');
    console.log('=== PHASE 5 REAL BROWSER UI QA SUMMARY ===');
    console.log(JSON.stringify(report, null, 2));
    if (!allPassed) process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    // Clean up ONLY test feedback docs created during this browser QA run
    try {
      await AiQuickAskFeedback.deleteMany({ userId: PILOT_STUDENT_ID, createdAt: { $gte: startedTs } });
      if (createdFeedbackIds.length) {
        await AiQuickAskFeedback.deleteMany({ _id: { $in: createdFeedbackIds } });
      }
    } catch { /* ignore */ }
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[PHASE 5 WEB UI QA ERROR]', err);
  process.exit(1);
});
