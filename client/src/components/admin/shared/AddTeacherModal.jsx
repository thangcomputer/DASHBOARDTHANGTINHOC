import React from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { GraduationCap, X, MapPin } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import ExamSubjectCheckboxGrid from './ExamSubjectCheckboxGrid';
import { formatSubjectIdsAsSpecialty } from '../../../utils/examSubjects';

const inputClass =
  'w-full bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[20px] p-4 font-bold text-gray-800 outline-none transition-all shadow-sm';

export default function AddTeacherModal({
  teacherForm, setTeacherForm, onClose, onSubmit, isSuperAdmin, safeBranches,
}) {
  const { examSubjectsCatalog } = useData() || {};
  const branches = (safeBranches || []).filter((b) => b && b.isActive !== false);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[min(92vh,920px)]">
        {/* Header — cùng kiểu modal học viên, màu xanh GV */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 flex items-center justify-between flex-shrink-0">
          <h3 className="text-white font-black text-xl sm:text-2xl flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md">
              <GraduationCap size={28} />
            </div>
            Thêm Giảng viên mới
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 sm:p-10 overflow-y-auto w-full flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            {/* Cột 1: Thông tin cá nhân */}
            <div className="space-y-5 md:border-r border-gray-100 md:pr-10">
              <h4 className="font-black text-gray-400 text-xs mb-2 flex items-center gap-2 uppercase tracking-[0.2em]">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs shadow-lg shadow-blue-200">1</span>
                Thông tin Cá nhân
              </h4>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={teacherForm.name}
                  onChange={(e) => setTeacherForm((p) => ({ ...p, name: e.target.value }))}
                  className={inputClass}
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">
                  Số điện thoại / Zalo (đăng nhập) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={teacherForm.phone}
                  onChange={(e) => setTeacherForm((p) => ({ ...p, phone: e.target.value }))}
                  className={`${inputClass} font-mono`}
                  placeholder="0912345678"
                />
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Email</label>
                <input
                  type="email"
                  value={teacherForm.email || ''}
                  onChange={(e) => setTeacherForm((p) => ({ ...p, email: e.target.value }))}
                  className={inputClass}
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Ngày vào làm</label>
                <input
                  type="date"
                  value={teacherForm.startDate}
                  onChange={(e) => setTeacherForm((p) => ({ ...p, startDate: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Địa chỉ</label>
                <input
                  type="text"
                  value={teacherForm.address}
                  onChange={(e) => setTeacherForm((p) => ({ ...p, address: e.target.value }))}
                  className={inputClass}
                  placeholder="VD: 123 Đường ABC, Quận X..."
                />
              </div>
            </div>

            {/* Cột 2: Chuyên môn & chi nhánh */}
            <div className="space-y-5 md:pl-2">
              <h4 className="font-black text-gray-400 text-xs mb-2 flex items-center gap-2 uppercase tracking-[0.2em]">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs shadow-lg shadow-slate-200">2</span>
                Chuyên môn & Chi nhánh
              </h4>

              <div>
                <ExamSubjectCheckboxGrid
                  catalog={examSubjectsCatalog}
                  value={teacherForm.subjectIds || []}
                  accent="blue"
                  onChange={(ids) => setTeacherForm((p) => ({
                    ...p,
                    subjectIds: ids,
                    specialty: formatSubjectIdsAsSpecialty(ids, examSubjectsCatalog),
                  }))}
                />
                {teacherForm.specialty && (
                  <p className="text-xs text-blue-600 mt-2 font-semibold">Chuyên môn: {teacherForm.specialty}</p>
                )}
              </div>

              {isSuperAdmin ? (
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                    <MapPin size={12} /> Chi nhánh
                  </label>
                  <CmsSelect
                    value={teacherForm.branchId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      const b = branches.find((x) => String(x._id) === String(id));
                      setTeacherForm((p) => ({
                        ...p,
                        branchId: id,
                        branchCode: b?.code || '',
                      }));
                    }}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="">— Chưa phân chi nhánh —</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}{b.code ? ` (${b.code})` : ''}
                      </option>
                    ))}
                  </CmsSelect>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Chi nhánh</label>
                  <input
                    type="text"
                    readOnly
                    value="Chi nhánh hiện tại (tự gán)"
                    className="w-full border-2 border-gray-100 rounded-[20px] p-4 text-sm bg-gray-50 text-gray-500 cursor-not-allowed font-bold"
                  />
                </div>
              )}

              <p className="text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded-2xl p-4 leading-relaxed">
                Giảng viên sau khi được tạo sẽ ở trạng thái <strong>&quot;Chưa cấp quyền&quot; (Inactive)</strong>.
                Admin cần duyệt cấp quyền thì họ mới có thể đăng nhập bằng SĐT.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-10 py-4 bg-white border-2 border-gray-100 rounded-[22px] text-xs font-black text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all uppercase"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="px-12 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-[22px] text-xs font-black tracking-widest shadow-xl shadow-blue-200 hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all uppercase active:scale-95"
            >
              Thêm giảng viên
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
