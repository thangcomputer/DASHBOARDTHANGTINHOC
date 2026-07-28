import React, { useState, useEffect, useMemo } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import {
  X, BookOpen, Loader2, CheckCircle2, CreditCard, DollarSign, Share2,
} from 'lucide-react';
import { useToast } from '../../../utils/toast';
import { useSocket } from '../../../context/SocketContext';
import { teacherMatchesCourse } from '../../../utils/examSubjects';
import { uniqueCoursesByName } from '../../../utils/uniqueCourses';

function courseEffectivePrice(c) {
  return Math.round(Number(c?.price || 0) * (1 - (Number(c?.discountPercent) || 0) / 100));
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

export default function AddEnrollmentModal({ student, teachers, onSubmit, onClose }) {
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
  });

  const [bankInfo, setBankInfo] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TOTAL_PAYMENT_SECS);
  const [pollStatus, setPollStatus] = useState('pending');
  const [sessionId, setSessionId] = useState(null);
  const pollRef = React.useRef(null);
  const timerRef = React.useRef(null);
  const submittedRef = React.useRef(false);

  const payCode = useMemo(
    () => `TTH${String(student?.id || student?._id || Date.now()).slice(-5)}`,
    [student],
  );
  const ckContent = useMemo(() => {
    const namePart = String(student?.name || 'HV').replace(/\s+/g, '').slice(0, 8);
    return `${namePart} ${payCode} Nop hoc phi`.trim();
  }, [student?.name, payCode]);

  useEffect(() => {
    fetch(`${API}/api/courses`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.length) {
          const unique = uniqueCoursesByName(res.data);
          setDbCourses(unique);
          const first = unique[0];
          if (first) setForm((f) => ({ ...f, ...applyCourseToForm(first) }));
        }
      })
      .catch(() => {});
  }, [API]);

  const handleCourseChange = (courseId) => {
    const c = dbCourses.find((x) => String(x._id) === String(courseId));
    if (!c) return;
    setForm((f) => ({ ...f, ...applyCourseToForm(c) }));
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
    setTimeLeft(TOTAL_PAYMENT_SECS);
    setPollStatus('pending');
    submittedRef.current = false;

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
        content: ckContent,
        studentName: student?.name || '',
        courseName: form.courseName,
        branchCode: student?.branchCode || '',
        studentId: student?.id || student?._id,
      }),
    })
      .then((r) => r.json())
      .then((res) => { if (res.sessionId) setSessionId(res.sessionId); })
      .catch(() => {});

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

  const finishPaid = async () => {
    if (pollStatus === 'paid') return;
    setPollStatus('paid');
    setStep('success');
    const ok = await saveEnrollment(true);
    setTimeout(() => { if (ok !== false) onClose(); }, 1800);
  };

  useEffect(() => {
    if (step !== 'qr' || pollStatus === 'paid' || !socket) return;
    const handlePaid = (data) => {
      if (
        data.sessionId === sessionId
        || (data.content && data.content.toLowerCase().includes(ckContent.toLowerCase()))
      ) {
        clearInterval(pollRef.current);
        clearInterval(timerRef.current);
        finishPaid();
      }
    };
    socket.on('tuition:paid', handlePaid);
    return () => socket.off('tuition:paid', handlePaid);
  }, [step, sessionId, pollStatus, socket, ckContent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 'qr' || pollStatus === 'paid') return;
    const sid = sessionId;
    pollRef.current = setInterval(async () => {
      if (!sid && !ckContent) return;
      try {
        const r = await fetch(
          `${API}/api/webhooks/payment-status?sessionId=${sid || ''}&content=${encodeURIComponent(ckContent)}`,
        ).then((x) => x.json());
        if (r.paid || r.status === 'paid') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          finishPaid();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [step, sessionId, pollStatus, ckContent]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setStep('qr');
  };

  const handlePayLater = async () => {
    const ok = await saveEnrollment(false);
    if (ok !== false) onClose();
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const qrUrl = bankInfo?.centerBankCode && bankInfo?.centerBankAccountNumber
    ? `https://img.vietqr.io/image/${bankInfo.centerBankCode}-${bankInfo.centerBankAccountNumber}-compact2.png?amount=${Number(form.price) || 0}&addInfo=${encodeURIComponent(ckContent)}&accountName=${encodeURIComponent(bankInfo.centerBankAccountName || '')}`
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
    const pct = (timeLeft / TOTAL_PAYMENT_SECS) * 100;
    const isUrgent = timeLeft < 60;

    return (
      <>
        <div className="cms-sheet-backdrop" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quét QR thanh toán"
          className="cms-sheet w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
          <div className="cms-sheet-header">
            {sessionId ? (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/pay/${sessionId}`);
                  toast.success('Đã copy link thanh toán!');
                }}
                aria-label="Chia sẻ link"
                title="Chia sẻ link"
                className="cms-sheet-header__side bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors"
              >
                <Share2 size={16} />
              </button>
            ) : (
              <span className="cms-sheet-header__side bg-sky-50 text-sky-600" aria-hidden="true">
                <CreditCard size={18} />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="cms-sheet-header__title">Quét QR thanh toán</h3>
              <p className="text-center text-[11px] text-slate-500 truncate mt-0.5">
                {student?.name} — {form.courseName?.slice(0, 28)}
              </p>
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

          <div className="cms-sheet-body space-y-4">
            {expired ? (
              <div className="cms-empty">
                <p className="cms-empty__title text-red-600">Phiên thanh toán hết hạn</p>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className={isUrgent ? 'text-red-500 animate-pulse' : 'text-slate-500'}>Còn lại</span>
                    <span className={`font-mono font-bold ${isUrgent ? 'text-red-500' : 'text-slate-700'}`}>{formatTime(timeLeft)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-center">
                  <p className="text-xs text-slate-500 font-medium">Số tiền cần thanh toán</p>
                  <p className="text-2xl font-bold text-sky-700 mt-1">{Number(form.price || 0).toLocaleString('vi-VN')}đ</p>
                </div>

                {qrUrl ? (
                  <div className="flex justify-center">
                    <div className="border-2 border-emerald-300 rounded-2xl p-2 shadow-sm">
                      <img src={qrUrl} alt="VietQR" className="w-44 h-44 object-contain rounded-xl" />
                    </div>
                  </div>
                ) : (
                  <div className="cms-empty py-8">
                    <Loader2 size={22} className="animate-spin text-slate-400" />
                    <p className="cms-empty__desc">Đang tải mã QR...</p>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-400 mb-0.5">Nội dung chuyển khoản</p>
                  <p className="font-mono font-semibold text-slate-800 text-sm">{ckContent}</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
                  <Loader2 size={12} className="animate-spin text-emerald-500" />
                  Đang kiểm tra thanh toán tự động...
                </div>
              </>
            )}
          </div>

          <div className="cms-sheet-footer" style={{ flexDirection: 'column' }}>
            {expired ? (
              <button type="button" onClick={() => setStep('form')} className="cms-btn cms-btn-primary">
                Quay lại
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePayLater}
                  className="cms-btn cms-btn-outline w-full"
                >
                  {loading ? 'Đang lưu...' : 'Thêm khóa — thanh toán sau'}
                </button>
                <button type="button" onClick={() => setStep('form')} className="cms-btn cms-btn-outline w-full text-slate-500">
                  Quay lại form
                </button>
              </>
            )}
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
        className="cms-sheet w-full"
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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100 text-[12px] font-bold">
                      <DollarSign size={13} /> Học phí: {Number(form.price).toLocaleString('vi-VN')}đ
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-xl border border-sky-100 text-[12px] font-bold">
                      Số buổi: {form.totalSessions}
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
                    .map((t) => {
                      const match = teacherMatchesCourse(t, form.courseName);
                      return (
                        <option
                          key={t.id || t._id}
                          value={String(t.id || t._id)}
                          disabled={!match}
                        >
                          {match ? t.name : `${t.name} (khác môn)`}
                        </option>
                      );
                    })}
                </CmsSelect>
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

              <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <input
                  type="checkbox"
                  checked={form.paid}
                  onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  <span className="block text-[14px] font-semibold text-slate-800">Thanh toán tiền mặt</span>
                  <span className="block text-[12px] text-slate-500 mt-0.5">Học viên đã nộp tiền mặt trực tiếp</span>
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
