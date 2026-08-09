const express = require('express');
const router = express.Router();
const trainingController = require('../controllers/TrainingController');
const { trainingCourseRepository } = require('../repositories');
const TrainingCourse = require('../models/TrainingCourse'); // Temp for new TrainingCourse
const { trainingLessonRepository } = require('../repositories');
const TrainingLesson = require('../models/TrainingLesson'); // Temp for new TrainingLesson
const { trainingProgressRepository } = require('../repositories');
const TrainingProgress = require('../models/TrainingProgress'); // Temp for new TrainingProgress
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');

// Lấy danh sách khóa đào tạo
router.get('/courses', authMiddleware,trainingController.get_courses);

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
router.get('/courses/:id/lessons', authMiddleware,trainingController.get_courses_id_lessons);

// Hoàn thành bài học
router.post('/complete-lesson', authMiddleware,trainingController.post_complete_lesson);

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
router.get('/progress/me', authMiddleware,trainingController.get_progress_me);

// Tổng quan đào tạo GV: khóa học + tiến độ + quy trình + tài liệu (1 request)
router.get('/teacher/overview', authMiddleware,trainingController.get_teacher_overview);

// ⏱ Lưu tiến độ xem tạm thời (auto-save mỗi 30s — chống F5 reset bộ đếm)
router.post('/save-watch-progress', authMiddleware,trainingController.post_save_watch_progress);

// [ADMIN] Theo dõi tiến độ đào tạo của tất cả giảng viên
router.get('/admin/progress/:courseId', authMiddleware,trainingController.get_admin_progress_courseId);

module.exports = router;
