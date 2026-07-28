import React, { useEffect, useMemo, useState } from 'react';
import CmsSelect from '../../ui/CmsSelect';
import { useAdminTab } from '../AdminTabContext';
import BranchFilterDropdown from '../../BranchFilterDropdown';
import {
  BookOpen, Search, Download, FileSpreadsheet, Plus, Users, AlertTriangle,
  MoreHorizontal, ClipboardList, Edit3, Bell, Unlock, Lock, Camera, Printer, Trash2,
  ChevronLeft, ChevronRight, Loader2, MapPin, Globe, Building2,
} from 'lucide-react';
import Avatar from '../shared/Avatar';
import { getClientEnrollments } from '../../../utils/enrollments';
import { isTeacherActive } from '../../../constants/teacherStatus';
import { teacherMatchesCourse } from '../../../utils/examSubjects';
import { apiFetch } from '../../../services/api';

function StudentActionMenu({
  s,
  actionMenuId,
  setActionMenuId,
  setShowStudentDetailId,
  setEditStudent,
  setEnrollmentModalStudent,
  sendDebtReminder,
  approveStudentExam,
  revokeStudentExam,
  ctxUpdateStudent,
  toast,
  handlePrintInvoice,
  removeStudent,
  align = 'right',
}) {
  if (actionMenuId !== s.id) return null;
  return (
    <div
      className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] py-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150`}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={() => { setShowStudentDetailId(s.id); setActionMenuId(null); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100 mb-1">
        <ClipboardList size={13} /> Xem hồ sơ chi tiết
      </button>
      <button onClick={() => { setEditStudent({ ...s }); setActionMenuId(null); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
        <Edit3 size={13} /> Sửa thông tin
      </button>
      <button onClick={() => { setActionMenuId(null); setEnrollmentModalStudent(s); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 transition-colors">
        <Plus size={13} /> Thêm khóa học
      </button>
      {!s.paid && (
        <button onClick={() => { sendDebtReminder(s); setActionMenuId(null); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <Bell size={13} /> Nhắc nợ
        </button>
      )}
      <button onClick={() => { s.studentExamUnlocked ? revokeStudentExam(s.id) : approveStudentExam(s.id); setActionMenuId(null); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
        {s.studentExamUnlocked ? <><Lock size={13} /> Khóa phòng thi</> : <><Unlock size={13} /> Cho phép thi</>}
      </button>
      <button
        onClick={async () => {
          const webcamEnforced = s.requireWebcam !== false;
          try {
            await ctxUpdateStudent(s.id || s._id, { requireWebcam: !webcamEnforced });
            toast.success(webcamEnforced ? 'Đã tắt giám sát webcam khi thi' : 'Đã bật giám sát webcam khi thi');
          } catch (e) {
            toast.error(e?.message || 'Không cập nhật được giám sát webcam');
          }
          setActionMenuId(null);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Camera size={13} /> {s.requireWebcam !== false ? 'Tắt giám sát Webcam' : 'Bật giám sát Webcam'}
      </button>
      <button onClick={() => { handlePrintInvoice(s); setActionMenuId(null); }}
        disabled={!s.paid}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
          s.paid ? 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700' : 'text-slate-300 cursor-not-allowed'
        }`}>
        <Printer size={13} /> Xuất hóa đơn PDF
      </button>
      <div className="border-t border-slate-100 my-1" />
      <button onClick={() => { removeStudent(s.id); setActionMenuId(null); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
        <Trash2 size={13} /> Xóa học viên
      </button>
    </div>
  );
}

function PaidBadge({ paid }) {
  return (
    <span className={paid ? 'cms-students-badge-success' : 'cms-students-badge-primary'}>
      {paid ? 'Hoàn tất' : <><AlertTriangle size={10} /> Chưa nộp</>}
    </span>
  );
}

