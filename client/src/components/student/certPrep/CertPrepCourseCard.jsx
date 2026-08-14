import { resolveMediaUrl } from '../../../services/api';

export default function CertPrepCourseCard({ course, onOpen }) {
  const logo = course?.logoUrl ? resolveMediaUrl(course.logoUrl) : '';
  const levelCount = Array.isArray(course?.levels) ? course.levels.length : 0;
  return (
    <article className="cms-card flex flex-col gap-3 h-full">
      {logo ? (
        <img src={logo} alt="" className="h-16 w-16 object-contain rounded-xl bg-slate-50" />
      ) : null}
      <div className="min-w-0">
        <h3 className="text-base font-bold text-slate-900">{course.name}</h3>
        <p className="text-sm text-slate-500 mt-1 line-clamp-3">{course.description || ' '}</p>
        <p className="text-xs font-bold text-slate-400 mt-2">{levelCount} cấp độ</p>
      </div>
      <button
        type="button"
        onClick={() => onOpen(course)}
        className="mt-auto min-h-11 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
      >
        Xem khóa học
      </button>
    </article>
  );
}
