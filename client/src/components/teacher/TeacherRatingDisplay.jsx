import React from 'react';
import { Star } from 'lucide-react';

export const TeacherRatingDisplay = ({ rating, RATING_CRITERIA }) => {
  if (!rating || rating.count === 0) return null;

  const StarIcons = ({ count, max = 5 }) => (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={14} className={i < Math.round(count) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-yellow-50 to-white">
        <h3 className="font-bold text-yellow-800 flex items-center gap-2">
          <Star size={18} className="text-yellow-500 fill-yellow-500" /> Đánh giá từ học viên
        </h3>
      </div>
      <div className="p-6">
        {/* Average */}
        <div className="flex items-center gap-4 mb-6">
          <div className="text-center">
            <p className="text-4xl font-black text-yellow-600">{rating.avg}</p>
            <StarIcons count={rating.avg} />
            <p className="text-xs text-gray-400 mt-1">{rating.count} đánh giá</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map(star => {
              const count = rating.ratings.filter(r => Math.round(r.criteria?.stars) === star).length;
              const pct = rating.count > 0 ? (count / rating.count) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-8 text-right text-gray-500">{star} ⭐</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-gray-400">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Individual reviews */}
        <div className="space-y-3">
          {rating.ratings.map((r, idx) => (
            <div key={idx} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {r.studentName?.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{r.studentName}</p>
                    <p className="text-xs text-gray-400">{r.date}</p>
                  </div>
                </div>
                <StarIcons count={r.criteria?.stars} />
              </div>
              {/* Criteria tags */}
              {r.criteria && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(r.criteria).map(([cat, key]) => {
                    const catData = RATING_CRITERIA[cat];
                    const opt = catData?.options.find(o => o.key === key);
                    return opt ? (
                      <span key={cat} className={`text-xs cms-min-text-xs font-bold px-2 py-0.5 rounded-full ${
                        opt.score >= 4 ? 'bg-green-100 text-green-700' : opt.score >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>{catData.label}: {opt.label}</span>
                    ) : null;
                  })}
                </div>
              )}
              {r.comment && <p className="text-xs text-gray-600 italic">"{r.comment}"</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
// ─── VIETNAMESE BANKS LIST ────────────────────────────────────────────────────
const VN_BANKS = [
  'Vietcombank (VCB)', 'VietinBank (CTG)', 'BIDV', 'Agribank',
  'Techcombank (TCB)', 'MB Bank (MBB)', 'ACB', 'VPBank',
  'Sacombank (STB)', 'HDBank', 'TPBank', 'OCB',
  'SHB', 'VIB', 'SeABank', 'LienVietPostBank (LPB)',
  'Eximbank (EIB)', 'MSB (Maritime Bank)', 'BaoViet Bank',
  'NamABank', 'ABBank', 'Bac A Bank', 'GPBank',
  'NCB', 'Saigonbank', 'VietABank', 'PGBank',
  'KienLong Bank', 'VietBank',
];

// ─── TEACHER PROFILE SECTION ─────────────────────────────────────────────────

export default TeacherRatingDisplay;
