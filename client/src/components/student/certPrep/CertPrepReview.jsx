import { useMemo, useState } from 'react';
import CertPrepReviewQuestion from './CertPrepReviewQuestion';
import CertPrepEmptyState from './CertPrepEmptyState';

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'correct', label: 'Đúng' },
  { id: 'incorrect', label: 'Sai' },
  { id: 'unanswered', label: 'Chưa trả lời' },
];

function matchesFilter(q, filter) {
  if (filter === 'correct') return q.isCorrect;
  if (filter === 'incorrect') return q.answered && !q.isCorrect;
  if (filter === 'unanswered') return !q.answered;
  return true;
}

export default function CertPrepReview({ questions = [] }) {
  const [filter, setFilter] = useState('all');
  const [current, setCurrent] = useState(0);
  const total = questions.length;
  const visible = useMemo(
    () => questions.filter((q) => matchesFilter(q, filter)),
    [questions, filter],
  );
  const question = visible[Math.min(current, Math.max(0, visible.length - 1))] || null;

  if (!total) {
    return <CertPrepEmptyState title="Chưa có dữ liệu xem lại." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => { setFilter(f.id); setCurrent(0); }}
            className={`min-h-11 px-3 rounded-xl text-sm font-bold border ${
              filter === f.id ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <nav aria-label="Danh sách câu hỏi" className="grid grid-cols-5 sm:grid-cols-8 gap-2">
        {questions.map((q, i) => {
          const hidden = !matchesFilter(q, filter);
          let mark = '—';
          let cls = 'border-slate-200 bg-slate-50 text-slate-500';
          if (q.answered && q.isCorrect) {
            mark = '✓';
            cls = 'border-emerald-200 bg-emerald-50 text-emerald-800';
          } else if (q.answered) {
            mark = '✗';
            cls = 'border-red-200 bg-red-50 text-red-700';
          }
          const active = question && q.questionId === question.questionId;
          return (
            <button
              key={q.questionId}
              type="button"
              disabled={hidden}
              onClick={() => {
                const idx = visible.findIndex((row) => row.questionId === q.questionId);
                if (idx >= 0) setCurrent(idx);
              }}
              className={`min-h-11 rounded-xl text-xs font-black border ${active ? 'ring-2 ring-red-600 ' : ''}${cls} ${hidden ? 'opacity-30' : ''}`}
            >
              {i + 1} {mark}
            </button>
          );
        })}
      </nav>
      {question ? (
        <CertPrepReviewQuestion question={question} total={total} />
      ) : (
        <CertPrepEmptyState title="Không có câu hỏi trong bộ lọc này." />
      )}
      {visible.length > 1 ? (
        <div className="flex justify-between gap-2">
          <button
            type="button"
            disabled={current <= 0}
            onClick={() => setCurrent((n) => Math.max(0, n - 1))}
            className="min-h-11 px-4 rounded-xl font-bold text-sm border border-slate-200 disabled:opacity-40"
          >
            Câu trước
          </button>
          <button
            type="button"
            disabled={current >= visible.length - 1}
            onClick={() => setCurrent((n) => Math.min(visible.length - 1, n + 1))}
            className="min-h-11 px-4 rounded-xl font-bold text-sm border border-slate-200 disabled:opacity-40"
          >
            Câu tiếp
          </button>
        </div>
      ) : null}
    </div>
  );
}
