import React from 'react';
import { Star } from 'lucide-react';

export function formatMaskedPhone(phoneStr, fallbackName = '', students = []) {
  let raw = String(phoneStr || '').replace(/\D/g, '');

  if (!raw && fallbackName && Array.isArray(students)) {
    const found = students.find(
      (s) => s?.name?.toLowerCase().trim() === String(fallbackName).toLowerCase().trim() || String(s?.id || s?._id) === String(phoneStr)
    );
    if (found?.phone || found?.zalo) {
      raw = String(found.phone || found.zalo).replace(/\D/g, '');
    }
  }

  if (raw.length >= 7) {
    return raw.slice(0, raw.length - 4) + '****';
  }

  if (raw.length > 0) {
    return raw + '****';
  }

  return '098*******';
}

export const TeacherRatingDisplay = ({ rating, RATING_CRITERIA, students = [] }) => {
  if (!rating || rating.count === 0) return null;

  const StarIcons = ({ count, max = 5 }) => (
    <div className="flex gap-0.5 justify-center">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={12}
          className={i < Math.round(count) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
          aria-hidden="true"
        />
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white">
        <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
          <Star size={15} className="text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />
          Đánh giá từ học viên
        </h3>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="text-center shrink-0 w-[4.5rem] sm:w-auto">
            <p className="text-2xl sm:text-4xl font-black text-amber-600 tabular-nums leading-none">{rating.avg}</p>
            <div className="mt-1">
              <StarIcons count={rating.avg} />
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{rating.count} đánh giá</p>
          </div>
          <div className="flex-1 min-w-0 max-w-[14rem] sm:max-w-none mx-auto sm:mx-0 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = rating.ratings.filter((r) => Math.round(r.criteria?.stars) === star).length;
              const pct = rating.count > 0 ? (count / rating.count) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                  <span className="w-3 text-right text-slate-500 tabular-nums shrink-0">{star}</span>
                  <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" aria-hidden="true" />
                  <div className="flex-1 h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden min-w-0">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-4 text-right text-slate-400 tabular-nums shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {rating.ratings.map((r, idx) => (
            <div key={idx} className="bg-slate-50 rounded-xl p-3 sm:p-4 shadow-sm border border-slate-100/80">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    HV
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {formatMaskedPhone(r.studentPhone || r.phone || r.studentZalo || r.studentId, r.studentName, students)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-400">{r.date}</p>
                  </div>
                </div>
                <StarIcons count={r.criteria?.stars} />
              </div>
              {r.criteria && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {Object.entries(r.criteria).map(([cat, key]) => {
                    const catData = RATING_CRITERIA[cat];
                    const opt = catData?.options.find((o) => o.key === key);
                    return opt ? (
                      <span
                        key={cat}
                        className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full ${
                          opt.score >= 4
                            ? 'bg-emerald-100 text-emerald-700'
                            : opt.score >= 3
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {catData.label}: {opt.label}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              {r.comment && <p className="text-[11px] sm:text-xs text-slate-600 italic leading-relaxed">&ldquo;{r.comment}&rdquo;</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherRatingDisplay;
