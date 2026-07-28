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
          <div className="cms-sd cms-sd-page cms-sd-stack max-w-5xl">
            <CourseSwitcher
              courses={enrollments}
              activeCourseName={activeCourseName || viewStudent.course}
              onChange={setActiveCourseName}
            />
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <h2 className="cms-sd-section-title flex items-start sm:items-center gap-2 min-w-0">
                <Calendar size={20} className="text-blue-500 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
                <span className="min-w-0 leading-snug">
                  Lịch học — <span className="line-clamp-2 sm:line-clamp-none">{viewStudent.course}</span>
                </span>
              </h2>
              <span className="cms-sd-caption sm:text-right tabular-nums pl-7 sm:pl-0">
                {mySchedules?.filter(s => s.status === 'completed').length || 0}/{viewStudent.totalSessions} buổi hoàn thành
              </span>
            </div>
            <ScheduleView schedules={mySchedules} student={viewStudent} setNoteModalSched={setNoteModalSched} />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText size={20} className="text-emerald-500 shrink-0" aria-hidden="true" />
                <h3 className="cms-sd-section-title">Nhật ký học tập &amp; Điểm số</h3>
              </div>
              <div className="cms-sd-card !p-0 overflow-hidden">
                {displayGrades.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {displayGrades.map((g, idx) => {
                      let parsedDate = g.date;
                      if (parsedDate && parsedDate.includes('T')) {
                        parsedDate = new Date(parsedDate).toLocaleDateString('vi-VN');
                      }
                      const noteLower = (g.note || '').toLowerCase();
                      const isUpdated = noteLower.includes('cập nhật điểm') || noteLower.includes('sửa điểm');
                      const isHomework = noteLower.includes('bài nộp') || isUpdated;
                      return (
                      <div key={g._idx ?? idx} className="p-4 hover:bg-slate-50 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between transition-colors duration-200">
                        <div className="min-w-0">
                          <p className="cms-sd-body font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                            {g.time ? `${g.time} - ${parsedDate}` : parsedDate}
                            {isUpdated ? (
                              <span className="cms-sd-caption bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase">Cập nhật điểm</span>
                            ) : isHomework ? (
                              <span className="cms-sd-caption bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase">Nộp bài</span>
                            ) : (
                              <span className="cms-sd-caption bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full uppercase">Điểm danh</span>
                            )}
                          </p>
                          <p className="cms-sd-body text-slate-600 mt-1 break-words">{g.note}</p>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <span className={`text-[15px] font-extrabold tabular-nums ${getGradeTextClasses(g.grade)}`}>
                            {g.grade > 0 ? `${g.grade}/10` : '--'}
                          </span>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="cms-sd-empty">
                    <div className="cms-sd-empty__icon">
                      <FileText size={22} aria-hidden="true" />
                    </div>
                    <p className="cms-sd-body font-semibold text-slate-600">Chưa có dữ liệu điểm danh.</p>
                    <p className="cms-sd-caption">Dữ liệu sẽ xuất hiện sau khi bắt đầu học.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
  );
}
