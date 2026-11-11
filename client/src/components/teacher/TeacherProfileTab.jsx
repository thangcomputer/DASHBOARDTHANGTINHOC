import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  User, Phone, Mail, Building2, CreditCard, Landmark, Edit3, Shield, MapPin, Save, X,
  Clock, ChevronRight, KeyRound, Camera, Bell, LogOut, Users, Settings,
} from 'lucide-react';
import { BankSelect } from '../BankSelect';
import { openPinLockSettings } from '../../utils/pinLock';
import { useData } from '../../context/DataContext';
import { useToast } from '../../utils/useToast';
import EditableAvatar from '../EditableAvatar';
import CmsSelect from '../ui/CmsSelect';
import { VOICE_REGION_OPTIONS } from '../../constants/voiceRegions';

function openChangePassword() {
  window.dispatchEvent(new CustomEvent('open-change-password-modal'));
}

export const TeacherProfileSection = ({ teacherId, currentTeacher }) => {
  const toast = useToast();
  const { updateTeacher, onLogout } = useData();

  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email: '',
    bio: '',
    specialty: '',
    address: '',
    zalo: '',
    voiceRegion: '',
    age: '',
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: '',
    bankBranch: '',
  });

  useEffect(() => {
    if (currentTeacher) {
      setForm({
        email: currentTeacher.email || '',
        bio: currentTeacher.bio || '',
        specialty: currentTeacher.specialty || '',
        address: currentTeacher.address || '',
        zalo: currentTeacher.zalo || '',
        voiceRegion: currentTeacher.voiceRegion || '',
        age: currentTeacher.age != null ? String(currentTeacher.age) : '',
        bankName: currentTeacher.bankAccount?.bankName || '',
        bankCode: currentTeacher.bankAccount?.bankCode || '',
        accountNumber: currentTeacher.bankAccount?.accountNumber || '',
        accountName: currentTeacher.bankAccount?.accountName || currentTeacher.bankAccount?.accountHolder || '',
        bankBranch: currentTeacher.bankAccount?.bankBranch || '',
      });
    }
  }, [currentTeacher]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const ageValue = form.age.trim() !== '' ? Number(form.age) : null;
    if (ageValue !== null && (!Number.isInteger(ageValue) || ageValue < 18 || ageValue > 100)) {
      toast.error('Tuổi giảng viên phải từ 18 đến 100');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        zalo: form.zalo.trim(),
        email: form.email.trim(),
        bio: form.bio.trim(),
        address: form.address.trim(),
        voiceRegion: form.voiceRegion || '',
        age: ageValue,
        bankAccount: {
          bankName: form.bankName.trim(),
          bankCode: form.bankCode.trim(),
          accountNumber: form.accountNumber.trim(),
          accountName: form.accountName.trim().toUpperCase(),
          accountHolder: form.accountName.trim().toUpperCase(),
          bankBranch: form.bankBranch.trim(),
        },
      };

      const result = await updateTeacher(teacherId, payload);
      if (result && result.success) {
        toast.success('Đã cập nhật thông tin hồ sơ!');
        setShowEditModal(false);
      } else {
        toast.error(result?.message || 'Lỗi khi lưu thông tin');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const handleEnableNotification = async () => {
    if (!('Notification' in window)) {
      toast.error('Trình duyệt không hỗ trợ thông báo.');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        toast.success('Đã bật quyền thông báo cho trình duyệt này!');
      } else if (res === 'denied') {
        toast.error('Quyền thông báo đang bị chặn trong trình duyệt.');
      } else {
        toast.info('Bạn chưa xác nhận quyền thông báo.');
      }
    } catch {
      toast.error('Không thể yêu cầu quyền thông báo.');
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.clear();
      window.location.href = '/login';
    }
  };

  const teacherStatus = (() => {
    const s = String(currentTeacher?.status || '').toLowerCase();
    if (['active', 'đang hoạt động'].includes(s)) return 'Đang hoạt động';
    if (['pending', 'chờ duyệt'].includes(s)) return 'Chờ duyệt';
    if (['suspended', 'tạm khóa'].includes(s)) return 'Tạm khóa';
    if (['inactive', 'ngừng hoạt động'].includes(s)) return 'Ngừng hoạt động';
    return currentTeacher?.status || 'Đang hoạt động';
  })();

  const formattedSalary = currentTeacher?.baseSalaryPerSession
    ? `${Number(currentTeacher.baseSalaryPerSession).toLocaleString('vi-VN')} đ`
    : '150.000 đ';

  const testScoreDisplay = currentTeacher?.testScore != null
    ? String(currentTeacher.testScore)
    : '0';

  return (
    <div className="max-w-xl mx-auto space-y-3.5 sm:space-y-4 py-3 px-2 sm:px-4 animate-in fade-in duration-300">
      {/* ── 1. Thẻ Hero hồ sơ cá nhân giảng viên (Căn giữa chuẩn Mobile App) ── */}
      <div className="rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#0c6b5b] via-[#0a584b] to-[#073d34] text-white p-6 sm:p-7 shadow-md relative overflow-hidden flex flex-col items-center text-center">
        {/* Họa tiết trang trí mờ phía sau */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-36 h-36 rounded-full bg-emerald-400/10 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <EditableAvatar
              avatar={currentTeacher?.avatar}
              name={currentTeacher?.name}
              role="teacher"
              gender={currentTeacher?.gender}
              mobileStyle={true}
              className="w-20 h-20 min-w-[80px] min-h-[80px] rounded-full border-2 border-white/20 bg-white/10 shadow-lg cursor-pointer shrink-0"
            />
          </div>

          <p className="text-[11px] sm:text-xs font-extrabold uppercase tracking-widest text-emerald-200/90 mt-3.5">
            Hồ sơ cá nhân
          </p>

          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide mt-1 truncate max-w-full">
            {currentTeacher?.name || 'GIẢNG VIÊN'}
          </h2>

          <p className="text-xs sm:text-sm font-medium text-emerald-100/80 mt-1 truncate max-w-full">
            {[currentTeacher?.branchCode ? `Cơ sở ${currentTeacher.branchCode}` : '', currentTeacher?.phone].filter(Boolean).join(' · ') || 'Thông tin giảng viên'}
          </p>

          <div className="mt-3">
            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white border border-white/20 shadow-xs">
              Trạng thái: {teacherStatus}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Thông tin cá nhân (1 dòng chuẩn Mobile App) ── */}
      <div className="rounded-[20px] sm:rounded-[22px] bg-white border border-slate-100 shadow-sm p-4 sm:p-4.5 flex items-center justify-between gap-3">
        <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
          Thông tin cá nhân
        </h3>
        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="text-xs sm:text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors cursor-pointer"
        >
          Chỉnh sửa
        </button>
      </div>

      {/* ── 3. Thông tin giảng dạy (Chuẩn Mobile App) ── */}
      <div className="rounded-[20px] sm:rounded-[22px] bg-white border border-slate-100 shadow-sm p-4 sm:p-4.5 space-y-2.5">
        <h3 className="text-sm sm:text-base font-extrabold text-slate-800 mb-1">
          Thông tin giảng dạy
        </h3>
        <div className="flex items-center justify-between py-1">
          <span className="text-xs sm:text-sm text-slate-500 font-medium">Điểm test</span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-900">{testScoreDisplay}</span>
        </div>
        <div className="border-b border-slate-100" />
        <div className="flex items-center justify-between py-1">
          <span className="text-xs sm:text-sm text-slate-500 font-medium">Lương/buổi</span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-900">{formattedSalary}</span>
        </div>
      </div>

      {/* ── 4. Menu Bảo mật & Tiện ích (Icon tròn xanh chuẩn Mobile App) ── */}
      <div className="rounded-[20px] sm:rounded-[22px] bg-white border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
        <button
          type="button"
          onClick={openChangePassword}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
        >
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
            <Settings size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Thay đổi mật khẩu</p>
            <p className="text-xs text-slate-400 mt-0.5">Cập nhật mật khẩu đăng nhập</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>

        <button
          type="button"
          onClick={openPinLockSettings}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
        >
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
            <KeyRound size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Khóa mã PIN</p>
            <p className="text-xs text-slate-400 mt-0.5">Tự khóa màn hình khi không thao tác</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => { window.location.hash = 'center-info'; }}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
        >
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
            <Users size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Liên hệ Trung tâm</p>
            <p className="text-xs text-slate-400 mt-0.5">Thông tin trung tâm</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>
      </div>

      {/* ── 5. Cài đặt và hỗ trợ (Chuẩn Mobile App) ── */}
      <div className="rounded-[20px] sm:rounded-[22px] bg-white border border-slate-100 shadow-sm p-4 sm:p-4.5 space-y-3">
        <h4 className="text-sm sm:text-base font-extrabold text-slate-800">
          Cài đặt và hỗ trợ
        </h4>
        <button
          type="button"
          onClick={handleEnableNotification}
          className="w-full flex items-center gap-3.5 text-left hover:bg-slate-50/70 -mx-1 px-1 py-1 rounded-xl transition-colors cursor-pointer"
        >
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
            <Bell size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Bật thông báo trên thiết bị</p>
            <p className="text-xs text-slate-400 mt-0.5">Bật quyền thông báo cho trình duyệt này</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>
        <div className="border-t border-slate-100" />
        <p className="text-xs text-slate-400 italic">
          Liên kết quyền riêng tư, điều khoản và hỗ trợ đang chờ Trung tâm cấu hình.
        </p>
      </div>

      {/* ── 6. Nút Đăng xuất (Duolingo 3D button) ── */}
      <div className="pt-2 pb-6 flex justify-center">
        <button
          type="button"
          onClick={handleLogout}
          className="cms-profile-logout min-h-[46px] px-8 rounded-2xl border-[1.5px] border-[#FECACA] border-b-4 border-b-[#F87171] bg-white text-[#DC2626] font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-[#FEF2F2] active:translate-y-[2px] active:border-b-2 transition-all cursor-pointer shadow-sm !shadow-none"
        >
          <LogOut size={17} />
          <span>Đăng xuất</span>
        </button>
      </div>

      {/* ── 7. Modal Chỉnh sửa thông tin hồ sơ & Ngân hàng ── */}
      {showEditModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setShowEditModal(false);
          }}
        >
          <div
            className="max-h-[min(92vh,46rem)] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Chỉnh sửa hồ sơ cá nhân
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cập nhật thông tin liên hệ và tài khoản nhận lương
                </p>
              </div>
              <button
                type="button"
                onClick={() => !saving && setShowEditModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Nhóm Thông tin liên hệ */}
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 mb-2.5 flex items-center gap-1.5">
                  <User size={14} />
                  <span>Thông tin cá nhân</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Số Zalo</label>
                    <input
                      type="text"
                      value={form.zalo}
                      onChange={(e) => setForm({ ...form, zalo: e.target.value })}
                      placeholder="VD: 0912345678"
                      className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Tuổi</label>
                    <input
                      type="number"
                      min="18"
                      max="100"
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                      placeholder="VD: 26"
                      className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Vùng giọng</label>
                    <CmsSelect
                      value={form.voiceRegion}
                      onChange={(v) => setForm({ ...form, voiceRegion: v })}
                      options={VOICE_REGION_OPTIONS}
                      placeholder="-- Chọn vùng giọng --"
                      className="w-full"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-600 block mb-1">Địa chỉ</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Địa chỉ nơi cư trú..."
                      className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-600 block mb-1">Giới thiệu ngắn (Bio)</label>
                    <textarea
                      rows={2}
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      placeholder="Kinh nghiệm, chuyên môn giảng dạy..."
                      className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50/50 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm Thông tin ngân hàng */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 mb-2.5 flex items-center gap-1.5">
                  <Landmark size={14} />
                  <span>Tài khoản ngân hàng (nhận thù lao)</span>
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Ngân hàng thụ hưởng</label>
                    <BankSelect
                      value={form.bankCode}
                      onChange={(bank) => setForm({ ...form, bankName: bank.shortName, bankCode: bank.code })}
                      placeholder="Chọn ngân hàng thụ hưởng..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Số tài khoản</label>
                      <input
                        type="text"
                        value={form.accountNumber}
                        onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })}
                        placeholder="Nhập số tài khoản..."
                        maxLength={22}
                        className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50/50 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Tên chủ tài khoản</label>
                      <input
                        type="text"
                        value={form.accountName}
                        onChange={(e) => setForm({ ...form, accountName: e.target.value.toUpperCase() })}
                        placeholder="VD: NGUYEN VAN A"
                        className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50/50 font-bold uppercase"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-600 block mb-1">Chi nhánh (tùy chọn)</label>
                      <input
                        type="text"
                        value={form.bankBranch}
                        onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
                        placeholder="VD: Chi nhánh TP.HCM"
                        className="w-full text-sm rounded-xl px-3.5 py-2.5 border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-6 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-[#10B981] border border-[#34D399] border-b-4 border-b-[#059669] hover:brightness-105 active:translate-y-[2px] active:border-b-2 shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {saving ? <Clock size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default TeacherProfileSection;
