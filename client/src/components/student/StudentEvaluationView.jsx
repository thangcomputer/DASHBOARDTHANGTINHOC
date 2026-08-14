import React, { useState } from 'react';
import { Star, ChevronRight, CheckCircle, AlertCircle, User, BookOpen, Settings } from 'lucide-react';
import { useModal } from '../../utils/Modal.jsx';

export const EvaluationView = ({ 
  studentData, 
  evaluatingCourseId, 
  setEvaluatingCourseId, 
  STUDENT_ID, 
  submitPrivateEvaluation,
  getTeacherRating,
  ratingSubmitted,
  setRatingSubmitted,
  isEditingRating,
  setIsEditingRating,
  ratingCriteria,
  setRatingCriteria,
  ratingComment,
  setRatingComment,
  RATING_CRITERIA,
  rateTeacher,
  privateEvaluations,
  teacherRatingData,
  setTeacherRatingData,
  api
}) => {
  const { showModal } = useModal();
  const [privateForm, setPrivateForm] = useState({ satisfied: 'yes', lessonClear: 'yes', comment: '' });
  const [activeTab, setActiveTab] = useState('admin'); // 'admin' | 'teacher'
  const [selectedRateTeacherId, setSelectedRateTeacherId] = useState('');

  return (
    <div className="w-full min-w-0 py-2 sm:py-6 space-y-5 sm:space-y-8 animate-in fade-in duration-500">
      {/* Introduction */}
      <div className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 sm:w-40 sm:h-40 bg-white/10 rounded-full -mr-16 -mt-16 sm:-mr-20 sm:-mt-20" />
        <div className="relative z-10 flex items-start sm:items-center gap-4 sm:gap-6">
          <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center">
            <Star size={26} className="text-white fill-white sm:hidden" />
            <Star size={32} className="text-white fill-white hidden sm:block" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-black leading-tight">Trung tâm Lắng nghe Bạn!</h2>
            <p className="text-yellow-100 text-xs sm:text-sm mt-1 leading-relaxed">Phản hồi của bạn giúp chúng tôi cải thiện chất lượng giảng dạy. Mọi đánh giá riêng cho Trung tâm đều được bảo mật 100%.</p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex w-full max-w-xl mx-auto bg-slate-100 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-200/50 gap-1">
        <button 
          onClick={() => setActiveTab('admin')}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide sm:tracking-widest transition-all ${
            activeTab === 'admin' ? 'bg-white text-red-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertCircle size={13} className="shrink-0 sm:hidden" />
          <AlertCircle size={14} className="shrink-0 hidden sm:block" />
          <span className="leading-tight text-center">Phản hồi Trung tâm</span>
        </button>
        <button 
          onClick={() => setActiveTab('teacher')}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide sm:tracking-widest transition-all ${
            activeTab === 'teacher' ? 'bg-white text-yellow-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <User size={13} className="shrink-0 sm:hidden" />
          <User size={14} className="shrink-0 hidden sm:block" />
          <span className="leading-tight text-center">Đánh giá GV</span>
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'admin' ? (
          /* ═══ TAB: ADMIN FEEDBACK ═══ */
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <BookOpen size={20} className="text-blue-500" /> Phản hồi về khóa học (Bảo mật)
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {studentData.courses?.length > 0 ? studentData.courses.map(c => {
                const existingEval = privateEvaluations?.find(ev => 
                  String(ev.studentId) === String(STUDENT_ID) && 
                  ev.courseName === c.name && 
                  ev.milestone === 'manual_feedback'
                );
                const isEvaluating = evaluatingCourseId === c.id;

                return (
                  <div key={c.id} className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                     <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
                       <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                         <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-blue-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-blue-600 font-black text-base sm:text-lg">
                           {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                         </div>
                         <div className="flex flex-col min-w-0">
                           <div className="flex flex-wrap items-center gap-2">
                             <h4 className="font-bold text-slate-800 truncate">{c.name}</h4>
                             {existingEval && (
                               <span className="bg-green-100 text-green-700 text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest uppercase flex items-center gap-1 shrink-0">
                                 <CheckCircle size={8} /> Đã gửi
                               </span>
                             )}
                           </div>
                           <p className="text-xs text-slate-400 font-medium truncate">GV: {c.teacherName || 'Chưa phân công'}</p>
                         </div>
                       </div>
                       <button 
                         onClick={() => {
                           setEvaluatingCourseId(isEvaluating ? null : c.id);
                           if (existingEval) {
                             setPrivateForm({ 
                               satisfied: existingEval.criteria?.satisfied || 'yes', 
                               lessonClear: existingEval.criteria?.lessonClear || 'yes', 
                               comment: existingEval.content || existingEval.comment || '' 
                             });
                           } else {
                             setPrivateForm({ satisfied: 'yes', lessonClear: 'yes', comment: '' });
                           }
                         }}
                         className={`w-full sm:w-auto shrink-0 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                           isEvaluating ? 'bg-slate-100 text-slate-500' : 
                           existingEval ? 'bg-green-50 text-green-600 hover:bg-green-100 shadow-sm' : 
                           'bg-red-50 text-red-600 hover:bg-red-100 shadow-sm'
                         }`}>
                         {isEvaluating ? 'Đóng form' : existingEval ? 'Sửa Phản hồi' : 'Gửi Phản hồi'}
                       </button>
                     </div>

                     {isEvaluating && (
                       <div className="px-4 pb-4 animate-in slide-in-from-top-4 duration-300">
                          <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-4">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="space-y-3">
                                 <p className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Mức độ hài lòng với trung tâm?</p>
                                 <div className="flex gap-2">
                                   {[
                                     { label: 'RẤT HÀI LÒNG', val: 'yes' },
                                     { label: 'BÌNH THƯỜNG', val: 'no' }
                                   ].map(v => (
                                     <button 
                                       key={v.val} 
                                       onClick={() => setPrivateForm(prev => ({ ...prev, satisfied: v.val }))}
                                       className={`flex-1 py-2 border-2 rounded-xl text-xs cms-min-text-xs font-black transition-all uppercase ${
                                         privateForm.satisfied === v.val ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-red-200'
                                       }`}
                                     >
                                       {v.label}
                                     </button>
                                   ))}
                                 </div>
                               </div>
                               <div className="space-y-3">
                                 <p className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Giảng viên dạy dễ hiểu không?</p>
                                 <div className="flex gap-2">
                                   {[
                                     { label: 'DỄ HIỂU', val: 'yes' },
                                     { label: 'HƠI KHÓ HIỂU', val: 'no' }
                                   ].map(v => (
                                     <button 
                                       key={v.val} 
                                       onClick={() => setPrivateForm(prev => ({ ...prev, lessonClear: v.val }))}
                                       className={`flex-1 py-2 border-2 rounded-xl text-xs cms-min-text-xs font-black transition-all uppercase ${
                                         privateForm.lessonClear === v.val ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-red-200'
                                       }`}
                                     >
                                       {v.label}
                                     </button>
                                   ))}
                                 </div>
                               </div>
                             </div>

                             <div className="space-y-2">
                               <p className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Góp ý riêng cho Trung tâm điều chỉnh (Bảo mật):</p>
                               <textarea 
                                 value={privateForm.comment}
                                 onChange={e => setPrivateForm(prev => ({ ...prev, comment: e.target.value }))}
                                 placeholder="Nhập điều bạn chưa hài lòng hoặc muốn trung tâm cải thiện..."
                                 className="w-full bg-white border border-slate-100 rounded-xl p-3 text-xs font-medium outline-none focus:border-red-500 transition-all h-[60px] shadow-inner resize-none"
                               />
                             </div>

                             <button 
                               onClick={() => {
                                 submitPrivateEvaluation({
                                   studentId: STUDENT_ID,
                                   teacherId: c.teacherId || studentData.teacherId,
                                   milestone: 'manual_feedback',
                                   courseName: c.name,
                                   comment: privateForm.comment || 'Sinh viên phản hồi qua tab Admin',
                                   criteria: { satisfied: privateForm.satisfied, lessonClear: privateForm.lessonClear }
                                 });
                                 setEvaluatingCourseId(null);
                                 showModal({ 
                                     title: 'Hệ thống ghi nhận', 
                                     content: 'Admin đã nhận được phản hồi. Cảm ơn bạn đã góp ý giúp trung tâm tốt hơn!', 
                                     type: 'success' 
                                 });
                               }}
                               className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 py-2.5 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100"
                             >
                               <Star size={14} className="fill-white" /> {existingEval ? 'CẬP NHẬT PHẢN HỒI' : 'GỬI PHẢN HỒI CHO TRUNG TÂM'}
                             </button>
                             <p className="text-xs cms-min-text-xs text-center text-slate-400 italic">Mọi thông tin bạn gửi ở đây Giảng viên sẽ KHÔNG biết.</p>
                          </div>
                       </div>
                     )}
                  </div>
                );
              }) : (
                <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-slate-100">
                  <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold">Chưa có khóa học nào để phản hồi.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ═══ TAB: TEACHER RATING ═══ */
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center justify-center gap-2 px-1">
              <Star size={20} className="text-yellow-500 fill-yellow-500 sm:hidden" />
              <Star size={24} className="text-yellow-500 fill-yellow-500 hidden sm:block" />
              Đánh giá Giảng viên (Công khai)
            </h3>

            {(() => {
              const courseTeachers = [];
              const seen = new Set();
              (studentData.courses || []).forEach((c) => {
                const tid = String(c.teacherId || '');
                const tname = String(c.teacherName || '').trim();
                if (!tid || !tname) return;
                if (seen.has(tid)) return;
                seen.add(tid);
                courseTeachers.push({ id: tid, name: tname, courseName: c.courseName || c.name });
              });
              if (!courseTeachers.length && studentData.teacherId && studentData.teacher && studentData.teacher !== 'Chưa phân công') {
                courseTeachers.push({
                  id: String(studentData.teacherId),
                  name: String(studentData.teacher).replace(/^Thầy\s+/i, ''),
                  courseName: studentData.course,
                });
              }

              if (!courseTeachers.length) {
                return (
                  <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-slate-100">
                    <User size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-400 font-bold text-sm">Chưa có giảng viên được phân công để đánh giá.</p>
                  </div>
                );
              }

              const activeTeacher = courseTeachers.find((t) => String(t.id) === String(selectedRateTeacherId))
                || courseTeachers[0];
              const teacherLabel = activeTeacher.name.startsWith('Thầy ') || activeTeacher.name.startsWith('Cô ')
                ? activeTeacher.name
                : `Thầy ${activeTeacher.name}`;
              const teacherInitial = (activeTeacher.name.split(/\s+/).filter(Boolean).pop()?.[0] || 'G').toUpperCase();
              const existingRating = teacherRatingData.ratings.find(r => String(r.studentId) === String(STUDENT_ID));
              const hasRated = existingRating || ratingSubmitted;
              const isEditing = isEditingRating;
              const showForm = !hasRated || isEditing;

              return (
                <div className="bg-white rounded-2xl sm:rounded-[32px] p-4 sm:p-6 md:p-8 border border-slate-100 shadow-xl space-y-5 sm:space-y-6">
                  {courseTeachers.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {courseTeachers.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedRateTeacherId(t.id);
                            setRatingSubmitted(false);
                            setIsEditingRating(false);
                            if (typeof getTeacherRating === 'function') {
                              // parent often loads by teacherId via effect; trigger refetch if api present
                            }
                            if (api?.evaluations?.getByTeacher) {
                              api.evaluations.getByTeacher(t.id).then((res) => {
                                if (res.success && res.data) {
                                  const validRatings = res.data.filter((r) => r.criteria && r.criteria.stars);
                                  const count = validRatings.length;
                                  const avg = count > 0
                                    ? (Math.round((validRatings.reduce((s, r) => s + r.criteria.stars, 0) / count) * 10) / 10)
                                    : 0;
                                  setTeacherRatingData({ avg, count, ratings: res.data });
                                }
                              }).catch(() => {});
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all ${
                            String(activeTeacher.id) === String(t.id)
                              ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Teacher header */}
                  <div className="flex items-center gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-slate-100">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-gradient-to-br from-yellow-100 to-orange-50 rounded-2xl flex items-center justify-center text-yellow-600 font-black text-xl sm:text-2xl shadow-inner border border-yellow-200/50">
                      {teacherInitial}
                    </div>
                    <div className="min-w-0 text-left">
                      <h4 className="text-base sm:text-lg font-black text-slate-800 truncate">{teacherLabel}</h4>
                      <p className="text-[10px] sm:text-xs text-slate-400 font-black uppercase tracking-[0.15em] mt-0.5">
                        Giảng viên · {activeTeacher.courseName || 'Khóa học'}
                      </p>
                    </div>
                  </div>

                  {hasRated && !isEditing ? (
                    <div className="bg-yellow-50/50 rounded-2xl sm:rounded-[32px] p-6 sm:p-8 border border-yellow-100 space-y-5 text-center">
                       <div className="flex flex-col items-center gap-2">
                          <span className="text-4xl sm:text-5xl font-black text-yellow-600 tracking-tighter">{existingRating?.criteria?.stars || 5}</span>
                          <div className="flex gap-1.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={20} className={`sm:hidden ${i < Math.round(existingRating?.criteria?.stars || 5) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                            ))}
                            {[...Array(5)].map((_, i) => (
                              <Star key={`lg-${i}`} size={24} className={`hidden sm:block ${i < Math.round(existingRating?.criteria?.stars || 5) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                            ))}
                          </div>
                          <p className="text-xs font-black text-yellow-700/50 uppercase tracking-widest mt-1">Điểm bạn đã đánh giá</p>
                       </div>
                       {(existingRating?.comment || existingRating?.content) && (
                         <div className="relative pt-2 italic px-2">
                           <p className="text-sm text-slate-600 leading-relaxed">"{existingRating.comment || existingRating.content}"</p>
                         </div>
                       )}
                       <button onClick={() => setIsEditingRating(true)} className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black text-slate-400 hover:text-slate-600 hover:border-yellow-200 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-all">
                         <Settings size={14} /> Cập nhật lại đánh giá
                       </button>
                    </div>
                  ) : showForm ? (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {RATING_CRITERIA && Object.entries(RATING_CRITERIA).map(([catKey, cat]) => (
                          <div key={catKey} className="bg-slate-50/80 p-3 sm:p-3.5 rounded-xl sm:rounded-[20px] border border-slate-100/80 flex flex-col gap-2">
                            <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest text-center leading-tight">{cat.label}</p>
                            <div className={`grid gap-1.5 ${cat.options.length === 2 ? 'grid-cols-2' : 'grid-cols-1 min-[400px]:grid-cols-3'}`}>
                              {cat.options.map(opt => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => setRatingCriteria(prev => ({ ...prev, [catKey]: opt.key }))}
                                  className={`min-h-[36px] px-2 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all leading-tight ${
                                    ratingCriteria[catKey] === opt.key 
                                      ? 'bg-gradient-to-r from-orange-400 to-yellow-500 text-white shadow-md border-transparent' 
                                      : 'bg-white border border-slate-200 text-slate-500 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest px-1">Lời nhắn cho giảng viên (tùy chọn)</p>
                        <textarea
                          value={ratingComment}
                          onChange={e => setRatingComment(e.target.value)}
                          placeholder="Chia sẻ thêm nếu bạn muốn..."
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-sm font-medium outline-none focus:border-yellow-400 focus:bg-white transition-all min-h-[72px] sm:min-h-[80px] shadow-inner resize-none"
                        />
                      </div>

                      <button 
                        type="button"
                        disabled={Object.keys(RATING_CRITERIA || {}).some(k => !ratingCriteria[k])}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            const scores = Object.entries(ratingCriteria || {}).map(([cat, key]) => {
                              const opt = RATING_CRITERIA[cat]?.options.find(o => o.key === key);
                              return opt ? opt.score : 3;
                            });
                            const newStars = scores.length > 0 ? (Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10) : 5;

                            setTeacherRatingData(prev => {
                              const safeRatings = Array.isArray(prev.ratings) ? prev.ratings : [];
                              const newRatings = [...safeRatings];
                              const idx = newRatings.findIndex(r => String(r.studentId) === String(STUDENT_ID));
                              const fakeData = { studentId: STUDENT_ID, comment: ratingComment, criteria: { ...ratingCriteria, stars: newStars } };
                              if (idx >= 0) newRatings[idx] = fakeData;
                              else newRatings.push(fakeData);
                              return { ...prev, ratings: newRatings };
                            });

                            setRatingSubmitted(true);
                            setIsEditingRating(false);

                            const targetTeacherId = activeTeacher.id;
                            if (targetTeacherId) {
                              await rateTeacher(targetTeacherId, STUDENT_ID, ratingCriteria, ratingComment);
                              api.evaluations.getByTeacher(targetTeacherId).then(res => {
                                if (res.success && res.data) {
                                  const validRatings = res.data.filter(r => r.criteria && r.criteria.stars);
                                  const count = validRatings.length;
                                  const avg = count > 0 ? (Math.round((validRatings.reduce((s, r) => s + r.criteria.stars, 0) / count) * 10) / 10) : 0;
                                  setTeacherRatingData({ avg, count, ratings: res.data });
                                }
                              }).catch(err => console.error('Refetch rating check error:', err));
                            }
                          } catch (err) {
                            console.error('Submit Evaluation Logic Crash:', err);
                          }
                        }}
                        className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wide sm:tracking-[0.2em] transition-all ${
                          Object.keys(RATING_CRITERIA || {}).some(k => !ratingCriteria[k]) 
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-orange-400 to-yellow-500 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]'
                        }`}
                      >
                        {Object.keys(RATING_CRITERIA || {}).some(k => !ratingCriteria[k]) ? 'CHỌN ĐỦ TIÊU CHÍ ĐỂ GỬI' : 'GỬI ĐÁNH GIÁ CÔNG KHAI'}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

// ─── Modal Ghi chú (Đổi lịch học) ───────────────────────────────────────────────

export default EvaluationView;
