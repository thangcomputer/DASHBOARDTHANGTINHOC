import React from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { GraduationCap, X, MapPin, DollarSign, Star, Info } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import ExamSubjectCheckboxGrid from './ExamSubjectCheckboxGrid';
import { formatSubjectIdsAsSpecialty } from '../../../utils/examSubjects';
import {
  formatHoaHong,
  formatStarBonusRule,
  STAR_BONUS_AMOUNT,
  STAR_BONUS_MIN_STARS,
  STAR_BONUS_MIN_STUDENTS,
} from '../../../utils/teacherCommission';

const SALARY_PRESETS = [100000, 130000, 150000, 180000];

export default function AddTeacherModal({
  teacherForm, setTeacherForm, onClose, onSubmit, isSuperAdmin, safeBranches,
}) {
  const { examSubjectsCatalog } = useData() || {};
  const branches = (safeBranches || []).filter((b) => b && b.isActive !== false);
  const salary = Number(teacherForm.baseSalaryPerSession) || 0;

  const setSalary = (raw) => {
    const n = Math.max(0, Number(String(raw).replace(/\D/g, '')) || 0);
    setTeacherForm((p) => ({ ...p, baseSalaryPerSession: n }));
  };

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thêm giảng viên mới"
        className="cms-sheet cms-sheet--compact w-full md:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
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

        <div className="cms-sheet-body space-y-5">
          {/* 1. Cá nhân */}
          <section>
            <div className="cms-step">
              <span className="cms-step__num">1</span>
              <span className="cms-step__label">Thông tin cá nhân</span>
            </div>
            <div className="cms-form space-y-3">
              <div className="cms-form-row">
                <div>
                  <label className="cms-label">Họ tên <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={teacherForm.name}
                    onChange={(e) => setTeacherForm((p) => ({ ...p, name: e.target.value }))}
                    className="cms-input"
                    placeholder="Nguyễn Văn A"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="cms-label">SĐT / Zalo (đăng nhập) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    inputMode="tel"
                    value={teacherForm.phone}
                    onChange={(e) => setTeacherForm((p) => ({ ...p, phone: e.target.value.replace(/\s/g, '') }))}
                    className="cms-input font-mono"
                    placeholder="0912345678"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="cms-form-row">
                <div>
                  <label className="cms-label">Email</label>
                  <input
                    type="email"
                    value={teacherForm.email || ''}
                    onChange={(e) => setTeacherForm((p) => ({ ...p, email: e.target.value }))}
                    className="cms-input"
                    placeholder="ten@email.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="cms-label">Ngày vào làm</label>
                  <input
                    type="date"
                    value={teacherForm.startDate}
                    onChange={(e) => setTeacherForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="cms-input"
                  />
                </div>
              </div>

              <div>
                <label className="cms-label">Địa chỉ</label>
                <input
                  type="text"
                  value={teacherForm.address}
                  onChange={(e) => setTeacherForm((p) => ({ ...p, address: e.target.value }))}
                  className="cms-input"
                  placeholder="123 Đường ABC, Quận X..."
                />
              </div>
            </div>
          </section>

          {/* 2. Chuyên môn */}
          <section>
            <div className="cms-step">
              <span className="cms-step__num cms-step__num--muted">2</span>
              <span className="cms-step__label">Chuyên môn &amp; chi nhánh</span>
            </div>
            <div className="cms-form space-y-3">
              <div>
              <ExamSubjectCheckboxGrid
                catalog={examSubjectsCatalog}
                value={teacherForm.subjectIds || []}
                accent="blue"
                columns={3}
                dense
                onChange={(ids) => setTeacherForm((p) => ({
                  ...p,
                  subjectIds: ids,
                  specialty: formatSubjectIdsAsSpecialty(ids, examSubjectsCatalog),
                }))}
              />
              {teacherForm.specialty ? (
                  <p className="text-xs text-sky-700 mt-1.5 font-semibold">
                    Chuyên môn: {teacherForm.specialty}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1.5">Chọn ít nhất một môn.</p>
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
                    className="cms-input cursor-pointer"
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
            </div>
          </section>

          {/* 3. Lương & thưởng */}
          <section>
            <div className="cms-step">
              <span className="cms-step__num cms-step__num--muted">3</span>
              <span className="cms-step__label">Lương cứng &amp; thưởng sao</span>
            </div>
            <div className="cms-form space-y-3">
              <div>
                <label className="cms-label flex items-center gap-1.5">
                  <DollarSign size={12} /> Lương cứng / buổi (VNĐ)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={salary || ''}
                  onChange={(e) => setSalary(e.target.value)}
                  className="cms-input font-mono font-bold tabular-nums"
                  placeholder="150000"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SALARY_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTeacherForm((p) => ({ ...p, baseSalaryPerSession: amt }))}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition ${
                        salary === amt
                          ? 'border-sky-400 bg-sky-50 text-sky-800'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {formatHoaHong(amt)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Mức cố định theo buổi dạy — không đổi theo sao. Có thể chỉnh lại khi thanh toán.
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3.5 space-y-2">
                <div className="flex items-start gap-2">
                  <Star size={15} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-900">Thưởng sao (tự động khi thanh toán)</p>
                    <p className="text-xs text-amber-900/85 mt-0.5 leading-relaxed">
                      {formatStarBonusRule({
                        minStudents: STAR_BONUS_MIN_STUDENTS,
                        minStars: STAR_BONUS_MIN_STARS,
                        bonusPerMonth: STAR_BONUS_AMOUNT,
                      })}
                    </p>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      Dữ liệu lấy từ đánh giá học viên (sao cộng dồn) và số HV đã dạy trong tháng.
                      Đủ điều kiện thì cộng thêm khi chi lương; chưa chi thì tích lại.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-xs text-slate-700 leading-relaxed">
            <Info size={14} className="text-sky-600 mt-0.5 shrink-0" />
            <p>
              Sau khi tạo, GV ở trạng thái <strong>Chưa cấp quyền</strong>.
              Admin duyệt cấp quyền thì mới đăng nhập bằng SĐT được.
            </p>
          </div>
        </div>

        <div className="cms-sheet-footer">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">
            Hủy
          </button>
          <button type="button" onClick={onSubmit} className="cms-btn cms-btn-primary">
            <GraduationCap size={16} /> Tạo giảng viên
          </button>
        </div>
      </div>
    </>
  );
}
