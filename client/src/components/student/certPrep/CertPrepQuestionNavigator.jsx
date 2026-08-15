import { isQuestionAnswered } from '../../../hooks/useCertPrepSession';
import { gradeCertPrepQuestion } from '../../../utils/certPrepGrade';

export default function CertPrepQuestionNavigator({
  questions,
  answers,
  currentIndex,
  onSelect,
  revealedIds = {},
  showResultColors = false,
}) {
  return (
    <nav
      aria-label="Danh sách câu hỏi"
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 mb-2 px-0.5">
        Danh sách câu
      </p>
      <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-4 gap-2">
        {questions.map((q, i) => {
          const answered = isQuestionAnswered(q, answers[q.id]);
          const current = i === currentIndex;
          const revealed = Boolean(revealedIds[q.id]);
          let tone = answered
            ? 'border-slate-200 bg-slate-50 text-slate-800'
            : 'border-slate-100 bg-white text-slate-400';
          if (showResultColors && revealed) {
            const ok = gradeCertPrepQuestion(q, answers[q.id]);
            tone = ok
              ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
              : 'border-red-400 bg-red-50 text-red-700';
          }
          if (current) {
            tone = 'border-red-600 bg-red-600 text-white shadow-md shadow-red-600/25';
          }
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelect(i)}
              aria-current={current ? 'true' : undefined}
              className={`min-h-11 rounded-xl text-xs font-black border transition ${tone}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
