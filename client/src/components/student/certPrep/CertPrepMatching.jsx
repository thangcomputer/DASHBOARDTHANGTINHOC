import CmsSelect from '../../ui/CmsSelect';
import { resolveMediaUrl } from '../../../services/api';

export default function CertPrepMatching({ question, value, disabled, onChange }) {
  const items = question.matchingItems || [];
  const targets = question.matchingTargets || [];
  const pairs = Array.isArray(value) ? value : [];
  const targetOf = (itemId) => pairs.find((p) => p.itemId === itemId)?.targetId || '';

  const setPair = (itemId, targetId) => {
    const rest = pairs.filter((p) => p.itemId !== itemId);
    onChange(targetId ? [...rest, { itemId, targetId }] : rest);
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const selectId = `cert-prep-${question.id}-item-${item.id}`;
        return (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              <span className="font-black text-slate-500 mr-1">{String.fromCharCode(65 + i)}.</span>
              {item.text || ''}
            </p>
            {item.imageUrl ? (
              <img src={resolveMediaUrl(item.imageUrl)} alt="" className="max-h-28 rounded-lg border border-slate-100" />
            ) : null}
            <label htmlFor={selectId} className="block text-xs font-bold text-slate-500">
              Ghép với
            </label>
            <CmsSelect
              id={selectId}
              aria-label={`Ghép ${item.text || String.fromCharCode(65 + i)}`}
              disabled={disabled}
              value={targetOf(item.id)}
              onChange={(e) => setPair(item.id, e.target.value)}
            >
              <option value="">Chọn đáp án</option>
              {targets.map((t, ti) => (
                <option key={t.id} value={t.id}>
                  {ti + 1}. {t.text || ''}
                </option>
              ))}
            </CmsSelect>
          </div>
        );
      })}
    </div>
  );
}
