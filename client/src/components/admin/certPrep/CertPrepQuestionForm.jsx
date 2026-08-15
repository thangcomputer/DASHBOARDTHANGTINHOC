import { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import QuestionTypeSelector from './components/QuestionTypeSelector';
import ChoiceEditor from './components/ChoiceEditor';
import MultipleChoiceEditor from './components/MultipleChoiceEditor';
import MatchingEditor from './components/MatchingEditor';
import TrueFalseGridEditor from './components/TrueFalseGridEditor';
import HintEditor from './components/HintEditor';
import CertPrepImageUploader from './CertPrepImageUploader';
import CertPrepQuestionPreview from './CertPrepQuestionPreview';
import CertPrepConfirmDialog from './CertPrepConfirmDialog';

function blankQuestion(type = 'single_choice') {
  return {
    type,
    questionText: '',
    questionImage: '',
    options: [{ text: '', imageUrl: '' }, { text: '', imageUrl: '' }],
    correctAnswer: 0,
    correctIndices: [],
    minSelect: null,
    matchingItems: [{ id: 'i1', text: '', imageUrl: '' }],
    matchingTargets: [{ id: 't1', text: '', imageUrl: '' }],
    matchingPairs: [],
    statements: [{ id: 's1', text: '', correct: true }],
    hint: '',
    hintImage: '',
    explanation: '',
    explanationImage: '',
    sortOrder: 0,
    isActive: true,
  };
}

function fromDoc(doc) {
  if (!doc) return blankQuestion();
  const base = blankQuestion(doc.type);
  return {
    ...base,
    ...doc,
    options: Array.isArray(doc.options) && doc.options.length ? doc.options : base.options,
    statements: Array.isArray(doc.statements) && doc.statements.length ? doc.statements : base.statements,
  };
}

function optionHasContent(opt) {
  return String(opt?.text || '').trim() !== '' || String(opt?.imageUrl || '').trim() !== '';
}

function duplicateOptionTexts(options) {
  const texts = (options || []).map((o) => String(o?.text || '').trim().toLowerCase()).filter(Boolean);
  return texts.length !== new Set(texts).size;
}

function validateLocal(form) {
  if (!String(form.questionText || '').trim()) return 'Nội dung câu hỏi bắt buộc';
  if (form.type === 'single_choice') {
    const options = form.options || [];
    if (options.length < 2) return 'Cần tối thiểu 2 đáp án';
    if (!options.every(optionHasContent)) return 'Mỗi lựa chọn phải có nội dung hoặc hình ảnh';
    if (duplicateOptionTexts(options)) return 'Nội dung đáp án không được trùng';
    const correct = Number(form.correctAnswer);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return 'Cần chọn đúng 1 đáp án';
  }
  if (form.type === 'multiple_choice') {
    const options = form.options || [];
    if (options.length < 2) return 'Cần tối thiểu 2 đáp án';
    if (!options.every(optionHasContent)) return 'Mỗi lựa chọn phải có nội dung hoặc hình ảnh';
    if (duplicateOptionTexts(options)) return 'Nội dung đáp án không được trùng';
    const indices = [...new Set(form.correctIndices || [])];
    if (!indices.length) return 'Cần ít nhất 1 đáp án đúng';
    if (indices.some((n) => !Number.isInteger(n) || n < 0 || n >= options.length)) {
      return 'Chỉ số đáp án đúng không hợp lệ';
    }
  }
  if (form.type === 'matching') {
    if (!(form.matchingItems || []).length || !(form.matchingTargets || []).length) return 'Cần đủ hai cột';
    if (!(form.matchingPairs || []).length) return 'Cần ghép ít nhất 1 cặp';
  }
  if (form.type === 'true_false_grid') {
    const statements = form.statements || [];
    if (!statements.length) return 'Cần ít nhất 1 nhận định';
    if (statements.some((s) => !String(s?.text || '').trim())) return 'Mỗi nhận định cần có nội dung';
    if (statements.some((s) => typeof s?.correct !== 'boolean')) return 'Mỗi nhận định cần chọn Đúng hoặc Sai';
  }
  return '';
}

export default function CertPrepQuestionForm({
  question,
  test,
  saving,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState(() => fromDoc(question));
  const [error, setError] = useState('');
  const [dirtyConfirm, setDirtyConfirm] = useState(false);
  const [dirty, setDirty] = useState(false);

  const title = question?._id || question?.id ? 'Sửa câu hỏi' : 'Thêm câu hỏi';

  const patch = (next) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, ...next }));
  };

  const payload = useMemo(() => ({
    type: form.type,
    questionText: form.questionText,
    questionImage: form.questionImage,
    options: form.options,
    correctAnswer: form.correctAnswer,
    correctIndices: form.correctIndices,
    minSelect: form.minSelect,
    matchingItems: form.matchingItems,
    matchingTargets: form.matchingTargets,
    matchingPairs: form.matchingPairs,
    statements: form.statements,
    hint: form.hint,
    hintImage: form.hintImage,
    explanation: form.explanation,
    explanationImage: form.explanationImage,
    sortOrder: Number(form.sortOrder) || 0,
    isActive: form.isActive !== false,
  }), [form]);

  const requestClose = () => {
    if (dirty) setDirtyConfirm(true);
    else onClose();
  };

  const submit = (e) => {
    e.preventDefault();
    const msg = validateLocal(form);
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    onSave(payload);
  };

  return (
    <div className="cms-modal-shell">
      <form
        onSubmit={submit}
        className="cms-modal-panel max-w-4xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-prep-q-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 id="cert-prep-q-title" className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ngôn ngữ theo đề: {test?.locale === 'en' ? 'English' : 'Tiếng Việt'}
            </p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Đóng" className="w-10 h-10 rounded-xl hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[70dvh] overflow-y-auto">
          <QuestionTypeSelector
            value={form.type}
            onChange={(type) => patch({
              ...blankQuestion(type),
              questionText: form.questionText,
              questionImage: form.questionImage,
              hint: form.hint,
              hintImage: form.hintImage,
              explanation: form.explanation,
              explanationImage: form.explanationImage,
              sortOrder: form.sortOrder,
              isActive: form.isActive,
            })}
            disabled={saving}
          />
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-600">Nội dung câu hỏi</span>
            <textarea
              required
              rows={3}
              value={form.questionText}
              disabled={saving}
              onChange={(e) => patch({ questionText: e.target.value })}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm"
            />
          </label>
          <CertPrepImageUploader
            label="Hình ảnh câu hỏi"
            value={form.questionImage}
            disabled={saving}
            onChange={(questionImage) => patch({ questionImage })}
          />

          {form.type === 'single_choice' && (
            <ChoiceEditor
              options={form.options}
              correctAnswer={form.correctAnswer}
              disabled={saving}
              onChange={(options, correctAnswer) => patch({ options, correctAnswer })}
            />
          )}
          {form.type === 'multiple_choice' && (
            <MultipleChoiceEditor
              options={form.options}
              correctIndices={form.correctIndices}
              minSelect={form.minSelect}
              disabled={saving}
              onChange={(next) => patch(next)}
            />
          )}
          {form.type === 'matching' && (
            <MatchingEditor
              matchingItems={form.matchingItems}
              matchingTargets={form.matchingTargets}
              matchingPairs={form.matchingPairs}
              disabled={saving}
              onChange={(next) => patch(next)}
            />
          )}
          {form.type === 'true_false_grid' && (
            <TrueFalseGridEditor
              statements={form.statements}
              disabled={saving}
              onChange={(statements) => patch({ statements })}
            />
          )}

          <HintEditor
            hint={form.hint}
            hintImage={form.hintImage}
            explanation={form.explanation}
            explanationImage={form.explanationImage}
            disabled={saving}
            onChange={(next) => patch(next)}
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-600">Thứ tự</span>
              <input
                type="number"
                value={form.sortOrder}
                disabled={saving}
                onChange={(e) => patch({ sortOrder: e.target.value })}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 mt-6 text-sm font-bold">
              <input type="checkbox" checked={form.isActive !== false} disabled={saving} onChange={(e) => patch({ isActive: e.target.checked })} />
              Đang bật
            </label>
          </div>

          {error ? <p className="text-sm text-red-600 font-semibold">{error}</p> : null}

          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">Xem trước</p>
            <CertPrepQuestionPreview question={payload} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={requestClose} className="min-h-11 px-4 rounded-xl font-bold text-sm text-slate-600">Hủy</button>
          <button type="submit" disabled={saving} className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            Lưu
          </button>
        </div>
      </form>
      <CertPrepConfirmDialog
        open={dirtyConfirm}
        title="Thay đổi chưa lưu"
        message="Bạn có thay đổi chưa lưu. Đóng form sẽ mất dữ liệu đang nhập."
        confirmText="Đóng"
        onCancel={() => setDirtyConfirm(false)}
        onConfirm={() => { setDirtyConfirm(false); onClose(); }}
      />
    </div>
  );
}
