import React from 'react';
import { Unlock } from 'lucide-react';

/** Confirm grant exam access for a teacher. */
export default function GrantAccessModal({ modal, onCancel, onConfirm }) {
  if (!modal) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-[scaleIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-5 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Unlock size={24} className="text-white" />
          </div>
          <h3 className="text-xl font-black text-white">Xác nhận cấp truy cập</h3>
        </div>
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-gray-600 text-sm mb-4">Bạn có chắc chắn muốn cấp lại quyền truy cập cho Giảng viên này?</p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-blue-800 font-bold text-base">{modal.name}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel}
              className="flex-1 py-3.5 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all text-sm">
              Hủy
            </button>
            <button type="button" onClick={onConfirm}
              className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white shadow-lg shadow-blue-200 transition-all text-sm">
              Xác nhận cấp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
