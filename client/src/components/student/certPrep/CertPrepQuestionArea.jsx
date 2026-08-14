import { useState } from 'react';
import { resolveMediaUrl } from '../../../services/api';
import CertPrepSingleChoice from './CertPrepSingleChoice';
import CertPrepMultipleChoice from './CertPrepMultipleChoice';
import CertPrepMatching from './CertPrepMatching';

export default function CertPrepQuestionArea({
  question,
  index,
  total,
  value,
  disabled,
  onChange,
}) {
  const [showHint, setShowHint] = useState(false);
  if (!question) return null;
  const hasHint = Boolean(question.hint || question.hintImage);

  return (
    <div className="space-y-4">
      <p className="text-sm font-black uppercase tracking-wide text-slate-500">
        Câu {index + 1} / {total}
      </p>
      <p className="text-base font-semibold text-slate-900 whitespace-pre-wrap">{question.questionText}</p>
      {question.questionImage ? (
        <img
          src={resolveMediaUrl(question.questionImage)}
          alt="Hình minh họa câu hỏi"
          className="max-h-64 rounded-xl border border-slate-100"
        />
      ) : null}

      {question.type === 'single_choice' ? (
        <CertPrepSingleChoice question={question} value={value} disabled={disabled} onChange={onChange} />
      ) : null}
      {question.type === 'multiple_choice' ? (
        <CertPrepMultipleChoice question={question} value={value} disabled={disabled} onChange={onChange} />
      ) : null}
      {question.type === 'matching' ? (
        <CertPrepMatching question={question} value={value} disabled={disabled} onChange={onChange} />
      ) : null}

      {hasHint ? (
        <div>
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            className="min-h-11 px-3 rounded-xl text-sm font-bold text-amber-800 bg-amber-50 border border-amber-100"
          >
            {showHint ? 'Ẩn gợi ý' : 'Gợi ý'}
          </button>
          {showHint ? (
            <div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-slate-800">
              {question.hint ? <p className="whitespace-pre-wrap">{question.hint}</p> : null}
              {question.hintImage ? (
                <img src={resolveMediaUrl(question.hintImage)} alt="Hình gợi ý" className="max-h-40 mt-2 rounded-lg" />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
