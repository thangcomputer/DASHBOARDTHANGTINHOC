import React, { useEffect } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { Edit3, X, Save, KeyRound, CreditCard, MapPin } from 'lucide-react';
import { BankSelect } from '../../BankSelect';
import TeacherScheduleHistoryPanel from '../../TeacherScheduleHistoryPanel';
import { useData } from '../../../context/DataContext';
import ExamSubjectCheckboxGrid from './ExamSubjectCheckboxGrid';
import { formatSubjectIdsAsSpecialty, resolveTeacherSubjectIds } from '../../../utils/examSubjects';

export default function EditTeacherModal({
  editTeacher, setEditTeacher, onClose, onSave, onResetPassword, isSuperAdmin, safeBranches,
}) {
  const { examSubjectsCatalog } = useData() || {};

  // Khôi phục subjectIds từ specialty chỉ khi DB chưa có — khớp chính xác tên môn
  useEffect(() => {
    if (!editTeacher) return;
    const hasIds = Array.isArray(editTeacher.subjectIds) && editTeacher.subjectIds.length > 0;
    if (hasIds) {
      const expected = formatSubjectIdsAsSpecialty(editTeacher.subjectIds, examSubjectsCatalog);
      if (expected && expected !== editTeacher.specialty) {
        setEditTeacher((p) => (p ? { ...p, specialty: expected } : p));
      }
      return;
    }
    const resolved = resolveTeacherSubjectIds(editTeacher, examSubjectsCatalog);
    if (!resolved.length) return;
    setEditTeacher((prev) => {
      if (!prev || (Array.isArray(prev.subjectIds) && prev.subjectIds.length > 0)) return prev;
      return {
        ...prev,
        subjectIds: resolved,
        specialty: formatSubjectIdsAsSpecialty(resolved, examSubjectsCatalog) || prev.specialty,
      };
    });
  }, [editTeacher?.id, editTeacher?._id, examSubjectsCatalog, setEditTeacher]);
  if (!editTeacher) return null;

  const isHistory = editTeacher._tab === 'history';

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hồ sơ giảng viên"
        className="cms-sheet cms-sheet--wide w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className="cms-sheet-header__side bg-sky-50 text-sky-600" aria-hidden="true">
            <Edit3 size={18} />
          </span>
          <h3 className="cms-sheet-header__title">Hồ sơ giảng viên</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cms-sheet-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isHistory}
            onClick={() => setEditTeacher((p) => ({ ...p, _tab: 'info' }))}
            className={`cms-sheet-tab ${!isHistory ? 'is-active' : ''}`}
          >
            Thông tin chung
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isHistory}
            onClick={() => setEditTeacher((p) => ({ ...p, _tab: 'history' }))}
            className={`cms-sheet-tab ${isHistory ? 'is-active' : ''}`}
          >
            Lịch sử sắp lịch
          </button>
        </div>

        <div className="cms-sheet-body">
          {isHistory ? (
            <TeacherScheduleHistoryPanel teacherId={editTeacher.id || editTeacher._id} />
          ) : (
            <div className="cms-form">
              <div className="cms-form-row">
                <div>
                  <label className="cms-label">Họ tên</label>
                  <input
                    type="text"
                    value={editTeacher.name || ''}
                    onChange={(e) => setEditTeacher((p) => ({ ...p, name: e.target.value }))}
                    className="cms-input"
                  />
                </div>
                <div>
                  <label className="cms-label">Số điện thoại / Zalo</label>
                  <input
                    type="text"
                    value={editTeacher.phone || ''}
                    onChange={(e) => setEditTeacher((p) => ({ ...p, phone: e.target.value }))}
                    className="cms-input font-mono"
                  />
                </div>
              </div>

              <ExamSubjectCheckboxGrid
                catalog={examSubjectsCatalog}
                value={editTeacher.subjectIds || []}
                accent="red"
                onChange={(ids) => setEditTeacher((p) => ({
                  ...p,
                  subjectIds: ids,
                  specialty: formatSubjectIdsAsSpecialty(ids, examSubjectsCatalog),
                }))}
              />
              {editTeacher.specialty && (
                <p className="text-[12px] text-sky-600 -mt-2">Hiển thị: {editTeacher.specialty}</p>
              )}

              <div>
                <label className="cms-label">Email</label>
                <input
                  type="email"
                  value={editTeacher.email || ''}
                  onChange={(e) => setEditTeacher((p) => ({ ...p, email: e.target.value }))}
                  className="cms-input"
                  placeholder="email@example.com"
                />
              </div>

              <div className="cms-form-row">
                <div>
                  <label className="cms-label">Trạng thái duyệt</label>
                  <CmsSelect
                    value={String(editTeacher.status || 'inactive').toLowerCase()}
                    onChange={(e) => setEditTeacher((p) => ({ ...p, status: e.target.value }))}
                    className="cms-input"
                  >
                    <option value="inactive">🔒 Chưa cấp quyền</option>
                    <option value="pending">🕒 Cấp quyền thi (Chờ làm bài)</option>
                    <option value="active">🟢 Đã cấp quyền (Active)</option>
                    <option value="locked">🚫 Đã khóa</option>
                  </CmsSelect>
                </div>
                <div>
                  <label className="cms-label">Lương / buổi (VNĐ)</label>
                  <input
                    type="text"
                    value={editTeacher.baseSalaryPerSession || ''}
                    onChange={(e) => setEditTeacher((p) => ({ ...p, baseSalaryPerSession: Number(e.target.value.replace(/\D/g, '')) }))}
                    className="cms-input font-mono"
                    placeholder="150000"
                  />
                </div>
              </div>

              {(() => {
                const sess = JSON.parse(localStorage.getItem('admin_user') || '{}');
                const isSA = sess?.id === 'admin' || sess?.adminRole === 'SUPER_ADMIN';
                if (!isSA) return null;
                return (
                  <div>
                    <label className="cms-label">Điều chuyển chi nhánh</label>
                    <CmsSelect
                      value={editTeacher.branchId || ''}
                      onChange={(e) => {
                        const opt = e.target.selectedOptions[0];
                        setEditTeacher((p) => ({ ...p, branchId: e.target.value, branchCode: opt?.dataset.code || '' }));
                      }}
                      className="cms-input"
                    >
                      <option value="">— Chưa phân chi nhánh —</option>
                      {(JSON.parse(localStorage.getItem('thvp_branches') || '[]')).map((b) => (
                        <option key={b._id} value={b._id} data-code={b.code}>{b.name} ({b.code})</option>
                      ))}
                    </CmsSelect>
                    {editTeacher.branchCode && (
                      <p className="text-[12px] text-amber-700 font-semibold mt-1.5 flex items-center gap-1">
                        <MapPin size={12} /> Hiện tại: {editTeacher.branchCode}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="cms-form-row">
                <div>
                  <label className="cms-label">Ngày vào làm</label>
                  <input
                    type="date"
                    value={editTeacher.startDate ? new Date(editTeacher.startDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditTeacher((p) => ({ ...p, startDate: e.target.value }))}
                    className="cms-input"
                  />
                </div>
                <div>
                  <label className="cms-label">Địa chỉ</label>
                  <input
                    type="text"
                    value={editTeacher.address || ''}
                    onChange={(e) => setEditTeacher((p) => ({ ...p, address: e.target.value }))}
                    className="cms-input"
                    placeholder="Nhập địa chỉ..."
                  />
                </div>
              </div>

              <div>
                <label className="cms-label">Giới thiệu bản thân (Bio)</label>
                <textarea
                  value={editTeacher.bio || ''}
                  onChange={(e) => setEditTeacher((p) => ({ ...p, bio: e.target.value }))}
                  rows={3}
                  className="cms-input"
                  style={{ minHeight: 88, height: 'auto', paddingTop: 12, paddingBottom: 12 }}
                  placeholder="Kinh nghiệm cá nhân, bằng cấp, sở trường..."
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                <p className="text-[12px] font-bold text-emerald-700 flex items-center gap-1.5">
                  <CreditCard size={14} /> Thông tin ngân hàng (QR nhận lương)
                </p>
                <div>
                  <label className="cms-label">Ngân hàng nhận</label>
                  <BankSelect
                    value={editTeacher.bankAccount?.bankCode || ''}
                    onChange={(bank) => setEditTeacher((p) => ({
                      ...p,
                      bankAccount: {
                        ...(p.bankAccount || {}),
                        bankCode: bank.bin,
                        bankName: bank.shortName,
                      },
                    }))}
                  />
                  {editTeacher.bankAccount?.bankCode && (
                    <p className="text-[12px] font-semibold text-emerald-600 mt-1.5">
                      ✓ Đã chọn: {editTeacher.bankAccount.bankName}
                    </p>
                  )}
                </div>
                <div className="cms-form-row">
                  <div>
                    <label className="cms-label">Số tài khoản</label>
                    <input
                      type="text"
                      value={editTeacher.bankAccount?.accountNumber || ''}
                      onChange={(e) => setEditTeacher((p) => ({
                        ...p,
                        bankAccount: { ...(p.bankAccount || {}), accountNumber: e.target.value.replace(/\D/g, '') },
                      }))}
                      className="cms-input font-mono"
                      placeholder="VD: 123456789"
                    />
                  </div>
                  <div>
                    <label className="cms-label">Tên chủ tài khoản</label>
                    <input
                      type="text"
                      value={editTeacher.bankAccount?.accountHolder || editTeacher.bankAccount?.accountName || ''}
                      onChange={(e) => setEditTeacher((p) => ({
                        ...p,
                        bankAccount: {
                          ...(p.bankAccount || {}),
                          accountHolder: e.target.value.toUpperCase(),
                          accountName: e.target.value.toUpperCase(),
                        },
                      }))}
                      className="cms-input uppercase"
                      placeholder="VD: NGUYEN VAN A"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`cms-sheet-footer ${!isHistory ? 'cms-sheet-footer--triple' : ''}`}>
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">
            {isHistory ? 'Đóng' : 'Huỷ bỏ'}
          </button>
          {!isHistory && (
            <>
              <button
                type="button"
                onClick={() => onResetPassword(editTeacher.id || editTeacher._id, editTeacher.name)}
                className="cms-btn cms-btn-secondary"
              >
                <KeyRound size={15} /> Cấp lại MK
              </button>
              <button type="button" onClick={onSave} className="cms-btn cms-btn-primary">
                <Save size={16} /> Lưu thay đổi
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
