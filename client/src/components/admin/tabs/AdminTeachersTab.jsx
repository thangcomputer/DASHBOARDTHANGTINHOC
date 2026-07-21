import React from 'react';
import { useAdminTab } from '../AdminTabContext';
import {
  GraduationCap, Search, Plus, Star, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Download, Clock, XCircle, Lock, Unlock, UserCheck, DollarSign, Edit3, Trash2, User,
  Phone, CalendarCheck, MessageSquare,
} from 'lucide-react';
import Avatar from '../shared/Avatar';
import { resolveTeacherExamDate, isTeacherExamDateApproximate } from '../utils/teacherExam';
import { isTeacherPending } from '../../../constants/teacherStatus';

export default function AdminTeachersTab() {
  const {
    teachers, safeTeachers, filteredTeachers, search, setSearch, isSuperAdmin, setShowTeacherModal,
    getTeacherRating, setReviewModal, setGrantModal, setApproveModal, setEditTeacher, handlePayTeacher,
    removeTeacher, approveTeacher, fetchTeachers, reviewModal, approveModal, markFileReviewed, toast,
  } = useAdminTab();

  return (
    <>
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-100 cms-toolbar xl:flex-row xl:items-start xl:justify-between min-w-0">
                  <h2 className="text-lg sm:text-xl font-black text-gray-800 flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <GraduationCap size={22} />
                    </div>
                    <span className="leading-snug max-w-[min(100%,40rem)]">Duyệt Giảng Viên & Kiểm Tra Bài Thực Hành</span>
                    <span className="text-xs font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">{teachers.length} GV</span>
                  </h2>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch xl:flex-nowrap xl:items-center w-full min-w-0 xl:w-auto">
                    <div className="flex flex-wrap gap-2 items-center">
                    {safeTeachers.filter(t => t.practicalFile && t.practicalStatus === 'submitted').length > 0 && (
                      <span className="bg-orange-100 text-orange-700 text-xs sm:text-xs px-2 sm:px-3 py-1 rounded-full font-bold animate-pulse max-w-full truncate sm:truncate-none">
                        📎 {safeTeachers.filter(t => t.practicalFile && t.practicalStatus === 'submitted').length} file chờ kiểm tra
                      </span>
                    )}
                    <span className="bg-yellow-100 text-yellow-700 text-xs sm:text-xs px-2 sm:px-3 py-1 rounded-full font-bold">
                      {safeTeachers.filter(t => isTeacherPending(t.status)).length} chờ duyệt
                    </span>
                    </div>
                    <div className="relative w-full sm:flex-1 sm:min-w-[12rem] sm:max-w-md xl:flex-initial xl:w-64 xl:max-w-none">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Tìm giảng viên..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-300 transition-all w-full"
                      />
                    </div>
                    {isSuperAdmin && (
                    <button
                      onClick={() => setShowTeacherModal(true)}
                      className="inline-flex shrink-0 justify-center items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-900/10 hover:shadow-emerald-900/20 hover:from-emerald-700 transition-all active:scale-95 w-full sm:w-auto min-h-[2.5rem]"
                    >
                      <Plus size={16} /> THÊM GIẢNG VIÊN
                    </button>
                    )}
                  </div>
                </div>

                {/* Quy trình duyệt */}
                <div className="px-4 py-4 sm:px-6 bg-blue-50 border-b border-blue-100">
                  <p className="text-xs font-bold text-blue-700 mb-2">📋 QUY TRÌNH DUYỆT GIẢNG VIÊN</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-blue-600">
                    {['Bài Test ≥ 80đ', '→', 'Nộp file thực hành', '→', 'Admin kiểm tra công thức', '→', 'Cấp quyền'].map((step, i) => (
                      <span key={i} className={i % 2 === 1 ? 'text-blue-400' : 'bg-white px-2 py-1 rounded-lg font-semibold'}>{step}</span>
                    ))}
                  </div>
                </div>

                {/* Teacher list */}
                <div className="divide-y divide-gray-50">
                  {filteredTeachers.length > 0 ? filteredTeachers.map(t => (
                    <div key={t.id} className={`px-4 py-5 sm:px-6 transition-colors ${t.practicalStatus === 'submitted' ? 'bg-orange-50/30' : 'hover:bg-gray-50'}`}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        {/* Left info */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <Avatar initials={t.name?.substring(0, 2).toUpperCase() || 'GV'} color={t.status === 'Active' ? 'bg-green-500' : (t.testScore || 0) >= 80 ? 'bg-yellow-500' : 'bg-red-400'} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-800">{t.name}</p>
                              <span className="text-xs text-gray-400">SĐT: {t.phone}</span>
                              {t.branchCode && <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-semibold border border-teal-200">🏢 {t.branchCode}</span>}
                              {t.specialty && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{t.specialty}</span>}
                            </div>

                            {/* Scores & info */}
                            <div className="flex items-center gap-4 mt-2 flex-wrap">
                              {/* Test score */}
                              <div className="flex items-center gap-1.5">
                                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                                <span className={`text-xs font-bold ${(t.testScore || 0) >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                                  {t.testScore ?? 'Chưa thi'}{t.testScore != null && '/100'}
                                </span>
                                {t.testScore != null && (
                                  <>
                                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${(t.testScore || 0) >= 80 ? 'bg-green-500' : 'bg-red-400'}`}
                                        style={{ width: `${t.testScore}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-bold ${(t.testScore || 0) >= 80 ? 'text-green-500' : 'text-red-500'}`}>
                                      {(t.testScore || 0) >= 80 ? 'ĐẠT' : 'TRƯỢT'}
                                    </span>
                                  </>
                                )}
                              </div>

                              {(() => {
                                const d = resolveTeacherExamDate(t);
                                if (!d) return null;
                                const fmt = d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                                return (
                                  <span className={`text-xs ${isTeacherExamDateApproximate(t) ? 'text-amber-600' : 'text-gray-400'}`}>
                                    Ngày thi{isTeacherExamDateApproximate(t) ? ' (ước lượng)' : ''}: {fmt}
                                  </span>
                                );
                              })()}

                              {(() => {
                                const rating = getTeacherRating(t.id);
                                return rating.count > 0 ? (
                                  <span className="text-xs font-bold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100 flex items-center gap-1">
                                    <Star size={10} className="fill-yellow-500 text-yellow-500" /> {rating.avg}/5 ({rating.count})
                                  </span>
                                ) : null;
                              })()}
                              {/* Assigned Students */}
                              {t.assignedStudents?.length > 0 && (
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                  Đang dạy: {t.assignedStudents.length} học viên
                                </span>
                              )}
                            </div>

                            {/* File thực hành */}
                            <div className="mt-3">
                              {t.practicalFile ? (
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border ${t.practicalStatus === 'reviewed'
                                      ? 'bg-green-50 border-green-200 text-green-700'
                                      : 'bg-orange-50 border-orange-200 text-orange-700'
                                    }`}>
                                    <FileSpreadsheet size={14} />
                                    {t.practicalFile}
                                    {t.practicalStatus === 'reviewed' && <CheckCircle2 size={12} />}
                                    {t.practicalStatus === 'submitted' && <AlertTriangle size={12} />}
                                  </div>
                                  <button
                                    onClick={() => setReviewModal(t)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 underline"
                                  >
                                    <Download size={12} /> Tải & Kiểm tra
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">📭 Chưa nộp bài thực hành</span>
                              )}
                            </div>

                            {/* Approved date */}
                            {t.approvedAt && (
                              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                <CheckCircle2 size={11} /> Được duyệt ngày {new Date(t.approvedAt).toLocaleString('vi-VN')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right actions */}
                        <div className="flex flex-col gap-2 items-stretch md:items-end flex-shrink-0 w-full md:w-auto">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${['Active', 'active'].includes(t.status) ? 'bg-green-100 text-green-700' :
                              ['Pending', 'pending'].includes(t.status) ? 'bg-yellow-100 text-yellow-700' :
                                String(t.status).toLowerCase() === 'locked' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-500'
                            }`}>
                            {['Active', 'active'].includes(t.status) ? <><CheckCircle2 size={12} /> Đã cấp quyền giảng dạy</> :
                              ['Pending', 'pending'].includes(t.status) ? <><Clock size={12} /> Chờ duyệt</> :
                                String(t.status).toLowerCase() === 'locked' ? <><XCircle size={12} /> Đã khóa (Trượt)</> :
                                  <><Lock size={12} /> Chưa cấp quyền</>}
                          </span>
                          {String(t.status).toLowerCase() === 'locked' && t.lockReason && (
                            <p className="text-xs text-red-500 font-bold mt-1 bg-red-50 px-2 py-0.5 rounded italic border border-red-100 max-w-[200px] text-right">
                              🛡️ {t.lockReason}
                            </p>
                          )}

                          {/* Inactive hoặc Locked → cấp lại quyền thi */}
                          {isSuperAdmin && (['inactive'].includes(String(t.status).toLowerCase()) || String(t.status).toLowerCase() === 'locked') && (
                            <button
                              onClick={() => setGrantModal({ id: t.id, name: t.name || t.email || t.phone, type: String(t.status).toLowerCase() === 'locked' ? 'retry' : 'first' })}
                              className={`flex items-center gap-1.5 bg-gradient-to-r ${String(t.status).toLowerCase() === 'locked' ? 'from-orange-600 to-orange-500' : 'from-blue-600 to-blue-500'} text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all`}
                            >
                              <Unlock size={15} /> {String(t.status).toLowerCase() === 'locked' ? 'Cấp quyền thi lại' : 'Cấp truy cập thi'}
                            </button>
                          )}

                          {/* Pending → cấp quyền giảng dạy đầy đủ (CHỈ CHO PHÉP KHI ĐỦ 80 ĐIỂM VÀ ĐÃ KIỂM TRA FILE) */}
                          {isSuperAdmin && String(t.status).toLowerCase() === 'pending' && (
                            <div className="flex flex-col items-end gap-1">
                              <button
                                onClick={() => setApproveModal(t)}
                                disabled={(t.testScore || 0) < 80 || t.practicalStatus !== 'reviewed'}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all 
                                    ${((t.testScore || 0) < 80 || t.practicalStatus !== 'reviewed')
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-70'
                                    : 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-700 hover:shadow-lg'
                                  }`}
                              >
                                <UserCheck size={15} /> Cấp quyền giảng dạy
                              </button>
                              {(t.testScore || 0) < 80 && (
                                <span className="text-xs cms-min-text-xs text-red-500 font-bold uppercase">Chưa đủ 80đ</span>
                              )}
                              {t.practicalStatus !== 'reviewed' && (
                                <span className="text-xs cms-min-text-xs text-orange-500 font-bold uppercase">Chưa duyệt bài thực hành</span>
                              )}
                            </div>
                          )}


                          {/* Nút chỉnh sửa + xóa + thanh toán — ⭐ CHỈ SUPER_ADMIN */}
                          {isSuperAdmin && (
                          <div className="flex items-center gap-1.5">
                            {(t.status === 'Active' || t.status === 'active') && (
                              <button
                                onClick={() => handlePayTeacher(t)}
                                className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold border border-green-100"
                                title="Thanh toán lương (Tất cả buổi dạy chưa nhận)"
                              >
                                <DollarSign size={14} /> Thanh toán
                              </button>
                            )}
                            <button
                              onClick={() => setEditTeacher(t)}
                              className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors"
                              title="Chỉnh sửa thông tin"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => removeTeacher(t.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                              title="Xoá giảng viên"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                        <User size={32} />
                      </div>
                      <p className="text-gray-400 font-bold">Không tìm thấy giảng viên nào</p>
                    </div>
                  )}
                </div>
                
                {/* Teacher list footer */}
                <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs font-bold text-gray-400">
                    Hiển thị {filteredTeachers.length} / {teachers.length} giảng viên
                  </p>
                </div>
              </div>
            </div>

          {/* ===== MODAL: KIỂM TRA FILE THỰC HÀNH ===== */}
          {reviewModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 rounded-t-2xl">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <FileSpreadsheet size={20} /> Kiểm Tra Bài Thực Hành
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm"><strong>Giảng viên:</strong> {reviewModal.name}</p>
                    <p className="text-sm mt-1"><strong>File:</strong> {reviewModal.practicalFile}</p>
                    <p className="text-sm mt-1"><strong>Điểm test:</strong> {reviewModal.testScore}/100</p>
                  </div>

                  <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                    <p className="font-bold mb-2">📋 Hướng dẫn kiểm tra:</p>
                    <ol className="space-y-1 text-xs">
                      <li>1. Tải file Excel về máy</li>
                      <li>2. Mở file, nhấn <strong>Ctrl + ~</strong> để xem toàn bộ công thức</li>
                      <li>3. Kiểm tra xem GV có sử dụng <strong>VLOOKUP + IFERROR</strong> đúng logic</li>
                      <li>4. Kiểm tra <strong>SUMIFS</strong> tổng hợp dữ liệu</li>
                      <li>5. Kiểm tra <strong>Pivot Table</strong> đã tạo đúng</li>
                      <li>6. Nếu ĐẠT → nhấn "Đã kiểm tra, đạt yêu cầu"</li>
                    </ol>
                  </div>

                  <a
                    href={`/uploads/${reviewModal.practicalFile}`}
                    download
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-black transition-all"
                  >
                    <Download size={16} /> Tải file {reviewModal.practicalFile}
                  </a>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                  <button onClick={() => setReviewModal(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50">
                    Đóng
                  </button>
                  <button
                    onClick={() => markFileReviewed(reviewModal.id)}
                    className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl font-bold hover:from-green-700 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Đã kiểm tra, đạt yêu cầu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== MODAL: XÁC NHẬN CẤP QUYỀN ===== */}
          {approveModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
                {/* Decorative Header */}
                <div className="pt-8 px-8 pb-4 text-center relative">
                  <div className="w-16 h-16 bg-emerald-50 rounded-[20px] flex items-center justify-center mx-auto mb-5 rotate-3 shadow-[0_8px_16px_-6px_rgba(16,185,129,0.2)]">
                    <Unlock size={28} className="text-emerald-600 -rotate-3" />
                  </div>
                  <h3 className="text-slate-900 font-black text-[22px] tracking-tight leading-none mb-2">
                    Cấp Truy Cập Giảng Viên
                  </h3>
                  <p className="text-slate-500 text-sm font-medium">Bạn đang cấp quyền giảng dạy hệ thống cho:</p>
                </div>

                <div className="px-8 pb-8 space-y-6">
                  {/* User Card */}
                  <div className="bg-slate-50 rounded-[20px] p-5 flex items-center gap-4 border border-slate-100">
                    <Avatar initials={approveModal.name?.substring(0, 2).toUpperCase() || 'GV'} color="bg-emerald-500" />
                    <div>
                      <p className="font-bold text-lg text-slate-900 leading-none">{approveModal.name}</p>
                      <p className="text-[13px] font-bold text-slate-500 flex items-center gap-1.5 mt-1.5">
                        Điểm test năng lực: <span className="text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-md">{approveModal.testScore}/100</span>
                      </p>
                    </div>
                  </div>

                  {/* Permissions list */}
                  <div>
                    <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-3 px-1">Quyền hạn được mở khóa</p>
                    <div className="space-y-3 px-1">
                      {[
                        { icon: Phone, label: 'Xem danh sách học viên trực tiếp' },
                        { icon: CalendarCheck, label: 'Thực hiện điểm danh & trừ buổi' },
                        { icon: MessageSquare, label: 'Nhắn tin qua Zalo và Hộp thư' },
                        { icon: FileSpreadsheet, label: 'Cập nhật tài liệu và Link học' },
                      ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-3 text-[14px] text-slate-600 font-medium">
                          <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <Icon size={12} className="text-emerald-600" />
                          </div>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setApproveModal(null)}
                      className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-[16px] font-bold hover:bg-slate-100 transition-colors border border-slate-200"
                    >
                      Huỷ bỏ
                    </button>
                    <button
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
                      className="flex-[1.5] py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-[16px] font-black hover:from-emerald-700 shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <UserCheck size={18} /> CẤP QUYỀN
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
    </>
  );
}
