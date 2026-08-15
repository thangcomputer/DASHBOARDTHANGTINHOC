export default function CertPrepReviewTrueFalseGrid({ question }) {
  const statements = question.statements || [];
  const student = new Map(
    (Array.isArray(question.studentAnswer) ? question.studentAnswer : [])
      .map((row) => [String(row?.id), row?.value]),
  );

  const label = (v) => {
    if (typeof v !== 'boolean') return '—';
    return v ? 'Yes' : 'No';
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[360px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 text-left">Nhận định</th>
            <th className="px-3 py-2 text-center w-24">Bạn chọn</th>
            <th className="px-3 py-2 text-center w-24">Đáp án</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((row, idx) => {
            const chosen = student.get(String(row.id));
            const correct = Boolean(row.correct);
            const ok = typeof chosen === 'boolean' && chosen === correct;
            return (
              <tr
                key={row.id}
                className={`border-t border-slate-100 ${
                  typeof chosen !== 'boolean'
                    ? 'bg-slate-50'
                    : ok
                      ? 'bg-emerald-50'
                      : 'bg-red-50'
                }`}
              >
                <td className="px-3 py-2 font-medium text-slate-800 whitespace-pre-wrap">
                  {idx + 1}. {row.text || ''}
                </td>
                <td className={`px-3 py-2 text-center font-bold ${ok ? 'text-emerald-800' : 'text-red-700'}`}>
                  {label(chosen)}
                </td>
                <td className="px-3 py-2 text-center font-bold text-emerald-800">
                  {label(correct)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
