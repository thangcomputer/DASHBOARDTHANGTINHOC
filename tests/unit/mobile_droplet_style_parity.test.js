'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const compact = (value) => value.replace(/\s+/g, '').replace(/0px/g, '0');

test('mobile droplet shadows match the web button and bottom navigation', () => {
  const css = compact(read('client/src/index.css'));
  const sidebar = compact(read('client/src/components/AppSidebar.jsx'));
  const tokens = compact(read('thang-tin-hoc-mobile/src/theme/tokens.ts'));

  const webButton = 'inset1px1px2pxrgba(15,23,42,0.16),inset-1px-1px2pxrgba(255,255,255,0.32),01px2pxrgba(15,23,42,0.08)';
  const webPressed = 'inset2px2px5pxrgba(15,23,42,0.2),inset-1px-1px3pxrgba(255,255,255,0.2)';
  assert.ok(css.includes(webButton));
  assert.ok(css.includes(webPressed));
  assert.ok(tokens.includes(`button:'${webButton}'`));
  assert.ok(tokens.includes(`buttonPressed:'${webPressed}'`));

  assert.ok(sidebar.includes('shadow-[inset_2px_2px_5px_rgba(71,85,105,0.14),inset_-2px_-2px_5px_rgba(255,255,255,0.96)]'));
  assert.ok(tokens.includes("navTile:'inset2px2px5pxrgba(71,85,105,0.14),inset-2px-2px5pxrgba(255,255,255,0.96)'"));
  assert.ok(sidebar.includes('shadow-[inset_2px_2px_5px_rgba(127,29,29,0.32),inset_-2px_-2px_5px_rgba(255,255,255,0.18)]'));
  assert.ok(tokens.includes("navTileActive:'inset2px2px5pxrgba(127,29,29,0.32),inset-2px-2px5pxrgba(255,255,255,0.18)'"));
  assert.ok(sidebar.includes('shadow-[0_5px_16px_rgba(185,28,28,0.32),0_0_0_3px_rgba(254,202,202,0.6),inset_0_3px_5px_rgba(255,255,255,0.5),inset_0_-5px_8px_rgba(127,29,29,0.5)]'));
  assert.ok(tokens.includes("navHome:'05px16pxrgba(185,28,28,0.32),0003pxrgba(254,202,202,0.6),inset03px5pxrgba(255,255,255,0.5),inset0-5px8pxrgba(127,29,29,0.5)'"));
});

test('mobile tab bars share one droplet nav item with a round home button', () => {
  const navigator = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  const ui = read('thang-tin-hoc-mobile/src/components/ui.tsx');

  assert.equal((navigator.match(/<NavTabContent/g) || []).length, 2);
  assert.ok(navigator.includes("isHome={name === 'Home'}"));
  assert.ok(navigator.includes("isHome={route.name === 'Home'}"));
  assert.ok(navigator.includes('navTileHome: { width: 56, height: 56, borderWidth: 3, borderColor: \'#FFFFFF\', borderRadius: 28'));
  assert.ok(navigator.includes('isHome ? styles.navItemHome : styles.navItemCard'));
  assert.ok(navigator.includes('{isHome ? null : ('));
  assert.ok(navigator.includes('boxShadow: droplet.navBar'));
  assert.ok(ui.includes('boxShadow: droplet.button'));
  assert.ok(ui.includes('pressed: { boxShadow: droplet.buttonPressed'));
});
