function targetLabel(question, targetId) {
  const targets = question.matchingTargets || [];
  const idx = targets.findIndex((t) => String(t.id) === String(targetId));
  if (idx < 0) return '(chưa ghép)';
  return `${idx + 1}. ${targets[idx].text || ''}`;
}

function pairMap(pairs) {
  const map = new Map();
  for (const p of Array.isArray(pairs) ? pairs : []) {
    if (p?.itemId) map.set(String(p.itemId), p.targetId);
  }
  return map;
}

export default function CertPrepReviewMatching({ question }) {
  const student = pairMap(question.studentAnswer);
  const correct = pairMap(question.matchingPairs);
  const items = question.matchingItems || [];
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Bạn chọn</p>
        {items.map((item, i) => (
          <p key={`s-${item.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 mb-2">
            {String.fromCharCode(65 + i)}. {item.text || ''} → {targetLabel(question, student.get(String(item.id)))}
          </p>
        ))}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-emerald-700 mb-2">Đáp án đúng</p>
        {items.map((item, i) => (
          <p key={`c-${item.id}`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 mb-2">
            {String.fromCharCode(65 + i)}. {item.text || ''} → {targetLabel(question, correct.get(String(item.id)))}
          </p>
        ))}
      </div>
    </div>
  );
}
