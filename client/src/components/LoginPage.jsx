import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Phone, Database, BookOpen, Monitor, Lock, User, KeyRound, X, Copy, Check, Clock, ShieldCheck, MonitorX } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { setTokens, clearOtherRoleSessions, ensureCsrfToken, API_BASE } from '../services/api';
import { unlockAudio } from '../utils/sound';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { isValidVNPhone, isValidEmail, normalizePhone } from '../utils/validators';

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('student');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceConflict, setDeviceConflict] = useState(false); // cảnh báo máy khác
  const pendingLoginRef = useRef(null); // lưu payload để force login
  const [dynamicLogo, setDynamicLogo] = useState('');

  // Hiển thị thông báo nếu bị đăng xuất do không hoạt động
  const inactivityMsg = new URLSearchParams(location.search).get('msg') === 'inactivity';


  // ── Forgot Password State ──
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1=nhập SĐT, 2=nhập OTP
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotRole, setForgotRole] = useState('student');
  const [forgotOTP, setForgotOTP] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [newPasswordResult, setNewPasswordResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const countdownRef = useRef(null);

  const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");

  useEffect(() => {
    fetch(`${API}/api/settings/web`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.logoUrl) {
          const url = res.data.logoUrl;
          setDynamicLogo(url.startsWith('http') ? url : `${API}${url}`);
        }
      }).catch(() => {});
  }, []);

  const doLogin = async (forceDevice = false) => {
    setLoading(true); setError(null);
    const id = normalizePhone(phone);
    if (!id) { setError('Vui lòng nhập tài khoản'); setLoading(false); return; }
    if (id.includes('@')) {
      if (!isValidEmail(id)) { setError('Email không hợp lệ'); setLoading(false); return; }
    } else if (!isValidVNPhone(id)) {
      setError('Số điện thoại không hợp lệ (10 số, bắt đầu 0)'); setLoading(false); return;
    }
    try {
      const fp = getDeviceFingerprint();
      const csrf = await ensureCsrfToken();
      const response = await fetch(`${API_BASE}/auth/login/public`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ identifier: id, password, role, deviceFingerprint: fp, force: forceDevice }),
      });
      const data = await response.json();
      if (response.status === 409 && data.code === 'DEVICE_CONFLICT') {
        // Tài khoản đang dùng ở máy khác → hiện cảnh báo
        pendingLoginRef.current = { phone, password, role };
        setDeviceConflict(true);
        return;
      }
      if (data.success) {
        setDeviceConflict(false);
        const user = data.data.user ? { ...data.data.user } : { ...data.data };
        const accessToken = data.data.accessToken || user.accessToken;
        const refreshToken = data.data.refreshToken || user.refreshToken;
        
        user.accessToken = accessToken;
        user.token = accessToken; // Ensure compatibility with SocketProvider
        user.refreshToken = refreshToken;
        
        if (!user.id && user._id) user.id = user._id;
        clearOtherRoleSessions(role);
        localStorage.setItem(`${role}_user`, JSON.stringify(user));
        setTokens(accessToken, refreshToken, role);
        unlockAudio();
        onLogin(user);
        toast.success(`Chào mừng ${role === 'teacher' ? 'Giảng viên' : 'Học viên'}: ${user.name}!`);
        const teacherHome = role === 'teacher'
          && String(user.status || '').toLowerCase() !== 'active'
          ? '/teacher/test'
          : role === 'teacher'
            ? '/teacher'
            : '/student';
        navigate(teacherHome);
      } else {
        setError(data.message || 'Số điện thoại hoặc mật khẩu không đúng');
      }
    } catch { setError('Không thể kết nối đến máy chủ'); }
    finally { setLoading(false); }
  };

  const handleLogin = (e) => { e.preventDefault(); doLogin(false); };
  const handleForceLogin = () => { setDeviceConflict(false); doLogin(true); };

  // Bước 1: Kiểm tra SĐT tồn tại → chuyển sang nhập OTP
  const handleCheckPhone = async () => {
    const p = normalizePhone(forgotPhone);
    if (!p) { setForgotError('Vui lòng nhập số điện thoại'); return; }
    if (!isValidVNPhone(p)) { setForgotError('Số điện thoại không hợp lệ'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      // Gọi forgot-password/request để kiểm tra phone tồn tại (OTP sinh bởi admin)
      // Ở đây chỉ cần check xem số này có trong DB không
      const csrf = await ensureCsrfToken();
      const res = await fetch(`${API_BASE}/auth/forgot-password/request`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ phone: forgotPhone.trim(), role: forgotRole }),
      });
      const data = await res.json();
      // Dù thành công hay lỗi "không tìm thấy", ta vẫn xử lý
      if (data.success || data.message?.includes('gửi mã OTP')) {
        setForgotStep(2);
        setOtpCountdown(120);
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setOtpCountdown(prev => { if (prev <= 1) { clearInterval(countdownRef.current); return 0; } return prev - 1; });
        }, 1000);
      } else if (data.message?.includes('không tìm thấy') || data.message?.includes('Không tìm thấy')) {
        setForgotError('Số điện thoại chưa được đăng ký trong hệ thống.');
      } else {
        // Vẫn cho sang bước 2 (không lộ thông tin user)
        setForgotStep(2);
        setOtpCountdown(120);
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setOtpCountdown(prev => { if (prev <= 1) { clearInterval(countdownRef.current); return 0; } return prev - 1; });
        }, 1000);
      }
    } catch { setForgotError('Lỗi kết nối máy chủ'); }
    finally { setForgotLoading(false); }
  };

  // Bước 2: Xác minh OTP → nhận mật khẩu mới
  const handleVerifyOTP = async () => {
    if (forgotOTP.trim().length !== 6) { setForgotError('Mã OTP gồm 6 chữ số'); return; }
    if (otpCountdown === 0) { setForgotError('Mã OTP đã hết hạn. Liên hệ Admin để cấp lại.'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const csrf = await ensureCsrfToken();
      const res = await fetch(`${API_BASE}/auth/forgot-password/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ phone: forgotPhone.trim(), otp: forgotOTP.trim(), role: forgotRole }),
      });
      const data = await res.json();
      if (data.success) {
        clearInterval(countdownRef.current);
        const pw = String(
          data.data?.newPassword
          || data.data?.tempPassword
          || data.data?.password
          || data.newPassword
          || '',
        ).trim();
        setNewPasswordResult({
          password: pw,
          name: data.data?.name || forgotPhone.trim(),
          phone: data.data?.phone || forgotPhone.trim(),
        });
        if (!pw) {
          toast.error('Không nhận được mật khẩu mới từ máy chủ — thử lại hoặc liên hệ Admin');
        } else {
          toast.success('Xác minh thành công!');
        }
      } else {
        setForgotError(data.message || 'Mã OTP không đúng hoặc đã hết hạn');
      }
    } catch { setForgotError('Lỗi kết nối máy chủ'); }
    finally { setForgotLoading(false); }
  };

  const closeForgotModal = () => {
    clearInterval(countdownRef.current);
    setShowForgot(false); setForgotStep(1); setForgotPhone('');
    setForgotOTP(''); setForgotError(''); setNewPasswordResult(null);
    setCopied(false); setOtpCountdown(0);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0f172a] flex items-center justify-center p-0 font-sans overflow-x-clip overflow-y-auto">
      <div className="w-full min-h-[100dvh] md:h-[100dvh] flex flex-col md:flex-row shadow-2xl overflow-x-clip md:overflow-hidden">

        {/* CỘT TRÁI */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-b from-[#1e293b] to-[#0f172a] p-10 lg:p-16 flex-col justify-center relative min-w-0">
          <div className="absolute top-10 left-10">
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
               <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Hệ thống quản lý trực tuyến</span>
            </div>
          </div>
          <div className="relative z-10 space-y-8 animate-in fade-in slide-in-from-left-10 duration-1000">
            <h1 className="text-display font-black text-white break-anywhere">
              Nền tảng <span className="text-red-500 block md:inline">Học Tin Học</span> <br />Văn Phòng Chuyên Nghiệp
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-lg">Tổ chức đào tạo, thi cử và cấp chứng nhận tin học văn phòng với công nghệ hiện đại.</p>
            <div className="flex flex-wrap gap-4 pt-4">
              {[{ label: 'Word', icon: BookOpen }, { label: 'Excel', icon: Database }, { label: 'PowerPoint', icon: Monitor }].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl hover:bg-white/10 transition-all cursor-default group">
                  <item.icon size={18} className="text-red-500 group-hover:scale-110 transition-transform" aria-hidden="true" />
                  <span className="text-sm font-bold text-gray-200">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-red-600/10 rounded-full blur-[120px]" aria-hidden="true" />
        </div>

        {/* CỘT PHẢI */}
        <div className="w-full md:w-1/2 flex items-center justify-center px-[15px] py-8 sm:p-8 lg:p-20 relative bg-[#0f172a] min-w-0 overflow-y-auto">
          <div className="w-full max-w-md space-y-8 sm:space-y-10 z-10">
            <div className="text-center md:text-left flex flex-col items-center md:items-start animate-in fade-in zoom-in duration-700">
              <img src={dynamicLogo || "/logo-thang-tin-hoc.svg"} alt="Thắng Tin Học" className="h-14 sm:h-16 mb-6 sm:mb-8 max-w-[min(100%,220px)] brightness-110 object-contain" />
              <div className="space-y-4 w-full">
                <div className="inline-flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-2 max-w-full" role="tablist" aria-label="Chọn vai trò đăng nhập">
                  <button type="button" role="tab" aria-selected={role === 'student'} onClick={() => setRole('student')} className={`px-4 xs:px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${role === 'student' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Học viên</button>
                  <button type="button" role="tab" aria-selected={role === 'teacher'} onClick={() => setRole('teacher')} className={`px-4 xs:px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${role === 'teacher' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Giảng viên</button>
                </div>
                <h2 className="text-fluid-2xl font-black text-white">Đăng nhập tài khoản</h2>
                <p className="text-slate-400 font-medium">Chào mừng trở lại! Vui lòng nhập thông tin của bạn.</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200" noValidate>
              {inactivityMsg && (
                <div role="status" className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3 text-amber-300 text-sm font-bold">
                  <Clock size={18} aria-hidden="true" /> Phiên làm việc đã hết hạn do không hoạt động. Vui lòng đăng nhập lại.
                </div>
              )}
              {error && <div role="alert" className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 text-sm font-bold"><AlertCircle size={18} aria-hidden="true" /> {error}</div>}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="login-identifier" className="text-xs font-bold text-slate-400 block ml-1">{role === 'student' ? 'SỐ ĐIỆN THOẠI HOẶC EMAIL' : 'TÀI KHOẢN GIẢNG VIÊN'}</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-slate-400 group-focus-within:text-red-500 transition-colors" aria-hidden="true" /></div>
                    <input id="login-identifier" type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="username"
                      className="w-full bg-[#1e293b]/50 border-2 border-white/10 rounded-2xl pl-11 pr-5 py-4 text-white outline-none focus:border-red-600 focus:bg-[#1e293b] transition-all font-bold placeholder:text-slate-400"
                      placeholder="Nhập thông tin tài khoản..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="text-xs font-bold text-slate-400 block ml-1">MẬT KHẨU</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock size={18} className="text-slate-400 group-focus-within:text-red-500 transition-colors" aria-hidden="true" /></div>
                    <input id="login-password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                      className="w-full bg-[#1e293b]/50 border-2 border-white/10 rounded-2xl pl-11 pr-12 py-4 text-white outline-none focus:border-red-600 focus:bg-[#1e293b] transition-all font-bold placeholder:text-slate-400"
                      placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white transition-colors">
                      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end -mt-2">
                <button type="button" onClick={() => { setShowForgot(true); setForgotRole(role); setForgotStep(1); }}
                  className="text-xs font-bold text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1">
                  <KeyRound size={12} aria-hidden="true" /> Quên mật khẩu?
                </button>
              </div>
              <button type="submit" disabled={loading}
                className="w-full btn-primary rounded-2xl py-4 font-black uppercase tracking-[0.1em] shadow-xl shadow-red-900/20 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-70 flex items-center justify-center gap-3">
                {loading ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" /> : 'Đăng nhập ngay'}
              </button>
            </form>

            <div className="text-center pt-8 animate-in fade-in duration-1000 delay-500">
              <p className="text-slate-400 text-sm font-medium">Chưa có tài khoản? <button type="button" onClick={() => window.open('https://zalo.me/0935758462', '_blank', 'noopener,noreferrer')} className="text-white font-black hover:text-red-500 transition-colors ml-1">Liên hệ Admin</button></p>
              <div className="mt-10 flex flex-col items-center gap-2">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Hỗ trợ kỹ thuật</p>
                <p className="text-xs font-bold text-slate-400">Hotline: 093 5758 462</p>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-[120px]" aria-hidden="true" />
        </div>
      </div>

      {/* ═══ MODAL: QUÊN MẬT KHẨU ═══ */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] rounded-3xl w-full max-w-md border border-white/10 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><KeyRound size={20} className="text-white" /></div>
                <div>
                  <h3 className="text-white font-black text-lg">Quên mật khẩu</h3>
                  <p className="text-white/70 text-xs font-medium">
                    {!newPasswordResult && forgotStep === 1 && 'Bước 1: Nhập số điện thoại'}
                    {!newPasswordResult && forgotStep === 2 && 'Bước 2: Nhập mã OTP từ Admin'}
                    {newPasswordResult && 'Đặt lại mật khẩu thành công!'}
                  </p>
                </div>
              </div>
              <button onClick={closeForgotModal} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition"><X size={16} className="text-white" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* BƯỚC 1: Nhập SĐT */}
              {!newPasswordResult && forgotStep === 1 && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Vai trò</label>
                    <div className="flex gap-2">
                      <button onClick={() => setForgotRole('student')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border-2 ${forgotRole === 'student' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>Học viên</button>
                      <button onClick={() => setForgotRole('teacher')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border-2 ${forgotRole === 'teacher' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>Giảng viên</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Số điện thoại đăng ký</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input type="text" value={forgotPhone} onChange={e => setForgotPhone(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCheckPhone()}
                        className="w-full bg-[#0f172a] border-2 border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm font-bold outline-none focus:border-red-500 transition placeholder:text-slate-400"
                        placeholder="VD: 0935758462" />
                    </div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-amber-400 text-xs font-bold">
                      💡 Sau khi xác nhận, liên hệ Admin để nhận mã OTP qua Zalo. Mã có hiệu lực <strong>2 phút</strong>.
                    </p>
                  </div>
                  {forgotError && <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 text-red-400 text-sm font-bold"><AlertCircle size={14} /> {forgotError}</div>}
                  <button onClick={handleCheckPhone} disabled={forgotLoading}
                    className="w-full py-3.5 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black rounded-xl uppercase tracking-wider text-sm hover:from-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {forgotLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Phone size={16} /> Tiếp tục</>}
                  </button>
                </>
              )}

              {/* BƯỚC 2: Nhập OTP */}
              {!newPasswordResult && forgotStep === 2 && (
                <>
                  {/* Countdown */}
                  <div className="text-center">
                    <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-xl ${otpCountdown > 30 ? 'bg-emerald-500/10 text-emerald-400' : otpCountdown > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                      <Clock size={20} />
                      {otpCountdown > 0 ? `${Math.floor(otpCountdown/60)}:${String(otpCountdown%60).padStart(2,'0')}` : 'Hết hạn'}
                    </div>
                    <p className="text-gray-300 text-sm font-bold mt-3">Nhập mã OTP từ Admin gửi qua Zalo</p>
                    <p className="text-gray-500 text-xs mt-1">SĐT: <strong className="text-white">{forgotPhone}</strong></p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1.5 text-center">Mã OTP (6 chữ số)</label>
                    <input
                      type="text" maxLength={6} value={forgotOTP}
                      onChange={e => setForgotOTP(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
                      autoFocus
                      className="w-full bg-[#0f172a] border-2 border-white/10 rounded-xl px-4 py-4 text-white text-3xl font-black outline-none focus:border-red-500 transition text-center tracking-[0.5em] font-mono"
                      placeholder="______"
                      disabled={otpCountdown === 0}
                    />
                  </div>

                  {forgotError && <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 text-red-400 text-sm font-bold"><AlertCircle size={14} /> {forgotError}</div>}

                  <div className="flex gap-3">
                    <button onClick={() => { setForgotStep(1); setForgotError(''); setForgotOTP(''); clearInterval(countdownRef.current); }}
                      className="flex-1 py-3 border-2 border-white/10 text-gray-400 font-bold rounded-xl hover:border-white/20 transition">← Quay lại</button>
                    <button onClick={handleVerifyOTP} disabled={forgotLoading || forgotOTP.length !== 6 || otpCountdown === 0}
                      className="flex-[2] py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black rounded-xl hover:from-red-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                      {forgotLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ShieldCheck size={16} /> Xác minh OTP</>}
                    </button>
                  </div>

                  {otpCountdown === 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                      <p className="text-red-400 text-xs font-bold">⏰ OTP đã hết hạn. Liên hệ Admin để được cấp mã OTP mới.</p>
                    </div>
                  )}
                </>
              )}

              {/* KẾT QUẢ: Mật khẩu mới */}
              {newPasswordResult && (
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto"><CheckCircle2 size={32} className="text-emerald-400" /></div>
                  <div>
                    <p className="text-white font-bold text-lg">Đặt lại mật khẩu thành công!</p>
                    <p className="text-gray-400 text-sm mt-1">Tài khoản: <strong className="text-white">{newPasswordResult.name || newPasswordResult.phone}</strong></p>
                  </div>
                  <div className="bg-[#0f172a] border-2 border-emerald-500/40 rounded-2xl p-5 relative z-10 space-y-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mật khẩu mới</p>
                    {newPasswordResult.password ? (
                      <p
                        className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-[0.35em] font-mono select-all break-all"
                        aria-live="polite"
                      >
                        {newPasswordResult.password}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-red-400">Không nhận được mật khẩu — đóng và thử lại.</p>
                    )}
                    <button
                      type="button"
                      disabled={!newPasswordResult.password}
                      onClick={() => {
                        const pw = newPasswordResult.password;
                        if (!pw) {
                          toast.error('Chưa có mật khẩu để sao chép');
                          return;
                        }
                        navigator.clipboard.writeText(pw).then(() => {
                          setCopied(true);
                          toast.success('Đã sao chép mật khẩu!');
                          setTimeout(() => setCopied(false), 2000);
                        }).catch(() => toast.error('Không sao chép được — hãy bôi đen mật khẩu và Ctrl+C'));
                      }}
                      className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-40 ${
                        copied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25'
                      }`}
                      aria-label="Sao chép mật khẩu mới"
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                      {copied ? 'Đã sao chép' : 'Sao chép mật khẩu'}
                    </button>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-amber-400 text-xs font-bold">⚠️ Hãy copy mã này, đăng nhập rồi đổi mật khẩu ngay.</p>
                  </div>
                  <button onClick={closeForgotModal} className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition">Đóng & Đăng nhập</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DIALOG: CẢNH BÁO THIẾT BỊ KHÁC ═══ */}
      {deviceConflict && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] rounded-3xl w-full max-w-sm border border-amber-500/30 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <MonitorX size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-black text-lg">Phát hiện đăng nhập khác</h3>
                <p className="text-white/70 text-xs font-medium">Tài khoản đang hoạt động trên thiết bị khác</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-amber-300 text-sm font-bold leading-relaxed">
                  ⚠️ Tài khoản <strong className="text-white">{phone}</strong> hiện đang đăng nhập trên một máy tính khác.
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Nếu bạn tiếp tục, phiên đăng nhập trên máy kia sẽ bị đăng xuất ngay lập tức.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeviceConflict(false); pendingLoginRef.current = null; }}
                  className="flex-1 py-3 border-2 border-white/10 text-gray-400 font-bold rounded-xl hover:border-white/20 transition text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleForceLogin}
                  disabled={loading}
                  className="flex-[2] py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl hover:from-amber-600 disabled:opacity-50 transition text-sm flex items-center justify-center gap-2"
                >
                  {loading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><MonitorX size={15} /> Đăng nhập, đăng xuất máy kia</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
