const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '../client/src/components/admin/shared');
fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, 'ConfirmDeleteTrainingModal.jsx'), `import React from 'react';
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
`, 'utf8');

fs.writeFileSync(path.join(OUT, 'ConfirmDeleteEntityModal.jsx'), `import React from 'react';
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
`, 'utf8');

fs.writeFileSync(path.join(OUT, 'GrantAccessModal.jsx'), `import React from 'react';
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
`, 'utf8');

console.log('modals written');