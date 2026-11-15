import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Globe, KeyRound, Laptop, Loader2, LogOut, Mail,
  MessageSquare, RefreshCw, Search, ShieldAlert, ShieldCheck, Smartphone,
  Tablet, Trash2,
} from 'lucide-react';
import { authAPI } from '../../../services/api';
import { useToast } from '../../../utils/useToast';

const ROLE_LABELS = {
  admin: { label: 'Quản trị viên', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  staff: { label: 'Nhân viên', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  teacher: { label: 'Giảng viên', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  student: { label: 'Học viên', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function DeviceIcon({ deviceType, clientType }) {
  if (clientType === 'mobile' || deviceType === 'mobile') return <Smartphone size={18} />;
  if (deviceType === 'tablet') return <Tablet size={18} />;
  return <Laptop size={18} />;
}

export default function AdminDeviceSecurityTab() {
  const toast = useToast();
  const [sessionsData, setSessionsData] = useState({ items: [], stats: {}, scope: 'all' });
  const [scope, setScope] = useState('all');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState('');
  const [revokingOthers, setRevokingOthers] = useState(false);

  // 2FA OTP Zalo / Email state
  const [otpConfig, setOtpConfig] = useState(null);
  const [channel, setChannel] = useState('both');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [setupMeta, setSetupMeta] = useState(null);
  const [sendingSetupOtp, setSendingSetupOtp] = useState(false);
  const [verifyingSetupOtp, setVerifyingSetupOtp] = useState(false);
  const [disablePw, setDisablePw] = useState('');
  const [showDisableBox, setShowDisableBox] = useState(false);
  const [disablingOtp, setDisablingOtp] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await authAPI.deviceSessions({ scope, role: roleFilter, status: statusFilter, search });
      if (res?.success) {
        setSessionsData(res.data || { items: [], stats: {} });
      }
    } catch {
      toast.error('Không tải được danh sách thiết bị đang đăng nhập');
    } finally {
      setLoadingSessions(false);
    }
  }, [scope, roleFilter, statusFilter, search, toast]);

  const loadOtpConfig = useCallback(async () => {
    try {
      const res = await authAPI.otp2faConfig();
      if (res?.success && res.data) {
        setOtpConfig(res.data);
        setChannel(res.data.channel || 'both');
        setPhoneInput((prev) => prev || res.data.phone || '');
        setEmailInput((prev) => prev || res.data.email || '');
      }
    } catch {
      // ignore if user role cannot access
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadOtpConfig();
  }, [loadOtpConfig]);

  const handleRevokeSession = async (sessionItem) => {
    const label = `${sessionItem.userName} (${sessionItem.deviceLabel || sessionItem.clientType})`;
    if (!(await window.cmsConfirm(`Đăng xuất từ xa thiết bị "${label}"?\nPhiên này sẽ bị thu hồi ngay lập tức.`))) {
      return;
    }
    setRevokingId(sessionItem.sessionId);
    try {
      const res = await authAPI.revokeDeviceSession(sessionItem.sessionId, sessionItem.clientType);
      if (res?.success) {
        toast.success('Đã đăng xuất thiết bị từ xa');
        loadSessions();
      } else {
        toast.error(res?.message || 'Không thể thu hồi phiên');
      }
    } catch {
      toast.error('Lỗi kết nối khi đăng xuất thiết bị');
    } finally {
      setRevokingId('');
    }
  };

  const handleRevokeOthers = async () => {
    const targetLabel = scope === 'all'
      ? 'tất cả thiết bị khác trên toàn hệ thống (ngoại trừ phiên bạn đang dùng)'
      : 'tất cả thiết bị khác của tài khoản bạn';
    if (!(await window.cmsConfirm(`Xác nhận đăng xuất từ xa ${targetLabel}?`))) return;

    setRevokingOthers(true);
    try {
      const res = await authAPI.revokeOtherDeviceSessions(scope);
      if (res?.success) {
        toast.success(res.message || 'Đã đăng xuất các thiết bị khác');
        loadSessions();
      } else {
        toast.error(res?.message || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setRevokingOthers(false);
    }
  };

  const handleSendSetupOtp = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setSendingSetupOtp(true);
    try {
      const res = await authAPI.otp2faSetupSend({ channel, phone: phoneInput.trim(), email: emailInput.trim() });
      if (res?.success && res.data?.setupToken) {
        setSetupToken(res.data.setupToken);
        setSetupMeta(res.data);
        setOtpCode('');
        toast.success(
          res.data.deliveryOk
            ? `Đã gửi mã OTP qua ${res.data.sentVia.join(' & ').toUpperCase()}`
            : 'Đã tạo mã OTP xác nhận (kiểm tra Zalo OA / Email hoặc log server nếu ở dev)',
        );
      } else {
        toast.error(res?.message || 'Không gửi được OTP xác nhận');
      }
    } catch {
      toast.error('Lỗi kết nối khi gửi OTP');
    } finally {
      setSendingSetupOtp(false);
    }
  };

  const handleVerifySetupOtp = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!otpCode.trim() || !setupToken) return;
    setVerifyingSetupOtp(true);
    try {
      const res = await authAPI.otp2faSetupVerify({ setupToken, code: otpCode.trim() });
      if (res?.success) {
        toast.success(res.message || 'Đã bật xác thực 2 lớp OTP Zalo/Email');
        setSetupToken('');
        setSetupMeta(null);
        setOtpCode('');
        loadOtpConfig();
      } else {
        toast.error(res?.message || 'Mã OTP không đúng');
      }
    } catch {
      toast.error('Lỗi xác thực OTP');
    } finally {
      setVerifyingSetupOtp(false);
    }
  };

  const handleDisableOtp2fa = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!disablePw) {
      toast.error('Nhập mật khẩu hiện tại để tắt 2FA OTP');
      return;
    }
    setDisablingOtp(true);
    try {
      const res = await authAPI.otp2faDisable(disablePw);
      if (res?.success) {
        toast.success('Đã tắt 2FA OTP Zalo/Email');
        setDisablePw('');
        setShowDisableBox(false);
        loadOtpConfig();
      } else {
        toast.error(res?.message || 'Mật khẩu không đúng');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setDisablingOtp(false);
    }
  };

  const stats = sessionsData.stats || {};
  const items = sessionsData.items || [];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" size={24} />
            Thiết bị đang đăng nhập & Bảo mật 2FA
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Theo dõi phiên trình duyệt Web & App Mobile, đăng xuất thiết bị lạ từ xa và bảo vệ tài khoản Admin bằng OTP Zalo / Email.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSessions}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} /> Làm mới
          </button>
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={revokingOthers}
            className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 flex items-center gap-1.5 shadow-sm disabled:opacity-60"
          >
            {revokingOthers ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Đăng xuất các thiết bị khác
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">Tổng phiên đang hoạt động</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalActive ?? 0}</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">
            {stats.webActive ?? 0} Web · {stats.mobileActive ?? 0} Mobile App
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">Phiên Admin / Nhân viên</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.adminStaffActive ?? 0}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Tài khoản nội bộ đang trực tuyến</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">Đã thu hồi / Đăng xuất</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.revokedCount ?? 0}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Chặn truy cập ngay lập tức</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold text-slate-400">2FA OTP Zalo / Email</p>
          <p className={`text-lg font-black mt-1 ${otpConfig?.enabled ? 'text-emerald-600' : 'text-amber-600'}`}>
            {otpConfig?.enabled ? 'ĐANG BẬT' : 'CHƯA BẬT'}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {otpConfig?.enabled ? `Kênh: ${(otpConfig.channel || 'both').toUpperCase()}` : 'Khuyến nghị bật cho Admin'}
          </p>
        </div>
      </div>

      {/* 2FA OTP Zalo / Email Card */}
      <section className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <KeyRound size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-slate-900">Xác thực 2 lớp (2FA) qua OTP Zalo / Email</h2>
                {otpConfig?.enabled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Đã kích hoạt
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <ShieldAlert size={12} /> Chưa bật
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Khi đăng nhập trang quản trị, sau mật khẩu và CAPTCHA hệ thống sẽ gửi mã OTP 6 số (hiệu lực 5 phút) qua Zalo OA hoặc Gmail của bạn.
              </p>
              {otpConfig && (
                <div className="flex flex-wrap gap-3 mt-2 text-[11px] font-bold">
                  <span className={otpConfig.zaloReady ? 'text-emerald-700' : 'text-amber-700'}>
                    • Zalo OA: {otpConfig.zaloReady ? 'Sẵn sàng' : 'Chưa cấu hình ZALO_OA_ACCESS_TOKEN'}
                  </span>
                  <span className={otpConfig.emailReady ? 'text-emerald-700' : 'text-amber-700'}>
                    • SMTP Gmail: {otpConfig.emailReady ? 'Sẵn sàng' : 'Chưa cấu hình SMTP_HOST / SMTP_FROM'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {otpConfig?.enabled && !showDisableBox && (
            <button
              type="button"
              onClick={() => setShowDisableBox(true)}
              className="px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
            >
              Tắt 2FA OTP
            </button>
          )}
        </div>

        {showDisableBox && (
          <form onSubmit={handleDisableOtp2fa} className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 flex flex-wrap items-center gap-3">
            <input
              type="password"
              value={disablePw}
              onChange={(e) => setDisablePw(e.target.value)}
              placeholder="Nhập mật khẩu quản trị hiện tại để tắt..."
              className="flex-1 min-w-[220px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold"
              required
            />
            <button
              type="submit"
              disabled={disablingOtp}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700"
            >
              {disablingOtp ? 'Đang tắt...' : 'Xác nhận tắt 2FA OTP'}
            </button>
            <button
              type="button"
              onClick={() => { setShowDisableBox(false); setDisablePw(''); }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600"
            >
              Hủy
            </button>
          </form>
        )}

        <form onSubmit={handleSendSetupOtp} className="grid md:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Kênh nhận mã OTP</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
            >
              <option value="both">Cả Zalo OA & Gmail</option>
              <option value="zalo">Chỉ qua Zalo OA</option>
              <option value="email">Chỉ qua Gmail / Email</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <MessageSquare size={12} /> SĐT Zalo nhận OTP
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="VD: 0912345678"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Mail size={12} /> Gmail / Email nhận OTP
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="admin@trungtam.edu.vn"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
            />
          </div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={sendingSetupOtp}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-60"
            >
              {sendingSetupOtp ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {otpConfig?.enabled ? 'Cập nhật & Gửi OTP thử nghiệm' : 'Gửi OTP xác nhận để bật 2FA'}
            </button>
            <span className="text-[11px] text-slate-400">
              Lưu ý: Bạn vẫn có thể cấu hình Google Authenticator (TOTP) song song trong tab Cài đặt hệ thống.
            </span>
          </div>
        </form>

        {setupToken && (
          <form onSubmit={handleVerifySetupOtp} className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <p className="text-xs font-black text-emerald-900">
                Nhập mã OTP 6 số vừa gửi tới {setupMeta?.maskedPhone || setupMeta?.maskedEmail || 'kênh đã chọn'}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {setupMeta?.deliveryOk ? `Đã gửi qua ${setupMeta.sentVia?.join(', ')}` : 'Nếu kênh tự động chưa bật, xem mã dev tại log backend'}
              </p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-36 text-center rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-black tracking-[0.25em]"
            />
            <button
              type="submit"
              disabled={verifyingSetupOtp || otpCode.length !== 6}
              className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-black hover:bg-emerald-800 disabled:opacity-60"
            >
              {verifyingSetupOtp ? 'Đang xác nhận...' : 'Xác nhận kích hoạt'}
            </button>
          </form>
        )}
      </section>

      {/* Active Device Sessions Table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold ${scope === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Toàn hệ thống
            </button>
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold ${scope === 'mine' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Thiết bị của tôi
            </button>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
            >
              <option value="">Tất cả vai trò</option>
              <option value="admin">Admin</option>
              <option value="staff">Nhân viên</option>
              <option value="teacher">Giảng viên</option>
              <option value="student">Học viên</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
            >
              <option value="active">Đang hoạt động</option>
              <option value="revoked">Đã đăng xuất / Thu hồi</option>
              <option value="all">Tất cả lịch sử</option>
            </select>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, trình duyệt, HĐH, IP..."
              className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs font-semibold"
            />
          </div>
        </div>

        {loadingSessions && items.length === 0 ? (
          <div className="p-12 flex justify-center text-slate-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400">
            Không có phiên thiết bị nào khớp bộ lọc hiện tại
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const roleBadge = ROLE_LABELS[item.role] || { label: item.role, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
              const isRevoked = Boolean(item.revokedAt);
              return (
                <div key={`${item.clientType}:${item.sessionId}`} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/60">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isRevoked
                        ? 'bg-slate-100 text-slate-400'
                        : item.isCurrent
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-sky-50 text-sky-600'
                    }`}>
                      <DeviceIcon deviceType={item.deviceType} clientType={item.clientType} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900 truncate">{item.deviceLabel}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${roleBadge.cls}`}>
                          {roleBadge.label}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                          <Globe size={10} /> {item.clientType === 'mobile' ? 'Mobile App' : 'Web Browser'}
                        </span>
                        {item.isCurrent && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Thiết bị này
                          </span>
                        )}
                        {isRevoked && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Đã thu hồi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 font-semibold mt-1">
                        {item.userName} {item.ip ? `· IP: ${item.ip}` : ''} {item.browser ? `· ${item.browser}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hoạt động gần nhất: {new Date(item.lastActiveAt).toLocaleString('vi-VN')} · Đăng nhập lúc {new Date(item.createdAt).toLocaleString('vi-VN')}
                        {isRevoked && item.revocationReason ? ` · Lý do: ${item.revocationReason}` : ''}
                      </p>
                    </div>
                  </div>

                  {!isRevoked && !item.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(item)}
                      disabled={revokingId === item.sessionId}
                      className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-black hover:bg-rose-100 flex items-center gap-1.5 shrink-0 disabled:opacity-60"
                    >
                      {revokingId === item.sessionId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Đăng xuất từ xa
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

