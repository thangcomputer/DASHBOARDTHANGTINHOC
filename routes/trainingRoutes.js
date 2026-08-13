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
  requiredWatchSeconds,
  findLessonInCourse,
  clampWatchProgressIncrease,
} = require('../utils/antiSeekPolicy');

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

    // 3. Xử lý logic Mở khóa tuần tự
    let lastWasCompleted = true; // Bài đầu tiên luôn được mở nếu xét mặc định
    
    const lessonsWithStatus = lessons.map((lesson, index) => {
      const isCompleted = completedLessonIds.includes(String(lesson._id));
      
      // Logic: Bài đầu tiên (index 0) luôn mở. 
      // Các bài sau chỉ mở nếu bài trước đó đã completed.
      const isUnlocked = index === 0 || lastWasCompleted;
      
      // Cập nhật trạng thái cho bài tiếp theo
      lastWasCompleted = isCompleted;

      return {
        ...lesson,
        isCompleted,
        isUnlocked,
        watchedSeconds: watchedSecondsMap[String(lesson._id)] || 0,
      };
    });

    res.json({ success: true, data: lessonsWithStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Hoàn thành bài học — antiSeek: server SoT = TrainingProgress.watchedSeconds + lesson.antiSeek
router.post('/complete-lesson', lmsGuard('lms_complete_lesson'), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { lessonId, courseId, watchedSeconds } = req.body;

    if (!lessonId || !courseId) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu bài học' });
    }

    const existing = await TrainingProgress.findOne({ userId, lessonId }).lean();
    if (existing?.status === 'completed') {
      return res.json({ success: true, message: 'Bài học đã được hoàn thành trước đó.' });
    }

    const SystemSettings = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne() || {};
    const course = findCourseInSettings(settings, courseId);
    const lesson = course ? findLessonInCourse(course, lessonId) : null;
    const antiSeekOn = isLessonAntiSeekEnabled(lesson || { antiSeek: true });

    // Server progress SoT — do not trust client watchedSeconds alone
    const serverWatched = Math.max(0, Number(existing?.watchedSeconds) || 0);
    const clientClaim = Math.max(0, Number(watchedSeconds) || 0);
    // Allow small catch-up from last autosave (same request race); never jump to full duration from client
    const credited = Math.max(
      serverWatched,
      Math.min(clientClaim, serverWatched + 15)
    );

    if (antiSeekOn) {
      const durationSec = parseLessonDurationSeconds(lesson?.duration);
      const required = requiredWatchSeconds(durationSec);
      // duration missing → cannot compute 2/3; still require some server progress (residual)
      const minRequired = required > 0 ? required : 1;
      if (credited < minRequired) {
        return res.status(422).json({
          success: false,
          code: 'ANTI_SEEK_PROGRESS_REQUIRED',
          message: 'Bạn chưa xem đủ thời lượng yêu cầu của bài học.',
          data: {
            watchedSeconds: credited,
            requiredSeconds: minRequired,
            durationSeconds: durationSec,
          },
        });
      }
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

    res.json({ success: true, message: 'Chúc mừng! Bạn đã hoàn thành bài học này.' });
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
    const { lessonId, courseId, watchedSeconds } = req.body;

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
    try {
      const SystemSettings = require('../models/SystemSettings');
      const settings = await SystemSettings.findOne() || {};
      const course = findCourseInSettings(settings, courseId);
      const lesson = course ? findLessonInCourse(course, lessonId) : null;
      maxSeconds = parseLessonDurationSeconds(lesson?.duration);
    } catch { /* ignore */ }

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

module.exports = router;
