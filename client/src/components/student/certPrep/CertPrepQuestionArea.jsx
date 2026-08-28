import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { resolveMediaUrl } from '../../../services/api';
import { gradeCertPrepQuestion } from '../../../utils/certPrepGrade';
import CertPrepSingleChoice from './CertPrepSingleChoice';
import CertPrepMultipleChoice from './CertPrepMultipleChoice';
import CertPrepMatching from './CertPrepMatching';
import CertPrepTrueFalseGrid from './CertPrepTrueFalseGrid';

export default function CertPrepQuestionArea({
  question,
  index,
  total,
  value,
  disabled,
  onChange,
  showFeedback = false,
}) {
  const [showHint, setShowHint] = useState(false);
  if (!question) return null;
  const hasHint = Boolean(question.hint || question.hintImage);
  const isCorrect = showFeedback ? gradeCertPrepQuestion(question, value) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          Câu {index + 1} / {total}
        </span>
        {showFeedback ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
              isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
            }`}
          >
            {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {isCorrect ? 'Đúng' : 'Sai'}
          </span>
        ) : null}
      </div>

      <p className="text-[16px] font-bold text-slate-900 leading-snug whitespace-pre-wrap">
        {question.questionText}
      </p>
      {question.questionImage ? (
        <img
          src={resolveMediaUrl(question.questionImage)}
          alt="Hình minh họa câu hỏi"
          className="block w-full h-auto max-w-full rounded-2xl border border-slate-100 bg-slate-50"
        />
      ) : null}

      {question.type === 'single_choice' ? (
        <CertPrepSingleChoice
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          showFeedback={showFeedback}
        />
      ) : null}
      {question.type === 'multiple_choice' ? (
        <CertPrepMultipleChoice
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          showFeedback={showFeedback}
        />
      ) : null}
      {question.type === 'matching' ? (
        <CertPrepMatching
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          showFeedback={showFeedback}
        />
      ) : null}
      {question.type === 'true_false_grid' ? (
        <CertPrepTrueFalseGrid
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          showFeedback={showFeedback}
        />
      ) : null}

      {showFeedback && (question.explanation || question.explanationImage) ? (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-indigo-950">
          <p className="text-[11px] font-black uppercase tracking-wide text-indigo-600 mb-1">Giải thích</p>
          {question.explanation ? <p className="whitespace-pre-wrap font-medium">{question.explanation}</p> : null}
          {question.explanationImage ? (
            <img src={resolveMediaUrl(question.explanationImage)} alt="Hình giải thích" className="max-h-40 mt-2 rounded-xl" />
          ) : null}
        </div>
      ) : null}

      {hasHint ? (
        <div>
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            className="min-h-10 px-3.5 rounded-xl text-sm font-bold text-amber-900 bg-amber-50 border border-amber-200"
          >
            {showHint ? 'Ẩn gợi ý' : 'Gợi ý'}
          </button>
          {showHint ? (
            <div className="mt-2 rounded-2xl bg-amber-50 border border-amber-100 p-3.5 text-sm text-slate-800">
              {question.hint ? <p className="whitespace-pre-wrap">{question.hint}</p> : null}
              {question.hintImage ? (
                <img src={resolveMediaUrl(question.hintImage)} alt="Hình gợi ý" className="max-h-40 mt-2 rounded-xl" />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
