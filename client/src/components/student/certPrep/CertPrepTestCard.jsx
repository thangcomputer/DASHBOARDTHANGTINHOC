import { localeLabel } from './certPrepStudentLabels';

export default function CertPrepTestCard({ test, onOpen }) {
  const en = test.locale === 'en';
  return (
    <article className="cms-card flex flex-col gap-3">
      <div>
        <h3 className="text-base font-bold text-slate-900">{test.name}</h3>
        <p className="text-sm text-slate-500 mt-1">{localeLabel(test.locale)}</p>
        <ul className="mt-2 text-sm text-slate-600 space-y-0.5">
          <li>{test.questionCount} {en ? 'questions' : 'câu'}</li>
          <li>{test.timeLimitMinutes} {en ? 'minutes' : 'phút'}</li>
          <li>{en ? 'Passing score' : 'Điểm đạt'}: {test.passingScore}</li>
        </ul>
      </div>
      <button
        type="button"
        onClick={() => onOpen(test)}
        className="min-h-11 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold"
      >
        {en ? 'View details' : 'Xem chi tiết'}
      </button>
    </article>
  );
}
