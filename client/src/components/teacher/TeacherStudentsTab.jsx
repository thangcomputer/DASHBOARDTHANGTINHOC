import React from 'react';
import { Search, MessageSquare, Users, GraduationCap } from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import TeacherStudentCard from './TeacherStudentCard';
import { openSiteChat } from '../FloatingMessenger';
import { getAttendanceAction } from '../../utils/attendanceAction';
import { normalizeScheduleDate } from '../../utils/scheduleTime';

function resolveTodayAttendanceGate(todaySchedules) {
  if (!todaySchedules.length) return { status: 'no_schedule' };
  const now = new Date();
  const ranked = todaySchedules.map((schedule) => ({
    schedule,
    meta: getAttendanceAction(schedule, null, now),
  }));
  // Ưu tiên: đã điểm danh > còn điểm danh được > quá hạn (bù) > chưa tới giờ
  const done = ranked.find(
    (x) => x.meta.state === 'COMPLETED' || String(x.schedule?.status || '') === 'completed',
  );
  if (done) {
    return { status: 'done', schedule: done.schedule, meta: done.meta };
  }
  const attendable = ranked.find((x) => x.meta.canAttend);
  if (attendable) {
    return { status: 'ready', schedule: attendable.schedule, meta: attendable.meta };
  }
  const overdue = ranked.find((x) => x.meta.state === 'OVERDUE_ATTENDANCE');
  if (overdue) {
    return { status: 'overdue', schedule: overdue.schedule, meta: overdue.meta };
  }
  const upcoming = ranked.find((x) => x.meta.state === 'UPCOMING');
  if (upcoming) {
    return { status: 'not_yet', schedule: upcoming.schedule, meta: upcoming.meta };
  }
  return { status: 'ready', schedule: ranked[0].schedule, meta: ranked[0].meta };
}

