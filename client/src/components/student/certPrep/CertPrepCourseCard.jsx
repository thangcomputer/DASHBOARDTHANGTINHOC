import { resolveMediaUrl } from '../../../services/api';

export default function CertPrepCourseCard({ course, onOpen }) {
  const logo = course?.logoUrl ? resolveMediaUrl(course.logoUrl) : '';
  const levelCount = Array.isArray(course?.levels) ? course.levels.length : 0;
  return (
    <article className="cert-prep-card h-full">
      <div className="cert-prep-card__inner">
        <div className="w-full aspect-square bg-white border-b border-slate-100 flex items-center justify-center overflow-hidden">
          {logo ? (
            <img src={logo} alt="" className="w-full h-full object-cover object-center" />
          ) : (
            <span className="text-sm font-bold text-slate-300">IC3 / MOS</span>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4 flex-1 min-h-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">{course.name}</h3>
            {course.description ? (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{course.description}</p>
            ) : null}
            <p className="text-xs font-bold text-slate-400 mt-2">{levelCount} cấp độ</p>
          </div>
          <button
            type="button"
            onClick={() => onOpen(course)}
            className="mt-auto min-h-11 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold w-full"
          >
            Xem khóa học
          </button>
        </div>
      </div>
    </article>
  );
}
