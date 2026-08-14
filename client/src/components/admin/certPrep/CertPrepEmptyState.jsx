import { Plus } from 'lucide-react';

export default function CertPrepEmptyState({ title, hint, actionLabel, onAction }) {
  return (
    <div className="cms-card text-center py-12 px-4">
      <p className="text-base font-bold text-slate-800">{title}</p>
      {hint ? <p className="text-sm text-slate-500 mt-2">{hint}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md"
        >
          <Plus size={15} aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
