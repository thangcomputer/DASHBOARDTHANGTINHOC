import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import {
  BookOpen, Search, Download, FileSpreadsheet, Plus, Users, CheckCircle2, AlertTriangle,
  MoreHorizontal, ClipboardList, Edit3, Bell, Unlock, Lock, Camera, Printer, Trash2,
  ChevronLeft, ChevronRight, Loader2, MapPin,
} from 'lucide-react';
import Avatar from '../shared/Avatar';

export default function AdminStudentsTab() {
  const {
    search, setSearch, filterCourse, setFilterCourse, filterPaid, setFilterPaid,
    handleExportExcel, isExportingExcel, setShowImportModal, setShowModal,
    studentsPagination, filteredStudents, safeTeachers, safeBranches,
    assignTeacher, actionMenuId, setActionMenuId, setShowStudentDetailId, setEditStudent,
    sendDebtReminder, approveStudentExam, revokeStudentExam, ctxUpdateStudent, toast,
    handlePrintInvoice, removeStudent, currentPage, setCurrentPage,
  } = useAdminTab();

  return (
            <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
              {/* ── TOOLBAR ──────────────────────────────────────────────── */}
              <div className="px-4 py-5 sm:px-6 lg:px-8 border-b border-gray-50">
                <div className="cms-toolbar xl:flex-row xl:items-start xl:justify-between">
                  <h2 className="text-lg sm:text-xl font-black text-gray-800 flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={22} />
                    </div>
                    <span className="leading-tight">Quản lý Học Viên</span>
                    <span className="text-xs font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">{studentsPagination.totalRecords} HV</span>
                  </h2>
                  <div className="flex w-full min-w-0 flex-col gap-3 2xl:flex-row 2xl:flex-wrap 2xl:items-stretch 2xl:justify-end">
                    <div className="relative w-full min-w-0 2xl:w-64 2xl:flex-shrink-0">
                      <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2.5 bg-gray-50 border-2 border-transparent rounded-2xl text-xs font-bold focus:border-red-600 focus:bg-white outline-none w-full transition-all shadow-sm"
                        placeholder="Tìm tên / SĐT..."
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0 2xl:w-auto 2xl:max-w-xl 2xl:grid-cols-2">
                      <select
                        value={filterCourse}
                        onChange={e => setFilterCourse(e.target.value)}
                        className="w-full min-w-0 py-2.5 px-4 bg-gray-50 border-2 border-transparent rounded-2xl text-xs font-black uppercase focus:border-red-600 outline-none cursor-pointer transition-all shadow-sm"
                      >
                        <option value="all">Tất cả khóa học</option>
                        <option value="THVP">THVP Nâng Cao</option>
                        <option value="MOS">MOS Excel</option>
                        <option value="THIET KE">Thiết Kế Đồ Họa</option>
                        <option value="AUTOCAD">AutoCAD</option>
                        <option value="PYTHON">Lập trình Python</option>
                      </select>
                      <select
                        value={filterPaid}
                        onChange={e => setFilterPaid(e.target.value)}
                        className="w-full min-w-0 py-2.5 px-4 bg-gray-50 border-2 border-transparent rounded-2xl text-xs font-black uppercase focus:border-red-600 outline-none cursor-pointer transition-all shadow-sm"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="paid">✅ Đã đóng phí</option>
                        <option value="unpaid">❌ Chưa đóng phí</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-3 w-full 2xl:w-auto 2xl:justify-end">
                      <button
                        onClick={handleExportExcel}
                        disabled={isExportingExcel}
                        className="inline-flex flex-1 sm:flex-initial justify-center items-center gap-2 bg-white border-2 border-gray-100 text-gray-500 px-4 sm:px-5 py-2.5 rounded-2xl text-xs font-black uppercase hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm min-w-0 sm:min-w-[7.5rem] w-full sm:w-auto min-h-[2.75rem] sm:min-h-0"
                      >
                        {isExportingExcel
                          ? <><Loader2 size={14} className="animate-spin" /> ...</>
                          : <><Download size={14} /> Xuất</>
                        }
                      </button>
                      <button
                        onClick={() => setShowImportModal(true)}
                        className="inline-flex flex-1 sm:flex-initial justify-center items-center gap-2 bg-emerald-50 border-2 border-emerald-100 text-emerald-600 px-4 sm:px-5 py-2.5 rounded-2xl text-xs font-black uppercase hover:bg-emerald-100 transition-all shadow-sm min-w-0 sm:min-w-[7.5rem] w-full sm:w-auto min-h-[2.75rem] sm:min-h-0"
                      >
                        <FileSpreadsheet size={14} /> Nhập Excel
                      </button>
                      <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex flex-1 sm:flex-initial justify-center items-center gap-2 bg-red-600 text-white px-5 sm:px-6 py-2.5 rounded-2xl text-xs font-black uppercase shadow-lg shadow-red-200 hover:bg-red-700 hover:-translate-y-0.5 active:translate-y-0 transition-all w-full sm:w-auto min-h-[2.75rem] sm:min-h-0"
                      >
                        <Plus size={16} /> Thêm Học Viên
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── TABLE ────────────────────────────────────────────────── */}
              <div className="cms-table-wrap overscroll-x-contain min-h-[400px] sm:min-h-[600px] touch-pan-x">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-6 py-3.5 text-xs font-black text-gray-400 uppercase tracking-widest">Học viên</th>
                      <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-widest">Khóa học</th>
                      <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-widest">Giáo viên</th>
                      <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-widest">Học phí</th>
                      <th className="px-5 py-3.5 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Trạng thái</th>
                      <th className="px-4 py-3.5 text-xs font-black text-gray-400 uppercase tracking-widest text-center w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-16 text-center text-gray-400">
                          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Users size={28} className="opacity-30" />
                          </div>
                          <p className="text-sm font-bold">Không tìm thấy học viên nào</p>
                          <p className="text-xs text-gray-300 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                        </td>
                      </tr>
                    ) : filteredStudents.map(s => {
                      const teacherVal = (typeof s.teacherId === 'object' && s.teacherId !== null) ? s.teacherId._id : (s.teacherId || '');
                      const teacherName = (typeof s.teacherId === 'object' && s.teacherId !== null) ? s.teacherId.name : safeTeachers.find(t => String(t.id) === String(s.teacherId))?.name;
                      const regDate = s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '';
                      return (
                        <tr key={s.id} className="group hover:bg-slate-50/80 transition-colors">
                          {/* Cột Học viên */}
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar initials={s.name?.substring(0, 2).toUpperCase() || 'HV'} color={s.paid ? 'bg-indigo-500' : 'bg-rose-500'} />
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 text-[13px] group-hover:text-blue-600 transition-colors leading-none mb-0.5 uppercase tracking-tight truncate max-w-[180px]">{s.name}</p>
                                <p className="text-xs text-gray-400 font-medium">{regDate}{s.phone ? ` · ${s.phone}` : ''}</p>
                              </div>
                            </div>
                          </td>
                          {/* Cột Khóa học */}
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-bold text-slate-700 leading-tight block truncate max-w-[160px]">{s.course}</span>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs cms-min-text-xs font-black tracking-wider uppercase ${s.learningMode === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                                {s.learningMode === 'ONLINE' ? '🌐 ONLINE' : '🏢 OFFLINE'}
                              </span>
                              {s.branchId && safeBranches.find(b => String(b._id) === String(s.branchId)) ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs cms-min-text-xs font-black tracking-wider bg-orange-50 text-orange-600 border border-orange-100">
                                  <MapPin size={9} />
                                  {safeBranches.find(b => String(b._id) === String(s.branchId))?.name?.toUpperCase()}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs cms-min-text-xs font-black tracking-wider bg-gray-50 text-gray-400 border border-gray-100">
                                  <MapPin size={9} />
                                  CHƯA PHÂN CƠ SỞ
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Cột Giáo viên */}
                          <td className="px-5 py-3.5">
                            <select
                              value={teacherVal}
                              onChange={(e) => { e.stopPropagation(); assignTeacher(s.id, e.target.value); }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full max-w-[150px] bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer"
                            >
                              <option value="">Chưa phân công</option>
                              {safeTeachers
                                .filter(t => t.status === 'Active' || t.status === 'active')
                                .map(t => (
                                  <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                                ))
                              }
                            </select>
                          </td>
                          {/* Cột Học phí */}
                          <td className="px-5 py-3.5">
                            <p className="text-[13px] font-black text-slate-800">{(s.price || 0).toLocaleString('vi-VN')}đ</p>
                            <p className="text-xs cms-min-text-xs font-bold text-slate-400 mt-0.5">Tiến độ HV: {(s.completedSessions || 0)}/{(s.totalSessions || 12)} buổi</p>
                          </td>
                          {/* Cột Trạng thái */}
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-xs tracking-tight ${
                              s.paid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}>
                              {s.paid ? <><CheckCircle2 size={11} /> Hoàn tất</> : <><AlertTriangle size={11} /> Chưa nộp</>}
                            </span>
                          </td>
                          {/* Cột Thao tác: 3-dot menu */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="relative inline-block">
                              <button
                                onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === s.id ? null : s.id); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              {actionMenuId === s.id && (
                                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] py-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => { setShowStudentDetailId(s.id); setActionMenuId(null); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 transition-colors border-b border-gray-50 mb-1">
                                    <ClipboardList size={13} /> Xem hồ sơ chi tiết
                                  </button>
                                  <button onClick={() => { setEditStudent({ ...s }); setActionMenuId(null); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                    <Edit3 size={13} /> Sửa thông tin
                                  </button>
                                  {!s.paid && (
                                    <button onClick={() => { sendDebtReminder(s); setActionMenuId(null); }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                                      <Bell size={13} /> Nhắc nợ
                                    </button>
                                  )}
                                  <button onClick={() => { s.studentExamUnlocked ? revokeStudentExam(s.id) : approveStudentExam(s.id); setActionMenuId(null); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
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
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-colors"
                                  >
                                    <Camera size={13} /> {s.requireWebcam !== false ? 'Tắt giám sát Webcam' : 'Bật giám sát Webcam'}
                                  </button>
                                  <button onClick={() => { handlePrintInvoice(s); setActionMenuId(null); }}
                                    disabled={!s.paid}
                                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold transition-colors ${
                                      s.paid
                                        ? 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                                        : 'text-gray-300 cursor-not-allowed'
                                    }`}>
                                    <Printer size={13} /> Xuất hóa đơn PDF
                                  </button>
                                  
                                  <div className="border-t border-gray-100 my-1" />
                                  <button onClick={() => { removeStudent(s.id); setActionMenuId(null); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 transition-colors">
                                    <Trash2 size={13} /> Xóa học viên
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── PAGINATION FOOTER ────────────────────────────────────── */}
              <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs font-bold text-gray-400">
                  Hiển thị {filteredStudents.length} / {studentsPagination.totalRecords} học viên · Trang {studentsPagination.currentPage}/{studentsPagination.totalPages}
                </p>
                <div className="flex items-center gap-1">
                  {/* Trước */}
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {/* Page numbers */}
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
                        <span key={`dot-${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-300 text-xs">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                            p === cp
                              ? 'bg-red-500 text-white shadow-md shadow-red-200'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >{p}</button>
                      )
                    ));
                  })()}
                  {/* Sau */}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(studentsPagination.totalPages, p + 1))}
                    disabled={currentPage >= studentsPagination.totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
  );
}
