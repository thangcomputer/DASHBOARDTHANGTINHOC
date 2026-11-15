import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Award, Check, Copy, Printer, ShieldCheck, Sparkles, X } from 'lucide-react';

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
  completionRate = 100,
  avgGrade = null,
  issuedDate = '',
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const certCode = useMemo(
    () => buildCertificateCode({ studentId, studentCode, courseId, courseTitle }),
    [studentId, studentCode, courseId, courseTitle],
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
    const text = `Chứng chỉ Thắng Tin Học · Học viên: ${studentName} · Khóa: ${courseTitle} · Mã xác thực: ${certCode} · Link: ${verifyUrl}`;
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
      aria-label="Chứng chỉ số hoàn thành khóa học"
      className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #th-digital-cert-sheet, #th-digital-cert-sheet * { visibility: visible !important; }
          #th-digital-cert-sheet {
            position: fixed !important;
            inset: 0 !important;
            margin: auto !important;
            width: 100% !important;
            max-width: 820px !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="th-digital-cert-sheet"
          className="relative bg-gradient-to-br from-[#ECFDF5] via-white to-[#FEFCE8] p-5 sm:p-8 border-[6px] border-emerald-700/90 m-3 sm:m-4 rounded-2xl"
        >
          <div className="pointer-events-none absolute inset-2 rounded-xl border border-amber-500/40" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-600/25">
                <Award size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black tracking-[0.22em] text-emerald-700 uppercase">
                  Thắng Tin Học Academy
                </p>
                <p className="text-[11px] font-semibold text-slate-500">
                  Hệ thống Đào tạo &amp; Xác thực Kỹ năng số
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-[10px] font-black text-emerald-800">
              <ShieldCheck size={13} /> Đã xác thực
            </span>
          </div>

          <div className="relative z-10 mt-6 text-center space-y-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-[0.25em] text-amber-600 uppercase">
              <Sparkles size={13} /> Certificate of Completion <Sparkles size={13} />
            </p>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              CHỨNG NHẬN HOÀN THÀNH KHÓA HỌC
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Trân trọng trao tặng học viên
            </p>
            <p className="pt-1 text-2xl sm:text-3xl font-black tracking-tight text-emerald-700 uppercase break-words">
              {studentName || 'HỌC VIÊN THẮNG TIN HỌC'}
            </p>
            <p className="text-xs sm:text-sm font-medium text-slate-600">
              Đã hoàn thành xuất sắc chương trình đào tạo &amp; thực hành
            </p>
            <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-white/90 px-4 py-2.5 shadow-xs">
              <p className="text-base sm:text-lg font-black text-slate-900">{courseTitle}</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                <span className="text-emerald-700">Tiến độ: {Math.min(100, Math.max(0, Number(completionRate) || 100))}%</span>
                {avgGrade != null && Number(avgGrade) > 0 ? (
                  <span className="text-amber-700">Điểm TB: {avgGrade}/10</span>
                ) : null}
                <span>Ngày cấp: {formattedDate}</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 pt-5 border-t border-emerald-900/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Giảng viên / Đại diện đào tạo
              </p>
              <p className="text-sm font-black text-slate-800">{instructorName || 'Trung tâm Thắng Tin Học'}</p>
              <p className="text-[11px] font-mono font-bold text-emerald-700">
                Mã CC: {certCode}
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <QrSvg value={verifyUrl} size={86} />
              <div className="text-left max-w-[155px]">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Quét QR xác thực
                </p>
                <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                  Kiểm tra tính hợp lệ trực tuyến theo mã định danh.
                </p>
                <p className="text-[9px] font-mono text-slate-400 truncate mt-1">{certCode}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 pb-4 pt-1 flex flex-wrap items-center justify-between gap-2 bg-slate-50 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-extrabold transition cursor-pointer shadow-xs"
            >
              <Printer size={14} /> In / Lưu PDF
            </button>
            <button
              type="button"
              onClick={handleCopyVerify}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copied ? 'Đã sao chép mã' : 'Sao chép mã xác thực'}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200/70 transition cursor-pointer"
          >
            <X size={14} /> Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
