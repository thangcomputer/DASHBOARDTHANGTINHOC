import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clapperboard, Clock3, GraduationCap, Layers3, Loader2, Lock, ShoppingCart, Sparkles, CircleHelp, X } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';
import { useData } from '../../../context/DataContext';
import { resolveRichHtmlMedia, sanitizeRichHtml } from '../../../utils/htmlContent';
import { DEFAULT_LEARNING_GUIDE_HTML, getLearningGuideVideoEmbedUrl } from '../../../utils/learningGuide';
import LessonVideoTabs from '../LessonVideoTabs';
import VideoCoursePayModal from '../../VideoCoursePayModal';
import CoursePurchaseConfirmModal from './CoursePurchaseConfirmModal';
import { useToast } from '../../../utils/toast';

const COURSE_CONSULTATION_ZALO_PHONE = '0984623486';
const ZALO_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg';

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
  const isInstructorCourse = course.deliveryMode === 'instructor';
  const lessonCount = Number.isFinite(Number(course.lessonCount))
    ? Number(course.lessonCount)
    : (course.subjects || []).reduce(
      (total, subject) => total + (Number(subject.totalUnitCount) || 0),
      0,
    );
  const consultationMessage = `[THẮNG TIN HỌC] Tôi muốn được tư vấn khóa học 1 kèm 1: ${course.name}`;
  const consultationUrl = `https://zalo.me/${COURSE_CONSULTATION_ZALO_PHONE}?text=${encodeURIComponent(consultationMessage)}`;

  return (
    <article className={`group relative z-0 flex h-full min-h-[312px] w-full flex-col rounded-2xl border bg-white shadow-[0_4px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:z-40 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(15,23,42,0.12)] ${selected ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-haspopup="dialog"
        aria-expanded={selected}
        className="flex min-h-0 w-full flex-1 flex-col rounded-t-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
      >
        <span
          className={`relative flex h-24 w-full shrink-0 items-start justify-between overflow-hidden rounded-t-2xl p-3 sm:h-28 sm:p-4 ${
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
          <span className="absolute inset-x-3 top-1/2 z-20 flex -translate-y-[15%] justify-center">
            <span
              title={course.deliveryMode === 'instructor' ? 'Học cùng giảng viên' : 'Khóa tự học'}
              className="inline-grid w-fit max-w-full grid-cols-[28px_max-content] items-center gap-2 rounded-full border border-white/80 bg-white/95 py-1.5 pl-1.5 pr-4 text-[9px] font-black tracking-[0.05em] text-slate-800 shadow-lg shadow-slate-950/15 ring-4 ring-white/15 backdrop-blur-sm transition sm:grid-cols-[32px_max-content] sm:gap-2.5 sm:py-2 sm:pl-2 sm:pr-5 sm:text-[10px]"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8 ${
                course.deliveryMode === 'instructor' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {course.deliveryMode === 'instructor'
                  ? <GraduationCap size={17} strokeWidth={2.4} />
                  : <Clapperboard size={16} strokeWidth={2.4} />}
              </span>
              <span className="whitespace-nowrap text-center leading-none">
                {course.deliveryMode === 'instructor' ? 'HỌC CÙNG GIẢNG VIÊN' : 'TỰ HỌC QUA VIDEO'}
              </span>
            </span>
          </span>
          <span className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-2.5 py-1.5 text-[10px] font-extrabold text-slate-700 shadow-sm backdrop-blur-sm">
            {course.offerType === 'single' ? 'Khóa lẻ' : 'Trọn gói'}
          </span>
        </span>
        <span className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <span className="group/course-details relative flex min-h-0 flex-1 flex-col">
            <span className="flex min-h-0 min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 min-h-8 text-[13px] font-black leading-4 text-slate-900 sm:text-sm sm:leading-[18px]">{course.name}</span>
              <span className="mt-1.5 flex min-h-[44px] flex-wrap content-start items-center gap-1 overflow-hidden sm:min-h-[50px]" aria-label="Các môn trong khóa học">
                <span className="inline-flex items-center text-[10px] font-bold leading-none text-slate-500">Môn:</span>
                {Array.isArray(course.subjects) && course.subjects.slice(0, course.subjects.length > 4 ? 3 : 4).map((subject, index) => (
                  <span
                    key={`${subject.id || subject.name}-${index}`}
                    title={subject.name}
                    className={`inline-flex w-fit max-w-[calc(100%-2rem)] truncate rounded-md border px-1.5 py-0.5 text-[9px] font-semibold leading-4 sm:px-2 sm:py-1 sm:text-[10px] ${
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
                  <span className="inline-flex w-fit max-w-full truncate rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold leading-4 text-slate-500 sm:px-2 sm:py-1 sm:text-[10px]">
                    +{course.subjects.length - 3} môn
                  </span>
                )}
              </span>
              <span className="mt-auto flex min-w-0 items-end justify-between gap-2 border-t border-slate-100 pt-2.5">
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-slate-500 sm:text-[11px]">
                  <Clock3 size={12} className="shrink-0 text-slate-400" />
                  <strong className="font-bold text-slate-700">{lessonCount}</strong> bài học
                </span>
                {course.enrolled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 sm:text-[10px]">
                    <CheckCircle2 size={12} />
                    Đã đăng ký
                  </span>
                ) : (
                  <span className={`flex min-w-0 flex-col items-end rounded-lg border px-2 py-1.5 ${
                    saleActive
                      ? 'border-rose-100 bg-rose-50/70'
                      : 'border-slate-200 bg-slate-50'
                  }`}>
                    <span className="flex max-w-full items-center gap-1">
                      {saleActive && (
                        <>
                          <span className="truncate text-[9px] font-medium text-slate-400 line-through">
                            {Number(course.originalPrice).toLocaleString('vi-VN')}đ
                          </span>
                          {Number(course.discountPercent) > 0 && (
                            <span className="shrink-0 rounded-full bg-rose-100 px-1 py-0.5 text-[8px] font-black leading-3 text-rose-700">
                              -{course.discountPercent}%
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    <span className={`whitespace-nowrap text-sm font-black leading-tight tracking-tight sm:text-base ${
                      saleActive ? 'text-rose-700' : 'text-slate-800'
                    }`}>
                      {Number(displayPrice || 0).toLocaleString('vi-VN')}đ
                    </span>
                    {countdown && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[8px] font-bold tabular-nums text-amber-700 sm:text-[9px]" aria-label={`Khuyến mãi kết thúc sau ${countdown}`}>
                        <Clock3 size={9} className="shrink-0" />
                        Còn {countdown}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </span>
            {!course.enrolled && (
              <span
                role="tooltip"
                className="invisible absolute left-1/2 top-1/2 z-50 w-[min(22rem,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 text-left opacity-0 shadow-2xl transition duration-150 group-hover/course-details:visible group-hover/course-details:opacity-100"
              >
                <span className="mb-1 flex items-center gap-1.5 text-xs font-black text-slate-900">
                  <Sparkles size={14} className="text-amber-500" />
                  {course.deliveryMode === 'instructor' ? 'Học cùng giảng viên 1 kèm 1' : 'Khóa tự học là gì?'}
                </span>
                {course.deliveryMode === 'instructor' ? (
                  <ul className="space-y-2 text-[13px] leading-relaxed text-slate-600">
                    <li className="flex gap-2"><span className="font-black text-emerald-600">•</span><span>Học trực tiếp 1 kèm 1 với giảng viên qua UltraViewer hoặc TeamViewer; hỗ trợ Chrome Remote Desktop trên MacBook.</span></li>
                    <li className="flex gap-2"><span className="font-black text-emerald-600">•</span><span>Mỗi buổi học đều được ghi lại màn hình để bạn xem lại.</span></li>
                    <li className="flex gap-2"><span className="font-black text-emerald-600">•</span><span>Thời gian học linh động, sắp xếp phù hợp với lịch của bạn.</span></li>
                    <li className="flex gap-2"><span className="font-black text-emerald-600">•</span><span>Được hỗ trợ trọn đời trong quá trình học.</span></li>
                  </ul>
                ) : (
                  <>
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
                  </>
                )}
              </span>
            )}
          </span>
        </span>
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 pb-3 pt-2">
        {!course.enrolled && !isInstructorCourse ? (
          <button
            type="button"
            disabled={registering}
            onClick={() => onRegister(course)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 text-xs font-black text-emerald-700 shadow-sm transition-colors hover:bg-emerald-600 hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            {registering ? <Loader2 className="animate-spin" size={14} /> : <ShoppingCart size={14} />}
            Đăng ký học
          </button>
        ) : !course.enrolled && isInstructorCourse ? (
          <a
            href={consultationUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Tư vấn Zalo khóa học ${course.name}`}
            title={`Tư vấn khóa học qua Zalo ${COURSE_CONSULTATION_ZALO_PHONE}`}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#e6f4ff] px-3 text-xs font-black text-[#0873b9] shadow-sm transition-colors hover:bg-[#0873b9] hover:text-white"
          >
            <img src={ZALO_LOGO_URL} alt="" className="h-4 w-4 shrink-0" loading="lazy" />
            Zalo tư vấn
          </a>
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
                  const progressPercent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
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
                            ? <span className="mt-2 block text-xs font-medium text-slate-500">{done}/{total} bài đã hoàn thành</span>
                            : canOpen
                              ? <span className="mt-2 block text-xs font-medium text-amber-700">Có buổi học xem thử</span>
                              : <span className="mt-2 block text-xs font-medium text-slate-400">Chưa đăng ký</span>}
                        </span>
                        <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 px-2 text-xs font-black tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </span>
                      <span className="relative z-10 mt-4 block rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                        <span className="mb-2 flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-500">TIẾN ĐỘ HỌC</span>
                          <span className={progressPercent === 100 ? 'text-emerald-700' : 'text-slate-700'}>{progressPercent}%</span>
                        </span>
                        <span
                          role="progressbar"
                          aria-label={`Tiến độ ${subject.name}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={progressPercent}
                          className="block h-1.5 overflow-hidden rounded-full bg-slate-200/80"
                        >
                          <span
                            className={`block h-full rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                            style={{ width: `${progressPercent}%` }}
                          />
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
  title, type, courses, selectedCourseId, onSelectCourse, onRegisterCourse, registeringCourseId, progressById, onOpenSubject, now,
}) {
  if (!courses.length) return null;
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || null;
  const heading = {
    registered: {
      icon: CheckCircle2,
      eyebrow: 'LỘ TRÌNH CỦA BẠN',
      description: 'Các khóa học bạn đã đăng ký và có thể tiếp tục học.',
      iconClass: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
      countClass: 'bg-emerald-100 text-emerald-800',
      lineClass: 'from-emerald-300 via-emerald-200 to-transparent',
    },
    video: {
      icon: Clapperboard,
      eyebrow: 'CHỦ ĐỘNG HỌC TẬP',
      description: 'Học theo video bài giảng, linh hoạt theo thời gian của bạn.',
      iconClass: 'bg-amber-100 text-amber-700 ring-amber-200',
      countClass: 'bg-amber-100 text-amber-800',
      lineClass: 'from-amber-300 via-orange-200 to-transparent',
    },
    instructor: {
      icon: GraduationCap,
      eyebrow: 'HỌC CÙNG GIẢNG VIÊN',
      description: 'Học có giảng viên hướng dẫn và đồng hành.',
      iconClass: 'bg-sky-100 text-sky-700 ring-sky-200',
      countClass: 'bg-sky-100 text-sky-800',
      lineClass: 'from-sky-300 via-indigo-200 to-transparent',
    },
    other: {
      icon: BookOpen,
      eyebrow: 'KHÁM PHÁ KHÓA HỌC',
      description: 'Các khóa học đang mở để bạn tham khảo.',
      iconClass: 'bg-slate-100 text-slate-700 ring-slate-200',
      countClass: 'bg-slate-100 text-slate-700',
      lineClass: 'from-slate-300 via-slate-200 to-transparent',
    },
  }[type] || {
    icon: BookOpen,
    eyebrow: 'KHÓA HỌC',
    description: '',
    iconClass: 'bg-slate-100 text-slate-700 ring-slate-200',
    countClass: 'bg-slate-100 text-slate-700',
    lineClass: 'from-slate-300 via-slate-200 to-transparent',
  };
  const HeadingIcon = heading.icon;
  return (
    <section className="mt-8">
      <div className="mb-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 sm:h-12 sm:w-12 ${heading.iconClass}`}>
            <HeadingIcon size={22} strokeWidth={2.3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold tracking-[0.16em] text-slate-400 sm:text-[11px]">
              {heading.eyebrow}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-lg font-black leading-tight tracking-tight text-slate-900 sm:text-xl">
                {title}
              </h2>
              <span className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-black tabular-nums ${heading.countClass}`}>
                {courses.length}
              </span>
            </div>
            {heading.description && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{heading.description}</p>
            )}
          </div>
        </div>
        <div className={`ml-14 mt-3 h-px bg-gradient-to-r sm:ml-16 ${heading.lineClass}`} />
      </div>
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
  const availableCourses = courses.filter((course) => !course.enrolled && !course.hiddenByEnrollment);
  const visibleCourses = [...enrolledCourses, ...availableCourses];
  const matchesCourseFilter = (course) => {
    if (filter === 'registered') return course.enrolled;
    if (filter === 'video') return course.deliveryMode === 'video';
    if (filter === 'instructor') return course.deliveryMode === 'instructor';
    return true;
  };
  const visibleEnrolledCourses = enrolledCourses.filter(matchesCourseFilter);
  const visibleAvailableCourses = availableCourses.filter(matchesCourseFilter);
  const courseSections = filter === 'all'
    ? [
      { title: 'Khóa đã đăng ký', type: 'registered', courses: enrolledCourses },
      { title: 'Khóa tự học qua video', type: 'video', courses: availableCourses.filter((course) => course.deliveryMode === 'video') },
      { title: 'Khóa học cùng với giảng viên', type: 'instructor', courses: availableCourses.filter((course) => course.deliveryMode === 'instructor') },
    ]
    : filter === 'registered'
      ? [{ title: 'Khóa đã đăng ký', type: 'registered', courses: visibleEnrolledCourses }]
      : filter === 'video' || filter === 'instructor'
        ? [
          { title: `${filter === 'video' ? 'Khóa tự học qua video' : 'Khóa học cùng với giảng viên'} · Đã đăng ký`, type: filter, courses: visibleEnrolledCourses },
          { title: `${filter === 'video' ? 'Khóa tự học qua video' : 'Khóa học cùng với giảng viên'} · Chưa đăng ký`, type: filter, courses: visibleAvailableCourses },
        ]
        : [
          { title: 'Khóa đã đăng ký', type: 'registered', courses: visibleEnrolledCourses },
          { title: 'Khóa chưa đăng ký', type: 'other', courses: visibleAvailableCourses },
        ];
  const progressById = new Map(subjects.map((subject) => [subject.id, subject]));
  const filters = [
    { id: 'all', label: 'Tất cả', icon: Layers3, count: visibleCourses.length },
    { id: 'registered', label: 'Khóa đã đăng ký', icon: CheckCircle2, count: enrolledCourses.length },
    { id: 'video', label: 'Tự học qua video', icon: Clapperboard, count: visibleCourses.filter((course) => course.deliveryMode === 'video').length },
    { id: 'instructor', label: 'Học cùng giảng viên', icon: GraduationCap, count: visibleCourses.filter((course) => course.deliveryMode === 'instructor').length },
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
              {filters.map((filterOption) => (
                <button
                  key={filterOption.id}
                  type="button"
                  aria-pressed={filter === filterOption.id}
                  onClick={() => { setFilter(filterOption.id); setSelectedCourseId(''); }}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition sm:px-4 ${filter === filterOption.id
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  <filterOption.icon size={16} />
                  {filterOption.label}
                  {filterOption.count !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${filter === filterOption.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{filterOption.count}</span>
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
            ) : (
              <>
                {courseSections.map((section) => (
                  <CourseCollection
                    key={section.title}
                    title={section.title}
                    type={section.type}
                    courses={section.courses}
                    selectedCourseId={selectedCourseId}
                    onSelectCourse={selectCourse}
                    onRegisterCourse={requestCourseRegistration}
                    registeringCourseId={registeringCourseId}
                    progressById={progressById}
                    now={now}
                    onOpenSubject={(id, courseId) => navigate(`/student/lesson-practice/subjects/${id}?courseId=${encodeURIComponent(courseId)}`)}
                  />
                ))}
                {!courseSections.some((section) => section.courses.length > 0) && (
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