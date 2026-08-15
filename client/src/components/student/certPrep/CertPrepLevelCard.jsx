import { resolveMediaUrl } from '../../../services/api';

export default function CertPrepLevelCard({ level, onOpen }) {
  const logo = level?.logoUrl ? resolveMediaUrl(level.logoUrl) : '';
  return (
    <article className="cert-prep-card h-full">
      <div className="cert-prep-card__inner">
        <div className="w-full aspect-[16/9] bg-white border-b border-slate-100 flex items-center justify-center overflow-hidden">
          {logo ? (
            <img src={logo} alt="" className="w-full h-full object-cover object-center" />
          ) : (
            <span className="text-sm font-bold text-slate-300">Level</span>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4 flex-1 min-h-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">{level.title}</h3>
            {level.subtitle ? <p className="text-sm text-slate-500 mt-1">{level.subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => onOpen(level)}
            className="mt-auto min-h-11 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold w-full"
          >
            Xem Level
          </button>
        </div>
      </div>
    </article>
  );
}
