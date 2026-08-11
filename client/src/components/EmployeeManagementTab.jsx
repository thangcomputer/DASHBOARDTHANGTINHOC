/**
 * EmployeeManagementTab.jsx — Module Quản lý Nhân sự & Trả lương
 * Tab 1: Danh sách nhân sự (CRUD)
 * Tab 2: Trả lương (thanh toán + VietQR + lịch sử)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CmsSelect from './ui/CmsSelect';
import {
  Users, Plus, Edit3, Trash2, DollarSign, Search, RefreshCw,
  CheckCircle2, Calendar, ClipboardList,
  Briefcase, Loader2, AlertCircle, X, CreditCard, QrCode
} from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { useSocket } from '../context/SocketContext';
import { csrfFetch } from '../services/api';

const API = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : '';

function getToken() {
  for (const role of ['admin','staff','teacher','student']) {
    const directToken = localStorage.getItem(`${role}_access_token`);
    if (directToken) return directToken;
    const s = localStorage.getItem(`${role}_user`);
    if (s) { try { const u = JSON.parse(s); if (u?.token) return u.token; } catch {} }
  }
  return '';
}

const POSITIONS = [
  { value: 'BAO_VE',     label: 'Bảo vệ',     emoji: '🛡️' },
  { value: 'QUAN_LY',    label: 'Quản lý',     emoji: '👔' },
  { value: 'GIANG_VIEN', label: 'Giảng viên',   emoji: '👨‍🏫' },
  { value: 'THU_VIEC',   label: 'Thử việc',     emoji: '🆕' },
  { value: 'IT',          label: 'IT',           emoji: '💻' },
  { value: 'KE_TOAN',    label: 'Kế toán',     emoji: '📊' },
  { value: 'THU_NGAN',   label: 'Thu ngân',     emoji: '💵' },
  { value: 'TRO_GIANG',  label: 'Trợ giảng',   emoji: '📚' },
  { value: 'KHAC',        label: 'Khác',         emoji: '📋' },
];

// ── Danh sách Ngân hàng Việt Nam (VietQR bin code) ──────────────────────────
const VN_BANKS = [
  { code: '970436', shortName: 'Vietcombank',      name: 'Ngân hàng TMCP Ngoại Thương Việt Nam' },
  { code: '970418', shortName: 'BIDV',             name: 'Ngân hàng TMCP Đầu Tư và Phát Triển Việt Nam' },
  { code: '970415', shortName: 'VietinBank',       name: 'Ngân hàng TMCP Công Thương Việt Nam' },
  { code: '970405', shortName: 'Agribank',         name: 'Ngân hàng NN & PTNT Việt Nam' },
  { code: '970416', shortName: 'ACB',              name: 'Ngân hàng TMCP Á Châu' },
  { code: '970407', shortName: 'Techcombank',       name: 'Ngân hàng TMCP Kỹ Thương Việt Nam' },
  { code: '970423', shortName: 'TPBank',           name: 'Ngân hàng TMCP Tiên Phong' },
  { code: '970422', shortName: 'MBBank',           name: 'Ngân hàng TMCP Quân Đội' },
  { code: '970432', shortName: 'VPBank',           name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { code: '970448', shortName: 'OCB',              name: 'Ngân hàng TMCP Phương Đông' },
  { code: '970431', shortName: 'Eximbank',         name: 'Ngân hàng TMCP Xuất Nhập Khẩu Việt Nam' },
  { code: '970443', shortName: 'SHB',              name: 'Ngân hàng TMCP Sài Gòn – Hà Nội' },
  { code: '970403', shortName: 'Sacombank',        name: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
  { code: '970437', shortName: 'HDBank',           name: 'Ngân hàng TMCP Phát Triển TPHCM' },
  { code: '970441', shortName: 'VIB',              name: 'Ngân hàng TMCP Quốc Tế Việt Nam' },
  { code: '970427', shortName: 'VietABank',        name: 'Ngân hàng TMCP Việt Á' },
  { code: '970449', shortName: 'LienVietPostBank', name: 'Ngân hàng TMCP Bưu Điện Liên Việt' },
  { code: '970426', shortName: 'MSB',              name: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
  { code: '970414', shortName: 'OceanBank',        name: 'Ngân hàng TNHH MTV Đại Dương' },
  { code: '970429', shortName: 'SCB',              name: 'Ngân hàng TMCP Sài Gòn' },
  { code: '970433', shortName: 'VietBank',         name: 'Ngân hàng TMCP Việt Nam Thương Tín' },
  { code: '970440', shortName: 'SeABank',          name: 'Ngân hàng TMCP Đông Nam Á' },
  { code: '970424', shortName: 'ShinhanBank',      name: 'Ngân hàng TNHH MTV Shinhan Việt Nam' },
  { code: '970452', shortName: 'KienLongBank',     name: 'Ngân hàng TMCP Kiên Long' },
  { code: '970430', shortName: 'PGBank',           name: 'Ngân hàng TMCP Xăng Dầu Petrolimex' },
  { code: '970400', shortName: 'SaigonBank',       name: 'Ngân hàng TMCP Sài Gòn Công Thương' },
  { code: '970412', shortName: 'DongABank',        name: 'Ngân hàng TMCP Đông Á' },
  { code: '970458', shortName: 'UnitedOverseas',   name: 'Ngân hàng United Overseas Bank Việt Nam' },
  { code: '970425', shortName: 'ABBank',           name: 'Ngân hàng TMCP An Bình' },
  { code: '970446', shortName: 'COOPBANK',         name: 'Ngân hàng Hợp tác xã Việt Nam' },
  { code: '970457', shortName: 'Woori',            name: 'Ngân hàng TNHH MTV Woori Việt Nam' },
  { code: '970462', shortName: 'KookminHN',        name: 'Ngân hàng Kookmin - CN Hà Nội' },
  { code: '970409', shortName: 'BacABank',         name: 'Ngân hàng TMCP Bắc Á' },
  { code: '970434', shortName: 'IndovinaBank',     name: 'Ngân hàng TNHH Indovina' },
  { code: '422589', shortName: 'CIMB',             name: 'Ngân hàng TNHH MTV CIMB Việt Nam' },
  { code: '546034', shortName: 'KBank',            name: 'Ngân hàng Đại Chúng TNHH Kasikornbank' },
  { code: '970410', shortName: 'StandardChartered', name: 'Ngân hàng TNHH MTV Standard Chartered Việt Nam' },
  { code: '970439', shortName: 'PublicBank',       name: 'Ngân hàng TNHH MTV Public Bank Việt Nam' },
];

const BANK_MAP = Object.fromEntries(VN_BANKS.map(b => [b.code, b]));
const POSITION_MAP = Object.fromEntries(POSITIONS.map(p => [p.value, p]));

const fmt = (n) => n ? Number(n).toLocaleString('vi-VN') + 'đ' : '0đ';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '';

// ── Session info ─────────────────────────────────────────────────────────────
function getSession() {
  for (const k of ['admin_user','staff_user']) {
    try { const s = JSON.parse(localStorage.getItem(k) || '{}'); if (s?.id) return s; } catch {}
  }
  return {};
}

export default function EmployeeManagementTab() {
  const [activeTab, setActiveTab] = useState('list');  // 'list' | 'payroll'
  const [employees, setEmployees] = useState([]);
  const [payrollLogs, setPayrollLogs] = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [posFilter, setPosFilter] = useState('all');
  const [error, setError]         = useState('');

  // Modal states
  const [showForm, setShowForm]     = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [showPayModal, setShowPayModal] = useState(null);  // employee obj
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Form fields
  const emptyForm = { name:'', phone:'', position:'KHAC', baseSalary:'', startDate:'', note:'', branchId:'', branchCode:'', bankCode:'', bankAccountNumber:'', bankAccountName:'' };
  const [form, setForm] = useState(emptyForm);
  const [payForm, setPayForm] = useState({ amount:'', payDate:'', note:'', monthLabel:'' });
  const [saving, setSaving] = useState(false);

  const sess = getSession();
  const isSuperAdmin = sess?.id === 'admin' || sess?.adminRole === 'SUPER_ADMIN';
  const headers = { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
  
  const { selectedBranchId } = useBranch();

  // ── Branches (for super admin) ──
  const [branches, setBranches] = useState([]);
  useEffect(() => {
    if (isSuperAdmin) {
      fetch(`${API}/api/branches`, { headers: { Authorization: `Bearer ${getToken()}` } })
        .then(r => r.json())
        .then(res => { if (res.success) setBranches(res.data || []); })
        .catch(() => {});
    }
  }, []);

  const [showSalaries, setShowSalaries] = useState(false);

  const fmtSalary = (n) => {
    if (!showSalaries) return '••••••';
    return fmt(n);
  };

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const bQuery = selectedBranchId ? `&branch_id=${encodeURIComponent(selectedBranchId)}` : '';
      const [empRes, statsRes, payRes] = await Promise.all([
        fetch(`${API}/api/employees?position=${posFilter}&search=${search}${bQuery}`, { headers }).then(r => r.json()),
        fetch(`${API}/api/employees/stats?${bQuery.slice(1)}`, { headers }).then(r => r.json()),
        fetch(`${API}/api/employees/payroll?${bQuery.slice(1)}`, { headers }).then(r => r.json()),
      ]);
      if (empRes.success)   setEmployees(empRes.data);
      if (statsRes.success) setStats(statsRes.data);
      if (payRes.success)   setPayrollLogs(payRes.data);
    } catch { setError('Lỗi kết nối server'); }
    finally { setLoading(false); }
  }, [posFilter, search, selectedBranchId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    let debounceTimer = null;
    const bump = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        fetchAll();
      }, 400);
    };
    socket.on('employees:updated', bump);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.off('employees:updated', bump);
    };
  }, [socket, fetchAll]);

  // ── CRUD Handlers ──
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = editingEmp ? `${API}/api/employees/${editingEmp._id}` : `${API}/api/employees`;
      const method = editingEmp ? 'PUT' : 'POST';
      const body = {
        ...form,
        baseSalary: Number(form.baseSalary) || 0,
        bankAccount: {
          bankCode: form.bankCode || '',
          accountNumber: form.bankAccountNumber || '',
          accountName: form.bankAccountName || '',
        },
      };
      // Remove flat bank fields (they're nested now)
      delete body.bankCode;
      delete body.bankAccountNumber;
      delete body.bankAccountName;

      if (!isSuperAdmin) { body.branchId = sess.branchId; body.branchCode = sess.branchCode; }

      const res = await csrfFetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setEditingEmp(null);
        setForm(emptyForm);
        fetchAll();
      } else { setError(data.message); }
    } catch { setError('Lỗi lưu dữ liệu'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await csrfFetch(`${API}/api/employees/${deleteConfirm._id}`, { method:'DELETE', headers });
      const data = await res.json();
      if (data.success) { setDeleteConfirm(null); fetchAll(); }
      else setError(data.message);
    } catch { setError('Lỗi xóa'); }
  };

  const handlePay = async () => {
    if (!showPayModal || !payForm.amount) return;
    setSaving(true);
    try {
      const res = await csrfFetch(`${API}/api/employees/${showPayModal._id}/pay`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...payForm, amount: Number(payForm.amount) }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPayModal(null);
        setPayForm({ amount:'', payDate:'', note:'', monthLabel:'' });
        fetchAll();
      } else setError(data.message);
    } catch { setError('Lỗi thanh toán'); }
    finally { setSaving(false); }
  };

  const openEdit = (emp) => {
    setEditingEmp(emp);
    setForm({
      name: emp.name, phone: emp.phone || '', position: emp.position,
      baseSalary: String(emp.baseSalary || ''), startDate: emp.startDate ? new Date(emp.startDate).toISOString().split('T')[0] : '',
      note: emp.note || '', branchId: emp.branchId || '', branchCode: emp.branchCode || '',
      bankCode: emp.bankAccount?.bankCode || '',
      bankAccountNumber: emp.bankAccount?.accountNumber || '',
      bankAccountName: emp.bankAccount?.accountName || '',
    });
    setShowForm(true);
  };

  const openAdd = () => {
    setEditingEmp(null);
    setForm({ ...emptyForm, startDate: new Date().toISOString().split('T')[0], branchId: sess?.branchId || '', branchCode: sess?.branchCode || '' });
    setShowForm(true);
  };

  const filteredEmployees = employees.filter(emp =>
    (emp.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (emp.phone || '').toLowerCase().includes(search.toLowerCase())
  );

  // ── VietQR URL builder ──
  const getVietQRUrl = useMemo(() => {
    if (!showPayModal) return '';
    const bank = showPayModal.bankAccount;
    if (!bank?.bankCode || !bank?.accountNumber) return '';
    const amount = Number(payForm.amount) || 0;
    const info = encodeURIComponent(payForm.note || payForm.monthLabel || `Luong ${showPayModal.name}`);
    const accName = encodeURIComponent(bank.accountName || showPayModal.name);
    return `https://img.vietqr.io/image/${bank.bankCode}-${bank.accountNumber}-compact2.png?amount=${amount}&addInfo=${info}&accountName=${accName}`;
  }, [showPayModal, payForm.amount, payForm.note, payForm.monthLabel]);

  const hasBankInfo = showPayModal?.bankAccount?.bankCode && showPayModal?.bankAccount?.accountNumber;

  const statusLabel = (status) => {
    if (status === 'active') return { text: 'Đang làm', cls: 'cms-hr-status-active' };
    if (status === 'pending') return { text: 'Chờ', cls: 'cms-hr-status-pending' };
    return { text: 'Nghỉ / Khóa', cls: 'cms-hr-status-off' };
  };

  return (
    <div className="cms-hr cms-viewport-fill">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between shrink-0">
        <div className="min-w-0">
          <h2 className="cms-hr-title flex items-center gap-2">
            <span className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
              <Briefcase size={20} aria-hidden="true" />
            </span>
            <span className="truncate">Quản lý Nhân sự & Lương</span>
          </h2>
          <p className="cms-hr-caption mt-1 pl-12">
            {isSuperAdmin ? 'Toàn bộ chi nhánh' : `Chi nhánh ${sess?.branchCode || ''}`}
          </p>
        </div>
        <div className="flex flex-wrap items-stretch gap-2 w-full min-[480px]:w-auto">
          <button
            type="button"
            onClick={() => setShowSalaries(!showSalaries)}
            className={`cms-hr-btn flex-1 min-[480px]:flex-none ${
              showSalaries ? 'cms-hr-btn-amber' : 'cms-hr-btn-muted'
            }`}
          >
            {showSalaries ? <X size={14} /> : <QrCode size={14} />}
            {showSalaries ? 'Khóa bảo mật' : 'Xem số liệu'}
          </button>
          <button
            type="button"
            onClick={fetchAll}
            disabled={loading}
            className="cms-hr-btn cms-hr-btn-outline flex-1 min-[480px]:flex-none disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
          <div className="cms-hr-stat">
            <div className="cms-hr-stat-icon bg-red-100 text-red-600"><Users size={16} /></div>
            <p className="cms-hr-stat-value">{stats.total}</p>
            <p className="cms-hr-stat-label">Nhân viên đang làm</p>
          </div>
          <div className="cms-hr-stat">
            <div className="cms-hr-stat-icon bg-emerald-100 text-emerald-600"><DollarSign size={16} /></div>
            <p className="cms-hr-stat-value">{fmtSalary(stats.totalSalary)}</p>
            <p className="cms-hr-stat-label">Tổng quỹ lương/tháng</p>
          </div>
          <div className="cms-hr-stat">
            <div className="cms-hr-stat-icon bg-amber-100 text-amber-600"><CheckCircle2 size={16} /></div>
            <p className="cms-hr-stat-value">{fmtSalary(stats.paidThisMonth)}</p>
            <p className="cms-hr-stat-label">Đã trả tháng này</p>
          </div>
          <div className="cms-hr-stat">
            <div className="cms-hr-stat-icon bg-red-100 text-red-500"><AlertCircle size={16} /></div>
            <p className="cms-hr-stat-value text-red-600">
              {fmtSalary(Math.max(0, (stats.totalSalary || 0) - (stats.paidThisMonth || 0)))}
            </p>
            <p className="cms-hr-stat-label">Còn nợ tháng này</p>
          </div>
        </div>
      )}

      {/* ── Tab switcher ── */}
      <div className="cms-hr-tabs shrink-0" role="tablist" aria-label="Nhân sự">
        {[
          { id: 'list', label: 'Danh sách nhân sự', icon: ClipboardList },
          { id: 'payroll', label: 'Trả lương', icon: DollarSign },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={`cms-hr-tab ${activeTab === t.id ? 'is-active' : ''}`}
            >
              <Icon size={16} aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-[15px] text-red-700">
          <AlertCircle size={16} /> {error}
          <button type="button" onClick={() => setError('')} className="ml-auto w-11 h-11 flex items-center justify-center" aria-label="Đóng lỗi">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═══════════════ TAB 1: DANH SÁCH NHÂN SỰ ═══════════════ */}
      {activeTab === 'list' && (
        <div className="cms-hr-panel cms-viewport-scroll flex flex-col min-h-0">
          <div className="cms-hr-toolbar">
            <div className="relative w-full md:w-auto md:min-w-[220px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                placeholder="Tìm nhân viên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="cms-hr-input pl-10 w-full"
                aria-label="Tìm nhân viên"
              />
            </div>
            <CmsSelect
              value={posFilter}
              onChange={(e) => setPosFilter(e.target.value)}
              className="cms-hr-input w-full md:w-auto md:min-w-[180px]"
            >
              <option value="all">Tất cả chức vụ</option>
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>
              ))}
            </CmsSelect>
            <button type="button" onClick={openAdd} className="cms-hr-btn cms-hr-btn-primary self-center w-auto px-6 md:ml-auto md:self-auto">
              <Plus size={16} /> Thêm nhân sự
            </button>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden p-3 space-y-3">
            {loading && !filteredEmployees.length ? (
              <div className="text-center py-12 text-slate-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                <p className="text-[15px]">Đang tải...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Briefcase size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-[15px]">Chưa có nhân viên nào</p>
              </div>
            ) : filteredEmployees.map((emp) => {
              const st = statusLabel(emp.status);
              return (
                <article key={emp._id} className="cms-hr-emp-card">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-base font-bold flex-shrink-0">
                      {emp.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[16px] font-semibold text-slate-900 truncate">{emp.name}</p>
                          {emp.phone && <p className="text-[13px] text-slate-500 font-mono">{emp.phone}</p>}
                        </div>
                        <span className={`cms-hr-status ${st.cls}`}>{st.text}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-[14px]">
                        <p className="text-slate-600">
                          <span className="text-slate-400 text-[12px] font-semibold uppercase tracking-wide mr-1">Chức vụ</span>
                          {POSITION_MAP[emp.position]?.emoji || '📋'} {POSITION_MAP[emp.position]?.label || emp.position}
                        </p>
                        {(isSuperAdmin || emp.branchCode) && (
                          <p className="text-slate-600">
                            <span className="text-slate-400 text-[12px] font-semibold uppercase tracking-wide mr-1">Chi nhánh</span>
                            {emp.branchCode || '—'}
                          </p>
                        )}
                        <p className="text-slate-800 font-semibold">
                          <span className="text-slate-400 text-[12px] font-semibold uppercase tracking-wide mr-1">Mức lương</span>
                          {fmtSalary(emp.baseSalary)}
                        </p>
                        <p className="text-slate-600">
                          <span className="text-slate-400 text-[12px] font-semibold uppercase tracking-wide mr-1">Ngân hàng</span>
                          {emp.bankAccount?.bankCode
                            ? (BANK_MAP[emp.bankAccount.bankCode]?.shortName || emp.bankAccount.bankCode)
                            : 'Chưa có'}
                        </p>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => openEdit(emp)} className="cms-hr-btn cms-hr-btn-outline flex-1" title="Sửa">
                          <Edit3 size={15} /> Sửa
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm(emp)} className="cms-hr-btn cms-hr-btn-danger-ghost flex-1" title="Xóa">
                          <Trash2 size={15} /> Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Họ tên</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Chức vụ</th>
                  {isSuperAdmin && <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Chi nhánh</th>}
                  <th className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase">Mức lương</th>
                  <th className="px-4 py-3 text-center text-xs font-black text-gray-500 uppercase">Ngân hàng</th>
                  <th className="px-4 py-3 text-center text-xs font-black text-gray-500 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && !filteredEmployees.length ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" />Đang tải...</td></tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                    <Briefcase size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Chưa có nhân viên nào</p>
                  </td></tr>
                ) : filteredEmployees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-black flex-shrink-0">
                          {emp.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{emp.name}</p>
                          {emp.phone && <p className="text-xs text-gray-400">{emp.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                        {POSITION_MAP[emp.position]?.emoji || '📋'} {POSITION_MAP[emp.position]?.label || emp.position}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-4">
                        <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-semibold border border-teal-200">
                          🏢 {emp.branchCode || '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-4 text-right font-black text-gray-800">{fmtSalary(emp.baseSalary)}</td>
                    <td className="px-4 py-4 text-center">
                      {emp.bankAccount?.bankCode ? (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-100">
                          🏦 {BANK_MAP[emp.bankAccount.bankCode]?.shortName || emp.bankAccount.bankCode}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => openEdit(emp)} className="min-w-11 min-h-11 p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition" title="Sửa">
                          <Edit3 size={15} />
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm(emp)} className="min-w-11 min-h-11 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Xóa">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stats?.byPosition?.length > 0 && (
            <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-500 mb-2">PHÂN BỔ CHỨC VỤ</p>
              <div className="flex flex-wrap gap-2">
                {stats.byPosition.map((bp) => (
                  <span key={bp._id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white border border-gray-200 text-gray-600">
                    {POSITION_MAP[bp._id]?.emoji || '📋'} {POSITION_MAP[bp._id]?.label || bp._id}: {bp.count} ({fmtSalary(bp.salary)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB 2: TRẢ LƯƠNG ═══════════════ */}
      {activeTab === 'payroll' && (
        <div className="cms-viewport-scroll space-y-3 sm:space-y-4">
          <div className="cms-hr-panel overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <h3 className="cms-hr-heading flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-500" /> Thanh toán lương nhân viên
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {employees.filter((e) => e.status === 'active').length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-[15px]">Chưa có nhân viên</div>
              ) : employees.filter((e) => e.status === 'active').map((emp) => (
                <div key={emp._id} className="px-4 sm:px-6 py-3.5 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-black flex-shrink-0">
                      {POSITION_MAP[emp.position]?.emoji || '📋'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-[15px] truncate">{emp.name}</p>
                      <p className="text-[13px] text-slate-500 leading-snug">
                        {POSITION_MAP[emp.position]?.label || emp.position}
                        {emp.branchCode && ` · ${emp.branchCode}`}
                        {emp.baseSalary > 0 && ` · Lương: ${fmtSalary(emp.baseSalary)}`}
                        {emp.bankAccount?.bankCode && ` · 🏦 ${BANK_MAP[emp.bankAccount.bankCode]?.shortName || ''}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowPayModal(emp); setPayForm({ amount: String(emp.baseSalary || ''), payDate: new Date().toISOString().split('T')[0], note: '', monthLabel: `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}` }); }}
                    className="cms-hr-btn cms-hr-btn-pay w-full min-[480px]:w-auto"
                  >
                    <DollarSign size={14} /> Thanh toán
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="cms-hr-panel overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <h3 className="cms-hr-heading flex items-center gap-2">
                <Calendar size={16} className="text-blue-500" /> Lịch sử trả lương
              </h3>
            </div>

            {/* Mobile payroll cards */}
            <div className="md:hidden p-3 space-y-3">
              {payrollLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-[15px]">Chưa có lịch sử trả lương</div>
              ) : payrollLogs.map((log) => (
                <article key={log._id} className="cms-hr-emp-card space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold text-slate-900">{log.employeeName}</p>
                    <p className="text-[15px] font-bold text-emerald-700 whitespace-nowrap">{fmtSalary(log.amount)}</p>
                  </div>
                  <p className="text-[13px] text-slate-500">
                    {POSITION_MAP[log.position]?.emoji || ''} {POSITION_MAP[log.position]?.label || log.position}
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${log.salaryType === 'LUONG_CUNG' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {log.salaryType === 'LUONG_CUNG' ? '💼 Lương cứng' : '🏫 Ca dạy'}
                    </span>
                    <span className="text-[12px] text-slate-500">{fmtDate(log.payDate)}</span>
                  </div>
                  {(log.monthLabel || log.note) && (
                    <p className="text-[13px] text-slate-500">{log.monthLabel}{log.note ? ` — ${log.note}` : ''}</p>
                  )}
                </article>
              ))}
            </div>

            {/* Desktop payroll table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase">Nhân viên</th>
                    <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Chức vụ</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase">Số tiền</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-500 uppercase">Loại</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-gray-500 uppercase">Ngày trả</th>
                    <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payrollLogs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Chưa có lịch sử trả lương</td></tr>
                  ) : payrollLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-3 font-medium text-gray-800">{log.employeeName}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-bold">
                          {POSITION_MAP[log.position]?.emoji || ''} {POSITION_MAP[log.position]?.label || log.position}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-emerald-700">{fmtSalary(log.amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${log.salaryType === 'LUONG_CUNG' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                          {log.salaryType === 'LUONG_CUNG' ? '💼 Lương cứng' : '🏫 Ca dạy'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{fmtDate(log.payDate)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{log.monthLabel}{log.note ? ` — ${log.note}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: THÊM/SỬA NHÂN SỰ ═══════════════ */}
      {showForm && (
        <>
          <div className="cms-sheet-backdrop" onClick={() => setShowForm(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingEmp ? 'Chỉnh sửa Nhân viên' : 'Thêm Nhân viên mới'}
            className="cms-sheet cms-hr-sheet w-full md:max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
            <div className="cms-hr-sheet-header">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2 min-w-0">
                <Briefcase size={18} className="text-red-600 flex-shrink-0" />
                <span className="truncate">{editingEmp ? 'Chỉnh sửa Nhân viên' : 'Thêm Nhân viên mới'}</span>
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500" aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="cms-sheet-body space-y-5">
              <div>
                <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Users size={13} /> Thông tin cơ bản
                </p>
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3 sm:gap-4">
                  <div className="min-[480px]:col-span-2">
                    <label className="cms-hr-label">Họ tên *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="cms-hr-input w-full" placeholder="Nguyễn Văn A" />
                  </div>
                  <div>
                    <label className="cms-hr-label">Số điện thoại</label>
                    <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="cms-hr-input w-full" placeholder="0912345678" />
                  </div>
                  <div>
                    <label className="cms-hr-label">Chức vụ</label>
                    <CmsSelect value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                      className="cms-hr-input w-full">
                      {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>)}
                    </CmsSelect>
                  </div>
                  <div>
                    <label className="cms-hr-label">Mức lương (VNĐ/tháng)</label>
                    <input type="number" value={form.baseSalary} onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))}
                      className="cms-hr-input w-full" placeholder="5000000" />
                  </div>
                  <div>
                    <label className="cms-hr-label">Ngày vào làm</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                      className="cms-hr-input w-full" />
                  </div>
                  {isSuperAdmin && (
                    <div className="min-[480px]:col-span-2">
                      <label className="cms-hr-label">Chi nhánh</label>
                      <CmsSelect value={form.branchId} onChange={(e) => {
                        const br = branches.find((b) => String(b._id) === e.target.value);
                        setForm((f) => ({ ...f, branchId: e.target.value, branchCode: br?.code || br?.name || '' }));
                      }}
                        className="cms-hr-input w-full">
                        <option value="">— Chọn chi nhánh —</option>
                        {branches.map((b) => <option key={b._id} value={b._id}>🏢 {b.name} ({b.code})</option>)}
                      </CmsSelect>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CreditCard size={13} /> Thông tin thanh toán (VietQR)
                </p>
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3 sm:gap-4">
                  <div className="min-[480px]:col-span-2">
                    <label className="cms-hr-label">Ngân hàng</label>
                    <CmsSelect value={form.bankCode} onChange={(e) => setForm((f) => ({ ...f, bankCode: e.target.value }))}
                      className="cms-hr-input w-full">
                      <option value="">— Chọn ngân hàng —</option>
                      {VN_BANKS.map((b) => <option key={`${b.code}-${b.shortName}`} value={b.code}>🏦 {b.shortName} — {b.name}</option>)}
                    </CmsSelect>
                  </div>
                  <div>
                    <label className="cms-hr-label">Số tài khoản</label>
                    <input type="text" value={form.bankAccountNumber} onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
                      className="cms-hr-input w-full" placeholder="0123456789" />
                  </div>
                  <div>
                    <label className="cms-hr-label">Tên chủ tài khoản</label>
                    <input type="text" value={form.bankAccountName} onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value.toUpperCase() }))}
                      className="cms-hr-input w-full uppercase" placeholder="NGUYEN VAN A" />
                  </div>
                </div>
              </div>

              <div>
                <label className="cms-hr-label">Ghi chú</label>
                <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className="cms-hr-input w-full !h-auto py-3 resize-none min-h-[64px]" placeholder="Ghi chú tùy ý..." />
              </div>

              {form.position === 'GIANG_VIEN' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[13px] text-amber-700">
                  💡 Chức vụ <strong>Giảng viên</strong>: Đây là lương cứng hàng tháng. Tiền ca dạy sẽ được tính riêng ở module Giảng viên.
                </div>
              )}
            </div>
            <div className="cms-sheet-footer">
              <button type="button" onClick={() => setShowForm(false)} className="cms-hr-btn cms-hr-btn-outline flex-1">Hủy</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}
                className="cms-hr-btn cms-hr-btn-primary flex-[1.4] disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editingEmp ? 'Cập nhật' : 'Thêm nhân viên'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════ MODAL: THANH TOÁN LƯƠNG + VIETQR ═══════════════ */}
      {showPayModal && (
        <>
          <div className="cms-sheet-backdrop" onClick={() => setShowPayModal(null)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Thanh toán lương — ${showPayModal.name}`}
            className="cms-sheet cms-hr-sheet w-full md:max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
            <div className="cms-hr-sheet-header cms-hr-sheet-header-pay">
              <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2 min-w-0">
                <DollarSign size={18} className="flex-shrink-0" />
                <span className="truncate">Thanh toán — {showPayModal.name}</span>
              </h3>
              <button type="button" onClick={() => setShowPayModal(null)} className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center text-white" aria-label="Đóng">
                <X size={18} />
              </button>
            </div>

            <div className="cms-sheet-body !p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100">
                  {hasBankInfo ? (
                    <>
                      <div className="bg-white rounded-2xl shadow-lg p-3 mb-4">
                        <img
                          key={getVietQRUrl}
                          src={getVietQRUrl}
                          alt="VietQR Code"
                          className="w-52 h-52 sm:w-56 sm:h-56 object-contain"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                        <div className="w-52 h-52 sm:w-56 sm:h-56 items-center justify-center text-gray-400 text-sm text-center" style={{ display: 'none' }}>
                          <QrCode size={40} className="mx-auto mb-2 opacity-30" />
                          <p>Không tải được QR</p>
                        </div>
                      </div>
                      <div className="text-center space-y-1.5 w-full max-w-[240px]">
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Ngân hàng</p>
                          <p className="text-sm font-black text-gray-800">
                            {BANK_MAP[showPayModal.bankAccount.bankCode]?.shortName || showPayModal.bankAccount.bankCode}
                          </p>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Số tài khoản</p>
                          <p className="text-sm font-black text-gray-800 tracking-wider">{showPayModal.bankAccount.accountNumber}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Người nhận</p>
                          <p className="text-sm font-black text-gray-800 uppercase">{showPayModal.bankAccount.accountName || showPayModal.name}</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-gray-400 mt-3 text-center">QR tự động cập nhật khi thay đổi số tiền / ghi chú</p>
                    </>
                  ) : (
                    <div className="text-center py-8 px-2">
                      <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <AlertCircle size={28} className="text-amber-500" />
                      </div>
                      <p className="text-sm font-bold text-amber-700 mb-1">Chưa có thông tin ngân hàng</p>
                      <p className="text-xs text-gray-400 max-w-[220px] mx-auto">
                        Nhân viên này chưa cập nhật thông tin ngân hàng. Vui lòng cập nhật hồ sơ để sử dụng mã QR.
                      </p>
                      <button type="button" onClick={() => { setShowPayModal(null); openEdit(showPayModal); }}
                        className="mt-3 min-h-11 text-xs text-red-600 font-bold hover:underline">
                        → Cập nhật hồ sơ ngay
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-black text-emerald-700">
                      {showPayModal.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{showPayModal.name}</p>
                      <p className="text-xs text-gray-400">{POSITION_MAP[showPayModal.position]?.label || showPayModal.position} · Lương: {fmt(showPayModal.baseSalary)}</p>
                    </div>
                  </div>
                  <div>
                    <label className="cms-hr-label">Số tiền trả (VNĐ) *</label>
                    <input type="number" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                      className="cms-hr-input w-full" />
                    {payForm.amount && (
                      <p className="text-xs text-emerald-600 font-bold mt-1">= {fmt(payForm.amount)}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
                    <div>
                      <label className="cms-hr-label">Ngày trả</label>
                      <input type="date" value={payForm.payDate} onChange={(e) => setPayForm((f) => ({ ...f, payDate: e.target.value }))}
                        className="cms-hr-input w-full" />
                    </div>
                    <div>
                      <label className="cms-hr-label">Tháng lương</label>
                      <input type="text" value={payForm.monthLabel} onChange={(e) => setPayForm((f) => ({ ...f, monthLabel: e.target.value }))}
                        className="cms-hr-input w-full" placeholder="Tháng 4/2026" />
                    </div>
                  </div>
                  <div>
                    <label className="cms-hr-label">Ghi chú</label>
                    <textarea value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
                      className="cms-hr-input w-full !h-auto py-3 resize-none min-h-[64px]" placeholder="VD: Đã trừ 1 ngày nghỉ..." />
                  </div>
                </div>
              </div>
            </div>
            <div className="cms-sheet-footer">
              <button type="button" onClick={() => setShowPayModal(null)} className="cms-hr-btn cms-hr-btn-outline flex-1">Hủy</button>
              <button type="button" onClick={handlePay} disabled={saving || !payForm.amount}
                className="cms-hr-btn cms-hr-btn-pay flex-[1.4] disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Xác nhận thanh toán
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════ MODAL: XÁC NHẬN XÓA ═══════════════ */}
      {deleteConfirm && (
        <>
          <div className="cms-sheet-backdrop" onClick={() => setDeleteConfirm(null)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận xóa"
            className="cms-sheet cms-hr-sheet w-full md:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
            <div className="cms-hr-sheet-header cms-hr-sheet-header-danger">
              <h3 className="text-base font-semibold text-white flex items-center gap-2"><Trash2 size={18} /> Xác nhận xóa</h3>
              <button type="button" onClick={() => setDeleteConfirm(null)} className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center text-white" aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="cms-sheet-body">
              <p className="text-[15px] text-gray-600">Bạn có chắc muốn xóa nhân viên <strong>{deleteConfirm.name}</strong>?</p>
            </div>
            <div className="cms-sheet-footer">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="cms-hr-btn cms-hr-btn-outline flex-1">Hủy</button>
              <button type="button" onClick={handleDelete} className="cms-hr-btn cms-hr-btn-danger flex-1">Xóa</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

