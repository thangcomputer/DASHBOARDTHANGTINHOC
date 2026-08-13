const express = require('express');
const router = express.Router();
const TrainingCourse = require('../models/TrainingCourse');
const TrainingLesson = require('../models/TrainingLesson');
const TrainingProgress = require('../models/TrainingProgress');
const { authMiddleware } = require('../middleware/auth');
const { policyShadowTrainingLms } = require('../middleware/policyShadowTrainingLms');
const { trainingLmsCutoverGate } = require('../middleware/trainingLmsCutoverGate');
const {
  isLessonAntiSeekEnabled,
  parseLessonDurationSeconds,
  resolveEffectiveDuration,
  findLessonInCourse,
  clampWatchProgressIncrease,
  previousLessonId,
} = require('../utils/antiSeekPolicy');
const {
  isLessonAllowEarlyAccess,
  resolveLessonLearningState,
  evaluateCompletionRequirement,
  LESSON_COMPLETION_REQUIREMENT_CODE,
  LESSON_COMPLETION_REQUIREMENT_MESSAGE,
} = require('../utils/lessonLearningPolicy');

/**
 * LIVE mount: server.js → app.use('/api/training-lms', trainingRoutes)
 *
 * Phase 7.13 — Controlled cutover for /api/training-lms ONLY (not /api/training).
 * Flow: auth → policyShadowTrainingLms(action) → trainingLmsCutoverGate(action) → handler
 * Legacy fallback: auth-only pass-through; lms_admin_progress → checkPermission(MANAGE_TRAINING).
 */

function lmsGuard(action) {
  return [authMiddleware, policyShadowTrainingLms(action), trainingLmsCutoverGate(action)];
}

