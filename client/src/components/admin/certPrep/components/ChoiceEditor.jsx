import { Plus, Trash2 } from 'lucide-react';
import CertPrepImageUploader from '../CertPrepImageUploader';

export default function ChoiceEditor({ options, correctAnswer, onChange, disabled = false }) {
  const list = Array.isArray(options) ? options : [];

  const update = (idx, patch) => {
    onChange(list.map((o, i) => (i === idx ? { ...o, ...patch } : o)), correctAnswer);
  };

  const add = () => {
    onChange([...list, { text: '', imageUrl: '' }], correctAnswer);
  };

  const remove = (idx) => {
    const next = list.filter((_, i) => i !== idx);
    let nextCorrect = correctAnswer;
    if (idx === correctAnswer) nextCorrect = 0;
    else if (idx < correctAnswer) nextCorrect = Math.max(0, correctAnswer - 1);
    onChange(next, nextCorrect);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-600">Đáp án (chọn đúng 1)</p>
      {list.map((opt, idx) => (
        <div key={idx} className="rounded-xl border border-slate-100 p-3 space-y-2 bg-white">
          <div className="flex items-start gap-2">
            <label className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-700 shrink-0">
              <input
                type="radio"
                name="cert-prep-single-correct"
                checked={Number(correctAnswer) === idx}
                onChange={() => onChange(list, idx)}
                disabled={disabled}
                aria-label={`Đánh dấu đáp án ${String.fromCharCode(65 + idx)} là đúng`}
              />
              {String.fromCharCode(65 + idx)}.
            </label>
            <input
              type="text"
              value={opt.text || ''}
              disabled={disabled}
              onChange={(e) => update(idx, { text: e.target.value })}
              placeholder="Nội dung đáp án"
              aria-label={`Đáp án ${String.fromCharCode(65 + idx)}`}
              className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm font-medium"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              disabled={disabled || list.length <= 2}
              aria-label={`Xóa đáp án ${String.fromCharCode(65 + idx)}`}
              className="w-10 h-10 rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <CertPrepImageUploader
            label={`Hình đáp án ${String.fromCharCode(65 + idx)}`}
            value={opt.imageUrl || ''}
            disabled={disabled}
            onChange={(url) => update(idx, { imageUrl: url })}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="min-h-10 px-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-2"
      >
        <Plus size={14} aria-hidden="true" /> Thêm đáp án
      </button>
    </div>
  );
}
