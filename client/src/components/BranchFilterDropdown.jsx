/**
 * BranchFilterDropdown.jsx — Dropdown chọn Chi nhánh (Topbar)
 * Chỉ hiện khi SUPER_ADMIN / STAFF ở module có phân vùng chi nhánh.
 */
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useBranch } from '../context/BranchContext';

const BRANCH_VISIBLE_HASHES = [
  'dashboard',
  'students',
  'teachers',
  'evaluations',
  'finance',
  'system-logs',
  'hr',
  'analytics',
  'bi',
];

export default function BranchFilterDropdown({ className = '', fullWidth = false }) {
  const { selectedBranchId, selectedBranchName, branches, setSelectedBranch, isSuperAdmin, isStaff, isLoadingBranches } = useBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  const HIDDEN_PATHS = ['/admin/inbox', '/admin/settings'];
  const isHiddenPath = HIDDEN_PATHS.some((p) => location.pathname.startsWith(p));
  const currentHash = location.hash?.replace('#', '') || (location.pathname === '/admin' ? 'dashboard' : '');
  const showDropdown = !isHiddenPath && (
    BRANCH_VISIBLE_HASHES.includes(currentHash) ||
    location.pathname.startsWith('/admin/bi')
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const widthCls = fullWidth ? 'w-full max-w-none' : 'max-w-[9.5rem] sm:max-w-[11rem]';
  const heightCls = fullWidth ? 'h-11 rounded-xl text-sm' : 'h-9 rounded-lg text-xs';

  if (isStaff) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 border border-slate-200 bg-white text-slate-600 ${heightCls} ${widthCls} ${className}`}>
        <Building2 size={14} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
        <span className="font-semibold truncate">{selectedBranchName}</span>
      </div>
    );
  }

  if (!isSuperAdmin || !showDropdown) return null;

  const handleSelect = (id, name) => {
    setSelectedBranch(id, name);
    setOpen(false);
  };

  const activeBranches = branches.filter((b) => b && b.isActive !== false);
  const isFiltered = selectedBranchId && selectedBranchId !== 'all';

  return (
    <div ref={ref} className={`relative min-w-0 z-50 ${fullWidth ? 'w-full' : 'max-w-full'} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Lọc theo chi nhánh"
        className={`inline-flex items-center gap-1.5 px-2.5 border font-semibold transition-colors min-w-0 ${heightCls} ${widthCls} ${
          isFiltered
            ? 'border-slate-300 bg-slate-50 text-slate-800'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
        }`}
      >
        <Building2 size={14} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left truncate min-w-0">
          {isLoadingBranches ? 'Đang tải...' : selectedBranchName}
        </span>
        <ChevronDown size={13} className={`flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Danh sách chi nhánh"
          className="absolute top-[calc(100%+6px)] right-0 w-[min(240px,calc(100vw-1.5rem))] bg-white rounded-xl border border-slate-200 shadow-cms-lg overflow-hidden z-50"
        >
          <p className="text-[11px] font-semibold text-slate-500 px-3.5 pt-2.5 pb-1.5 border-b border-slate-100">
            Chi nhánh
          </p>

          <button
            type="button"
            onClick={() => handleSelect('all', 'Tất cả chi nhánh')}
            className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] transition-colors ${
              !isFiltered ? 'bg-slate-50 text-slate-900 font-semibold' : 'text-slate-600 font-medium hover:bg-slate-50'
            }`}
          >
            <span>Tất cả chi nhánh</span>
            {!isFiltered && <Check size={13} className="text-slate-700" aria-hidden="true" />}
          </button>

          {activeBranches.length === 0 && (
            <div className="px-3.5 py-2.5 text-xs text-slate-400 text-center">Chưa có chi nhánh</div>
          )}

          {activeBranches.map((b) => {
            const isSelected = selectedBranchId === b._id;
            return (
              <button
                key={b._id}
                type="button"
                onClick={() => handleSelect(b._id, b.name)}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] border-t border-slate-50 transition-colors ${
                  isSelected ? 'bg-slate-50 text-slate-900 font-semibold' : 'text-slate-600 font-medium hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{b.name}</span>
                  {b.code && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
                      {b.code}
                    </span>
                  )}
                </span>
                {isSelected && <Check size={13} className="text-slate-700 flex-shrink-0" aria-hidden="true" />}
              </button>
            );
          })}

          {isFiltered && (
            <div className="border-t border-slate-100 p-2">
              <button
                type="button"
                onClick={() => handleSelect('all', 'Tất cả chi nhánh')}
                className="w-full py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
