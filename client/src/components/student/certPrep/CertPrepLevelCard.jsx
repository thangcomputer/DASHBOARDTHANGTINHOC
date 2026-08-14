import { resolveMediaUrl } from '../../../services/api';

export default function CertPrepLevelCard({ level, onOpen }) {
  const logo = level?.logoUrl ? resolveMediaUrl(level.logoUrl) : '';
  return (
    <article className="cms-card flex flex-col gap-3 h-full">
      {logo ? (
        <img src={logo} alt="" className="h-12 w-12 object-contain rounded-xl bg-slate-50" />
      ) : null}
      <div>
        <h3 className="text-base font-bold text-slate-900">{level.title}</h3>
        {level.subtitle ? <p className="text-sm text-slate-500 mt-1">{level.subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onOpen(level)}
        className="mt-auto min-h-11 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
      >
        Xem Level
      </button>
    </article>
  );
}
