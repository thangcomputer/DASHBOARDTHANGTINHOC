'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

test('mobile mở app vào tab Tổng quan (Trang chủ) cho mọi vai trò', () => {
  const navigator = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  assert.ok(navigator.includes('initialRouteName="Home"'));
  assert.ok(!navigator.includes("initialRouteName={isTeacher ? 'Home' : 'Schedule'}"));
});

test('trang Liên hệ Trung tâm có tiêu đề riêng, mục đầu là "Giới thiệu" thay vì "Tổng quan"', () => {
  assert.ok(read('client/src/components/DashboardLayout.jsx').includes("if (pathname.includes('/center-info')) return 'Liên hệ Trung tâm';"));
  assert.ok(read('client/src/components/centerInfo/centerInfoConstants.js').includes("{ key: 'overview', label: 'Giới thiệu' }"));
  assert.ok(read('thang-tin-hoc-mobile/src/screens/ParityScreens.tsx').includes("const sectionOptions = [{ title: 'Giới thiệu' }, ...centerSections];"));
});
