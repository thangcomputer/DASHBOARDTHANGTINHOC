import React, { useState, useEffect, useMemo } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import {
  X, CheckCircle2, CreditCard, AlertCircle, MapPin, Loader2,
  Plus, Share2, DollarSign,
} from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';
import { useSocket } from '../../../context/SocketContext';

export default function AddStudentModal({ onAdd, onClose, teachers }) {
  const toast    = useToast();
  const API      = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");
  const TOTAL_PAYMENT_SECS = 900; // 15 phút

  const { isSuperAdmin, branches, selectedBranchId } = useBranch();
  const { socket } = useSocket();

  // ── Step: 'form' | 'qr' | 'success' ─────────────────────────────────────
  const [step, setStep] = useState('form');

  // ── Form state ────────────────────────────────────────────────────────────
  const [dbCourses, setDbCourses] = useState([]);
  const [form, setForm] = useState({
    name: '', age: '', phone: '', zalo: '', gender: 'male',
    courseId: '', course: '', price: 0, totalSessions: 12,
    paid: false, teacherId: '', learningMode: 'OFFLINE', branchId: '', branchCode: ''
  });

  // Fetch courses from DB
  useEffect(() => {
    fetch(`${API}/api/courses`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data.length) {
          setDbCourses(res.data);
          const first = res.data[0];
          const ep = Math.round(first.price * (1 - (first.discountPercent || 0) / 100));
          let defaultBranchId = '';
          if (selectedBranchId && selectedBranchId !== 'all') {
             defaultBranchId = selectedBranchId;
          } else if (branches && branches.length > 0) {
             defaultBranchId = branches[0]._id;
          }
          
          let mode = 'OFFLINE';
          if (defaultBranchId) {
             const checkBranch = branches.find(b => String(b._id) === String(defaultBranchId));
             if (checkBranch && checkBranch.name.toLowerCase().includes('online')) {
                mode = 'ONLINE';
             }
          }

          const bCode = defaultBranchId ? (branches.find(b => String(b._id) === String(defaultBranchId))?.code || '') : '';
          const sessions = Number(first.totalSessions) > 0 ? Number(first.totalSessions) : 12;
          setForm(f => ({ ...f, courseId: first._id, course: first.name, price: ep, totalSessions: sessions, branchId: defaultBranchId, branchCode: bCode, learningMode: mode }));
        }
      })
      .catch(() => {});
  }, [API, isSuperAdmin, selectedBranchId, branches]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'name') { setForm(f => ({ ...f, name: value.toUpperCase() })); return; }
    
    if (name === 'branchId') {
      const selectedB = branches.find(b => String(b._id) === String(value));
      let mode = form.learningMode;
      if (selectedB && selectedB.name.toLowerCase().includes('online')) {
        mode = 'ONLINE';
      }
      setForm(f => ({ ...f, branchId: value, branchCode: selectedB?.code || '', learningMode: mode }));
      return;
    }

    if (name === 'courseId') {
      const c = dbCourses.find(x => x._id === value);
      if (c) {
        const ep = Math.round(c.price * (1 - (c.discountPercent || 0) / 100));
        const sessions = Number(c.totalSessions) > 0 ? Number(c.totalSessions) : 12;
        setForm(f => ({ ...f, courseId: c._id, course: c.name, price: ep, totalSessions: sessions }));
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
  const pollRef                     = React.useRef(null);
  const timerRef                    = React.useRef(null);

  const [studentCode] = useState(() => `TTH${Date.now().toString().slice(-5)}`);
  const ckContent = useMemo(() => {
    return `${form.name.replace(/\s+/g,'').slice(0,8) || 'HV'} ${studentCode} Nop hoc phi`.trim();
  }, [form.name, studentCode]);

  // Fetch bank + create session khi vào step qr
  useEffect(() => {
    if (step !== 'qr') return;
    setTimeLeft(TOTAL_PAYMENT_SECS);
    setPollStatus('pending');

    // 1) Fetch bank settings (public endpoint)
    fetch(`${API}/api/settings/bank`)
      .then(r => r.json())
      .then(res => { if (res.success) setBankInfo(res.data); })
      .catch(() => {});

    // 2) Create payment session
    const token = (() => { try { return JSON.parse(localStorage.getItem('admin_user') || '{}').token || ''; } catch { return ''; } })();
    const selectedBranch = branches.find(b => String(b._id) === String(form.branchId || (selectedBranchId !== 'all' ? selectedBranchId : '')));
    const branchCode = selectedBranch?.code || '';

    fetch(`${API}/api/webhooks/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        amount: form.price, 
        content: ckContent,
        studentName: form.name,
        courseName: form.course,
        branchCode: branchCode
      }),
    }).then(r => r.json()).then(res => { if (res.sessionId) setSessionId(res.sessionId); }).catch(() => {});

    // Countdown
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => { clearInterval(timerRef.current); clearInterval(pollRef.current); };
  }, [step]);

  // Real-time Socket.io listener
  useEffect(() => {
    if (step !== 'qr' || pollStatus === 'paid' || !socket) return;
    
    const handlePaid = (data) => {
      if (data.sessionId === sessionId || (data.content && data.content.toLowerCase().includes(ckContent.toLowerCase()))) {
        clearInterval(pollRef.current);
        clearInterval(timerRef.current);
        setPollStatus('paid');
        setStep('success'); // Show success screen (blue check)
        
        // Wait 2 seconds before closing and adding student
        setTimeout(() => {
          onAdd({ ...form, age: Number(form.age), id: Date.now(), paid: true, studentCode });
          onClose();
        }, 2500);
      }
    };

    socket.on('tuition:paid', handlePaid);
    return () => socket.off('tuition:paid', handlePaid);
  }, [step, sessionId, pollStatus, socket, ckContent]);

  // Polling mỗi 3s (Fallback)
  useEffect(() => {
    if (step !== 'qr' || pollStatus === 'paid') return;
    const sid = sessionId;
    pollRef.current = setInterval(async () => {
      if (!sid && !ckContent) return;
      try {
        const r = await fetch(`${API}/api/webhooks/payment-status?sessionId=${sid || ''}&content=${encodeURIComponent(ckContent)}`).then(x => x.json());
        if (r.paid || r.status === 'paid') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setPollStatus('paid');
          setStep('success'); // Show success screen
          
          setTimeout(() => {
            onAdd({ ...form, age: Number(form.age), id: Date.now(), paid: true, studentCode });
            onClose(); 
          }, 2500);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [step, sessionId, pollStatus, ckContent]);

  const handleSubmitForm = () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('Vui lòng nhập họ tên và số điện thoại!'); return; }
    if (form.paid) {
      // Paid manually marked — add directly
      onAdd({ ...form, age: Number(form.age), id: Date.now(), paid: true });
      onClose(); return;
    }
    setStep('qr');
  };

  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const qrUrl = bankInfo?.centerBankCode && bankInfo?.centerBankAccountNumber
    ? `https://img.vietqr.io/image/${bankInfo.centerBankCode}-${bankInfo.centerBankAccountNumber}-compact2.png?amount=${form.price}&addInfo=${encodeURIComponent(ckContent)}&accountName=${encodeURIComponent(bankInfo.centerBankAccountName || '')}`
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
                  const shareUrl = `${window.location.origin}/pay/${sessionId}`;
                  navigator.clipboard.writeText(shareUrl);
                  toast.success('Đã copy link thanh toán! Bạn có thể gửi qua Zalo/Facebook cho học viên.');
                }}
                aria-label="Chia sẻ link thanh toán"
                title="Chia sẻ link thanh toán"
                className="cms-sheet-header__side bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                <Share2 size={16} />
              </button>
            ) : (
              <span className="cms-sheet-header__side bg-red-50 text-red-600" aria-hidden="true">
                <CreditCard size={18} />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="cms-sheet-header__title">Quét QR thanh toán</h3>
              <p className="text-center text-[11px] text-slate-500 truncate mt-0.5">
                {form.name} — {form.course?.slice(0, 28)}
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
                <div className="cms-empty__icon text-2xl" aria-hidden="true">⏰</div>
                <p className="cms-empty__title text-red-600">Phiên thanh toán hết hạn</p>
                <p className="cms-empty__desc">Vui lòng thử lại</p>
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

                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-center">
                  <p className="text-xs text-slate-500 font-medium">Số tiền cần thanh toán</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{form.price.toLocaleString('vi-VN')}đ</p>
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
                  Đang kiểm tra thanh toán tự động mỗi 3 giây...
                </div>
              </>
            )}
          </div>

          <div className="cms-sheet-footer">
            {expired ? (
              <button type="button" onClick={() => { setStep('form'); }} className="cms-btn cms-btn-primary">
                Quay lại
              </button>
            ) : (
              <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">
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
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:mt-auto">
                <input type="checkbox" name="paid" checked={form.paid} onChange={handleChange} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-800 leading-tight">Thanh toán tiền mặt</span>
                  <span className="block text-[11px] text-slate-500 leading-tight">HV đã nộp tiền mặt trực tiếp</span>
                </span>
              </label>
            </section>

            <section className="cms-form">
              <div className="cms-step">
                <span className="cms-step__num cms-step__num--muted">2</span>
                <span className="cms-step__label">Đăng ký khóa học</span>
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="cms-label">Cơ sở (chi nhánh)</label>
                  <CmsSelect
                    name="branchId"
                    value={form.branchId || ''}
                    onChange={handleChange}
                    className="cms-input"
                  >
                    <option value="">-- Chọn cơ sở đào tạo --</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </CmsSelect>
                </div>
              )}

              <div>
                <label className="cms-label">Hình thức học</label>
                <div className="cms-chip-grid">
                  <label className={`cms-chip-option ${form.learningMode === 'OFFLINE' ? 'is-on' : ''}`}>
                    <input type="radio" name="learningMode" value="OFFLINE" checked={form.learningMode === 'OFFLINE'} onChange={handleChange} className="sr-only" />
                    Tại cơ sở
                  </label>
                  <label className={`cms-chip-option ${form.learningMode === 'ONLINE' ? 'is-on' : ''}`}>
                    <input type="radio" name="learningMode" value="ONLINE" checked={form.learningMode === 'ONLINE'} onChange={handleChange} className="sr-only" />
                    Online
                  </label>
                </div>
              </div>

              <div>
                <label className="cms-label">Khóa học &amp; học phí</label>
                {dbCourses.length > 0 ? (
                  <CmsSelect name="courseId" value={form.courseId} onChange={handleChange} className="cms-input">
                    {dbCourses.map((c) => {
                      const ep = Math.round(c.price * (1 - (c.discountPercent || 0) / 100));
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
                {form.price > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100 text-[11px] font-bold">
                      <DollarSign size={11} /> {form.price.toLocaleString('vi-VN')}đ
                    </span>
                    <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-lg border border-sky-100 text-[11px] font-bold">
                      {form.totalSessions} buổi
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="cms-label">Giảng viên hướng dẫn</label>
                <CmsSelect name="teacherId" value={form.teacherId} onChange={handleChange} className="cms-input">
                  <option value="">-- Chọn sau (không bắt buộc) --</option>
                  {(teachers || []).filter(Boolean).filter((t) => String(t.status || '').toLowerCase() === 'active').map((t) => (
                    <option key={t.id || t._id} value={t.id || t._id}>
                      {t.name}{t.phone ? ` — ${t.phone}` : ''}
                    </option>
                  ))}
                </CmsSelect>
                {(teachers || []).filter(Boolean).filter((t) => String(t.status || '').toLowerCase() === 'active').length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">Chưa có giảng viên Active để phân công.</p>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="cms-sheet-footer">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">
            Hủy bỏ
          </button>
          <button type="button" onClick={handleSubmitForm} className="cms-btn cms-btn-primary">
            {form.paid
              ? <><CheckCircle2 size={16} /> Hoàn tất đăng ký</>
              : <><CreditCard size={16} /> Quét QR &amp; đăng ký</>}
          </button>
        </div>
      </div>
    </>
  );
}
