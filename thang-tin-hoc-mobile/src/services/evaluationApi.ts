import type { DemoEvaluation, DemoUser } from '../types';
import { mobileApiRequest } from './apiClient';
import { getStudentDetail } from './studentApi';

type Raw = Record<string, unknown>;

function record(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {};
}

function text(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function idOf(value: unknown) {
  const raw = record(value);
  return text(raw._id || raw.id || value);
}

function normalizeCourse(value: unknown) {
  return text(value).toLocaleLowerCase('vi');
}

function mapCriteria(value: unknown) {
  const raw = record(value);
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function mapExistingRating(raw: Raw) {
  const criteria = record(raw.criteria);
  const stars = Number(criteria.stars);
  return {
    stars: Number.isFinite(stars) ? stars : 0,
    comment: text(raw.comment || raw.content),
    criteria: mapCriteria(criteria),
  };
}

export async function getStudentEvaluations(user: DemoUser): Promise<DemoEvaluation[]> {
  if (!user || (user.role && user.role !== 'student')) {
    return [];
  }
  const isFree = user.freePortal === true || String(user.course || '').trim().toLocaleLowerCase('vi') === 'tài khoản miễn phí';
  const hasRealCourseFromUser = Array.isArray(user.enrollments) && user.enrollments.some((enrollment) => {
    const status = text(enrollment?.status || 'active').toLowerCase();
    if (['cancelled', 'refunded', 'pending_payment', 'completed', 'hoàn thành', 'hoan thanh'].includes(status)) return false;
    const label = normalizeCourse(enrollment?.courseName);
    return Boolean(label) && label !== 'tài khoản miễn phí';
  });
  if (isFree && !hasRealCourseFromUser) return [];

  let student: Record<string, unknown> = {};
  try {
    student = await getStudentDetail(user);
  } catch (err) {
    if ((err as { status?: number })?.status === 403) return [];
  }

  const enrollments = Array.isArray(student.enrollments)
    ? student.enrollments.map(record)
    : [];
  const hasRealCourse = enrollments.some((enrollment) => {
    const status = text(enrollment.status || 'active').toLowerCase();
    if (['cancelled', 'refunded', 'pending_payment', 'completed', 'hoàn thành', 'hoan thanh'].includes(status)) return false;
    const label = normalizeCourse(enrollment.courseName);
    return Boolean(label) && label !== 'tài khoản miễn phí';
  });
  if ((student.freePortal === true || isFree) && !hasRealCourse) return [];

  let privateRows: Raw[] = [];
  try {
    const privateResponse = await mobileApiRequest<{ data?: Raw[] }>('/evaluations/mine');
    if (Array.isArray(privateResponse.data)) {
      privateRows = privateResponse.data;
    }
  } catch (err) {
    if ((err as { status?: number })?.status === 403) return [];
    throw err;
  }
  const courseRows = enrollments.length
    ? enrollments
    : text(student.course)
      ? [{
          courseName: student.course,
          teacherId: student.teacherId,
          completedSessions: student.completedSessions,
          totalSessions: student.totalSessions,
        }]
      : [];
  const teacherIds = [...new Set(courseRows.map((entry) => idOf(entry.teacherId)).filter(Boolean))];
  const teacherRows = await Promise.all(teacherIds.map(async (teacherId) => {
    const response = await mobileApiRequest<{ data?: Raw[] }>(
      `/evaluations/teacher/${encodeURIComponent(teacherId)}`,
    );
    if (!Array.isArray(response.data)) {
      throw new Error('Phản hồi đánh giá giảng viên không hợp lệ.');
    }
    return [teacherId, response.data] as const;
  }));
  const ratingsByTeacher = new Map(teacherRows);
  const evaluations: DemoEvaluation[] = [];
  const seenTeacherIds = new Set<string>();

  courseRows.forEach((enrollment, index) => {
    const courseName = text(enrollment.courseName || enrollment.course || enrollment.name);
    if (!courseName) return;
    const courseId = text(enrollment.courseId || enrollment.course || enrollment.courseName);
    const teacher = record(enrollment.teacherId);
    const teacherId = idOf(enrollment.teacherId) || idOf(student.teacherId);
    const teacherName = text(enrollment.teacherName || teacher.name || student.teacherName || student.teacher);
    const completedSessions = Math.max(0, Number(enrollment.completedSessions ?? student.completedSessions) || 0);
    const totalSessions = Math.max(1, Number(enrollment.totalSessions ?? student.totalSessions) || 12);
    const privateEvaluation = privateRows.find((row) => (
      row.milestone === 'manual_feedback' && normalizeCourse(row.courseName) === normalizeCourse(courseName)
    ));
    const finalEvaluation = privateRows.some((row) => (
      row.milestone === 'course_end_teacher'
      && (normalizeCourse(row.courseName) === normalizeCourse(courseName)
        || (teacherId && idOf(row.targetTeacherId) === teacherId))
    ));

    evaluations.push({
      id: text(privateEvaluation?.id || privateEvaluation?._id) || `private-${user.id}-${index}-${courseName}`,
      courseName,
      teacherName,
      teacherId,
      courseId,
      milestone: 'manual_feedback',
      completed: Boolean(privateEvaluation),
      public: false,
      criteria: [],
      completedSessions,
      totalSessions,
      existingRating: privateEvaluation ? mapExistingRating(privateEvaluation) : undefined,
    });

    if (!teacherId || seenTeacherIds.has(teacherId)) return;
    seenTeacherIds.add(teacherId);
    const teacherRating = ratingsByTeacher.get(teacherId)?.find((row) => idOf(row.studentId) === user.id);
    const publicRating = teacherRating ? mapExistingRating(teacherRating) : undefined;
    evaluations.push({
      id: `teacher-${teacherId}-${courseId || courseName}`,
      courseName,
      teacherName,
      teacherId,
      courseId,
      milestone: 'teacher_rating',
      completed: Boolean(teacherRating),
      public: true,
      criteria: [],
      completedSessions,
      totalSessions,
      existingRating: publicRating,
      locked: finalEvaluation,
    });
  });
  return evaluations;
}

async function submitEvaluation(user: DemoUser, body: Raw) {
  if (user.role !== 'student' || !user.id) {
    throw new Error('Không thể gửi đánh giá: tài khoản học viên không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: Raw }>('/evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, studentId: user.id, studentName: user.name }),
  });
  if (!response.data) throw new Error('Máy chủ không xác nhận đã lưu đánh giá.');
  return response.data;
}

export function submitPrivateEvaluation(
  user: DemoUser,
  evaluation: DemoEvaluation,
  criteria: Record<string, string>,
  comment: string,
) {
  return submitEvaluation(user, {
    targetTeacherId: evaluation.teacherId,
    courseId: evaluation.courseId,
    courseName: evaluation.courseName,
    teacherName: evaluation.teacherName,
    type: 'admin_feedback',
    milestone: 'manual_feedback',
    criteria,
    content: comment.trim(),
  });
}

export function submitTeacherRating(
  user: DemoUser,
  evaluation: DemoEvaluation,
  criteria: Record<string, string>,
  stars: number,
  comment: string,
) {
  if (!evaluation.teacherId) {
    throw new Error('Không thể gửi đánh giá: khóa học chưa có giảng viên được phân công.');
  }
  if (!Number.isFinite(stars) || stars < 0 || stars > 5) {
    throw new Error('Điểm đánh giá không hợp lệ.');
  }
  return submitEvaluation(user, {
    targetTeacherId: evaluation.teacherId,
    courseId: evaluation.courseId,
    courseName: evaluation.courseName,
    teacherName: evaluation.teacherName,
    type: 'teacher_rating',
    criteria: { ...criteria, stars },
    content: comment.trim(),
  });
}
