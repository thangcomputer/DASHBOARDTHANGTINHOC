import CertPrepAccessState from './CertPrepAccessState';
import { attemptsExhausted, attemptsLabel, localeLabel } from './certPrepStudentLabels';

export default function CertPrepTestDetail({
  test,
  courseName,
  levelTitle,
  expiresAt,
  expired,
  starting,
  onStart,
}) {
  if (!test) return null;
  const exhausted = attemptsExhausted(test);
  const canStart = !expired && !exhausted && !starting;
  return (
    <div className="cms-card space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {[courseName, levelTitle].filter(Boolean).join(' — ')}
        </p>
        <h3 className="text-lg font-black text-slate-900 mt-1">{test.name}</h3>
        <p className="text-sm font-semibold text-slate-600 mt-1">{localeLabel(test.locale)}</p>
      </div>
      <ul className="text-sm text-slate-700 space-y-1">
        <li>{test.questionCount} câu</li>
        <li>{test.timeLimitMinutes} phút</li>
        <li>Điểm đạt: {test.passingScore}</li>
      </ul>
      <p className="text-sm font-semibold text-slate-700">{attemptsLabel(test)}</p>
      <CertPrepAccessState expiresAt={expiresAt} />
      {expired ? (
        <p className="text-sm font-bold text-red-600">Quyền truy cập đã hết hạn.</p>
      ) : null}
      {exhausted ? (
        <p className="text-sm font-bold text-amber-700">Bạn đã hết số lần làm bài cho phép.</p>
      ) : null}
      {canStart ? (
        <button
          type="button"
          disabled={starting}
          onClick={onStart}
          className="min-h-11 px-5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-black disabled:opacity-60"
        >
          {starting ? 'Đang bắt đầu...' : 'Bắt đầu làm bài'}
        </button>
      ) : null}
    </div>
  );
}
