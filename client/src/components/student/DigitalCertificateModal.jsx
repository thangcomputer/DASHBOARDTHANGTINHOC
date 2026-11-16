import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Award, Check, Copy, Lock, Printer, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';

function hashString32(input, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  const str = String(input || '');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function buildCertificateCode({ studentId = '', studentCode = '', courseId = '', courseTitle = '' } = {}) {
  const year = new Date().getFullYear();
  const baseCode = String(studentCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = baseCode ? baseCode.slice(0, 8) : `HV${year}`;
  const raw = `${studentId}|${courseId}|${courseTitle}`;
  const h1 = hashString32(raw, 0x9e3779b9).toString(16).toUpperCase().padStart(8, '0');
  const h2 = hashString32(`${raw}|tth`, 0x85ebca6b).toString(16).toUpperCase().padStart(8, '0');
  return `TTH-${prefix}-${h1.slice(0, 4)}${h2.slice(0, 4)}`;
}

function buildQrMatrix(text, size = 25) {
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (row0, col0) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row0 + r;
        const cc = col0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          grid[rr][cc] = false;
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          grid[rr][cc] = true;
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          grid[rr][cc] = true;
        } else {
          grid[rr][cc] = false;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    reserved[6][i] = true;
    grid[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    grid[i][6] = i % 2 === 0;
  }

  // Alignment box near bottom-right for visual authenticity
  const ar0 = size - 9;
  const ac0 = size - 9;
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      reserved[ar0 + r][ac0 + c] = true;
      grid[ar0 + r][ac0 + c] = r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2);
    }
  }

  let state = hashString32(text, 0x243f6a88) || 1;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (reserved[r][c]) continue;
      state = (Math.imul(state ^ (r * 31 + c), 1664525) + 1013904223) >>> 0;
      grid[r][c] = (state & 1) === 1;
    }
  }
  return grid;
}

