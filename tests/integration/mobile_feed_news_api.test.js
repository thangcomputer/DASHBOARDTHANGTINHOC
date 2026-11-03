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
  const feedRoutes = read('routes/feedRoutes.js');

  assert.ok(api.includes("'/feed/upload'"));
  assert.ok(api.includes("JSON.stringify({ content, images, visibility:"));
  assert.ok(api.includes('JSON.stringify({ content, parentId, images })'));
  assert.ok(api.includes('maxImages = 6'));
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
  assert.ok(screen.includes('feedReactionSummary'));
  assert.ok(screen.includes('feedCommentSummary'));
  assert.ok(screen.includes('feedEngagement'));
  assert.ok(!screen.includes('feedActionCount'));
  assert.ok(screen.includes('Ẩn bình luận'));
  assert.ok(screen.includes('Viết bình luận thảo luận...'));
  assert.ok(screen.includes('feedCommentRow'));
  assert.ok(screen.includes('feedReplyRow'));
  assert.ok(screen.includes('feedReplyBranch'));
  assert.ok(screen.includes('Trả lời'));
  assert.ok(screen.includes('commentComposerInputRow'));
  assert.ok(screen.includes('selectCommentImages'));
  assert.ok(screen.includes('Thêm ảnh vào bình luận'));
  assert.ok(screen.includes('renderCommentImages(item.images'));
  assert.ok(screen.includes('renderCommentImages(reply.images'));
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
  assert.ok(api.includes("'/feed/reports'"));
  assert.ok(api.includes('/reports`'));
  assert.ok(screen.includes('Báo cáo bài viết'));
  assert.ok(screen.includes('mobile-feed-pins:'));
  assert.ok(screen.includes('togglePersonalPin(post.id)'));
  assert.ok(screen.includes('Ghim bài viết'));
  assert.ok(!screen.includes('toggleFeedPostPin'));
  assert.ok(!screen.includes('Thông báo ghim'));
  assert.ok(screen.includes('Báo cáo cần xem xét'));
  assert.ok(screen.includes('Xóa bài viết'));
  assert.ok(screen.includes('Giữ lại bài viết'));
  assert.ok(screen.includes("resolveFeedReport(report.id, action)"));
  assert.ok(screen.includes('Đã ghim'));
  assert.ok(feedRoutes.includes('FeedPost.find(query).sort({ createdAt: -1 })'));
  assert.ok(!feedRoutes.includes('FeedPost.find(query).sort({ isPinned: -1'));
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

test('web feed exposes reports and personal-only post pinning', () => {
  const api = read('client/src/services/api.js');
  const board = read('client/src/components/FeedBoard.jsx');

  assert.ok(api.includes("apiFetch(`/feed/${postId}/reports`"));
  assert.ok(api.includes("apiFetch('/feed/reports')"));
  assert.ok(api.includes("apiFetch(`/feed/reports/${reportId}/resolve`"));
  assert.ok(board.includes('Báo cáo bài viết'));
  assert.ok(board.includes('Báo cáo cần xem xét'));
  assert.ok(board.includes('Xóa bài viết'));
  assert.ok(board.includes('Giữ lại bài viết'));
  assert.ok(board.includes('feed-personal-pins:'));
  assert.ok(board.includes('Ghim bài viết'));
  assert.ok(!board.includes('handleTogglePin(post)'));
  assert.ok(!board.includes('Thông báo ghim'));
  assert.ok(board.includes('resolvePostReport(report, \'delete\')'));
  assert.ok(board.includes('resolvePostReport(report, \'keep\')'));
  assert.ok(api.includes("body: JSON.stringify({ action })"));
  const routes = read('routes/feedRoutes.js');
  assert.ok(routes.includes("if (!['keep', 'delete'].includes(action))"));
  assert.ok(routes.includes("if (action === 'delete')"));
  assert.ok(routes.includes('FeedPostReport.updateMany'));
});

test('feed comments and new reactions notify the post author through shared notifications', () => {
  const routes = read('routes/feedRoutes.js');
  const mobile = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  const notificationService = read('services/NotificationService.js');
  const mobilePushService = read('services/mobilePushService.js');
  const webLayout = read('client/src/components/DashboardLayout.jsx');
  const webFeed = read('client/src/components/FeedBoard.jsx');
  const mobileFeed = read('thang-tin-hoc-mobile/src/screens/ParityScreens.tsx');
  const mobileApi = read('thang-tin-hoc-mobile/src/services/feedApi.ts');

  assert.ok(routes.includes("const NotificationService = require('../services/NotificationService')"));
  assert.ok(routes.includes('async function notifyFeedAuthor(req, post, interactionType, details = {})'));
  assert.ok(routes.includes("if (postAuthorId && postAuthorId !== actorId)"));
  assert.ok(routes.includes("if (isReply && commentAuthorId && commentAuthorId !== actorId)"));
  assert.ok(routes.includes("kind: 'feed_interaction'"));
  assert.ok(routes.includes("parentComment ? 'reply' : 'comment'"));
  assert.ok(routes.includes('commentAuthorId: parentComment?.authorId'));
  assert.ok(routes.includes('commentId: String(createdComment._id)'));
  assert.ok(routes.includes("isReply ? 'Có người trả lời bình luận của bạn'"));
  assert.ok(routes.includes("type: 'SYSTEM'"));
  assert.ok(routes.includes('if (isNewReaction)'));
  assert.ok(routes.includes("await notifyFeedAuthor(req, post, parentComment ? 'reply' : 'comment'"));
  assert.ok(notificationService.includes('mobilePushService.dispatchToReceivers(receiversArr'));
  assert.ok(notificationService.includes('payload,'));
  assert.ok(mobilePushService.includes("data.payload?.kind === 'feed_interaction'"));
  assert.ok(mobile.includes("if (payload.kind === 'feed_interaction')"));
  assert.ok(mobile.includes("navigation.navigate('MainTabs', {"));
  assert.ok(mobile.includes('postId: String(payload.postId || \'\')'));
  assert.ok(mobile.includes("if (item.payload?.kind === 'feed_interaction') return 'Bảng tin'"));
  assert.ok(webLayout.includes("n.payload?.kind === 'feed_interaction'"));
  assert.ok(webFeed.includes('new URLSearchParams(location.search)'));
  assert.ok(webFeed.includes('feed-comment-${c.id}'));
  assert.ok(webFeed.includes('target?.scrollIntoView'));
  assert.ok(mobileFeed.includes('fetchFeedPosts(focusPostId)'));
  assert.ok(mobileFeed.includes('scrollViewRef={scrollViewRef}'));
  assert.ok(mobileFeed.includes('target.measureLayout('));
  assert.ok(mobileApi.includes('export async function fetchFeedPosts(targetPostId?: string)'));
});

test('mobile push payload shows the specific feed comment or reply notification', () => {
  const { buildEventNotification } = require('../../services/mobilePushService');
  const notification = buildEventNotification('notification', {
    type: 'SYSTEM',
    title: 'Có người trả lời bình luận của bạn',
    content: 'Minh đã trả lời bình luận của bạn: Cảm ơn bạn.',
    payload: { kind: 'feed_interaction', interactionType: 'reply' },
  });

  assert.deepEqual(notification, {
    title: 'Có người trả lời bình luận của bạn',
    body: 'Minh đã trả lời bình luận của bạn: Cảm ơn bạn.',
    channelId: 'default',
  });
});
