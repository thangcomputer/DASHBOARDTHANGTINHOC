import React from 'react';
import { Trash2, X } from 'lucide-react';

/** Confirm delete training item (video/guide/file). */
export default function ConfirmDeleteTrainingModal({ item, onCancel, onConfirm }) {
  if (!item) return null;
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
        <div className="cms-sheet-body space-y-2">
          <p className="text-sm text-slate-700 text-center leading-relaxed">
            Bạn có chắc muốn xoá <strong>&quot;{item.title}&quot;</strong>?
          </p>
          <p className="text-[12px] text-slate-400 text-center">Hành động này không thể hoàn tác.</p>
        </div>
        <div className="cms-sheet-footer">
          <button type="button" onClick={onCancel} className="cms-btn cms-btn-outline">Huỷ</button>
          <button type="button" onClick={onConfirm} className="cms-btn cms-btn-primary">Xoá ngay</button>
        </div>
      </div>
    </>
  );
}