export function QrSvg({ value, size = 104 }) {
  const cells = useMemo(() => buildQrMatrix(value, 25), [value]);
  const dim = cells.length;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim + 2} ${dim + 2}`}
      className="block rounded-lg bg-white"
      role="img"
      aria-label={`Mã QR xác thực ${value}`}
    >
      <rect width={dim + 2} height={dim + 2} fill="#FFFFFF" />
      {cells.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c + 1}
              y={r + 1}
              width={1}
              height={1}
              rx={0.18}
              fill="#0F172A"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

export default function DigitalCertificateModal({
  open,
  onClose,
  studentName = 'Học viên',
  studentCode = '',
  studentId = '',
  courseId = '',
  courseTitle = 'Khóa học Tin học ứng dụng',
  instructorName = 'Trung tâm Thắng Tin Học',
  completionRate = 0,
  avgGrade = null,
  issuedDate = '',
}) {
  const [copied, setCopied] = useState(false);
  const safeProgress = Math.min(
    100,
    Math.max(0, Number.isFinite(Number(completionRate)) ? Math.round(Number(completionRate)) : 0),
  );
  const isCompleted = safeProgress >= 100;
  const displayCourseTitle = /^tài khoản miễn phí$/i.test(String(courseTitle || '').trim())
    ? 'Xuất sắc'
    : (String(courseTitle || '').trim() || 'Khóa học Tin học ứng dụng');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const certCode = useMemo(
    () => buildCertificateCode({ studentId, studentCode, courseId, courseTitle: displayCourseTitle }),
    [studentId, studentCode, courseId, displayCourseTitle],
  );

  const formattedDate = useMemo(() => {
    if (issuedDate) {
      const parsed = new Date(issuedDate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Ho_Chi_Minh',
        });
      }
    }
    return new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  }, [issuedDate]);

  const verifyUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://thangtinhoc.edu.vn';
    return `${origin}/verify-certificate/${encodeURIComponent(certCode)}`;
  }, [certCode]);

  const handleCopyVerify = async () => {
    const text = `Chứng nhận Thắng Tin Học · Học viên: ${studentName} · Khóa: ${courseTitle} · Mã xác thực: ${certCode} · Link: ${verifyUrl}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore clipboard error */
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chứng nhận số hoàn thành khóa học"
      className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <style>{`
        @page {
          size: A5 portrait;
          margin: 8mm;
        }
        @media print {
          html, body {
            width: 148mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          body * { visibility: hidden !important; }
          ${isCompleted ? `
            #th-digital-cert-sheet, #th-digital-cert-sheet * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #th-digital-cert-sheet {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 132mm !important;
              height: 194mm !important;
              max-width: none !important;
              margin: 0 !important;
              box-shadow: none !important;
              page-break-after: avoid !important;
              break-inside: avoid !important;
            }
          ` : ''}
        }
      `}</style>
      <div
        className="relative w-full max-w-[500px] rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="th-digital-cert-sheet"
          className="relative flex flex-col justify-between aspect-[148/210] bg-gradient-to-br from-[#ECFDF5] via-white to-[#FEFCE8] p-4 sm:p-5 border-[5px] border-emerald-700/90 m-2.5 sm:m-3.5 rounded-2xl overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-amber-500/40" />
          {!isCompleted && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center select-none px-4"
            >
              <div className="-rotate-12 rounded-xl border-2 border-rose-600/70 bg-white/70 px-3.5 py-1.5 text-center shadow-md backdrop-blur-[0.5px]">
                <p className="whitespace-nowrap text-xs sm:text-sm font-black tracking-[0.14em] text-rose-600 uppercase">
                  CHƯA HOÀN THÀNH
                </p>
                <p className="mt-0.5 whitespace-nowrap text-[10px] font-black text-rose-700">
                  TIẾN ĐỘ: {safeProgress}% / 100%
                </p>
              </div>
            </div>
          )}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-sm shadow-emerald-600/25">
                <Award size={19} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10.5px] font-black tracking-[0.14em] text-emerald-700 uppercase">
                  DEWSKILL ACADEMY
                </p>
                <p className="truncate text-[10px] font-semibold text-slate-500">
                  Đào tạo &amp; Xác thực Kỹ năng số
                </p>
              </div>
            </div>
            {isCompleted ? (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-[10px] font-black text-emerald-800">
                <ShieldCheck size={12} className="shrink-0" /> Đã xác thực
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-rose-100 border border-rose-200 px-2.5 py-1 text-[10px] font-black text-rose-700">
                <ShieldAlert size={12} className="shrink-0" /> Chưa xong ({safeProgress}%)
              </span>
            )}
          </div>

          <div className="relative z-10 my-auto py-3 text-center space-y-1.5">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-amber-600 uppercase">
              <Sparkles size={12} /> Certificate of Completion <Sparkles size={12} />
            </p>
            <h2 className="text-lg sm:text-[20px] font-black leading-snug tracking-tight text-slate-900">
              CHỨNG NHẬN HOÀN THÀNH
              <br />
              KHÓA HỌC
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              Trân trọng trao tặng học viên
            </p>
            <p className="pt-0.5 text-xl sm:text-2xl font-black tracking-tight text-emerald-700 uppercase break-words">
              {studentName || 'HỌC VIÊN THẮNG TIN HỌC'}
            </p>
            <p className="mx-auto max-w-[340px] text-[11px] font-medium leading-relaxed text-slate-600">
              {isCompleted
                ? 'Đã hoàn thành xuất sắc chương trình đào tạo & thực hành'
                : 'Bản xem trước tiến độ — hoàn thành 100% để nhận chứng nhận'}
            </p>
            <div className="mx-auto mt-1.5 max-w-sm rounded-2xl border border-emerald-200 bg-white/90 px-3.5 py-2 shadow-xs">
              <p className="text-sm sm:text-base font-black text-slate-900">{displayCourseTitle}</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] font-bold text-slate-500">
                <span className={isCompleted ? 'text-emerald-700' : 'text-rose-600'}>
                  Tiến độ: {safeProgress}%
                </span>
                {avgGrade != null && Number(avgGrade) > 0 ? (
                  <span className="text-amber-700">Điểm TB: {avgGrade}/10</span>
                ) : null}
                <span>{isCompleted ? `Ngày cấp: ${formattedDate}` : 'Chưa đủ 100%'}</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-3 border-t border-emerald-900/10 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 text-left space-y-0.5">
              <p className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">
                Giảng viên / Đại diện
              </p>
              <p className="truncate text-[11.5px] sm:text-xs font-black text-slate-800">
                {instructorName || 'Trung tâm Thắng Tin Học'}
              </p>
              <p className="truncate text-[9.5px] font-mono font-bold text-emerald-700">
                {isCompleted ? `Mã CN: ${certCode}` : 'Mã CN: Chưa kích hoạt'}
              </p>
            </div>

            <div className={`flex max-w-[54%] shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 sm:p-2 shadow-xs ${!isCompleted ? 'opacity-50 blur-[1px] select-none' : ''}`}>
              <QrSvg value={verifyUrl} size={56} />
              <div className="min-w-0 text-left">
                <p className="text-[8.5px] font-black uppercase tracking-tight text-emerald-700 leading-tight">
                  Quét QR xác thực
                </p>
                <p className="text-[8.5px] text-slate-500 leading-tight mt-0.5">
                  Kiểm tra hợp lệ trực tuyến.
                </p>
                <p className="text-[8px] font-mono text-slate-400 truncate mt-0.5">
                  {isCompleted ? certCode : 'CHƯA KÍCH HOẠT'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2 bg-slate-50 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {isCompleted ? (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-extrabold transition cursor-pointer shadow-xs"
                >
                  <Printer size={14} /> In / Lưu PDF
                </button>
                <button
                  type="button"
                  onClick={handleCopyVerify}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? 'Đã sao chép mã' : 'Sao chép mã xác thực'}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled
                title={`Hoàn thành 100% để tải về (${safeProgress}%)`}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-200 text-slate-500 px-4 py-2 text-xs font-extrabold cursor-not-allowed"
              >
                <Lock size={14} /> Tải xuống
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
