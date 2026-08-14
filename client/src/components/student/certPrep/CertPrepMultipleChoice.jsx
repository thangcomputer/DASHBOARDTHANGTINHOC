import { resolveMediaUrl } from '../../../services/api';

export default function CertPrepMultipleChoice({ question, value, disabled, onChange }) {
  const selected = Array.isArray(value) ? value.map(Number) : [];
  const toggle = (i) => {
    const set = new Set(selected);
    if (set.has(i)) set.delete(i);
    else set.add(i);
    onChange([...set].sort((a, b) => a - b));
  };
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">Chọn một hoặc nhiều đáp án</legend>
      {(question.options || []).map((opt, i) => {
        const id = `cert-prep-${question.id}-opt-${i}`;
        const checked = selected.includes(i);
        return (
          <label
            key={id}
            htmlFor={id}
            className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm cursor-pointer ${
              checked ? 'border-red-600 bg-red-50' : 'border-slate-200 bg-white'
            } ${disabled ? 'opacity-70 cursor-not-allowed' : 'hover:border-slate-300'}`}
          >
            <input
              id={id}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(i)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="font-bold text-slate-700 mr-1">{String.fromCharCode(65 + i)}.</span>
              {opt.text || ''}
              {opt.imageUrl ? (
                <img src={resolveMediaUrl(opt.imageUrl)} alt="" className="max-h-32 mt-2 rounded-lg border border-slate-100" />
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
