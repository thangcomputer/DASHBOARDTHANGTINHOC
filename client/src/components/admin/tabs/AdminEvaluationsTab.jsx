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
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-red-50 to-white">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-red-500" />
                    Báo Cáo Đánh Giá Chất Lượng Nội Bộ (Milestone)
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">Đây là các đánh giá riêng tư từ học viên được gửi trực tiếp cho Admin tại các mốc Buổi 1 và 50% khóa học.</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {getPrivateEvaluationsForAdmin().length === 0 ? (
                    <div className="p-20 text-center animate-in fade-in duration-700">
                      <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm">
                        <ShieldAlert size={32} className="text-gray-200" />
                      </div>
                      <h3 className="text-gray-900 font-bold text-lg">Chưa có đánh giá nội bộ</h3>
                      <p className="text-gray-400 text-sm max-w-xs mx-auto">Phản hồi bí mật từ học viên về chất lượng giảng dạy sẽ xuất hiện tại đây.</p>
                    </div>
                  ) : getPrivateEvaluationsForAdmin().map(ev => (
                    <div key={ev.id} className={`p-6 transition-colors border-l-4 ${ev.read ? 'border-transparent hover:bg-gray-50' : 'border-red-500 bg-red-50/30'}`}>
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            {!ev.read && <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded animate-pulse">MỚI</span>}
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${ev.milestone === 'lesson_1' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {ev.milestone === 'lesson_1' ? 'BUỔI ĐẦU TIÊN' : ev.milestone === 'manual_feedback' ? 'PHẢN HỒI TỰ NGUYỆN' : 'MỐC 50% KHÓA'}
                            </span>
                            <span className="text-xs text-gray-400">{ev.date}</span>
                          </div>
                          <h4 className="font-bold text-gray-800">HV: {ev.studentName} → GV: {ev.teacherName}</h4>
                          {ev.courseName && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-100">
                                📚 {ev.courseName}
                              </span>
                            </div>
                          )}
                          <div className="flex gap-3">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-100 rounded-xl shadow-sm">
                              <span className="text-xs font-bold text-gray-400 uppercase">Hài lòng:</span>
                              <span className={`text-xs font-black ${ev.criteria?.satisfied === 'yes' ? 'text-green-600' : 'text-red-600'}`}>
                                {ev.criteria?.satisfied === 'yes' ? 'CÓ' : 'KHÔNG'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-100 rounded-xl shadow-sm">
                              <span className="text-xs font-bold text-gray-400 uppercase">Dễ hiểu:</span>
                              <span className={`text-xs font-black ${ev.criteria?.lessonClear === 'yes' ? 'text-green-600' : 'text-orange-600'}`}>
                                {ev.criteria?.lessonClear === 'yes' ? 'HIỂU' : 'HƠI KHÓ'}
                              </span>
                            </div>
                          </div>
                          <div className="bg-white p-5 rounded-3xl border-2 border-red-50 relative mt-4 shadow-sm min-h-[80px] flex items-center">
                            <div className="absolute -left-3 -top-3 bg-red-100 rounded-full p-2 border-4 border-white shadow-sm">
                               <MessageSquare size={18} className="text-red-500" />
                            </div>
                            <p className="text-base text-gray-800 font-medium leading-relaxed italic pl-2">
                              {ev.comment ? `"${ev.comment}"` : <span className="text-gray-400">Không có lời nhắn đi kèm.</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {!ev.read && (
                            <button
                              onClick={() => markEvaluationRead(ev.id)}
                              className="flex items-center justify-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition shadow-md"
                            >
                              <CheckCircle2 size={14} /> Đã xem
                            </button>
                          )}
                          <button
                            onClick={() => navigate('/admin/inbox', { state: { selectUserId: ev.studentId } })}
                            className="flex items-center justify-center gap-1.5 bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black transition shadow-lg"
                          >
                            <MessageCircle size={14} /> Phản hồi học viên
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
