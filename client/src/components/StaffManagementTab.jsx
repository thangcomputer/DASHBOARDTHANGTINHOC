/**
 * StaffManagementTab.jsx
 * Quản lý Tài khoản & Phân quyền Nhân viên nội bộ
 *
 * Chỉ hiển thị trong Admin Sidebar khi user.adminRole === 'SUPER_ADMIN'
 */

import { useState, useEffect, useCallback } from 'react';
import CmsSelect from './ui/CmsSelect';
import {
  ShieldCheck, UserPlus, Edit2, Trash2, Save, X, Loader2,
  CheckSquare, Square, Key, Phone, User, Shield, Users,
  AlertTriangle, CheckCircle2, Crown, UserCog, Building2
} from 'lucide-react';
import { useToast } from '../utils/toast';
import { useModal } from '../utils/Modal.jsx';
import { ALL_PERMISSIONS } from '../constants/permissions';
import { resolveAvatarUrl } from '../utils/defaultAvatars';

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");



function getToken() {
  for (const role of ['admin','staff','teacher']) {
    const directToken = localStorage.getItem(`${role}_access_token`);
    if (directToken) return directToken;
    const s = localStorage.getItem(`${role}_user`);
    if (s) { try { const u = JSON.parse(s); if (u?.token) return u.token; } catch {} }
  }
  return '';
}

// ── Badge phân quyền ──────────────────────────────────────────────────────────
function RoleBadge({ adminRole }) {
  if (adminRole === 'SUPER_ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full">
        <Crown size={10} /> SUPER ADMIN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-full">
      <UserCog size={10} /> STAFF
    </span>
  );
}

