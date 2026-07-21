import React from 'react';
import { GraduationCap, X, MapPin } from 'lucide-react';

export default function AddTeacherModal({
  teacherForm, setTeacherForm, onClose, onSubmit, isSuperAdmin, safeBranches,
}) {
  return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><GraduationCap size={18} /> Thêm Giảng viên mới</h3>
              <button onClick={onClose}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Họ tên</label>
                <input type="text" value={teacherForm.name} onChange={e => setTeacherForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Số điện thoại / Zalo (dùng đăng nhập)</label>
                <input type="text" value={teacherForm.phone} onChange={e => setTeacherForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" placeholder="0912345678" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Chuyên môn</label>
                <input type="text" value={teacherForm.specialty} onChange={e => setTeacherForm(p => ({ ...p, specialty: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" placeholder="Excel, Word, PowerPoint" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Email</label>
                <input type="email" value={teacherForm.email || ''} onChange={e => setTeacherForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" placeholder="email@example.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Ngày vào làm</label>
                <input type="date" value={teacherForm.startDate} onChange={e => setTeacherForm(p => ({ ...p, startDate: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Địa chỉ</label>
                <input type="text" value={teacherForm.address} onChange={e => setTeacherForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" placeholder="VD: 123 Đường ABC, Quận X..." />
              </div>

              {/* ⭐ Chi nhánh — SUPER_ADMIN chọn, STAFF auto-fill */}
              {(() => {
                const sess = JSON.parse(localStorage.getItem('admin_user') || localStorage.getItem('staff_user') || '{}');
                const isSA = sess?.id === 'admin' || sess?.adminRole === 'SUPER_ADMIN';
                if (isSA) {
                  // SUPER_ADMIN: dropdown chọn chi nhánh
                  return (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Chi nhánh</label>
                      <select
                        value={teacherForm.branchId || ''}
                        onChange={e => {
                          const opt = e.target.selectedOptions[0];
                          setTeacherForm(p => ({ ...p, branchId: e.target.value, branchCode: opt?.dataset.code || '' }));
                        }}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none"
                      >
                        <option value="">— Chưa phân chi nhánh —</option>
                        {(JSON.parse(localStorage.getItem('thvp_branches') || '[]')).map(b => (
                          <option key={b._id} value={b._id} data-code={b.code}>{b.name} ({b.code})</option>
                        ))}
                      </select>
                    </div>
                  );
                } else {
                  // STAFF: auto-fill, read-only
                  return (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Chi nhánh</label>
                      <input type="text" readOnly value={sess?.branchCode ? `Cơ sở ${sess.branchCode}` : 'Chi nhánh hiện tại'}
                        className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                  );
                }
              })()}

              <p className="text-xs text-gray-400 bg-blue-50 rounded-xl p-3">
                💡 Giảng viên sau khi được tạo sẽ ở trạng thái <strong>"Chưa cấp quyền" (Inactive)</strong>. Admin cần duyệt <i>Cấp quyền thi</i> thì họ mới có thể đăng nhập bằng SĐT.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50">Huỷ</button>
              <button onClick={onSubmit} className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold hover:from-blue-700">Thêm giảng viên</button>
            </div>
          </div>
        </div>
  );
}
