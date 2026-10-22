'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('YouTube player errors explain common causes and include the error code', async () => {
  const { describeYouTubePlayerError } = await import(
    '../../client/src/utils/youtubePlayerError.js'
  );

  assert.match(describeYouTubePlayerError(2), /mã lỗi 2.*tham số không hợp lệ/i);
  assert.match(describeYouTubePlayerError(5), /mã lỗi 5.*HTML5/i);
  assert.match(describeYouTubePlayerError(100), /mã lỗi 100.*riêng tư/i);
  assert.match(describeYouTubePlayerError(101), /mã lỗi 101.*không cho phép nhúng/i);
  assert.match(describeYouTubePlayerError(150), /mã lỗi 150.*không cho phép nhúng/i);
  assert.match(describeYouTubePlayerError(153), /mã lỗi 153.*Referer.*Referrer-Policy/i);
  assert.match(describeYouTubePlayerError(999), /mã lỗi 999/);
  assert.match(describeYouTubePlayerError(undefined), /mã lỗi không xác định/);
});
