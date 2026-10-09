import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clapperboard, Clock3, GraduationCap, Layers3, Loader2, Lock, PackageOpen, ShoppingCart, Sparkles, CircleHelp, X } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';
import { useData } from '../../../context/DataContext';
import { resolveRichHtmlMedia, sanitizeRichHtml } from '../../../utils/htmlContent';
import { DEFAULT_LEARNING_GUIDE_HTML, getLearningGuideVideoEmbedUrl } from '../../../utils/learningGuide';
import LessonVideoTabs from '../LessonVideoTabs';
import VideoCoursePayModal from '../../VideoCoursePayModal';
import CoursePurchaseConfirmModal from './CoursePurchaseConfirmModal';
import { useToast } from '../../../utils/toast';

function formatDiscountTimeLeft(endsAt, now) {
  const secondsLeft = Math.ceil((new Date(endsAt).getTime() - now) / 1000);
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0) return '';
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return days ? `${days} ngày` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatSubjectName(name) {
  return String(name || '')
    .toLocaleLowerCase('vi-VN')
    .replace(/(^|\s)(\S)/gu, (_, space, letter) => `${space}${letter.toLocaleUpperCase('vi-VN')}`);
}

function CourseCatalogCard({ course, onSelect, onRegister, registering = false, selected = false, now }) {
  const startsAt = course.discountStartsAt ? new Date(course.discountStartsAt).getTime() : null;
  const endsAt = course.discountEndsAt ? new Date(course.discountEndsAt).getTime() : null;
  const saleActive = Boolean(course.originalPrice)
    && (startsAt === null || now >= startsAt)
    && (endsAt === null || now < endsAt);
  const displayPrice = course.originalPrice && !saleActive ? course.originalPrice : course.price;
  const countdown = saleActive && endsAt !== null ? formatDiscountTimeLeft(endsAt, now) : '';

  return (
    <article className={`group relative z-0 flex h-[344px] w-full flex-col rounded-2xl border bg-white shadow-[0_4px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:z-40 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(15,23,42,0.12)] ${selected ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-haspopup="dialog"
        aria-expanded={selected}
        className="flex min-h-0 w-full flex-1 flex-col rounded-t-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
      >
        <span
          className={`relative flex h-28 w-full shrink-0 items-start justify-between overflow-hidden rounded-t-2xl p-4 ${
            course.bannerColorStart || course.bannerColorEnd ? '' : 'bg-gradient-to-br from-rose-700 via-red-700 to-red-900'
          }`}
          style={course.bannerColorStart || course.bannerColorEnd ? {
            background: `linear-gradient(135deg, ${course.bannerColorStart || '#be123c'}, ${course.bannerColorEnd || '#7f1d1d'})`,
          } : undefined}
        >
          {course.thumbnail ? (
            <>
              <img src={resolveMediaUrl(course.thumbnail)} alt="" className="absolute inset-0 h-full w-full rounded-t-2xl object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
              <span className="absolute inset-0 rounded-t-2xl bg-gradient-to-r from-slate-950/45 to-transparent" />
            </>
          ) : (
            <span className="absolute -right-5 -top-10 h-36 w-36 rounded-full border-[18px] border-white/10" />
          )}
          {!course.enrolled && (
            <span className="absolute left-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/90 bg-gradient-to-br from-amber-100 to-amber-300 text-amber-800 shadow-md" aria-label="Khóa học cần đăng ký">
              <Lock size={14} strokeWidth={2.5} />
            </span>
          )}
          <span className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <span
              title={course.hasAssignedTeacher ? 'Học cùng giảng viên' : 'Khóa tự học'}
              className="inline-grid w-[min(88%,280px)] grid-cols-[32px_minmax(0,1fr)] items-center gap-2 rounded-full border border-white/80 bg-white/95 py-1.5 pl-1.5 pr-3.5 text-[10px] font-black tracking-[0.08em] text-slate-800 shadow-lg shadow-slate-950/15 ring-4 ring-white/15 backdrop-blur-sm transition"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                course.hasAssignedTeacher ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {course.hasAssignedTeacher
                  ? <GraduationCap size={17} strokeWidth={2.4} />
                  : <Clapperboard size={16} strokeWidth={2.4} />}
              </span>
              <span className="min-w-0 text-center leading-tight">
                {course.hasAssignedTeacher ? 'HỌC CÙNG GIẢNG VIÊN' : 'TỰ HỌC QUA VIDEO'}
              </span>
            </span>
          </span>
          <span className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-700 shadow-sm backdrop-blur-sm">
            {course.offerType === 'single' ? 'Khóa lẻ' : 'Trọn gói'}
          </span>
        </span>
        <span className="flex min-h-0 flex-1 flex-col p-4">
          <span className="group/course-details relative flex min-h-0 flex-1 flex-col">
            <span className="flex min-h-0 min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 min-h-5 text-base font-black leading-5 text-slate-900">{course.name}</span>
              <span className="flex min-h-0 min-w-0 flex-1 items-stretch justify-between gap-3">
                <span className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <span className="mt-1.5 flex h-[54px] flex-wrap content-start items-center gap-1 overflow-hidden" aria-label="Các môn trong khóa học">
                  <span className="inline-flex items-center text-[10px] font-bold leading-none text-slate-500">Môn:</span>
                  {Array.isArray(course.subjects) && course.subjects.slice(0, course.subjects.length > 4 ? 3 : 4).map((subject, index) => (
                    <span
                      key={`${subject.id || subject.name}-${index}`}
                      title={subject.name}
                      className={`inline-flex w-fit max-w-full truncate rounded-md border px-2 py-1 text-[10px] font-semibold leading-4 ${
                        [
                          'border-sky-100 bg-sky-50 text-sky-700',
                          'border-rose-100 bg-rose-50 text-rose-700',
                          'border-violet-100 bg-violet-50 text-violet-700',
                          'border-amber-100 bg-amber-50 text-amber-700',
                        ][index % 4]
                      }`}
                    >
                      {formatSubjectName(subject.name)}
                    </span>
                  ))}
                  {course.subjects?.length > 4 && (
                    <span className="inline-flex w-fit max-w-full truncate rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-bold leading-4 text-slate-500">
                      +{course.subjects.length - 3} môn
                    </span>
                  )}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] font-medium text-slate-500">
                    <Clock3 size={12} className="shrink-0 text-slate-400" />
                    {course.totalSessions > 0
                      ? <><strong className="font-bold text-slate-700">{course.totalSessions}</strong> bài học</>
                      : <><strong className="font-bold text-slate-700">{course.subjects?.length || 0}</strong> môn học</>}
                  </span>
                </span>
                <span className="mt-1.5 flex shrink-0 flex-col items-end gap-2">
                {course.enrolled ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">Đã đăng ký</span>
                ) : (
                  <>
                    {saleActive && (
                      <span className="flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-400">
                        <span>Giá gốc:</span>
                        <span className="text-xs line-through">{Number(course.originalPrice).toLocaleString('vi-VN')}đ</span>
                        {Number(course.discountPercent) > 0 && (
                          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-700">-{course.discountPercent}%</span>
                        )}
                      </span>
                    )}
                    <span className={`whitespace-nowrap rounded-xl border px-3 py-2.5 text-lg font-black leading-none tracking-tight shadow-sm ${
                      saleActive
                        ? 'border-rose-100 bg-gradient-to-br from-rose-50 to-white text-rose-700 shadow-rose-100/70'
                        : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-800'
                    }`}>
                      {Number(displayPrice || 0).toLocaleString('vi-VN')}đ
                    </span>
                    {countdown && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums text-amber-700" aria-label={`Khuyến mãi kết thúc sau ${countdown}`}>
                        <Clock3 size={11} className="shrink-0" />
                        Còn {countdown}
                      </span>
                    )}
                  </>
                )}
              </span>
            </span>
            </span>
            {!course.enrolled && (
              <span
                role="tooltip"
                className="invisible absolute left-1/2 top-1/2 z-50 w-[min(22rem,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 text-left opacity-0 shadow-2xl transition duration-150 group-hover/course-details:visible group-hover/course-details:opacity-100"
              >
                <span className="mb-1 flex items-center gap-1.5 text-xs font-black text-slate-900">
                  <Sparkles size={14} className="text-amber-500" />
                  Khóa tự học là gì?
                </span>
                <ul className="space-y-2 text-[13px] leading-relaxed text-slate-600">
                  <li className="flex gap-2"><span className="font-black text-amber-600">•</span><span>Học theo lộ trình có sẵn, kèm video hướng dẫn.</span></li>
                  <li className="flex gap-2"><span className="font-black text-amber-600">•</span><span>Có bài tập thực hành để củng cố kiến thức.</span></li>
                  <li className="flex gap-2"><span className="font-black text-amber-600">•</span><span>Trắc nghiệm được hệ thống chấm tự động.</span></li>
                  <li className="flex gap-2"><span className="font-black text-amber-600">•</span><span>Bài tự luận được AI đánh giá và phản hồi.</span></li>
                  <li className="flex gap-2"><span className="font-black text-amber-600">•</span><span>Đăng ký một lần, học trọn đời.</span></li>
                </ul>
                <p className="mt-3 border-t border-red-100 pt-2 text-xs font-bold leading-relaxed text-slate-900">
                  <span className="text-red-700">Lưu ý:</span> Khóa học trên <em className="text-red-700">không phải là học 1 kèm 1</em>; không hoàn phí nếu đã đăng ký.
                </p>
              </span>
            )}
          </span>
        </span>
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 pb-3 pt-2">
        {!course.enrolled ? (
          <button
            type="button"
            disabled={registering}
            onClick={() => onRegister(course)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 text-xs font-black text-emerald-700 shadow-sm transition-colors hover:bg-emerald-600 hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            {registering ? <Loader2 className="animate-spin" size={14} /> : <ShoppingCart size={14} />}
            Đăng ký học
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={onSelect}
          aria-haspopup="dialog"
          aria-expanded={selected}
          className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-xs font-black shadow-sm transition-colors ${course.enrolled ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white'}`}
        >
          {course.enrolled ? 'Vào học' : selected ? 'Đang xem nội dung' : 'Xem thêm'}
          <ArrowRight size={16} />
        </button>
      </div>
    </article>
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
  const dialogWidth = subjectCount <= 1
    ? 'max-w-sm'
    : subjectCount === 2
      ? 'max-w-2xl'
      : subjectCount === 3
        ? 'max-w-4xl'
        : 'max-w-6xl';
  const subjectGridColumns = subjectCount <= 1
    ? 'grid-cols-1'
    : subjectCount === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : subjectCount === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';
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
        className={`flex max-h-[90vh] w-full ${dialogWidth} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
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
              <div className={`grid ${subjectGridColumns} justify-start gap-4`}>
                {subjects.map((subject, index) => {
                  const progress = progressById.get(subject.id);
                  const done = progress?.completedUnitCount || 0;
                  const total = progress?.totalUnitCount || 0;
                  const canOpen = subject.id && (subject.opened || !course.enrolled);
                  const cardClassName = `group relative flex min-h-40 w-full flex-col justify-between overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 ${
                    canOpen
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md'
                      : 'border-slate-100 opacity-75'
                  }`;
                  const content = (
                    <>
                      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
                      <span className="relative z-10 flex items-start justify-between gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block line-clamp-2 pr-1 text-sm font-extrabold leading-5 text-slate-800">{subject.name}</span>
                          {canOpen && subject.opened
                            ? <span className="mt-2 block text-xs font-medium text-slate-500">{done}/{total} buổi đã xong</span>
                            : canOpen
                              ? <span className="mt-2 block text-xs font-medium text-amber-700">Có buổi học xem thử</span>
                              : <span className="mt-2 block text-xs font-medium text-slate-400">Chưa đăng ký</span>}
                        </span>
                        <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 px-2 text-xs font-black tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </span>
                      {canOpen && (
                        <span className={`relative z-10 mt-5 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold text-white shadow-sm transition ${
                          subject.opened
                            ? 'bg-emerald-600 group-hover:bg-emerald-700'
                            : 'bg-amber-500 group-hover:bg-amber-600'
                        }`}>
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
  title, courses, selectedCourseId, onSelectCourse, onRegisterCourse, registeringCourseId, progressById, onOpenSubject, now,
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
            now={now}
            selected={selectedCourseId === course.id}
            onSelect={() => onSelectCourse((current) => current === course.id ? '' : course.id)}
            onRegister={onRegisterCourse}
            registering={registeringCourseId === course.id}
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {subjects.map((subject, index) => {
        const done = subject.completedUnitCount || 0;
        const total = subject.totalUnitCount || 0;
        const progress = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
        const completed = total > 0 && done >= total;
        return (
          <button
            key={subject.id}
            type="button"
            onClick={() => onOpenSubject(subject.id)}
            className="group relative flex min-h-[228px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_3px_12px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_16px_30px_rgba(16,185,129,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
            <span className={`pointer-events-none absolute inset-x-0 top-0 h-24 ${
              completed
                ? 'bg-gradient-to-br from-emerald-100/90 via-teal-50 to-white'
                : 'bg-gradient-to-br from-emerald-50 via-cyan-50/60 to-white'
            }`} />
            <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 select-none text-[92px] font-black leading-none tracking-tighter text-emerald-900/[0.045]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="relative z-10 flex items-center justify-between gap-3 px-4 pt-4">
              <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 transition duration-200 group-hover:scale-105 ${
                completed
                  ? 'bg-emerald-600 text-white ring-emerald-700/10'
                  : 'bg-white/90 text-emerald-700 ring-emerald-100'
              }`}>
                {completed ? <CheckCircle2 size={22} /> : <BookOpen size={22} />}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                completed ? 'bg-emerald-100/90 text-emerald-800' : 'bg-white/90 text-emerald-700 ring-1 ring-emerald-100'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${completed ? 'bg-emerald-600' : 'bg-emerald-500'}`} />
                {completed ? 'Hoàn thành' : 'Đã đăng ký'}
              </span>
            </span>
            <span className="relative z-10 mt-4 block px-4">
              <span className="block truncate text-base font-black tracking-tight text-slate-900">{subject.name}</span>
              <span className="mt-1.5 block text-xs font-medium text-slate-500">
                {total > 0 ? `${done} trên ${total} buổi học đã hoàn thành` : 'Chưa có buổi học'}
              </span>
            </span>
            <span className="relative z-10 mx-4 mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <span className="mb-2 flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500">TIẾN ĐỘ HỌC</span>
                <span className={completed ? 'text-emerald-700' : 'text-slate-700'}>{progress}%</span>
              </span>
              <span className="block h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                <span
                  className={`block h-full rounded-full transition-all duration-500 ${completed ? 'bg-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                  style={{ width: `${progress}%` }}
                />
              </span>
            </span>
            <span className="relative z-10 mt-auto flex items-center justify-between px-4 pb-4 pt-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Lộ trình học tập
              </span>
              <span className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-sm transition group-hover:bg-emerald-700 group-hover:shadow-md">
                Vào học <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function LessonPracticeCatalogPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { studentTrainingData } = useData();
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [checkout, setCheckout] = useState(null);
  const [confirmationCourse, setConfirmationCourse] = useState(null);
  const [registeringCourseId, setRegisteringCourseId] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  async function refreshCatalog() {
    const res = await lessonPracticeApi.student.subjects();
    setSubjects(res.data?.subjects || []);
    setCourses(res.data?.courses || []);
  }

  async function startCourseCheckout(course) {
    if (!course?.id || registeringCourseId) return;
    setRegisteringCourseId(course.id);
    try {
      const res = await lessonPracticeApi.student.checkoutCourse(course.id);
      if (res.data?.owned) {
        setConfirmationCourse(null);
        await refreshCatalog();
        toast.success('Bạn đã sở hữu khóa học này');
        return;
      }
      setConfirmationCourse(null);
      setCheckout({ ...res.data, courseId: course.id });
    } catch (err) {
      toast.error(err.message || 'Không tạo được thanh toán');
    } finally {
      setRegisteringCourseId('');
    }
  }

  function requestCourseRegistration(course) {
    if (!course?.id || registeringCourseId) return;
    setConfirmationCourse(course);
  }

  async function confirmCourseRegistration() {
    const course = confirmationCourse;
    if (!course || registeringCourseId) return;
    await startCourseCheckout(course);
  }

  async function handleCoursePurchasePaid() {
    setCheckout(null);
    try {
      await refreshCatalog();
      toast.success('Thanh toán thành công, khóa học đã được mở');
    } catch (err) {
      toast.error(err.message || 'Thanh toán thành công nhưng chưa tải được quyền học');
    }
  }

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
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
    { id: 'subjects', label: 'Môn đã đăng ký', icon: GraduationCap, count: openedSubjects.length },
    { id: 'bundle', label: 'Khóa trọn gói', icon: PackageOpen, count: courses.filter((course) => course.offerType !== 'single').length },
    { id: 'single', label: 'Khóa lẻ', icon: BookOpen, count: courses.filter((course) => course.offerType === 'single').length },
    { id: 'guide', label: 'Hướng dẫn học', icon: CircleHelp },
  ];

  return (
    <div className="w-full min-h-full bg-slate-50/60 px-1 pb-8 pt-4 sm:px-2">
      <div className="w-full">
        <LessonVideoTabs active="lesson" hidden />
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
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition sm:px-4 ${filter === id
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  <Icon size={16} />
                  {label}
                  {count !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${filter === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  )}
                </button>
              ))}
            </div>
            {filter === 'guide' ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                    <CircleHelp size={22} />
                  </span>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Hướng dẫn học</h2>
                    <p className="mt-0.5 text-sm text-slate-500">Các bước bắt đầu và theo dõi khóa học của bạn.</p>
                  </div>
                </div>
                {getLearningGuideVideoEmbedUrl(studentTrainingData?.learningGuideVideoUrl) && (
                  <div className="mb-5 aspect-video max-w-4xl overflow-hidden rounded-xl bg-slate-950">
                    <iframe
                      title="Video hướng dẫn học"
                      src={getLearningGuideVideoEmbedUrl(studentTrainingData.learningGuideVideoUrl)}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                )}
                <div
                  className="prose prose-sm max-w-none text-slate-700 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl"
                  dangerouslySetInnerHTML={{
                    __html: resolveRichHtmlMedia(
                      sanitizeRichHtml(
                        typeof studentTrainingData?.learningGuideHtml === 'string'
                          ? studentTrainingData.learningGuideHtml
                          : DEFAULT_LEARNING_GUIDE_HTML,
                      ),
                      resolveMediaUrl,
                    ),
                  }}
                />
              </section>
            ) : filter === 'subjects' ? (
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
                  onRegisterCourse={requestCourseRegistration}
                  registeringCourseId={registeringCourseId}
                  progressById={progressById}
                  now={now}
                  onOpenSubject={(id, courseId) => navigate(`/student/lesson-practice/subjects/${id}?courseId=${encodeURIComponent(courseId)}`)}
                />
                <CourseCollection
                  title={filter === 'all' ? 'Khóa chưa đăng ký' : filter === 'single' ? 'Khóa lẻ chưa đăng ký' : 'Khóa trọn gói chưa đăng ký'}
                  courses={visibleAvailableCourses}
                  selectedCourseId={selectedCourseId}
                  onSelectCourse={selectCourse}
                  onRegisterCourse={requestCourseRegistration}
                  registeringCourseId={registeringCourseId}
                  progressById={progressById}
                  now={now}
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
        {checkout && (
          <VideoCoursePayModal
            courseTitle={checkout.courseTitle}
            sessionId={checkout.sessionId}
            refCode={checkout.ref}
            amount={checkout.amount}
            paymentTitle="Thanh toán mua khóa học"
            getPaymentSession={lessonPracticeApi.student.getCoursePurchaseSession}
            simulatePayment={() => lessonPracticeApi.student.simulateCoursePurchase(checkout.sessionId)}
            paidEvent="tuition:paid"
            onClose={() => setCheckout(null)}
            onPaid={handleCoursePurchasePaid}
            onSessionAlreadyPaid={handleCoursePurchasePaid}
          />
        )}
        {confirmationCourse && (
          <CoursePurchaseConfirmModal
            course={confirmationCourse}
            confirming={registeringCourseId === confirmationCourse.id}
            onCancel={() => setConfirmationCourse(null)}
            onConfirm={confirmCourseRegistration}
          />
        )}
      </div>
    </div>
  );
}