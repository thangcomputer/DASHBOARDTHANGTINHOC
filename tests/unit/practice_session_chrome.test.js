'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('practiceSessionMode toggles document dataset attribute and dispatches custom event cleanly', async () => {
  const prevDocument = globalThis.document;
  const prevWindow = globalThis.window;
  const prevCustomEvent = globalThis.CustomEvent;

  const dispatched = [];
  const dataset = {};
  globalThis.document = { documentElement: { dataset } };
  globalThis.CustomEvent = class MockCustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  globalThis.window = {
    dispatchEvent(evt) {
      dispatched.push(evt);
    },
  };

  try {
    const mod = await import('../../client/src/utils/practiceSessionState.js');
    const modeSrc = read('client/src/utils/practiceSessionMode.js');
    assert.ok(modeSrc.includes("from './practiceSessionState'"));
    assert.equal(mod.isPracticeSessionActive(), false);

    assert.equal(mod.setPracticeSessionActive(true), true);
    assert.equal(dataset.practiceSession, 'true');
    assert.equal(mod.isPracticeSessionActive(), true);

    assert.equal(mod.setPracticeSessionActive(false), false);
    assert.equal('practiceSession' in dataset, false);
    assert.equal(mod.isPracticeSessionActive(), false);

    assert.equal(dispatched.length, 2);
    assert.equal(dispatched[0].type, mod.PRACTICE_SESSION_ACTIVE_EVENT);
    assert.deepEqual(dispatched[0].detail, { active: true });
    assert.equal(dispatched[1].type, mod.PRACTICE_SESSION_ACTIVE_EVENT);
    assert.deepEqual(dispatched[1].detail, { active: false });
  } finally {
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
    if (prevCustomEvent === undefined) delete globalThis.CustomEvent;
    else globalThis.CustomEvent = prevCustomEvent;
  }
});

