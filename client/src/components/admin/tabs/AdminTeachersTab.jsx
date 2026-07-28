import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import {
  GraduationCap, Search, Plus, Star, FileSpreadsheet, FileText, CheckCircle2,
  Download, Unlock, UserCheck, DollarSign, Edit3, Trash2, User,
  Phone, CalendarCheck, MessageSquare, X,
} from 'lucide-react';
import Avatar from '../shared/Avatar';
import { resolveTeacherExamDate, isTeacherExamDateApproximate, practicalFileDisplayName, practicalFileDownloadUrl, practicalFileViewUrl } from '../utils/teacherExam';
import { isTeacherPending } from '../../../constants/teacherStatus';

const PROCESS_STEPS = [
  'Bài Test ≥ 80đ',
  'Nộp file thực hành',
  'Admin kiểm tra',
  'Cấp quyền',
];

export default function AdminTeachersTab() {
  const {
    teachers, safeTeachers, filteredTeachers, search, setSearch, isSuperAdmin, setShowTeacherModal,
    getTeacherRating, setReviewModal, setGrantModal, setApproveModal, setEditTeacher, handlePayTeacher,
    removeTeacher, approveTeacher, fetchTeachers, reviewModal, approveModal, markFileReviewed, toast,
  } = useAdminTab();

  const pendingCount = safeTeachers.filter((t) => isTeacherPending(t.status)).length;
  const filePending = safeTeachers.filter((t) => t.practicalFile && t.practicalStatus === 'submitted').length;

  return (
    <>
      <div className="space-y-3 sm:space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_14px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="cms-teacher-toolbar space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                    <GraduationCap size={18} aria-hidden="true" />
                  </span>
                  <span className="leading-snug truncate">Duyệt giảng viên</span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg flex-shrink-0">
                    {teachers.length}
                  </span>
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`cms-dash-badge ${pendingCount ? 'cms-dash-badge-warning' : 'cms-dash-badge-neutral'}`}>
                    {pendingCount} chờ duyệt
                  </span>
                  {filePending > 0 && (
                    <span className="cms-dash-badge-warning">{filePending} file chờ kiểm tra</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col min-[420px]:flex-row gap-2 w-full sm:w-auto sm:max-w-xl sm:flex-1 sm:justify-end">
                <div className="relative flex-1 min-w-0 sm:max-w-xs">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Tìm giảng viên..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="cms-input pl-10"
                    aria-label="Tìm giảng viên"
                  />
                </div>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowTeacherModal(true)}
                    className="cms-btn cms-btn-primary shrink-0"
                  >
                    <Plus size={16} /> Thêm giảng viên
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="px-3 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2.5">Quy trình duyệt</p>
            <div className="cms-teacher-steps">
              {PROCESS_STEPS.map((label, i) => (
                <div key={label} className="cms-teacher-step">
                  <span className="cms-teacher-step__n">{i + 1}</span>
                  <span className="cms-teacher-step__label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 sm:p-4 space-y-2.5 bg-slate-50/50">
            {filteredTeachers.length > 0 ? filteredTeachers.map((t) => {
              const score = t.testScore;
              const passed = (score || 0) >= 80;
              const rating = getTeacherRating(t.id);
              const active = ['Active', 'active'].includes(t.status);
              const pending = ['Pending', 'pending'].includes(t.status);
              const locked = String(t.status).toLowerCase() === 'locked';
              const inactive = String(t.status).toLowerCase() === 'inactive' || locked;
              const examDate = resolveTeacherExamDate(t);

              return (
                <article key={t.id} className={`cms-teacher-card ${t.practicalStatus === 'submitted' ? 'ring-1 ring-amber-200' : ''}`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar
                      size="card"
                      initials={t.name?.substring(0, 2).toUpperCase() || 'GV'}
                      name={t.name}
                      role="teacher"
                      src={t.avatar}
                      color={active ? 'bg-emerald-500' : passed ? 'bg-amber-500' : 'bg-slate-400'}
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-slate-900 truncate leading-tight">{t.name}</p>
                          <p className="text-[13px] text-slate-500 mt-1 flex items-center gap-1.5 min-w-0">
                            <Phone size={12} className="shrink-0 text-slate-400" />
                            <span className="truncate font-mono">{t.phone || '—'}</span>
                            {t.branchCode ? <span className="text-slate-300">·</span> : null}
                            {t.branchCode ? <span className="truncate font-medium text-slate-500">{t.branchCode}</span> : null}
                          </p>
                        </div>
                        <span className={`cms-dash-badge flex-shrink-0 ${
                          active ? 'cms-dash-badge-success'
                            : pending ? 'cms-dash-badge-warning'
                              : locked ? 'cms-dash-badge-primary'
                                : 'cms-dash-badge-neutral'
                        }`}>
                          {active ? 'Đã cấp quyền' : pending ? 'Chờ duyệt' : locked ? 'Đã khóa' : 'Chưa cấp quyền'}
                        </span>
                      </div>

                      {t.specialty && (
                        <p className="text-[12px] text-slate-600 leading-snug line-clamp-2">{t.specialty}</p>
                      )}
                    </div>
                  </div>

                  <div className="cms-teacher-card__chips">
                    <span className={`cms-teacher-chip ${score == null ? 'cms-teacher-chip--muted' : passed ? 'cms-teacher-chip--ok' : 'cms-teacher-chip--bad'}`}>
                      <Star size={12} className={passed ? 'fill-current' : ''} />
                      {score == null ? 'Chưa thi' : `${score}/100 · ${passed ? 'Đạt' : 'Trượt'}`}
                    </span>
                    <span className={`cms-teacher-chip ${rating.count > 0 ? 'cms-teacher-chip--warn' : 'cms-teacher-chip--muted'}`}>
                      <Star size={12} className={rating.count > 0 ? 'fill-current' : ''} />
                      {rating.count > 0 ? `${rating.avg}/5 · ${rating.count} đánh giá` : 'Chưa có đánh giá'}
                    </span>
                    {t.assignedStudents?.length > 0 && (
                      <span className="cms-teacher-chip cms-teacher-chip--info">
                        Đang dạy {t.assignedStudents.length} HV
                      </span>
                    )}
                    {examDate && (
                      <span className={`cms-teacher-chip ${isTeacherExamDateApproximate(t) ? 'cms-teacher-chip--warn' : 'cms-teacher-chip--muted'}`}>
                        <CalendarCheck size={12} />
                        Thi {examDate.toLocaleDateString('vi-VN')}
                        {isTeacherExamDateApproximate(t) ? ' (ước lượng)' : ''}
                      </span>
                    )}
                  </div>

                  <div
                    className={`cms-teacher-card__status ${
                      t.practicalStatus === 'reviewed' ? 'is-ready'
                        : t.practicalFile ? 'is-wait' : ''
                    }`}
                  >
                    <FileSpreadsheet size={15} className="shrink-0 opacity-80" />
                    {t.practicalFile ? (
                      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold truncate text-[13px]">
                          {practicalFileDisplayName(t.practicalFile)}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                          {t.practicalStatus === 'reviewed' ? 'Đã duyệt' : 'Chờ kiểm tra'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setReviewModal(t)}
                          className="ml-auto text-[13px] font-bold text-sky-700 hover:underline shrink-0 min-h-9 px-1"
                        >
                          Kiểm tra
                        </button>
                      </div>
                    ) : (
                      <span className="font-medium text-[13px]">Chưa nộp bài thực hành</span>
                    )}
                  </div>

                  {t.approvedAt && (
                    <p className="text-[12px] text-emerald-600 flex items-center gap-1.5 -mt-1">
                      <CheckCircle2 size={12} /> Duyệt {new Date(t.approvedAt).toLocaleString('vi-VN')}
                    </p>
                  )}
                  {locked && t.lockReason && (
                    <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                      {t.lockReason}
                    </p>
                  )}

                  {isSuperAdmin && (
                    <div className="cms-teacher-card__footer">
                      <div className="cms-teacher-card__footer-main">
                        {inactive && (
                          <button
                            type="button"
                            onClick={() => setGrantModal({ id: t.id, name: t.name || t.email || t.phone, type: locked ? 'retry' : 'first' })}
                            className={`cms-btn cms-btn-sm ${locked ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
                          >
                            <Unlock size={15} /> {locked ? 'Cấp quyền thi lại' : 'Cấp truy cập thi'}
                          </button>
                        )}

                        {pending && (
                          <>
                            <button
                              type="button"
                              onClick={() => setApproveModal(t)}
                              disabled={(t.testScore || 0) < 80 || t.practicalStatus !== 'reviewed'}
                              className="cms-btn cms-btn-success cms-btn-sm"
                            >
                              <UserCheck size={15} /> Cấp quyền giảng dạy
                            </button>
                            {(t.testScore || 0) < 80 && (
                              <p className="text-[11px] text-red-500 font-semibold">Chưa đủ 80 điểm</p>
                            )}
                            {t.practicalStatus !== 'reviewed' && (
                              <p className="text-[11px] text-amber-600 font-semibold">Chưa duyệt bài thực hành</p>
                            )}
                          </>
                        )}

                        {active && (
                          <button
                            type="button"
                            onClick={() => handlePayTeacher(t)}
                            className="cms-btn cms-btn-outline cms-btn-sm"
                          >
                            <DollarSign size={14} /> Thanh toán
                          </button>
                        )}
                      </div>

                      <div className="cms-teacher-card__footer-tools">
                        <button
                          type="button"
                          onClick={() => setEditTeacher(t)}
                          className="cms-btn cms-btn-outline cms-btn-icon"
                          title="Chỉnh sửa"
                          aria-label="Chỉnh sửa"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTeacher(t.id)}
                          className="cms-btn cms-btn-outline cms-btn-icon text-red-600"
                          title="Xóa"
                          aria-label="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            }) : (
              <div className="py-14 text-center space-y-3">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                  <User size={28} />
                </div>
                <p className="text-sm font-semibold text-slate-400">Không tìm thấy giảng viên nào</p>
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">
              Hiển thị {filteredTeachers.length} / {teachers.length} giảng viên
            </p>
          </div>
        </div>
      </div>

      {reviewModal && (
        <>
          <div className="cms-sheet-backdrop" onClick={() => setReviewModal(null)} aria-hidden="true" />
          <div className="cms-sheet w-full md:max-w-lg" role="dialog" aria-modal="true">
            <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
            <div className="cms-sheet-header">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-sky-600" /> Kiểm tra bài thực hành
              </h3>
              <button type="button" onClick={() => setReviewModal(null)} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500" aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="cms-sheet-body space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm space-y-1">
                <p><strong>Giảng viên:</strong> {reviewModal.name}</p>
                <p className="break-all"><strong>File:</strong> {practicalFileDisplayName(reviewModal.practicalFile)}</p>
                <p><strong>Điểm test:</strong> {reviewModal.testScore}/100</p>
              </div>
              <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-[13px] text-sky-800">
                <p className="font-semibold mb-1">Hướng dẫn</p>
                <ol className="list-decimal list-inside space-y-1 text-[12px]">
                  <li>Tải file về hoặc mở xem trực tiếp</li>
                  <li>Kiểm tra nội dung bài làm</li>
                  <li>Đối chiếu yêu cầu đề bài</li>
                  <li>Nếu đạt → xác nhận bên dưới</li>
                </ol>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <a href={practicalFileDownloadUrl(reviewModal.practicalFile)} className="cms-btn cms-btn-secondary flex-1">
                  <Download size={16} /> Tải file
                </a>
                <a href={practicalFileViewUrl(reviewModal.practicalFile)} target="_blank" rel="noopener noreferrer" className="cms-btn cms-btn-outline flex-1">
                  <FileText size={16} /> Mở xem
                </a>
              </div>
            </div>
            <div className="cms-sheet-footer">
              <button type="button" onClick={() => setReviewModal(null)} className="cms-btn cms-btn-outline flex-1">Đóng</button>
              <button type="button" onClick={() => markFileReviewed(reviewModal.id)} className="cms-btn cms-btn-success flex-[1.4]">
                <CheckCircle2 size={16} /> Đạt yêu cầu
              </button>
            </div>
          </div>
        </>
      )}

      {approveModal && (
        <>
          <div className="cms-sheet-backdrop" onClick={() => setApproveModal(null)} aria-hidden="true" />
          <div className="cms-sheet w-full md:max-w-md" role="dialog" aria-modal="true">
            <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
            <div className="cms-sheet-header">
              <h3 className="text-base font-semibold text-slate-900">Cấp quyền giảng viên</h3>
              <button type="button" onClick={() => setApproveModal(null)} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500" aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="cms-sheet-body space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex items-center gap-3">
                <Avatar initials={approveModal.name?.substring(0, 2).toUpperCase() || 'GV'} name={approveModal.name} role="teacher" src={approveModal.avatar} color="bg-emerald-500" size="card" />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{approveModal.name}</p>
                  <p className="text-[13px] text-slate-500 mt-0.5">Điểm test: <span className="text-emerald-700 font-semibold">{approveModal.testScore}/100</span></p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[12px] font-semibold text-slate-500">Quyền được mở</p>
                {[
                  { icon: Phone, label: 'Xem danh sách học viên' },
                  { icon: CalendarCheck, label: 'Điểm danh & trừ buổi' },
                  { icon: MessageSquare, label: 'Nhắn tin Zalo / Hộp thư' },
                  { icon: FileSpreadsheet, label: 'Cập nhật tài liệu' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[13px] text-slate-600">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Icon size={13} />
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="cms-sheet-footer">
              <button type="button" onClick={() => setApproveModal(null)} className="cms-btn cms-btn-outline flex-1">Hủy</button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await approveTeacher(approveModal.id);
                    setApproveModal(null);
                    toast.success('Đã cấp quyền giảng dạy!');
                    fetchTeachers();
                  } catch (err) {
                    toast.error('Lỗi cấp quyền: ' + (err.message || 'Không xác định'));
                  }
                }}
                className="cms-btn cms-btn-success flex-[1.4]"
              >
                <UserCheck size={16} /> Cấp quyền
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
