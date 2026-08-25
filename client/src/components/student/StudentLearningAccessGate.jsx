import React, { useEffect, useMemo, useRef } from 'react';
import { useStudentsContext } from '../../context/StudentsContext';
import { hasLearningAccessEnrollment } from '../../utils/enrollments';
import api, { clearTokens } from '../../services/api';
import { getDeviceFingerprint } from '../../utils/deviceFingerprint';

function readStudentSessionId() {
  try {
    const session = JSON.parse(localStorage.getItem('student_user') || '{}') || {};
    return session.id || session._id || null;
  } catch {
    return null;
  }
}

function buildReEnrollUrl(phone) {
  const q = new URLSearchParams({ reEnroll: '1' });
  if (phone) q.set('phone', String(phone));
  return `/dangkykhoahoc?${q.toString()}`;
}

/**
 * HV không còn khóa usable (hủy/hoàn/pending_payment) → out hẳn khỏi Dashboard,
 * clear session, đẩy sang /dangkykhoahoc (thanh toán / đăng ký lại).
 * Admin/staff preview: bypass.
 */
export default function StudentLearningAccessGate({
  children,
  session: sessionProp = null,
}) {
  const { students, isStudentsLoading } = useStudentsContext();
  const role = String(sessionProp?.role || '').toLowerCase();
  const studentId = sessionProp?.id || sessionProp?._id || readStudentSessionId();
  const kickingRef = useRef(false);

  const student = useMemo(() => {
    if (!studentId || !Array.isArray(students)) return null;
    return students.find((s) => String(s?.id || s?._id) === String(studentId)) || null;
  }, [students, studentId]);

  const mustKick = useMemo(() => {
    if (role === 'admin' || role === 'staff') return false;
    if (role !== 'student') return false;
    if (isStudentsLoading && !student) return false;
    // Chỉ kick khi đã có hồ sơ và không còn khóa usable (hủy/hoàn/pending…)
    if (student && !hasLearningAccessEnrollment(student)) return true;
    return false;
  }, [role, isStudentsLoading, student]);

  useEffect(() => {
    if (!mustKick || kickingRef.current) return;
    kickingRef.current = true;

    const phone = String(
      student?.phone
      || student?.zalo
      || sessionProp?.phone
      || sessionProp?.zalo
      || '',
    ).trim();
    const sid = String(student?._id || student?.id || studentId || '').trim();

    (async () => {
      const deviceId = localStorage.getItem('cms_device_id_v1') || getDeviceFingerprint();
      try { await api.auth.logout(); } catch { /* ignore */ }
      clearTokens('student');
      localStorage.removeItem('student_user');
      localStorage.removeItem('student_access_token');
      localStorage.removeItem('student_refresh_token');
      try {
        if (phone) sessionStorage.setItem('cms_re_enroll_phone', phone);
        if (sid) sessionStorage.setItem('cms_re_enroll_student_id', sid);
        sessionStorage.setItem('cms_re_enroll_notice', '1');
      } catch { /* ignore */ }
      if (deviceId) localStorage.setItem('cms_device_id_v1', deviceId);
      // Hard navigate: clear React session + ra khỏi mọi shell Dashboard
      window.location.replace(buildReEnrollUrl(phone));
    })();
  }, [mustKick, student, sessionProp, studentId]);

  if (role === 'admin' || role === 'staff') {
    return children;
  }

  if (isStudentsLoading && !student) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-slate-500">
        Đang kiểm tra quyền học…
      </div>
    );
  }

  if (mustKick) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-slate-500">
        Không còn khóa học — chuyển sang trang đăng ký…
      </div>
    );
  }

  return children;
}
