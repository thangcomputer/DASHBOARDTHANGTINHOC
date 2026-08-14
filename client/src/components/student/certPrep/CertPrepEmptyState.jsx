export default function CertPrepEmptyState({ title, hint }) {
  return (
    <div className="cms-card text-center py-12 px-4">
      <p className="text-base font-bold text-slate-800">{title}</p>
      {hint ? <p className="text-sm text-slate-500 mt-2">{hint}</p> : null}
    </div>
  );
}
