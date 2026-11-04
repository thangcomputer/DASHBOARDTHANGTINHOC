import type { Assignment, AssignmentSubmission, DemoUser } from '../types';
import { mobileApiRequest, resolveMobilePublicUrl } from './apiClient';
import { getTeacherAssignedStudents } from './studentApi';

type Raw = Record<string, unknown>;

function record(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {};
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function dateLabel(value: unknown) {
  if (!value) return 'Chưa xác định';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function dateInputValue(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateTimestamp(value: unknown) {
  const timestamp = new Date(String(value || '')).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function resolveFileUrl(value: unknown) {
  const path = text(value);
  if (!path) return undefined;
  return resolveMobilePublicUrl(path);
}

function mapSubmission(value: unknown): AssignmentSubmission {
  const raw = record(value);
  const student = record(raw.studentId);
  const id = text(raw._id || raw.id);
  if (!id) throw new Error('Bài nộp từ máy chủ thiếu mã định danh.');
  return {
    id,
    studentName: text(student.name, 'Học viên'),
    submittedAt: dateLabel(raw.submittedAt || raw.createdAt),
    status: raw.status === 'graded' ? 'graded' : 'submitted',
    submittedFileUrl: resolveFileUrl(raw.submittedFileUrl) || '',
    grade: raw.grade == null ? undefined : Number(raw.grade),
    teacherFeedback: text(raw.teacherFeedback),
  };
}

function mapTeacherAssignment(raw: Raw, teacherName: string, roster: Awaited<ReturnType<typeof getTeacherAssignedStudents>>): Assignment {
  const id = text(raw._id || raw.id);
  if (!id) throw new Error('Bài tập từ máy chủ thiếu mã định danh.');
  const submissions = Array.isArray(raw.submissions) ? raw.submissions.map(mapSubmission) : [];
  const pendingGrades = submissions.some((submission) => submission.status !== 'graded');
  const studentId = record(raw.studentId);
  const targetStudentId = text(studentId._id || studentId.id || raw.studentId);
  const targetStudent = roster.find((student) => student.id === targetStudentId);
  return {
    id,
    title: text(raw.title, 'Bài tập'),
    subject: text(raw.courseId, 'Khóa học'),
    teacher: text(raw.assignedByName, teacherName),
    deadline: dateLabel(raw.deadline),
    deadlineDate: dateInputValue(raw.deadline),
    status: pendingGrades ? 'Cần chấm' : submissions.length ? 'Đã chấm' : 'Chưa làm',
    description: text(raw.description),
    attachedFileUrl: resolveFileUrl(raw.fileUrl),
    sourceFileUrl: text(raw.fileUrl),
    assignedStudentNames: targetStudent
      ? [targetStudent.name]
      : targetStudentId
        ? []
        : ['Cả lớp'],
    submissions,
  };
}

export async function getTeacherAssignments(user: DemoUser): Promise<Assignment[]> {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể tải bài tập: tài khoản giảng viên không hợp lệ.');
  }
  const roster = await getTeacherAssignedStudents(user);
  const courses = [...new Set(roster.flatMap((student) => student.courses?.length ? student.courses : [student.course]).filter(Boolean))];
  if (!courses.length) return [];

  const responses = await Promise.all(courses.map((course) => (
    mobileApiRequest<{ data?: Raw[] }>(`/assignments/course/${encodeURIComponent(course)}`)
  )));
  const assignments = new Map<string, { assignment: Assignment; deadline: number }>();
  responses.forEach((response, index) => {
    if (!Array.isArray(response.data)) {
      throw new Error(`Phản hồi bài tập của khóa ${courses[index]} không hợp lệ.`);
    }
    response.data.forEach((row) => {
      const assignment = mapTeacherAssignment(row, user.name, roster);
      assignments.set(assignment.id, { assignment, deadline: dateTimestamp(row.deadline) });
    });
  });
  return [...assignments.values()]
    .sort((left, right) => left.deadline - right.deadline)
    .map(({ assignment }) => assignment);
}

export class PartialAssignmentCreationError extends Error {
  readonly createdCount: number;
  readonly totalCount: number;

  constructor(createdCount: number, totalCount: number, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : 'Lỗi không xác định.';
    super(`Đã tạo ${createdCount}/${totalCount} bài tập. Phần còn lại thất bại: ${reason}`);
    this.name = 'PartialAssignmentCreationError';
    this.createdCount = createdCount;
    this.totalCount = totalCount;
  }
}

export async function createTeacherAssignment(
  user: DemoUser,
  input: {
    title: string;
    courseId: string;
    description: string;
    fileUrl: string;
    deadline: string;
    studentIds: string[];
  },
) {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể giao bài: tài khoản giảng viên không hợp lệ.');
  }
  const title = input.title.trim();
  const courseId = input.courseId.trim();
  const deadlineValue = input.deadline.trim();
  const dateOnly = new Date(`${deadlineValue}T00:00:00Z`);
  const deadline = new Date(`${deadlineValue}T23:59:59`);
  const deadlineIsValid = /^\d{4}-\d{2}-\d{2}$/.test(deadlineValue)
    && Number.isFinite(dateOnly.getTime())
    && dateOnly.toISOString().slice(0, 10) === deadlineValue
    && Number.isFinite(deadline.getTime());
  if (!title || !courseId || !deadlineIsValid) {
    throw new Error('Tên bài, khóa học và hạn nộp hợp lệ là bắt buộc.');
  }
  const studentIds = [...new Set(input.studentIds.map((id) => id.trim()).filter(Boolean))];
  if (!studentIds.length) {
    throw new Error('Chưa có học viên để giao bài trong khóa học đã chọn.');
  }
  const targets = studentIds;
  let createdCount = 0;
  for (const studentId of targets) {
    try {
      const response = await mobileApiRequest<{ data?: Raw }>('/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          courseId,
          description: input.description.trim(),
          fileUrl: input.fileUrl.trim(),
          deadline: deadline.toISOString(),
          studentId,
        }),
      });
      if (!response.data) throw new Error('Máy chủ không xác nhận đã tạo bài tập.');
      createdCount += 1;
    } catch (error) {
      if (createdCount) throw new PartialAssignmentCreationError(createdCount, targets.length, error);
      throw error;
    }
  }
  return createdCount;
}

