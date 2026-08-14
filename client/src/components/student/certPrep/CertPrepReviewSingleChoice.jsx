import { resolveMediaUrl } from '../../../services/api';

function optionLetter(i) {
  return String.fromCharCode(65 + i);
}

export default function CertPrepReviewSingleChoice({ question }) {
  const selected = question.studentAnswer == null || question.studentAnswer === ''
    ? null
    : Number(question.studentAnswer);
  const correct = Number(question.correctAnswer);
  return (
    <ul className="space-y-2" aria-label="Các lựa chọn">
      {(question.options || []).map((opt, i) => {
        const picked = selected === i;
        const isKey = correct === i;
        let cls = 'border-slate-200 bg-white';
        if (isKey) cls = 'border-emerald-300 bg-emerald-50';
        if (picked && !isKey) cls = 'border-red-300 bg-red-50';
        return (
          <li key={i} className={`rounded-xl border px-3 py-3 text-sm ${cls}`}>
            <span className="font-bold mr-1">{optionLetter(i)}.</span>
            {opt.text || ''}
            {picked ? <span className="ml-2 text-xs font-bold text-slate-500">(Bạn chọn)</span> : null}
            {isKey ? <span className="ml-2 text-xs font-bold text-emerald-700">(Đáp án đúng)</span> : null}
            {opt.imageUrl ? (
              <img src={resolveMediaUrl(opt.imageUrl)} alt="" className="max-h-28 mt-2 rounded-lg border border-slate-100" />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
