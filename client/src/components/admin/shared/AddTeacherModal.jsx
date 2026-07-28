import React from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { GraduationCap, X, MapPin } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import ExamSubjectCheckboxGrid from './ExamSubjectCheckboxGrid';
import { formatSubjectIdsAsSpecialty } from '../../../utils/examSubjects';

const inputClass = 'cms-input';

export default function AddTeacherModal({
  teacherForm, setTeacherForm, onClose, onSubmit, isSuperAdmin, safeBranches,
}) {
  const { examSubjectsCatalog } = useData() || {};
  const branches = (safeBranches || []).filter((b) => b && b.isActive !== false);

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thêm Giảng viên mới"
        className="cms-sheet w-full md:max-w-3xl"
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-sky-50 text-sky-600" aria-hidden="true">
            <GraduationCap size={18} />
          </span>
          <h3 className="cms-sheet-header__title">Thêm giảng viên mới</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cms-sheet-body space-y-6">
          <section className="cms-form">
            <div className="cms-step">
              <span className="cms-step__num">1</span>
              <span className="cms-step__label">Thông tin cá nhân</span>
            </div>

            <div>
              <label className="cms-label">Họ tên <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={teacherForm.name}
                onChange={(e) => setTeacherForm((p) => ({ ...p, name: e.target.value }))}
                className={inputClass}
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div>
              <label className="cms-label">Số điện thoại / Zalo (đăng nhập) <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={teacherForm.phone}
                onChange={(e) => setTeacherForm((p) => ({ ...p, phone: e.target.value }))}
                className={`${inputClass} font-mono`}
                placeholder="0912345678"
              />
            </div>

            <div>
              <label className="cms-label">Email</label>
              <input
                type="email"
                value={teacherForm.email || ''}
                onChange={(e) => setTeacherForm((p) => ({ ...p, email: e.target.value }))}
                className={inputClass}
                placeholder="email@example.com"
              />
            </div>

            <div className="cms-form-row">
              <div>
                <label className="cms-label">Ngày vào làm</label>
                <input
                  type="date"
                  value={teacherForm.startDate}
                  onChange={(e) => setTeacherForm((p) => ({ ...p, startDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="cms-label">Địa chỉ</label>
                <input
                  type="text"
                  value={teacherForm.address}
                  onChange={(e) => setTeacherForm((p) => ({ ...p, address: e.target.value }))}
                  className={inputClass}
                  placeholder="VD: 123 Đường ABC, Quận X..."
                />
              </div>
            </div>
          </section>

          <section className="cms-form">
            <div className="cms-step">
              <span className="cms-step__num cms-step__num--muted">2</span>
              <span className="cms-step__label">Chuyên môn &amp; chi nhánh</span>
            </div>

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
                <p className="text-[12px] text-sky-700 mt-2 font-semibold">Chuyên môn: {teacherForm.specialty}</p>
              )}
            </div>

            {isSuperAdmin ? (
              <div>
                <label className="cms-label flex items-center gap-1.5">
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
                <label className="cms-label">Chi nhánh</label>
                <input
                  type="text"
                  readOnly
                  value="Chi nhánh hiện tại (tự gán)"
                  className="cms-input opacity-70 cursor-not-allowed"
                />
              </div>
            )}

            <p className="text-[13px] text-slate-600 bg-sky-50 border border-sky-100 rounded-xl p-3.5 leading-relaxed">
              Giảng viên sau khi được tạo sẽ ở trạng thái <strong>&quot;Chưa cấp quyền&quot; (Inactive)</strong>.
              Admin cần duyệt cấp quyền thì họ mới có thể đăng nhập bằng SĐT.
            </p>
          </section>
        </div>

        <div className="cms-sheet-footer">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">
            Hủy
          </button>
          <button type="button" onClick={onSubmit} className="cms-btn cms-btn-primary">
            <GraduationCap size={16} /> Lưu
          </button>
        </div>
      </div>
    </>
  );
}
