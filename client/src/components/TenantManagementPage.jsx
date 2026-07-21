import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, Loader2, Plus, RefreshCw, Users, GraduationCap, Calendar,
} from 'lucide-react';
import { tenantsAPI } from '../services/api';
import { useToast } from '../utils/toast';

export default function TenantManagementPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', contactEmail: '', contactPhone: '' });
  const [assignBranchId, setAssignBranchId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, b] = await Promise.all([tenantsAPI.list(), tenantsAPI.listBranchesMeta()]);
      if (t.success) setTenants(t.data || []);
      if (b.success) setBranches(b.data || []);
    } catch {
      toast.error('Không tải được tenants');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openTenant = async (t) => {
    setSelected(t);
    const res = await tenantsAPI.stats(t._id);
    if (res.success) setStats(res.data);
  };

  const create = async () => {
    setSaving(true);
    try {
      const res = await tenantsAPI.create(form);
      if (res.success) {
        toast.success('Đã tạo tenant');
        setShowCreate(false);
        setForm({ name: '', code: '', contactEmail: '', contactPhone: '' });
        await load();
      } else toast.error(res.message || 'Lỗi');
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    if (!selected || !assignBranchId) return;
    const res = await tenantsAPI.assignBranch(selected._id, assignBranchId);
    if (res.success) {
      toast.success('Đã gán chi nhánh');
      setAssignBranchId('');
      openTenant(selected);
      load();
    } else toast.error(res.message || 'Lỗi');
  };

  const toggleStatus = async (t) => {
    const next = t.status === 'active' ? 'suspended' : 'active';
    const res = await tenantsAPI.update(t._id, { status: next });
    if (res.success) {
      toast.success(next === 'active' ? 'Đã kích hoạt' : 'Đã tạm dừng');
      load();
      if (selected?._id === t._id) setSelected(res.data);
    } else toast.error(res.message || 'Lỗi');
  };

  if (loading) {
    return <div className="p-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={28} /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Building2 className="text-violet-600" size={22} /> Multi-tenant
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Tổ chức · chi nhánh · chuyển ngữ cảnh bằng dropdown trên topbar
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="p-2.5 rounded-xl bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button type="button" onClick={() => setShowCreate(true)} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold flex items-center gap-1.5">
            <Plus size={14} /> Tenant mới
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white border border-violet-100 rounded-2xl p-4 space-y-2 shadow-sm">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tên tổ chức" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold" />
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Mã (vd: ACME)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono font-bold" maxLength={16} />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="Email" className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="SĐT" className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={create} disabled={saving} className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-40">Tạo</button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold">Hủy</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <ul className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50 overflow-hidden">
          {tenants.map((t) => (
            <li key={t._id} className={`p-3 flex items-center gap-2 cursor-pointer hover:bg-gray-50 ${selected?._id === t._id ? 'bg-violet-50' : ''}`} onClick={() => openTenant(t)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-900 truncate">
                  {t.code} — {t.name}
                  {t.isDefault && <span className="ml-1 text-[10px] text-violet-600">DEFAULT</span>}
                </p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{t.status} · {t.branchCount ?? 0} chi nhánh</p>
              </div>
              {!t.isDefault && (
                <button type="button" onClick={(e) => { e.stopPropagation(); toggleStatus(t); }} className="text-[10px] font-bold text-gray-500 px-2 py-1 border border-gray-200 rounded-lg">
                  {t.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm min-h-[200px]">
          {!selected ? (
            <p className="text-sm text-gray-400 font-bold text-center py-10">Chọn tenant để xem chi tiết</p>
          ) : (
            <>
              <p className="text-sm font-black text-gray-900">{selected.name}</p>
              <p className="text-xs text-gray-500 font-mono">{selected.code} · {selected._id}</p>
              {stats && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-gray-50 p-3 text-xs font-bold text-gray-600 flex items-center gap-2"><Building2 size={14} /> {stats.branchCount} CN</div>
                  <div className="rounded-xl bg-gray-50 p-3 text-xs font-bold text-gray-600 flex items-center gap-2"><Users size={14} /> {stats.students} HV</div>
                  <div className="rounded-xl bg-gray-50 p-3 text-xs font-bold text-gray-600 flex items-center gap-2"><GraduationCap size={14} /> {stats.teachers} GV</div>
                  <div className="rounded-xl bg-gray-50 p-3 text-xs font-bold text-gray-600 flex items-center gap-2"><Calendar size={14} /> {stats.schedules} lịch</div>
                </div>
              )}
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Chi nhánh</p>
                <ul className="text-xs space-y-1">
                  {(stats?.branches || []).map((b) => (
                    <li key={b._id} className="font-bold text-gray-700">{b.code} — {b.name}</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Gán chi nhánh</label>
                  <select value={assignBranchId} onChange={(e) => setAssignBranchId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold mt-1">
                    <option value="">Chọn...</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.code} — {b.name}{b.tenantId && String(b.tenantId) !== String(selected._id) ? ' (tenant khác)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={assign} disabled={!assignBranchId} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold disabled:opacity-40">Gán</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}