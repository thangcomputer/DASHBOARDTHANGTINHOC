'use strict';

/**
 * Diff training JSON (videos + softwareLinks) → notify HV/GV + ghi nhật ký admin.
 */
const NotificationService = require('./NotificationService');
const SystemLog = require('../models/SystemLog');
const logger = require('../config/logger');

function courseKey(c) {
  return String(c?.id || c?._id || '').trim();
}

function lessonKey(l) {
  return String(l?.id || l?._id || '').trim();
}

function linkKey(item) {
  return String(item?.id || item?._id || '').trim();
}

function collectLessons(course) {
  const out = [];
  if (!course || typeof course !== 'object') return out;
  if (Array.isArray(course.lessons)) out.push(...course.lessons);
  if (Array.isArray(course.videos)) out.push(...course.videos);
  if (Array.isArray(course.chapters)) {
    course.chapters.forEach((ch) => {
      if (Array.isArray(ch?.lessons)) out.push(...ch.lessons);
    });
  }
  return out;
}

function lessonFingerprint(l) {
  return [
    lessonKey(l),
    String(l?.title || '').trim(),
    String(l?.videoUrl || l?.url || l?.youtubeUrl || l?.link || '').trim(),
    String(l?.duration || ''),
  ].join('|');
}

function courseMetaFingerprint(c) {
  return [
    String(c?.title || '').trim(),
    String(c?.desc || c?.description || '').trim(),
    String(c?.coverImage || ''),
    String(c?.price ?? ''),
  ].join('|');
}

function linkFingerprint(item) {
  return [
    String(item?.title || '').trim(),
    String(item?.linkUrl || item?.url || '').trim(),
    String(item?.description || '').trim(),
    String(item?.installGuide || '').trim(),
  ].join('|');
}

/**
 * @returns {Array<{ kind: string, courseId?: string, courseTitle?: string, linkId?: string, linkTitle?: string, lessonTitles?: string[], addedCount?: number }>}
 */
function diffTrainingContent(oldData, newData) {
  const events = [];

  const oldVideos = Array.isArray(oldData?.videos) ? oldData.videos : [];
  const newVideos = Array.isArray(newData?.videos) ? newData.videos : [];
  const oldMap = new Map();
  oldVideos.forEach((c) => {
    const id = courseKey(c);
    if (id) oldMap.set(id, c);
  });

  for (const course of newVideos) {
    const id = courseKey(course);
    if (!id) continue;
    const title = String(course.title || 'Khóa học').trim() || 'Khóa học';
    const prev = oldMap.get(id);
    if (!prev) {
      events.push({ kind: 'course_added', courseId: id, courseTitle: title });
      continue;
    }

    const prevLessons = collectLessons(prev);
    const nextLessons = collectLessons(course);
    const prevIds = new Set(prevLessons.map(lessonKey).filter(Boolean));
    const added = nextLessons.filter((l) => {
      const lid = lessonKey(l);
      return lid && !prevIds.has(lid);
    });
    if (added.length) {
      events.push({
        kind: 'lessons_added',
        courseId: id,
        courseTitle: title,
        lessonTitles: added.map((l) => String(l.title || 'Bài mới').trim()).filter(Boolean).slice(0, 8),
        addedCount: added.length,
      });
    }

    const prevFp = new Set(prevLessons.map(lessonFingerprint));
    const contentChanged = nextLessons.some((l) => !prevFp.has(lessonFingerprint(l)));
    const metaChanged = courseMetaFingerprint(prev) !== courseMetaFingerprint(course);
    if ((contentChanged || metaChanged) && !added.length) {
      events.push({ kind: 'course_updated', courseId: id, courseTitle: title });
    } else if ((contentChanged || metaChanged) && added.length) {
      // đã có lessons_added — vẫn ghi cập nhật nhẹ nếu meta đổi rõ
      if (metaChanged) {
        events.push({ kind: 'course_updated', courseId: id, courseTitle: title });
      }
    }
  }

  const oldLinks = Array.isArray(oldData?.softwareLinks) ? oldData.softwareLinks : [];
  const newLinks = Array.isArray(newData?.softwareLinks) ? newData.softwareLinks : [];
  const oldLinkMap = new Map();
  oldLinks.forEach((item) => {
    const id = linkKey(item);
    if (id) oldLinkMap.set(id, item);
  });

  for (const item of newLinks) {
    const id = linkKey(item);
    if (!id) continue;
    const title = String(item.title || item.name || 'Link phần mềm').trim() || 'Link phần mềm';
    const prev = oldLinkMap.get(id);
    if (!prev) {
      events.push({ kind: 'software_link_added', linkId: id, linkTitle: title, linkUrl: item.linkUrl || item.url || '' });
      continue;
    }
    if (linkFingerprint(prev) !== linkFingerprint(item)) {
      events.push({ kind: 'software_link_updated', linkId: id, linkTitle: title, linkUrl: item.linkUrl || item.url || '' });
    }
  }

  const newLinkIds = new Set(newLinks.map(linkKey).filter(Boolean));
  for (const [id, item] of oldLinkMap.entries()) {
    if (newLinkIds.has(id)) continue;
    const title = String(item.title || item.name || 'Link phần mềm').trim() || 'Link phần mềm';
    events.push({
      kind: 'software_link_deleted',
      linkId: id,
      linkTitle: title,
      linkUrl: item.linkUrl || item.url || '',
    });
  }

  const newCourseIds = new Set(newVideos.map(courseKey).filter(Boolean));
  for (const [id, course] of oldMap.entries()) {
    if (newCourseIds.has(id)) continue;
    const title = String(course.title || 'Khóa học').trim() || 'Khóa học';
    events.push({ kind: 'course_deleted', courseId: id, courseTitle: title });
  }

  return events;
}

