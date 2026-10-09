import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, GraduationCap, Layers3, Loader2, Lock, PackageOpen, X } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';
import LessonVideoTabs from '../LessonVideoTabs';

function CourseCatalogCard({ course, onSelect, selected = false }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-haspopup="dialog"
      aria-expanded={selected}
      className={`group flex h-[320px] w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${selected ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'}`}
    >
      <span className="relative flex h-28 w-full shrink-0 items-start justify-between overflow-hidden bg-gradient-to-br from-rose-700 via-red-700 to-red-900 p-4">
        {course.thumbnail ? (
          <>
            <img src={resolveMediaUrl(course.thumbnail)} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
            <span className="absolute inset-0 bg-gradient-to-r from-slate-950/45 to-transparent" />
          </>
        ) : (
          <span className="absolute -right-5 -top-10 h-36 w-36 rounded-full border-[18px] border-white/10" />
        )}
        <span className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 backdrop-blur-sm ${
          course.enrolled
            ? 'bg-white/15 text-white ring-white/30'
            : 'bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 text-amber-950 shadow-[0_0_18px_rgba(251,191,36,0.55)] ring-amber-100/90'
        }`}>
          {course.enrolled ? <BookOpen size={19} /> : <Lock size={18} strokeWidth={2.5} />}
        </span>
        <span className="relative rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black text-slate-800 shadow-sm">
          {course.offerType === 'single' ? 'Khóa lẻ' : 'Trọn gói'}
        </span>
      </span>
      <span className="flex min-h-0 flex-1 flex-col p-4">
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 min-h-10 text-base font-black leading-5 text-slate-900">{course.name}</span>
          {course.enrolled ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">Đã đăng ký</span>
          ) : (
            <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-700">
              {Number(course.price || 0).toLocaleString('vi-VN')}đ
            </span>
          )}
        </span>
        <span className="mt-3 grid h-12 shrink-0 grid-cols-2 grid-rows-2 content-start gap-1.5 overflow-hidden" aria-label="Các môn trong khóa học">
          {Array.isArray(course.subjects) && course.subjects.slice(0, 4).map((subject, index) => (
            <span
              key={`${subject.id || subject.name}-${index}`}
              title={subject.name}
              className="block min-w-0 truncate rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold leading-4 text-slate-600"
            >
              {subject.name}
            </span>
          ))}
          {course.subjects?.length > 4 && (
            <span className="block min-w-0 truncate rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold leading-4 text-slate-500">
              +{course.subjects.length - 4} môn
            </span>
          )}
        </span>
        <span className="mt-2 text-xs text-slate-500">
          {course.totalSessions > 0 ? `${course.totalSessions} buổi học` : `${course.subjects?.length || 0} môn học`}
          {!course.enrolled && course.originalPrice && (
            <span className="ml-2 text-slate-400 line-through">{Number(course.originalPrice).toLocaleString('vi-VN')}đ</span>
          )}
        </span>
        <span className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
          <span className={`text-xs font-bold ${course.enrolled ? 'text-emerald-700' : 'text-slate-500'}`}>
            {selected ? 'Đang xem nội dung' : 'Xem thêm'}
          </span>
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${course.enrolled ? 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-rose-50 text-rose-700 group-hover:bg-rose-600 group-hover:text-white'}`}>
            <ArrowRight size={16} />
          </span>
        </span>
      </span>
    </button>
  );
}

