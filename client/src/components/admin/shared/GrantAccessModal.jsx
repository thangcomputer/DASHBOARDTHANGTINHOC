import React from 'react';
import { Unlock, X } from 'lucide-react';

/** Confirm grant exam access for a teacher. */
export default function GrantAccessModal({ modal, onCancel, onConfirm }) {
  if (!modal) return null;
  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onCancel} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Xác nhận cấp truy cập"
        className="cms-sheet w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-sky-50 text-sky-600" aria-hidden="true">
            <Unlock size={18} />
          </span>
          <h3 className="cms-sheet-header__title">Xác nhận cấp truy cập</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="cms-sheet-body space-y-4">
          <p className="text-sm text-slate-600 text-center leading-relaxed">
            Bạn có chắc chắn muốn cấp lại quyền truy cập cho Giảng viên này?
          </p>
          <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-center">
            <p className="text-sky-800 font-semibold text-base">{modal.name}</p>
          </div>
        </div>
        <div className="cms-sheet-footer">
          <button type="button" onClick={onCancel} className="cms-btn cms-btn-outline">Hủy</button>
          <button type="button" onClick={onConfirm} className="cms-btn cms-btn-primary">Xác nhận cấp</button>
        </div>
      </div>
    </>
  );
}