function deepLinkForEvent(audience, ev) {
  if (ev.kind === 'software_link_added' || ev.kind === 'software_link_updated') {
    return audience === 'teacher'
      ? '/teacher#software-links'
      : '/student#materials-software';
  }
  const section = audience === 'teacher' ? 'training' : 'materials-videos';
  const q = new URLSearchParams();
  if (ev.courseId) q.set('courseId', String(ev.courseId));
  q.set('tab', 'list');
  return `/${audience}#${section}?${q.toString()}`;
}

function notifCopy(ev, audience) {
  const isTeacher = audience === 'teacher';
  switch (ev.kind) {
    case 'course_added':
      return {
        title: isTeacher ? 'Khóa đào tạo mới' : 'Khóa học video mới',
        content: `Admin vừa thêm khóa học: ${ev.courseTitle}. Bấm để mở khóa học.`,
      };
    case 'lessons_added': {
      const names = (ev.lessonTitles || []).slice(0, 3).join(', ');
      const more = ev.addedCount > 3 ? ` (+${ev.addedCount - 3} bài)` : '';
      return {
        title: isTeacher ? 'Có bài học mới trong khóa đào tạo' : 'Có bài học video mới',
        content: `${ev.courseTitle}: thêm ${ev.addedCount || 0} bài${names ? ` — ${names}` : ''}${more}. Bấm để xem.`,
      };
    }
    case 'course_updated':
      return {
        title: isTeacher ? 'Khóa đào tạo đã cập nhật' : 'Khóa học video đã cập nhật',
        content: `Admin vừa chỉnh sửa: ${ev.courseTitle}. Bấm để xem nội dung mới.`,
      };
    case 'software_link_added':
      return {
        title: 'Link phần mềm mới',
        content: `Admin vừa thêm: ${ev.linkTitle}${ev.linkUrl ? ` (${ev.linkUrl})` : ''}. Bấm để mở danh sách.`,
      };
    case 'software_link_updated':
      return {
        title: 'Link phần mềm đã cập nhật',
        content: `Admin vừa chỉnh sửa: ${ev.linkTitle}. Bấm để xem hướng dẫn / link mới.`,
      };
    default:
      return { title: 'Cập nhật đào tạo', content: 'Có cập nhật mới từ Admin.' };
  }
}

function systemLogAction(ev) {
  switch (ev.kind) {
    case 'course_added':
      return 'THÊM KHÓA HỌC VIDEO';
    case 'lessons_added':
      return 'THÊM BÀI HỌC VIDEO';
    case 'course_updated':
      return 'CẬP NHẬT KHÓA HỌC VIDEO';
    case 'course_deleted':
      return 'XÓA KHÓA HỌC VIDEO';
    case 'software_link_added':
      return 'THÊM LINK PHẦN MỀM';
    case 'software_link_updated':
      return 'CẬP NHẬT LINK PHẦN MỀM';
    case 'software_link_deleted':
      return 'XÓA LINK PHẦN MỀM';
    default:
      return '';
  }
}

