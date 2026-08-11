/**
 * BranchFilterDropdown.jsx — Dropdown chọn Chi nhánh (Topbar)
 * SUPER_ADMIN / HIGH_ADMIN: chọn chi nhánh (mặc định "Tất cả chi nhánh").
 * STAFF: chỉ hiện nhãn chi nhánh đã khóa.
 */
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const {
    selectedBranchId,
    selectedBranchName,
    branches,
    setSelectedBranch,
    isSuperAdmin,
    isHighAdmin,
    isStaff,
    isLoadingBranches,
  } = useBranch();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 240 });
  const ref = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const location = useLocation();

  const HIDDEN_PATHS = ['/admin/inbox', '/admin/settings'];
  const isHiddenPath = HIDDEN_PATHS.some((p) => location.pathname.startsWith(p));
  const currentHash = location.hash?.replace('#', '') || (location.pathname === '/admin' ? 'dashboard' : '');
  const showDropdown = !isHiddenPath && (
    BRANCH_VISIBLE_HASHES.includes(currentHash) ||
    location.pathname.startsWith('/admin/bi')
  );
  const canPickBranch = isSuperAdmin || isHighAdmin;

  // Đóng khi mở sidebar mobile (tránh dropdown đè menu)
  useEffect(() => {
    if (!open) return;
    const closeIfMenuOpen = () => {
      if (document.body.classList.contains('cms-menu-open')) setOpen(false);
    };
    closeIfMenuOpen();
    const obs = new MutationObserver(closeIfMenuOpen);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e) => {
      const t = e.target;
      if (ref.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer, { passive: true });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const r = btnRef.current.getBoundingClientRect();
      const width = fullWidth
        ? Math.min(r.width, window.innerWidth - 16)
        : Math.min(260, window.innerWidth - 16);
      let left = fullWidth ? r.left : r.right - width;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      const top = Math.min(r.bottom + 6, window.innerHeight - 12);
      setMenuPos({ top, left, width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, fullWidth]);

  const widthCls = fullWidth ? 'w-full max-w-none' : 'max-w-[9.5rem] sm:max-w-[11rem]';
  const heightCls = fullWidth ? 'h-11 rounded-xl text-sm' : 'h-9 rounded-lg text-xs';

  if (isStaff) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 border border-slate-200 bg-white text-slate-600 ${heightCls} ${widthCls} ${className}`}>
        <Building2 size={14} className="text-slate-400 flex-shrink-0" aria-hidden="true" />
        <span className="font-semibold truncate" title={selectedBranchName}>{selectedBranchName}</span>
      </div>
    );
  }

  if (!canPickBranch || !showDropdown) return null;

  const handleSelect = (id, name) => {
    setSelectedBranch(id, name);
    setOpen(false);
  };

  const activeBranches = branches.filter((b) => b && b.isActive !== false);
  const isFiltered = selectedBranchId && selectedBranchId !== 'all';
  const allowAllBranches = isSuperAdmin || isHighAdmin;

  const menu = open
    ? createPortal(
      <div
        ref={menuRef}
        role="listbox"
        aria-label="Danh sách chi nhánh"
        className="fixed z-[55] bg-white rounded-2xl border border-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.14)] overflow-hidden max-h-[min(60dvh,360px)] overflow-y-auto overscroll-contain"
        style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
      >
        <p className="text-[11px] font-semibold text-slate-500 px-3.5 pt-2.5 pb-1.5 border-b border-slate-100 sticky top-0 bg-white z-10">
          Chi nhánh
        </p>

        {allowAllBranches && (
          <button
            type="button"
            role="option"
            aria-selected={!isFiltered}
            onClick={() => handleSelect('all', 'Tất cả chi nhánh')}
            className={`w-full flex items-center justify-between gap-2 px-3.5 min-h-11 text-left text-[13px] transition-colors ${
              !isFiltered ? 'bg-slate-50 text-slate-900 font-semibold' : 'text-slate-600 font-medium hover:bg-slate-50'
            }`}
          >
            <span>Tất cả chi nhánh</span>
            {!isFiltered && <Check size={13} className="text-slate-700" aria-hidden="true" />}
          </button>
        )}

        {activeBranches.length === 0 && (
          <div className="px-3.5 py-2.5 text-xs text-slate-400 text-center">Chưa có chi nhánh</div>
        )}

        {activeBranches.map((b) => {
          const isSelected = String(selectedBranchId) === String(b._id);
          return (
            <button
              key={b._id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(b._id, b.name)}
              className={`w-full flex items-center justify-between gap-2 px-3.5 min-h-11 text-left text-[13px] border-t border-slate-50 transition-colors ${
                isSelected ? 'bg-slate-50 text-slate-900 font-semibold' : 'text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="truncate" title={b.name}>{b.name}</span>
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

        {allowAllBranches && isFiltered && (
          <div className="border-t border-slate-100 p-2 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => handleSelect('all', 'Tất cả chi nhánh')}
              className="w-full min-h-11 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>,
      document.body
    )
    : null;

  return (
    <div ref={ref} className={`relative min-w-0 ${fullWidth ? 'w-full' : 'max-w-full'} ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (document.body.classList.contains('cms-menu-open')) return;
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Lọc theo chi nhánh"
        title={selectedBranchName}
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
      {menu}
    </div>
  );
}
