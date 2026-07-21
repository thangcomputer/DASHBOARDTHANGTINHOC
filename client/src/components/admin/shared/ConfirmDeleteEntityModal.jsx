import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

/** Confirm delete student or teacher. */
export default function ConfirmDeleteEntityModal({ modal, onCancel, onConfirm }) {
  if (!modal) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-[scaleIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-5 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Trash2 size={32} className="text-white" />
          </div>
          <h3 className="text-white font-black text-lg">Xác nhận xoá</h3>
          <p className="text-red-100 text-sm mt-1">{modal.type === 'teacher' ? 'Giảng viên' : 'Học viên'}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-800 font-bold text-base">{modal.name}</p>
            <p className="text-red-600 text-xs mt-1">ID: {modal.id}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <p className="text-orange-700 text-sm font-semibold flex items-center gap-2">
              <AlertTriangle size={16} />
              Hành động này không thể hoàn tác!
            </p>
            <p className="text-orange-600 text-xs mt-1">
              Tất cả dữ liệu liên quan sẽ bị xoá vĩnh viễn.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-3.5 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all text-sm">
            Huỷ bỏ
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-bold hover:from-red-700 transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-red-200">
            <Trash2 size={16} /> Xoá ngay
          </button>
        </div>
      </div>
    </div>
  );
}
