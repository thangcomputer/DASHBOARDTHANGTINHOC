import React, { useState, useEffect, useMemo } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import {
  X, BookOpen, Loader2, CheckCircle2, CreditCard, DollarSign, Share2,
} from 'lucide-react';
import { useToast } from '../../../utils/toast';
import { useSocket } from '../../../context/SocketContext';
import { teacherMatchesCourse } from '../../../utils/examSubjects';

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
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" style={{ backdropFilter: 'blur(8px)' }}>
        <div className="bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center gap-4 w-72">
          <CheckCircle2 size={44} className="text-emerald-500 animate-bounce" />
          <p className="text-lg font-black text-emerald-700">Thanh toán thành công!</p>
          <p className="text-xs text-gray-400 text-center">
            Đã thêm khóa học<br /><strong>{form.courseName}</strong>
          </p>
        </div>
      </div>
    );
  }

  if (step === 'qr') {
    const expired = timeLeft === 0;
    const pct = (timeLeft / TOTAL_PAYMENT_SECS) * 100;
    const isUrgent = timeLeft < 60;

    return (
      <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-[9999] p-4" style={{ backdropFilter: 'blur(8px)' }}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-4 text-white flex items-center justify-between">
            <div>
              <p className="font-black text-base">Quét QR thanh toán</p>
              <p className="text-xs opacity-80">{student?.name} — {form.courseName?.slice(0, 28)}</p>
            </div>
            <div className="flex items-center gap-2">
              {sessionId && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/pay/${sessionId}`);
                    toast.success('Đã copy link thanh toán!');
                  }}
                  className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center"
                  title="Chia sẻ link"
                >
                  <Share2 size={14} />
                </button>
              )}
              <button type="button" onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {expired ? (
              <div className="text-center py-8 space-y-3">
                <p className="font-black text-red-600 text-lg">Phiên thanh toán hết hạn</p>
                <button type="button" onClick={() => setStep('form')} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm">
                  Quay lại
                </button>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className={isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-500'}>Còn lại</span>
                    <span className={`font-mono font-black ${isUrgent ? 'text-red-500' : 'text-gray-700'}`}>{formatTime(timeLeft)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 text-center">
                  <p className="text-xs text-gray-500 font-medium">Số tiền cần thanh toán</p>
                  <p className="text-2xl font-black text-blue-700">{Number(form.price || 0).toLocaleString('vi-VN')}đ</p>
                </div>

                {qrUrl ? (
                  <div className="flex justify-center">
                    <div className="border-4 border-emerald-400 rounded-2xl p-2">
                      <img src={qrUrl} alt="VietQR" className="w-44 h-44 object-contain rounded-xl" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                    <Loader2 size={20} className="animate-spin" /> Đang tải mã QR...
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-0.5">Nội dung chuyển khoản</p>
                  <p className="font-mono font-bold text-gray-800 text-sm">{ckContent}</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
                  <Loader2 size={12} className="animate-spin text-emerald-500" />
                  Đang kiểm tra thanh toán tự động...
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePayLater}
                  className="w-full py-2 border-2 border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? 'Đang lưu...' : 'Thêm khóa — thanh toán sau'}
                </button>
                <button type="button" onClick={() => setStep('form')} className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600">
                  Quay lại form
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">Thêm khóa học</h3>
              <p className="text-xs text-slate-500 font-semibold truncate max-w-[220px]">{student?.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Khóa học</label>
            <CmsSelect
              value={form.courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
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
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl border border-emerald-100">
                  <DollarSign size={14} />
                  <span className="text-xs font-black">HỌC PHÍ: {Number(form.price).toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-xl border border-blue-100">
                  <span className="text-xs font-black">SỐ BUỔI: {form.totalSessions}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Giảng viên</label>
            <CmsSelect
              value={form.teacherId}
              onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
              className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
            >
              <option value="">Chưa phân công</option>
              {(teachers || [])
                .filter((t) => String(t.status || '').toLowerCase() === 'active')
                .map((t) => {
                  const match = teacherMatchesCourse(t, form.courseName);
                  return (
                    <option key={t.id || t._id} value={String(t.id || t._id)}>
                      {match ? t.name : `${t.name} (khác môn)`}
                    </option>
                  );
                })}
            </CmsSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Học phí</label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Số buổi</label>
              <input
                type="number"
                min="1"
                value={form.totalSessions}
                onChange={(e) => setForm((f) => ({ ...f, totalSessions: e.target.value }))}
                className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none group p-3 rounded-2xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
              className="peer hidden"
            />
            <div className="w-7 h-7 bg-white rounded-lg border-2 border-gray-200 peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all flex items-center justify-center shadow-sm">
              <CheckCircle2 size={16} className={`text-white transition-opacity ${form.paid ? 'opacity-100' : 'opacity-0'}`} />
            </div>
            <div>
              <span className="text-sm font-black text-gray-800 block uppercase tracking-tight group-hover:text-emerald-700">Thanh toán tiền mặt</span>
              <p className="text-[11px] text-gray-400 font-bold">Học viên đã nộp tiền mặt trực tiếp</p>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading || !form.courseId}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Đang lưu...</>
            ) : form.paid ? (
              <><CheckCircle2 size={16} /> Thêm khóa — đã thu tiền</>
            ) : (
              <><CreditCard size={16} /> Quét QR &amp; thêm khóa</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
