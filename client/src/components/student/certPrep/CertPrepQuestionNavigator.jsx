import { isQuestionAnswered } from '../../../hooks/useCertPrepSession';

export default function CertPrepQuestionNavigator({
  questions,
  answers,
  currentIndex,
  onSelect,
}) {
  return (
    <nav aria-label="Danh sách câu hỏi" className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-4 gap-2">
      {questions.map((q, i) => {
        const answered = isQuestionAnswered(q, answers[q.id]);
        const current = i === currentIndex;
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onSelect(i)}
            aria-current={current ? 'true' : undefined}
            className={`min-h-11 rounded-xl text-xs font-black border ${
              current
                ? 'border-red-600 bg-red-600 text-white'
                : answered
                  ? 'border-slate-200 bg-white text-slate-800'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {i + 1} {answered ? '✓' : '—'}
          </button>
        );
      })}
    </nav>
  );
}
