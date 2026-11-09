import type { Assignment } from '../types';
import type { RawStudent } from './studentApi';
import type { StudentEvaluationActivity, StudentQuiz } from './studentQuizApi';

export type StudentDashboardActivity = {
  id: string;
  note: string;
  date: string;
  grade: number | null;
  timestamp: number;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function string(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function timestamp(value: unknown) {
  const parsed = new Date(String(value || '')).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value: unknown) {
  const parsed = timestamp(value);
  return parsed
    ? new Date(parsed).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa xác định';
}

function isScheduleActivity(type: string, note: string) {
  const normalizedType = type.toLowerCase();
  const normalizedNote = note.toLocaleLowerCase('vi');
  return [
    'scheduled', 'pending_attendance', 'overdue_attendance', 'past_pending',
    'attendance', 'attendance_cancel', 'schedule_cancel', 'cancelled', 'schedule_change',
  ].includes(normalizedType)
    || /điểm danh|hủy ca|hủy lịch|đổi lịch|đổi ca|dời lịch|dời ca/.test(normalizedNote);
}

function matchingCourse(itemCourse: unknown, selectedCourse: string) {
  const course = string(itemCourse).toLocaleLowerCase('vi').replace(/\s+/g, ' ');
  const selected = selectedCourse.toLocaleLowerCase('vi').replace(/\s+/g, ' ');
  return !course || !selected || course === selected;
}

export function buildStudentDashboardActivity(
  student: RawStudent | null | undefined,
  assignments: Assignment[],
  quizzes: StudentQuiz[],
  evaluations: StudentEvaluationActivity[],
  selectedCourse: string,
): StudentDashboardActivity[] {
  const entries: StudentDashboardActivity[] = [];
  const enrollments = Array.isArray(student?.enrollments) ? student.enrollments.map(object) : [];
  const selectedEnrollment = enrollments.find((enrollment) => {
    const name = string(enrollment.courseName || enrollment.course || enrollment.name);
    return name && name.toLocaleLowerCase('vi').replace(/\s+/g, ' ')
      === selectedCourse.toLocaleLowerCase('vi').replace(/\s+/g, ' ');
  });
  const enrollmentGrades = Array.isArray(selectedEnrollment?.grades)
    ? selectedEnrollment.grades.map(object)
    : [];
  const rootGrades = Array.isArray(student?.grades) ? student.grades.map(object) : [];
  const grades = selectedEnrollment
    ? enrollmentGrades.length
      ? enrollmentGrades
      : selectedEnrollment.isPrimary === true
        ? rootGrades
        : []
    : rootGrades;
  const seen = new Set<string>();
  const add = (id: string, note: string, date: unknown, grade: number | null = null) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    entries.push({ id, note, date: dateLabel(date), grade, timestamp: timestamp(date) });
  };

  (Array.isArray(student?.activityLog) ? student.activityLog : []).forEach((value, index) => {
    const event = object(value);
    const note = string(event.note);
    const type = string(event.type);
    if (!note || isScheduleActivity(type, note) || !matchingCourse(event.course, selectedCourse)) return;
    add(`activity-${string(event._id) || index}`, note, event.at || event.date);
  });

  grades.forEach((grade, index) => {
    const note = string(grade.note);
    const type = string(grade.type);
    if (!note || isScheduleActivity(type, note) || !matchingCourse(grade.course || grade.courseName, selectedCourse)) return;
    const parsedGrade = Number(grade.grade);
    add(
      `grade-${string(grade._id) || index}`,
      note,
      grade.date || grade.at,
      Number.isFinite(parsedGrade) ? parsedGrade : null,
    );
  });

  assignments.filter((assignment) => matchingCourse(assignment.courseName, selectedCourse)).forEach((assignment) => {
    const submission = assignment.mySubmission;
    if (!submission) return;
    const alreadyInGrades = grades.some((grade) => {
      const gradeAssignmentId = string(grade.assignmentId);
      const note = string(grade.note).toLocaleLowerCase('vi');
      return (gradeAssignmentId && gradeAssignmentId === assignment.id)
        || (note.includes(assignment.title.toLocaleLowerCase('vi'))
          && /^(bài nộp:|cập nhật điểm:|sửa điểm:|chấm điểm:)/.test(note));
    });
    if (!alreadyInGrades && submission.submittedAt) {
      add(`homework-submission-${assignment.id}`, `Bài nộp: ${assignment.title}`, submission.submittedAt);
    }

    submission.gradeHistory.forEach((history, index) => {
      const note = history.oldGrade == null
        ? `Chấm điểm: ${assignment.title}`
        : `Cập nhật điểm: ${assignment.title} (${history.oldGrade} → ${history.newGrade ?? ''})`;
      add(`homework-grade-${assignment.id}-${index}`, note, history.at, history.newGrade ?? null);
    });
    if (!submission.gradeHistory.length && submission.status === 'graded' && submission.grade != null && !alreadyInGrades) {
      add(`homework-grade-${assignment.id}`, `Chấm điểm: ${assignment.title}`, submission.submittedAt, submission.grade);
    }
  });

  quizzes.forEach((quiz) => {
    const submission = quiz.mySubmission;
    const studentId = string(student?._id || student?.id);
    const isTargeted = quiz.targetStudentIds.length > 0;
    if (!submission || (isTargeted
      ? !quiz.targetStudentIds.includes(studentId)
      : !matchingCourse(quiz.courseName, selectedCourse))) return;
    add(
      `quiz-${quiz.id}`,
      submission.forfeit
        ? `Trắc nghiệm: ${quiz.title} - Rớt (thoát giữa giờ)`
        : `Trắc nghiệm: ${quiz.title} (${submission.correctCount ?? 0}/${submission.totalQuestions ?? 0} câu)`,
      submission.submittedAt,
      submission.score == null ? null : Math.round((submission.score / 10) * 10) / 10,
    );
  });

  evaluations.filter((evaluation) => matchingCourse(evaluation.courseName, selectedCourse)).forEach((evaluation) => {
    const values = Object.values(evaluation.criteria).map(Number).filter(Number.isFinite);
    const grade = values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10
      : null;
    const title = evaluation.type === 'teacher_rating'
      ? 'HV đánh giá GV'
      : evaluation.milestone
        ? `Cột mốc: ${evaluation.milestone}`
        : 'Đánh giá';
    add(
      `evaluation-${evaluation.id}`,
      `${title}${evaluation.content ? ` - ${evaluation.content}` : ''}${evaluation.courseName ? ` (${evaluation.courseName})` : ''}`,
      evaluation.updatedAt || evaluation.createdAt,
      grade,
    );
  });

  return entries.sort((left, right) => right.timestamp - left.timestamp);
}
