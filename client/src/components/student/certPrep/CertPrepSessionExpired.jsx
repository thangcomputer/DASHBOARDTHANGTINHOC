export default function CertPrepSessionExpired({ message }) {
  return (
    <div className="cms-card text-center py-16 px-4 space-y-3" role="status">
      <h2 className="text-lg font-bold text-slate-900">Phiên làm bài đã kết thúc.</h2>
      {message ? <p className="text-sm text-slate-500">{message}</p> : null}
    </div>
  );
}
