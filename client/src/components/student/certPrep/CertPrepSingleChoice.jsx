import { resolveMediaUrl } from '../../../services/api';

export default function CertPrepSingleChoice({ question, value, disabled, onChange }) {
  const selected = value === '' || value == null ? null : Number(value);
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">Chọn một đáp án</legend>
      {(question.options || []).map((opt, i) => {
        const id = `cert-prep-${question.id}-opt-${i}`;
        return (
          <label
            key={id}
            htmlFor={id}
            className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm cursor-pointer ${
              selected === i ? 'border-red-600 bg-red-50' : 'border-slate-200 bg-white'
            } ${disabled ? 'opacity-70 cursor-not-allowed' : 'hover:border-slate-300'}`}
          >
            <input
              id={id}
              type="radio"
              name={`cert-prep-q-${question.id}`}
              checked={selected === i}
              disabled={disabled}
              onChange={() => onChange(i)}
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
