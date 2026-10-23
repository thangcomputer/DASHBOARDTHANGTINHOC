import React, { useState, useEffect, useMemo } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import {
  X, CheckCircle2, CreditCard, AlertCircle, MapPin, Loader2,
  Plus, Share2, UserPlus, Clock3,
} from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';
import { useSocket } from '../../../context/SocketContext';
import { apiFetch, getAccessToken } from '../../../services/api';
import { generateVietQRUrl } from '../../BankSelect';
import TransferPaymentDetails from '../../shared/TransferPaymentDetails';
import { teacherInStudentBranch, toBranchId } from '../../../utils/branchIds';
import { teacherMatchesCourse } from '../../../utils/examSubjects';
import { getEffectiveCoursePrice } from '../../../utils/coursePricing';

function readPortalAccessToken() {
  return (
    getAccessToken('admin')
    || getAccessToken('staff')
    || (() => {
      try {
        for (const key of ['admin_user', 'staff_user']) {
          const user = JSON.parse(localStorage.getItem(key) || 'null');
          const token = user?.token || user?.accessToken;
          if (token) return token;
        }
      } catch { /* ignore */ }
      return '';
    })()
  );
}

function isOnlineBranch(branch) {
  return String(branch?.name || '').toLowerCase().includes('online');
}

