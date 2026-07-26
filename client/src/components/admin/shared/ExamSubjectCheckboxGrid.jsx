import React from 'react';
import { getExamSubjectOptions } from '../../../utils/examSubjects';

export default function ExamSubjectCheckboxGrid({
  catalog,
  value = [],
  onChange,
  accent = 'green',
}) {
  const options = getExamSubjectOptions(catalog);
  const selected = Array.isArray(value) ? value : [];
  const ring = accent === 'purple' ? 'border-purple-500 bg-purple-50' : 'border-green-500 bg-green-50';
  const dot = accent === 'purple' ? 'text-purple-700' : 'text-green-700';

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-500 uppercase block">
        Môn học <span className="text-red-500">*</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map(({ id, label }) => {
          const on = selected.includes(id);
          return (
            <label
              key={id}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-colors ${on ? ring : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={on}
                onChange={() => toggle(id)}
              />
              <span className={on ? dot : 'text-gray-700'}>{label}</span>
            </label>
          );
        })}
      </div>
      {!options.length && (
        <p className="text-xs text-amber-600">Chưa có danh mục môn. Cấu hình tại Cài đặt hệ thống.</p>
      )}
    </div>
  );
}
