export default function CertPrepSessionExpired({ message, exam = false }) {
  return (
    <div
      className={`text-center py-16 px-4 space-y-3 max-w-md ${
        exam ? 'rounded-2xl border border-white/10 bg-white/5' : 'cms-card'
      }`}
      role="status"
    >
      <h2 className={`text-lg font-bold ${exam ? 'text-slate-100' : 'text-slate-900'}`}>
        Phiên làm bài đã kết thúc.
      </h2>
      {message ? <p className={`text-sm ${exam ? 'text-slate-400' : 'text-slate-500'}`}>{message}</p> : null}
    </div>
  );
}
