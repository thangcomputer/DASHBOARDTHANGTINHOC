import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminTab } from '../AdminTabContext';
import { AlertTriangle, ShieldAlert, MessageSquare, CheckCircle2, MessageCircle } from 'lucide-react';

export default function AdminEvaluationsTab() {
  const {
    getPrivateEvaluationsForAdmin, markEvaluationRead,
  } = useAdminTab();
  const navigate = useNavigate();

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="cms-m-card w-full max-w-full">
        <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 bg-gradient-to-r from-red-50 to-white">
          <h2 className="cms-m-heading flex items-start sm:items-center gap-2 min-w-0">
            <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            <span className="break-anywhere">Báo cáo đánh giá chất lượng nội bộ</span>
          </h2>
          <p className="cms-m-caption mt-2">
            Đây là các đánh giá riêng tư từ học viên được gửi trực tiếp cho Admin tại các mốc Buổi 1 và 50% khóa học.
          </p>
        </div>
        <div className="divide-y divide-slate-50">
          {getPrivateEvaluationsForAdmin().length === 0 ? (
            <div className="cms-m-empty py-14 sm:py-20">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-2 border border-slate-100">
                <ShieldAlert size={28} className="text-slate-300" aria-hidden="true" />
              </div>
              <h3 className="text-slate-900 font-bold text-lg">Chưa có đánh giá nội bộ</h3>
              <p className="cms-m-caption max-w-xs mx-auto">
                Phản hồi bí mật từ học viên về chất lượng giảng dạy sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : getPrivateEvaluationsForAdmin().map((ev) => (
            <div
              key={ev.id}
              className={`p-4 sm:p-6 transition-colors duration-200 border-l-4 ${
                ev.read ? 'border-transparent hover:bg-slate-50' : 'border-red-500 bg-red-50/30'
              }`}
            >
              <div className="flex flex-col gap-4 min-w-0">
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {!ev.read && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">MỚI</span>
                    )}
                    <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${
                      ev.milestone === 'lesson_1' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {ev.milestone === 'lesson_1' ? 'BUỔI ĐẦU TIÊN'
                        : ev.milestone === 'course_end_center' ? 'CUỐI KHÓA · TRUNG TÂM'
                          : ev.milestone === 'course_end_teacher' ? 'CUỐI KHÓA · GIẢNG VIÊN'
                            : ev.milestone === 'manual_feedback' ? 'PHẢN HỒI TỰ NGUYỆN'
                              : ev.milestone === 'mid_course' ? 'MỐC 50% KHÓA'
                                : String(ev.milestone || 'ĐÁNH GIÁ')}
                    </span>
                    <span className="cms-m-caption">{ev.date}</span>
                  </div>
                  <h4 className="cms-m-list-title text-[16px]">
                    HV: {ev.studentName} → GV: {ev.teacherName}
                  </h4>
                  {ev.courseName && (
                    <span className="inline-flex max-w-full items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
                      <span className="line-clamp-2">📚 {ev.courseName}</span>
                    </span>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-100 rounded-xl shadow-sm min-h-11">
                      <span className="text-[12px] font-semibold text-slate-400 uppercase">Hài lòng:</span>
                      <span className={`text-[13px] font-bold ${ev.criteria?.satisfied === 'yes' ? 'text-sky-700' : 'text-red-600'}`}>
                        {ev.criteria?.satisfied === 'yes' ? 'CÓ' : 'KHÔNG'}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-100 rounded-xl shadow-sm min-h-11">
                      <span className="text-[12px] font-semibold text-slate-400 uppercase">Dễ hiểu:</span>
                      <span className={`text-[13px] font-bold ${ev.criteria?.lessonClear === 'yes' ? 'text-sky-700' : 'text-orange-600'}`}>
                        {ev.criteria?.lessonClear === 'yes' ? 'HIỂU' : 'HƠI KHÓ'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-3 sm:p-5 rounded-2xl border border-red-50 relative mt-1 shadow-sm min-h-[72px] flex items-center">
                    <div className="absolute -left-2 -top-2 bg-red-100 rounded-full p-2 border-4 border-white shadow-sm">
                      <MessageSquare size={16} className="text-red-500" aria-hidden="true" />
                    </div>
                    <p className="cms-m-body font-medium leading-relaxed italic pl-3">
                      {(ev.content || ev.comment || '').trim()
                        ? `"${(ev.content || ev.comment).trim()}"`
                        : <span className="text-slate-400 not-italic">Không có lời nhắn đi kèm.</span>}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col min-[400px]:flex-row gap-2 flex-shrink-0">
                  {!ev.read && (
                    <button
                      type="button"
                      onClick={() => markEvaluationRead(ev.id)}
                      className="cms-m-btn flex-1 bg-red-600 text-white hover:bg-red-700 shadow-sm"
                    >
                      <CheckCircle2 size={16} /> Đã xem
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/admin/inbox', { state: { selectUserId: ev.studentId } })}
                    className="cms-m-btn flex-1 bg-slate-900 text-white hover:bg-black shadow-sm"
                  >
                    <MessageCircle size={16} /> Phản hồi học viên
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
