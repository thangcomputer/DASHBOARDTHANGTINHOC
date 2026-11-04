import React, { useState } from 'react';
import { isUserOnline } from '../../utils/presence';
import { ArrowLeft, Search, MessageSquare, Users, GraduationCap } from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import { matchesPersonSearch } from '../../utils/personSearch';
import TeacherStudentCard from './TeacherStudentCard';
import { getAttendanceAction } from '../../utils/attendanceAction';
import { normalizeScheduleDate } from '../../utils/scheduleTime';

/** GV mở hộp thư với HV đã gán (deep-link Inbox). */
function navigateTeacherStudentChat(navigate, student) {
  if (!navigate || !student) return;
  const id = String(student._id || student.id || '');
  if (!id) return;
  navigate('/teacher/inbox', {
    state: {
      selectUserId: id,
      selectUser: {
        id,
        name: student.name || 'Học viên',
        role: 'student',
        avatar: student.avatar,
        trusted: true,
      },
    },
  });
}

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
  studentSearch, setStudentSearch, studentStatusFilter, setStudentStatusFilter,
  students, onlineUsers, lastSeenUsers,
  selectedEnrollmentKey, setSelectedEnrollmentKey, navigate, mySchedules,
  markAttendance, updateLink, saveGrade, updateNotes, lockStudentExam,
  cancelSchedule,
}) {
  const [mobileDetailOpen, setMobileDetailOpen] = useState(() => {
    const query = window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(query);
    return params.has('enrollmentKey') || params.has('studentId');
  });

  const resolveStudentStatus = (student) => {
    const enrollmentStatus = String(student?.enrollmentStatus || '').toLowerCase();
    if (Boolean(student?.interactionLocked)
      || ['cancelled', 'refunded'].includes(enrollmentStatus)
      || String(student?.status || '') === 'Thôi học') {
      return 'dropped';
    }
    if (enrollmentStatus === 'completed'
      || String(student?.status || '').toLowerCase() === 'completed'
      || (Number(student?.remainingSessions) <= 0 && Number(student?.totalSessions) > 0)) {
      return 'completed';
    }
    return 'active';
  };

  const visibleStudents = students
    .filter((student) => studentStatusFilter === 'all' || resolveStudentStatus(student) === studentStatusFilter)
    .filter((student) => matchesPersonSearch(studentSearch, {
      name: student.name,
      phone: student.phone,
      zalo: student.zalo,
      extra: student.course || '',
    }))
    .slice()
    .sort((a, b) => {
      const aId = String(a._id || a.id || '');
      const bId = String(b._id || b.id || '');
      const aDropped = Boolean(a.interactionLocked)
        || ['cancelled', 'refunded'].includes(String(a.enrollmentStatus || '').toLowerCase())
        || String(a.status || '') === 'Thôi học';
      const bDropped = Boolean(b.interactionLocked)
        || ['cancelled', 'refunded'].includes(String(b.enrollmentStatus || '').toLowerCase())
        || String(b.status || '') === 'Thôi học';
      if (aDropped !== bDropped) return aDropped ? 1 : -1;
      const aOn = !aDropped && isUserOnline(onlineUsers, a) ? 1 : 0;
      const bOn = !bDropped && isUserOnline(onlineUsers, b) ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      const aSeen = new Date(lastSeenUsers?.[aId] || a.lastAccessAt || 0).getTime() || 0;
      const bSeen = new Date(lastSeenUsers?.[bId] || b.lastAccessAt || 0).getTime() || 0;
      if (aSeen !== bSeen) return bSeen - aSeen;
      return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
    });

  return (
          <div className="cms-page-gutter py-3 sm:py-4 md:py-6 min-h-0 flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 lg:min-h-0 overflow-y-auto overscroll-y-contain lg:overflow-hidden min-w-0 w-full max-w-full">
            
            {/* CỘT 1: DANH SÁCH HỌC VIÊN (Sidebar) */}
            <div className={`${mobileDetailOpen ? 'hidden' : 'flex'} lg:flex w-full lg:w-80 xl:w-96 lg:h-full flex-col bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0 min-w-0 min-h-0 max-lg:flex-none`}>
               <div className="p-3 sm:p-4 border-b border-slate-50 bg-slate-50/40">
                  <div className="relative">
                    <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Tìm tên, SĐT, Zalo, khóa học..."
                      aria-label="Tìm tên, số điện thoại, Zalo hoặc khóa học"
                      className="w-full min-h-11 pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-all"
                    />
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Lọc trạng thái học viên">
                    {[
                      ['all', 'Tất cả'],
                      ['active', 'Đang học'],
                      ['completed', 'Học xong'],
                      ['dropped', 'Thôi học'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStudentStatusFilter(value)}
                        role="tab"
                        aria-selected={studentStatusFilter === value}
                        className={`min-h-9 shrink-0 rounded-lg border px-3 text-sm font-bold transition-colors ${
                          studentStatusFilter === value
                            ? 'border-red-600 bg-red-600 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:text-red-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
               </div>
               
               <div className="flex-1 min-h-0 overflow-visible lg:overflow-y-auto p-2 space-y-2">
                  <p className="px-1 text-sm font-semibold text-slate-500" aria-live="polite">
                    {visibleStudents.length} học viên
                  </p>
                  {visibleStudents.map(s => {
                      const sId = s._id || s.id;
                      const rowKey = s._enrollmentKey || String(sId);
                      const isOnline = isUserOnline(onlineUsers, s);
                      const isSelected = String(selectedEnrollmentKey) === String(rowKey);
                      const isDropped = Boolean(s.interactionLocked)
                        || ['cancelled', 'refunded'].includes(String(s.enrollmentStatus || '').toLowerCase())
                        || String(s.status || '') === 'Thôi học';
                      return (
                        <div
                          key={rowKey}
                          onClick={() => {
                            setSelectedEnrollmentKey(s);
                            setMobileDetailOpen(true);
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Mở hồ sơ ${s.name}`}
                          aria-pressed={isSelected}
                          className={`w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30 ${
                            isDropped ? 'opacity-60 grayscale-[0.25]' : ''
                          } ${isSelected ? 'lg:border-blue-300 lg:bg-blue-50/60' : ''}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedEnrollmentKey(s);
                              setMobileDetailOpen(true);
                            }
                          }}
                        >
                          <div className="relative shrink-0">
                            <div className="w-11 h-11 rounded-full overflow-hidden shadow-sm bg-white border border-slate-100">
                              <img src={resolveAvatarUrl({ avatar: s.avatar, role: 'student', gender: s.gender })} alt="" className="w-full h-full object-cover" />
                            </div>
                            {isOnline && !isDropped && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" title="Đang hoạt động" />
                            )}
                          </div>
                          
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className={`min-w-0 flex-1 text-base font-bold truncate ${isDropped ? 'text-slate-500' : 'text-slate-900'}`}>{s.name}</p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                                isDropped
                                  ? 'bg-slate-100 text-slate-600'
                                  : resolveStudentStatus(s) === 'completed'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-blue-50 text-blue-700'
                              }`}>
                                {isDropped ? 'Thôi học' : resolveStudentStatus(s) === 'completed' ? 'Học xong' : 'Đang học'}
                              </span>
                            </div>
                            {s.course && (
                              <p className={`text-sm font-semibold tracking-tight truncate mt-0.5 ${isSelected ? 'text-blue-600' : 'text-indigo-600'}`}>
                                {s.course}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={`text-sm font-medium ${isOnline && !isDropped ? 'text-emerald-700' : 'text-slate-500'}`}>
                                {isDropped
                                  ? 'Đã ngừng học'
                                  : isOnline
                                    ? 'Trực tuyến'
                                    : lastSeenUsers[String(sId)] || s.lastAccessAt
                                      ? `Truy cập ${new Date(lastSeenUsers[String(sId)] || s.lastAccessAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                                      : 'Chưa có dữ liệu truy cập'}
                              </span>
                            </div>
                          </div>
                          
                          <button 
                              type="button"
                              disabled={isDropped}
                              onClick={(e) => { 
                                e.stopPropagation();
                                if (isDropped) return;
                                navigateTeacherStudentChat(navigate, s);
                              }} 
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border-none outline-none shrink-0 ${
                                isDropped
                                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                              }`}
                              title={isDropped ? 'HV đã thôi học — không nhắn tin' : 'Nhắn tin với học viên'}
                              aria-label="Nhắn tin với học viên"
                            >
                              <MessageSquare size={17} />
                            </button>
                        </div>
                      );
                    })}
                  {visibleStudents.length === 0 && (
                     <div className="text-center py-10 text-slate-400">
                        <Users size={40} className="mx-auto mb-2" />
                        <p className="text-sm font-bold">{students.length ? 'Không tìm thấy học viên' : 'Chưa có học viên'}</p>
                        {students.length > 0 && <p className="mt-1 text-sm">Thử tìm theo tên hoặc khóa học khác.</p>}
                     </div>
                  )}
               </div>
            </div>

            {/* CỘT 2: CHI TIẾT HỌC VIÊN (Main Content) */}
            <div className={`${mobileDetailOpen ? 'flex' : 'hidden'} lg:flex flex-1 min-w-0 min-h-0 flex-col lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden pr-0 pb-4 sm:pr-1 sm:pb-6`}>
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
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileDetailOpen(false);
                          navigate(
                            { pathname: window.location.pathname, hash: 'students' },
                            { replace: true },
                          );
                        }}
                        className="mb-3 inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
                      >
                        <ArrowLeft size={17} />
                        Danh sách học viên
                      </button>
                      <TeacherStudentCard
                        key={student._enrollmentKey || student._id || student.id} student={student}
                        onAttendance={(id, note, grade) => markAttendance(id, note, grade, courseName)} onUpdateLink={updateLink}
                        onSaveGrade={saveGrade} onUpdateNotes={updateNotes}
                        onLockExam={lockStudentExam}
                        isDetailed={true}
                        attendanceGate={attendanceGate}
                        myStudents={students}
                        onCancelSchedule={cancelSchedule}
                        navigate={navigate}
                      />
                    </>
                  );
                })()
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-[40px] border-2 border-dashed border-gray-100 text-gray-300 max-lg:hidden">
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
