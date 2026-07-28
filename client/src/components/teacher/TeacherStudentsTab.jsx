import React from 'react';
import { Search, MessageSquare, Users, GraduationCap } from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import TeacherStudentCard from './TeacherStudentCard';

export default function TeacherStudentsTab({
  studentSearch, setStudentSearch, students, onlineUsers, lastSeenUsers, timeAgo,
  selectedEnrollmentKey, setSelectedEnrollmentKey, navigate, mySchedules,
  markAttendance, updateLink, saveGrade, updateNotes, lockStudentExam,
}) {
  return (
          <div className="px-4 md:px-8 py-4 sm:py-6 min-h-[calc(100vh-120px)] xl:h-[calc(100vh-120px)] flex flex-col xl:flex-row gap-4 sm:gap-6 xl:overflow-hidden">
            
            {/* CỘT 1: DANH SÁCH HỌC VIÊN (Sidebar) */}
            <div className="w-full xl:w-80 h-[420px] sm:h-[500px] xl:h-full flex flex-col bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex-shrink-0">
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
               
               <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                              <img src={resolveAvatarUrl({ role: 'student' })} alt="" className="w-full h-full object-cover" />
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
                                navigate('/teacher/inbox', { state: { selectUserId: String(sId) } }); 
                              }} 
                              className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 hover:text-blue-700 transition-all border-none outline-none shrink-0"
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
            <div className="flex-1 xl:overflow-y-auto pr-1">
              {selectedEnrollmentKey ? (
                (() => {
                  const student = students.find(s => String(s._enrollmentKey || s._id || s.id) === String(selectedEnrollmentKey));
                  if (!student) return <div className="p-20 text-center text-gray-400">Không tìm thấy thông tin</div>;

                  // ─── TÍNH TOÁN CỔNG ĐIỂM DANH (THEO LỊCH + KHÓA) ───
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = String(now.getMonth() + 1).padStart(2, '0');
                  const d = String(now.getDate()).padStart(2, '0');
                  const todayStr = `${y}-${m}-${d}`;

                  const studentId = student._id || student.id;
                  const courseName = student.course || '';
                  const todaySchedules = mySchedules.filter(s =>
                    String(s.studentId) === String(studentId) &&
                    s.date.startsWith(todayStr) &&
                    s.status === 'scheduled' &&
                    (!courseName || !s.course || s.course === courseName)
                  );
                  
                  let attendanceGate = { status: 'no_schedule' };
                  if (todaySchedules.length > 0) {
                    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const readySch = todaySchedules.find(s => currentTime >= s.startTime);
                    if (readySch) {
                      attendanceGate = { status: 'ready' };
                    } else {
                      attendanceGate = { status: 'not_yet' };
                    }
                  }

                  return (
                    <TeacherStudentCard 
                      key={student._enrollmentKey || student._id || student.id} student={student}
                      onAttendance={(id, note, grade) => markAttendance(id, note, grade, courseName)} onUpdateLink={updateLink}
                      onSaveGrade={saveGrade} onUpdateNotes={updateNotes}
                      onLockExam={lockStudentExam} 
                      isDetailed={true}
                      attendanceGate={attendanceGate}
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
