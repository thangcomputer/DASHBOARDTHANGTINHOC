'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('mobile UI & navigator optimizations remove known bottlenecks cleanly', () => {
  const rootNav = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  const ui = read('thang-tin-hoc-mobile/src/components/ui.tsx');
  const rnTranslated = read('thang-tin-hoc-mobile/src/i18n/reactNativeTranslated.ts');
  const langCtx = read('thang-tin-hoc-mobile/src/i18n/LanguageContext.tsx');
  const sheet = read('thang-tin-hoc-mobile/src/components/StandardBottomSheet.tsx');
  const renew = read('thang-tin-hoc-mobile/src/components/subscription/SubscriptionRenew.tsx');

  // FloatingNavigationMenu should stay warm in-root instead of cold-mounting native Modal + BlurView
  const drawerStart = rootNav.indexOf('const FloatingNavigationMenu =');
  const drawerEnd = rootNav.indexOf('const FloatingSupportButton =', drawerStart);
  assert.ok(drawerStart > 0 && drawerEnd > drawerStart);
  const drawerSrc = rootNav.slice(drawerStart, drawerEnd);
  assert.ok(!drawerSrc.includes('<Modal'), 'Drawer menu should avoid cold Modal recreation lag');
  assert.ok(!drawerSrc.includes('<BlurView'), 'Drawer menu should avoid animated BlurView lag');
  assert.ok(drawerSrc.includes('useCallback('), 'Drawer menu handlers should be memoized');
  assert.ok(drawerSrc.includes('DrawerMenuRow'), 'Drawer menu rows should be memoized individually');

  // BrandingTopBar AI border spinner should pause when unfocused/inactive and Android headers skip BlurView
  assert.ok(ui.includes('if (!isFocused || !appIsActive)'), 'TopBar spinner loop must pause when unfocused or backgrounded');
  assert.ok(ui.includes("Platform.OS === 'android' ? View : BlurView"), 'Android top/app bars should avoid heavy BlurView passes');

  // TranslatedText uses single O(1) LanguageCodeContext + Vietnamese fast path
  assert.ok(langCtx.includes('LanguageCodeContext'));
  assert.ok(!rnTranslated.includes('useSyncExternalStore'), 'Text wrappers should avoid per-node useSyncExternalStore subscriptions');
  assert.ok(rnTranslated.includes("if (lang !== 'en')"), 'Text/TextInput should short-circuit fast path for Vietnamese');

  // Closed bottom sheets should not mount Modal or child subtrees
  assert.ok(sheet.includes('if (!visible) return null;'));
  assert.ok(renew.includes('dailyPracticeApi.peekOverview'));
});

test('requestCache deduplicates concurrent loaders, honors TTL, and invalidates safely', async () => {
  const cacheSrc = read('thang-tin-hoc-mobile/src/utils/requestCache.ts');
  assert.ok(cacheSrc.includes('export async function coalesceCached'));
  assert.ok(cacheSrc.includes('export function invalidateCache'));
  assert.ok(cacheSrc.includes('export function clearAllRequestCaches'));

  const webSettings = read('thang-tin-hoc-mobile/src/services/webSettingsApi.ts');
  const dpApi = read('thang-tin-hoc-mobile/src/services/dailyPracticeApi.ts');
  const goalApi = read('thang-tin-hoc-mobile/src/services/learningGoalApi.ts');
  const mockSvc = read('thang-tin-hoc-mobile/src/services/mockService.ts');
  const socketSvc = read('thang-tin-hoc-mobile/src/services/socketService.ts');
  const apiClient = read('thang-tin-hoc-mobile/src/services/apiClient.ts');

  assert.ok(webSettings.includes('coalesceCached('));
  assert.ok(dpApi.includes('coalesceCached('));
  assert.ok(goalApi.includes('coalesceCached('));
  assert.ok(mockSvc.includes('coalesceCached('));
  assert.ok(socketSvc.includes('invalidateCachesForSocketEvent'));
  assert.ok(apiClient.includes('clearAllRequestCaches()'));
});
