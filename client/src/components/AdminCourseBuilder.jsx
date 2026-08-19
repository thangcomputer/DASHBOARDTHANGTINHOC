import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Plus, Edit3, Trash2, Video, ChevronDown, ChevronUp, Save, Layers, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { useToast } from '../utils/toast.jsx';
import { probeYouTubeDurationSeconds, extractYouTubeId } from '../utils/youtubeDuration';

const AdminCourseBuilder = ({ course, onBack, onSave }) => {
  const toast = useToast();

  // Use existing chapters or default mock
  const [chapters, setChapters] = useState(course?.chapters || course?.curriculum || []);

  const [editingChapterId, setEditingChapterId] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const [tempUrl, setTempUrl] = useState('');
  const [tempDuration, setTempDuration] = useState(0);
  const [tempAntiSeek, setTempAntiSeek] = useState(true);
  const [tempAllowEarlyAccess, setTempAllowEarlyAccess] = useState(false);
  const [probingDuration, setProbingDuration] = useState(false);
  const probeSeqRef = useRef(0);

  // Auto-lấy thời lượng thật từ YouTube khi nhập/sửa URL
  useEffect(() => {
    if (!editingLessonId) return undefined;
    const ytId = extractYouTubeId(tempUrl);
    if (!ytId) return undefined;

    const seq = ++probeSeqRef.current;
    const timer = setTimeout(async () => {
      setProbingDuration(true);
      try {
        const secs = await probeYouTubeDurationSeconds(ytId);
        if (probeSeqRef.current !== seq) return;
        if (secs > 0) {
          setTempDuration(secs);
        }
      } finally {
        if (probeSeqRef.current === seq) setProbingDuration(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [tempUrl, editingLessonId]);

  // --- CHAPTER ACTIONS ---
  const addChapter = () => {
    const newChapter = {
      id: Date.now(),
      title: 'Chương mới',
      isOpen: true,
      lessons: []
    };
    setChapters([...chapters, newChapter]);
  };

  const updateChapterTitle = (id, newTitle) => {
    setChapters(chapters.map(c => c.id === id ? { ...c, title: newTitle } : c));
    setEditingChapterId(null);
  };

  const deleteChapter = async (id) => {
    if (await window.cmsConfirm('Bạn có chắc chắn muốn xóa chương này (bao gồm tất cả bài học bên trong)?')) {
      setChapters(chapters.filter(c => c.id !== id));
    }
  };

  const moveChapter = (index, direction) => {
    const newChapters = [...chapters];
    if (direction === 'up' && index > 0) {
      [newChapters[index - 1], newChapters[index]] = [newChapters[index], newChapters[index - 1]];
    } else if (direction === 'down' && index < newChapters.length - 1) {
      [newChapters[index + 1], newChapters[index]] = [newChapters[index], newChapters[index + 1]];
    }
    setChapters(newChapters);
  };

  // --- LESSON ACTIONS ---
  const addLesson = (chapterId) => {
    const newLesson = {
      id: Date.now(),
      title: 'Bài học mới',
      type: 'video',
      duration: 0,
      videoUrl: '',
      antiSeek: true,
      allowEarlyAccess: false,
    };
    setChapters(chapters.map(c => {
      if (c.id === chapterId) {
        return { ...c, isOpen: true, lessons: [...c.lessons, newLesson] };
      }
      return c;
    }));
  };

  const updateLesson = (chapterId, lessonId, updates) => {
    setChapters(chapters.map(c => {
      if (c.id === chapterId) {
        return { ...c, lessons: c.lessons.map(l => l.id === lessonId ? { ...l, ...updates } : l) };
      }
      return c;
    }));
    setEditingLessonId(null);
  };

  const deleteLesson = async (chapterId, lessonId) => {
    if (await window.cmsConfirm('Bạn có chắc chắn muốn xóa bài học này?')) {
      setChapters(chapters.map(c => {
        if (c.id === chapterId) {
          return { ...c, lessons: c.lessons.filter(l => l.id !== lessonId) };
        }
        return c;
      }));
    }
  };

  const moveLesson = (chapterId, lessonIndex, direction) => {
    setChapters(chapters.map(c => {
      if (c.id === chapterId) {
        const newLessons = [...c.lessons];
        if (direction === 'up' && lessonIndex > 0) {
          [newLessons[lessonIndex - 1], newLessons[lessonIndex]] = [newLessons[lessonIndex], newLessons[lessonIndex - 1]];
        } else if (direction === 'down' && lessonIndex < newLessons.length - 1) {
          [newLessons[lessonIndex + 1], newLessons[lessonIndex]] = [newLessons[lessonIndex], newLessons[lessonIndex + 1]];
        }
        return { ...c, lessons: newLessons };
      }
      return c;
    }));
  };

  // --- SAVE ---
  const handleSave = () => {
    if (onSave) {
      const allLessons = chapters.flatMap(c => c.lessons.map(l => ({ ...l, chapterTitle: c.title })));
      onSave({
        ...course,
        chapters,
        videos: allLessons,
        lessons: allLessons
      });
      toast.success('Đã lưu giáo trình thành công!');
    }
  };

  const ui = (
    <div className="fixed inset-0 z-[500] flex flex-col overflow-hidden bg-slate-50 animate-in fade-in duration-200">
      {/* HEADER */}
      <header className="shrink-0 bg-white border-b border-slate-200 shadow-sm pt-[env(safe-area-inset-top,0px)]">
        <div className="px-3 sm:px-6 py-3 flex flex-col gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 sm:min-w-0 sm:px-3 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-red-700 font-semibold text-sm shrink-0 transition"
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">Quay lại</span>
            </button>

            <div className="min-w-0 flex-1 text-center sm:text-left px-1">
              <h1 className="font-bold text-slate-800 text-[15px] sm:text-lg leading-snug truncate">
                <span className="hidden sm:inline">Thiết kế Giáo trình: </span>
                <span className="sm:hidden">Giáo trình: </span>
                {course?.title || 'Khóa học mới'}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate hidden sm:block">
                Sắp xếp lại bài giảng (Curriculum Builder)
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 sm:min-w-0 sm:px-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition"
                title="Cài đặt khóa học"
              >
                <Edit3 size={16} />
                <span className="hidden md:inline">Cài đặt</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-600 text-white text-sm font-bold shadow-md hover:shadow-lg transition"
              >
                <Save size={16} />
                <span className="hidden sm:inline">Lưu giáo trình</span>
                <span className="sm:hidden">Lưu</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-6 md:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 min-w-0">
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-violet-500 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 min-w-0">
              <Layers className="text-violet-500 shrink-0" size={20} />
              <span className="truncate">Chương trình đào tạo</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Sắp xếp nội dung giáo trình, thêm bài giảng và chia phần rõ ràng.
            </p>
          </div>

          {chapters.map((chapter, cIdx) => (
            <div key={chapter.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-w-0">
              {/* Chapter Header */}
              <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-5 py-3 sm:py-4 flex items-start sm:items-center justify-between gap-2 min-w-0">
                <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="flex flex-col gap-0.5 opacity-60 shrink-0 pt-0.5">
                    <button type="button" onClick={() => moveChapter(cIdx, 'up')} disabled={cIdx === 0} className="p-1 hover:text-red-600 disabled:opacity-20" aria-label="Lên"><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => moveChapter(cIdx, 'down')} disabled={cIdx === chapters.length - 1} className="p-1 hover:text-red-600 disabled:opacity-20" aria-label="Xuống"><ArrowDown size={14} /></button>
                  </div>

                  {editingChapterId === chapter.id ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full min-w-0">
                      <input
                        autoFocus
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        className="w-full min-w-0 border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:border-violet-400"
                      />
                      <div className="flex gap-2 shrink-0">
                        <button type="button" onClick={() => updateChapterTitle(chapter.id, tempTitle)} className="flex-1 sm:flex-none text-xs bg-red-600 text-white px-3 py-2 rounded-xl font-bold">Lưu</button>
                        <button type="button" onClick={() => setEditingChapterId(null)} className="flex-1 sm:flex-none text-xs text-slate-500 hover:bg-slate-200 px-3 py-2 rounded-xl font-bold">Hủy</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base min-w-0 truncate">
                        Phần {cIdx + 1}: {chapter.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => { setEditingChapterId(chapter.id); setTempTitle(chapter.title); }}
                        className="shrink-0 inline-flex items-center justify-center min-w-9 min-h-9 text-slate-400 hover:text-red-600 rounded-lg"
                        aria-label="Sửa chương"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChapter(chapter.id)}
                        className="shrink-0 inline-flex items-center justify-center min-w-9 min-h-9 text-slate-400 hover:text-red-600 rounded-lg"
                        aria-label="Xóa chương"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] sm:text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200 whitespace-nowrap">
                    {chapter.lessons.length} bài
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newC = [...chapters];
                      newC[cIdx].isOpen = !newC[cIdx].isOpen;
                      setChapters(newC);
                    }}
                    className="inline-flex items-center justify-center min-w-10 min-h-10 text-slate-500 hover:text-slate-800 rounded-xl"
                    aria-label={chapter.isOpen ? 'Thu gọn' : 'Mở rộng'}
                  >
                    {chapter.isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>
              </div>

              {/* Lesson List */}
              {chapter.isOpen && (
                <div className="p-3 sm:p-4 space-y-2 bg-slate-50/40 min-w-0">
                  {chapter.lessons.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm font-semibold border-2 border-dashed border-slate-200 rounded-xl bg-white">
                      Chưa có nội dung nào trong chương này
                    </div>
                  ) : (
                    chapter.lessons.map((lesson, lIdx) => (
                      <div key={lesson.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm min-w-0 overflow-hidden">
                        {editingLessonId === lesson.id ? (
                          <div className="space-y-3 min-w-0">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Tên bài học</label>
                              <input
                                value={tempTitle}
                                onChange={(e) => setTempTitle(e.target.value)}
                                className="w-full min-w-0 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-violet-400 text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_7.5rem] gap-3 min-w-0">
                              <div className="min-w-0">
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">URL / YouTube ID</label>
                                <input
                                  value={tempUrl}
                                  onChange={(e) => setTempUrl(e.target.value)}
                                  className="w-full min-w-0 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-violet-400 text-sm"
                                  placeholder="VD: dQw4w9WgXcQ"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                                  Thời lượng (s){probingDuration ? ' · đang lấy từ YT…' : ''}
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={tempDuration}
                                    onChange={(e) => setTempDuration(e.target.value)}
                                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:border-violet-400 text-sm pr-9"
                                  />
                                  {probingDuration ? (
                                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-violet-500" />
                                  ) : null}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                  Tự lấy từ YouTube khi dán link. Nên khớp độ dài thật để % hoàn thành đúng.
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-3 pt-1">
                              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`antiSeek_${lesson.id}`}
                                    checked={tempAntiSeek}
                                    onChange={(e) => setTempAntiSeek(e.target.checked)}
                                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                                  />
                                  <label htmlFor={`antiSeek_${lesson.id}`} className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                                    Chống tua (antiSeek)
                                  </label>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed pl-6">
                                  {tempAntiSeek
                                    ? 'Bật: học viên không thể tua vượt quá phần đã xem.'
                                    : 'Tắt: học viên có thể tua tự do trong bài, nhưng vẫn phải đạt 2/3 thời lượng để hoàn thành.'}
                                </p>
                              </div>
                              <div className="rounded-xl border border-red-100 bg-red-50/60 p-3 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`earlyAccess_${lesson.id}`}
                                    checked={tempAllowEarlyAccess}
                                    onChange={(e) => setTempAllowEarlyAccess(e.target.checked)}
                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                                  />
                                  <label htmlFor={`earlyAccess_${lesson.id}`} className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                                    Cho phép mở bài sớm (allowEarlyAccess)
                                  </label>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed pl-6">
                                  {tempAllowEarlyAccess
                                    ? 'Bật: học viên có thể mở bài này trước khi hoàn thành bài trước.'
                                    : 'Tắt: học viên phải hoàn thành bài trước mới được mở bài này.'}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                              <button type="button" onClick={() => setEditingLessonId(null)} className="min-h-11 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition">Hủy</button>
                              <button
                                type="button"
                                onClick={() => updateLesson(chapter.id, lesson.id, {
                                  title: tempTitle,
                                  videoUrl: tempUrl,
                                  url: tempUrl,
                                  duration: parseInt(tempDuration, 10) || 0,
                                  antiSeek: tempAntiSeek,
                                  allowEarlyAccess: tempAllowEarlyAccess,
                                })}
                                className="min-h-11 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition"
                              >
                                Lưu bài học
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                            <div className="flex flex-col gap-0.5 opacity-60 shrink-0 pt-1">
                              <button type="button" onClick={() => moveLesson(chapter.id, lIdx, 'up')} disabled={lIdx === 0} className="p-1 hover:text-red-600 disabled:opacity-20" aria-label="Lên"><ArrowUp size={12} /></button>
                              <button type="button" onClick={() => moveLesson(chapter.id, lIdx, 'down')} disabled={lIdx === chapter.lessons.length - 1} className="p-1 hover:text-red-600 disabled:opacity-20" aria-label="Xuống"><ArrowDown size={12} /></button>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                              <Video size={14} />
                            </div>
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p className="text-sm font-bold text-slate-700 break-words leading-snug">
                                Bài {lIdx + 1}: {lesson.title}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-1 break-all leading-relaxed flex flex-wrap items-center gap-1.5">
                                <span>{lesson.videoUrl || lesson.url || 'Chưa thiết lập URL'}</span>
                                <span className="text-slate-300"> · </span>
                                <span>{Number(lesson.duration) > 0 ? `${lesson.duration}s` : 'Chưa có thời lượng'}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  lesson.antiSeek !== false ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {lesson.antiSeek !== false ? 'Chống tua: BẬT' : 'Tua tự do'}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  lesson.allowEarlyAccess === true ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
                                }`}>
                                  {lesson.allowEarlyAccess === true ? 'Mở sớm: BẬT' : 'Mở sớm: TẮT'}
                                </span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLessonId(lesson.id);
                                  setTempTitle(lesson.title);
                                  setTempUrl(lesson.videoUrl || lesson.url || '');
                                  setTempDuration(lesson.duration || 0);
                                  setTempAntiSeek(lesson.antiSeek !== false);
                                  setTempAllowEarlyAccess(lesson.allowEarlyAccess === true);
                                }}
                                className="inline-flex items-center justify-center min-w-10 min-h-10 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl"
                                aria-label="Sửa bài học"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteLesson(chapter.id, lesson.id)}
                                className="inline-flex items-center justify-center min-w-10 min-h-10 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl"
                                aria-label="Xóa bài học"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => addLesson(chapter.id)}
                      className="min-h-11 text-sm font-bold text-red-600 hover:text-red-700 inline-flex items-center gap-1.5 px-2 py-2 transition"
                    >
                      <Plus size={16} /> Thêm bài giảng mới
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addChapter}
            className="w-full min-h-12 py-3.5 border-2 border-dashed border-red-200 text-red-600 font-bold rounded-2xl hover:bg-red-50 hover:border-red-300 transition inline-flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Plus size={18} /> Thêm Phần/Chương mới
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(ui, document.body);
  }
  return ui;
};

export default AdminCourseBuilder;
