import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { attemptsExhausted, localeLabel } from './certPrepStudentLabels';

export default function CertPrepTestCard({
  test,
  expired = false,
  starting = false,
  startingTestId = '',
  onStart,
  onContinue,
}) {
  const en = test.locale === 'en';
  const [immediate, setImmediate] = useState(true);
  const exhausted = attemptsExhausted(test);
  const activeId = test.activeSessionId || null;
  const busy = Boolean(starting) && String(startingTestId) === String(test.id);
  const blocked = expired || exhausted;

  const handleStart = () => {
    if (blocked || busy || activeId || typeof onStart !== 'function') return;
    onStart(test, { feedbackMode: immediate ? 'immediate' : 'after_submit' });
  };

  const handleContinue = () => {
    if (blocked || busy || !activeId || typeof onContinue !== 'function') return;
    onContinue(test, activeId);
  };

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

      {!activeId && !blocked ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">
              {en ? 'Show correct/incorrect while answering' : 'Hiện đáp án đúng / sai khi làm bài'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              {immediate
                ? (en ? 'Reveal after each answer.' : 'Xem đúng/sai ngay sau mỗi câu.')
                : (en ? 'Only after submit.' : 'Chỉ xem sau khi nộp bài.')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={immediate}
            aria-label={en ? 'Show answers while answering' : 'Hiện đáp án đúng sai khi làm bài'}
            disabled={busy}
            onClick={() => setImmediate((v) => !v)}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
              immediate ? 'bg-red-600' : 'bg-slate-300'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                immediate ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      ) : null}

      {activeId && !blocked ? (
        <p className="text-xs font-semibold text-emerald-700">
          {en ? 'You have an unfinished attempt.' : 'Bạn còn bài đang làm dở.'}
        </p>
      ) : null}
      {expired ? (
        <p className="text-xs font-bold text-red-600">{en ? 'Access expired.' : 'Quyền truy cập đã hết hạn.'}</p>
      ) : null}
      {exhausted ? (
        <p className="text-xs font-bold text-amber-700">{en ? 'No attempts left.' : 'Bạn đã hết số lần làm bài.'}</p>
      ) : null}

      <div className="mt-auto">
        {activeId && !blocked ? (
          <button
            type="button"
            onClick={handleContinue}
            disabled={busy}
            className="w-full min-h-11 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {en ? 'Continue' : 'Tiếp tục'}
          </button>
        ) : !blocked ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={busy}
            className="w-full min-h-11 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {en ? 'Start practice' : 'Bắt đầu làm bài'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