export default function TeacherStudentsTab({
  studentSearch, setStudentSearch, students, onlineUsers, lastSeenUsers, timeAgo,
  selectedEnrollmentKey, setSelectedEnrollmentKey, navigate, mySchedules,
  markAttendance, updateLink, saveGrade, updateNotes, lockStudentExam,
  cancelSchedule,
}) {
  return (
          <div className="py-1 sm:py-4 md:py-6 min-h-0 flex-1 flex flex-col xl:flex-row gap-4 sm:gap-6 xl:min-h-0 xl:overflow-hidden min-w-0 w-full max-w-full">
            
            {/* CỘT 1: DANH SÁCH HỌC VIÊN (Sidebar) */}
            <div className="w-full xl:w-80 xl:h-full flex flex-col bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0 min-w-0 max-xl:flex-none">
               <div className="p-3 sm:p-4 border-b border-slate-50 bg-slate-50/40">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Tìm học viên..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-all"
                    />
                  </div>
               </div>
               
               <div className="flex-1 min-h-0 overflow-visible xl:overflow-y-auto p-2 space-y-1">
                  {students
                    .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.course?.toLowerCase().includes(studentSearch.toLowerCase()))
                    .map(s => {
                      const sId = s._id || s.id;
                      const rowKey = s._enrollmentKey || String(sId);
                      const isOnline = onlineUsers.some(u => String(u.userId) === String(sId));
                      const isSelected = String(selectedEnrollmentKey) === String(rowKey);
                      return (
                        <div
                          key={rowKey}
                          onClick={() => setSelectedEnrollmentKey(rowKey)}
                          role="button"
                          tabIndex={0}
                          className={`w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-xl transition-all group cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-50/60 border-blue-200 border-l-4 border-l-blue-600 shadow-sm'
                              : 'border-transparent hover:bg-slate-50 text-slate-700'
                          }`}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedEnrollmentKey(rowKey); } }}
                        >
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm bg-white border border-slate-100">
                              <img src={resolveAvatarUrl({ avatar: s.avatar, role: 'student', gender: s.gender })} alt="" className="w-full h-full object-cover" />
                            </div>
                            {isOnline && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" title="Đang hoạt động" />
                            )}
                          </div>
                          
                          <div className="flex-1 text-left min-w-0">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-slate-900' : 'text-slate-900'}`}>{s.name}</p>
                            {s.course && (
                              <p className={`text-[10px] font-bold uppercase tracking-tight truncate mt-0.5 ${isSelected ? 'text-blue-600' : 'text-indigo-600'}`}>
                                {s.course}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1">
                              {isOnline ? (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                  Đang online
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">
                                  {lastSeenUsers[String(sId)]
                                    ? `${timeAgo(lastSeenUsers[String(sId)])}`
                                    : 'Chưa online'}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <button 
                              type="button"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                openSiteChat({
                                  id: String(sId),
                                  name: s.name || 'Học viên',
                                  role: 'student',
                                  avatar: s.avatar,
                                });
                              }} 
                              className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 hover:text-blue-700 transition-all border-none outline-none shrink-0"
                              title="Nhắn tin nội bộ"
                              aria-label="Nhắn tin nội bộ"
                            >
                              <MessageSquare size={14} />
                            </button>
                        </div>
                      );
                    })
                  }
                  {students.length === 0 && (
                     <div className="text-center py-10 opacity-30">
                        <Users size={40} className="mx-auto mb-2" />
                        <p className="text-sm font-bold">Chưa có học viên</p>
                     </div>
                  )}
               </div>
            </div>

            {/* CỘT 2: CHI TIẾT HỌC VIÊN (Main Content) */}
            <div className="flex-1 min-w-0 xl:overflow-y-auto pr-0 sm:pr-1">
              {selectedEnrollmentKey ? (
                (() => {
                  const student = students.find(s => String(s._enrollmentKey || s._id || s.id) === String(selectedEnrollmentKey));
                  if (!student) return <div className="p-20 text-center text-gray-400">Không tìm thấy thông tin</div>;

                  // ─── CỔNG ĐIỂM DANH: hôm nay + buổi quá hạn hôm qua (điểm danh bù) ───
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = String(now.getMonth() + 1).padStart(2, '0');
                  const d = String(now.getDate()).padStart(2, '0');
                  const todayStr = `${y}-${m}-${d}`;
                  const yday = new Date(now);
                  yday.setDate(yday.getDate() - 1);
                  const ydayStr = `${yday.getFullYear()}-${String(yday.getMonth() + 1).padStart(2, '0')}-${String(yday.getDate()).padStart(2, '0')}`;

                  const studentId = student._id || student.id;
                  const courseName = student.course || '';
                  const matchStudentCourse = (s, statuses) =>
                    String(s.studentId?._id || s.studentId?.id || s.studentId) === String(studentId) &&
                    statuses.includes(String(s.status || '')) &&
                    (!courseName || !s.course || s.course === courseName);

                  const todayCompleted = (mySchedules || []).filter((s) =>
                    matchStudentCourse(s, ['completed']) && normalizeScheduleDate(s.date) === todayStr
                  );
                  const todaySchedules = (mySchedules || []).filter((s) =>
                    matchStudentCourse(s, ['scheduled']) && normalizeScheduleDate(s.date) === todayStr
                  );
                  // Chỉ lấy lịch hôm qua quá hạn khi hôm nay CHƯA điểm danh — tránh hiện "Điểm danh bù" sau khi đã điểm danh
                  const ydayOverdue = todayCompleted.length
                    ? []
                    : (mySchedules || []).filter((s) =>
                      matchStudentCourse(s, ['scheduled'])
                      && normalizeScheduleDate(s.date) === ydayStr
                      && getAttendanceAction(s, null, now).state === 'OVERDUE_ATTENDANCE'
                    );

                  const attendanceGate = todayCompleted.length
                    ? resolveTodayAttendanceGate(todayCompleted)
                    : resolveTodayAttendanceGate(
                      todaySchedules.length ? todaySchedules : ydayOverdue
                    );

                  return (
                    <TeacherStudentCard 
                      key={student._enrollmentKey || student._id || student.id} student={student}
                      onAttendance={(id, note, grade) => markAttendance(id, note, grade, courseName)} onUpdateLink={updateLink}
                      onSaveGrade={saveGrade} onUpdateNotes={updateNotes}
                      onLockExam={lockStudentExam} 
                      isDetailed={true}
                      attendanceGate={attendanceGate}
                      myStudents={students}
                      onCancelSchedule={cancelSchedule}
                    />
                  );
                })()
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-[40px] border-2 border-dashed border-gray-100 text-gray-300">
                   <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <GraduationCap size={40} />
                   </div>
                   <p className="font-bold">Vui lòng chọn học viên ở danh sách bên trái</p>
                </div>
              )}
            </div>
          </div>
  );
}
