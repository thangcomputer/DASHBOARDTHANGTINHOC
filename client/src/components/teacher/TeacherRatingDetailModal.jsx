import React from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { RATING_CRITERIA } from '../../context/useDataRatings';
import { getDisplayName } from './TeacherShared';

/**
 * Popup chi tiết 1 đánh giá công khai (GV xem từ thông báo).
 */
export default function TeacherRatingDetailModal({
  rating,
  loading = false,
  error = '',
  onClose,
  students = [],
  criteriaConfig = RATING_CRITERIA,
}) {
  if (!loading && !rating && !error) return null;

  const stars = Number(rating?.criteria?.stars) || 0;
  const comment = (rating?.comment || rating?.content || '').trim();
  const dateLabel = rating?.date
    || (rating?.createdAt || rating?.updatedAt
      ? new Date(rating.createdAt || rating.updatedAt).toLocaleDateString('vi-VN')
      : '');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết đánh giá"
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30"
          >
            <X size={16} />
          </button>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">Đánh giá từ học viên</p>
          <h3 className="text-lg font-black mt-1">Chi tiết đánh giá</h3>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="py-10 flex justify-center text-amber-500">
              <Loader2 className="animate-spin" size={28} />
            </div>
          ) : error ? (
            <p className="text-sm font-bold text-red-600 text-center py-6">{error}</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">
                    {getDisplayName({
                      name: rating.studentName,
                      studentId: rating.studentId,
                      phone: rating.studentPhone || rating.phone,
                      zalo: rating.studentZalo,
                    }, students)}
                  </p>
                  {dateLabel ? <p className="text-[11px] text-slate-400 font-medium mt-0.5">{dateLabel}</p> : null}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-amber-600 tabular-nums leading-none">{stars || '—'}</p>
                  <div className="flex gap-0.5 justify-end mt-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i <= Math.round(stars) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {rating.criteria ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(criteriaConfig).map(([cat, catData]) => {
                    const key = rating.criteria[cat];
                    const opt = catData?.options?.find((o) => o.key === key);
                    if (!opt) return null;
                    return (
                      <span
                        key={cat}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          opt.score >= 4
                            ? 'bg-emerald-100 text-emerald-700'
                            : opt.score >= 3
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {catData.label}: {opt.label}
                      </span>
                    );
                  })}
                </div>
              ) : null}

              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 min-h-[72px]">
                {comment ? (
                  <p className="text-sm text-slate-700 italic leading-relaxed">&ldquo;{comment}&rdquo;</p>
                ) : (
                  <p className="text-sm text-slate-400 font-medium">Không có lời nhắn kèm theo.</p>
                )}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-black transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

/** Lấy evaluationId từ payload hoặc query trên path */
export function getEvaluationIdFromNotif(n) {
  if (!n) return null;
  const fromPayload = n.payload?.evaluationId || n.payload?.evalId;
  if (fromPayload) return String(fromPayload);
  const path = String(n.path || n.link || '');
  if (!path.includes('evaluationId=')) return null;
  try {
    const qs = path.includes('?') ? path.split('?')[1].split('#')[0] : '';
    return new URLSearchParams(qs).get('evaluationId');
  } catch {
    return null;
  }
}

export function isTeacherRatingNotif(n) {
  if (!n) return false;
  if (n.payload?.kind === 'admin_feedback') return false;
  if (n.payload?.kind === 'teacher_rating') return true;
  if (getEvaluationIdFromNotif(n)) return true;
  const t = String(n.type || '').toUpperCase();
  return t === 'EVALUATION' && !n.payload?.milestone;
}
