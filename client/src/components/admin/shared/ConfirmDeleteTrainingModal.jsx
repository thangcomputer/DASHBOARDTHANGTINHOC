import React from 'react';
import { Trash2 } from 'lucide-react';

/** Confirm delete training item (video/guide/file). */
export default function ConfirmDeleteTrainingModal({ item, onCancel, onConfirm }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4">
          <h3 className="text-white font-bold flex items-center gap-2"><Trash2 size={18} /> Xác nhận xoá</h3>
        </div>
        <div className="p-6">
          <p className="text-gray-700">Bạn có chắc muốn xoá <strong>"{item.title}"</strong>?</p>
          <p className="text-xs text-gray-400 mt-1">Hành động này không thể hoàn tác.</p>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition">Huỷ</button>
          <button type="button" onClick={onConfirm}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition">Xoá ngay</button>
        </div>
      </div>
    </div>
  );
}
