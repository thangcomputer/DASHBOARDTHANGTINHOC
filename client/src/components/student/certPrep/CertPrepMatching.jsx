import CmsSelect from '../../ui/CmsSelect';
import { resolveMediaUrl } from '../../../services/api';

export default function CertPrepMatching({
  question,
  value,
  disabled,
  onChange,
  showFeedback = false,
  exam = false,
}) {
  const items = question.matchingItems || [];
  const targets = question.matchingTargets || [];
  const pairs = Array.isArray(value) ? value : [];
  const correctByItem = new Map(
    (question.matchingPairs || []).map((p) => [String(p.itemId), String(p.targetId)]),
  );
  const targetOf = (itemId) => {
    const hit = pairs.find((p) => String(p.itemId) === String(itemId));
    return hit?.targetId != null && hit.targetId !== '' ? String(hit.targetId) : '';
  };

  const setPair = (itemId, targetId) => {
    const rest = pairs.filter((p) => String(p.itemId) !== String(itemId));
    onChange(targetId ? [...rest, { itemId: String(itemId), targetId: String(targetId) }] : rest);
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const selectId = `cert-prep-${question.id}-item-${item.id}`;
        const chosen = targetOf(item.id);
        const correctTarget = correctByItem.get(String(item.id));
        const isOk = showFeedback && chosen && chosen === correctTarget;
        const isBad = showFeedback && chosen && chosen !== correctTarget;
        const cardCls = exam
          ? (isOk
            ? 'border-emerald-500/40 bg-emerald-500/15'
            : isBad
              ? 'border-red-500/40 bg-red-500/15'
              : 'border-white/10 bg-white/5')
          : (isOk
            ? 'border-emerald-400 bg-emerald-50'
            : isBad
              ? 'border-red-400 bg-red-50'
              : 'border-slate-200 bg-white');
        return (
          <div key={item.id} className={`rounded-2xl border p-4 space-y-2 ${cardCls}`}>
            <p className={`text-sm font-semibold ${exam ? 'text-slate-100' : 'text-slate-800'}`}>
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black mr-2 ${
                exam ? 'bg-white/10 text-slate-200' : 'bg-slate-900/5 text-slate-700'
              }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {item.text || ''}
            </p>
            {item.imageUrl ? (
              <img src={resolveMediaUrl(item.imageUrl)} alt="" className={`max-h-28 rounded-xl border ${exam ? 'border-white/10' : 'border-slate-100'}`} />
            ) : null}
            <label htmlFor={selectId} className={`block text-xs font-bold ${exam ? 'text-slate-400' : 'text-slate-500'}`}>
              Ghép với
            </label>
            <CmsSelect
              id={selectId}
              aria-label={`Ghép ${item.text || String.fromCharCode(65 + i)}`}
              disabled={disabled}
              value={chosen}
              onChange={(e) => setPair(item.id, e.target.value)}
            >
              <option value="">Chọn đáp án</option>
              {targets.map((t, ti) => (
                <option key={t.id} value={String(t.id)}>
                  {ti + 1}. {t.text || ''}
                </option>
              ))}
            </CmsSelect>
            {showFeedback && correctTarget ? (
              <p className={`text-xs font-semibold ${exam ? 'text-emerald-300' : 'text-emerald-800'}`}>
                Đáp án đúng: {targets.find((t) => String(t.id) === correctTarget)?.text || correctTarget}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
