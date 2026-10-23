import React, { useState, useEffect, useMemo } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import {
  X, BookOpen, Loader2, CheckCircle2, CreditCard, DollarSign,
  Clock3,
} from 'lucide-react';
import { generateVietQRUrl } from '../../BankSelect';
import TransferPaymentDetails from '../../shared/TransferPaymentDetails';
import TransferPaymentHeader from '../../shared/TransferPaymentHeader';
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
  const [bankLoading, setBankLoading] = useState(false);
  const [paymentSetupError, setPaymentSetupError] = useState('');
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
    let cancelled = false;

    fetch(`${API}/api/settings/bank`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) throw new Error(res.message || 'Không tải được thông tin ngân hàng');
        if (!cancelled) setBankInfo(res.data);
      })
      .catch((error) => {
        if (!cancelled) {
          setBankInfo(null);
          toast.error(error.message || 'Không tải được thông tin ngân hàng');
        }
      })
      .finally(() => {
        if (!cancelled) setBankLoading(false);
      });

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
          if (!cancelled) {
            setSessionId(res.sessionId);
            setSessionRef(res.ref);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setPaymentSetupError(error.message || 'Không thể tạo phiên thanh toán');
            toast.error(error.message || 'Không thể tạo phiên thanh toán');
          }
        });

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
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
    setBankInfo(null);
    setBankLoading(true);
    setPaymentSetupError('');
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
    ? generateVietQRUrl(
      bankInfo.centerBankCode,
      bankInfo.centerBankAccountNumber,
      Number(form.price) || 0,
      sessionRef,
      bankInfo.centerBankAccountName || '',
    )
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
    return (
      <>
        <div className="fixed inset-0 z-[130000] bg-slate-950/70 backdrop-blur-sm" onClick={handleClosePayment} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thanh toán mua khóa học"
          className="fixed inset-0 z-[130001] flex items-center justify-center p-2 sm:p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_28px_100px_rgba(15,23,42,0.4)]">
            <TransferPaymentHeader title="Thanh toán mua khóa học" onClose={handleClosePayment} />

            <div className="overflow-y-auto p-3 sm:p-4">
                {expired ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-8 text-center">
                  <Clock3 className="mx-auto text-rose-500" size={34} />
                  <p className="mt-2 text-lg font-black text-rose-700">Phiên thanh toán đã hết hạn</p>
                  <p className="mt-1 text-sm text-slate-600">Tạo phiên mới để tiếp tục thanh toán an toàn.</p>
                </div>
              ) : (
                <TransferPaymentDetails
                  courseName={form.courseName}
                  amount={form.price}
                  qrUrl={qrUrl}
                  bankName={bankInfo?.centerBankName || bankInfo?.centerBankCode}
                  accountNumber={bankInfo?.centerBankAccountNumber}
                  accountName={bankInfo?.centerBankAccountName}
                  loading={bankLoading || (!sessionRef && !paymentSetupError)}
                  error={paymentSetupError || 'Chưa cấu hình tài khoản ngân hàng trung tâm. Vui lòng kiểm tra mục Cài đặt thanh toán.'}
                />
              )}

              {!expired && (
                <>
                  <div className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                    Đang tự động kiểm tra thanh toán... ({formatTime(timeLeft)})
                  </div>

                </>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-white px-3 py-2 sm:flex-row sm:justify-end sm:px-4">
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
