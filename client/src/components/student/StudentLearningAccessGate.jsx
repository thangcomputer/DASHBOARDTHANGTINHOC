import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useStudentsContext } from '../../context/StudentsContext';
import { hasLearningAccessEnrollment } from '../../utils/enrollments';
import StudentNoActiveCoursePage from './StudentNoActiveCoursePage';

function readStudentSessionId() {
  try {
    const session = JSON.parse(localStorage.getItem('student_user') || '{}') || {};
    return session.id || session._id || null;
  } catch {
    return null;
  }
}

/**
 * Blocks Student Learning shell when no usable enrollment (active/completed/paused).
 * Cancelled / refunded / unpaid-pending → StudentNoActiveCoursePage.
 * Allows #profile (and optional allowHashes) without unlocking learning tabs.
 * Student role: fail-closed after load. Admin/staff preview: bypass.
 */
export default function StudentLearningAccessGate({
  children,
  allowHashes = ['profile'],
  session: sessionProp = null,
}) {
  const location = useLocation();
  const { students, isStudentsLoading } = useStudentsContext();
  const role = String(sessionProp?.role || '').toLowerCase();
  const studentId = sessionProp?.id || sessionProp?._id || readStudentSessionId();

  const student = useMemo(() => {
    if (!studentId || !Array.isArray(students)) return null;
    return students.find((s) => String(s?.id || s?._id) === String(studentId)) || null;
  }, [students, studentId]);

  const hash = String(location.hash || '').replace(/^#/, '').split(/[?#]/)[0];
  const hashAllowed = allowHashes.map((h) => String(h).replace(/^#/, '')).includes(hash);

  // Admin/staff xem thử dashboard HV → không chặn
  if (role === 'admin' || role === 'staff') {
    return children;
  }

  // Đang tải hồ sơ HV → không mở learning shell (tránh lọt dashboard)
  if (isStudentsLoading && !student) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-slate-500">
        Đang kiểm tra quyền học…
      </div>
    );
  }

  const hasAccess = hasLearningAccessEnrollment(student);

  if ((!student || !hasAccess) && !hashAllowed) {
    return <StudentNoActiveCoursePage />;
  }

  return children;
}