function ModeBranchBadges({ s, safeBranches }) {
  const branch = s.branchId ? safeBranches.find((b) => String(b._id) === String(s.branchId)) : null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={s.learningMode === 'ONLINE' ? 'cms-students-badge-info' : 'cms-students-badge-neutral'}>
        {s.learningMode === 'ONLINE'
          ? <><Globe size={10} aria-hidden="true" /> Online</>
          : <><Building2 size={10} aria-hidden="true" /> Offline</>}
      </span>
      <span className="cms-students-badge-neutral">
        <MapPin size={10} aria-hidden="true" />
        {branch?.name || 'Chưa phân cơ sở'}
      </span>
    </div>
  );
}

export default function AdminStudentsTab() {
  const {
    search, setSearch, filterCourse, setFilterCourse, filterPaid, setFilterPaid,
    handleExportExcel, isExportingExcel, setShowImportModal, setShowModal,
    studentsPagination, filteredStudents, safeTeachers, safeBranches,
    assignTeacher, actionMenuId, setActionMenuId, setShowStudentDetailId, setEditStudent,
    setEnrollmentModalStudent,
    sendDebtReminder, approveStudentExam, revokeStudentExam, ctxUpdateStudent, toast,
    handlePrintInvoice, removeStudent, currentPage, setCurrentPage,
    examSubjectsCatalog,
  } = useAdminTab();

  const [dbCourses, setDbCourses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/courses');
        const json = await res.json();
        if (!cancelled && json?.success && Array.isArray(json.data)) {
          setDbCourses(json.data);
        }
      } catch {
        /* ignore — giữ dropdown rỗng */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const courseFilterOptions = useMemo(() => {
    const list = (dbCourses || [])
      .filter((c) => c && c.name && String(c.status || 'published') !== 'archived')
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));
    const seen = new Set();
    return list.filter((c) => {
      const key = String(c.name).trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [dbCourses]);

  useEffect(() => {
    if (filterCourse === 'all' || !filterCourse) return;
    if (!courseFilterOptions.length) return;
    const ok = courseFilterOptions.some(
      (c) => String(c.name).toLowerCase() === String(filterCourse).toLowerCase()
        || String(c._id) === String(filterCourse),
    );
    if (!ok) setFilterCourse('all');
  }, [courseFilterOptions, filterCourse, setFilterCourse]);

  const assignableTeachers = (safeTeachers || []).filter(
    (t) => t && (t.role == null || t.role === 'teacher') && isTeacherActive(t.status),
  );

  const teachersForCourse = (courseOrEnrollment, currentTeacherId = '') => {
    const matched = [];
    const other = [];
    const cur = String(currentTeacherId || '');
    for (const t of assignableTeachers) {
      const tid = String(t.id || t._id);
      if (teacherMatchesCourse(t, courseOrEnrollment, examSubjectsCatalog) || (cur && tid === cur)) {
        matched.push(t);
      } else {
        other.push(t);
      }
    }
    return { matched, other };
  };

  const handleAssignTeacher = async (studentId, teacherId, enrollmentId) => {
    const sid = studentId;
    if (!sid) {
      toast.error('Không xác định được học viên');
      return;
    }
    try {
      await assignTeacher(sid, teacherId, enrollmentId);
      toast.success(teacherId ? 'Đã phân công giảng viên' : 'Đã bỏ phân công');
    } catch (err) {
      toast.error(err?.message || 'Không phân công được giảng viên');
    }
  };

  const menuProps = {
    actionMenuId, setActionMenuId, setShowStudentDetailId, setEditStudent,
    setEnrollmentModalStudent, sendDebtReminder, approveStudentExam, revokeStudentExam,
    ctxUpdateStudent, toast, handlePrintInvoice, removeStudent,
  };

  const selectFilterClass =
    'w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/15 outline-none cursor-pointer transition-all';

  const teacherSelectClass =
    'w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-2.5 text-sm font-medium text-slate-700 outline-none focus:border-sky-400 cursor-pointer';

  const renderTeacherSelects = (s, enrollments, hasMultiCourse, primaryEnr, teacherVal) => {
    if (hasMultiCourse) {
      return (
        <div className="space-y-2">
          {enrollments.map((enr) => {
            const enrTeacherVal = enr.teacherId || '';
            const enrId = enr.enrollmentId || enr.id;
            const { matched, other } = teachersForCourse(enr, enrTeacherVal);
            return (
              <div key={enrId} className="space-y-1">
                <p className="text-xs font-semibold text-sky-700 truncate">{enr.courseName || enr.name}</p>
                <CmsSelect
                  value={enrTeacherVal}
                  onChange={(e) => {
                    e?.stopPropagation?.();
                    handleAssignTeacher(s.id || s._id, e.target.value || null, enrId !== 'main' ? enrId : undefined);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={teacherSelectClass}
                >
                  <option value="">Chưa phân công</option>
                  {matched.map((t) => (
                    <option key={t.id || t._id} value={String(t.id || t._id)}>{t.name}</option>
                  ))}
                  {other.map((t) => (
                    <option key={t.id || t._id} value={String(t.id || t._id)} disabled>
                      {t.name} (khác môn)
                    </option>
                  ))}
                </CmsSelect>
              </div>
            );
          })}
        </div>
      );
    }
    const courseRef = primaryEnr || s.course;
    const { matched, other } = teachersForCourse(courseRef, teacherVal);
    return (
      <CmsSelect
        value={teacherVal ? String(teacherVal) : ''}
        onChange={(e) => {
          e?.stopPropagation?.();
          handleAssignTeacher(s.id || s._id, e.target.value || null, primaryEnr?.enrollmentId !== 'main' ? primaryEnr?.enrollmentId : undefined);
        }}
        onClick={(e) => e.stopPropagation()}
        className={teacherSelectClass}
      >
        <option value="">Chưa phân công</option>
        {matched.map((t) => (
          <option key={t.id || t._id} value={String(t.id || t._id)}>{t.name}</option>
        ))}
        {other.map((t) => (
          <option key={t.id || t._id} value={String(t.id || t._id)} disabled>
            {t.name} (khác môn)
          </option>
        ))}
      </CmsSelect>
    );
  };

  const renderTuition = (s, enrollments, hasMultiCourse) => {
    if (hasMultiCourse) {
      return (
        <div className="space-y-1.5">
          {enrollments.map((enr) => {
            const enrId = enr.enrollmentId || enr.id;
            return (
              <div key={enrId}>
                <p className="text-sm font-semibold text-slate-800">
                  {(Number(enr.price) || 0).toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-slate-500">
                  {(enr.completedSessions || 0)}/{(enr.totalSessions || 12)} buổi
                </p>
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <>
        <p className="text-sm font-semibold text-slate-800">{(s.price || 0).toLocaleString('vi-VN')}đ</p>
        <p className="text-xs text-slate-500 mt-0.5">Tiến độ: {(s.completedSessions || 0)}/{(s.totalSessions || 12)} buổi</p>
      </>
    );
  };

  const renderPaid = (s, enrollments, hasMultiCourse) => {
    if (hasMultiCourse) {
      return (
        <div className="flex flex-col gap-1.5 items-start">
          {enrollments.map((enr) => (
            <PaidBadge key={enr.enrollmentId || enr.id} paid={!!enr.paid} />
          ))}
        </div>
      );
    }
    return <PaidBadge paid={!!s.paid} />;
  };

  return (
    <div className="cms-students-module bg-white rounded-2xl lg:rounded-[28px] border border-slate-100 shadow-[0_4px_24px_rgba(15,23,42,0.04)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Title + actions */}
      <div className="px-3 pt-3 pb-2 sm:px-4 lg:px-6 lg:pt-4 space-y-3">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <BookOpen size={18} aria-hidden="true" />
            </span>
            <span className="truncate">Quản lý Học Viên</span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg flex-shrink-0">
              {studentsPagination.totalRecords}
            </span>
          </h2>
        </div>

        {/* Sticky search */}
        <div className="cms-students-search-sticky -mx-3 px-3 py-2 sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0 lg:static lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:py-0">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-3 h-11 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/15 outline-none w-full transition-all"
              placeholder="Tìm tên / SĐT..."
              aria-label="Tìm học viên"
            />
          </div>
        </div>

        {/* Branch + Status (+ Course) — one wrapping row */}
        <div className="cms-students-filters">
          <div className="lg:hidden">
            <BranchFilterDropdown fullWidth />
          </div>
          <CmsSelect
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className={selectFilterClass}
          >
            <option value="all">Tất cả khóa học</option>
            {courseFilterOptions.map((c) => (
              <option key={c._id} value={c.name}>{c.name}</option>
            ))}
          </CmsSelect>
          <CmsSelect
            value={filterPaid}
            onChange={(e) => setFilterPaid(e.target.value)}
            className={selectFilterClass}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="paid">Đã đóng phí</option>
            <option value="unpaid">Chưa đóng phí</option>
          </CmsSelect>
        </div>

        {/* Action buttons — Xuất/Excel auto, Thêm học viên lấy phần còn lại */}
        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="cms-students-btn-outline !px-2.5 shrink-0"
          >
            {isExportingExcel
              ? <><Loader2 size={15} className="animate-spin shrink-0" /> ...</>
              : <><Download size={15} className="shrink-0" /> Xuất</>}
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="cms-students-btn-outline !px-2.5 shrink-0"
          >
            <FileSpreadsheet size={15} className="shrink-0" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="cms-students-btn-primary !px-2.5 min-w-0 text-[12px] min-[360px]:text-[13px] sm:text-sm whitespace-nowrap"
          >
            <Plus size={15} className="shrink-0" />
            Thêm học viên
          </button>
        </div>
      </div>

      {/* ── MOBILE / TABLET CARDS (< lg) ─────────────────────────── */}
      <div className="lg:hidden px-3 pb-3 sm:px-4 space-y-2 min-h-[280px]">
        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users size={24} className="opacity-40" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Không tìm thấy học viên nào</p>
            <p className="text-xs text-slate-400 mt-1">Thử đổi bộ lọc hoặc từ khóa</p>
          </div>
        ) : filteredStudents.map((s) => {
          const enrollments = getClientEnrollments(s);
          const hasMultiCourse = enrollments.length > 1;
          const primaryEnr = enrollments.find((e) => e.isPrimary) || enrollments[0];
          const teacherVal = (() => {
            const fromEnr = primaryEnr?.teacherId || '';
            if (fromEnr) return String(fromEnr);
            if (typeof s.teacherId === 'object' && s.teacherId !== null) {
              return String(s.teacherId._id || s.teacherId.id || '');
            }
            return s.teacherId ? String(s.teacherId) : '';
          })();
          const regDate = s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '';
          return (
            <article key={s.id} className="cms-students-card">
              <div className="flex items-start gap-3">
                <Avatar
                  size="card"
                  initials={s.name?.substring(0, 2).toUpperCase() || 'HV'}
                  name={s.name}
                  role="student"
                  src={s.avatar}
                  color={s.paid ? 'bg-sky-500' : 'bg-red-500'}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-900 leading-snug truncate">{s.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {regDate}{s.phone ? ` · ${s.phone}` : ''}
                      </p>
                    </div>
                    <div className="relative flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === s.id ? null : s.id); }}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                        aria-label="Thao tác"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      <StudentActionMenu s={s} {...menuProps} align="right" />
                    </div>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    <p className="text-sm font-medium text-slate-700 truncate">{s.course}</p>
                    {(s.courses?.length > 1 || s.enrollments?.length > 1) && (
                      <p className="text-xs font-semibold text-sky-600">
                        +{(s.courses || s.enrollments).length - 1} khóa khác
                      </p>
                    )}
                    <ModeBranchBadges s={s} safeBranches={safeBranches} />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 min-[375px]:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Giảng viên</p>
                  {renderTeacherSelects(s, enrollments, hasMultiCourse, primaryEnr, teacherVal)}
                </div>
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Học phí</p>
                    {renderTuition(s, enrollments, hasMultiCourse)}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Trạng thái</p>
                    {renderPaid(s, enrollments, hasMultiCourse)}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* ── DESKTOP TABLE (≥ lg) ─────────────────────────────────── */}
      <div className="hidden lg:block cms-table-wrap overscroll-x-contain min-h-[480px] touch-pan-x">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Học viên</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Khóa học</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Giáo viên</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Học phí</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Trạng thái</th>
              <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center w-14" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-16 text-center text-slate-400">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users size={28} className="opacity-30" />
                  </div>
                  <p className="text-sm font-semibold">Không tìm thấy học viên nào</p>
                  <p className="text-xs text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                </td>
              </tr>
            ) : filteredStudents.map((s) => {
              const enrollments = getClientEnrollments(s);
              const hasMultiCourse = enrollments.length > 1;
              const primaryEnr = enrollments.find((e) => e.isPrimary) || enrollments[0];
              const teacherVal = (() => {
                const fromEnr = primaryEnr?.teacherId || '';
                if (fromEnr) return String(fromEnr);
                if (typeof s.teacherId === 'object' && s.teacherId !== null) {
                  return String(s.teacherId._id || s.teacherId.id || '');
                }
                return s.teacherId ? String(s.teacherId) : '';
              })();
              const regDate = s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '';
              return (
                <tr key={s.id} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        size="card"
                        initials={s.name?.substring(0, 2).toUpperCase() || 'HV'}
                        name={s.name}
                        role="student"
                        src={s.avatar}
                        color={s.paid ? 'bg-sky-500' : 'bg-red-500'}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-base leading-snug truncate max-w-[200px]">{s.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{regDate}{s.phone ? ` · ${s.phone}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-slate-700 leading-tight block truncate max-w-[180px]">{s.course}</span>
                    {(s.courses?.length > 1 || s.enrollments?.length > 1) && (
                      <span className="text-xs font-semibold text-sky-600 mt-0.5 block">
                        +{(s.courses || s.enrollments).length - 1} khóa khác
                      </span>
                    )}
                    <div className="mt-1.5">
                      <ModeBranchBadges s={s} safeBranches={safeBranches} />
                    </div>
                  </td>
                  <td className="px-4 py-3 min-w-[180px] max-w-[260px]">
                    {renderTeacherSelects(s, enrollments, hasMultiCourse, primaryEnr, teacherVal)}
                  </td>
                  <td className="px-4 py-3">
                    {renderTuition(s, enrollments, hasMultiCourse)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex flex-col items-center gap-1.5">
                      {renderPaid(s, enrollments, hasMultiCourse)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === s.id ? null : s.id); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      <StudentActionMenu s={s} {...menuProps} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-3 py-3 sm:px-4 lg:px-6 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-slate-500 font-medium">
          Hiển thị {filteredStudents.length} / {studentsPagination.totalRecords} học viên · Trang {studentsPagination.currentPage}/{studentsPagination.totalPages}
        </p>
        <div className="flex items-center gap-1 pb-[env(safe-area-inset-bottom,0px)] sm:pb-0">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          {(() => {
            const tp = studentsPagination.totalPages;
            const cp = currentPage;
            const pages = [];
            if (tp <= 7) {
              for (let i = 1; i <= tp; i++) pages.push(i);
            } else {
              pages.push(1);
              if (cp > 3) pages.push('...');
              for (let i = Math.max(2, cp - 1); i <= Math.min(tp - 1, cp + 1); i++) pages.push(i);
              if (cp < tp - 2) pages.push('...');
              pages.push(tp);
            }
            return pages.map((p, idx) => (
              p === '...' ? (
                <span key={`dot-${idx}`} className="w-9 h-9 flex items-center justify-center text-slate-300 text-xs">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                    p === cp
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >{p}</button>
              )
            ));
          })()}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(studentsPagination.totalPages, p + 1))}
            disabled={currentPage >= studentsPagination.totalPages}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
