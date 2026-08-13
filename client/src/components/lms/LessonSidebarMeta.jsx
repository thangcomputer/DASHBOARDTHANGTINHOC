import React from 'react';
import {
  getLessonSidebarUi,
  LMS_DARK_PROGRESS_FILL_CLASS,
  LMS_DARK_PROGRESS_TRACK_CLASS,
  lessonSidebarChipClass,
} from '../../utils/lmsLessonUi';

/** Meta gọn cho mục lục bài học — chip + 1 dòng + % (không xếp 3–4 dòng chữ). */
export default function LessonSidebarMeta({ lesson, isCurrent = false, className = '' }) {
  const ui = getLessonSidebarUi(lesson, { isCurrent });
  const hasRow = ui.chips.length > 0 || ui.primary?.text;
  if (!hasRow && !ui.showProgressBar) return null;

  return (
    <div className={`mt-1.5 space-y-1 ${className}`}>
      {hasRow ? (
        <div className="flex flex-wrap items-center gap-1">
          {ui.chips.map((chip) => (
            <span
              key={chip.key}
              className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-semibold leading-none ${lessonSidebarChipClass(chip.tone)}`}
            >
              {chip.text}
            </span>
          ))}
          {ui.primary?.text ? (
            <span className="text-[10px] font-medium text-slate-400 leading-snug">
              {ui.primary.text}
            </span>
          ) : null}
        </div>
      ) : null}
      {ui.showProgressBar ? (
        <div className="flex items-center gap-2">
          <div className={`flex-1 min-w-0 ${LMS_DARK_PROGRESS_TRACK_CLASS}`}>
            <div
              className={LMS_DARK_PROGRESS_FILL_CLASS}
              style={{ width: `${ui.towardGatePct ?? 0}%` }}
            />
          </div>
          <span className="text-[9px] font-bold tabular-nums text-slate-400 shrink-0 w-7 text-right">
            {ui.towardGatePct}%
          </span>
        </div>
      ) : null}
    </div>
  );
}
