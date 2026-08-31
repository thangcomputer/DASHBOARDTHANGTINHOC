import { resolveMediaUrl } from '../../../services/api';

function optionTone({ showFeedback, isCorrectOpt, isSelected, wrongSelected, exam }) {
  if (exam) {
    if (!showFeedback) {
      return isSelected
        ? 'border-emerald-500 bg-emerald-500/20 text-white shadow-md shadow-emerald-900/20'
        : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300';
    }
    if (isCorrectOpt) return 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 font-bold';
    if (wrongSelected) return 'border-red-500/40 bg-red-500/20 text-red-300 font-bold';
    return 'border-white/5 bg-white/5 text-slate-500 opacity-70';
  }
  if (!showFeedback) {
    return isSelected
      ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50';
  }
  if (isCorrectOpt) return 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200';
  if (wrongSelected) return 'border-red-500 bg-red-50 ring-1 ring-red-200';
  return 'border-slate-200 bg-slate-50 opacity-70';
}

export default function CertPrepMultipleChoice({
  question,
  value,
  disabled,
  onChange,
  showFeedback = false,
  exam = false,
}) {
  const selected = Array.isArray(value) ? value.map(Number) : [];
  const correctSet = new Set((question.correctIndices || []).map(Number));
  const toggle = (i) => {
    const set = new Set(selected);
    if (set.has(i)) set.delete(i);
    else set.add(i);
    onChange([...set].sort((a, b) => a - b));
  };
  return (
    <fieldset className="space-y-2.5" disabled={disabled}>
      <legend className="sr-only">Chọn một hoặc nhiều đáp án</legend>
      {(question.options || []).map((opt, i) => {
        const id = `cert-prep-${question.id}-opt-${i}`;
        const checked = selected.includes(i);
        const isCorrectOpt = showFeedback && correctSet.has(i);
        const wrongSelected = showFeedback && checked && !correctSet.has(i);
        return (
          <label
            key={id}
            htmlFor={id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm transition ${
              optionTone({ showFeedback, isCorrectOpt, isSelected: checked, wrongSelected, exam })
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input
              id={id}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(i)}
              className={`mt-1 ${exam ? 'accent-emerald-500' : 'accent-red-600'}`}
            />
            <span className="min-w-0 flex-1">
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-black mr-2 align-middle ${
                exam
                  ? (checked ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-white/20 text-slate-400')
                  : 'bg-slate-900/5 text-slate-700'
              }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className={`font-semibold align-middle ${exam ? '' : 'text-slate-800'}`}>{opt.text || ''}</span>
              {showFeedback && isCorrectOpt ? (
                <span className={`ml-2 text-[11px] font-black uppercase ${exam ? 'text-emerald-300' : 'text-emerald-700'}`}>Đúng</span>
              ) : null}
              {showFeedback && wrongSelected ? (
                <span className={`ml-2 text-[11px] font-black uppercase ${exam ? 'text-red-300' : 'text-red-600'}`}>Bạn chọn</span>
              ) : null}
              {opt.imageUrl ? (
                <img src={resolveMediaUrl(opt.imageUrl)} alt="" className={`max-h-36 mt-2 rounded-xl border ${exam ? 'border-white/10' : 'border-slate-100'}`} />
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
