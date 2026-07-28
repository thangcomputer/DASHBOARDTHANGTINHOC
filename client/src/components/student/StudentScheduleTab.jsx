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
          <div className="w-full max-w-5xl mx-auto px-1 sm:px-4 md:px-8 py-4 sm:py-6 space-y-4">
            <CourseSwitcher
              courses={enrollments}
              activeCourseName={activeCourseName || viewStudent.course}
              onChange={setActiveCourseName}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 min-w-0">
                <Calendar size={20} className="text-blue-500" /> Lịch học — {viewStudent.course}
              </h2>
              <span className="text-xs text-gray-400 sm:text-right">
                {mySchedules?.filter(s => s.status === 'completed').length || 0}/{viewStudent.totalSessions} buổi hoàn thành
              </span>
            </div>
            <ScheduleView schedules={mySchedules} student={viewStudent} setNoteModalSched={setNoteModalSched} />

            {/* Nhật ký điểm danh & nhận xét */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={20} className="text-emerald-500" />
                <h3 className="font-bold text-gray-800 text-lg">Nhật ký học tập & Điểm số</h3>
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
                      <div key={g._idx ?? idx} className="p-4 hover:bg-gray-50 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between transition-colors">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                            {g.time ? `${g.time} - ${parsedDate}` : parsedDate}
                            {isUpdated ? (
                              <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase">Cập nhật điểm</span>
                            ) : isHomework ? (
                              <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full uppercase">Nộp bài</span>
                            ) : (
                              <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full uppercase">Điểm danh</span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600 mt-1 break-words">{g.note}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-black ${getGradeTextClasses(g.grade)}`}>
                            {g.grade > 0 ? `${g.grade}/10` : '--'}
                          </span>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    Chưa có dữ liệu điểm danh.
                  </div>
                )}
              </div>
            </div>
          </div>
  );
}