function CourseSubjectsModal({
  course, subjects, progressById, onOpenSubject, onClose,
}) {
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!course) return null;
  const subjectCount = subjects.length;
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-subjects-title"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white p-5 sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Nội dung khóa học</p>
          <h2 id="course-subjects-title" className="mt-1 text-lg font-black text-slate-900 sm:text-xl">{course.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {course.offerType === 'single'
              ? `Khóa lẻ · ${subjectCount} môn`
              : `Trọn gói · ${subjectCount} môn`}
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Đóng cửa sổ nội dung khóa học"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>
      <div className="overflow-y-auto p-5 sm:p-6">
        {subjects.length === 0
          ? <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">Khóa học chưa được gắn môn.</p>
          : (
            <div className="grid grid-cols-1 justify-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject, index) => {
              const progress = progressById.get(subject.id);
              const done = progress?.completedUnitCount || 0;
              const total = progress?.totalUnitCount || 0;
              const canOpen = subject.id && (subject.opened || !course.enrolled);
              const cardClassName = `flex min-h-44 w-full flex-col justify-between rounded-xl border p-3.5 text-left transition-colors ${
                canOpen
                  ? 'border-emerald-100 bg-emerald-50/60 hover:border-emerald-300'
                  : 'border-slate-100 bg-slate-50 text-slate-500'
              }`;
              const content = (
                <>
                  <span>
                    <span className="block line-clamp-2 text-sm font-bold text-slate-800">{subject.name}</span>
                    {canOpen && subject.opened
                      ? <span className="mt-2 block text-xs font-medium text-slate-500">{done}/{total} buổi đã xong</span>
                      : canOpen
                        ? <span className="mt-2 block text-xs font-medium text-amber-600">Xem thử buổi được mở</span>
                      : <span className="mt-2 block text-xs font-medium text-slate-400">Chưa đăng ký</span>}
                  </span>
                  {canOpen && (
                    <span className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black text-white ${subject.opened ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                      {subject.opened ? 'Vào học' : 'Xem thử'} <ArrowRight size={14} />
                    </span>
                  )}
                </>
              );
              return canOpen ? (
                <button
                  key={`${course.id}-${subject.id || subject.name}-${index}`}
                  type="button"
                  onClick={() => onOpenSubject(subject.id, course.id)}
                  className={`${cardClassName} hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
                >
                  {content}
                </button>
              ) : (
                <div
                  key={`${course.id}-${subject.id || subject.name}-${index}`}
                  aria-disabled="true"
                  className={cardClassName}
                >
                  {content}
                </div>
              );
            })}
            </div>
          )}
      </div>
      </section>
    </div>
  );
}

function CourseCollection({
  title, courses, selectedCourseId, onSelectCourse, progressById, onOpenSubject,
}) {
  if (!courses.length) return null;
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">
        {title} · {courses.length}
      </h2>
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {courses.map((course) => (
          <CourseCatalogCard
            key={course.id}
            course={course}
            selected={selectedCourseId === course.id}
            onSelect={() => onSelectCourse((current) => current === course.id ? '' : course.id)}
          />
        ))}
      </div>
      {selectedCourse && (
        <CourseSubjectsModal
          course={selectedCourse}
          subjects={selectedCourse.subjects || []}
          progressById={progressById}
          onOpenSubject={onOpenSubject}
          onClose={() => onSelectCourse('')}
        />
      )}
    </section>
  );
}

function RegisteredSubjects({ subjects, onOpenSubject }) {
  if (!subjects.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
        <BookOpen className="mx-auto mb-3 text-slate-300" size={28} />
        <p className="font-bold text-slate-700">Chưa có môn học nào đã đăng ký</p>
        <p className="mt-1 text-sm text-slate-500">Các môn trong khóa học bạn đã đăng ký sẽ xuất hiện ở đây.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {subjects.map((subject) => {
        const done = subject.completedUnitCount || 0;
        const total = subject.totalUnitCount || 0;
        const progress = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
        return (
          <button
            key={subject.id}
            type="button"
            onClick={() => onOpenSubject(subject.id)}
            className="group flex h-[320px] flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <BookOpen size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-black text-slate-900">{subject.name}</span>
                <span className="mt-1 block text-xs font-semibold text-emerald-700">Đã đăng ký · {done}/{total} buổi</span>
              </span>
            </span>
            <span className="mt-4 block h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </span>
            <span className="mt-2 block text-xs text-slate-500">{progress}% hoàn thành</span>
            <span className="mt-auto inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition-colors group-hover:bg-emerald-700">
              Vào học <ArrowRight size={16} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function LessonPracticeCatalogPage() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    lessonPracticeApi.student.subjects()
      .then((res) => {
        if (!alive) return;
        setSubjects(res.data?.subjects || []);
        setCourses(res.data?.courses || []);
      })
      .catch((err) => { if (alive) setError(err.message || 'Không tải được danh sách môn'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selectCourse = (update) => {
    setSelectedCourseId((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      return next;
    });
  };

  const enrolledCourses = courses.filter((course) => course.enrolled);
  const availableCourses = courses.filter((course) => !course.enrolled);
  const visibleEnrolledCourses = filter === 'all'
    ? enrolledCourses
    : enrolledCourses.filter((course) => filter === 'single' ? course.offerType === 'single' : course.offerType !== 'single');
  const visibleAvailableCourses = filter === 'all'
    ? availableCourses
    : availableCourses.filter((course) => filter === 'single' ? course.offerType === 'single' : course.offerType !== 'single');
  const openedSubjects = subjects.filter((subject) => subject.opened !== false);
  const progressById = new Map(subjects.map((subject) => [subject.id, subject]));
  const filters = [
    { id: 'all', label: 'Tất cả', icon: Layers3, count: courses.length },
    { id: 'bundle', label: 'Khóa trọn gói', icon: PackageOpen, count: courses.filter((course) => course.offerType !== 'single').length },
    { id: 'single', label: 'Khóa lẻ', icon: BookOpen, count: courses.filter((course) => course.offerType === 'single').length },
    { id: 'subjects', label: 'Môn đã đăng ký', icon: GraduationCap, count: openedSubjects.length },
  ];

  return (
    <div className="w-full min-h-full bg-slate-50/60 px-1 pb-8 pt-4 sm:px-2">
      <div className="w-full">
        <LessonVideoTabs active="lesson" />
        {loading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Đang tải môn học...</div>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && courses.length === 0 && (
          <p className="text-sm text-slate-500">Chưa có khóa học được mở.</p>
        )}
        {!loading && (
          <>
            <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {filters.map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => { setFilter(id); setSelectedCourseId(''); }}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition sm:px-4 ${
                    filter === id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${filter === id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                </button>
              ))}
            </div>
            {filter === 'subjects' ? (
              <section className="space-y-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Môn đã đăng ký</h2>
                  <p className="mt-1 text-sm text-slate-500">Mở thẳng môn học bạn đã có quyền truy cập.</p>
                </div>
                <RegisteredSubjects
                  subjects={openedSubjects}
                  onOpenSubject={(id) => navigate(`/student/lesson-practice/subjects/${id}`)}
                />
              </section>
            ) : (
              <>
                <CourseCollection
                  title={filter === 'all' ? 'Khóa đã đăng ký' : filter === 'single' ? 'Khóa lẻ đã đăng ký' : 'Khóa trọn gói đã đăng ký'}
                  courses={visibleEnrolledCourses}
                  selectedCourseId={selectedCourseId}
                  onSelectCourse={selectCourse}
                  progressById={progressById}
                  onOpenSubject={(id, courseId) => navigate(`/student/lesson-practice/subjects/${id}?courseId=${encodeURIComponent(courseId)}`)}
                />
                <CourseCollection
                  title={filter === 'all' ? 'Khóa chưa đăng ký' : filter === 'single' ? 'Khóa lẻ chưa đăng ký' : 'Khóa trọn gói chưa đăng ký'}
                  courses={visibleAvailableCourses}
                  selectedCourseId={selectedCourseId}
                  onSelectCourse={selectCourse}
                  progressById={progressById}
                  onOpenSubject={(id, courseId) => navigate(`/student/lesson-practice/subjects/${id}?courseId=${encodeURIComponent(courseId)}`)}
                />
                {!visibleEnrolledCourses.length && !visibleAvailableCourses.length && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
                    Chưa có khóa học nào trong bộ lọc này.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}