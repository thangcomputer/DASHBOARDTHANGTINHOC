import React from 'react';
import { Calendar, FileText } from 'lucide-react';
import { CourseSwitcher } from './StudentShared';
import { ScheduleView } from './StudentScheduleView';
import { getGradeTextClasses } from '../../utils/gradeColors';

export default function StudentScheduleTab({
  enrollments,
  activeCourseName,
  setActiveCourseName,
  viewStudent,
  mySchedules,
  setNoteModalSched,
  displayGrades,
}) {
  return (
          <div className="w-full max-w-5xl mx-auto px-0.5 sm:px-4 md:px-8 py-3 sm:py-5 space-y-3 sm:space-y-4 min-w-0">
            <CourseSwitcher
              courses={enrollments}
              activeCourseName={activeCourseName || viewStudent.course}
              onChange={setActiveCourseName}
            />
            <div className="flex flex-col gap-1 sm:gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <h2 className="text-lg font-black text-gray-800 flex items-start sm:items-center gap-2 min-w-0">
                <Calendar size={18} className="text-blue-500 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
                <span className="min-w-0 leading-snug">
                  Lịch học — <span className="line-clamp-2 sm:line-clamp-none">{viewStudent.course}</span>
                </span>
              </h2>
              <span className="text-xs text-gray-400 sm:text-right tabular-nums pl-7 sm:pl-0">
                {mySchedules?.filter(s => s.status === 'completed').length || 0}/{viewStudent.totalSessions} buổi hoàn thành
              </span>
            </div>
            <ScheduleView schedules={mySchedules} student={viewStudent} setNoteModalSched={setNoteModalSched} />

            {/* Nhật ký điểm danh & nhận xét */}
            <div className="mt-4 sm:mt-6">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={18} className="text-emerald-500 shrink-0" aria-hidden="true" />
                <h3 className="font-bold text-gray-800 text-base sm:text-lg">Nhật ký học tập &amp; Điểm số</h3>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {displayGrades.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {displayGrades.map((g, idx) => {
                      let parsedDate = g.date;
                      if (parsedDate && parsedDate.includes('T')) {
                        parsedDate = new Date(parsedDate).toLocaleDateString('vi-VN');
                      }
                      const noteLower = (g.note || '').toLowerCase();
                      const isUpdated = noteLower.includes('cập nhật điểm') || noteLower.includes('sửa điểm');
                      const isHomework = noteLower.includes('bài nộp') || isUpdated;
                      return (
                      <div key={g._idx ?? idx} className="p-3.5 sm:p-4 hover:bg-gray-50 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between transition-colors duration-200">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-800 flex items-center gap-2 flex-wrap">
                            {g.time ? `${g.time} - ${parsedDate}` : parsedDate}
                            {isUpdated ? (
                              <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase">Cập nhật điểm</span>
                            ) : isHomework ? (
                              <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full uppercase">Nộp bài</span>
                            ) : (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full uppercase">Điểm danh</span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600 mt-1 break-words leading-snug">{g.note}</p>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <span className={`text-lg font-black tabular-nums ${getGradeTextClasses(g.grade)}`}>
                            {g.grade > 0 ? `${g.grade}/10` : '--'}
                          </span>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                      <FileText size={22} className="text-slate-300" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Chưa có dữ liệu điểm danh.</p>
                    <p className="text-xs text-slate-400 mt-1">Dữ liệu sẽ xuất hiện sau khi bắt đầu học.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
  );
}
