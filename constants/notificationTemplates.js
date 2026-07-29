/**
 * Notification templates — render title/body/path (Phase 5 / ADR 0005).
 * {{var}} được thay từ data.
 */
const { DEEP_LINKS, resolveDeepLink } = require('./deepLinks');

function renderTpl(str, data = {}) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = data[key];
    return v == null ? '' : String(v);
  });
}

const TEMPLATES = Object.freeze({
  PASSWORD_PROVISIONED: {
    code: 'PASSWORD_PROVISIONED',
    type: 'SYSTEM',
    title: 'Mật khẩu đã được cấp lại',
    body: 'Admin đã cấp mật khẩu mới. Vui lòng đăng nhập và đổi mật khẩu ngay.',
    deepLinkKey: 'STUDENT_HOME',
    channels: ['in_app', 'zalo', 'email'],
    priority: 'high',
  },
  PASSWORD_CHANGED: {
    code: 'PASSWORD_CHANGED',
    type: 'SYSTEM',
    title: 'Đổi mật khẩu thành công',
    body: 'Mật khẩu tài khoản của bạn vừa được cập nhật.',
    deepLinkKey: 'STUDENT_HOME',
    channels: ['in_app'],
    priority: 'normal',
  },
  CLASS_REMINDER_TODAY: {
    code: 'CLASS_REMINDER_TODAY',
    type: 'SCHEDULE',
    title: 'Hôm nay bạn có lịch học',
    body: 'Hôm nay bạn có {{count}} buổi: {{summary}}',
    deepLinkKey: 'STUDENT_SCHEDULE',
    channels: ['in_app'],
    priority: 'high',
  },
  PAYMENT_SUCCESS: {
    code: 'PAYMENT_SUCCESS',
    type: 'FINANCE',
    title: 'Thanh toán thành công',
    body: 'Học phí khóa {{course}} đã được ghi nhận. Bạn đã được cấp quyền học.',
    deepLinkKey: 'STUDENT_HOME',
    channels: ['in_app', 'zalo', 'email'],
    priority: 'high',
  },
  SCHEDULE_NEW: {
    code: 'SCHEDULE_NEW',
    type: 'SCHEDULE',
    title: 'Lịch học mới',
    body: 'Lịch học {{course}} ngày {{date}} lúc {{time}} đã được thêm.',
    deepLinkKey: 'STUDENT_SCHEDULE',
    channels: ['in_app'],
    priority: 'normal',
  },
  EXAM_RESULT: {
    code: 'EXAM_RESULT',
    type: 'EXAM',
    title: 'Kết quả thi: {{outcome}}',
    body: '{{subject}} — {{outcome}}. {{detail}}',
    deepLinkKey: 'STUDENT_EXAM',
    channels: ['in_app'],
    priority: 'high',
  },
  EXAM_UNLOCKED: {
    code: 'EXAM_UNLOCKED',
    type: 'EXAM',
    title: 'Phòng thi đã mở khóa',
    body: 'Bạn đã được cấp quyền vào phòng thi. Vào mục Phòng Thi để bắt đầu.',
    deepLinkKey: 'STUDENT_EXAM',
    channels: ['in_app'],
    priority: 'high',
  },
  EXAM_LOCKED: {
    code: 'EXAM_LOCKED',
    type: 'EXAM',
    title: 'Phòng thi đã bị khóa',
    body: 'Phòng thi của bạn đã bị khóa. Lý do: {{reason}}',
    deepLinkKey: 'STUDENT_EXAM',
    channels: ['in_app'],
    priority: 'high',
  },
  EXAM_VIOLATION: {
    code: 'EXAM_VIOLATION',
    type: 'EXAM',
    title: 'Vi phạm quy chế thi',
    body: 'Bài thi bị ghi nhận vi phạm. Lý do: {{reason}}',
    deepLinkKey: 'STUDENT_EXAM',
    channels: ['in_app'],
    priority: 'high',
  },
  RATING_APPROVED: {
    code: 'RATING_APPROVED',
    type: 'EVALUATION',
    title: 'Đánh giá giảng viên đã được duyệt',
    body: 'Đánh giá của học viên {{studentName}} đã được công khai.',
    deepLinkKey: 'TEACHER_HOME',
    channels: ['in_app'],
    priority: 'normal',
  },
  REWARD_PAID: {
    code: 'REWARD_PAID',
    type: 'FINANCE',
    title: 'Thưởng giảng viên',
    body: 'Bạn được thưởng {{amount}}đ kỳ {{periodKey}} ({{pct}}% 5 sao).',
    deepLinkKey: 'TEACHER_FINANCE',
    channels: ['in_app'],
    priority: 'high',
  },
  SYSTEM_BROADCAST: {
    code: 'SYSTEM_BROADCAST',
    type: 'SYSTEM',
    title: '{{title}}',
    body: '{{content}}',
    deepLinkKey: 'NOTIFICATION_CENTER',
    channels: ['in_app'],
    priority: 'normal',
  },
  COURSE_SOFT_DELETED: {
    code: 'COURSE_SOFT_DELETED',
    type: 'COURSE',
    title: 'Khóa học đã ngừng mở đăng ký',
    body: 'Khóa học "{{courseName}}" đã được gỡ khỏi danh mục. Lịch sử học và thanh toán của bạn vẫn được giữ nguyên.',
    deepLinkKey: 'STUDENT_HOME',
    channels: ['in_app'],
    priority: 'high',
  },
});

function getTemplate(code) {
  return TEMPLATES[String(code || '').toUpperCase()] || null;
}

/**
 * @returns {{ type, title, content, link, channels, priority, templateCode }}
 */
function renderTemplate(code, data = {}) {
  const tpl = getTemplate(code);
  if (!tpl) {
    const err = new Error(`Unknown notification template: ${code}`);
    err.status = 400;
    throw err;
  }
  const deepLinkKey = data.deepLinkKey || tpl.deepLinkKey;
  const link = data.link
    || resolveDeepLink(deepLinkKey, data)
    || DEEP_LINKS.NOTIFICATION_CENTER;

  return {
    templateCode: tpl.code,
    type: tpl.type,
    title: renderTpl(tpl.title, data).slice(0, 200) || tpl.code,
    content: renderTpl(tpl.body, data).slice(0, 2000),
    link,
    channels: Array.isArray(data.channels) ? data.channels : tpl.channels.slice(),
    priority: data.priority || tpl.priority || 'normal',
  };
}

function buildIdempotencyKey(eventId, receivers) {
  const ev = String(eventId || '').trim();
  if (!ev) return '';
  const recv = (Array.isArray(receivers) ? receivers : [receivers])
    .map((r) => String(r))
    .filter(Boolean)
    .sort()
    .join(',');
  return `${ev}::${recv}`;
}

module.exports = {
  TEMPLATES,
  getTemplate,
  renderTemplate,
  renderTpl,
  buildIdempotencyKey,
};
