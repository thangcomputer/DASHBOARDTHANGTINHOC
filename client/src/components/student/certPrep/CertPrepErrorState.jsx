export default function CertPrepErrorState({ message, onRetry }) {
  return (
    <div className="cms-card text-center py-12 px-4 space-y-4" role="alert">
      <p className="text-base font-bold text-slate-800">{message || 'Không thể tải dữ liệu. Vui lòng thử lại.'}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center justify-center px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
        >
          Thử lại
        </button>
      ) : null}
    </div>
  );
}
