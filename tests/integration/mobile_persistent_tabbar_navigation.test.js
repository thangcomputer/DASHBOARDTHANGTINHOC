'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');

test('persistent footer preserves the selected tab while navigating to secondary screens', () => {
  const navigator = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx'),
    'utf8',
  );
  const rootListener = navigator.match(/export function RootNavigator\(\) \{[\s\S]*?navigationRef\.addListener\('state', \(\) => \{([\s\S]*?)\n    \}\);/);

  assert.ok(rootListener, 'root navigator should retain footer selection across screen changes');
  assert.ok(rootListener[1].includes("if (currentRouteName === 'Students')"));
  assert.ok(rootListener[1].includes("if (currentRouteName !== 'MainTabs') return;"));
  assert.ok(rootListener[1].indexOf("if (currentRouteName !== 'MainTabs') return;") < rootListener[1].indexOf('const mainTabsRoute'));
  assert.ok(rootListener[1].includes('setActiveTab(tabState.routes[tabState.index ?? 0]?.name ?? \'Home\')'));
  assert.ok(navigator.includes('<PersistentTabBar'));
  assert.ok(navigator.includes('role={user.role}'));
  assert.ok(navigator.includes('activeTab={activeTab}'));
  const teacherFooter = navigator.match(/const items = isTeacher\s*\?\s*\[([\s\S]*?)\]\s*:\s*\[/);
  assert.ok(teacherFooter, 'teacher footer items should be defined');
  assert.ok(teacherFooter[1].includes("{ name: 'Finance' as const, label: 'Tài chính', icon: WalletCards }"));
  assert.ok(!teacherFooter[1].includes("{ name: 'Students' as const, label: 'Học viên', icon: Users }"));
});

test('persistent footer shows the same schedule and message badge counts as main tabs', () => {
  const navigator = fs.readFileSync(
    path.join(ROOT, 'thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx'),
    'utf8',
  );
  const persistentStart = navigator.indexOf('function PersistentTabBar(');
  const persistentEnd = navigator.indexOf('\ntype MenuDestination', persistentStart);
  const mainTabsStart = navigator.indexOf('function MainTabs()');
  const mainTabsEnd = navigator.indexOf('<Tab.Navigator', mainTabsStart);
  const persistentBar = persistentStart >= 0 && persistentEnd > persistentStart
    ? navigator.slice(persistentStart, persistentEnd)
    : '';
  const mainTabs = mainTabsStart >= 0 && mainTabsEnd > mainTabsStart
    ? navigator.slice(mainTabsStart, mainTabsEnd)
    : '';

  assert.ok(persistentBar, 'persistent footer should be present');
  assert.ok(mainTabs, 'main tabs should publish badge state');
  assert.ok(navigator.includes('mobile:tab-badge-messages'));
  assert.ok(navigator.includes('mobile:tab-badge-schedule'));
  assert.ok(persistentBar.includes("name === 'Messages'"));
  assert.ok(persistentBar.includes("name === 'Schedule'"));
  assert.ok(persistentBar.includes('badgeCount > 99 ? \'99+\' : badgeCount'));
  assert.ok(persistentBar.includes('styles.persistentTabBadge'));
  assert.ok(mainTabs.includes("DeviceEventEmitter.emit('mobile:tab-badge-messages', unreadConversationCount)"));
  assert.ok(mainTabs.includes("DeviceEventEmitter.emit('mobile:tab-badge-schedule', todayScheduleCount)"));
});
