import type {
  Assignment,
  AssignmentSubmission,
  DemoEnrollment,
  DemoGradeRecord,
  DemoStudent,
  DemoVideoOrder,
  DemoUser,
} from '../types';
import { mobileApiRequest, resolveMobilePublicUrl } from './apiClient';

export type RawStudent = Record<string, unknown> & {
  _id?: string;
  id?: string;
  name?: string;
  phone?: string;
  course?: string;
  enrollments?: Record<string, unknown>[];
};

export type StudentAccountData = {
  student: RawStudent;
  enrollments: DemoEnrollment[];
  videoOrders: DemoVideoOrder[];
};

export type TeacherAssignedStudentDetail = {
  attendance: Array<{ id: string; date: string; course: string; status: string; time: string }>;
  examResults: Array<{
    id: string;
    subject: string;
    date: string;
    correct: number;
    total: number;
    essayScore: number | null;
    passed: boolean;
    note: string;
  }>;
};

export type StudentProfileUpdate = {
  email: string;
  zalo: string;
  address: string;
  gender: 'male' | 'female';
};

export type StudentPaymentStatus = {
  paid: boolean;
  paidAmount: number;
  paidAt: string | null;
};

const studentColors = ['#DDF1EB', '#F6E9D9', '#E9E5FA', '#E4EBFA', '#F1E6E4'];

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateLabel(value: unknown) {
  if (!value) return 'Chưa xác định';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function mapAssignedStudent(raw: RawStudent, index: number): DemoStudent {
  const enrollments = Array.isArray(raw.enrollments)
    ? raw.enrollments
    : Array.isArray(raw.courses)
      ? raw.courses as Record<string, unknown>[]
      : [];
  const mappedEnrollments = enrollments.map(mapEnrollment);
  const activeEnrollment = enrollments.find((enrollment) => {
    const status = text(enrollment.status).toLowerCase();
    return !['completed', 'hoàn thành', 'cancelled', 'canceled', 'refunded', 'thôi học', 'đã hủy'].includes(status);
  });
  const rootStatus = text(raw.enrollmentStatus || raw.status).toLowerCase();
  let enrollmentStatus: DemoStudent['enrollmentStatus'];
  if (activeEnrollment) {
    enrollmentStatus = 'active';
  } else if (enrollments.length > 0) {
    const allEnrollmentsCancelled = enrollments.every((enrollment) => (
    ['cancelled', 'canceled', 'refunded', 'thôi học', 'đã hủy'].includes(text(enrollment.status).toLowerCase())
    ));
    enrollmentStatus = allEnrollmentsCancelled ? 'cancelled' : 'completed';
  } else if (['cancelled', 'canceled', 'refunded', 'thôi học', 'đã hủy'].includes(rootStatus)) {
    enrollmentStatus = 'cancelled';
  } else if (['completed', 'hoàn thành'].includes(rootStatus)) {
    enrollmentStatus = 'completed';
  } else {
    enrollmentStatus = 'active';
  }
  const enrollment = activeEnrollment || enrollments[0] || {};
  const totalSessions = number(raw.totalSessions ?? enrollment.totalSessions);
  const completedSessions = number(
    raw.completedSessions
      ?? enrollment.completedSessions
      ?? (totalSessions > 0 && enrollment.remainingSessions != null
        ? totalSessions - number(enrollment.remainingSessions)
        : undefined),
  );
  const explicitProgress = raw.progress == null ? null : Number(raw.progress);
  const progress = explicitProgress != null && Number.isFinite(explicitProgress)
    ? Math.max(0, Math.min(100, explicitProgress))
    : totalSessions > 0
      ? Math.max(0, Math.min(100, Math.round((completedSessions / totalSessions) * 100)))
      : 0;
  const id = text(raw._id || raw.id);
  const name = text(raw.name);
  if (!id || !name) throw new Error('Danh sách học viên từ máy chủ thiếu mã hoặc tên.');
  const remainingSessions = raw.remainingSessions == null && enrollment.remainingSessions == null
    ? Math.max(0, totalSessions - completedSessions)
    : number(raw.remainingSessions ?? enrollment.remainingSessions);
  const needsAttention = raw.needsAttention === true || raw.attendanceWarning === true;
  const courses = [...new Set([
    ...enrollments.map((entry) => text(entry.courseName || entry.course || entry.name)),
    text(raw.course),
  ].filter(Boolean))];
  const status: DemoStudent['status'] = needsAttention
    ? 'Cần hỗ trợ'
    : enrollmentStatus === 'completed'
      ? 'Hoàn thành'
      : enrollmentStatus === 'cancelled'
        ? 'Thôi học'
        : 'Đang học';

  return {
    id,
    name,
    course: text(enrollment.courseName || enrollment.course || enrollment.name || raw.course, 'Chưa phân khóa'),
    courses,
    progress,
    lastClass: raw.last_attendance_at ? `Học ngày ${toDateLabel(raw.last_attendance_at)}` : 'Chưa có buổi học',
    status,
    color: studentColors[index % studentColors.length],
    avatar: text(raw.avatarUrl || raw.avatar || raw.photo),
    phone: text(raw.phone),
    zalo: text(raw.zalo),
    lastSeenAt: text(raw.lastSeenAt || raw.lastSeen || raw.last_access),
    enrollments: mappedEnrollments,
    enrollmentStatus,
    notes: text(raw.teacherNote || activeEnrollment?.notes || enrollment.notes || raw.note),
    linkHoc: text(activeEnrollment?.linkHoc || raw.linkHoc || raw.online_meeting_url),
    avgGrade: raw.avgGrade == null && enrollment.avgGrade == null
      ? undefined
      : number(raw.avgGrade ?? enrollment.avgGrade),
    studentExamUnlocked: raw.studentExamUnlocked === true,
    totalSessions: totalSessions || undefined,
    completedSessions: raw.completedSessions == null && enrollment.completedSessions == null
      ? (totalSessions ? completedSessions : undefined)
      : completedSessions,
    remainingSessions: totalSessions ? remainingSessions : undefined,
  };
}

export async function getTeacherAssignedStudents(user: DemoUser): Promise<DemoStudent[]> {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể tải học viên: tài khoản giảng viên không hợp lệ.');
  }

  const pageSize = 250;
  const firstPage = await mobileApiRequest<{
    data?: RawStudent[];
    currentPage?: number;
    totalPages?: number;
  }>(`/students?page=1&limit=${pageSize}`);
  if (!Array.isArray(firstPage.data)) {
    throw new Error('Phản hồi danh sách học viên không hợp lệ.');
  }

  const pages = [firstPage.data];
  const totalPages = Number(firstPage.totalPages ?? 1);
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new Error('Máy chủ trả về số trang học viên không hợp lệ.');
  }
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await mobileApiRequest<{ data?: RawStudent[] }>(
      `/students?page=${page}&limit=${pageSize}`,
    );
    if (!Array.isArray(response.data)) {
      throw new Error(`Phản hồi danh sách học viên ở trang ${page} không hợp lệ.`);
    }
    pages.push(response.data);
  }

  const unique = new Map<string, DemoStudent>();
  pages.flat().forEach((raw, index) => {
    const student = mapAssignedStudent(raw, index);
    unique.set(student.id, student);
  });
  return [...unique.values()];
}

