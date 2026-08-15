import { resolveMediaUrl } from '../../../services/api';
import CertPrepReviewSingleChoice from './CertPrepReviewSingleChoice';
import CertPrepReviewMultipleChoice from './CertPrepReviewMultipleChoice';
import CertPrepReviewMatching from './CertPrepReviewMatching';
import CertPrepReviewTrueFalseGrid from './CertPrepReviewTrueFalseGrid';

function optionLetter(i) {
  return String.fromCharCode(65 + i);
}

function studentChoiceLabel(question) {
  if (!question.answered) return 'Chưa trả lời';
  if (question.type === 'single_choice') {
    const i = Number(question.studentAnswer);
    return Number.isInteger(i) ? optionLetter(i) : '—';
  }
  if (question.type === 'multiple_choice') {
    const arr = Array.isArray(question.studentAnswer) ? question.studentAnswer : [];
    return arr.map((n) => optionLetter(Number(n))).join(', ') || '—';
  }
  return 'Xem bên dưới';
}

function correctChoiceLabel(question) {
  if (question.type === 'single_choice') {
    const i = Number(question.correctAnswer);
    return Number.isInteger(i) ? optionLetter(i) : '—';
  }
  if (question.type === 'multiple_choice') {
    const arr = Array.isArray(question.correctIndices) ? question.correctIndices : [];
    return arr.map((n) => optionLetter(Number(n))).join(', ') || '—';
  }
  return 'Xem bên dưới';
}

export default function CertPrepReviewQuestion({ question, total }) {
  if (!question) return null;
  const badge = question.answered
    ? (question.isCorrect ? '✓ ĐÚNG' : '✗ SAI')
    : '— Chưa trả lời';
  const badgeCls = question.answered
    ? (question.isCorrect ? 'text-emerald-700' : 'text-red-600')
    : 'text-slate-500';
  const hasExpl = Boolean(question.explanation || question.explanationImage);

  return (
    <article className="cms-card p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black uppercase tracking-wide text-slate-500">
          Câu {question.order} / {total}
        </p>
        <p className={`text-sm font-black ${badgeCls}`}>{badge}</p>
      </div>
      <p className="text-base font-semibold text-slate-900 whitespace-pre-wrap">{question.questionText}</p>
      {question.questionImage ? (
        <img
          src={resolveMediaUrl(question.questionImage)}
          alt="Hình minh họa câu hỏi"
          className="max-h-64 rounded-xl border border-slate-100"
        />
      ) : null}

      {question.type === 'single_choice' ? <CertPrepReviewSingleChoice question={question} /> : null}
      {question.type === 'multiple_choice' ? <CertPrepReviewMultipleChoice question={question} /> : null}
      {question.type === 'matching' ? <CertPrepReviewMatching question={question} /> : null}
      {question.type === 'true_false_grid' ? <CertPrepReviewTrueFalseGrid question={question} /> : null}

      {question.type !== 'matching' && question.type !== 'true_false_grid' ? (
        <div className="text-sm space-y-1">
          <p><span className="font-bold text-slate-600">Bạn chọn:</span> {studentChoiceLabel(question)}</p>
          <p><span className="font-bold text-slate-600">Đáp án đúng:</span> {correctChoiceLabel(question)}</p>
        </div>
      ) : null}

      {hasExpl ? (
        <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-sm">
          <p className="font-bold text-sky-800 text-xs mb-1">Giải thích</p>
          {question.explanation ? <p className="whitespace-pre-wrap text-slate-800">{question.explanation}</p> : null}
          {question.explanationImage ? (
            <img src={resolveMediaUrl(question.explanationImage)} alt="Hình giải thích" className="max-h-40 mt-2 rounded-lg" />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
