export default function CertPrepPlayerPlaceholder({ title, hint }) {
  return (
    <div className="cms-card text-center py-16 px-4 space-y-3">
      <h2 className="text-lg font-bold text-slate-900">{title || 'Bạn đã nộp bài thành công.'}</h2>
      {hint ? <p className="text-sm text-slate-500">{hint}</p> : (
        <p className="text-sm text-slate-500">Đang chuyển đến kết quả...</p>
      )}
    </div>
  );
}
