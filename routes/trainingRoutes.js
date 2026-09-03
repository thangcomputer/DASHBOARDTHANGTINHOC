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
const {
  studentOwnsVideoCourse,
  applyVideoPaywallToLesson,
  assertStudentMayWatchLesson,
  coursePriceOf,
} = require('../utils/videoCourseAccess');
const { checkoutVideoCourse } = require('../services/videoCoursePurchaseService');
const VideoCoursePurchase = require('../models/VideoCoursePurchase');

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

router.post('/video-courses/:id/checkout', lmsGuard('lms_complete_lesson'), async (req, res) => {
  try {
    if (String(req.user.role || '').toLowerCase() !== 'student') {
      return res.status(403).json({ success: false, message: 'Chỉ học viên được mua khóa video' });
    }
    const SystemSettings = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne() || {};
    const course = findCourseInSettings(settings, req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Khóa học không tồn tại' });
    const result = await checkoutVideoCourse({ user: req.user, course });
    if (result.error) return res.status(result.error).json({ success: false, message: result.message });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/video-purchases/session/:sessionId', lmsGuard('lms_progress_me'), async (req, res) => {
  try {
    const PaymentSession = require('../models/PaymentSession');
    const session = await PaymentSession.findOne({
      sessionId: req.params.sessionId,
      studentId: req.user.id || req.user._id,
      kind: 'video_course',
    }).lean();
    if (!session) return res.json({ success: true, paid: false, status: 'not_found' });
    return res.json({
      success: true,
      paid: session.status === 'paid',
      status: session.status,
      amount: session.amount,
      ref: session.ref,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/video-purchases', lmsGuard('lms_progress_me'), async (req, res) => {
  try {
    const uid = req.user.id || req.user._id;
    const rows = await VideoCoursePurchase.find({ studentId: uid })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
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

function collectCourseLessons(course) {
  let courseLessons = course.lessons || course.videos || [];
  if (courseLessons.length === 0 && course.chapters) {
    course.chapters.forEach((ch) => {
      if (ch.lessons) {
        courseLessons = courseLessons.concat(
          ch.lessons.map((l) => ({ ...l, chapterTitle: ch.title || l.chapterTitle }))
        );
      }
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
  return courseLessons.map((l, i) => ({
    ...l,
    _id: l.id || l._id || `ls-${i}`,
    id: l.id || l._id || `ls-${i}`,
  }));
}

function lessonVideoFields(lesson) {
  if (!lesson) return { videoUrl: '', videoDuration: 0, lessonTitle: '' };
  const videoUrl = String(
    lesson.videoUrl || lesson.url || lesson.youtubeUrl || lesson.link || ''
  ).trim();
  let videoDuration = Number(lesson.duration) || 0;
  if (!Number.isFinite(videoDuration) || videoDuration < 0) videoDuration = 0;
  if (typeof lesson.duration === 'string' && lesson.duration.includes(':')) {
    const parts = lesson.duration.split(':').map((x) => Number(x));
    if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
      videoDuration = parts[0] * 60 + parts[1];
    } else if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      videoDuration = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  return {
    videoUrl,
    videoDuration: Math.max(0, Math.floor(videoDuration)),
    lessonTitle: String(lesson.title || lesson.chapterTitle || ''),
  };
}

async function resolveLessonMetaFromSettings(courseId, lessonId) {
  try {
    const SystemSettings = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne().lean() || {};
    const course = findCourseInSettings(settings, courseId);
    if (!course) return null;
    const lessons = collectCourseLessons(course);
    const lid = String(lessonId || '');
    const lesson = lessons.find((l) => String(l._id || l.id) === lid) || null;
    if (!lesson) return null;
    return {
      courseTitle: String(course.title || ''),
      ...lessonVideoFields(lesson),
    };
  } catch {
    return null;
  }
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
    const role = String(req.user.role || '').toLowerCase();
    let owned = true;
    if (role === 'student' && coursePriceOf(course) > 0) {
      owned = await studentOwnsVideoCourse(userId, courseId);
    }

    const lessonsWithStatus = lessons.map((lesson, index) => {
      const watched = watchedSecondsMap[String(lesson._id)] || 0;
      const state = resolveLessonLearningState({
        lesson,
        index,
        course,
        completedLessonIds,
        watchedSeconds: watched,
      });

      const gated = applyVideoPaywallToLesson({
        role,
        owned,
        course,
        lesson,
        sequentialState: state,
      });

      const base = {
        ...lesson,
        isCompleted: gated.isCompleted,
        isUnlocked: gated.isUnlocked,
        canAccess: gated.canAccess,
        allowEarlyAccess: gated.allowEarlyAccess,
        watchedSeconds: watched,
        antiSeek: gated.antiSeekEnabled,
        adminDurationSeconds: gated.adminDurationSeconds,
        requiredWatchSeconds: gated.requiredSeconds,
        requiredSeconds: gated.requiredSeconds,
        completionEligible: gated.completionEligible,
        durationUnknown: gated.durationUnknown,
        effectiveDurationSeconds: gated.effectiveDurationSeconds,
        prerequisiteLessonId: gated.prerequisiteLessonId,
        prerequisiteCompleted: gated.prerequisiteCompleted,
        isPreview: !!gated.isPreview,
        paywallLocked: !!gated.paywallLocked,
      };
      // Không lộ nội dung video bài khóa qua API list
      if (!gated.canAccess) {
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

    res.json({
      success: true,
      data: lessonsWithStatus,
      meta: {
        price: coursePriceOf(course),
        owned,
        paywall: role === 'student' && coursePriceOf(course) > 0 && !owned,
      },
    });
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
      // Vẫn cho tăng watchedSeconds nếu client báo cao hơn (xem hết video → 100%)
      const serverWatched = Math.max(0, Number(existing.watchedSeconds) || 0);
      const clientClaim = Math.max(0, Number(watchedSeconds) || 0);
      const SystemSettings = require('../models/SystemSettings');
      const settings = await SystemSettings.findOne() || {};
      const course = findCourseInSettings(settings, courseId);
      const lesson = course ? findLessonInCourse(course, lessonId) : null;
      const effectiveDuration = resolveEffectiveDuration(lesson?.duration, videoDuration);
      const credited = clampWatchProgressIncrease({
        previous: serverWatched,
        incoming: clientClaim,
        lastWatchedAt: existing.lastWatchedAt,
        maxSeconds: effectiveDuration > 0 ? effectiveDuration : 0,
      });
      if (credited > serverWatched) {
        await TrainingProgress.updateOne(
          { userId, lessonId },
          { watchedSeconds: credited, lastWatchedAt: new Date() },
        );
      }
      return res.json({
        success: true,
        message: 'Bài học đã được hoàn thành trước đó.',
        alreadyCompleted: true,
        data: { watchedSeconds: Math.max(credited, serverWatched) },
      });
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

    const watchGate = await assertStudentMayWatchLesson({ user: req.user, course, lesson });
    if (!watchGate.ok) {
      return res.status(403).json({ success: false, code: watchGate.code, message: watchGate.message });
    }

    // ACCESS: prerequisite required unless allowEarlyAccess (does NOT bypass 2/3)
    const allowEarly = isLessonAllowEarlyAccess(lesson) || (watchGate.preview === true);
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
// Cho phép tăng watchedSeconds cả khi status=completed (để % lên 100% sau cửa ≥67%)
router.post('/save-watch-progress', lmsGuard('lms_save_watch'), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { lessonId, courseId, watchedSeconds, videoDuration } = req.body;

    if (!lessonId || !courseId || watchedSeconds == null) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu' });
    }

    const existing = await TrainingProgress.findOne({ userId, lessonId }).lean();

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
      const watchGate = await assertStudentMayWatchLesson({ user: req.user, course, lesson });
      if (!watchGate.ok) {
        return res.status(403).json({ success: false, code: watchGate.code, message: watchGate.message });
      }
      if (!watchGate.preview && existing?.status !== 'completed') {
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
    }

    const nextWatched = clampWatchProgressIncrease({
      previous: existing?.watchedSeconds || 0,
      incoming: watchedSeconds,
      lastWatchedAt: existing?.lastWatchedAt,
      maxSeconds: maxSeconds > 0 ? maxSeconds : 0,
    });

    if (existing?.status === 'completed') {
      // Chỉ cập nhật giây xem (không đụng status) — để UI hiện 100% khi xem hết
      if (nextWatched > (Number(existing.watchedSeconds) || 0)) {
        await TrainingProgress.updateOne(
          { userId, lessonId },
          { watchedSeconds: nextWatched, lastWatchedAt: new Date() },
        );
      }
      return res.json({ success: true, data: { watchedSeconds: Math.max(nextWatched, Number(existing.watchedSeconds) || 0) } });
    }

    await TrainingProgress.findOneAndUpdate(
      { userId, lessonId },
      {
        watchedSeconds: nextWatched,
        courseId,
        lastWatchedAt: new Date(),
        ...(existing ? {} : { status: 'unlocked' }),
      },
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
  const thread = Array.isArray(o.thread)
    ? o.thread.map((m) => ({
        id: String(m._id || m.id || ''),
        authorId: String(m.authorId || ''),
        authorName: m.authorName || '',
        authorRole: m.authorRole || '',
        body: m.body || '',
        createdAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
      }))
    : [];
  return {
    ...o,
    id: String(o._id),
    atSec: Math.max(0, Math.floor(Number(o.atSec) || 0)),
    videoUrl: String(o.videoUrl || ''),
    videoDuration: Math.max(0, Math.floor(Number(o.videoDuration) || 0)),
    thread,
    createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
    answeredAt: o.answeredAt ? new Date(o.answeredAt).getTime() : null,
  };
}

async function enrichQaRowsWithVideo(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const settingsCache = { value: null };
  const loadSettings = async () => {
    if (settingsCache.value) return settingsCache.value;
    try {
      const SystemSettings = require('../models/SystemSettings');
      settingsCache.value = await SystemSettings.findOne().lean() || {};
    } catch {
      settingsCache.value = {};
    }
    return settingsCache.value;
  };

  const out = [];
  for (const row of list) {
    const mapped = mapQaDoc(row);
    let videoUrl = mapped.videoUrl;
    let videoDuration = mapped.videoDuration;
    let lessonTitle = mapped.lessonTitle || '';

    if (!videoUrl && mapped.courseId && mapped.lessonId) {
      try {
        const settings = await loadSettings();
        const course = findCourseInSettings(settings, mapped.courseId);
        if (course) {
          const lessons = collectCourseLessons(course);
          const lesson = lessons.find(
            (l) => String(l._id || l.id) === String(mapped.lessonId)
          );
          const meta = lessonVideoFields(lesson);
          videoUrl = meta.videoUrl;
          videoDuration = videoDuration || meta.videoDuration;
          lessonTitle = lessonTitle || meta.lessonTitle;
          if (!mapped.courseTitle && course.title) {
            mapped.courseTitle = String(course.title);
          }
        }
      } catch { /* ignore */ }
    }

    // Fallback TrainingLesson (ObjectId-based courses)
    if (!videoUrl && /^[a-fA-F0-9]{24}$/.test(String(mapped.lessonId || ''))) {
      try {
        const lesson = await TrainingLesson.findById(mapped.lessonId)
          .select('videoUrl duration title')
          .lean();
        if (lesson) {
          videoUrl = lesson.videoUrl || '';
          videoDuration = videoDuration || Math.max(0, Math.floor(Number(lesson.duration) || 0));
          lessonTitle = lessonTitle || lesson.title || '';
        }
      } catch { /* ignore */ }
    }

    out.push({
      ...mapped,
      videoUrl: videoUrl || '',
      videoDuration: Math.max(0, Math.floor(Number(videoDuration) || 0)),
      lessonTitle: lessonTitle || mapped.lessonTitle || '',
    });
  }
  return out;
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

function emitLmsQaUpdated(io, doc, extra = {}) {
  if (!io || !doc) return;
  const payload = {
    kind: 'lms_qa',
    qaId: String(doc._id || doc.id || ''),
    courseId: String(doc.courseId || ''),
    lessonId: String(doc.lessonId || ''),
    audience: doc.audience || 'student',
    status: doc.status || 'open',
    atSec: Math.max(0, Math.floor(Number(doc.atSec) || 0)),
    ...extra,
  };
  const askerId = String(doc.askerId || '');
  try {
    if (askerId) {
      io.to(askerId).emit('lms_qa:updated', payload);
      io.to(`student_${askerId}`).emit('lms_qa:updated', payload);
      io.to(`teacher_${askerId}`).emit('lms_qa:updated', payload);
    }
    io.to('ALL_SUPPORT').emit('lms_qa:updated', payload);
    io.to('ALL_ADMIN').emit('lms_qa:updated', payload);
    io.to('ALL_STAFF').emit('lms_qa:updated', payload);
    io.to('ALL_TEACHER').emit('lms_qa:updated', payload);
  } catch { /* ignore */ }
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
    const data = await enrichQaRowsWithVideo(rows);
    res.json({ success: true, data });
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
      atSec,
      atSeconds,
      videoUrl: bodyVideoUrl,
      videoDuration: bodyVideoDuration,
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

    const atSecSafe = Math.max(0, Math.floor(Number(atSec ?? atSeconds) || 0));
    const meta = await resolveLessonMetaFromSettings(courseId, lessonId);
    const videoUrl = String(bodyVideoUrl || meta?.videoUrl || '').trim();
    const videoDuration = Math.max(
      0,
      Math.floor(Number(bodyVideoDuration) || Number(meta?.videoDuration) || 0)
    );

    const doc = await LmsLessonQa.create({
      courseId: String(courseId),
      courseTitle: String(courseTitle || meta?.courseTitle || ''),
      lessonId: String(lessonId),
      lessonTitle: String(lessonTitle || meta?.lessonTitle || ''),
      videoUrl,
      videoDuration,
      audience: audience === 'teacher' ? 'teacher' : 'student',
      askerId: userId,
      askerRole: ['teacher', 'admin', 'staff'].includes(role) ? role : 'student',
      askerName,
      assignedTeacherId,
      title: String(title).trim().slice(0, 300),
      body: String(body || '').trim().slice(0, 5000),
      atSec: atSecSafe,
      status: 'open',
      thread: [],
    });

    // Bypass schema cache: luôn ghi atSec/video xuống Mongo (tránh model cũ strip field)
    try {
      await LmsLessonQa.collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            atSec: atSecSafe,
            videoUrl,
            videoDuration,
            lessonTitle: String(doc.lessonTitle || ''),
          },
        }
      );
      doc.atSec = atSecSafe;
      doc.videoUrl = videoUrl;
      doc.videoDuration = videoDuration;
    } catch { /* ignore */ }

    const io = req.app.get('io');
    const preview = doc.title.length > 80 ? `${doc.title.slice(0, 80)}…` : doc.title;
    const atLabel = atSecSafe > 0 ? ` · ${Math.floor(atSecSafe / 60)}:${String(atSecSafe % 60).padStart(2, '0')}` : '';
    const payload = {
      kind: 'lms_qa',
      action: 'lms_qa_open',
      qaId: String(doc._id),
      courseId: String(doc.courseId),
      lessonId: String(doc.lessonId),
      atSec: atSecSafe,
      audience: doc.audience,
      status: 'open',
    };

    await NotificationService.send(io, {
      type: 'COURSE',
      title: role === 'teacher' ? 'Giảng viên có câu hỏi mới' : 'Học viên có câu hỏi mới',
      content: `${askerName}: "${preview}"${doc.lessonTitle ? ` · Bài: ${doc.lessonTitle}` : ''}${atLabel}`,
      sender_id: userId,
      receivers: ['ALL_SUPPORT'],
      payload,
      link: buildStaffDeepLink(doc, 'admin'),
    });
    emitLmsQaUpdated(io, doc, { action: 'lms_qa_open' });

    const [enriched] = await enrichQaRowsWithVideo([doc.toObject ? doc.toObject() : doc]);
    res.json({ success: true, data: enriched || mapQaDoc(doc) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function pushQaThread(doc, { authorId, authorName, authorRole, body }) {
  if (!Array.isArray(doc.thread)) doc.thread = [];
  doc.thread.push({
    authorId: String(authorId || ''),
    authorName: String(authorName || ''),
    authorRole: String(authorRole || ''),
    body: String(body || '').trim().slice(0, 8000),
    createdAt: new Date(),
  });
}

// POST /qa/:id/answer — admin/teacher/staff answer (first + follow-ups)
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

    const answererName = req.user.name || req.user.fullName || (role === 'teacher' ? 'Giảng viên' : 'Support');
    const isFirst = !doc.answer;
    if (isFirst) {
      doc.answer = answer.slice(0, 8000);
      doc.answeredBy = userId;
      doc.answeredByName = answererName;
      doc.answeredByRole = role || 'admin';
      doc.answeredAt = new Date();
    }
    doc.status = 'answered';
    pushQaThread(doc, {
      authorId: userId,
      authorName: answererName,
      authorRole: role || 'admin',
      body: answer,
    });
    // Backfill video if missing (old QAs)
    if (!doc.videoUrl) {
      const meta = await resolveLessonMetaFromSettings(doc.courseId, doc.lessonId);
      if (meta?.videoUrl) {
        doc.videoUrl = meta.videoUrl;
        doc.videoDuration = meta.videoDuration || doc.videoDuration || 0;
        if (!doc.lessonTitle && meta.lessonTitle) doc.lessonTitle = meta.lessonTitle;
      }
    }
    await doc.save();

    const io = req.app.get('io');
    await NotificationService.send(io, {
      type: 'COURSE',
      title: isFirst ? 'Câu hỏi của bạn đã được trả lời' : 'Có phản hồi mới cho câu hỏi của bạn',
      content: `${answererName} đã trả lời: "${doc.title}"`,
      sender_id: userId,
      receivers: [String(doc.askerId)],
      payload: {
        kind: 'lms_qa',
        action: isFirst ? 'lms_qa_answered' : 'lms_qa_thread',
        qaId: String(doc._id),
        courseId: String(doc.courseId),
        lessonId: String(doc.lessonId),
        audience: doc.audience,
        status: 'answered',
      },
      link: buildAskerDeepLink(doc),
    });
    emitLmsQaUpdated(io, doc, { action: isFirst ? 'lms_qa_answered' : 'lms_qa_thread' });

    const [enriched] = await enrichQaRowsWithVideo([doc.toObject()]);
    res.json({ success: true, data: enriched || mapQaDoc(doc) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /qa/:id/reply — học viên/GV hỏi thêm sau khi đã có trả lời (đối thoại)
router.post('/qa/:id/reply', lmsGuard('lms_qa_create'), async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id || '');
    const role = String(req.user.role || 'student').toLowerCase();
    const body = String(req.body?.body || req.body?.reply || '').trim();
    if (!body) {
      return res.status(400).json({ success: false, message: 'Nhập nội dung phản hồi' });
    }

    const doc = await LmsLessonQa.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi' });
    }

    const isAsker = String(doc.askerId) === userId;
    const isStaff = role === 'admin' || role === 'staff' || role === 'teacher' || userId === 'admin';
    if (!isAsker && !isStaff) {
      return res.status(403).json({ success: false, message: 'Bạn không thể phản hồi câu hỏi này' });
    }

    const authorName = req.user.name || req.user.fullName
      || (isAsker ? doc.askerName : (role === 'teacher' ? 'Giảng viên' : 'Support'));
    pushQaThread(doc, {
      authorId: userId,
      authorName,
      authorRole: isAsker ? (doc.askerRole || role) : role,
      body,
    });

    // Học viên hỏi lại → mở lại để Support thấy
    if (isAsker) {
      doc.status = 'open';
    } else {
      doc.status = 'answered';
      if (!doc.answer) {
        doc.answer = body.slice(0, 8000);
        doc.answeredBy = userId;
        doc.answeredByName = authorName;
        doc.answeredByRole = role;
        doc.answeredAt = new Date();
      }
    }
    await doc.save();

    const io = req.app.get('io');
    if (isAsker) {
      await NotificationService.send(io, {
        type: 'COURSE',
        title: 'Học viên phản hồi hỏi đáp LMS',
        content: `${authorName}: "${body.length > 80 ? `${body.slice(0, 80)}…` : body}" · ${doc.title}`,
        sender_id: userId,
        receivers: ['ALL_SUPPORT'],
        payload: {
          kind: 'lms_qa',
          action: 'lms_qa_thread',
          qaId: String(doc._id),
          courseId: String(doc.courseId),
          lessonId: String(doc.lessonId),
          audience: doc.audience,
          status: doc.status,
        },
        link: buildStaffDeepLink(doc, 'admin'),
      });
    } else {
      await NotificationService.send(io, {
        type: 'COURSE',
        title: 'Có phản hồi mới cho câu hỏi của bạn',
        content: `${authorName}: "${body.length > 80 ? `${body.slice(0, 80)}…` : body}"`,
        sender_id: userId,
        receivers: [String(doc.askerId)],
        payload: {
          kind: 'lms_qa',
          action: 'lms_qa_thread',
          qaId: String(doc._id),
          courseId: String(doc.courseId),
          lessonId: String(doc.lessonId),
          audience: doc.audience,
          status: doc.status,
        },
        link: buildAskerDeepLink(doc),
      });
    }
    emitLmsQaUpdated(io, doc, { action: 'lms_qa_thread' });

    const [enriched] = await enrichQaRowsWithVideo([doc.toObject()]);
    res.json({ success: true, data: enriched || mapQaDoc(doc) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── LMS Course Reviews ─────────────────────────────────────────────────────
const LmsCourseReview = require('../models/LmsCourseReview');

function mapReviewDoc(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    id: String(o._id),
    courseId: String(o.courseId || ''),
    courseTitle: o.courseTitle || '',
    audience: o.audience || 'student',
    rating: Number(o.rating) || 0,
    comment: o.comment || '',
    author: o.reviewerName || 'Học viên',
    reviewerId: String(o.reviewerId || ''),
    reviewerRole: o.reviewerRole || 'student',
    createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
  };
}

// GET /reviews?courseId=&audience=
router.get('/reviews', lmsGuard('lms_qa_list'), async (req, res) => {
  try {
    const courseId = String(req.query.courseId || '').trim();
    if (!courseId) {
      return res.status(400).json({ success: false, message: 'Thiếu courseId' });
    }
    const audience = req.query.audience === 'teacher' ? 'teacher' : 'student';
    const rows = await LmsCourseReview.find({ courseId, audience })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const data = rows.map((r) => mapReviewDoc(r));
    const avg = data.length
      ? data.reduce((s, r) => s + (Number(r.rating) || 0), 0) / data.length
      : 0;
    return res.json({ success: true, data, avg, count: data.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /reviews — HV/GV đánh giá khóa học → thông báo admin
router.post('/reviews', lmsGuard('lms_qa_create'), async (req, res) => {
  try {
    const userId = String(req.user.id || req.user._id || '');
    const role = String(req.user.role || 'student').toLowerCase();
    const {
      courseId,
      courseTitle,
      rating,
      comment,
      audience,
    } = req.body || {};

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'Thiếu courseId' });
    }
    const stars = Math.min(5, Math.max(1, Math.round(Number(rating) || 0)));
    if (!stars) {
      return res.status(400).json({ success: false, message: 'Chọn số sao từ 1–5' });
    }
    const text = String(comment || '').trim().slice(0, 2000);
    if (!text) {
      return res.status(400).json({ success: false, message: 'Nhập nội dung đánh giá' });
    }

    const aud = audience === 'teacher' || role === 'teacher' ? 'teacher' : 'student';
    const reviewerName =
      req.user.name || req.user.fullName || (aud === 'teacher' ? 'Giảng viên' : 'Học viên');

    const doc = await LmsCourseReview.findOneAndUpdate(
      { courseId: String(courseId), audience: aud, reviewerId: userId },
      {
        $set: {
          courseTitle: String(courseTitle || '').slice(0, 300),
          reviewerRole: ['teacher', 'admin', 'staff'].includes(role) ? role : 'student',
          reviewerName,
          rating: stars,
          comment: text,
        },
        $setOnInsert: {
          courseId: String(courseId),
          audience: aud,
          reviewerId: userId,
        },
      },
      { upsert: true, returnDocument: 'after', new: true }
    );

    const io = req.app.get('io');
    const preview = text.length > 100 ? `${text.slice(0, 100)}…` : text;
    const who = aud === 'teacher' ? 'Giảng viên' : 'Học viên';
    await NotificationService.send(io, {
      type: 'COURSE',
      title: `${who} đánh giá khóa học`,
      content: `${reviewerName} · ${stars}★ · ${doc.courseTitle || 'Khóa học'}: "${preview}"`,
      sender_id: userId,
      receivers: ['ALL_ADMIN'],
      payload: {
        kind: 'lms_review',
        reviewId: String(doc._id),
        courseId: String(doc.courseId),
        audience: aud,
        rating: stars,
      },
      link: `/admin/notifications?reviewId=${encodeURIComponent(String(doc._id))}`,
    });

    return res.json({ success: true, data: mapReviewDoc(doc) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Bạn đã đánh giá khóa này' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
