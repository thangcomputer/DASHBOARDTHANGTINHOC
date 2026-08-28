export default function CertPrepTrueFalseGrid({
  question,
  value,
  disabled,
  onChange,
  showFeedback = false,
}) {
  const statements = question.statements || [];
  const answers = Array.isArray(value) ? value : [];
  const byId = new Map(answers.map((row) => [String(row.id), row.value]));

  const setValue = (id, nextVal) => {
    const rest = answers.filter((row) => String(row.id) !== String(id));
    onChange([...rest, { id: String(id), value: nextVal }]);
  };

  const pillClass = (active, kind) => {
    if (active && kind === 'yes') return 'bg-slate-900 text-white border-slate-900';
    if (active && kind === 'no') return 'bg-slate-700 text-white border-slate-700';
    return 'bg-white text-slate-600 border-slate-200 hover:border-slate-300';
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[360px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 text-left">Nhận định</th>
            <th className="px-3 py-3 text-center w-[88px]">Yes</th>
            <th className="px-3 py-3 text-center w-[88px]">No</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((row, idx) => {
            const chosen = byId.has(String(row.id)) ? byId.get(String(row.id)) : null;
            const correct = typeof row.correct === 'boolean' ? row.correct : null;
            const isOk = showFeedback && chosen === correct && typeof chosen === 'boolean';
            const isBad = showFeedback && typeof chosen === 'boolean' && chosen !== correct;
            const rowCls = isOk
              ? 'bg-emerald-50'
              : isBad
                ? 'bg-red-50'
                : idx % 2 === 0
                  ? 'bg-white'
                  : 'bg-slate-50/60';
            return (
              <tr key={row.id} className={`border-t border-slate-100 ${rowCls}`}>
                <td className="px-4 py-3 font-medium text-slate-800 whitespace-pre-wrap">
                  <span className="text-xs font-black text-slate-400 mr-2">{idx + 1}.</span>
                  {row.text || ''}
                  {showFeedback && typeof correct === 'boolean' ? (
                    <span className="block mt-1 text-xs font-semibold text-emerald-800">
                      Đáp án: {correct ? 'Yes' : 'No'}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-3 text-center">
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={chosen === true}
                    aria-label={`Yes — nhận định ${idx + 1}`}
                    onClick={() => setValue(row.id, true)}
                    className={`min-h-9 min-w-[3.25rem] px-3 rounded-lg text-xs font-black border transition disabled:opacity-50 ${pillClass(chosen === true, 'yes')}`}
                  >
                    Yes
                  </button>
                </td>
                <td className="px-2 py-3 text-center">
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={chosen === false}
                    aria-label={`No — nhận định ${idx + 1}`}
                    onClick={() => setValue(row.id, false)}
                    className={`min-h-9 min-w-[3.25rem] px-3 rounded-lg text-xs font-black border transition disabled:opacity-50 ${pillClass(chosen === false, 'no')}`}
                  >
                    No
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
