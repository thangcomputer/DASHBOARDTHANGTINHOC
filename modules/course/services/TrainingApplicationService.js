'use strict';
const { trainingCourseRepository } = require('./../repositories');
const TrainingCourse = require('./../models/TrainingCourse'); // Temp for new TrainingCourse
const { trainingLessonRepository } = require('./../repositories');
const TrainingLesson = require('./../models/TrainingLesson'); // Temp for new TrainingLesson
const { trainingProgressRepository } = require('./../repositories');
const TrainingProgress = require('./../models/TrainingProgress'); // Temp for new TrainingProgress

// Lấy danh sách khóa đào tạo

class TrainingApplicationService {
  async get_courses(data) {
  try {
    const courses = await TrainingcourseRepository.findMany({ isActive: true });
    return { _status: 200, _body: { success: true, data: courses } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: error.message } };
  }
}

  async get_courses_id_lessons(data) {
  try {
    const userId = data.currentUser.id || data.currentUser._id;
    const courseId = data.id;

    const SystemSettings = require('../../system/models/SystemSettings');
    const settings = await SystemSettings.findOne() || {};
    const course = findCourseInSettings(settings, courseId);
    if (!course) return { _status: 404, _body: { success: false, message: 'Khóa học không tồn tại' } };

    if (data.currentUser.role === 'teacher') {
      const Teacher = require('../../teacher/models/Teacher');
      const { itemMatchesSubjectIds, resolveTeacherSubjectIds } = require('../../../utils/trainingSubjectAccess');
      const teacher = await Teacher.findById(userId).select('subjectIds specialty').lean();
      const allowed = resolveTeacherSubjectIds(teacher || {});
      if (!itemMatchesSubjectIds(course, allowed)) {
        return { _status: 403, _body: { success: false, message: 'Khóa học này không thuộc chuyên môn của bạn' } };
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
    const progress = await trainingProgressRepository.findMany({ userId, courseId });
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

    return { _status: 200, _body: { success: true, data: lessonsWithStatus } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: error.message } };
  }
}

  async post_complete_lesson(data) {
  try {
    const userId = data.currentUser.id || data.currentUser._id;
    const { lessonId, courseId, watchedSeconds } = data.body;

    if (!lessonId || !courseId) {
      return { _status: 400, _body: { success: false, message: 'Thiếu dữ liệu bài học' } };
    }

    // Upsert tiến độ (kèm watchedSeconds)
    await trainingProgressRepository.updateOne(
      { userId, lessonId },
      { 
        status: 'completed', 
        courseId,
        watchedSeconds: watchedSeconds || 0,
        completedAt: new Date(),
        lastWatchedAt: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );

    return { _status: 200, _body: { success: true, message: 'Chúc mừng! Bạn đã hoàn thành bài học này.' } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: error.message } };
  }
}

  async get_progress_me(data) {
  try {
    const userId = data.currentUser.id || data.currentUser._id;
    const progress = await trainingProgressRepository.findMany({ userId, status: 'completed' });

    const completedByCourse = {};
    progress.forEach((p) => {
      const cId = String(p.courseId);
      if (!completedByCourse[cId]) completedByCourse[cId] = new Set();
      completedByCourse[cId].add(String(p.lessonId));
    });

    const SystemSettings = require('../../system/models/SystemSettings');
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

    return { _status: 200, _body: { success: true, data: progressMap } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: error.message } };
  }
}

  async get_teacher_overview(data) {
  try {
    const userId = data.currentUser.id || data.currentUser._id;
    const SystemSettings = require('../../system/models/SystemSettings');
    const settings = await SystemSettings.findOne() || {};
    const raw = settings.trainingRawData || { videos: [], guides: [], files: [] };

    let allowedSubjectIds = null;
    if (data.currentUser.role === 'teacher') {
      const Teacher = require('../../teacher/models/Teacher');
      const { resolveTeacherSubjectIds, filterTrainingItemsBySubject } = require('../../../utils/trainingSubjectAccess');
      const teacher = await Teacher.findById(userId).select('subjectIds specialty').lean();
      allowedSubjectIds = resolveTeacherSubjectIds(teacher || {});
      raw.videos = filterTrainingItemsBySubject(raw.videos, allowedSubjectIds);
      raw.guides = filterTrainingItemsBySubject(raw.guides, allowedSubjectIds);
      raw.files = filterTrainingItemsBySubject(raw.files, allowedSubjectIds);
    }

    const progress = await trainingProgressRepository.findMany({ userId, status: 'completed' });
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

    return { _status: 200, _body: {
      success: true,
      data: {
        courses,
        guides: raw.guides || [],
        files: (raw.files || []).map(mapFileForTeacherUi),
        progressMap: Object.fromEntries(courses.map((c) => [c.id, c.progress])),
      },
    } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: error.message } };
  }
}

  async post_save_watch_progress(data) {
  try {
    const userId = data.currentUser.id || data.currentUser._id;
    const { lessonId, courseId, watchedSeconds } = data.body;

    if (!lessonId || !courseId || watchedSeconds == null) {
      return { _status: 400, _body: { success: false, message: 'Thiếu dữ liệu' } };
    }

    // Chỉ cập nhật watchedSeconds nếu chưa completed (tránh ghi đè bài đã hoàn thành)
    await trainingProgressRepository.updateOne(
      { userId, lessonId, status: { $ne: 'completed' } },
      { watchedSeconds, courseId, lastWatchedAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );

    return { _status: 200, _body: { success: true } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: error.message } };
  }
}

  async get_admin_progress_courseId(data) {
  try {
    const { courseId } = data.params;

    const lessons = await trainingLessonRepository.findMany({ courseId, isActive: true }).sort({ orderIndex: 1 });
    const totalLessons = lessons.length;
    const lessonIds = lessons.map(l => l._id);

    // Tổng hợp tiến độ theo từng userId
    const allProgress = await trainingProgressRepository.findMany({
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

    const Teacher = require('../../teacher/models/Teacher');
    const teachers = await Teacher.find({}).select('name phone status').lean();

    const result = teachers.map(t => {
      const uid = String(t._id);
      const prog = progressMap[uid] || { completedCount: 0, lastActivity: null };
      const pct = totalLessons > 0 ? Math.round((prog.completedCount / totalLessons) * 100) : 0;
      return {
        teacherId: uid,
        teacherName: t.name,
        teacherPhone: t.phone,
        status: t.status,
        completedLessons: prog.completedCount,
        totalLessons,
        progressPct: pct,
        isCertified: pct === 100,
        lastActivity: prog.lastActivity,
      };
    });

    return { _status: 200, _body: { success: true, data: result } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: error.message } };
  }
}

}

module.exports = new TrainingApplicationService();
