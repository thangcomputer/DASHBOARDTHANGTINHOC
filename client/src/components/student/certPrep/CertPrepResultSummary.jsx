import { formatDateTime, formatDuration, localeLabel } from './certPrepStudentLabels';
import CertPrepResultStats from './CertPrepResultStats';

export default function CertPrepResultSummary({ result }) {
  if (!result) return null;
  const passed = result.passed === true;
  const title = [result.course?.name, result.level?.title].filter(Boolean).join(' — ');
  return (
    <section className="cms-card p-5 sm:p-8 text-center space-y-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Kết quả bài thi</p>
      <div>
        {title ? <p className="text-sm font-bold text-slate-500">{title}</p> : null}
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">{result.test?.name || 'Bài kiểm tra'}</h2>
        <p className="text-sm font-semibold text-slate-500 mt-1">{localeLabel(result.locale)}</p>
      </div>
      <p className="text-4xl sm:text-5xl font-black tabular-nums text-slate-900">
        {result.score} <span className="text-2xl text-slate-400">/ {result.scoreMax}</span>
      </p>
      <p className={`text-lg font-black ${passed ? 'text-emerald-700' : 'text-red-600'}`}>
        {passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
      </p>
      <p className="text-sm text-slate-600">
        Điểm đạt: <span className="font-bold">{result.passingScore}</span>
        {' · '}
        Điểm của bạn: <span className="font-bold">{result.score}</span>
      </p>
      <CertPrepResultStats result={result} />
      <div className="text-sm text-slate-600 space-y-1 pt-2">
        <p>Bắt đầu: {formatDateTime(result.startedAt) || '—'}</p>
        <p>Nộp bài: {formatDateTime(result.submittedAt) || '—'}</p>
        <p>Thời gian làm: {formatDuration(result.durationSeconds)}</p>
        <p>Thời gian giới hạn: {result.timeLimitMinutes} phút</p>
      </div>
    </section>
  );
}
