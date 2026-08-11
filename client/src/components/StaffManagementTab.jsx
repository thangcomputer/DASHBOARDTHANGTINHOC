/**
 * StaffManagementTab.jsx
 * Quản lý Tài khoản & Phân quyền Nhân viên nội bộ
 *
 * Chỉ hiển thị trong Admin Sidebar khi user.adminRole === 'SUPER_ADMIN'
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import CmsSelect from './ui/CmsSelect';
import {
  ShieldCheck, UserPlus, Edit2, Trash2, Save, X, Loader2,
  CheckSquare, Square, Key, Phone, User, Shield, Users,
  AlertTriangle, CheckCircle2, Crown, UserCog, Building2, MoreVertical, ChevronDown, Search, MessageSquare, Headset,
} from 'lucide-react';
import { useToast } from '../utils/toast';
import { useModal } from '../utils/Modal.jsx';
import { ALL_PERMISSIONS, HIGH_ADMIN_DEFAULT_PERMISSIONS, SUPPORT_DEFAULT_PERMISSIONS } from '../constants/permissions';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import { staffAPI, apiFetch } from '../services/api';

/** Nhóm quyền để Accordion UI — không đổi key/API */
const PERMISSION_GROUPS = [
  { id: 'messages', title: 'Hộp thư & Support', icon: '💬', keys: ['manage_messages'] },
  { id: 'students', title: 'Học viên', icon: '📚', keys: ['manage_students'] },
  { id: 'teachers', title: 'Giảng viên', icon: '👨‍🏫', keys: ['view_teachers'] },
  { id: 'schedule', title: 'Lịch dạy', icon: '📅', keys: ['manage_schedule'] },
  { id: 'finance', title: 'Tài chính', icon: '💰', keys: ['manage_finance', 'view_branch_revenue'] },
  { id: 'training', title: 'Đào tạo', icon: '🎓', keys: ['manage_training', 'manage_student_training'] },
  { id: 'hr', title: 'Nhân sự', icon: '👤', keys: ['manage_hr', 'manage_staff'] },
  { id: 'system', title: 'Hệ thống', icon: '⚙️', keys: ['system_settings', 'view_logs', 'view_evaluations'] },
];

const DEFAULT_STAFF_PERMISSIONS = [
  'manage_messages', 'manage_students', 'view_teachers', 'manage_schedule', 'manage_finance', 'manage_training'
];

function RoleBadge({ adminRole, permissions = [], branchName = '' }) {
  if (adminRole === 'SUPER_ADMIN') {
    return (
      <span className="cms-rbac-badge cms-rbac-badge-admin">
        <Crown size={10} aria-hidden="true" /> SUPER ADMIN
      </span>
    );
  }
  if (adminRole === 'SUPPORT') {
    return (
      <span className="cms-rbac-badge" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
        <Headset size={10} aria-hidden="true" /> HỖ TRỢ VIÊN
      </span>
    );
  }
  if (adminRole === 'HIGH_ADMIN') {
    return (
      <span className="cms-rbac-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' }}>
        <Shield size={10} aria-hidden="true" /> ADMIN CẤP CAO
      </span>
    );
  }
  const isOnlyMessages = Array.isArray(permissions) && permissions.length === 1 && permissions.includes('manage_messages');
  if (isOnlyMessages) {
    return (
      <span className="cms-rbac-badge bg-blue-50 text-blue-700 border border-blue-200">
        <MessageSquare size={10} aria-hidden="true" /> HỖ TRỢ VIÊN
      </span>
    );
  }
  return (
    <span className="cms-rbac-badge cms-rbac-badge-staff">
      <UserCog size={10} aria-hidden="true" /> ADMIN-STAFF {branchName ? `[${branchName}]` : ''}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === 'active') {
    return <span className="cms-rbac-badge cms-rbac-badge-success">🟢 Hoạt động</span>;
  }
  if (status === 'pending') {
    return <span className="cms-rbac-badge cms-rbac-badge-warning">🟠 Chờ</span>;
  }
  return <span className="cms-rbac-badge cms-rbac-badge-danger">🔴 Khóa</span>;
}

