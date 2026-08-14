import { resolveMediaUrl } from '../../../services/api';
import { questionTypeLabel } from './questionLabels';

function Img({ src, alt }) {
  if (!src) return null;
  return <img src={resolveMediaUrl(src)} alt={alt} className="max-h-40 rounded-lg border border-slate-100 my-2" />;
}

export default function CertPrepQuestionPreview({ question, showAnswers = true }) {
  if (!question) return null;
  const q = question;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">Admin preview</p>
        <span className="text-xs font-bold text-slate-500">{questionTypeLabel(q.type)}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900 whitespace-pre-wrap">{q.questionText}</p>
      <Img src={q.questionImage} alt="Hình câu hỏi" />

      {q.type === 'single_choice' && (
        <ul className="space-y-2">
          {(q.options || []).map((opt, i) => (
            <li
              key={i}
              className={`rounded-xl border px-3 py-2 text-sm ${showAnswers && Number(q.correctAnswer) === i ? 'border-emerald-300 bg-emerald-50 font-bold' : 'border-slate-100'}`}
            >
              ○ {String.fromCharCode(65 + i)}. {opt.text || '(trống)'}
              <Img src={opt.imageUrl} alt={`Đáp án ${String.fromCharCode(65 + i)}`} />
            </li>
          ))}
        </ul>
      )}

      {q.type === 'multiple_choice' && (
        <ul className="space-y-2">
          {(q.options || []).map((opt, i) => {
            const ok = showAnswers && (q.correctIndices || []).includes(i);
            return (
              <li key={i} className={`rounded-xl border px-3 py-2 text-sm ${ok ? 'border-emerald-300 bg-emerald-50 font-bold' : 'border-slate-100'}`}>
                ☐ {String.fromCharCode(65 + i)}. {opt.text || '(trống)'}
                <Img src={opt.imageUrl} alt={`Đáp án ${String.fromCharCode(65 + i)}`} />
              </li>
            );
          })}
        </ul>
      )}

      {q.type === 'matching' && (
        <div className="space-y-2 text-sm">
          {(q.matchingItems || []).map((item, i) => {
            const pair = (q.matchingPairs || []).find((p) => p.itemId === item.id);
            const target = (q.matchingTargets || []).find((t) => t.id === pair?.targetId);
            const tIdx = (q.matchingTargets || []).findIndex((t) => t.id === pair?.targetId);
            return (
              <p key={item.id} className="rounded-xl border border-slate-100 px-3 py-2">
                {String.fromCharCode(65 + i)}. {item.text || '(trống)'}
                {showAnswers ? ` → ${tIdx >= 0 ? tIdx + 1 : '?'}. ${target?.text || '(chưa ghép)'}` : ''}
              </p>
            );
          })}
        </div>
      )}

      {showAnswers && (q.hint || q.hintImage) ? (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm">
          <p className="font-bold text-amber-800 text-xs mb-1">Gợi ý</p>
          <p className="whitespace-pre-wrap">{q.hint}</p>
          <Img src={q.hintImage} alt="Hình gợi ý" />
        </div>
      ) : null}

      {showAnswers && (q.explanation || q.explanationImage) ? (
        <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-sm">
          <p className="font-bold text-sky-800 text-xs mb-1">Giải thích</p>
          <p className="whitespace-pre-wrap">{q.explanation}</p>
          <Img src={q.explanationImage} alt="Hình giải thích" />
        </div>
      ) : null}
    </div>
  );
}