test('Web App hides topbar header, sidebar menu, Ctrl+K palette, and floating support button during active Daily Practice session', () => {
  const dailyPractice = read('client/src/components/student/dailyPractice/DailyPracticePage.jsx');
  const exitModal = read('client/src/components/student/dailyPractice/ExitPracticeWarningModal.jsx');
  assert.match(dailyPractice, /setPracticeSessionActive\(true\)/);
  assert.match(dailyPractice, /return \(\) => setPracticeSessionActive\(false\)/);
  assert.match(dailyPractice, /writeReloadAbandonNotice/);
  assert.match(dailyPractice, /ReloadAbandonNoticeModal/);
  assert.match(dailyPractice, /<ExitPracticeWarningModal/);
  assert.match(exitModal, /mode = 'quit'/);
  assert.match(exitModal, /Tải lại trang sẽ mất XP!/);
  assert.match(dailyPractice, /window\.addEventListener\('keydown', handleReloadShortcut, true\)/);
  assert.doesNotMatch(dailyPractice, /window\.addEventListener\('beforeunload'/);
  assert.match(dailyPractice, /window\.addEventListener\('pagehide', handlePageHide\)/);
  assert.match(dailyPractice, /dailyPracticeApi\.student\.abandonBeacon\(sessionId\)/);

  const dashboardLayout = read('client/src/components/DashboardLayout.jsx');
  assert.match(dashboardLayout, /const practiceSessionActive = usePracticeSessionActive\(\)/);
  assert.match(dashboardLayout, /practiceSessionActive \? 'hidden' : ''/);
  assert.match(dashboardLayout, /hidden=\{practiceSessionActive\}/);
  assert.match(dashboardLayout, /<FloatingMessenger session=\{session\} role=\{role\} hidden=\{practiceSessionActive\} \/>/);
  assert.match(dashboardLayout, /showMobileFooter\s*=[\s\S]*&&\s*!practiceSessionActive/);

  const appSidebar = read('client/src/components/AppSidebar.jsx');
  assert.match(appSidebar, /hidden = false,/);
  assert.match(appSidebar, /pinnedSidebarVisible && !hidden/);
  assert.match(appSidebar, /if \(hidden\) return null;/);

  const commandPalette = read('client/src/components/ui/CommandPalette.jsx');
  assert.match(commandPalette, /isPracticeSessionActive/);
  assert.match(commandPalette, /if \(isPracticeSessionActive\(\)\) return;/);
  assert.match(commandPalette, /if \(practiceSessionActive\) setOpen\(false\)/);

  const dailyPracticeApi = read('client/src/services/dailyPracticeApi.js');
  assert.match(dailyPracticeApi, /abandonBeacon:\s*\(sessionId\)\s*=>\s*keepalivePost/);

  const floatingMessenger = read('client/src/components/FloatingMessenger.jsx');
  assert.match(floatingMessenger, /export default function FloatingMessenger\(\{ session, role, hidden = false \}\)/);
  assert.match(floatingMessenger, /if \(!meId \|\| isInbox \|\| hidden\) return null;/);

  const css = read('client/src/index.css');
  assert.match(css, /html\[data-practice-session="true"\]\s+aside\.cms-sidebar-glass/);
  assert.match(css, /html\[data-practice-session="true"\]\s+\.cms-mobile-drawer-shell/);
  assert.match(css, /html\[data-practice-session="true"\]\s+#main-content\s*>\s*header\.cms-topbar/);
  assert.match(css, /html\[data-practice-session="true"\]\s+\.cms-mobile-bottom-nav/);
  assert.match(css, /html\[data-practice-session="true"\]\s+\.cms-fm-root/);
});

test('Mobile App hides bottom nav footer and floating chrome during active Daily Practice session and restores on exit', () => {
  const mobilePracticeMode = read('thang-tin-hoc-mobile/src/utils/practiceSessionMode.ts');
  assert.match(mobilePracticeMode, /MOBILE_PRACTICE_SESSION_ACTIVE_EVENT = 'mobile:practice-session-active'/);
  assert.match(mobilePracticeMode, /DeviceEventEmitter\.emit\(MOBILE_PRACTICE_SESSION_ACTIVE_EVENT, value\)/);

  const mobileDailyPractice = read('thang-tin-hoc-mobile/src/screens/DailyPracticeScreen.tsx');
  assert.match(mobileDailyPractice, /ReloadAbandonNoticeModal/);
  assert.match(mobileDailyPractice, /writeReloadAbandonNotice/);
  assert.match(mobileDailyPractice, /setMobilePracticeSessionActive\(Boolean\(session\)\)/);
  assert.match(mobileDailyPractice, /setMobilePracticeSessionActive\(false\)/);
  assert.match(mobileDailyPractice, /hideBrandingTopBar=\{Boolean\(session\)\}/);
  assert.match(mobileDailyPractice, /screenPlayMode:/);

  const rootNavigator = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  assert.match(rootNavigator, /const practiceSessionActive = useMobilePracticeSessionActive\(\)/);
  assert.match(rootNavigator, /if \(hideTabBar\) return null;/);
  assert.match(rootNavigator, /tabBarStyle:\s*hideTabBar\s*\?\s*\{\s*display:\s*'none' as const\s*\}/);
  assert.match(rootNavigator, /!examRoomActive\s*&&\s*!practiceSessionActive/);
  assert.match(rootNavigator, /setMobilePracticeSessionActive\(false\)/);
});

test('Web App replaces native alert/confirm/prompt and practice beforeunload dialogs with custom popups', () => {
  const modalCode = read('client/src/utils/Modal.jsx');
  assert.match(modalCode, /window\.cmsPrompt\s*=/);
  assert.match(modalCode, /content:\s*content \|\| label/);
  assert.match(modalCode, /export async function appConfirm/);
  assert.match(modalCode, /export async function appAlert/);
  assert.match(modalCode, /export async function appPrompt/);

  const socketCode = read('client/src/context/SocketContext.jsx');
  assert.match(socketCode, /appAlert/);

  const clientSrcRoot = path.join(ROOT, 'client/src');
  const exts = new Set(['.js', '.jsx', '.ts', '.tsx']);
  const violations = [];

  const stripComments = (source) => source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const scanDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
        continue;
      }
      if (!exts.has(path.extname(entry.name))) continue;
      const rel = path.relative(ROOT, fullPath).replace(/\\/g, '/');
      const code = stripComments(fs.readFileSync(fullPath, 'utf8'));
      if (/(?:window\.(?:alert|confirm|prompt)(?:\?\.)?\s*\()|(?:(?:^|[^.\w$])alert\s*\()/m.test(code)) {
        violations.push(`${rel} calls native alert/confirm/prompt`);
      }
      if (/addEventListener\s*\(\s*['"]beforeunload['"]/.test(code)) {
        violations.push(`${rel} attaches beforeunload handler`);
      }
    }
  };

  scanDir(clientSrcRoot);
  assert.deepEqual(violations, []);
});

test('Mobile App routes all Alert.alert dialogs through custom DewSkill AppAlertHost popup', () => {
  const appCode = read('thang-tin-hoc-mobile/App.tsx');
  assert.match(appCode, /<AppAlertHost\s*\/>/);

  const rnTranslated = read('thang-tin-hoc-mobile/src/i18n/reactNativeTranslated.ts');
  assert.match(rnTranslated, /dispatchAppAlert/);

  const alertHost = read('thang-tin-hoc-mobile/src/components/AppAlertHost.tsx');
  assert.match(alertHost, /setAppAlertHandler/);

  const alertBus = read('thang-tin-hoc-mobile/src/i18n/appAlertBus.ts');
  assert.match(alertBus, /export function dispatchAppAlert/);
});