export async function getTeacherAssignedStudentDetail(
  user: DemoUser,
  studentId: string,
): Promise<TeacherAssignedStudentDetail> {
  if (user.role !== 'teacher' || !user.id || !studentId.trim()) {
    throw new Error('Không thể tải hồ sơ chi tiết: tài khoản hoặc mã học viên không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: Record<string, unknown> }>(
    `/students/${encodeURIComponent(studentId)}/full-detail`,
  );
  const detail = response.data;
  if (!detail || !Array.isArray(detail.schedules) || !Array.isArray(detail.examResults)) {
    throw new Error('Máy chủ trả về hồ sơ học viên không hợp lệ.');
  }
  const attendance = detail.schedules.map((entry, index) => {
    const schedule = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : {};
    return {
      id: text(schedule._id || schedule.id, `attendance-${index}`),
      date: text(schedule.date, 'Chưa xác định'),
      course: text(schedule.course || schedule.courseName, 'Chưa phân khóa'),
      status: text(schedule.attendanceStatus || schedule.status, 'Chưa xác định'),
      time: text(schedule.time || schedule.startTime),
    };
  });
  const examResults = detail.examResults.map((entry, index) => {
    const result = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : {};
    const essayScore = result.essayScore == null ? null : number(result.essayScore);
    return {
      id: text(result._id || result.id, `exam-${index}`),
      subject: text(result.subject, 'Bài kiểm tra'),
      date: text(result.date || result.createdAt, 'Chưa xác định'),
      correct: number(result.multipleChoiceCorrect),
      total: number(result.multipleChoiceTotal),
      essayScore,
      passed: result.passed === true,
      note: text(result.essayNote),
    };
  });
  return { attendance, examResults };
}

export async function updateTeacherAssignedStudent(
  user: DemoUser,
  studentId: string,
  courseName: string,
  updates: { notes?: string; linkHoc?: string; avgGrade?: number },
) {
  if (user.role !== 'teacher' || !user.id || !studentId.trim()) {
    throw new Error('Không thể cập nhật học viên: tài khoản hoặc mã học viên không hợp lệ.');
  }
  if (updates.avgGrade != null && (!Number.isFinite(updates.avgGrade) || updates.avgGrade < 0 || updates.avgGrade > 10)) {
    throw new Error('Điểm trung bình phải nằm trong khoảng 0 đến 10.');
  }
  const response = await mobileApiRequest<{ data?: RawStudent }>(
    `/students/${encodeURIComponent(studentId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseName, ...updates }),
    },
  );
  const rawStudent = response.data;
  if (!rawStudent || text(rawStudent._id || rawStudent.id) !== studentId) {
    throw new Error('Máy chủ chưa xác nhận thông tin học viên đã được cập nhật.');
  }
  return mapAssignedStudent(rawStudent, 0);
}

export async function failTeacherAssignedStudentExam(
  user: DemoUser,
  studentId: string,
  reason: string,
) {
  if (user.role !== 'teacher' || !user.id || !studentId.trim()) {
    throw new Error('Không thể đánh trượt học viên: tài khoản hoặc mã học viên không hợp lệ.');
  }
  const response = await mobileApiRequest<{ success?: boolean; message?: string }>(
    `/students/${encodeURIComponent(studentId)}/lock-exam`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
  if (response.success !== true) {
    throw new Error(response.message || 'Máy chủ chưa xác nhận thao tác đánh trượt.');
  }
}

function mapEnrollment(raw: Record<string, unknown>, index: number): DemoEnrollment {
  const courseName = text(raw.courseName || raw.course, `Khóa học ${index + 1}`);
  const totalSessions = number(raw.totalSessions);
  const course = raw.courseId && typeof raw.courseId === 'object'
    ? raw.courseId as Record<string, unknown>
    : {};
  const completedSessions = raw.completedSessions != null
    ? number(raw.completedSessions)
    : totalSessions > 0 && raw.remainingSessions != null
      ? Math.max(0, totalSessions - number(raw.remainingSessions))
      : 0;
  const status = text(raw.status).toLowerCase();
  const mappedStatus: DemoEnrollment['status'] = ['completed', 'hoàn thành'].includes(status)
    ? 'Hoàn thành'
    : ['cancelled', 'refunded', 'thôi học', 'đã hủy'].includes(status)
      ? 'Thôi học'
      : 'Đang học';
  const teacher = raw.teacherId && typeof raw.teacherId === 'object'
    ? text((raw.teacherId as Record<string, unknown>).name)
    : '';
  return {
    id: text(raw._id || raw.id, `${courseName}-${index}`),
    courseId: text(course._id || course.id || raw.courseId),
    courseName,
    subjectIds: Array.isArray(raw.subjectIds) ? raw.subjectIds.map(String) : [],
    teacherName: text(raw.teacherName, teacher || 'Chưa phân công'),
    registeredAt: toDateLabel(raw.registeredAt),
    progress: totalSessions > 0 ? Math.min(100, Math.round(completedSessions / totalSessions * 100)) : 0,
    completedSessions,
    totalSessions,
    avgGrade: number(raw.avgGrade),
    status: mappedStatus,
    notes: text(raw.notes),
    tuitionAmount: number(raw.price),
    paidAmount: raw.paid === true ? number(raw.price) : 0,
  };
}

function mapVideoOrder(raw: Record<string, unknown>, index: number): DemoVideoOrder {
  const paid = raw.status === 'paid' || raw.paid === true;
  return {
    id: text(raw._id || raw.id, `video-order-${index}`),
    courseName: text(raw.courseTitle || raw.courseName || raw.title, 'Khóa học video'),
    amount: number(raw.amount),
    status: paid ? 'Đã thanh toán' : 'Chờ thanh toán',
    date: toDateLabel(raw.paidAt || raw.createdAt),
  };
}

export async function getStudentDetail(user: DemoUser) {
  if (user.role !== 'student' || !user.id) {
    throw new Error('Không thể tải hồ sơ: tài khoản học viên không hợp lệ.');
  }
  const detailPayload = await mobileApiRequest<{ data?: { student?: RawStudent } }>(
    `/students/${encodeURIComponent(user.id)}/full-detail`,
  );
  const student = detailPayload.data?.student;
  if (!student || String(student._id || student.id || '') !== user.id) {
    throw new Error('Máy chủ trả về hồ sơ học viên không hợp lệ.');
  }
  return student;
}

export type CertExamScore = {
  id: string;
  label: string;
  status: 'dat' | 'khong_dat' | 'dang_thi' | 'chua_thi';
  quizScore: number | null;
  quizTotal: number | null;
  practiceSubmitted: boolean;
  essayScore: number | null;
  attemptCount: number;
};

export async function getStudentCertExamScores(user: DemoUser): Promise<CertExamScore[]> {
  if (user.role !== 'student' || !user.id) {
    throw new Error('Không thể tải điểm thi chứng nhận: tài khoản học viên không hợp lệ.');
  }
  const [detail, catalog] = await Promise.all([
    mobileApiRequest<{ data?: { student?: RawStudent } }>(`/students/${encodeURIComponent(user.id)}/full-detail`),
    mobileApiRequest<{ data?: { merged?: Record<string, { label?: string }> } }>('/settings/exam-subjects')
      .catch(() => ({ data: { merged: {} } })),
  ]);
  const progress = detail.data?.student?.examProgress;
  if (!Array.isArray(progress)) return [];
  const labels: Record<string, { label?: string }> = catalog.data?.merged || {};
  return progress.flatMap((entry): CertExamScore[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const id = text(row.id);
    if (!id) return [];
    const quiz = row.tracNghiem && typeof row.tracNghiem === 'object' ? row.tracNghiem as Record<string, unknown> : null;
    const quizTotal = finiteNumber(quiz?.total);
    const rawStatus = text(row.status, 'chua_thi');
    const status = (['dat', 'khong_dat', 'dang_thi'].includes(rawStatus) ? rawStatus : 'chua_thi') as CertExamScore['status'];
    return [{
      id,
      label: text(labels[id]?.label, id),
      status,
      quizScore: quiz && quizTotal ? finiteNumber(quiz.score) : null,
      quizTotal: quizTotal || null,
      practiceSubmitted: row.thucHanh === 'da_nop',
      essayScore: finiteNumber(row.essayScore),
      attemptCount: finiteNumber(row.attemptCount) || 0,
    }];
  });
}

export async function getStudentExamResults(user: DemoUser): Promise<DemoGradeRecord[]> {
  if (user.role !== 'student' || !user.id) {
    throw new Error('Không thể tải kết quả kiểm tra: tài khoản học viên không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: { student?: RawStudent; examResults?: unknown[] } }>(
    `/students/${encodeURIComponent(user.id)}/full-detail`,
  );
  const detail = response.data;
  const studentId = String(detail?.student?._id || detail?.student?.id || '');
  if (!detail || studentId !== user.id || !Array.isArray(detail.examResults)) {
    throw new Error('Máy chủ trả về kết quả kiểm tra học viên không hợp lệ.');
  }
  return detail.examResults.flatMap((entry, index): DemoGradeRecord[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const result = entry as Record<string, unknown>;
    const correct = finiteNumber(result.multipleChoiceCorrect);
    const total = finiteNumber(result.multipleChoiceTotal);
    const hasMultipleChoice = correct !== null && total !== null && total > 0;
    const essayScore = finiteNumber(result.essayScore);
    const hasEssayScore = essayScore !== null;
    const scoreParts = [
      ...(hasMultipleChoice ? [`${correct}/${total} câu`] : []),
      ...(hasEssayScore ? [`Tự luận ${essayScore}`] : []),
    ];
    const feedbackParts = [
      ...(hasMultipleChoice ? [`${correct}/${total} câu trắc nghiệm`] : []),
      text(result.essayNote),
    ].filter(Boolean);
    return [{
      id: text(result._id || result.id, `exam-${index}`),
      courseName: text(result.subject, 'Kết quả kiểm tra'),
      assessment: 'Kết quả kiểm tra',
      score: scoreParts.join(' · ') || '-',
      status: result.passed === true ? 'Đạt' : 'Chưa đạt',
      date: text(result.date || result.createdAt) || undefined,
      feedback: feedbackParts.join(' · ') || undefined,
    }];
  });
}

export async function getStudentPaymentStatus(user: DemoUser): Promise<StudentPaymentStatus> {
  if (user.role !== 'student' || !user.id) {
    throw new Error('Không thể tải trạng thái học phí: tài khoản học viên không hợp lệ.');
  }
  const response = await mobileApiRequest<{
    success?: unknown;
    paid?: unknown;
    paidAmount?: unknown;
    paidAt?: unknown;
  }>(`/webhooks/payment-status/${encodeURIComponent(user.id)}`);
  const paidAmount = finiteNumber(response.paidAmount);
  if (
    response.success !== true
    || typeof response.paid !== 'boolean'
    || (typeof response.paidAmount !== 'number' && typeof response.paidAmount !== 'string')
    || paidAmount === null
    || paidAmount < 0
    || (response.paidAt !== null && typeof response.paidAt !== 'string')
  ) {
    throw new Error('Máy chủ trả về trạng thái học phí không hợp lệ.');
  }
  return {
    paid: response.paid,
    paidAmount,
    paidAt: response.paidAt,
  };
}

export type StudentChatCard = {
  id: string;
  name: string;
  course: string;
  enrollments: DemoEnrollment[];
  age: number | null;
  remainingSessions: number | null;
  notes: string;
  meetingUrl: string;
};

export async function getStudentChatCard(studentId: string): Promise<StudentChatCard> {
  if (!studentId.trim()) throw new Error('Không thể tải thông tin: thiếu mã học viên.');
  const response = await mobileApiRequest<{ data?: Record<string, unknown> }>(
    `/students/${encodeURIComponent(studentId)}`,
  );
  const student = response.data;
  if (!student || String(student._id || student.id || '') !== studentId) {
    throw new Error('Máy chủ trả về thông tin học viên không hợp lệ.');
  }
  const remaining = Number(student.remainingSessions);
  const age = Number(student.age);
  const enrollments = Array.isArray(student.enrollments)
    ? student.enrollments
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map(mapEnrollment)
    : [];
  return {
    id: studentId,
    name: text(student.name, 'Học viên'),
    course: text(student.course || student.courseName, 'Chưa cập nhật'),
    enrollments,
    age: Number.isFinite(age) && age > 0 ? age : null,
    remainingSessions: Number.isFinite(remaining) ? remaining : null,
    notes: text(student.notes || student.adminNotes),
    meetingUrl: text(student.joinClassUrl || student.linkHoc || student.online_meeting_url),
  };
}

export async function getStudentAccountData(user: DemoUser): Promise<StudentAccountData> {
  const [student, ordersPayload] = await Promise.all([
    getStudentDetail(user),
    mobileApiRequest<{ data?: Record<string, unknown>[] }>('/training-lms/video-purchases'),
  ]);
  if (!Array.isArray(ordersPayload.data)) {
    throw new Error('Phản hồi danh sách khóa học video không hợp lệ.');
  }
  const enrollments = Array.isArray(student.enrollments)
    ? student.enrollments.map(mapEnrollment)
    : [];
  return {
    student,
    enrollments,
    videoOrders: ordersPayload.data.map(mapVideoOrder),
  };
}

export async function updateStudentProfile(
  user: DemoUser,
  updates: StudentProfileUpdate,
) {
  if (user.role !== 'student' || !user.id) {
    throw new Error('Không thể cập nhật hồ sơ: tài khoản học viên không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: RawStudent }>(
    `/students/${encodeURIComponent(user.id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
  );
  if (!response.data) throw new Error('Máy chủ không trả về hồ sơ học viên đã cập nhật.');
  return response.data;
}

function mapSubmission(raw: Record<string, unknown> | null | undefined): AssignmentSubmission | undefined {
  if (!raw) return undefined;
  const student = raw.studentId && typeof raw.studentId === 'object'
    ? text((raw.studentId as Record<string, unknown>).name, 'Bạn')
    : 'Bạn';
  const status = raw.status === 'graded' ? 'graded' : 'submitted';
  return {
    id: text(raw._id || raw.id),
    studentName: student,
    submittedAt: toDateLabel(raw.submittedAt),
    status,
    submittedFileUrl: text(raw.submittedFileUrl) ? resolveMobilePublicUrl(text(raw.submittedFileUrl)) : '',
    grade: raw.grade == null ? undefined : number(raw.grade),
    teacherFeedback: text(raw.teacherFeedback),
  };
}

function mapAssignment(raw: Record<string, unknown>): Assignment {
  const rawSubmission = raw.mySubmission && typeof raw.mySubmission === 'object'
    ? raw.mySubmission as Record<string, unknown>
    : undefined;
  const submission = mapSubmission(rawSubmission);
  const gradeHistory = Array.isArray(rawSubmission?.gradeHistory)
    ? rawSubmission.gradeHistory.map((entry) => {
        const history = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        return {
          at: text(history.at || history.createdAt),
          oldGrade: history.oldGrade == null ? undefined : number(history.oldGrade),
          newGrade: history.newGrade == null ? undefined : number(history.newGrade),
          note: text(history.note),
        };
      })
    : [];
  const deadlineDate = raw.deadline ? new Date(String(raw.deadline)) : null;
  const isOverdue = !!deadlineDate && !Number.isNaN(deadlineDate.getTime()) && deadlineDate.getTime() < Date.now();
  const status: Assignment['status'] = submission?.status === 'graded'
    ? 'Đã chấm'
    : submission
      ? 'Đã nộp'
      : isOverdue
        ? 'Quá hạn'
        : 'Chưa làm';
  const id = text(raw._id || raw.id);
  if (!id) throw new Error('Bài tập từ máy chủ thiếu mã định danh.');
  return {
    id,
    title: text(raw.title, 'Bài tập'),
    subject: text(raw.courseName || raw.course || raw.courseId, 'Khóa học'),
    courseName: text(raw.courseName || raw.course) || undefined,
    teacher: text(raw.assignedByName || raw.teacherName, 'Giảng viên'),
    deadline: toDateLabel(raw.deadline),
    status,
    description: text(raw.description),
    attachedFileUrl: raw.fileUrl ? resolveMobilePublicUrl(text(raw.fileUrl)) : undefined,
    attachedFileName: text(raw.fileName) || undefined,
    grade: submission?.grade,
    teacherFeedback: submission?.teacherFeedback,
    submissions: submission ? [submission] : [],
    mySubmission: rawSubmission ? {
      submittedAt: text(rawSubmission.createdAt || rawSubmission.submittedAt || rawSubmission.updatedAt),
      status: rawSubmission.status === 'graded' ? 'graded' : 'submitted',
      grade: rawSubmission.grade == null ? undefined : number(rawSubmission.grade),
      forfeit: rawSubmission.forfeit === true,
      gradeHistory,
    } : undefined,
  };
}

export async function getStudentAssignments(user: DemoUser): Promise<Assignment[]> {
  const student = await getStudentDetail(user);
  const enrollments = Array.isArray(student.enrollments) ? student.enrollments.map(mapEnrollment) : [];
  const courseNames = [...new Set([
    ...enrollments
      .filter((enrollment) => enrollment.status !== 'Thôi học')
      .map((enrollment) => enrollment.courseName.trim()),
    text(student.course),
  ].filter(Boolean))];
  const responses = await Promise.all(courseNames.map((courseName) => (
    mobileApiRequest<{ data?: Record<string, unknown>[] }>(
      `/assignments/student/${encodeURIComponent(user.id)}/course/${encodeURIComponent(courseName)}`,
    )
  )));
  const rows = responses.flatMap((response) => {
    if (!Array.isArray(response.data)) {
      throw new Error('Phản hồi danh sách bài tập không hợp lệ.');
    }
    return response.data;
  });
  const seen = new Set<string>();
  const uniqueRows = rows.filter((row) => {
    const id = text(row._id || row.id);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return uniqueRows
    .sort((left, right) => {
      const leftDate = new Date(String(left.deadline || left.createdAt || '')).getTime();
      const rightDate = new Date(String(right.deadline || right.createdAt || '')).getTime();
      const leftTime = Number.isNaN(leftDate) ? Number.POSITIVE_INFINITY : leftDate;
      const rightTime = Number.isNaN(rightDate) ? Number.POSITIVE_INFINITY : rightDate;
      return leftTime - rightTime;
    })
    .map(mapAssignment);
}

export async function submitStudentAssignment(
  assignmentId: string,
  studentId: string,
  submittedFileUrl: string,
) {
  const response = await mobileApiRequest<{ data?: Record<string, unknown> }>(
    `/assignments/${encodeURIComponent(assignmentId)}/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        submittedFileUrl,
      }),
    },
  );
  if (!response.data) throw new Error('Máy chủ không xác nhận bài nộp.');
  return response.data;
}