// ── Modal Thêm/Sửa ────────────────────────────────────────────────────────────
function StaffModal({ staff, onClose, onSaved, isRootSuperAdmin, isSuperAdmin }) {
  const toast  = useToast();
  const isEdit = !!staff?._id;

  const [branches, setBranches]   = useState([]);
  const [branchLoading, setBranchLoading] = useState(true);

  const [form, setForm] = useState({
    name:        staff?.name || '',
    phone:       staff?.phone || '',
    password:    '',
    adminRole:   staff?.adminRole || 'STAFF',
    permissions: staff?.permissions?.length
      ? staff.permissions
      : (staff?.adminRole === 'HIGH_ADMIN'
        ? HIGH_ADMIN_DEFAULT_PERMISSIONS
        : staff?.adminRole === 'SUPPORT'
          ? SUPPORT_DEFAULT_PERMISSIONS
          : (isEdit ? [] : DEFAULT_STAFF_PERMISSIONS)),
    branchId:    staff?.branchId || '',
    status:      staff?.status || 'active',
    gender:      staff?.gender || 'male',
  });
  const [saving, setSaving] = useState(false);
  const [permQuery, setPermQuery] = useState('');

  useEffect(() => {
    setBranchLoading(true);
    apiFetch('/branches/all')
      .then((r) => r.json())
      .then((res) => { if (res.success) setBranches(res.data || []); })
      .catch(() => {})
      .finally(() => setBranchLoading(false));
  }, []);

  const isOnlyMessages = form.permissions.length === 1 && form.permissions.includes('manage_messages');

  const togglePerm = (key) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Vui lòng nhập đủ Tên và Số điện thoại'); return;
    }
    if (!isEdit && !form.password) {
      toast.error('Vui lòng nhập mật khẩu'); return;
    }
    if (form.adminRole === 'STAFF' && !form.branchId) {
      toast.error('Nhân viên (STAFF) phải được gán vào một chi nhánh!'); return;
    }

    let permissions = Array.isArray(form.permissions) ? [...form.permissions] : [];
    if (form.adminRole === 'HIGH_ADMIN' && permissions.length === 0) {
      permissions = [...HIGH_ADMIN_DEFAULT_PERMISSIONS];
    }
    if (form.adminRole === 'SUPPORT' && permissions.length === 0) {
      permissions = [...SUPPORT_DEFAULT_PERMISSIONS];
    }
    if (form.adminRole === 'SUPER_ADMIN') {
      permissions = [];
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        password: form.password?.trim() || '',
        permissions,
        branchId: (form.adminRole === 'SUPER_ADMIN' || form.adminRole === 'HIGH_ADMIN' || form.adminRole === 'SUPPORT')
          ? null
          : (form.branchId || null),
      };
      const res = isEdit
        ? await staffAPI.update(staff._id, payload)
        : await staffAPI.create(payload);

      if (res.success) {
        toast.success(isEdit ? '✅ Đã cập nhật phân quyền' : '✅ Đã tạo tài khoản mới');
        onSaved(res.data);
        onClose();
      } else {
        toast.error(res.message || 'Lỗi lưu dữ liệu');
      }
    } catch (err) {
      toast.error(err?.message || 'Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const isStaff = form.adminRole === 'STAFF';
  const isHighAdmin = form.adminRole === 'HIGH_ADMIN';
  const isSupport = form.adminRole === 'SUPPORT';
  const isSuperRole = form.adminRole === 'SUPER_ADMIN';
  const showPermEditor = isStaff || isHighAdmin || isSupport;
  const canPickElevatedRoles = !!isSuperAdmin;
  const q = permQuery.trim().toLowerCase();

  const groupedPerms = useMemo(() => {
    return PERMISSION_GROUPS.map((g) => {
      const items = ALL_PERMISSIONS.filter((p) => g.keys.includes(p.key));
      const filtered = !q
        ? items
        : items.filter((p) =>
          p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.key.includes(q)
        );
      return { ...g, items: filtered };
    }).filter((g) => g.items.length > 0);
  }, [q]);

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Chỉnh sửa quyền' : 'Tạo tài khoản nội bộ'}
        className="cms-sheet cms-rbac-sheet w-full md:max-w-3xl"
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />

        <div className="cms-rbac-sheet-header">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <UserPlus size={20} aria-hidden="true" />
            </span>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
              {isEdit ? 'Chỉnh sửa quyền' : 'Tạo tài khoản nội bộ'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 hover:text-red-600 flex items-center justify-center transition-all duration-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper (visual) */}
        <div className="cms-rbac-stepper" aria-hidden="true">
          <div className="cms-rbac-step cms-rbac-step-active">
            <span className="cms-rbac-step-dot" />
            <span className="cms-rbac-step-label">Thông tin</span>
          </div>
          <div className="cms-rbac-step-line" />
          <div className={`cms-rbac-step ${isStaff ? 'cms-rbac-step-active' : ''}`}>
            <span className="cms-rbac-step-dot" />
            <span className="cms-rbac-step-label">Chi nhánh</span>
          </div>
          <div className="cms-rbac-step-line" />
          <div className="cms-rbac-step">
            <span className="cms-rbac-step-dot" />
            <span className="cms-rbac-step-label">Hoàn tất</span>
          </div>
        </div>

        <div className="cms-sheet-body cms-rbac-sheet-body space-y-4">
          <section className="space-y-3">
            <h4 className="cms-rbac-section-title">
              <span className="cms-rbac-section-num">1</span>
              Thông tin tài khoản
            </h4>

            <div>
              <label className="cms-rbac-label">Họ tên <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="cms-input pl-10"
                  placeholder="Nguyễn Văn A"
                />
              </div>
            </div>

            <div>
              <label className="cms-rbac-label">Giới tính chọn ảnh Cartoon <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, gender: 'male' }))}
                  className={`flex-1 py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                    form.gender === 'male' || form.gender === 'Nam'
                      ? 'bg-sky-50 text-sky-700 border-sky-300 ring-2 ring-sky-400/20 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>👨 Nam (Ảnh Cartoon Nam)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, gender: 'female' }))}
                  className={`flex-1 py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                    form.gender === 'female' || form.gender === 'Nữ'
                      ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-400/20 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>👩 Nữ (Ảnh Cartoon Nữ)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="cms-rbac-label">Số điện thoại <span className="text-red-500">*</span></label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="cms-input pl-10 font-mono"
                  placeholder="09xxxxxxxx"
                  readOnly={isEdit && !(isSuperAdmin || isRootSuperAdmin)}
                />
              </div>
              {isEdit && (isSuperAdmin || isRootSuperAdmin) && (
                <p className="text-xs text-slate-500 mt-1">
                  Super Admin có thể đổi SĐT đăng nhập cho mọi tài khoản nội bộ.
                </p>
              )}
            </div>

            <div>
              <label className="cms-rbac-label">
                {isEdit ? 'Mật khẩu mới (để trống = giữ nguyên)' : <>Mật khẩu <span className="text-red-500">*</span></>}
              </label>
              <div className="relative">
                <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="cms-input pl-10"
                  placeholder={isEdit ? '••••••' : 'Tối thiểu 6 ký tự'}
                />
              </div>
            </div>

            <div>
              <label className="cms-rbac-label" id="rbac-role-label">Vai trò</label>
              {isSuperRole ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[13px] text-amber-900 flex items-center gap-2">
                  <Crown size={14} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
                  <span><strong>Super Admin</strong> — tài khoản hệ thống, không đổi vai trò / không tạo thêm từ form này.</span>
                </div>
              ) : (
                <div
                  className="cms-rbac-segment"
                  role="radiogroup"
                  aria-labelledby="rbac-role-label"
                >
                  {[
                    ...(canPickElevatedRoles ? [{ val: 'HIGH_ADMIN', label: 'Admin cấp cao', icon: ShieldCheck }] : []),
                    { val: 'SUPPORT', label: 'Chuyên viên Hỗ trợ', icon: Headset },
                    { val: 'STAFF', label: 'Hỗ trợ viên / Admin-Staff', icon: UserCog },
                  ].map(({ val, label, icon: Icon }) => (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={form.adminRole === val}
                      onClick={() => setForm((f) => ({
                        ...f,
                        adminRole: val,
                        permissions: val === 'HIGH_ADMIN'
                          ? (f.adminRole === 'HIGH_ADMIN' && f.permissions.length ? f.permissions : HIGH_ADMIN_DEFAULT_PERMISSIONS)
                          : val === 'SUPPORT'
                            ? SUPPORT_DEFAULT_PERMISSIONS
                            : (f.permissions.length && f.adminRole === 'STAFF' ? f.permissions : DEFAULT_STAFF_PERMISSIONS),
                        branchId: (val === 'HIGH_ADMIN' || val === 'SUPPORT') ? '' : f.branchId,
                      }))}
                      className={`cms-rbac-segment-item ${form.adminRole === val ? 'is-active' : ''}`}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isSuperRole && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-[13px] text-amber-800 flex items-start gap-2">
                <Crown size={14} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>Super Admin — <strong>toàn quyền hệ thống</strong>, không cần gán chi nhánh / tick quyền module.</span>
              </div>
            )}
            {isHighAdmin && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-[13px] text-amber-800 flex items-start gap-2">
                <ShieldCheck size={14} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>Admin cấp cao — không gán chi nhánh cố định; <strong>quyền theo danh sách bên dưới</strong> (không bypass toàn hệ thống).</span>
              </div>
            )}
            {isSupport && (
              <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-[13px] text-sky-800 flex items-start gap-2">
                <Headset size={14} className="text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>Chuyên viên Hỗ trợ — phạm vi org-wide; mặc định quyền hộp thư (có thể chỉnh bên dưới).</span>
              </div>
            )}

            {isStaff && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 flex items-center justify-between">
                <span>Vai trò hiển thị tương ứng:</span>
                <span className="font-bold text-slate-900">
                  {isOnlyMessages ? '💬 HỖ TRỢ VIÊN (Chỉ tin nhắn)' : `🛡️ ADMIN-STAFF ${form.branchId ? '(Chi nhánh)' : ''}`}
                </span>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h4 className="cms-rbac-section-title">
              <span className="cms-rbac-section-num cms-rbac-section-num-info">2</span>
              {isStaff ? 'Chi nhánh & Phân quyền' : showPermEditor ? 'Phân quyền module' : 'Phạm vi quản lý'}
            </h4>

            {isStaff && (
              <div>
                <label className="cms-rbac-label flex items-center gap-1.5">
                  <Building2 size={12} aria-hidden="true" />
                  Chi nhánh quản lý <span className="text-red-500">*</span>
                </label>
                {branchLoading ? (
                  <div className="cms-input flex items-center gap-2 text-slate-400">
                    <Loader2 size={14} className="animate-spin" /> Đang tải chi nhánh...
                  </div>
                ) : branches.length === 0 ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-700 flex items-center gap-2">
                    <AlertTriangle size={14} /> Chưa có chi nhánh nào. Vui lòng tạo chi nhánh trong Cài đặt trước.
                  </div>
                ) : (
                  <>
                    <CmsSelect
                      value={form.branchId}
                      onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                      className={`cms-input cursor-pointer ${
                        !form.branchId
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-emerald-300 bg-emerald-50/50 text-emerald-900'
                      }`}
                      aria-invalid={!form.branchId}
                    >
                      <option value="">-- Chọn chi nhánh (bắt buộc) --</option>
                      {branches.filter((b) => b.isActive !== false).map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name}{b.code ? ` [${b.code}]` : ''}
                        </option>
                      ))}
                    </CmsSelect>
                    {!form.branchId && (
                      <p className="text-[12px] text-amber-700 mt-1.5 flex items-center gap-1 font-medium">
                        <AlertTriangle size={11} /> Bắt buộc chọn chi nhánh cho tài khoản này
                      </p>
                    )}
                    {form.branchId && (() => {
                      const b = branches.find((x) => String(x._id) === String(form.branchId));
                      return b ? (
                        <p className="text-[12px] text-emerald-700 mt-1.5 flex items-center gap-1 font-medium">
                          <CheckCircle2 size={11} /> Gán vào: <strong>{b.name}</strong>
                          {b.code ? ` (mã QR: ${b.code})` : ''}
                        </p>
                      ) : null;
                    })()}
                  </>
                )}
              </div>
            )}

            {showPermEditor && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="cms-rbac-label !mb-0">
                    Phân quyền module ({form.permissions.length}/{ALL_PERMISSIONS.length})
                  </label>

                  <div className="flex items-center gap-1.5">
                    {isHighAdmin && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: [...HIGH_ADMIN_DEFAULT_PERMISSIONS] }))}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all border bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                      >
                        Mặc định Admin cấp cao
                      </button>
                    )}
                    {isSupport && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: [...SUPPORT_DEFAULT_PERMISSIONS] }))}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all border bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
                      >
                        Mặc định Hỗ trợ
                      </button>
                    )}
                    {isStaff && (
                      <>
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, permissions: DEFAULT_STAFF_PERMISSIONS }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                            !isOnlyMessages && form.permissions.length > 1
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          🛡️ Mặc định: Admin-Staff
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, permissions: ['manage_messages'] }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                            isOnlyMessages
                              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          💬 Chỉ Hỗ trợ viên
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="cms-rbac-perm-search">
                  <div className="cms-rbac-perm-search-inner">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                    <input
                      type="search"
                      value={permQuery}
                      onChange={(e) => setPermQuery(e.target.value)}
                      className="cms-input pl-10"
                      placeholder="Tìm quyền..."
                      aria-label="Tìm quyền"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {groupedPerms.map((g) => (
                    <details key={g.id} className="cms-rbac-accordion">
                      <summary className="cms-rbac-accordion-summary">
                        <span className="flex items-center gap-2 min-w-0">
                          <span aria-hidden="true">{g.icon}</span>
                          <span className="font-semibold text-slate-800 truncate">{g.title}</span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {g.items.filter((p) => form.permissions.includes(p.key)).length}/{g.items.length}
                          </span>
                        </span>
                        <ChevronDown size={16} className="cms-rbac-accordion-chevron text-slate-400" aria-hidden="true" />
                      </summary>
                      <div className="cms-rbac-accordion-body">
                        {g.items.map(({ key, label, desc }) => {
                          const checked = form.permissions.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => togglePerm(key)}
                              className={`cms-rbac-perm-row ${checked ? 'is-checked' : ''}`}
                            >
                              {checked
                                ? <CheckSquare size={18} className="text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                : <Square size={18} className="text-slate-300 flex-shrink-0 mt-0.5" aria-hidden="true" />}
                              <div className="min-w-0 text-left">
                                <p className={`text-sm font-semibold ${checked ? 'text-sky-900' : 'text-slate-700'}`}>{label}</p>
                                <p className="text-[12px] text-slate-500 leading-snug">{desc}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                  {groupedPerms.length === 0 && (
                    <p className="text-[13px] text-slate-400 text-center py-4">Không tìm thấy quyền phù hợp</p>
                  )}
                </div>

                {form.permissions.length === 0 && (
                  <p className="text-[12px] text-amber-700 flex items-center gap-1 font-medium">
                    <AlertTriangle size={12} /> Chưa có quyền nào — tài khoản sẽ không thấy menu sau khi đăng nhập
                  </p>
                )}
              </div>
            )}

            {isSuperRole && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-[13px] text-slate-500 leading-relaxed">
                Super Admin không cần gán chi nhánh hay tick quyền module — mặc định toàn quyền.
              </div>
            )}
          </section>
        </div>

        <div className="cms-sheet-footer">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline flex-1">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="cms-btn cms-btn-primary flex-[1.4]"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Đang lưu...' : (isEdit ? 'Lưu' : 'Tạo tài khoản')}
          </button>
        </div>
      </div>
    </>
  );
}

function ResetPasswordModal({ staff, onClose, onSaved }) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Mật khẩu mới phải từ 6 ký tự trở lên');
      return;
    }
    setSaving(true);
    try {
      const res = await staffAPI.update(staff._id, { password: newPassword });
      if (res.success) {
        toast.success(`✅ Đã reset mật khẩu cho "${staff.name}"`);
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        toast.error(res.message || 'Lỗi reset mật khẩu');
      }
    } catch (err) {
      toast.error(err?.message || 'Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="cms-sheet w-full max-w-md p-5 bg-white rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Key className="text-blue-600" size={18} /> Reset mật khẩu: {staff.name}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Mật khẩu mới (≥6 ký tự)</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-blue-500"
            placeholder="Nhập mật khẩu mới..."
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">Hủy</button>
          <button type="button" onClick={handleReset} disabled={saving} className="cms-btn cms-btn-primary">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Reset mật khẩu
          </button>
        </div>
      </div>
    </>
  );
}

