'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

test('mobile: video bài giảng luôn phát trong khung, link không hợp lệ báo tại chỗ', () => {
  const screen = read('thang-tin-hoc-mobile/src/screens/CourseVideosScreen.tsx');
  assert.ok(screen.includes('const url = playableVideoUrl(rawUrl);'));
  assert.ok(screen.includes('if (url) setStarted(true);'));
  assert.ok(!/startVideo = \(\) => \{[\s\S]{0,200}onOpenVideo\(/.test(screen), 'không mở link ra tab/ứng dụng khác');
  assert.ok(screen.includes('Liên kết video chưa đúng'));

  const source = read('thang-tin-hoc-mobile/src/utils/videoSource.ts');
  assert.ok(source.includes("if (/^[\\w-]{11}$/.test(raw)) return raw;"), 'nhận mã YouTube đứng riêng như web');
  assert.ok(source.includes('embed|shorts|live|v'), 'nhận link /live/ như web');
  for (const file of ['VideoPlayerFrame.native.tsx', 'VideoPlayerFrame.web.tsx']) {
    assert.ok(read(`thang-tin-hoc-mobile/src/screens/${file}`).includes("from '../utils/videoSource'"), file);
  }
});
