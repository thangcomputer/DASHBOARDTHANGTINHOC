import React, { useState, useEffect, useMemo } from 'react';
import {
  X, CheckCircle2, CreditCard, AlertCircle, MapPin, Loader2,
  Plus, Share2, DollarSign,
} from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';
import { useSocket } from '../../../context/SocketContext';
import { apiFetch } from '../../../services/api';

export default function AddStudentModal({ onAdd, onClose, teachers }) {
  const toast    = useToast();
  const API = import.meta.env.VITE_API_URL || "";
  const TOTAL_PAYMENT_SECS = 900; // 15 phút

  const { isSuperAdmin, branches, selectedBranchId } = useBranch();
  const { socket } = useSocket();

  // ── Step: 'form' | 'qr' | 'success' ─────────────────────────────────────
  const [step, setStep] = useState('form');

  // ── Form state ────────────────────────────────────────────────────────────
  const [dbCourses, setDbCourses] = useState([]);
  const [form, setForm] = useState({
    name: '', age: '', phone: '', zalo: '',
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
          setForm(f => ({ ...f, courseId: first._id, course: first.name, price: ep, totalSessions: 12, branchId: defaultBranchId, branchCode: bCode, learningMode: mode }));
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
        setForm(f => ({ ...f, courseId: c._id, course: c.name, price: ep }));
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

  // Mã ngắn ASCII — ngân hàng hay cắt/bỏ dấu nội dung CK dài
  const [studentCode] = useState(() => `TTH${Date.now().toString().slice(-6)}`);
  const ckContent = useMemo(() => studentCode, [studentCode]);

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

    // 2) Tạo payment session — luôn gửi kèm Authorization nếu có
    const selectedBranch = branches.find(b => String(b._id) === String(form.branchId || (selectedBranchId !== 'all' ? selectedBranchId : '')));
    const branchCode = selectedBranch?.code || '';

    const createBody = {
      amount: form.price,
      content: ckContent,
      studentName: form.name,
      courseName: form.course,
      branchCode: branchCode,
    };

    const tryCreate = () =>
      apiFetch('/webhooks/create-session', {
        method: 'POST',
        body: JSON.stringify(createBody),
      }).then(async (r) => {
        const res = await r.json().catch(() => ({}));
        if (!r.ok || !res.sessionId) {
          throw new Error(res.message || `HTTP ${r.status}`);
        }
        return res;
      });

    tryCreate()
      .then((res) => setSessionId(res.sessionId))
      .catch(async (err1) => {
        // Fallback raw fetch (tránh lỗi token/CSRF làm mất session)
        try {
          const r = await fetch(`${API}/api/webhooks/create-session`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createBody),
          });
          const res = await r.json().catch(() => ({}));
          if (res.sessionId) setSessionId(res.sessionId);
          else toast.error(res.message || err1.message || 'Không tạo được phiên thanh toán');
        } catch {
          toast.error('Không tạo được phiên thanh toán — tải lại trang');
        }
      });

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
    
    const handlePaid = async () => {
      try {
        const qs = new URLSearchParams();
        if (sessionId) qs.set('sessionId', sessionId);
        if (ckContent) qs.set('content', ckContent);
        const r = await fetch(`${API}/api/webhooks/payment-status?${qs}`).then((x) => x.json());
        if (!(r.paid || r.status === 'paid')) return;
      } catch {
        return;
      }
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
      setPollStatus('paid');
      setStep('success');
      setTimeout(() => {
        onAdd({ ...form, age: Number(form.age), id: Date.now(), paid: true, studentCode });
        onClose();
      }, 2500);
    };

    socket.on('tuition:paid', handlePaid);
    return () => socket.off('tuition:paid', handlePaid);
  }, [step, sessionId, pollStatus, socket, ckContent]);

  // Polling mỗi 3s (Fallback) — luôn gửi content/TTH để tìm session kể cả khi chưa có sessionId
  useEffect(() => {
    if (step !== 'qr' || pollStatus === 'paid') return;
    const sid = sessionId;
    const code = ckContent;
    const tick = async () => {
      if (!sid && !code) return;
      try {
        const qs = new URLSearchParams();
        if (sid) qs.set('sessionId', sid);
        if (code) qs.set('content', code);
        const r = await fetch(`${API}/api/webhooks/payment-status?${qs}`).then((x) => x.json());
        if (r.paid || r.status === 'paid') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setPollStatus('paid');
          setStep('success');
          setTimeout(() => {
            onAdd({ ...form, age: Number(form.age), id: Date.now(), paid: true, studentCode });
            onClose();
          }, 2500);
        }
      } catch { /* ignore */ }
    };
    tick(); // check ngay, không đợi 3s
    pollRef.current = setInterval(tick, 3000);
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
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" style={{ backdropFilter: 'blur(8px)' }}>
        <div className="bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center gap-4 w-72">
          <div className="relative w-20 h-20">
            {/* Spinner ring */}
            <svg className="animate-spin absolute inset-0" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" stroke="#22c55e" strokeWidth="6" strokeDasharray="200" strokeDashoffset="50" strokeLinecap="round" />
            </svg>
            {/* Checkmark */}
            <div className="absolute inset-0 flex items-center justify-center">
              <CheckCircle2 size={44} className="text-emerald-500 animate-bounce" />
            </div>
          </div>
          <p className="text-lg font-black text-emerald-700">Thanh toán thành công!</p>
          <p className="text-xs text-gray-400 text-center">Đã đăng ký học viên<br /><strong>{form.name}</strong></p>
        </div>
      </div>
    );
  }

  // ── STEP: QR payment ─────────────────────────────────────────────────────
  if (step === 'qr') {
    const expired = timeLeft === 0;
    const pct     = (timeLeft / TOTAL_PAYMENT_SECS) * 100;
    const isUrgent = timeLeft < 60;

    return (
      <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-[9999] p-4" style={{ backdropFilter: 'blur(8px)' }}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-500 px-5 py-4 text-white flex items-center justify-between">
            <div>
              <p className="font-black text-base">💳 Quét QR Thanh Toán</p>
              <p className="text-xs opacity-80">{form.name} — {form.course?.slice(0,25)}</p>
            </div>
            <div className="flex items-center gap-2">
              {sessionId && (
                <button 
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/pay/${sessionId}`;
                    navigator.clipboard.writeText(shareUrl);
                    toast.success('Đã copy link thanh toán! Bạn có thể gửi qua Zalo/Facebook cho học viên.');
                  }}
                  className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition"
                  title="Chia sẻ link thanh toán"
                >
                  <Share2 size={14} />
                </button>
              )}
              <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {expired ? (
              <div className="text-center py-8 space-y-3">
                <div className="text-5xl">⏰</div>
                <p className="font-black text-red-600 text-lg">Phiên thanh toán hết hạn</p>
                <p className="text-sm text-gray-400">Vui lòng thử lại</p>
                <button onClick={() => { setStep('form'); }} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition">
                  Quay lại
                </button>
              </div>
            ) : (
              <>
                {/* Countdown bar */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className={isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-500'}>⏱ Còn lại</span>
                    <span className={`font-mono font-black ${isUrgent ? 'text-red-500' : 'text-gray-700'}`}>{formatTime(timeLeft)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Amount */}
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 text-center">
                  <p className="text-xs text-gray-500 font-medium">Số tiền cần thanh toán</p>
                  <p className="text-2xl font-black text-red-600">{form.price.toLocaleString('vi-VN')}đ</p>
                </div>

                {/* QR Code */}
                {qrUrl ? (
                  <div className="flex justify-center">
                    <div className="border-4 border-emerald-400 rounded-2xl p-2 shadow-lg shadow-emerald-100">
                      <img src={qrUrl} alt="VietQR" className="w-44 h-44 object-contain rounded-xl" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                    <Loader2 size={20} className="animate-spin" /> Đang tải mã QR...
                  </div>
                )}

                {/* Transfer content */}
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-0.5">Nội dung chuyển khoản</p>
                  <p className="font-mono font-bold text-gray-800 text-sm">{ckContent}</p>
                </div>

                {/* Polling indicator */}
                <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
                  <Loader2 size={12} className="animate-spin text-emerald-500" />
                  Đang kiểm tra thanh toán tự động mỗi 3 giây...
                </div>

                <button onClick={onClose} className="w-full py-2 border-2 border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
                  Đóng (thanh toán sau)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: form (Tái cấu trúc UI lưới 2 cột) ─────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#dc2626] to-[#991b1b] px-8 py-6 flex items-center justify-between">
          <h3 className="text-white font-black text-2xl flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md">
              <Plus size={28} />
            </div>
            Thêm Học Viên Mới
          </h3>
          <button onClick={onClose} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Body Lưới 2 cột */}
        <div className="p-10 max-h-[75vh] overflow-y-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Cột Trái: Thông tin Cá nhân */}
            <div className="space-y-6 md:border-r border-gray-100 md:pr-10">
              <h4 className="font-black text-gray-400 text-xs mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                <span className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center text-xs shadow-lg shadow-red-200">1</span>
                Thông tin Cá nhân
              </h4>
              
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Họ tên học viên <span className="text-red-500">*</span></label>
                <input name="name" value={form.name} onChange={handleChange} className="w-full bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-[20px] p-4 uppercase font-black text-gray-800 outline-none transition-all shadow-sm" placeholder="VD: NGUYỄN VĂN A" />
              </div>
              
              <div className="flex gap-3 items-end">
                <div style={{width: '100px', flexShrink: 0}}>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Tuổi</label>
                  <input name="age" type="number" value={form.age} onChange={handleChange} className="w-full bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-[20px] px-3 py-4 font-bold text-gray-800 outline-none transition-all shadow-sm text-center" placeholder="20" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Số điện thoại / Zalo <span className="text-red-500">*</span></label>
                  <input name="phone" value={form.phone} onChange={handleChange} className="w-full bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-[20px] p-4 font-black text-gray-800 outline-none transition-all shadow-sm font-mono" placeholder="0911222333" />
                </div>
              </div>
            </div>

            {/* Cột Phải: Thông tin Khóa học */}
            <div className="space-y-6 md:pl-2">
              <h4 className="font-black text-gray-400 text-xs mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs shadow-lg shadow-slate-200">2</span>
                Đăng ký Khóa học
              </h4>

              {/* Step: Branch Selection (If SuperAdmin) */}
              {isSuperAdmin && (
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Cơ sở (Chi nhánh)</label>
                <select name="branchId" value={form.branchId || ''} onChange={handleChange} className="w-full bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-[20px] p-4 font-black text-gray-800 outline-none transition-all shadow-sm appearance-none cursor-pointer">
                  <option value="">-- Chọn cơ sở đào tạo --</option>
                  {branches.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
              )}

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-3">Hình thức học</label>
                <div className="flex gap-4">
                  <label className={`flex items-center gap-3 cursor-pointer border-2 p-4 rounded-2xl transition-all flex-1 ${form.learningMode === 'OFFLINE' ? 'border-red-600 bg-red-50 shadow-md shadow-red-100' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'}`}>
                    <input type="radio" name="learningMode" value="OFFLINE" checked={form.learningMode === 'OFFLINE'} onChange={handleChange} className="hidden" />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.learningMode === 'OFFLINE' ? 'border-red-600' : 'border-gray-300'}`}>
                       {form.learningMode === 'OFFLINE' && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                    </div>
                    <span className="font-black uppercase text-xs">🏢 Tại cơ sở</span>
                  </label>
                  <label className={`flex items-center gap-3 cursor-pointer border-2 p-4 rounded-2xl transition-all flex-1 ${form.learningMode === 'ONLINE' ? 'border-red-600 bg-red-50 shadow-md shadow-red-100' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'}`}>
                    <input type="radio" name="learningMode" value="ONLINE" checked={form.learningMode === 'ONLINE'} onChange={handleChange} className="hidden" />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.learningMode === 'ONLINE' ? 'border-red-600' : 'border-gray-300'}`}>
                       {form.learningMode === 'ONLINE' && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                    </div>
                    <span className="font-black uppercase text-xs">🌐 Online</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Khóa học & Học phí</label>
                {dbCourses.length > 0 ? (
                  <select name="courseId" value={form.courseId} onChange={handleChange} className="w-full bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-[20px] p-4 font-black text-gray-800 outline-none transition-all shadow-sm cursor-pointer">
                    {dbCourses.map(c => {
                      const ep = Math.round(c.price * (1 - (c.discountPercent || 0) / 100));
                      return <option key={c._id} value={c._id}>{c.name} — {ep.toLocaleString('vi-VN')}đ</option>;
                    })}
                  </select>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-[20px] text-gray-400 text-xs font-bold animate-pulse">Đang tải dữ liệu khóa học...</div>
                )}
                {form.price > 0 && (
                  <div className="mt-3 flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 inline-flex shadow-sm">
                    <DollarSign size={14} className="font-black" />
                    <span className="text-xs font-black">HỌC PHÍ THỰC THU: {form.price.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Giảng viên hướng dẫn</label>
                <select name="teacherId" value={form.teacherId} onChange={handleChange} className="w-full bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-[20px] p-4 font-black text-gray-800 outline-none transition-all shadow-sm cursor-pointer">
                  <option value="">-- Chọn sau (Không bắt buộc) --</option>
                  {(teachers || []).filter(Boolean).filter(t => String(t.status || '').toLowerCase() === 'active').map(t => (
                    <option key={t.id || t._id} value={t.id || t._id}>{t.name}{t.phone ? ` — ${t.phone}` : ''}</option>
                  ))}
                </select>
                {(teachers || []).filter(Boolean).filter(t => String(t.status || '').toLowerCase() === 'active').length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Chưa có giảng viên chính thức (Active) để phân công.</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer: Bottom actions */}
          <div className="mt-12 pt-10 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6 bg-gray-50/50 -mx-10 -mb-10 px-10 pb-10 pt-8 rounded-b-[40px]">
            <label className="flex items-center gap-4 cursor-pointer select-none group">
              <div className="relative">
                <input type="checkbox" name="paid" checked={form.paid} onChange={handleChange} className="peer hidden" />
                <div className="w-7 h-7 bg-white rounded-lg border-2 border-gray-200 peer-checked:bg-red-600 peer-checked:border-red-600 transition-all flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={16} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
              </div>
              <div>
                <span className="text-sm font-black text-gray-800 block uppercase tracking-tight group-hover:text-red-600 transition-colors">Thanh toán tiền mặt</span>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Học sinh đã nộp tiền mặt trực tiếp</p>
              </div>
            </label>

            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={onClose} 
                className="px-10 py-4 bg-white border-2 border-gray-100 rounded-[22px] text-xs font-black text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
              >
                HỦY BỎ
              </button>
              <button 
                onClick={handleSubmitForm} 
                className="flex-1 md:flex-none px-12 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-[22px] text-xs font-black tracking-widest shadow-xl shadow-red-200 hover:shadow-red-500/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 uppercase active:scale-95"
              >
                {form.paid ? <><CheckCircle2 size={18} /> HOÀN TẤT ĐĂNG KÝ</> : <><CreditCard size={18} /> QUÉT MÃ QR & ĐĂNG KÝ</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
