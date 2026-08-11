/**
 * BranchContext.jsx — Global Branch Filter Context
 *
 * SUPER_ADMIN / HIGH_ADMIN: mặc định "Tất cả chi nhánh"; có thể chọn 1 CN.
 * STAFF: khóa theo branchId tài khoản.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const BranchContext = createContext({
  selectedBranchId: 'all',
  selectedBranchName: 'Tất cả chi nhánh',
  branches: [],
  setSelectedBranch: () => {},
  branchQueryParam: '',        // '?branch_id=xxx' hoặc ''
  isLoadingBranches: false,
});

const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");

function getToken() {
  for (const role of ['admin', 'staff']) {
    const t = localStorage.getItem(`${role}_access_token`);
    if (t) return t;
    const s = localStorage.getItem(`${role}_user`);
    if (s) { try { const u = JSON.parse(s); if (u?.token) return u.token; } catch {} }
  }
  return '';
}

export function BranchProvider({ session, children }) {
  const [selectedBranchId,   setSelectedBranchId]   = useState('all');
  const [selectedBranchName, setSelectedBranchName] = useState('Tất cả chi nhánh');
  const [branches,           setBranches]            = useState([]);
  const [isLoadingBranches,  setIsLoadingBranches]   = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState(() => {
    try { return localStorage.getItem('selected_tenant_id') || 'all'; } catch { return 'all'; }
  });
  const [tenants, setTenants] = useState([]);

  const isSuperAdmin = session?.id === 'admin' || session?.adminRole === 'SUPER_ADMIN';
  const isHighAdmin  = session?.adminRole === 'HIGH_ADMIN';
  const isStaff      = session?.adminRole === 'STAFF';
  const staffBranchId = session?.branchId;

  // 🛡️ ARCHITECTURAL LOCK: STAFF luôn bị khóa tại chi nhánh của họ
  useEffect(() => {
    if (isStaff && staffBranchId) {
      setSelectedBranchId(staffBranchId);
      // Tìm tên chi nhánh nếu có trong list
      const br = branches.find(b => String(b._id) === String(staffBranchId));
      if (br) setSelectedBranchName(br.name);
    }
  }, [isStaff, staffBranchId, branches]);

  // HIGH_ADMIN: giữ mặc định "Tất cả chi nhánh" (state init).
  // Không auto-ép về chi nhánh nhà / branches[0] — user chọn CN cụ thể khi cần.

  const setSelectedTenant = useCallback((id) => {
    const next = id || 'all';
    setSelectedTenantId(next);
    try {
      if (next === 'all') localStorage.removeItem('selected_tenant_id');
      else localStorage.setItem('selected_tenant_id', next);
    } catch { /* ignore */ }
    setSelectedBranchId('all');
    setSelectedBranchName('Tất cả chi nhánh');
  }, []);

  // Load tenants (Super Admin) + tự reset nếu ID trong localStorage không còn hợp lệ
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch(`${API}/api/tenants`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((res) => {
        const list = res.success ? (res.data || []) : [];
        setTenants(list);
        if (selectedTenantId && selectedTenantId !== 'all') {
          const ok = list.some(
            (t) => String(t._id || t.id) === String(selectedTenantId) && t.status !== 'suspended',
          );
          if (!ok) setSelectedTenant('all');
        }
      })
      .catch(() => {});
  }, [isSuperAdmin, selectedTenantId, setSelectedTenant]);

  useEffect(() => {
    const onCleared = () => setSelectedTenant('all');
    window.addEventListener('cms:tenant-cleared', onCleared);
    return () => window.removeEventListener('cms:tenant-cleared', onCleared);
  }, [setSelectedTenant]);

  // Load branches khi mount / doi tenant
  useEffect(() => {
    setIsLoadingBranches(true);
    const headers = { Authorization: `Bearer ${getToken()}` };
    if (selectedTenantId && selectedTenantId !== 'all') {
      headers['X-Tenant-Id'] = selectedTenantId;
    }
    fetch(`${API}/api/branches`, { headers })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setBranches(res.data || []);
          localStorage.setItem('thvp_branches', JSON.stringify(res.data || []));
        } else if (String(res.message || '').includes('tenant')) {
          setSelectedTenant('all');
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingBranches(false));
  }, [selectedTenantId, setSelectedTenant]);

  const setSelectedBranch = useCallback((id, name) => {
    if (isStaff) return;
    const nextId = id || 'all';
    setSelectedBranchId(nextId);
    setSelectedBranchName(name || (nextId === 'all' ? 'Tất cả chi nhánh' : 'Chi nhánh'));
  }, [isStaff]);

  const branchQueryParam = selectedBranchId && selectedBranchId !== 'all'
    ? `branch_id=${selectedBranchId}`
    : '';

  return (
    <BranchContext.Provider value={{
      selectedBranchId,
      selectedBranchName,
      branches,
      setSelectedBranch,
      branchQueryParam,
      isLoadingBranches,
      isSuperAdmin,
      isHighAdmin,
      isStaff,
      selectedTenantId,
      setSelectedTenant,
      tenants,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
