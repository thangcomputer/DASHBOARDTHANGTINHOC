/**
 * BranchManagementTab.jsx
 * Quản lý Chi nhánh / Cơ sở đào tạo (CRUD)
 * Hiển thị trong SystemSettings > Tab "Chi nhánh"
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Edit2, Trash2, Save, X,
  Loader2, Phone, MapPin, Hash, ToggleLeft, ToggleRight,
  CheckCircle2, AlertTriangle
} from 'lucide-react';
import { useToast } from '../utils/toast';
import { useModal } from '../utils/Modal.jsx';
import { csrfFetch } from '../services/api';

const API = import.meta.env.VITE_API_URL || '';

function getToken() {
  for (const role of ['admin','staff','teacher']) {
    const directToken = localStorage.getItem(`${role}_access_token`);
    if (directToken) return directToken;
    const s = localStorage.getItem(`${role}_user`);
    if (s) { try { const u = JSON.parse(s); if (u?.token) return u.token; } catch {} }
  }
  return '';
}

const EMPTY = { name: '', code: '', address: '', phone: '', isActive: true };

// ── Field component — PHẢI khai báo ngoài BranchModal để tránh mất focus ──────
function BranchField({ label, name, placeholder, icon: Icon, type, hint, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{label}</label>
      <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-blue-400 transition">
        {Icon && <Icon size={14} className="text-gray-400 flex-shrink-0" />}
        <input
          type={type || 'text'}
          value={value ?? ''}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none font-medium"
        />
      </div>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Inline Modal ──────────────────────────────────────────────────────────────
function BranchModal({ branch, onClose, onSaved }) {
  const toast  = useToast();
  const isEdit = !!branch?._id;
  const [form, setForm] = useState(branch ? { ...branch } : { ...EMPTY });
  const [saving, setSaving] = useState(false);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Vui lòng nhập đủ Tên và Mã chi nhánh'); return;
    }
    setSaving(true);
    try {
      const url    = isEdit ? `${API}/api/branches/${branch._id}` : `${API}/api/branches`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await csrfFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...form, code: form.code.toUpperCase() }),
      }).then(r => r.json());

      if (res.success) {
        toast.success(isEdit ? '✅ Đã cập nhật chi nhánh' : '✅ Đã thêm chi nhánh mới');
        onSaved(res.data);
        onClose();
      } else {
        toast.error(res.message || 'Lỗi lưu dữ liệu');
      }
    } catch { toast.error('Lỗi kết nối server'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-red-700 to-red-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <h3 className="font-black text-lg">{isEdit ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh mới'}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <BranchField label="Tên chi nhánh *"  name="name"    placeholder="Cơ sở 1 - Quận 1"      icon={Building2} value={form.name}    onChange={setField} />
          <BranchField label="Mã chi nhánh *"   name="code"    placeholder="CS1"                    icon={Hash}      value={form.code}    onChange={setField}
             hint="Dùng làm prefix trong nội dung QR chuyển khoản (VD: CS1 TTH123 Nop hoc phi)" />
          <BranchField label="Địa chỉ"          name="address" placeholder="123 Đường ABC, Quận X"  icon={MapPin}    value={form.address} onChange={setField} />
          <BranchField label="Số điện thoại"    name="phone"   placeholder="028 xxxxxxx"             icon={Phone}     value={form.phone}   onChange={setField} />

          {isEdit && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm font-bold text-gray-700">Trạng thái hoạt động</span>
              <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                className={`flex items-center gap-2 text-sm font-bold transition ${form.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                {form.isActive
                  ? <><ToggleRight size={22} className="text-emerald-500" /> Đang hoạt động</>
                  : <><ToggleLeft  size={22} /> Đã vô hiệu</>
                }
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition">
              Hủy
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold py-3 rounded-xl hover:from-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Thêm chi nhánh')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function BranchManagementTab() {
  const toast = useToast();
  const { showModal } = useModal();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(undefined); // undefined=hidden null=add obj=edit
  const [deleting, setDeleting] = useState(null);

  const fetchBranches = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/branches/all`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(res => { if (res.success) setBranches(res.data); })
      .catch(() => toast.error('Không tải được danh sách chi nhánh'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const handleDelete = async (b) => {
    showModal({
      title: 'Xác nhận vô hiệu hóa',
      content: `Vô hiệu hóa chi nhánh "${b.name}"? Dữ liệu học viên và lịch dạy vẫn được giữ lại nhưng chi nhánh này sẽ không còn xuất hiện trong danh sách hoạt động.`,
      type: 'warning',
      confirmText: 'Vô hiệu hóa',
      cancelText: 'Hủy bỏ',
      onConfirm: async () => {
        setDeleting(b._id);
        try {
          const res = await csrfFetch(`${API}/api/branches/${b._id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getToken()}` },
          }).then(r => r.json());
          if (res.success) {
            setBranches(prev => prev.map(x => x._id === b._id ? { ...x, isActive: false } : x));
            toast.success(`🗑️ Đã vô hiệu hóa "${b.name}"`);
          } else toast.error(res.message);
        } catch { toast.error('Lỗi kết nối'); }
        finally { setDeleting(null); }
      }
    });
  };

  const handleSaved = (updated) => {
    setBranches(prev => {
      const idx = prev.findIndex(x => x._id === updated._id);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [updated, ...prev];
    });
  };

  return (
    <div className="space-y-4">
      {modal !== undefined && (
        <BranchModal branch={modal} onClose={() => setModal(undefined)} onSaved={handleSaved} />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Building2 size={16} className="text-blue-600 shrink-0" />
            <span>Quản lý Chi nhánh / Cơ sở</span>
          </h3>
          <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
            Mã chi nhánh gắn vào QR để phân loại doanh thu tự động
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal(null)}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition shrink-0 w-full sm:w-auto"
        >
          <Plus size={15} /> Thêm chi nhánh
        </button>
      </div>

      <div className="bg-sky-50 border border-sky-100 rounded-xl px-3.5 py-3 text-[13px] text-sky-900 flex items-start gap-2.5 leading-relaxed">
        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-sky-600" />
        <div>
          <strong className="font-semibold">Mã QR có chi nhánh:</strong>{' '}
          Ví dụ học viên CS1 thanh toán sẽ có nội dung{' '}
          <code className="inline bg-white border border-sky-200 rounded-md px-1.5 py-0.5 font-mono text-[12px] text-sky-800 break-all">
            CS1 TTH123 Nop hoc phi
          </code>
          {' '}→ SePay ghi doanh thu cho CS1.
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14 gap-3 text-slate-400">
          <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Đang tải...</span>
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-14 text-slate-400">
          <Building2 size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Chưa có chi nhánh nào. Thêm ngay bên trên.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map(b => (
            <div
              key={b._id}
              className={`rounded-xl border p-3.5 transition ${
                b.isActive
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-50 border-slate-200 opacity-70'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  b.isActive ? 'bg-red-600 text-white' : 'bg-slate-300 text-slate-500'
                }`}>
                  <Building2 size={18} />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-sm font-semibold text-slate-900 leading-snug break-words">{b.name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md font-mono">
                          {b.code}
                        </span>
                        {b.isActive
                          ? <span className="text-[11px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-md">Hoạt động</span>
                          : <span className="text-[11px] bg-red-50 text-red-600 font-medium px-2 py-0.5 rounded-md">Đã vô hiệu</span>
                        }
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setModal(b)}
                        aria-label="Sửa chi nhánh"
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                      >
                        <Edit2 size={14} />
                      </button>
                      {b.isActive && (
                        <button
                          type="button"
                          onClick={() => handleDelete(b)}
                          disabled={deleting === b._id}
                          aria-label="Xóa chi nhánh"
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                        >
                          {deleting === b._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {(b.address || b.phone) && (
                    <div className="space-y-1 text-[13px] text-slate-500">
                      {b.address && (
                        <p className="flex items-start gap-1.5 min-w-0">
                          <MapPin size={12} className="mt-0.5 shrink-0" />
                          <span className="break-words">{b.address}</span>
                        </p>
                      )}
                      {b.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone size={12} className="shrink-0" />
                          <span>{b.phone}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-[12px] text-slate-500 leading-relaxed">
                    QR prefix:{' '}
                    <span className="font-mono text-[12px] text-blue-700 break-all">
                      {b.code} TTH### Nop hoc phi
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
