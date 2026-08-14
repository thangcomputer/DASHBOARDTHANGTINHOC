import { Plus, Trash2 } from 'lucide-react';
import CertPrepImageUploader from '../CertPrepImageUploader';

export default function MultipleChoiceEditor({
  options,
  correctIndices,
  minSelect,
  onChange,
  disabled = false,
}) {
  const list = Array.isArray(options) ? options : [];
  const correct = Array.isArray(correctIndices) ? correctIndices : [];

  const toggleCorrect = (idx) => {
    const set = new Set(correct);
    if (set.has(idx)) set.delete(idx);
    else set.add(idx);
    onChange({ options: list, correctIndices: [...set].sort((a, b) => a - b), minSelect });
  };

  const update = (idx, patch) => {
    onChange({
      options: list.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
      correctIndices: correct,
      minSelect,
    });
  };

  const add = () => {
    onChange({ options: [...list, { text: '', imageUrl: '' }], correctIndices: correct, minSelect });
  };

  const remove = (idx) => {
    const nextOpts = list.filter((_, i) => i !== idx);
    const nextCorrect = correct
      .filter((i) => i !== idx)
      .map((i) => (i > idx ? i - 1 : i));
    onChange({ options: nextOpts, correctIndices: nextCorrect, minSelect });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-600">Đáp án (chọn một hoặc nhiều đáp án đúng)</p>
      {list.map((opt, idx) => (
        <div key={idx} className="rounded-xl border border-slate-100 p-3 space-y-2 bg-white">
          <div className="flex items-start gap-2">
            <label className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-700 shrink-0">
              <input
                type="checkbox"
                checked={correct.includes(idx)}
                onChange={() => toggleCorrect(idx)}
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
      <label className="block space-y-1 max-w-xs">
        <span className="text-xs font-bold text-slate-600">Số đáp án tối thiểu phải chọn</span>
        <input
          type="number"
          min={1}
          value={minSelect ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({
            options: list,
            correctIndices: correct,
            minSelect: e.target.value === '' ? null : Number(e.target.value),
          })}
          className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm font-medium"
        />
      </label>
    </div>
  );
}
