import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X } from 'lucide-react';
import {
  addMinutesToTimeHHmm,
  parseTimeToMinutes,
} from '../../utils/scheduleTime.js';

function formatDateViShort(dateKey) {
  const s = String(dateKey || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  }
  return s;
}

function formatDurationBadge(startTime, endTime) {
  const s = parseTimeToMinutes(startTime);
  const e = parseTimeToMinutes(endTime);
  if (s == null || e == null || e <= s) return '';
  const diff = e - s;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h > 0 && m > 0) return `${h}g ${m}p`;
  if (h > 0) return `${h}g`;
  return `${m}p`;
}

export default function CustomScheduleTimeModal({
  open,
  studentName,
  courseName,
  weekdayLabel,
  dateKey,
  initialStart = '',
  initialEnd = '',
  hasExistingSlot = false,
  validateRange,
  onConfirm,
  onClose,
}) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setStartTime(String(initialStart || '').trim());
    setEndTime(String(initialEnd || '').trim());
    setError('');
  }, [open, initialStart, initialEnd, dateKey]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const durationText = formatDurationBadge(startTime, endTime);

  const handleSubmit = (event) => {
    event?.preventDefault?.();
    const s = String(startTime || '').trim();
    const e = String(endTime || '').trim();

    if (!s && !e) {
      onConfirm?.({ startTime: '', endTime: '' });
      return;
    }

    if (!s || !e) {
      setError('Vui lòng chọn đủ giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai nếu không có lịch.');
      return;
    }

    const sMins = parseTimeToMinutes(s);
    const eMins = parseTimeToMinutes(e);
    if (sMins == null || eMins == null) {
      setError('Giờ bắt đầu hoặc kết thúc không hợp lệ');
      return;
    }
    if (eMins <= sMins) {
      setError('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
      return;
    }

    const rangeErr = typeof validateRange === 'function' ? validateRange(s, e) : '';
    if (rangeErr) {
      setError(rangeErr);
      return;
    }

    setError('');
    onConfirm?.({ startTime: s, endTime: e });
  };

  const applyQuickDuration = (mins) => {
    if (!startTime) return;
    const nextEnd = addMinutesToTimeHHmm(startTime, mins);
    if (nextEnd && parseTimeToMinutes(nextEnd) > parseTimeToMinutes(startTime)) {
      setEndTime(nextEnd);
      setError('');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-slate-950/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-schedule-time-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Clock size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span id="custom-schedule-time-title" className="block text-sm font-black text-slate-900">
              Tự chọn giờ học
            </span>
            <span className="block truncate text-xs font-medium text-slate-500">
              {studentName || 'Học viên'}
              {courseName ? ` · ${courseName}` : ''}
              {weekdayLabel ? ` · ${weekdayLabel}` : ''}
              {dateKey ? ` (${formatDateViShort(dateKey)})` : ''}
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng tự chọn giờ"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3.5 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="custom-slot-start" className="mb-1 block text-xs font-bold text-slate-600">
                Từ giờ
              </label>
              <input
                id="custom-slot-start"
                type="time"
                value={startTime}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setError('');
                }}
                autoFocus
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>
            <div>
              <label htmlFor="custom-slot-end" className="mb-1 block text-xs font-bold text-slate-600">
                Đến giờ
              </label>
              <input
                id="custom-slot-end"
                type="time"
                value={endTime}
                onChange={(event) => {
                  setEndTime(event.target.value);
                  setError('');
                }}
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { mins: 60, label: '+1 giờ' },
                { mins: 90, label: '+1h30' },
                { mins: 120, label: '+2 giờ' },
              ].map((preset) => (
                <button
                  key={preset.mins}
                  type="button"
                  disabled={!startTime}
                  onClick={() => applyQuickDuration(preset.mins)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {durationText ? (
              <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-1 text-xs font-extrabold text-emerald-700">
                {startTime} - {endTime} ({durationText})
              </span>
            ) : null}
          </div>

          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            Không chọn giờ (để trống cả hai ô) coi như không có lịch.
          </p>

          {error ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            {hasExistingSlot ? (
              <button
                type="button"
                onClick={() => onConfirm?.({ startTime: '', endTime: '' })}
                className="h-10 rounded-xl border-2 border-red-200 bg-red-50 px-3 text-xs font-bold text-red-600 hover:bg-red-100"
              >
                Không có lịch
              </button>
            ) : null}
            <button
              type="submit"
              className="h-10 flex-[1.4] rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
            >
              Xác nhận
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
