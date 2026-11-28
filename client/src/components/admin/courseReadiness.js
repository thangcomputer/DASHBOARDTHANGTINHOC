export const SAMPLE_LESSON_VIDEO_URL = 'https://www.youtube.com/watch?v=rwbho0CgEAE';

export function publishedWithoutOutline(course) {
  return course?.status === 'published'
    && (!Array.isArray(course.curriculum) || course.curriculum.length === 0);
}

export function teacherLessonCount(videos, courseId) {
  const id = String(courseId || '');
  let count = 0;
  (videos || []).forEach((item) => {
    const linked = String(item.courseId || item.id || item._id || '');
    if (linked !== id) return;
    const chapters = Array.isArray(item.chapters) ? item.chapters : [];
    chapters.forEach((chapter) => {
      (chapter.lessons || []).forEach((lesson) => {
        if (String(lesson.url || lesson.videoUrl || '').trim()) count += 1;
      });
    });
  });
  return count;
}

export function studentVideoCount(subjects, courseId) {
  const id = String(courseId || '');
  return (subjects || []).reduce((sum, subject) => {
    const linked = (subject.courses || []).some((course) => String(course.id) === id);
    if (!linked) return sum;
    return sum + (Number(subject.videoCount) || 0);
  }, 0);
}

export function firstSubjectForCourse(subjects, courseId) {
  const id = String(courseId || '');
  return (subjects || []).find((subject) => (
    (subject.courses || []).some((course) => String(course.id) === id)
  )) || null;
}