export async function updateTeacherAssignment(
  assignmentId: string,
  input: { title: string; description: string; fileUrl: string; deadline: string },
) {
  const title = input.title.trim();
  const deadlineValue = input.deadline.trim();
  const deadline = new Date(`${deadlineValue}T23:59:59`);
  if (!assignmentId.trim() || !title || !/^\d{4}-\d{2}-\d{2}$/.test(deadlineValue) || !Number.isFinite(deadline.getTime())) {
    throw new Error('Tên bài và hạn nộp hợp lệ là bắt buộc.');
  }
  const response = await mobileApiRequest<{ data?: Raw }>(`/assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description: input.description.trim(),
      fileUrl: input.fileUrl.trim(),
      deadline: deadline.toISOString(),
    }),
  });
  if (!response.data) throw new Error('Máy chủ không xác nhận đã cập nhật bài tập.');
  return response.data;
}

export async function deleteTeacherAssignment(assignmentId: string) {
  if (!assignmentId.trim()) throw new Error('Không thể xóa: thiếu mã bài tập.');
  await mobileApiRequest(`/assignments/${encodeURIComponent(assignmentId)}`, { method: 'DELETE' });
}

export async function gradeAssignmentSubmission(submissionId: string, grade: number, teacherFeedback: string) {
  if (!submissionId.trim()) throw new Error('Không thể chấm bài: thiếu mã bài nộp.');
  if (!Number.isFinite(grade) || grade < 0 || grade > 10) {
    throw new Error('Điểm không hợp lệ. Nhập điểm từ 0 đến 10.');
  }
  const response = await mobileApiRequest<{ data?: Raw }>(
    `/assignments/submissions/${encodeURIComponent(submissionId)}/grade`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade, teacherFeedback: teacherFeedback.trim() }),
    },
  );
  if (!response.data) throw new Error('Máy chủ không xác nhận đã lưu điểm.');
  return response.data;
}

export async function uploadStudentAssignmentFile(file: { uri: string; name: string; mimeType?: string }) {
  const formData = new FormData();
  const filePart = {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob;
  formData.append('file', filePart);
  const response = await mobileApiRequest<{ success?: boolean; fileUrl?: string; message?: string }>('/assignments/upload', {
    method: 'POST',
    body: formData,
  });
  if (!response.success || !response.fileUrl) {
    throw new Error(response.message || 'Máy chủ không trả về liên kết tệp bài nộp.');
  }
  return resolveMobilePublicUrl(response.fileUrl);
}