// Lấy danh sách khóa đào tạo
router.get('/courses', lmsGuard('lms_courses'), async (req, res) => {
  try {
    const courses = await TrainingCourse.find({ isActive: true });
    res.json({ success: true, data: courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function findCourseInSettings(settings, courseId) {
  const id = String(courseId);
  const teacherVideos = (settings.trainingRawData && settings.trainingRawData.videos) || [];
  const studentVideos = (settings.studentTrainingRawData && settings.studentTrainingRawData.videos) || [];
  return (
    teacherVideos.find((c) => String(c.id || c._id) === id)
    || studentVideos.find((c) => String(c.id || c._id) === id)
    || null
  );
}

// Lấy danh sách bài học của 1 khóa (Kèm trạng thái khóa/mở)
router.get('/courses/:id/lessons', lmsGuard('lms_lessons'), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const courseId = req.params.id;

    const SystemSettings = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne() || {};
    const course = findCourseInSettings(settings, courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Khóa học không tồn tại' });

    if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const { itemMatchesSubjectIds, resolveTeacherSubjectIds } = require('../utils/trainingSubjectAccess');
      const teacher = await Teacher.findById(userId).select('subjectIds specialty').lean();
      const allowed = resolveTeacherSubjectIds(teacher || {});
      if (!itemMatchesSubjectIds(course, allowed)) {
        return res.status(403).json({ success: false, message: 'Khóa học này không thuộc chuyên môn của bạn' });
      }
    }
    
    // Normalize lessons from course structure
    let lessons = [];
    if (course.lessons && course.lessons.length > 0) lessons = course.lessons;
    else if (course.videos && course.videos.length > 0) lessons = course.videos;
    else if (course.chapters && course.chapters.length > 0) {
      course.chapters.forEach(ch => {
        if (ch.lessons) lessons.push(...ch.lessons.map(l => ({ ...l, chapterTitle: ch.title })));
      });
    }

    if (lessons.length === 0 && (course.videoUrl || course.url || course.youtubeUrl || course.link)) {
      lessons = [{ _id: `v-${course.id || course._id}`, title: course.title, videoUrl: course.videoUrl || course.url || course.youtubeUrl || course.link, duration: course.duration || 0 }];
    }

    // Assign consistent _id to each lesson (if not present, use its generated ID)
    lessons = lessons.map((l, i) => ({ ...l, _id: l.id || l._id || `ls-${i}` }));

    // 2. Lấy tiến độ của user cho khóa này
    const progress = await TrainingProgress.find({ userId, courseId });
    const completedLessonIds = progress
      .filter(p => p.status === 'completed')
      .map(p => String(p.lessonId));

    // Map watchedSeconds theo lessonId
    const watchedSecondsMap = {};
    progress.forEach(p => { watchedSecondsMap[String(p.lessonId)] = p.watchedSeconds || 0; });

    // 3. ACCESS / SEEK / COMPLETION — independent (see lessonLearningPolicy)
    const lessonsWithStatus = lessons.map((lesson, index) => {
      const watched = watchedSecondsMap[String(lesson._id)] || 0;
      const state = resolveLessonLearningState({
        lesson,
        index,
        course,
        completedLessonIds,
        watchedSeconds: watched,
      });

      const base = {
        ...lesson,
        isCompleted: state.isCompleted,
        isUnlocked: state.isUnlocked,
        canAccess: state.canAccess,
        allowEarlyAccess: state.allowEarlyAccess,
        watchedSeconds: watched,
        antiSeek: state.antiSeekEnabled,
        adminDurationSeconds: state.adminDurationSeconds,
        requiredWatchSeconds: state.requiredSeconds,
        requiredSeconds: state.requiredSeconds,
        completionEligible: state.completionEligible,
        durationUnknown: state.durationUnknown,
        effectiveDurationSeconds: state.effectiveDurationSeconds,
        prerequisiteLessonId: state.prerequisiteLessonId,
        prerequisiteCompleted: state.prerequisiteCompleted,
      };
      // Không lộ nội dung video bài khóa qua API list
      if (!state.canAccess) {
        return {
          ...base,
          videoUrl: undefined,
          url: undefined,
          youtubeUrl: undefined,
          link: undefined,
          contentLocked: true,
        };
      }
      return base;
    });

    res.json({ success: true, data: lessonsWithStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Hoàn thành bài học — SoT: TrainingProgress + ACCESS/COMPLETION độc lập với SEEK
router.post('/complete-lesson', lmsGuard('lms_complete_lesson'), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { lessonId, courseId, watchedSeconds, videoDuration } = req.body;

    if (!lessonId || !courseId) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu bài học' });
    }

    const existing = await TrainingProgress.findOne({ userId, lessonId }).lean();
    if (existing?.status === 'completed') {
      return res.json({ success: true, message: 'Bài học đã được hoàn thành trước đó.', alreadyCompleted: true });
    }

    const SystemSettings = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne() || {};
    const course = findCourseInSettings(settings, courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Khóa học không tồn tại' });
    }
    const lesson = findLessonInCourse(course, lessonId);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Bài học không tồn tại trong khóa' });
    }

    // ACCESS: prerequisite required unless allowEarlyAccess (does NOT bypass 2/3)
    const allowEarly = isLessonAllowEarlyAccess(lesson);
    const prevId = previousLessonId(course, lessonId);
    if (prevId && !allowEarly) {
      const prevProg = await TrainingProgress.findOne({ userId, lessonId: prevId, status: 'completed' }).lean();
      if (!prevProg) {
        return res.status(403).json({
          success: false,
          code: 'PREVIOUS_LESSON_REQUIRED',
          message: 'Hoàn thành bài trước để mở bài này.',
        });
      }
    }

    const effectiveDuration = resolveEffectiveDuration(lesson.duration, videoDuration);

    // Flush client watch into server with elapsed clamp (same as save-watch)
    const serverWatched = Math.max(0, Number(existing?.watchedSeconds) || 0);
    const clientClaim = Math.max(0, Number(watchedSeconds) || 0);
    const credited = clampWatchProgressIncrease({
      previous: serverWatched,
      incoming: clientClaim,
      lastWatchedAt: existing?.lastWatchedAt,
      maxSeconds: effectiveDuration > 0 ? effectiveDuration : 0,
    });

    // Persist flushed progress even if we later reject completion (so next try has SoT)
    if (credited > serverWatched) {
      await TrainingProgress.findOneAndUpdate(
        { userId, lessonId, status: { $ne: 'completed' } },
        { watchedSeconds: credited, courseId, lastWatchedAt: new Date() },
        { upsert: true }
      );
    }

    // COMPLETION: ALWAYS require 2/3 — independent of antiSeek / allowEarlyAccess
    // Duration SoT: resolveEffectiveDuration(admin, YouTube client report)
    const completion = evaluateCompletionRequirement({
      watchedSeconds: credited,
      effectiveDuration,
    });
    if (completion.durationUnknown) {
      return res.status(422).json({
        success: false,
        code: LESSON_COMPLETION_REQUIREMENT_CODE,
        message: 'Chưa xác định được thời lượng video. Hãy phát video để hệ thống lấy độ dài YouTube.',
        data: {
          watchedSeconds: completion.watchedSeconds,
          requiredSeconds: 0,
          durationSeconds: 0,
          durationUnknown: true,
          adminDurationSeconds: parseLessonDurationSeconds(lesson.duration),
          videoDurationSeconds: Math.floor(Number(videoDuration) || 0) || null,
          antiSeekEnabled: isLessonAntiSeekEnabled(lesson),
          allowEarlyAccess: allowEarly,
        },
      });
    }
    if (!completion.completionEligible) {
      return res.status(422).json({
        success: false,
        code: LESSON_COMPLETION_REQUIREMENT_CODE,
        message: LESSON_COMPLETION_REQUIREMENT_MESSAGE,
        data: {
          watchedSeconds: completion.watchedSeconds,
          requiredSeconds: completion.requiredSeconds,
          durationSeconds: completion.durationSeconds,
          adminDurationSeconds: parseLessonDurationSeconds(lesson.duration),
          videoDurationSeconds: Math.floor(Number(videoDuration) || 0) || null,
          antiSeekEnabled: isLessonAntiSeekEnabled(lesson),
          allowEarlyAccess: allowEarly,
        },
      });
    }

    await TrainingProgress.findOneAndUpdate(
      { userId, lessonId },
      {
        status: 'completed',
        courseId,
        watchedSeconds: Math.max(credited, serverWatched),
        completedAt: new Date(),
        lastWatchedAt: new Date(),
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({
      success: true,
      message: 'Chúc mừng! Bạn đã hoàn thành bài học này.',
      data: {
        lessonId: String(lessonId),
        courseId: String(courseId),
        status: 'completed',
        watchedSeconds: Math.max(credited, serverWatched),
        effectiveDuration,
        requiredSeconds: completion.requiredSeconds,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function collectCourseLessons(course) {
  let courseLessons = course.lessons || course.videos || [];
  if (courseLessons.length === 0 && course.chapters) {
    course.chapters.forEach((ch) => {
      if (ch.lessons) courseLessons = courseLessons.concat(ch.lessons);
    });
  }
  if (courseLessons.length === 0 && (course.videoUrl || course.url || course.youtubeUrl || course.link)) {
    courseLessons = [{
      id: `v-${course.id || course._id}`,
      title: course.title,
      videoUrl: course.videoUrl || course.url || course.youtubeUrl || course.link,
      duration: course.duration || '',
    }];
  }
  return courseLessons;
}

function mapLessonForTeacherUi(lesson, index) {
  const url = lesson.videoUrl || lesson.url || lesson.youtubeUrl || lesson.link || '';
  let duration = lesson.duration || '';
  if (typeof duration === 'number' && duration > 0) {
    const m = Math.floor(duration / 60);
    const s = duration % 60;
    duration = `${m}:${String(s).padStart(2, '0')}`;
  }
  return {
    title: lesson.title || `Bài ${index + 1}`,
    url,
    duration: duration || '—',
  };
}

function mapFileForTeacherUi(file) {
  return {
    title: file.title || file.name || 'Tài liệu',
    type: file.fileType || file.type || 'FILE',
    size: file.fileSize || file.size || '',
    url: file.url || file.fileUrl || file.link || '',
  };
}

// Lấy tổng quan phần trăm hoàn thành của TẤT CẢ khóa học của người dùng hiện tại
router.get('/progress/me', lmsGuard('lms_progress_me'), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const progress = await TrainingProgress.find({ userId, status: 'completed' });

    const completedByCourse = {};
    progress.forEach((p) => {
      const cId = String(p.courseId);
      if (!completedByCourse[cId]) completedByCourse[cId] = new Set();
      completedByCourse[cId].add(String(p.lessonId));
    });

    const SystemSettings = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne() || {};
    const teacherCourses = (settings.trainingRawData && settings.trainingRawData.videos) || [];
    const studentCourses = (settings.studentTrainingRawData && settings.studentTrainingRawData.videos) || [];
    const courses = [...teacherCourses, ...studentCourses];

    const progressMap = {};
    courses.forEach((course) => {
      const cId = String(course.id || course._id);
      const courseLessons = collectCourseLessons(course);
      const total = courseLessons.length;
      const completed = completedByCourse[cId] ? completedByCourse[cId].size : 0;
      progressMap[cId] = total > 0 ? Math.round((completed / total) * 100) : 0;
    });

    res.json({ success: true, data: progressMap });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Tổng quan đào tạo GV: khóa học + tiến độ + quy trình + tài liệu (1 request)
router.get('/teacher/overview', lmsGuard('lms_teacher_overview'), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const SystemSettings = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne() || {};
    const raw = settings.trainingRawData || { videos: [], guides: [], files: [] };

    let allowedSubjectIds = null;
    if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const { resolveTeacherSubjectIds, filterTrainingItemsBySubject } = require('../utils/trainingSubjectAccess');
      const teacher = await Teacher.findById(userId).select('subjectIds specialty').lean();
      allowedSubjectIds = resolveTeacherSubjectIds(teacher || {});
      raw.videos = filterTrainingItemsBySubject(raw.videos, allowedSubjectIds);
      raw.guides = filterTrainingItemsBySubject(raw.guides, allowedSubjectIds);
      raw.files = filterTrainingItemsBySubject(raw.files, allowedSubjectIds);
    }

    const progress = await TrainingProgress.find({ userId, status: 'completed' });
    const completedByCourse = {};
    progress.forEach((p) => {
      const cId = String(p.courseId);
      if (!completedByCourse[cId]) completedByCourse[cId] = new Set();
      completedByCourse[cId].add(String(p.lessonId));
    });

    const courses = (raw.videos || []).map((course) => {
      const cId = String(course.id || course._id);
      const lessons = collectCourseLessons(course);
      const total = lessons.length;
      const completed = completedByCourse[cId] ? completedByCourse[cId].size : 0;
      const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const courseFiles = (course.files || course.materials || []).map(mapFileForTeacherUi);
      const notices = Array.isArray(course.notices)
        ? course.notices
        : (course.notice ? [course.notice] : (course.desc ? [String(course.desc).replace(/<[^>]*>/g, '').slice(0, 300)] : []));

      return {
        id: cId,
        _id: cId,
        title: course.title || 'Khóa đào tạo',
        progress: progressPct,
        videos: lessons.map(mapLessonForTeacherUi),
        files: courseFiles,
        notices,
      };
    });

    res.json({
      success: true,
      data: {
        courses,
        guides: raw.guides || [],
        files: (raw.files || []).map(mapFileForTeacherUi),
        progressMap: Object.fromEntries(courses.map((c) => [c.id, c.progress])),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ⏱ Lưu tiến độ xem tạm thời (auto-save mỗi 30s — chống F5 reset bộ đếm)
router.post('/save-watch-progress', lmsGuard('lms_save_watch'), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { lessonId, courseId, watchedSeconds, videoDuration } = req.body;

    if (!lessonId || !courseId || watchedSeconds == null) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu' });
    }

    const existing = await TrainingProgress.findOne({
      userId,
      lessonId,
      status: { $ne: 'completed' },
    }).lean();

    if (existing?.status === 'completed') {
      return res.json({ success: true });
    }

    let maxSeconds = 0;
    let course = null;
    let lesson = null;
    try {
      const SystemSettings = require('../models/SystemSettings');
      const settings = await SystemSettings.findOne() || {};
      course = findCourseInSettings(settings, courseId);
      lesson = course ? findLessonInCourse(course, lessonId) : null;
      maxSeconds = resolveEffectiveDuration(lesson?.duration, videoDuration);
    } catch { /* ignore */ }

    // ACCESS gate: do not accept watch progress for locked lessons
    if (course && lesson) {
      const completed = await TrainingProgress.find({
        userId,
        courseId: String(courseId),
        status: 'completed',
      }).select('lessonId').lean();
      const completedLessonIds = completed.map((p) => String(p.lessonId));
      const { resolveCanAccessLesson } = require('../utils/lessonLearningPolicy');
      const access = resolveCanAccessLesson({
        course,
        lessonId,
        lesson,
        completedLessonIds,
      });
      if (!access.canAccess) {
        return res.status(403).json({
          success: false,
          code: 'PREVIOUS_LESSON_REQUIRED',
          message: 'Hoàn thành bài trước để mở bài này.',
        });
      }
    }

    const nextWatched = clampWatchProgressIncrease({
      previous: existing?.watchedSeconds || 0,
      incoming: watchedSeconds,
      lastWatchedAt: existing?.lastWatchedAt,
      maxSeconds: maxSeconds > 0 ? maxSeconds : 0,
    });

    await TrainingProgress.findOneAndUpdate(
      { userId, lessonId, status: { $ne: 'completed' } },
      { watchedSeconds: nextWatched, courseId, lastWatchedAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({ success: true, data: { watchedSeconds: nextWatched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// [ADMIN] Theo dõi tiến độ đào tạo của tất cả giảng viên
router.get('/admin/progress/:courseId', lmsGuard('lms_admin_progress'), async (req, res) => {
  try {
    const { courseId } = req.params;

    const lessons = await TrainingLesson.find({ courseId, isActive: true }).sort({ orderIndex: 1 });
    const totalLessons = lessons.length;
    const lessonIds = lessons.map(l => l._id);

    // Tổng hợp tiến độ theo từng userId
    const allProgress = await TrainingProgress.find({
      courseId,
      lessonId: { $in: lessonIds },
      status: 'completed',
    }).lean();

    // Group theo userId
    const progressMap = {};
    allProgress.forEach(p => {
      const uid = String(p.userId);
      if (!progressMap[uid]) progressMap[uid] = { completedCount: 0, lastActivity: null };
      progressMap[uid].completedCount += 1;
      if (!progressMap[uid].lastActivity || p.completedAt > progressMap[uid].lastActivity) {
        progressMap[uid].lastActivity = p.completedAt;
      }
    });

    const Teacher = require('../models/Teacher');
    const teachers = await Teacher.find({}).select('name status').lean();

    const result = teachers.map(t => {
      const uid = String(t._id);
      const prog = progressMap[uid] || { completedCount: 0, lastActivity: null };
      const pct = totalLessons > 0 ? Math.round((prog.completedCount / totalLessons) * 100) : 0;
      return {
        teacherId: uid,
        teacherName: t.name,
        status: t.status,
        completedLessons: prog.completedCount,
        totalLessons,
        progressPct: pct,
        isCertified: pct === 100,
        lastActivity: prog.lastActivity,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── LMS Q&A (server SoT) ───────────────────────────────────────────────────
const LmsLessonQa = require('../models/LmsLessonQa');
const NotificationService = require('../services/NotificationService');
const Student = require('../models/Student');

function mapQaDoc(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    ...o,
    id: String(o._id),
    createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
    answeredAt: o.answeredAt ? new Date(o.answeredAt).getTime() : null,
  };
}

function buildAskerDeepLink(doc) {
  const role = doc.audience === 'teacher' ? 'teacher' : 'student';
  const section = role === 'teacher' ? 'training' : 'materials';
  const q = new URLSearchParams({
    courseId: String(doc.courseId || ''),
    lessonId: String(doc.lessonId || ''),
    tab: 'qa',
    qaId: String(doc._id || doc.id || ''),
  });
  return `/${role}#${section}?${q.toString()}`;
}

function buildStaffDeepLink(doc, role = 'admin') {
  const q = new URLSearchParams({ qaId: String(doc._id || doc.id || '') });
  if (role === 'teacher') return `/teacher/notifications?${q.toString()}`;
  return `/admin/notifications?${q.toString()}`;
}

// GET /qa?courseId=&lessonId=&status=&qaId=
router.get('/qa', lmsGuard('lms_qa_list'), async (req, res) => {
  try {
    const { courseId, lessonId, status, qaId, audience } = req.query;
    const filter = {};
    if (qaId) filter._id = qaId;
    if (courseId) filter.courseId = String(courseId);
    if (lessonId) filter.lessonId = String(lessonId);
    if (status === 'open' || status === 'answered') filter.status = status;
    if (audience === 'student' || audience === 'teacher') filter.audience = audience;

    const role = String(req.user.role || '').toLowerCase();
    const userId = String(req.user.id || req.user._id || '');
    // Students/teachers only see Q&A for courses they query; admins can list open inbox
    if ((role === 'admin' || role === 'staff') && !courseId && !qaId) {
      filter.status = filter.status || 'open';
    }

    const rows = await LmsLessonQa.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: rows.map(mapQaDoc) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /qa — ask a question
router.post('/qa', lmsGuard('lms_qa_create'), async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id || '');
    const role = String(req.user.role || 'student').toLowerCase();
    const {
      courseId,
      courseTitle,
      lessonId,
      lessonTitle,
      title,
      body,
      audience,
    } = req.body || {};

    if (!courseId || !lessonId || !String(title || '').trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu courseId, lessonId hoặc tiêu đề' });
    }

    const askerName = req.user.name || req.user.fullName || (role === 'teacher' ? 'Giảng viên' : 'Học viên');
    let assignedTeacherId = null;
    if (role === 'student') {
      try {
        const st = await Student.findById(userId).select('teacherId name').lean();
        if (st?.teacherId) assignedTeacherId = String(st.teacherId);
      } catch { /* ignore */ }
    }

    const doc = await LmsLessonQa.create({
      courseId: String(courseId),
      courseTitle: String(courseTitle || ''),
      lessonId: String(lessonId),
      lessonTitle: String(lessonTitle || ''),
      audience: audience === 'teacher' ? 'teacher' : 'student',
      askerId: userId,
      askerRole: ['teacher', 'admin', 'staff'].includes(role) ? role : 'student',
      askerName,
      assignedTeacherId,
      title: String(title).trim().slice(0, 300),
      body: String(body || '').trim().slice(0, 5000),
      status: 'open',
    });

    const io = req.app.get('io');
    const preview = doc.title.length > 80 ? `${doc.title.slice(0, 80)}…` : doc.title;
    const payload = {
      kind: 'lms_qa',
      action: 'lms_qa_open',
      qaId: String(doc._id),
      courseId: String(doc.courseId),
      lessonId: String(doc.lessonId),
      audience: doc.audience,
      status: 'open',
    };

    await NotificationService.send(io, {
      type: 'COURSE',
      title: 'Học viên có câu hỏi mới',
      content: `${askerName}: "${preview}"${doc.lessonTitle ? ` · Bài: ${doc.lessonTitle}` : ''}`,
      sender_id: userId,
      receivers: ['ALL_ADMIN'],
      payload,
      link: buildStaffDeepLink(doc, 'admin'),
    });

    if (assignedTeacherId) {
      await NotificationService.send(io, {
        type: 'COURSE',
        title: 'Học viên có câu hỏi mới',
        content: `${askerName}: "${preview}"${doc.lessonTitle ? ` · Bài: ${doc.lessonTitle}` : ''}`,
        sender_id: userId,
        receivers: [assignedTeacherId],
        payload,
        link: buildStaffDeepLink(doc, 'teacher'),
      });
    }

    res.json({ success: true, data: mapQaDoc(doc) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /qa/:id/answer — admin/teacher/staff answer
router.post('/qa/:id/answer', lmsGuard('lms_qa_answer'), async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id || '');
    const role = String(req.user.role || '').toLowerCase();
    const answer = String(req.body?.answer || '').trim();
    if (!answer) {
      return res.status(400).json({ success: false, message: 'Nhập nội dung trả lời' });
    }

    const canAnswer = role === 'admin' || role === 'staff' || role === 'teacher' || userId === 'admin';
    if (!canAnswer) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền trả lời' });
    }

    const doc = await LmsLessonQa.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi' });
    }

    doc.answer = answer.slice(0, 8000);
    doc.status = 'answered';
    doc.answeredBy = userId;
    doc.answeredByName = req.user.name || req.user.fullName || (role === 'teacher' ? 'Giảng viên' : 'Admin');
    doc.answeredByRole = role || 'admin';
    doc.answeredAt = new Date();
    await doc.save();

    const io = req.app.get('io');
    await NotificationService.send(io, {
      type: 'COURSE',
      title: 'Câu hỏi của bạn đã được trả lời',
      content: `${doc.answeredByName} đã trả lời: "${doc.title}"`,
      sender_id: userId,
      receivers: [String(doc.askerId)],
      payload: {
        kind: 'lms_qa',
        action: 'lms_qa_answered',
        qaId: String(doc._id),
        courseId: String(doc.courseId),
        lessonId: String(doc.lessonId),
        audience: doc.audience,
        status: 'answered',
      },
      link: buildAskerDeepLink(doc),
    });

    res.json({ success: true, data: mapQaDoc(doc) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
