import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

/** Confirm delete student or teacher. */
export default function ConfirmDeleteEntityModal({ modal, onCancel, onConfirm }) {
  if (!modal) return null;
  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onCancel} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Xác nhận xoá"
        className="cms-sheet w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-red-50 text-red-600" aria-hidden="true">
            <Trash2 size={18} />
          </span>
          <h3 className="cms-sheet-header__title">Xác nhận xoá</h3>
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
          <p className="text-center text-[12px] text-slate-500">
            {modal.type === 'teacher' ? 'Giảng viên' : 'Học viên'}
          </p>
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
            <p className="text-red-800 font-semibold text-base">{modal.name}</p>
            <p className="text-red-600 text-[12px] mt-1">ID: {modal.id}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-amber-800 text-sm font-semibold flex items-center gap-2">
              <AlertTriangle size={16} />
              Hành động này không thể hoàn tác!
            </p>
            <p className="text-amber-700 text-[12px] mt-1">
              Tất cả dữ liệu liên quan sẽ bị xoá vĩnh viễn.
            </p>
          </div>
        </div>
        <div className="cms-sheet-footer">
          <button type="button" onClick={onCancel} className="cms-btn cms-btn-outline">Huỷ bỏ</button>
          <button type="button" onClick={onConfirm} className="cms-btn cms-btn-primary">
            <Trash2 size={16} /> Xoá ngay
          </button>
        </div>
      </div>
    </>
  );
}
