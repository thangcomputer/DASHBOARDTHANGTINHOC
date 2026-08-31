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
  exam = false,
}) {
  const [showHint, setShowHint] = useState(false);
  if (!question) return null;
  const hasHint = Boolean(question.hint || question.hintImage);
  const isCorrect = showFeedback ? gradeCertPrepQuestion(question, value) : null;

  return (
    <div className="space-y-5">
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${exam ? 'border-white/10' : 'border-slate-100'}`}>
        <span className={`text-[11px] font-black uppercase tracking-widest ${exam ? 'text-sky-400' : 'text-slate-400'}`}>
          Câu hỏi {index + 1} / {total}
        </span>
        {showFeedback ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
              exam
                ? (isCorrect ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30')
                : (isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700')
            }`}
          >
            {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {isCorrect ? 'Đúng' : 'Sai'}
          </span>
        ) : null}
      </div>

      <p className={`text-base sm:text-lg font-bold leading-relaxed whitespace-pre-wrap ${exam ? 'text-slate-100' : 'text-slate-900'}`}>
        {question.questionText}
      </p>
      {question.questionImage ? (
        <img
          src={resolveMediaUrl(question.questionImage)}
          alt="Hình minh họa câu hỏi"
          className={`block w-full h-auto max-w-full rounded-2xl ${exam ? 'border border-white/10 bg-white/5' : 'border border-slate-100 bg-slate-50'}`}
        />
      ) : null}

      {question.type === 'single_choice' ? (
        <CertPrepSingleChoice
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          showFeedback={showFeedback}
          exam={exam}
        />
      ) : null}
      {question.type === 'multiple_choice' ? (
        <CertPrepMultipleChoice
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          showFeedback={showFeedback}
          exam={exam}
        />
      ) : null}
      {question.type === 'matching' ? (
        <CertPrepMatching
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          showFeedback={showFeedback}
          exam={exam}
        />
      ) : null}
      {question.type === 'true_false_grid' ? (
        <CertPrepTrueFalseGrid
          question={question}
          value={value}
          disabled={disabled}
          onChange={onChange}
          showFeedback={showFeedback}
          exam={exam}
        />
      ) : null}

      {showFeedback && (question.explanation || question.explanationImage) ? (
        <div className={`rounded-2xl p-4 text-sm ${
          exam
            ? 'border border-indigo-500/20 bg-indigo-500/10 text-indigo-200'
            : 'border border-indigo-100 bg-indigo-50/80 text-indigo-950'
        }`}
        >
          <p className={`text-[11px] font-black uppercase tracking-wide mb-1 ${exam ? 'text-indigo-300' : 'text-indigo-600'}`}>Giải thích</p>
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
            className={`min-h-10 px-3.5 rounded-xl text-sm font-bold border ${
              exam
                ? 'text-amber-200 bg-amber-500/15 border-amber-500/30'
                : 'text-amber-900 bg-amber-50 border-amber-200'
            }`}
          >
            {showHint ? 'Ẩn gợi ý' : 'Gợi ý'}
          </button>
          {showHint ? (
            <div className={`mt-2 rounded-2xl border p-3.5 text-sm ${
              exam
                ? 'bg-amber-500/10 border-amber-500/25 text-slate-200'
                : 'bg-amber-50 border-amber-100 text-slate-800'
            }`}
            >
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
