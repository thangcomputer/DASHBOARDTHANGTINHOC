import React from 'react';
import { FileText, ClipboardList, CheckCircle, Award } from 'lucide-react';
import { ScheduleView } from './StudentScheduleView';
import { getGradeTextClasses, getGradePillClasses, getGradeLabel } from '../../utils/gradeColors';

export default function StudentScheduleTab({
  viewStudent,
  mySchedules,
  setNoteModalSched,
  displayGrades,
}) {
  return (
    <div className="space-y-6 sm:space-y-8 w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-in fade-in duration-500">
      <ScheduleView schedules={mySchedules} student={viewStudent} setNoteModalSched={setNoteModalSched} />

      {/* Nhật ký học tập & Điểm số */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-100">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Nhật ký học tập &amp; Điểm số
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Chi tiết đánh giá các buổi học, bài tập nộp và điểm số ghi nhận
              </p>
            </div>
          </div>
          {displayGrades && displayGrades.length > 0 && (
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full w-fit">
              {displayGrades.length} lượt ghi nhận
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {displayGrades && displayGrades.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {displayGrades.map((g, idx) => {
                let parsedDate = g.date;
                if (parsedDate && parsedDate.includes('T')) {
                  parsedDate = new Date(parsedDate).toLocaleDateString('vi-VN');
                }
                const noteLower = (g.note || '').toLowerCase();
                const isUpdated = noteLower.includes('cập nhật điểm') || noteLower.includes('sửa điểm');
                const isHomework = noteLower.includes('bài nộp') || isUpdated;
                const isQuiz = noteLower.includes('trắc nghiệm');
                return (
                  <div
                    key={g._idx ?? idx}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between transition-colors duration-200"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                        isQuiz ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                        isHomework ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {isQuiz ? <Award size={18} /> : isHomework ? <ClipboardList size={18} /> : <CheckCircle size={18} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono">
                            {g.time ? `${g.time} - ${parsedDate}` : parsedDate}
                          </span>
                          {isUpdated ? (
                            <span className="text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                              Cập nhật điểm
                            </span>
                          ) : isHomework ? (
                            <span className="text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Bài nộp
                            </span>
                          ) : isQuiz ? (
                            <span className="text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                              Trắc nghiệm
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                              Điểm danh
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 leading-relaxed break-words">
                          {g.note || 'Đã điểm danh hoàn thành buổi học'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-13 sm:pl-0">
                      {g.grade > 0 ? (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl">
                          <span className={`text-base sm:text-lg font-black tabular-nums ${getGradeTextClasses(g.grade)}`}>
                            {g.grade}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">/ 10</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ml-1 ${getGradePillClasses(g.grade)}`}>
                            {getGradeLabel(g.grade) || 'TB'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold italic">--</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300 border border-slate-100">
                <FileText size={22} />
              </div>
              <p className="text-sm font-bold text-slate-700">Chưa có dữ liệu điểm danh</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Dữ liệu bài tập, điểm số và kết quả điểm danh sẽ tự động xuất hiện tại đây sau khi bắt đầu khóa học.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
