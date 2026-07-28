import React from 'react';
import { getExamSubjectGroupLabel, getExamSubjectOptions } from '../../../utils/examSubjects';

export default function ExamSubjectCheckboxGrid({
  catalog,
  value = [],
  onChange,
  accent = 'red',
}) {
  const options = getExamSubjectOptions(catalog);
  const selected = Array.isArray(value) ? value : [];
  const groups = options.reduce((acc, item) => {
    const key = item.group || 'admin';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onChange(next);
  };

  const accentClass =
    accent === 'blue' ? 'is-accent-blue'
      : accent === 'purple' ? 'is-accent-purple'
        : accent === 'green' ? 'is-accent-green'
          : '';

  return (
    <div className="space-y-2">
      <label className="cms-label">
        Môn học <span className="text-red-500">*</span>
      </label>
      <div className="space-y-3">
        {Object.entries(groups).map(([groupKey, items]) => (
          <div key={groupKey} className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              {getExamSubjectGroupLabel(groupKey)}
            </p>
            <div className={`cms-chip-grid ${accentClass}`}>
              {items.map(({ id, label }) => {
                const on = selected.includes(id);
                return (
                  <label
                    key={id}
                    className={`cms-chip-option ${on ? 'is-on' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => toggle(id)}
                    />
                    <span
                      className={`cms-chip-check ${on ? 'is-on' : ''}`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span className="min-w-0 truncate leading-snug" title={label}>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!options.length && (
        <p className="text-[12px] text-amber-600">Chưa có danh mục môn. Cấu hình tại Cài đặt hệ thống.</p>
      )}
    </div>
  );
}
