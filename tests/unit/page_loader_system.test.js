const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test('hệ thống loader xịn xò: LoadingScreen, TopLoadingBar, HTML preloader & TabFallback', () => {
  // 1. Kiểm tra LoadingScreen.jsx
  const loadingScreenCode = fs.readFileSync(path.join(root, 'client/src/components/LoadingScreen.jsx'), 'utf8');
  assert.ok(loadingScreenCode.includes('export default function LoadingScreen'), 'LoadingScreen phải xuất default');
  assert.ok(loadingScreenCode.includes('export function LoadingIcon3D'), 'LoadingScreen phải xuất LoadingIcon3D');
  assert.ok(loadingScreenCode.includes('export function TabFallback'), 'LoadingScreen phải xuất TabFallback');
  assert.ok(loadingScreenCode.includes('loading-laser-beam'), 'Phải có hiệu ứng laser scanning progress');
  assert.ok(loadingScreenCode.includes('Thắng Tin Học'), 'Phải có thương hiệu Thắng Tin Học');

  // 2. Kiểm tra TopLoadingBar.jsx
  const topLoadingBarCode = fs.readFileSync(path.join(root, 'client/src/components/ui/TopLoadingBar.jsx'), 'utf8');
  assert.ok(topLoadingBarCode.includes('cms:api-loading'), 'TopLoadingBar phải lắng nghe sự kiện cms:api-loading');
  assert.ok(topLoadingBarCode.includes('linear-gradient(90deg, #10b981'), 'TopLoadingBar phải dùng gradient màu xanh xịn xò');

  // 3. Kiểm tra api.js bắt sự kiện mạng
  const apiCode = fs.readFileSync(path.join(root, 'client/src/services/api.js'), 'utf8');
  assert.ok(apiCode.includes("window.dispatchEvent(new CustomEvent('cms:api-loading'"), 'api.js phải phát sự kiện cms:api-loading');

  // 4. Kiểm tra index.html có preloader tức thì
  const indexHtml = fs.readFileSync(path.join(root, 'client/index.html'), 'utf8');
  assert.ok(indexHtml.includes('id="app-preloader"'), 'index.html phải có preloader tức thì');
  assert.ok(indexHtml.includes('/brand/logo.webp'), 'index.html phải hiển thị logo thương hiệu');

  // 5. Kiểm tra các Lazy Tab Shell sử dụng TabFallback
  const adminShell = fs.readFileSync(path.join(root, 'client/src/components/admin/AdminLazyTabShell.jsx'), 'utf8');
  assert.ok(adminShell.includes('TabFallback') && adminShell.includes('../LoadingScreen'), 'AdminLazyTabShell phải dùng TabFallback');

  const studentShell = fs.readFileSync(path.join(root, 'client/src/components/student/StudentLazyTabShell.jsx'), 'utf8');
  assert.ok(studentShell.includes('TabFallback') && studentShell.includes('../LoadingScreen'), 'StudentLazyTabShell phải dùng TabFallback');

  const teacherShell = fs.readFileSync(path.join(root, 'client/src/components/teacher/TeacherLazyTabShell.jsx'), 'utf8');
  assert.ok(teacherShell.includes('TabFallback') && teacherShell.includes('../LoadingScreen'), 'TeacherLazyTabShell phải dùng TabFallback');

  // 6. Kiểm tra App.jsx
  const appCode = fs.readFileSync(path.join(root, 'client/src/App.jsx'), 'utf8');
  assert.ok(appCode.includes('<TopLoadingBar />'), 'App.jsx phải render TopLoadingBar');
  assert.ok(appCode.includes('<LoadingScreen') && !appCode.includes("borderTop: '3px solid #3b82f6'"), 'App.jsx không còn spinner xám cũ');
});
