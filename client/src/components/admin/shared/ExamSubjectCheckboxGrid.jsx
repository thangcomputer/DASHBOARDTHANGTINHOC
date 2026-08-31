import React from 'react';
import { getExamSubjectGroupLabel, getExamSubjectOptions } from '../../../utils/examSubjects';

/**
 * @param {object} props
 * @param {number} [props.columns=3] — số cột desktop (mobile tự về 2)
 * @param {boolean} [props.dense] — chip thấp hơn, nhóm sát hơn
 * @param {boolean} [props.hideLabel] — ẩn label "Môn học"
 */
export default function ExamSubjectCheckboxGrid({
  catalog,
  value = [],
  onChange,
  accent = 'red',
  columns = 3,
  dense = false,
  hideLabel = false,
  groupLabels = null,
}) {
  const options = getExamSubjectOptions(catalog).filter((item) => item?.id && item?.label);
  const selected = Array.isArray(value) ? value : [];
  const groups = options.reduce((acc, item) => {
    const key = item.group || 'admin';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const groupEntries = Object.entries(groups).filter(([, items]) => items.length > 0);

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

  const colClass =
    columns === 4 ? 'cms-chip-grid--4'
      : columns === 2 ? 'cms-chip-grid--2'
        : 'cms-chip-grid--3';

  return (
    <div className={dense ? 'space-y-1.5' : 'space-y-2'}>
      {!hideLabel && (
        <label className="cms-label">
          Môn học <span className="text-red-500">*</span>
          {selected.length > 0 && (
            <span className="ml-1.5 normal-case tracking-normal font-semibold text-slate-400">
              ({selected.length} đã chọn)
            </span>
          )}
        </label>
      )}
      <div className={dense ? 'space-y-2.5' : 'space-y-3'}>
        {groupEntries.map(([groupKey, items]) => (
          <div key={groupKey} className={dense ? 'space-y-1.5' : 'space-y-2'}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {getExamSubjectGroupLabel(groupKey, groupLabels)}
            </p>
            <div className={`cms-chip-grid ${colClass} ${accentClass}`}>
              {items.map(({ id, label }) => {
                const on = selected.includes(id);
                return (
                  <button
                    type="button"
                    key={id}
                    className={`cms-chip-option ${dense ? 'cms-chip-option--dense' : ''} ${on ? 'is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggle(id)}
                  >
                    <span
                      className={`cms-chip-check ${on ? 'is-on' : ''}`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span className="min-w-0 truncate leading-snug" title={label}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!options.length && (
        <p className="text-xs text-amber-600">Chưa có danh mục môn. Cấu hình tại Cài đặt hệ thống.</p>
      )}
    </div>
  );
}