function StaffCard({ s, deleting, isRootSuperAdmin, isSuperAdmin, onEdit, onResetPw, onDelete }) {
  const perms = s.permissions || [];
  const visible = perms.slice(0, 3);
  const rest = perms.slice(3);
  const sheetId = `staff-perms-${s._id}`;

  const isTargetSuper = s.adminRole === 'SUPER_ADMIN';
  const isTargetHighAdmin = s.adminRole === 'HIGH_ADMIN';
  // SUPER chỉ Root sửa; HIGH chỉ Super trở lên; còn lại (STAFF/SUPPORT) theo manage_staff
  const canManage = isTargetSuper
    ? !!isRootSuperAdmin
    : isTargetHighAdmin
      ? !!isSuperAdmin
      : true;
  const disabledReason = !canManage
    ? (isTargetSuper
      ? 'Chỉ Admin Super (hệ thống) mới thao tác Super Admin'
      : 'Chỉ Super Admin mới thao tác Admin cấp cao')
    : '';

  return (
    <article className="cms-rbac-card">
      <div className="flex items-start gap-3">
        <img
          src={resolveAvatarUrl({
            ...s,
            role: s.adminRole === 'SUPPORT' ? 'support' : 'staff',
            adminRole: s.adminRole,
            gender: s.gender,
          })}
          alt=""
          className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-slate-100 bg-white"
        />

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="text-base font-semibold text-slate-900 truncate leading-snug">{s.name}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <RoleBadge adminRole={s.adminRole} permissions={s.permissions} branchName={s.branchName || s.branchCode} />
                <StatusBadge status={s.status} />
              </div>
            </div>

            {/* Action menu — details */}
            <details className="cms-rbac-menu relative flex-shrink-0">
              <summary
                className="cms-rbac-menu-trigger"
                aria-label={`Thao tác ${s.name}`}
              >
                <MoreVertical size={18} aria-hidden="true" />
              </summary>
              <div className="cms-rbac-menu-panel" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canManage}
                  title={disabledReason}
                  className="cms-rbac-menu-item disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    if (!canManage) return;
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    onEdit();
                  }}
                >
                  <Edit2 size={14} /> Sửa
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!canManage}
                  title={disabledReason}
                  className="cms-rbac-menu-item disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    if (!canManage) return;
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    onResetPw();
                  }}
                >
                  <Key size={14} /> Reset mật khẩu
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!canManage}
                  title={disabledReason}
                  className="cms-rbac-menu-item disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    if (!canManage) return;
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    onEdit();
                  }}
                >
                  <Shield size={14} /> Đổi quyền
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!canManage || deleting}
                  title={disabledReason}
                  onClick={(e) => {
                    if (!canManage) return;
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    onDelete();
                  }}
                  className="cms-rbac-menu-item cms-rbac-menu-item-danger disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Xóa
                </button>
              </div>
            </details>
          </div>

          <p className="text-[13px] text-slate-500 font-mono">{s.phone}</p>

          {s.adminRole === 'STAFF' && s.branchId && (
            <p className="text-[13px] text-sky-700 flex items-center gap-1.5 font-medium">
              <Building2 size={12} aria-hidden="true" />
              {s.branchCode || 'Chi nhánh'}
              {s.branchCode ? <span className="text-slate-400 font-normal">— mã QR prefix</span> : null}
            </p>
          )}
          {s.adminRole === 'STAFF' && !s.branchId && (
            <p className="text-[13px] text-amber-600 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Chưa gán chi nhánh
            </p>
          )}

          {s.adminRole === 'SUPER_ADMIN' ? (
            <p className="text-[13px] text-amber-700 font-medium flex items-center gap-1.5">
              <Crown size={12} /> Toàn quyền hệ thống
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {perms.length === 0 ? (
                <span className="text-[12px] text-slate-400 italic">Chưa có quyền nào</span>
              ) : (
                <>
                  {visible.map((pk) => {
                    const perm = ALL_PERMISSIONS.find((p) => p.key === pk);
                    return (
                      <span key={pk} className="cms-rbac-perm-chip">
                        {perm?.label || pk}
                      </span>
                    );
                  })}
                  {rest.length > 0 && (
                    <>
                      <input type="checkbox" id={sheetId} className="peer/perms sr-only" />
                      <label htmlFor={sheetId} className="cms-rbac-perm-more">
                        +{rest.length} quyền khác
                      </label>
                      <div className="cms-rbac-perm-sheet-root peer-checked/perms:pointer-events-auto">
                        <label htmlFor={sheetId} className="cms-rbac-perm-sheet-backdrop" aria-hidden="true" />
                        <div className="cms-rbac-perm-sheet" role="dialog" aria-label="Toàn bộ quyền">
                          <div className="cms-sheet-handle" aria-hidden="true" />
                          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
                            <h4 className="text-sm font-semibold text-slate-900">Quyền của {s.name}</h4>
                            <label htmlFor={sheetId} className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer" aria-label="Đóng">
                              <X size={16} />
                            </label>
                          </div>
                          <ul className="px-4 py-3 space-y-2 max-h-[50dvh] overflow-y-auto">
                            {perms.map((pk) => {
                              const perm = ALL_PERMISSIONS.find((p) => p.key === pk);
                              return (
                                <li key={pk} className="rounded-xl border border-slate-100 px-3 py-2.5">
                                  <p className="text-sm font-semibold text-slate-800">{perm?.label || pk}</p>
                                  {perm?.desc && <p className="text-[12px] text-slate-500 mt-0.5">{perm.desc}</p>}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function StaffManagementTab() {
  const toast = useToast();
  const { showModal } = useModal();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(undefined); // undefined=hidden, null=add, obj=edit
  const [resetPwStaff, setResetPwStaff] = useState(null);
  const [deleting, setDeleting]   = useState(null);

  const sessionMeta = useMemo(() => {
    try {
      const sess = JSON.parse(localStorage.getItem('admin_user') || localStorage.getItem('staff_user') || '{}');
      const isRootSuperAdmin = sess?.id === 'admin';
      const isSuperAdmin = isRootSuperAdmin || sess?.adminRole === 'SUPER_ADMIN';
      return { isRootSuperAdmin, isSuperAdmin };
    } catch {
      return { isRootSuperAdmin: false, isSuperAdmin: false };
    }
  }, []);
  const { isRootSuperAdmin, isSuperAdmin } = sessionMeta;

  const fetchStaff = useCallback(() => {
    setLoading(true);
    staffAPI.getAll()
      .then((res) => { if (res.success) setStaffList(res.data); })
      .catch(() => toast.error('Không tải được danh sách nhân viên'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleDelete = async (s) => {
    if (s.adminRole === 'SUPER_ADMIN' && !isRootSuperAdmin) {
      toast.error('Chỉ Admin Super (Hệ thống) mới có quyền xóa Super Admin.');
      return;
    }
    if (s.adminRole === 'HIGH_ADMIN' && !isSuperAdmin) {
      toast.error('Chỉ Super Admin mới có quyền xóa tài khoản Admin Cấp Cao.');
      return;
    }
    showModal({
      title: 'Xoá tài khoản nội bộ?',
      content: `Bạn có chắc chắn muốn xoá tài khoản "${s.name}"? Người dùng này sẽ không còn quyền truy cập vào hệ thống.`,
      type: 'error',
      confirmText: 'Xoá vĩnh viễn',
      cancelText: 'Huỷ bỏ',
      onConfirm: async () => {
        setDeleting(s._id);
        try {
          const res = await staffAPI.remove(s._id);
          if (res.success) {
            setStaffList(prev => prev.filter(x => x._id !== s._id));
            toast.success(`🗑️ Đã xóa "${s.name}"`);
          } else {
            toast.error(res.message);
          }
        } catch (err) {
          toast.error(err?.message || 'Lỗi kết nối');
        }
        finally { setDeleting(null); }
      }
    });
  };

  const handleSaved = (updated) => {
    setStaffList(prev => {
      const idx = prev.findIndex(x => x._id === updated._id);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [updated, ...prev];
    });
  };

  return (
    <div className="cms-rbac cms-viewport-fill">
      {modal !== undefined && (
        <StaffModal
          staff={modal}
          onClose={() => setModal(undefined)}
          onSaved={handleSaved}
          isRootSuperAdmin={isRootSuperAdmin}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {resetPwStaff && (
        <ResetPasswordModal staff={resetPwStaff} onClose={() => setResetPwStaff(null)} onSaved={handleSaved} />
      )}

      <div className="flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between shrink-0">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={16} aria-hidden="true" />
            </span>
            <span className="truncate">Tài khoản & Phân quyền nội bộ</span>
          </h3>
          <p className="text-[12px] text-slate-500 mt-1 pl-11">
            {isRootSuperAdmin
              ? 'Admin Super — Toàn quyền quản lý toàn bộ hệ thống'
              : isSuperAdmin
                ? 'Super Admin — Quản lý nhân viên (có thể sửa Admin cấp cao)'
                : 'Admin Cấp Cao — Quản lý nhân viên theo quyền được cấp (không sửa/xóa Admin cấp cao)'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal(null)}
          className="cms-btn cms-btn-primary cms-btn-sm w-full min-[390px]:w-auto"
        >
          <UserPlus size={15} /> Tạo tài khoản
        </button>
      </div>

      {/* RBAC policy accordion — native details, no React state */}
      <details className="cms-rbac-policy shrink-0">
        <summary className="cms-rbac-policy-summary">
          <span className="flex items-center gap-2 font-semibold text-sky-900">
            <Shield size={14} className="text-sky-600" aria-hidden="true" />
            Chính sách phân quyền RBAC
          </span>
          <ChevronDown size={16} className="cms-rbac-accordion-chevron text-sky-600" aria-hidden="true" />
        </summary>
        <div className="cms-rbac-policy-body text-[13px] text-sky-900/90 leading-relaxed">
          <strong>Admin Super (Hệ thống):</strong> Toàn quyền quản lý tất cả tài khoản (Admin Cấp Cao và Nhân viên).<br />
          <strong>Admin Cấp Cao:</strong> Toàn quyền tạo, sửa, đổi quyền, reset mật khẩu và xóa đối với Nhân viên (Staff). Không thể tự đổi quyền, reset mật khẩu hay xóa tài khoản Admin Cấp Cao.
        </div>
      </details>

      {loading ? (
        <div className="cms-viewport-scroll flex items-center justify-center py-14 gap-3 text-slate-400">
          <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Đang tải...</span>
        </div>
      ) : staffList.length === 0 ? (
        <div className="cms-viewport-scroll text-center py-14 text-slate-400">
          <Users size={36} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">Chưa có tài khoản nội bộ nào.</p>
        </div>
      ) : (
        <div className="cms-viewport-scroll space-y-3 pr-0.5">
          {staffList.map((s) => (
            <StaffCard
              key={s._id}
              s={s}
              deleting={deleting === s._id}
              isRootSuperAdmin={isRootSuperAdmin}
              isSuperAdmin={isSuperAdmin}
              onEdit={() => setModal(s)}
              onResetPw={() => setResetPwStaff(s)}
              onDelete={() => handleDelete(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