// ── Modal Thêm/Sửa ────────────────────────────────────────────────────────────
function StaffModal({ staff, onClose, onSaved }) {
  const toast  = useToast();
  const isEdit = !!staff?._id;

  const [branches, setBranches]   = useState([]);
  const [branchLoading, setBranchLoading] = useState(true);

  const [form, setForm] = useState({
    name:        staff?.name || '',
    phone:       staff?.phone || '',
    password:    '',
    adminRole:   staff?.adminRole || 'STAFF',
    permissions: staff?.permissions || [],
    branchId:    staff?.branchId || '',
    status:      staff?.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  // Fetch danh sách chi nhánh khi mở modal
  useEffect(() => {
    setBranchLoading(true);
    fetch(`${API}/api/branches/all`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(res => { if (res.success) setBranches(res.data || []); })
      .catch(() => {})
      .finally(() => setBranchLoading(false));
  }, []);

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
    // STAFF phải chọn chi nhánh
    if (form.adminRole === 'STAFF' && !form.branchId) {
      toast.error('Nhân viên (STAFF) phải được gán vào một chi nhánh!'); return;
    }

    setSaving(true);
    try {
      const url    = isEdit ? `${API}/api/staff/${staff._id}` : `${API}/api/staff`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          ...form,
          branchId: form.adminRole === 'SUPER_ADMIN' ? null : (form.branchId || null),
        }),
      }).then(r => r.json());

      if (res.success) {
        toast.success(isEdit ? '✅ Đã cập nhật phân quyền' : '✅ Đã tạo tài khoản mới');
        onSaved(res.data);
        onClose();
      } else {
        toast.error(res.message || 'Lỗi lưu dữ liệu');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const isStaff = form.adminRole === 'STAFF';

  const fieldClass =
    'w-full bg-gray-50 border-2 border-transparent focus:border-gray-800 focus:bg-white rounded-[20px] p-4 font-bold text-gray-800 outline-none transition-all shadow-sm';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col">
        {/* Header giống kiểu modal học viên */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-8 py-6 flex items-center justify-between">
          <h3 className="text-white font-black text-2xl flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md">
              <UserPlus size={28} />
            </div>
            {isEdit ? 'Chỉnh sửa quyền' : 'Tạo tài khoản nội bộ'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-10 max-h-[75vh] overflow-y-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Cột trái */}
            <div className="space-y-6 md:border-r border-gray-100 md:pr-10">
              <h4 className="font-black text-gray-400 text-xs mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                <span className="w-6 h-6 rounded-lg bg-gray-800 text-white flex items-center justify-center text-xs shadow-lg shadow-slate-200">1</span>
                Thông tin tài khoản
              </h4>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={`${fieldClass} pl-11`}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className={`${fieldClass} pl-11 font-mono`}
                    placeholder="09xxxxxxxx"
                    readOnly={isEdit}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                  {isEdit ? 'Mật khẩu mới (để trống = giữ nguyên)' : <>Mật khẩu <span className="text-red-500">*</span></>}
                </label>
                <div className="relative">
                  <Key size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className={`${fieldClass} pl-11`}
                    placeholder={isEdit ? '••••••' : 'Tối thiểu 6 ký tự'}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-3">Vai trò</label>
                <div className="flex gap-4">
                  {[
                    { val: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Toàn quyền hệ thống', icon: Crown, active: 'border-amber-500 bg-amber-50 shadow-md shadow-amber-100', iconCls: 'text-amber-600' },
                    { val: 'STAFF', label: 'Nhân viên', desc: 'Quyền theo cấu hình + chi nhánh', icon: UserCog, active: 'border-blue-600 bg-blue-50 shadow-md shadow-blue-100', iconCls: 'text-blue-600' },
                  ].map(({ val, label, desc, icon: Icon, active, iconCls }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        adminRole: val,
                        permissions: val === 'SUPER_ADMIN' ? [] : f.permissions,
                        branchId: val === 'SUPER_ADMIN' ? '' : f.branchId,
                      }))}
                      className={`flex-1 flex flex-col gap-1 cursor-pointer border-2 p-4 rounded-2xl transition-all text-left ${
                        form.adminRole === val ? active : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      <Icon size={18} className={form.adminRole === val ? iconCls : 'text-gray-400'} />
                      <span className={`font-black text-sm ${form.adminRole === val ? 'text-gray-900' : ''}`}>{label}</span>
                      <span className="text-[11px] text-gray-400 font-medium leading-snug">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {!isStaff && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700 flex items-start gap-2">
                  <Crown size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>Super Admin quản lý <strong>toàn bộ hệ thống</strong>, không bị giới hạn theo chi nhánh.</span>
                </div>
              )}
            </div>

            {/* Cột phải */}
            <div className="space-y-6 md:pl-2">
              <h4 className="font-black text-gray-400 text-xs mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs shadow-lg shadow-blue-200">2</span>
                {isStaff ? 'Chi nhánh & Phân quyền' : 'Phạm vi quản lý'}
              </h4>

              {isStaff && (
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                    <Building2 size={12} />
                    Chi nhánh quản lý <span className="text-red-500">*</span>
                  </label>
                  {branchLoading ? (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-[20px] p-4 text-gray-400 text-sm font-bold">
                      <Loader2 size={14} className="animate-spin" /> Đang tải chi nhánh...
                    </div>
                  ) : branches.length === 0 ? (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-xs text-amber-700 flex items-center gap-2">
                      <AlertTriangle size={14} /> Chưa có chi nhánh nào. Vui lòng tạo chi nhánh trong Cài đặt trước.
                    </div>
                  ) : (
                    <>
                      <CmsSelect
                        value={form.branchId}
                        onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                        className={`w-full rounded-[20px] p-4 text-sm font-black outline-none transition shadow-sm cursor-pointer ${
                          !form.branchId
                            ? 'border-2 border-red-300 bg-red-50'
                            : 'border-2 border-emerald-300 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        <option value="">-- Chọn chi nhánh (bắt buộc) --</option>
                        {branches.filter((b) => b.isActive !== false).map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.name}{b.code ? ` [${b.code}]` : ''}
                          </option>
                        ))}
                      </CmsSelect>
                      {!form.branchId && (
                        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1 font-semibold">
                          <AlertTriangle size={11} /> Bắt buộc chọn chi nhánh cho nhân viên
                        </p>
                      )}
                      {form.branchId && (() => {
                        const b = branches.find((x) => String(x._id) === String(form.branchId));
                        return b ? (
                          <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1 font-semibold">
                            <CheckCircle2 size={11} /> Gán vào: <strong>{b.name}</strong>
                            {b.code ? ` (mã QR: ${b.code})` : ''}
                          </p>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
              )}

              {isStaff && (
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-3">
                    Phân quyền module ({form.permissions.length}/{ALL_PERMISSIONS.length} quyền)
                  </label>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {ALL_PERMISSIONS.map(({ key, label, desc }) => {
                      const checked = form.permissions.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => togglePerm(key)}
                          className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition ${
                            checked ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'
                          }`}
                        >
                          {checked
                            ? <CheckSquare size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            : <Square size={18} className="text-gray-300 flex-shrink-0 mt-0.5" />}
                          <div>
                            <p className={`text-sm font-bold ${checked ? 'text-blue-800' : 'text-gray-700'}`}>{label}</p>
                            <p className="text-[11px] text-gray-400">{desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {form.permissions.length === 0 && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-2 font-semibold">
                      <AlertTriangle size={12} /> Nhân viên chưa có quyền nào — sẽ không thấy menu sau khi đăng nhập
                    </p>
                  )}
                </div>
              )}

              {!isStaff && (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm text-gray-500 font-medium leading-relaxed">
                  Tài khoản Super Admin không cần gán chi nhánh hay tick quyền module — mặc định toàn quyền.
                </div>
              )}
            </div>
          </div>

          {/* Footer giống modal học viên */}
          <div className="mt-12 pt-10 border-t border-gray-100 flex flex-col md:flex-row items-center justify-end gap-4 bg-gray-50/50 -mx-10 -mb-10 px-10 pb-10 pt-8 rounded-b-[40px]">
            <div className="flex gap-4 w-full md:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-10 py-4 bg-white border-2 border-gray-100 rounded-[22px] text-xs font-black text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all uppercase"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 md:flex-none px-12 py-4 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-[22px] text-xs font-black tracking-widest shadow-xl shadow-slate-300 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 uppercase active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật quyền' : 'Tạo tài khoản')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function StaffManagementTab() {
  const toast = useToast();
  const { showModal } = useModal();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(undefined); // undefined=hidden, null=add, obj=edit
  const [deleting, setDeleting]   = useState(null);

  const fetchStaff = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/staff`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(res => { if (res.success) setStaffList(res.data); })
      .catch(() => toast.error('Không tải được danh sách nhân viên'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleDelete = async (s) => {
    showModal({
      title: 'Xoá tài khoản nội bộ?',
      content: `Bạnh có chắc chắn muốn xoá tài khoản nhân viên "${s.name}"? Người dùng này sẽ không còn quyền truy cập vào hệ thống.`,
      type: 'error',
      confirmText: 'Xoá vĩnh viễn',
      cancelText: 'Huỷ bỏ',
      onConfirm: async () => {
        setDeleting(s._id);
        try {
          const res = await fetch(`${API}/api/staff/${s._id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getToken()}` },
          }).then(r => r.json());
          if (res.success) {
            setStaffList(prev => prev.filter(x => x._id !== s._id));
            toast.success(`🗑️ Đã xóa "${s.name}"`);
          } else {
            toast.error(res.message);
          }
        } catch { toast.error('Lỗi kết nối'); }
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
    <div className="space-y-5">
      {modal !== undefined && (
        <StaffModal staff={modal} onClose={() => setModal(undefined)} onSaved={handleSaved} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck size={16} className="text-gray-700" /> Tài khoản & Phân quyền Nội bộ
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Chỉ Super Admin mới quản lý được trang này</p>
        </div>
        <button onClick={() => setModal(null)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-700 transition">
          <UserPlus size={15} /> Tạo tài khoản
        </button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2">
        <Shield size={13} className="flex-shrink-0 mt-0.5 text-blue-600" />
        <span>
          <strong>RBAC:</strong> Super Admin thấy toàn bộ menu. Nhân viên (Staff) chỉ thấy menu tương ứng với quyền đã được cấp.
          Backend cũng chặn API 403 nếu Staff truy cập route không có quyền.
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin" /> <span className="text-sm">Đang tải...</span>
        </div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Chưa có tài khoản nội bộ nào.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staffList.map(s => (
            <div key={s._id} className="bg-white border-2 border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <img
                  src={resolveAvatarUrl({
                    avatar: s.avatar,
                    role: 'admin',
                    adminRole: s.adminRole,
                  })}
                  alt={s.name}
                  className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border border-gray-100 shadow-sm bg-white"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-800">{s.name}</p>
                    <RoleBadge adminRole={s.adminRole} />
                    {s.status === 'active'
                      ? <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">● Hoạt động</span>
                      : <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">● Tắt</span>
                    }
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{s.phone}</p>
                  {/* Branch info for STAFF */}
                  {s.adminRole === 'STAFF' && s.branchId && (
                    <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                      <Building2 size={10} />
                      <span className="font-medium">{s.branchCode || 'Chi nhánh'}</span>
                      {s.branchCode && <span className="text-gray-400">— mã QR prefix</span>}
                    </p>
                  )}
                  {s.adminRole === 'STAFF' && !s.branchId && (
                    <p className="text-xs text-amber-500 mt-0.5 flex items-center gap-1">
                      <AlertTriangle size={10} /> Chưa gán chi nhánh
                    </p>
                  )}
                  {/* Permissions list */}
                  {s.adminRole === 'SUPER_ADMIN' ? (
                    <p className="text-xs text-amber-600 font-medium mt-2 flex items-center gap-1">
                      <Crown size={11} /> Toàn quyền hệ thống
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(s.permissions || []).length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Chưa có quyền nào</span>
                      ) : (
                        s.permissions.map(pk => {
                          const perm = ALL_PERMISSIONS.find(p => p.key === pk);
                          return (
                            <span key={pk} className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                              {perm?.label || pk}
                            </span>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setModal(s)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                    title="Chỉnh sửa quyền">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(s)} disabled={deleting === s._id}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                    title="Xóa tài khoản">
                    {deleting === s._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
