import React, { useState, useEffect, useMemo } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import {
  X, BookOpen, Loader2, CheckCircle2, CreditCard, DollarSign,
  Clock3, Copy, GraduationCap, ChevronRight,
} from 'lucide-react';
import { useToast } from '../../../utils/toast';
import { useSocket } from '../../../context/SocketContext';
import { teacherMatchesCourse } from '../../../utils/examSubjects';
import { teacherInStudentBranch } from '../../../utils/branchIds';
import { getEffectiveCoursePrice } from '../../../utils/coursePricing';

function courseEffectivePrice(c) {
  return getEffectiveCoursePrice(c);
}

function courseDefaultSessions(c) {
  const n = Number(c?.totalSessions);
  return n > 0 ? n : 12;
}

function applyCourseToForm(c) {
  return {
    courseId: c._id,
    courseName: c.name,
    price: courseEffectivePrice(c),
    totalSessions: courseDefaultSessions(c),
  };
}

const TOTAL_PAYMENT_SECS = 900;

export default function AddEnrollmentModal({
  student, teachers, examSubjectsCatalog, onSubmit, onClose,
}) {
  const toast = useToast();
  const API = import.meta.env.VITE_API_URL || '';
  const { socket } = useSocket();

  const [step, setStep] = useState('form'); // form | qr | success
  const [dbCourses, setDbCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    courseId: '',
    courseName: '',
    teacherId: '',
    price: 0,
    totalSessions: 12,
    paid: false,
    teacherAlert: '',
  });
  const selectedCourse = useMemo(
    () => dbCourses.find((course) => String(course._id) === String(form.courseId)),
    [dbCourses, form.courseId],
  );

  const [bankInfo, setBankInfo] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TOTAL_PAYMENT_SECS);
  const [pollStatus, setPollStatus] = useState('pending');
  const [sessionId, setSessionId] = useState(null);
  const [sessionRef, setSessionRef] = useState('');
  const pollRef = React.useRef(null);
  const timerRef = React.useRef(null);
  const submittedRef = React.useRef(false);

  useEffect(() => {
    fetch(`${API}/api/courses`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.length) {
          setDbCourses(res.data);
          const first = res.data[0];
          setForm((f) => ({ ...f, ...applyCourseToForm(first) }));
        }
      })
      .catch(() => {});
  }, [API]);

  const handleCourseChange = (courseId) => {
    const c = dbCourses.find((x) => String(x._id) === String(courseId));
    if (!c) return;
    setForm((f) => ({ ...f, ...applyCourseToForm(c), teacherId: '' }));
  };

  const buildPayload = (paid) => {
    const selected = dbCourses.find((c) => String(c._id) === String(form.courseId));
    const courseName = (selected?.name || form.courseName || '').trim();
    return {
      courseId: form.courseId || selected?._id,
      courseName,
      teacherId: form.teacherId || undefined,
      price: Number(form.price) || 0,
      totalSessions: Number(form.totalSessions) || courseDefaultSessions(selected),
      paid: !!paid,
      teacherAlert: String(form.teacherAlert || '').trim(),
    };
  };

  const saveEnrollment = async (paid) => {
    if (submittedRef.current) return false;
    const payload = buildPayload(paid);
    if (!payload.courseName) {
      toast.error('Vui lòng chọn khóa học');
      return false;
    }
    if (typeof onSubmit !== 'function') {
      toast.error('Lỗi hệ thống: chưa gắn hàm lưu');
      return false;
    }
    submittedRef.current = true;
    setLoading(true);
    try {
      const ok = await onSubmit(payload);
      if (ok === false) {
        submittedRef.current = false;
        return false;
      }
      return true;
    } catch {
      submittedRef.current = false;
      toast.error('Không thể thêm khóa học');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // QR: bank + session + countdown
  useEffect(() => {
    if (step !== 'qr') return;

    fetch(`${API}/api/settings/bank`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setBankInfo(res.data); })
      .catch(() => {});

    const token = (() => {
      try { return JSON.parse(localStorage.getItem('admin_user') || '{}').token || ''; }
      catch { return ''; }
    })();

    fetch(`${API}/api/webhooks/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: Number(form.price) || 0,
          kind: 'admin_enrollment',
          studentName: student?.name || '',
          courseName: form.courseName,
          courseId: form.courseId,
          teacherId: form.teacherId || null,
          totalSessions: Number(form.totalSessions) || 12,
          teacherAlert: String(form.teacherAlert || '').trim(),
          branchCode: student?.branchCode || '',
          branchId: student?.branchId || null,
          studentId: student?.id || student?._id,
        }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (!res.success || !res.sessionId || !res.ref) {
            throw new Error(res.message || 'Không thể tạo phiên thanh toán');
          }
          setSessionId(res.sessionId);
          setSessionRef(res.ref);
        })
        .catch((error) => toast.error(error.message || 'Không thể tạo phiên thanh toán'));

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishPaid = () => {
    if (pollStatus === 'paid') return;
    setPollStatus('paid');
    setStep('success');
    setTimeout(() => onClose(), 1800);
  };

  useEffect(() => {
    if (step !== 'qr' || pollStatus === 'paid' || !socket) return;
    const handlePaid = (data) => {
      if (
        sessionId && data.sessionId === sessionId
      ) {
        clearInterval(pollRef.current);
        clearInterval(timerRef.current);
        finishPaid();
      }
    };
    socket.on('tuition:paid', handlePaid);
    return () => socket.off('tuition:paid', handlePaid);
  }, [step, sessionId, pollStatus, socket]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 'qr' || pollStatus === 'paid') return;
    const sid = sessionId;
    pollRef.current = setInterval(async () => {
      if (!sid) return;
      try {
        const r = await fetch(
          `${API}/api/webhooks/payment-status?sessionId=${sid}`,
          {
            headers: {
              Authorization: `Bearer ${JSON.parse(localStorage.getItem('admin_user') || '{}').token || ''}`,
            },
          },
        ).then((x) => x.json());
        if (r.paid || r.status === 'paid') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          finishPaid();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [step, sessionId, pollStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmitForm = async (e) => {
    e?.preventDefault?.();
    if (!form.courseId && !form.courseName) {
      toast.error('Vui lòng chọn khóa học');
      return;
    }
    if (form.paid) {
      const ok = await saveEnrollment(true);
      if (ok !== false) onClose();
      return;
    }
    if (!(Number(form.price) > 0)) {
      toast.error('Học phí phải lớn hơn 0 để tạo QR thanh toán');
      return;
    }
    setTimeLeft(TOTAL_PAYMENT_SECS);
    setPollStatus('pending');
    setSessionId(null);
    setSessionRef('');
    submittedRef.current = false;
    setStep('qr');
  };

  const handlePayLater = async () => {
    if (sessionId) {
      try {
        const token = JSON.parse(localStorage.getItem('admin_user') || '{}').token || '';
        const response = await fetch(`${API}/api/webhooks/cancel-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId }),
        });
        const result = await response.json();
        if (result.status === 'paid') {
          finishPaid();
          return;
        }
        if (!response.ok || result.success !== true) {
          throw new Error(result.message || 'Không thể hủy phiên thanh toán');
        }
      } catch (error) {
        toast.error(error.message || 'Không thể hủy phiên thanh toán');
        return;
      }
    }
    const ok = await saveEnrollment(false);
    if (ok !== false) onClose();
  };

  const cancelPaymentSession = async () => {
    if (!sessionId) return true;
    const token = (() => {
      try { return JSON.parse(localStorage.getItem('admin_user') || '{}').token || ''; }
      catch { return ''; }
    })();
    const response = await fetch(`${API}/api/webhooks/cancel-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId }),
    });
    const result = await response.json();
    if (result.status === 'paid') {
      finishPaid();
      return false;
    }
    if (!response.ok || result.success !== true) {
      throw new Error(result.message || 'Không thể hủy phiên thanh toán');
    }
    return true;
  };

  const handleClosePayment = async () => {
    try {
      if (await cancelPaymentSession()) onClose();
    } catch (error) {
      toast.error(error.message || 'Không thể đóng phiên thanh toán');
    }
  };

  const handleBackToForm = async () => {
    try {
      if (!(await cancelPaymentSession())) return;
      setSessionId(null);
      setSessionRef('');
      setStep('form');
    } catch (error) {
      toast.error(error.message || 'Không thể hủy phiên thanh toán');
    }
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const qrUrl = bankInfo?.centerBankCode && bankInfo?.centerBankAccountNumber && sessionRef
    ? `https://img.vietqr.io/image/${bankInfo.centerBankCode}-${bankInfo.centerBankAccountNumber}-compact2.png?amount=${Number(form.price) || 0}&addInfo=${encodeURIComponent(sessionRef)}&accountName=${encodeURIComponent(bankInfo.centerBankAccountName || '')}`
    : null;

  if (step === 'success') {
    return (
      <>
        <div className="cms-sheet-backdrop" aria-hidden="true" />
        <div role="dialog" aria-modal="true" aria-label="Thanh toán thành công" className="cms-sheet w-full">
          <div className="cms-sheet-body">
            <div className="cms-empty">
              <CheckCircle2 size={44} className="text-emerald-500" />
              <p className="cms-empty__title text-emerald-700">Thanh toán thành công!</p>
              <p className="cms-empty__desc">Đã thêm khóa học<br /><strong>{form.courseName}</strong></p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (step === 'qr') {
    const expired = timeLeft === 0;
    const isUrgent = timeLeft < 60;
    const copyPaymentRef = async () => {
      try {
        await navigator.clipboard.writeText(sessionRef);
        toast.success('Đã sao chép nội dung chuyển khoản');
      } catch {
        toast.error('Không sao chép được nội dung chuyển khoản');
      }
    };

    return (
      <>
        <div className="fixed inset-0 z-[130000] bg-slate-950/70 backdrop-blur-sm" onClick={handleClosePayment} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thanh toán mua khóa học"
          className="fixed inset-0 z-[130001] flex items-center justify-center p-2 sm:p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-[0_28px_100px_rgba(15,23,42,0.4)]">
            <div className="relative flex shrink-0 items-center gap-3 bg-gradient-to-r from-rose-600 via-fuchsia-700 to-indigo-600 px-5 py-4 text-white sm:px-7">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner shadow-white/10">
                <CreditCard size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black tracking-tight sm:text-xl">Thanh toán mua khóa học</h3>
                <p className="mt-0.5 text-xs font-medium text-white/80 sm:text-sm">VietQR · Thanh toán nhanh, tự động xác nhận</p>
              </div>
              <button
                type="button"
                onClick={handleClosePayment}
                aria-label="Đóng"
                className="rounded-xl p-2 text-white/90 transition hover:bg-white/15 hover:text-white"
              >
                <X size={23} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="relative mb-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-50 to-indigo-50/70 p-4 sm:p-5">
                <div className="absolute right-4 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-rose-100 text-rose-600 sm:right-6 sm:h-20 sm:w-20">
                  <GraduationCap size={37} strokeWidth={2.3} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Khóa học</p>
                <p className="mt-1 max-w-[78%] text-base font-black leading-snug text-slate-900 sm:text-lg">{form.courseName}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Số tiền thanh toán</p>
                <p className="mt-0.5 text-3xl font-black leading-none tracking-tight text-red-600 tabular-nums sm:text-4xl">
                  {Number(form.price || 0).toLocaleString('vi-VN')}đ
                </p>
              </div>

              {expired ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-8 text-center">
                  <Clock3 className="mx-auto text-rose-500" size={34} />
                  <p className="mt-2 text-lg font-black text-rose-700">Phiên thanh toán đã hết hạn</p>
                  <p className="mt-1 text-sm text-slate-600">Tạo phiên mới để tiếp tục thanh toán an toàn.</p>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_8px_30px_rgba(37,99,235,0.08)] sm:p-5">
                  <div className="mb-2 text-center text-3xl font-black tracking-tight">
                    <span className="text-rose-600">Viet</span><span className="text-blue-800">QR</span>
                  </div>

                  {qrUrl ? (
                    <div className="flex flex-col items-center">
                      <div className="rounded-xl border-2 border-blue-500 bg-white p-1 shadow-sm">
                        <img src={qrUrl} alt="Mã VietQR thanh toán" className="h-48 w-48 object-contain sm:h-52 sm:w-52" />
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-3 text-sm font-extrabold">
                        <span className="italic text-blue-800">napas<span className="text-emerald-500">247</span></span>
                        <span className="h-5 border-l border-slate-300" />
                        <span className="text-lg text-blue-700">{bankInfo?.centerBankName || bankInfo?.centerBankCode || 'Ngân hàng'}</span>
                      </div>
                      {bankInfo?.centerBankAccountName && (
                        <p className="mt-2 max-w-full text-center text-xs font-black uppercase leading-relaxed text-slate-800 sm:text-sm">
                          {bankInfo.centerBankAccountName}
                        </p>
                      )}
                      {bankInfo?.centerBankAccountNumber && (
                        <p className="mt-1 font-mono text-xs font-semibold text-slate-500">
                          STK: {bankInfo.centerBankAccountNumber}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
                      {bankInfo ? (
                        <>
                          <Loader2 size={28} className="animate-spin text-blue-500" />
                          <p className="text-sm font-medium text-slate-500">
                            {sessionRef ? 'Đang tải mã QR thanh toán...' : 'Đang tạo mã thanh toán riêng...'}
                          </p>
                        </>
                      ) : (
                        <p className="max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                          Chưa cấu hình tài khoản ngân hàng trung tâm. Vui lòng kiểm tra mục Cài đặt thanh toán.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 border-t border-slate-100 pt-3 text-center">
                    <p className="text-sm leading-relaxed text-slate-600">Mở ứng dụng ngân hàng hoặc MoMo để quét mã QR thanh toán.</p>
                    <p className="text-sm font-bold text-blue-600">Hệ thống sẽ tự động xác nhận sau vài giây.</p>
                  </div>

                  {sessionRef && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                      <span className="min-w-0 flex-1 text-center font-mono text-sm font-bold text-blue-900">{sessionRef}</span>
                      <button type="button" onClick={copyPaymentRef} aria-label="Sao chép nội dung chuyển khoản" className="rounded-lg p-2 text-blue-700 transition hover:bg-white">
                        <Copy size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!expired && (
                <>
                  <div className={`mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3 ${isUrgent ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-rose-100 bg-gradient-to-r from-rose-50 to-red-50 text-red-600'}`}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/80">
                      <Clock3 size={26} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Thời gian chờ thanh toán</p>
                      <p className="font-mono text-2xl font-black leading-tight tabular-nums">{formatTime(timeLeft)}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <Loader2 size={14} className="animate-spin text-blue-500" />
                      Tự động kiểm tra
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 px-4 py-3">
                    <p className="mb-3 text-sm font-black text-slate-800">Hướng dẫn thanh toán</p>
                    <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 sm:grid-cols-3 sm:gap-2">
                      {[
                        'Mở app ngân hàng hoặc MoMo',
                        'Quét mã QR ở trên',
                        <>Thanh toán đúng số tiền <strong className="text-red-600">{Number(form.price || 0).toLocaleString('vi-VN')}đ</strong></>,
                      ].map((instruction, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white shadow-sm">{index + 1}</span>
                          <span className="leading-snug">{instruction}</span>
                          {index < 2 && <ChevronRight size={16} className="ml-auto hidden shrink-0 text-blue-500 sm:block" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
              {expired ? (
                <button type="button" onClick={handleBackToForm} className="cms-btn cms-btn-primary w-full sm:w-auto">
                  Tạo phiên mới
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePayLater}
                    className="cms-btn cms-btn-outline w-full sm:w-auto"
                  >
                    {loading ? 'Đang lưu...' : 'Thêm khóa — thanh toán sau'}
                  </button>
                  <button type="button" onClick={handleBackToForm} className="cms-btn cms-btn-outline w-full text-slate-500 sm:w-auto">
                    Quay lại form
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thêm khóa học"
        className="cms-sheet cms-sheet--compact w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-sky-50 text-sky-600" aria-hidden="true">
            <BookOpen size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="cms-sheet-header__title">Thêm khóa học</h3>
            <p className="text-center text-[11px] text-slate-500 truncate mt-0.5">{student?.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmitForm} className="contents">
          <div className="cms-sheet-body">
            <div className="cms-form">
              <div>
                <label className="cms-label">Khóa học</label>
                <CmsSelect
                  value={form.courseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="cms-input"
                  required
                >
                  {dbCourses.length === 0 && <option value="">Đang tải...</option>}
                  {dbCourses.map((c) => {
                    const ep = courseEffectivePrice(c);
                    const sessions = courseDefaultSessions(c);
                    return (
                      <option key={c._id} value={c._id}>
                        {c.name} — {ep.toLocaleString('vi-VN')}đ ({sessions} buổi)
                      </option>
                    );
                  })}
                </CmsSelect>
                {Number(form.price) > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100 text-[11px] font-bold">
                      <DollarSign size={11} /> {Number(form.price).toLocaleString('vi-VN')}đ
                    </span>
                    <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-lg border border-sky-100 text-[11px] font-bold">
                      {form.totalSessions} buổi
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="cms-label">Giảng viên</label>
                <CmsSelect
                  value={form.teacherId}
                  onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
                  className="cms-input"
                >
                  <option value="">Chưa phân công</option>
                  {(teachers || [])
                    .filter((t) => String(t.status || '').toLowerCase() === 'active')
                    .filter((t) => teacherMatchesCourse(
                      t,
                      selectedCourse || form.courseName,
                      examSubjectsCatalog,
                    ))
                    .map((t) => {
                      const sameBranch = teacherInStudentBranch(t, student?.branchId);
                      return (
                        <option
                          key={t.id || t._id}
                          value={String(t.id || t._id)}
                          disabled={!sameBranch}
                        >
                          {sameBranch ? t.name : `${t.name} (khác chi nhánh)`}
                        </option>
                      );
                    })}
                </CmsSelect>
              </div>

              <div>
                <label className="cms-label">Lưu ý cho giảng viên</label>
                <textarea
                  value={form.teacherAlert}
                  onChange={(e) => setForm((f) => ({ ...f, teacherAlert: e.target.value }))}
                  rows={3}
                  maxLength={500}
                  placeholder="VD: Học chậm, cần ôn Word, học buổi tối..."
                  className="cms-input min-h-[4.5rem] resize-y"
                />
                <p className="text-[11px] text-slate-400 mt-1">GV thấy ngay khi mở hồ sơ khóa này. Không bắt buộc.</p>
              </div>

              <div className="cms-form-row">
                <div>
                  <label className="cms-label">Học phí</label>
                  <input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="cms-input"
                  />
                </div>
                <div>
                  <label className="cms-label">Số buổi</label>
                  <input
                    type="number"
                    min="1"
                    value={form.totalSessions}
                    onChange={(e) => setForm((f) => ({ ...f, totalSessions: e.target.value }))}
                    className="cms-input"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.paid}
                  onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-800 leading-tight">Thanh toán tiền mặt</span>
                  <span className="block text-[11px] text-slate-500 leading-tight">HV đã nộp tiền mặt trực tiếp</span>
                </span>
              </label>
            </div>
          </div>

          <div className="cms-sheet-footer">
            <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">Hủy</button>
            <button
              type="submit"
              disabled={loading || !form.courseId}
              className="cms-btn cms-btn-primary"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Đang lưu...</>
              ) : form.paid ? (
                <><CheckCircle2 size={16} /> Thêm khóa — đã thu tiền</>
              ) : (
                <><CreditCard size={16} /> Quét QR &amp; thêm khóa</>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
