import { Plus, Trash2 } from 'lucide-react';
import CmsSelect from '../../../ui/CmsSelect';
import CertPrepImageUploader from '../CertPrepImageUploader';

function nextId(prefix, list) {
  let n = list.length + 1;
  const ids = new Set(list.map((x) => x.id));
  while (ids.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export default function MatchingEditor({
  matchingItems,
  matchingTargets,
  matchingPairs,
  onChange,
  disabled = false,
}) {
  const items = Array.isArray(matchingItems) ? matchingItems : [];
  const targets = Array.isArray(matchingTargets) ? matchingTargets : [];
  const pairs = Array.isArray(matchingPairs) ? matchingPairs : [];

  const pairForItem = (itemId) => pairs.find((p) => p.itemId === itemId)?.targetId || '';

  const emit = (nextItems, nextTargets, nextPairs) => {
    onChange({
      matchingItems: nextItems,
      matchingTargets: nextTargets,
      matchingPairs: nextPairs,
    });
  };

  const setPair = (itemId, targetId) => {
    const rest = pairs.filter((p) => p.itemId !== itemId);
    if (!targetId) emit(items, targets, rest);
    else emit(items, targets, [...rest, { itemId, targetId }]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-600">Cột A</p>
          {items.map((item, idx) => (
            <div key={item.id} className="rounded-xl border border-slate-100 p-3 space-y-2">
              <div className="flex gap-2">
                <span className="mt-2 text-xs font-black text-slate-500 w-6">{String.fromCharCode(65 + idx)}</span>
                <input
                  type="text"
                  value={item.text || ''}
                  disabled={disabled}
                  aria-label={`Cột A mục ${String.fromCharCode(65 + idx)}`}
                  onChange={(e) => emit(
                    items.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x)),
                    targets,
                    pairs,
                  )}
                  className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Xóa mục ${String.fromCharCode(65 + idx)}`}
                  onClick={() => emit(
                    items.filter((x) => x.id !== item.id),
                    targets,
                    pairs.filter((p) => p.itemId !== item.id),
                  )}
                  className="w-10 h-10 rounded-xl text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <CertPrepImageUploader
                label={`Hình cột A ${String.fromCharCode(65 + idx)}`}
                value={item.imageUrl || ''}
                disabled={disabled}
                onChange={(url) => emit(
                  items.map((x) => (x.id === item.id ? { ...x, imageUrl: url } : x)),
                  targets,
                  pairs,
                )}
              />
            </div>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => emit([...items, { id: nextId('i', items), text: '', imageUrl: '' }], targets, pairs)}
            className="min-h-10 px-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-2"
          >
            <Plus size={14} aria-hidden="true" /> Thêm mục cột A
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-600">Cột B</p>
          {targets.map((target, idx) => (
            <div key={target.id} className="rounded-xl border border-slate-100 p-3 space-y-2">
              <div className="flex gap-2">
                <span className="mt-2 text-xs font-black text-slate-500 w-6">{idx + 1}</span>
                <input
                  type="text"
                  value={target.text || ''}
                  disabled={disabled}
                  aria-label={`Cột B mục ${idx + 1}`}
                  onChange={(e) => emit(
                    items,
                    targets.map((x) => (x.id === target.id ? { ...x, text: e.target.value } : x)),
                    pairs,
                  )}
                  className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Xóa mục cột B ${idx + 1}`}
                  onClick={() => emit(
                    items,
                    targets.filter((x) => x.id !== target.id),
                    pairs.filter((p) => p.targetId !== target.id),
                  )}
                  className="w-10 h-10 rounded-xl text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <CertPrepImageUploader
                label={`Hình cột B ${idx + 1}`}
                value={target.imageUrl || ''}
                disabled={disabled}
                onChange={(url) => emit(
                  items,
                  targets.map((x) => (x.id === target.id ? { ...x, imageUrl: url } : x)),
                  pairs,
                )}
              />
            </div>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => emit(items, [...targets, { id: nextId('t', targets), text: '', imageUrl: '' }], pairs)}
            className="min-h-10 px-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-2"
          >
            <Plus size={14} aria-hidden="true" /> Thêm mục cột B
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-600">Ghép cặp đúng</p>
        {items.map((item, idx) => (
          <label key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-semibold text-slate-700 min-w-[8rem]">
              {String.fromCharCode(65 + idx)}. {item.text || '(trống)'}
            </span>
            <span className="text-slate-400 hidden sm:inline" aria-hidden="true">→</span>
            <CmsSelect
              value={pairForItem(item.id)}
              disabled={disabled}
              aria-label={`Ghép ${String.fromCharCode(65 + idx)} với cột B`}
              onChange={(e) => setPair(item.id, e.target.value)}
            >
              <option value="">Chọn cột B</option>
              {targets.map((t, tIdx) => (
                <option key={t.id} value={t.id}>{tIdx + 1}. {t.text || '(trống)'}</option>
              ))}
            </CmsSelect>
          </label>
        ))}
      </div>
    </div>
  );
}
