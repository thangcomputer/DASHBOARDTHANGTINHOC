export default function CertPrepResultStats({ result }) {
  if (!result) return null;
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
      <li className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
        <p className="text-lg font-black text-slate-900">{result.totalQuestions}</p>
        <p className="text-xs font-bold text-slate-500">Tổng số câu</p>
      </li>
      <li className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
        <p className="text-lg font-black text-slate-900">{result.answeredCount}</p>
        <p className="text-xs font-bold text-slate-500">Đã trả lời</p>
      </li>
      <li className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
        <p className="text-lg font-black text-emerald-700">{result.correctCount}</p>
        <p className="text-xs font-bold text-slate-500">Đúng</p>
      </li>
      <li className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
        <p className="text-lg font-black text-red-600">{result.incorrectCount}</p>
        <p className="text-xs font-bold text-slate-500">Sai</p>
      </li>
      <li className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
        <p className="text-lg font-black text-slate-700">{result.unansweredCount}</p>
        <p className="text-xs font-bold text-slate-500">Chưa trả lời</p>
      </li>
    </ul>
  );
}
