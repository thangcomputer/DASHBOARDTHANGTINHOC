import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../../context/DataContext';
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
 * Blocks Student Learning shell when no enrollment.status === 'active'.
 * Allows #profile (and optional allowHashes) without unlocking learning tabs.
 */
export default function StudentLearningAccessGate({
  children,
  allowHashes = ['profile'],
  session: sessionProp = null,
}) {
  const location = useLocation();
  const { students } = useData() || {};
  const studentId = sessionProp?.id || sessionProp?._id || readStudentSessionId();

  const student = useMemo(() => {
    if (!studentId || !Array.isArray(students)) return null;
    return students.find((s) => String(s?.id || s?._id) === String(studentId)) || null;
  }, [students, studentId]);

  // Chưa có danh sách students / chưa tìm thấy HV → đừng block sớm (tránh flash)
  const dataReady = Array.isArray(students) && students.length > 0 && !!student;
  const hasAccess = hasLearningAccessEnrollment(student);

  const hash = String(location.hash || '').replace(/^#/, '').split(/[?#]/)[0];
  const hashAllowed = allowHashes.map((h) => String(h).replace(/^#/, '')).includes(hash);

  if (dataReady && !hasAccess && !hashAllowed) {
    return <StudentNoActiveCoursePage />;
  }

  return children;
}