function systemLogMessage(ev, audience) {
  const scope = audience === 'teacher' ? 'Đào tạo GV' : 'Đào tạo HV';
  switch (ev.kind) {
    case 'course_added':
      return `${scope}: thêm khóa học «${ev.courseTitle}»`;
    case 'lessons_added':
      return `${scope}: thêm ${ev.addedCount || 0} bài vào «${ev.courseTitle}»`;
    case 'course_updated':
      return `${scope}: chỉnh sửa khóa «${ev.courseTitle}»`;
    case 'course_deleted':
      return `${scope}: xóa khóa học «${ev.courseTitle}»`;
    case 'software_link_added':
      return `${scope}: thêm link phần mềm «${ev.linkTitle}»`;
    case 'software_link_updated':
      return `${scope}: chỉnh sửa link «${ev.linkTitle}»`;
    case 'software_link_deleted':
      return `${scope}: xóa link phần mềm «${ev.linkTitle}»`;
    default:
      return `${scope}: cập nhật nội dung`;
  }
}

async function writeTrainingSystemLogs(events, opts = {}) {
  const {
    audience = 'student',
    actorUserId = 'SYSTEM',
    actorName = 'Admin',
    actorRole = 'admin',
    ip = 'unknown',
    userAgent = '',
  } = opts;

  const rows = [];
  for (const ev of events.slice(0, 20)) {
    const action = systemLogAction(ev);
    if (!action) continue;
    rows.push({
      user_id: String(actorUserId || 'SYSTEM'),
      name: String(actorName || 'Admin'),
      role: String(actorRole || 'admin'),
      action,
      category: 'training',
      target: ev.courseId || ev.linkId || '',
      message: systemLogMessage(ev, audience),
      method: 'SERVICE',
      ip: String(ip || 'unknown').slice(0, 80),
      userAgent: String(userAgent || '').slice(0, 500),
    });
  }
  if (!rows.length) return;
  await SystemLog.insertMany(rows).catch((err) => {
    logger.warn('[lmsTrainingNotify] SystemLog insert failed: %s', err.message);
  });
}

/**
 * @param {object} io
 * @param {{ audience: 'student'|'teacher', oldData: object, newData: object, senderId?: string, actorName?: string, actorRole?: string, ip?: string, userAgent?: string }} opts
 */
async function notifyTrainingVideoChanges(io, opts = {}) {
  try {
    const audience = opts.audience === 'teacher' ? 'teacher' : 'student';
    const events = diffTrainingContent(opts.oldData, opts.newData);
    if (!events.length) return null;

    await writeTrainingSystemLogs(events, {
      audience,
      actorUserId: opts.senderId || 'SYSTEM',
      actorName: opts.actorName || 'Admin',
      actorRole: opts.actorRole || 'admin',
      ip: opts.ip,
      userAgent: opts.userAgent,
    });

    const receivers = audience === 'teacher' ? ['ALL_TEACHER'] : ['ALL_STUDENT'];
    const results = [];

    // Chỉ chuông HV/GV cho thêm/sửa — xóa chỉ ghi nhật ký admin
    const notifyKinds = new Set([
      'course_added',
      'software_link_added',
      'lessons_added',
      'course_updated',
      'software_link_updated',
    ]);
    const priority = {
      course_added: 0,
      software_link_added: 1,
      lessons_added: 2,
      course_updated: 3,
      software_link_updated: 4,
    };
    const sorted = events
      .filter((ev) => notifyKinds.has(ev.kind))
      .sort((a, b) => (priority[a.kind] ?? 9) - (priority[b.kind] ?? 9));

    for (const ev of sorted.slice(0, 8)) {
      const copy = notifCopy(ev, audience);
      const link = deepLinkForEvent(audience, ev);
      const doc = await NotificationService.send(io, {
        type: 'COURSE',
        title: copy.title,
        content: copy.content,
        sender_id: opts.senderId || 'SYSTEM',
        receivers,
        payload: {
          kind: 'lms_course_update',
          action: ev.kind,
          audience,
          courseId: ev.courseId || '',
          linkId: ev.linkId || '',
          events: [ev],
        },
        link,
      });
      results.push(doc);
    }

    return results;
  } catch (err) {
    logger.error('[lmsTrainingNotify] notifyTrainingVideoChanges:', err);
    return null;
  }
}

module.exports = {
  diffTrainingContent,
  diffVideoCourses: (oldVideos, newVideos) =>
    diffTrainingContent({ videos: oldVideos }, { videos: newVideos }),
  notifyTrainingVideoChanges,
  collectLessons,
};