export default function AddStudentModal({
  onAdd, onClose, teachers, examSubjectsCatalog, isSubmitting,
}) {
  const toast    = useToast();
  const API      = import.meta.env.VITE_API_URL || '';
  const TOTAL_PAYMENT_SECS = 900; // 15 phút

  const {
    isSuperAdmin, branches: contextBranches, selectedBranchId, selectedTenantId,
  } = useBranch();
  const { socket } = useSocket();

  // ── Step: 'form' | 'qr' | 'success' ─────────────────────────────────────
  const [step, setStep] = useState('form');
  const [submitting, setSubmitting] = useState(false);
  const [loadedBranches, setLoadedBranches] = useState(null);
  const [branchesError, setBranchesError] = useState('');
  const branches = useMemo(
    () => loadedBranches?.length
      ? loadedBranches
      : (contextBranches?.length ? contextBranches : loadedBranches || []),
    [loadedBranches, contextBranches],
  );
  const branchesLoading = loadedBranches === null && !contextBranches?.length && !branchesError;

  // ── Form state ────────────────────────────────────────────────────────────
  const [dbCourses, setDbCourses] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [paymentSetupError, setPaymentSetupError] = useState('');
  const [form, setForm] = useState({
    name: '', age: '', phone: '', zalo: '', gender: 'male',
    courseId: '', course: '', price: 0, totalSessions: 12,
    paid: false, teacherId: '', learningMode: 'OFFLINE', branchId: '', branchCode: '',
    teacherAlert: '',
  });
  const selectedCourse = useMemo(
    () => dbCourses.find((course) => String(course._id) === String(form.courseId)),
    [dbCourses, form.courseId],
  );
  const qualifiedTeachers = useMemo(
    () => (teachers || [])
      .filter(Boolean)
      .filter((teacher) => String(teacher.status || '').toLowerCase() === 'active')
      .filter((teacher) => teacherMatchesCourse(
        teacher,
        selectedCourse || form.course,
        examSubjectsCatalog,
      )),
    [teachers, selectedCourse, form.course, examSubjectsCatalog],
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch('/branches')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Không tải được danh sách chi nhánh');
        }
        if (!cancelled) {
          setBranchesError('');
          setLoadedBranches(Array.isArray(result.data) ? result.data : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBranchesError(error.message || 'Không tải được danh sách chi nhánh');
        }
      });
    return () => { cancelled = true; };
  }, [selectedTenantId]);

  // Fetch courses from DB
  useEffect(() => {
    fetch(`${API}/api/courses`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data.length) {
          setDbCourses(res.data);
          const first = res.data[0];
          const ep = getEffectiveCoursePrice(first);
          let defaultBranchId = '';
          if (selectedBranchId && selectedBranchId !== 'all') {
             defaultBranchId = selectedBranchId;
          } else if (branches && branches.length > 0) {
             defaultBranchId = branches[0]._id || branches[0].id || '';
          }
          
          let mode = 'OFFLINE';
          if (defaultBranchId) {
             const checkBranch = branches.find(b => toBranchId(b) === String(defaultBranchId));
             if (checkBranch && isOnlineBranch(checkBranch)) {
                mode = 'ONLINE';
             }
          }

          const bCode = defaultBranchId ? (branches.find(b => toBranchId(b) === String(defaultBranchId))?.code || '') : '';
          const sessions = Number(first.totalSessions) > 0 ? Number(first.totalSessions) : 12;
          setForm(f => ({ ...f, courseId: first._id, course: first.name, price: ep, totalSessions: sessions, branchId: defaultBranchId, branchCode: bCode, learningMode: mode }));
        }
      })
      .catch(() => {});
  }, [API, isSuperAdmin, selectedBranchId, branches]);

  const locationBranches = useMemo(() => {
    const list = Array.isArray(branches) ? branches : [];
    if (form.learningMode === 'ONLINE') {
      return list.filter(isOnlineBranch);
    }
    return list.filter((b) => !isOnlineBranch(b));
  }, [branches, form.learningMode]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'name') { setForm(f => ({ ...f, name: value.toUpperCase() })); return; }

    if (name === 'learningMode') {
      const mode = value === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
      const list = Array.isArray(branches) ? branches : [];
      const filtered = mode === 'ONLINE'
        ? list.filter(isOnlineBranch)
        : list.filter((b) => !isOnlineBranch(b));
      const stillOk = filtered.some((b) => toBranchId(b) === String(form.branchId));
      const nextBranch = stillOk
        ? list.find((b) => toBranchId(b) === String(form.branchId))
        : filtered[0];
      setForm((f) => ({
        ...f,
        learningMode: mode,
        branchId: nextBranch ? (nextBranch._id || nextBranch.id || '') : '',
        branchCode: nextBranch?.code || '',
        teacherId: '',
      }));
      return;
    }
    
    if (name === 'branchId') {
      const selectedB = branches.find(b => toBranchId(b) === String(value));
      setForm(f => {
        const next = {
          ...f,
          branchId: value,
          branchCode: selectedB?.code || '',
          learningMode: selectedB && isOnlineBranch(selectedB) ? 'ONLINE' : f.learningMode,
        };
        if (f.teacherId) {
          const t = (teachers || []).find((x) => String(x.id || x._id) === String(f.teacherId));
          if (
            !t
            || !teacherInStudentBranch(t, value)
            || !teacherMatchesCourse(t, selectedCourse || f.course, examSubjectsCatalog)
          ) next.teacherId = '';
        }
        return next;
      });
      return;
    }

    if (name === 'courseId') {
      const c = dbCourses.find(x => x._id === value);
      if (c) {
        const ep = getEffectiveCoursePrice(c);
        const sessions = Number(c.totalSessions) > 0 ? Number(c.totalSessions) : 12;
        setForm(f => ({
          ...f,
          courseId: c._id,
          course: c.name,
          price: ep,
          totalSessions: sessions,
          teacherId: '',
        }));
      }
      return;
    }
    if (type === 'checkbox') { setForm(f => ({ ...f, [name]: checked })); return; }
    setForm(f => ({ ...f, [name]: value }));
  };

  // ── QR payment state ──────────────────────────────────────────────────────
  const [bankInfo, setBankInfo]     = useState(null);
  const [timeLeft, setTimeLeft]     = useState(TOTAL_PAYMENT_SECS);
  const [pollStatus, setPollStatus] = useState('pending'); // 'pending' | 'paid'
  const [sessionId, setSessionId]   = useState(null);
  const [reservedStudentCode, setReservedStudentCode] = useState('');
  const [pollError, setPollError] = useState(false);
  const pollRef                     = React.useRef(null);
  const timerRef                    = React.useRef(null);
  const paidProcessedRef            = React.useRef(false);

  const ckContent = useMemo(() => {
    if (!reservedStudentCode) return '';
    const namePart = form.name.replace(/\s+/g, '').slice(0, 8) || 'HV';
    return `${namePart} ${reservedStudentCode} Nop hoc phi`.trim();
  }, [form.name, reservedStudentCode]);

  // Fetch bank + reserve server studentCode + create session khi vào step qr
  useEffect(() => {
    if (step !== 'qr') return;
    let cancelled = false;

    fetch(`${API}/api/settings/bank`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) throw new Error(res.message || 'Không tải được thông tin ngân hàng');
        if (!cancelled) setBankInfo(res.data);
      })
      .catch(error => {
        if (!cancelled) {
          setBankInfo(null);
          toast.error(error.message || 'Không tải được thông tin ngân hàng');
        }
      })
      .finally(() => {
        if (!cancelled) setBankLoading(false);
      });

    const token = readPortalAccessToken();
    const selectedBranch = branches.find(
      (branch) => toBranchId(branch) === String(form.branchId || (selectedBranchId !== 'all' ? selectedBranchId : '')),
    );
    const branchCode = selectedBranch?.code || '';

    (async () => {
      try {
        const codeRes = await apiFetch('/students/reserve-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: 'include',
          body: '{}',
        }).then((r) => r.json());
        if (cancelled) return;
        const code = codeRes?.data?.studentCode || codeRes?.studentCode;
        if (!codeRes.success || !code) {
          const message = codeRes?.message || 'Không cấp được mã học viên từ server';
          setPaymentSetupError(message);
          toast.error(message);
          return;
        }
        setReservedStudentCode(code);
        const namePart = form.name.replace(/\s+/g, '').slice(0, 8) || 'HV';
        const content = `${namePart} ${code} Nop hoc phi`.trim();
        const sess = await apiFetch('/webhooks/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: 'include',
          body: JSON.stringify({
            amount: form.price,
            content,
            studentName: form.name,
            courseName: form.course,
            branchCode: branchCode,
          }),
        }).then((r) => r.json());
        if (cancelled) return;
        if (sess.success && sess.sessionId) setSessionId(sess.sessionId);
        else {
          const message = sess.message || 'Không tạo được phiên QR thanh toán';
          setPaymentSetupError(message);
          toast.error(message);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error?.message || 'Không tạo được phiên QR thanh toán';
          setPaymentSetupError(message);
          toast.error(message);
        }
      }
    })();

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
    };
  }, [step]);

  // Real-time Socket.io listener
  useEffect(() => {
    if (step !== 'qr' || pollStatus === 'paid' || !socket) return;
    
    const handlePaid = (data) => {
      if (sessionId && data.sessionId === sessionId && !paidProcessedRef.current) {
        paidProcessedRef.current = true;
        clearInterval(pollRef.current);
        clearInterval(timerRef.current);
        setPollStatus('paid');
        setStep('success'); // Show success screen (blue check)
        
        // Wait 2 seconds before closing and adding student
        setTimeout(() => {
          Promise.resolve(onAdd({
            ...form,
            age: form.age === '' || form.age == null ? undefined : Number(form.age),
            id: Date.now(),
            paid: true,
            paymentMethod: 'transfer',
            reservedStudentCode,
          }))
            .then(() => onClose())
            .catch((err) => toast.error(err?.message || 'Lỗi thêm học viên sau thanh toán'));
        }, 2500);
      }
    };

    socket.on('tuition:paid', handlePaid);
    return () => socket.off('tuition:paid', handlePaid);
  }, [step, sessionId, pollStatus, socket, ckContent, reservedStudentCode]);

  // Polling mỗi 3s (Fallback)
  useEffect(() => {
    if (step !== 'qr' || pollStatus === 'paid') return;
    const sid = sessionId;
    pollRef.current = setInterval(async () => {
      if (!sid || paidProcessedRef.current) return;
      try {
        const response = await apiFetch(`/webhooks/payment-status?sessionId=${encodeURIComponent(sid)}`);
        const result = await response.json();
        setPollError(!response.ok);
        if (response.ok && (result.paid || result.status === 'paid') && !paidProcessedRef.current) {
          paidProcessedRef.current = true;
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setPollStatus('paid');
          setStep('success'); // Show success screen
          
          setTimeout(() => {
            Promise.resolve(onAdd({
              ...form,
              age: form.age === '' || form.age == null ? undefined : Number(form.age),
              id: Date.now(),
              paid: true,
              paymentMethod: 'transfer',
              reservedStudentCode,
            }))
              .then(() => onClose())
              .catch((err) => toast.error(err?.message || 'Lỗi thêm học viên sau thanh toán'));
          }, 2500);
        }
      } catch {
        setPollError(true);
      }
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [step, sessionId, pollStatus, ckContent, reservedStudentCode]);

  const buildPayload = (paid) => ({
    ...form,
    age: form.age === '' || form.age == null ? undefined : Number(form.age),
    id: Date.now(),
    paid: !!paid,
    paymentMethod: paid ? 'cash' : undefined,
    zalo: form.zalo || form.phone,
  });

  const submitStudent = async (paid) => {
    if (submitting || isSubmitting) return false;
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Vui lòng nhập họ tên và số điện thoại!');
      return false;
    }
    if (!form.course?.trim() && !form.courseId) {
      toast.error('Vui lòng chọn khóa học!');
      return false;
    }
    setSubmitting(true);
    try {
      await Promise.resolve(onAdd(buildPayload(paid)));
      onClose();
      return true;
    } catch (err) {
      // useAdminStudents đã toast — giữ modal mở để sửa form
      if (!err?.message) toast.error('Lỗi thêm học viên');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForm = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('Vui lòng nhập họ tên và số điện thoại!'); return; }
    if (form.paid) {
      await submitStudent(true);
      return;
    }
    setTimeLeft(TOTAL_PAYMENT_SECS);
    setPollStatus('pending');
    setPollError(false);
    setBankInfo(null);
    setBankLoading(true);
    setPaymentSetupError('');
    setReservedStudentCode('');
    setSessionId(null);
    paidProcessedRef.current = false;
    setStep('qr');
  };

  const handleSaveUnpaid = async () => {
    await submitStudent(false);
  };

  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const qrUrl = sessionId && bankInfo?.centerBankCode && bankInfo?.centerBankAccountNumber
    ? generateVietQRUrl(
      bankInfo.centerBankCode,
      bankInfo.centerBankAccountNumber,
      form.price,
      ckContent,
      bankInfo.centerBankAccountName || '',
    )
    : null;

  // ── STEP: success ─────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <>
        <div className="cms-sheet-backdrop" aria-hidden="true" />
        <div role="dialog" aria-modal="true" aria-label="Thanh toán thành công" className="cms-sheet w-full">
          <div className="cms-sheet-body">
            <div className="cms-empty">
              <div className="relative w-20 h-20">
                <svg className="animate-spin absolute inset-0" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" stroke="#22c55e" strokeWidth="6" strokeDasharray="200" strokeDashoffset="50" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle2 size={44} className="text-emerald-500" />
                </div>
              </div>
              <p className="cms-empty__title text-emerald-700">Thanh toán thành công!</p>
              <p className="cms-empty__desc">Đã đăng ký học viên<br /><strong>{form.name}</strong></p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── STEP: QR payment ─────────────────────────────────────────────────────
  if (step === 'qr') {
    const expired = timeLeft === 0;
    const pct     = (timeLeft / TOTAL_PAYMENT_SECS) * 100;
    const isUrgent = timeLeft < 60;

    return (
      <>
        <div className="fixed inset-0 z-[130000] bg-slate-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quét QR thanh toán"
          className="fixed left-1/2 top-1/2 z-[130001] flex max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 px-5 py-4 text-white">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
              <CreditCard size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold leading-tight">Thanh toán học phí</h3>
              <p className="mt-1 truncate text-xs text-white/80">{form.name} · {form.course}</p>
            </div>
            {sessionId && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/pay/${sessionId}`)
                    .then(() => toast.success('Đã sao chép link thanh toán'))
                    .catch(() => toast.error('Không thể sao chép link thanh toán'));
                }}
                aria-label="Sao chép link thanh toán"
                title="Sao chép link thanh toán"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 hover:bg-white/25"
              >
                <Share2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 hover:bg-white/25"
            >
              <X size={19} />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {expired ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                <Clock3 className="mx-auto mb-3 text-amber-600" size={32} />
                <p className="font-bold text-amber-800">Phiên thanh toán đã hết hạn</p>
                <p className="mt-1 text-sm text-amber-700">Quay lại và tạo phiên QR mới để tiếp tục.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <TransferPaymentDetails
                    courseName={form.course || 'Khóa học'}
                    amount={form.price}
                    qrUrl={qrUrl}
                    bankName={bankInfo?.centerBankName || bankInfo?.centerBankCode}
                    accountNumber={bankInfo?.centerBankAccountNumber}
                    accountName={bankInfo?.centerBankAccountName}
                    loading={bankLoading || (!sessionId && !paymentSetupError)}
                    error={paymentSetupError || 'Chưa cấu hình tài khoản ngân hàng trung tâm.'}
                  />
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3 text-xs">
                    <Clock3 size={14} className={isUrgent ? 'text-red-500' : 'text-slate-400'} />
                    <span className={isUrgent ? 'font-semibold text-red-600' : 'text-slate-500'}>Thời gian giữ phiên</span>
                    <span className={`ml-auto font-mono font-bold ${isUrgent ? 'text-red-600' : 'text-slate-700'}`}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${pollError ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                  {pollError
                    ? <AlertCircle size={14} className="text-amber-600" />
                    : <Loader2 size={14} className="animate-spin text-emerald-600" />}
                  {pollError
                    ? 'Không kiểm tra được trạng thái. Hệ thống sẽ tự thử lại.'
                    : 'Đang chờ xác nhận thanh toán tự động'}
                </div>
              </>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white p-4">
            {expired ? (
              <button type="button" onClick={() => { setStep('form'); }} className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700">
                Quay lại
              </button>
            ) : (
              <button type="button" onClick={onClose} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Đóng (thanh toán sau)
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── STEP: form ────────────────────────────────────────────────────────────
  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thêm học viên mới"
        className="cms-sheet cms-sheet--wide cms-sheet--compact cms-sheet--form-dense w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-red-50 text-red-600" aria-hidden="true">
            <Plus size={18} />
          </span>
          <h3 className="cms-sheet-header__title">Thêm học viên mới</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cms-sheet-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5 md:items-start">
            <section className="cms-form">
              <div className="cms-step">
                <span className="cms-step__num">1</span>
                <span className="cms-step__label">Thông tin cá nhân</span>
              </div>

              <div>
                <label className="cms-label">Họ tên học viên <span className="text-red-500">*</span></label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="cms-input uppercase"
                  placeholder="VD: NGUYỄN VĂN A"
                />
              </div>

              <div>
                <label className="cms-label">Giới tính chọn ảnh Cartoon <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, gender: 'male' }))}
                    className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                      form.gender === 'male' || form.gender === 'Nam'
                        ? 'bg-sky-50 text-sky-700 border-sky-300 ring-2 ring-sky-400/20 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>👨 Nam (Cartoon Nam)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, gender: 'female' }))}
                    className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                      form.gender === 'female' || form.gender === 'Nữ'
                        ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-400/20 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>👩 Nữ (Cartoon Nữ)</span>
                  </button>
                </div>
              </div>

              <div className="cms-form-row">
                <div>
                  <label className="cms-label">Tuổi</label>
                  <input
                    name="age"
                    type="number"
                    value={form.age}
                    onChange={handleChange}
                    className="cms-input text-center"
                    placeholder="20"
                  />
                </div>
                <div>
                  <label className="cms-label">Số điện thoại / Zalo <span className="text-red-500">*</span></label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="cms-input font-mono"
                    placeholder="0911222333"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Mật khẩu mặc định = số điện thoại. Lần đăng nhập đầu HV sẽ được nhắc đổi mật khẩu.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:mt-auto">
                <input type="checkbox" name="paid" checked={form.paid} onChange={handleChange} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-800 leading-tight">Thanh toán tiền mặt</span>
                  <span className="block text-[11px] text-slate-500 leading-tight">HV đã nộp tiền mặt trực tiếp — hoặc dùng &quot;Lưu chưa thanh toán&quot; nếu thu sau</span>
                </span>
              </label>
            </section>

            <section className="cms-form">
              <div className="cms-step">
                <span className="cms-step__num cms-step__num--muted">2</span>
                <span className="cms-step__label">Đăng ký khóa học</span>
              </div>

              <div>
                <label className="cms-label">Hình thức học</label>
                <div className="cms-chip-grid">
                  <label className={`cms-chip-option ${form.learningMode === 'OFFLINE' ? 'is-on' : ''}`}>
                    <input type="radio" name="learningMode" value="OFFLINE" checked={form.learningMode === 'OFFLINE'} onChange={handleChange} className="sr-only" />
                    Trực tiếp
                  </label>
                  <label className={`cms-chip-option ${form.learningMode === 'ONLINE' ? 'is-on' : ''}`}>
                    <input type="radio" name="learningMode" value="ONLINE" checked={form.learningMode === 'ONLINE'} onChange={handleChange} className="sr-only" />
                    Online
                  </label>
                </div>
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="cms-label">Địa điểm (chi nhánh)</label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    {form.learningMode === 'ONLINE'
                      ? 'Cơ sở / khu online'
                      : 'Cơ sở đào tạo trực tiếp'}
                  </p>
                  <CmsSelect
                    name="branchId"
                    value={form.branchId || ''}
                    onChange={handleChange}
                    className="cms-input"
                  >
                    <option value="">-- Chọn địa điểm --</option>
                    {locationBranches.map((b) => (
                      <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>
                    ))}
                  </CmsSelect>
                  {locationBranches.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      {branchesLoading
                        ? 'Đang tải danh sách chi nhánh…'
                        : branchesError || 'Chưa có chi nhánh phù hợp hình thức này.'}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="cms-label">Khóa học &amp; học phí</label>
                {dbCourses.length > 0 ? (
                  <CmsSelect name="courseId" value={form.courseId} onChange={handleChange} className="cms-input">
                    {dbCourses.map((c) => {
                      const ep = getEffectiveCoursePrice(c);
                      const sessions = Number(c.totalSessions) > 0 ? Number(c.totalSessions) : 12;
                      return (
                        <option key={c._id} value={c._id}>
                          {c.name} — {ep.toLocaleString('vi-VN')}đ ({sessions} buổi)
                        </option>
                      );
                    })}
                  </CmsSelect>
                ) : (
                  <div className="cms-input flex items-center text-slate-400">Đang tải dữ liệu khóa học...</div>
                )}
                <div className="cms-form-row mt-3">
                  <div>
                    <label className="cms-label">Học phí (VNĐ)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      name="price"
                      value={form.price}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setForm((f) => ({ ...f, price: digits === '' ? '' : Number(digits) }));
                      }}
                      className="cms-input font-mono text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="cms-label">Tổng số buổi</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      name="totalSessions"
                      value={form.totalSessions}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setForm((f) => ({ ...f, totalSessions: digits === '' ? '' : Number(digits) }));
                      }}
                      className="cms-input font-mono text-sky-700"
                    />
                    {form.courseId && (
                      <button
                        type="button"
                        className="mt-1.5 text-[11px] font-semibold text-sky-600 hover:underline text-left"
                        onClick={() => {
                          const c = dbCourses.find((x) => String(x._id) === String(form.courseId));
                          if (!c) return;
                          const sessions = Number(c.totalSessions) > 0 ? Number(c.totalSessions) : 12;
                          const ep = getEffectiveCoursePrice(c);
                          setForm((f) => ({ ...f, totalSessions: sessions, price: ep }));
                        }}
                      >
                        Đồng bộ từ khóa học
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="cms-label">Giảng viên hướng dẫn</label>
                <CmsSelect name="teacherId" value={form.teacherId} onChange={handleChange} className="cms-input">
                  <option value="">-- Chọn sau (không bắt buộc) --</option>
                  {qualifiedTeachers.filter((t) => {
                    const bid = toBranchId(form.branchId);
                    return !bid || teacherInStudentBranch(t, bid);
                  }).map((t) => (
                    <option key={t.id || t._id} value={t.id || t._id}>
                      {t.name}{t.phone ? ` — ${t.phone}` : ''}
                    </option>
                  ))}
                </CmsSelect>
                {toBranchId(form.branchId) && qualifiedTeachers.filter((t) => teacherInStudentBranch(t, form.branchId)).length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">Chưa có giảng viên đúng chuyên môn và cùng chi nhánh để phân công.</p>
                )}
                {!toBranchId(form.branchId) && qualifiedTeachers.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">Chưa có giảng viên đúng chuyên môn để phân công.</p>
                )}
              </div>

              <div>
                <label className="cms-label">Lưu ý cho giảng viên</label>
                <textarea
                  name="teacherAlert"
                  value={form.teacherAlert}
                  onChange={handleChange}
                  rows={3}
                  maxLength={500}
                  placeholder="VD: Học chậm, cần ôn Word, học buổi tối..."
                  className="cms-input min-h-[4.5rem] resize-y"
                />
                <p className="text-[11px] text-slate-400 mt-1">GV thấy ngay khi mở hồ sơ học viên. Không bắt buộc.</p>
              </div>
            </section>
          </div>
        </div>

        <div className="cms-sheet-footer flex-wrap gap-2">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline" disabled={submitting}>
            Hủy bỏ
          </button>
          {!form.paid && (
            <button
              type="button"
              onClick={handleSaveUnpaid}
              className="cms-btn cms-btn-outline"
              disabled={submitting}
              title="Tạo học viên ngay, thu học phí sau"
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Đang lưu…</>
                : <><UserPlus size={16} /> Lưu chưa thanh toán</>}
            </button>
          )}
          <button type="button" onClick={handleSubmitForm} className="cms-btn cms-btn-primary" disabled={submitting}>
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> Đang lưu…</>
              : form.paid
                ? <><CheckCircle2 size={16} /> Hoàn tất đăng ký</>
                : <><CreditCard size={16} /> Quét QR &amp; đăng ký</>}
          </button>
        </div>
      </div>
    </>
  );
}
