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
          <div className="px-4 md:px-8 py-6 min-h-[calc(100vh-120px)] xl:h-[calc(100vh-120px)] flex flex-col xl:flex-row gap-6 xl:overflow-hidden">
            
            {/* CỘT 1: DANH SÁCH HỌC VIÊN (Sidebar) */}
            <div className="w-full xl:w-80 h-[500px] xl:h-full flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
               <div className="p-4 border-b border-gray-50 bg-gray-50/30">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Tìm học viên..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-all"
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
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group cursor-pointer ${
                            isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedEnrollmentKey(rowKey); } }}
                        >
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm bg-white">
                              <img src={resolveAvatarUrl({ role: 'student' })} alt="" className="w-full h-full object-cover" />
                            </div>
                            {isOnline && (
                              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" title="Đang hoạt động" />
                            )}
                          </div>
                          
                          <div className="flex-1 text-left min-w-0">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>{s.name}</p>
                            {s.course && (
                              <p className={`text-[10px] font-black uppercase tracking-tight truncate mt-0.5 ${isSelected ? 'text-blue-200' : 'text-indigo-600'}`}>
                                {s.course}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isOnline ? (
                                <span className={`text-xs font-bold uppercase tracking-tighter ${isSelected ? 'text-blue-200' : 'text-green-500'}`}>Đang online</span>
                              ) : (
                                <span className={`text-xs font-medium ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                                  {lastSeenUsers[String(sId)]
                                    ? `${timeAgo(lastSeenUsers[String(sId)])}`
                                    : 'Chưa online'}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {!isSelected && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                navigate('/teacher/inbox'); 
                              }} 
                              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-600 transition-all border-none outline-none"
                            >
                              <MessageSquare size={14} />
                            </button>
                          )}
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
