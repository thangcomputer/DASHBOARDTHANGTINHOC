import { isQuestionAnswered } from '../../../hooks/useCertPrepSession';
import { gradeCertPrepQuestion } from '../../../utils/certPrepGrade';

export default function CertPrepQuestionNavigator({
  questions,
  answers,
  currentIndex,
  onSelect,
  revealedIds = {},
  showResultColors = false,
  exam = false,
}) {
  const total = questions.length;
  const answered = questions.filter((q) => isQuestionAnswered(q, answers[q.id])).length;

  if (exam) {
    return (
      <nav aria-label="Danh sách câu hỏi" className="flex flex-col gap-3">
        <p className="text-[11px] font-bold text-slate-400">
          Đã chọn: {answered}/{total}
        </p>
        <div className="grid grid-cols-5 gap-2 content-start self-start w-full max-h-[min(40vh,280px)] lg:max-h-none overflow-y-auto pr-0.5">
          {questions.map((q, i) => {
            const done = isQuestionAnswered(q, answers[q.id]);
            const current = i === currentIndex;
            const revealed = Boolean(revealedIds[q.id]);
            let btnStyle = 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10';
            if (showResultColors && revealed) {
              const ok = gradeCertPrepQuestion(q, answers[q.id]);
              btnStyle = ok
                ? 'bg-emerald-500/30 border-emerald-500/60 text-emerald-200 font-bold'
                : 'bg-red-500/25 border-red-500/50 text-red-200 font-bold';
            } else if (done) {
              btnStyle = 'bg-emerald-500/30 border-emerald-500/60 text-emerald-200 font-bold';
            }
            if (current) {
              btnStyle = 'bg-sky-500 text-slate-950 font-black border-sky-300 ring-2 ring-sky-400/40';
            }
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelect(i)}
                aria-current={current ? 'true' : undefined}
                className={`min-h-10 rounded-xl text-xs font-black border transition ${btnStyle}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <ul className="mt-1 pt-3 border-t border-white/10 space-y-1.5 text-[10px] font-bold text-slate-400">
          <li className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-sky-500 shrink-0" /> Đang xem
          </li>
          <li className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500/60 shrink-0" /> Đã trả lời
          </li>
          <li className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border border-white/20 bg-white/5 shrink-0" /> Chưa làm
          </li>
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Danh sách câu hỏi"
      className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2 mb-2 px-0.5">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
          Danh sách câu
        </p>
        <p className="text-[11px] font-bold text-slate-500">
          {answered}/{total}
        </p>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-1.5">
        {questions.map((q, i) => {
          const done = isQuestionAnswered(q, answers[q.id]);
          const current = i === currentIndex;
          const revealed = Boolean(revealedIds[q.id]);
          let tone = done
            ? 'border-slate-800 bg-slate-800 text-white'
            : 'border-slate-200 bg-slate-50 text-slate-400';
          if (showResultColors && revealed) {
            const ok = gradeCertPrepQuestion(q, answers[q.id]);
            tone = ok
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
              : 'border-red-400 bg-red-50 text-red-700';
          }
          if (current) {
            tone = 'border-red-600 bg-white text-red-700 ring-2 ring-red-600 shadow-sm';
          }
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelect(i)}
              aria-current={current ? 'true' : undefined}
              className={`min-h-10 rounded-lg text-xs font-black border transition ${tone}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <ul className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-[10px] font-bold text-slate-400">
        <li className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded border-2 border-red-600 bg-white shrink-0" /> Đang xem
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-slate-800 shrink-0" /> Đã trả lời
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded border border-slate-200 bg-slate-50 shrink-0" /> Chưa làm
        </li>
      </ul>
    </nav>
  );
}
