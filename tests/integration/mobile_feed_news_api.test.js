'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('mobile feed uses the shared API for images, visibility, reactions and comments', () => {
  const api = read('thang-tin-hoc-mobile/src/services/feedApi.ts');
  const screen = read('thang-tin-hoc-mobile/src/screens/ParityScreens.tsx');
  const apiClient = read('thang-tin-hoc-mobile/src/services/apiClient.ts');

  assert.ok(api.includes("'/feed/upload'"));
  assert.ok(api.includes("JSON.stringify({ content, images, visibility:"));
  assert.ok(api.includes('}/react`'));
  assert.ok(api.includes('}/comments`'));
  assert.ok(api.includes('deleteFeedComment'));
  assert.ok(apiClient.includes("payload?.code === 'CSRF_INVALID'"));
  assert.ok(apiClient.includes('return request(path, init, withAuth, canRefresh, true)'));
  assert.ok(screen.includes('uploadFeedImages'));
  assert.ok(screen.includes('ImagePicker.launchImageLibraryAsync'));
  assert.ok(screen.includes('getMobileImageSource(image)'));
  assert.ok(screen.includes('feedReactionPicker'));
  assert.ok(screen.includes('onHoverOut={scheduleReactionPickerClose}'));
  assert.ok(screen.includes('feedActionCount'));
  assert.ok(!screen.includes('feedReactionSummary'));
  assert.ok(screen.includes('Ẩn bình luận'));
  assert.ok(screen.includes('Viết bình luận thảo luận...'));
  assert.ok(screen.includes('feedCommentRow'));
  assert.ok(screen.includes('feedReplyRow'));
  assert.ok(screen.includes('feedReplyBranch'));
  assert.ok(screen.includes('Trả lời'));
  assert.ok(screen.includes('commentComposerInputRow'));
  assert.ok(screen.includes('AI CÓ THỂ XEM BÀI VIẾT?'));
  assert.ok(screen.includes('Chỉ Học viên & Admin'));
  assert.ok(screen.includes('Học viên không xem được'));
  assert.ok(api.includes("'Chỉ Học viên & Admin': 'students'"));
  assert.ok(screen.includes('Tùy chọn bài viết'));
  assert.ok(screen.includes('Chỉnh sửa'));
  assert.ok(screen.includes('Ẩn bài viết'));
  assert.ok(screen.includes('persistHiddenPostIds'));
  assert.ok(screen.includes('closeOnOutsidePointer'));
  assert.ok(screen.includes("document.addEventListener('pointerdown', closeOnOutsidePointer, true)"));
  assert.ok(screen.includes('event.target.closest(\'#feed-post-menu\')'));
});

test('mobile news list, categories and detail use the shared blog API', () => {
  const service = read('thang-tin-hoc-mobile/src/services/mockService.ts');
  const screen = read('thang-tin-hoc-mobile/src/screens/ParityScreens.tsx');

  assert.ok(service.includes("`/blog/posts?${params.toString()}`"));
  assert.ok(service.includes("'/blog/topics'"));
  assert.ok(service.includes('params.set(\'q\', filters.query.trim())'));
  assert.ok(service.includes('params.set(\'topic\', filters.topicId)'));
  assert.ok(service.includes('params.set(\'sort\', filters.sort)'));
  assert.ok(service.includes('params.set(\'period\', filters.period)'));
  assert.ok(screen.includes('feedService.newsTopics()'));
  assert.ok(screen.includes('newsDropdown'));
  assert.ok(screen.includes('openNewsFilter'));
  assert.ok(screen.includes('<RenderHtml'));
  assert.ok(screen.includes('getMobileImageSource(news.thumbnailUrl)'));
});
