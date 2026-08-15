import { Plus, Trash2 } from 'lucide-react';

function nextId(prefix, list) {
  let n = list.length + 1;
  const ids = new Set(list.map((x) => x.id));
  while (ids.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export default function TrueFalseGridEditor({
  statements,
  onChange,
  disabled = false,
}) {
  const rows = Array.isArray(statements) && statements.length
    ? statements
    : [{ id: 's1', text: '', correct: true }];

  const emit = (next) => onChange(next);

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-600">
        Nhận định Đúng / Sai (học viên chọn Yes/No cho từng dòng)
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Nhận định</th>
              <th className="px-3 py-2 w-28 text-center">Đáp án</th>
              <th className="px-3 py-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-xs font-black text-slate-500">{idx + 1}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.text || ''}
                    disabled={disabled}
                    aria-label={`Nhận định ${idx + 1}`}
                    placeholder="Nội dung nhận định…"
                    onChange={(e) => emit(rows.map((x) => (
                      x.id === row.id ? { ...x, text: e.target.value } : x
                    )))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-3">
                    <label className="inline-flex items-center gap-1 text-xs font-bold">
                      <input
                        type="radio"
                        name={`tf-correct-${row.id}`}
                        checked={row.correct === true}
                        disabled={disabled}
                        onChange={() => emit(rows.map((x) => (
                          x.id === row.id ? { ...x, correct: true } : x
                        )))}
                      />
                      Đúng
                    </label>
                    <label className="inline-flex items-center gap-1 text-xs font-bold">
                      <input
                        type="radio"
                        name={`tf-correct-${row.id}`}
                        checked={row.correct === false}
                        disabled={disabled}
                        onChange={() => emit(rows.map((x) => (
                          x.id === row.id ? { ...x, correct: false } : x
                        )))}
                      />
                      Sai
                    </label>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={disabled || rows.length <= 1}
                    aria-label={`Xóa nhận định ${idx + 1}`}
                    onClick={() => emit(rows.filter((x) => x.id !== row.id))}
                    className="w-9 h-9 rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => emit([...rows, { id: nextId('s', rows), text: '', correct: true }])}
        className="min-h-10 px-3 rounded-xl text-sm font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5"
      >
        <Plus size={16} />
        Thêm nhận định
      </button>
    </div>
  );
}
