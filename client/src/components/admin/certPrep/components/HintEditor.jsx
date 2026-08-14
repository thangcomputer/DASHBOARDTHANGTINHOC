import CertPrepImageUploader from '../CertPrepImageUploader';

export default function HintEditor({
  hint,
  hintImage,
  explanation,
  explanationImage,
  onChange,
  disabled = false,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Gợi ý (không bắt buộc)</span>
          <textarea
            value={hint || ''}
            disabled={disabled}
            rows={4}
            onChange={(e) => onChange({ hint: e.target.value, hintImage, explanation, explanationImage })}
            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <CertPrepImageUploader
          label="Hình gợi ý"
          value={hintImage || ''}
          disabled={disabled}
          onChange={(url) => onChange({ hint, hintImage: url, explanation, explanationImage })}
        />
      </div>
      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Giải thích đáp án (không bắt buộc)</span>
          <textarea
            value={explanation || ''}
            disabled={disabled}
            rows={4}
            onChange={(e) => onChange({ hint, hintImage, explanation: e.target.value, explanationImage })}
            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <CertPrepImageUploader
          label="Hình giải thích"
          value={explanationImage || ''}
          disabled={disabled}
          onChange={(url) => onChange({ hint, hintImage, explanation, explanationImage: url })}
        />
      </div>
    </div>
  );
}
