import CmsSelect from '../../../ui/CmsSelect';
import { QUESTION_TYPES } from '../questionLabels';

export default function QuestionTypeSelector({ value, onChange, disabled = false }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-slate-600">Loại câu hỏi</span>
      <CmsSelect
        value={value}
        disabled={disabled}
        aria-label="Loại câu hỏi"
        onChange={(e) => onChange(e.target.value)}
      >
        {QUESTION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </CmsSelect>
    </label>
  );
}
