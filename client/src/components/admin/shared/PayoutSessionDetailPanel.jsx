import React, { useState } from 'react';
import { Calendar, Users } from 'lucide-react';

function formatSessionDate(raw) {
  if (!raw) return '-';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('vi-VN');
}

export default function PayoutSessionDetailPanel({
  sessionDetails = [],
  studentSummary = [],
  totalSessionsCount = 0,
  totalStudentsCount = 0,
  starBonusAmount = 0,
  confirmedBy = '',
  rawNote = '',
}) {
  const [viewMode, setViewMode] = useState('student');

  const details = Array.isArray(sessionDetails) ? sessionDetails : [];
  const students = Array.isArray(studentSummary) ? studentSummary : [];
  const sessCount = totalSessionsCount || details.length;
  const stuCount = totalStudentsCount || students.length;

  if (!details.length) {
    return (
      <div className="border-t border-slate-100 bg-slate-50/75 px-4 py-3 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">Nội dung đầy đủ:</p>
        <p className="whitespace-pre-wrap break-words text-slate-600">
          {rawNote || 'Không gắn lịch buổi học cụ thể.'}
        </p>
        {confirmedBy ? (
          <p className="text-[11px] text-slate-400">Người xác nhận: {confirmedBy}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
          <Users size={13} className="text-indigo-600 shrink-0" />
          <span>{sessCount} buổi học · {stuCount} học viên</span>
          {Number(starBonusAmount) > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              + Thưởng sao {Number(starBonusAmount).toLocaleString('vi-VN')}đ
            </span>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('student')}
            className={`rounded-md px-2 py-1 transition ${
              viewMode === 'student'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo học viên ({stuCount})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('session')}
            className={`rounded-md px-2 py-1 transition ${
              viewMode === 'session'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Theo từng buổi ({sessCount})
          </button>
        </div>
      </div>

      {viewMode === 'student' ? (
        <div className="space-y-2">
          {students.map((st, idx) => (
            <div
              key={`${st.studentId || st.studentName}-${idx}`}
              className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-xs space-y-1.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-800 break-words">{st.studentName}</span>
                    {st.studentCode ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                        {st.studentCode}
                      </span>
                    ) : null}
                  </div>
                  {st.courseName ? (
                    <p className="text-[11px] text-slate-500 mt-0.5 break-words">{st.courseName}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-bold text-indigo-700">{st.sessionCount} buổi</span>
                  {Number(st.allocatedAmount) > 0 && (
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {Number(st.allocatedAmount).toLocaleString('vi-VN')}đ
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(st.sessions || []).map((s, sIdx) => (
                  <span
                    key={`${s.sessionId || sIdx}-${s.dateLabel || ''}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                  >
                    <Calendar size={10} className="text-indigo-500 shrink-0" />
                    <span className="font-bold text-indigo-700">
                      {s.sessionNo != null && Number(s.sessionNo) > 0 ? `Buổi ${s.sessionNo}` : 'Buổi'}
                    </span>
                    <span>· {s.dateLabel || formatSessionDate(s.date)}</span>
                    {s.startTime ? <span className="text-slate-400">({s.startTime})</span> : null}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-[11px]">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="px-2.5 py-2">Buổi</th>
                <th className="px-2.5 py-2">Học viên</th>
                <th className="px-2.5 py-2">Khóa học</th>
                <th className="px-2.5 py-2">Ngày học</th>
                <th className="px-2.5 py-2 text-right">Phân bổ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {details.map((s, idx) => (
                <tr key={`${s.sessionId || idx}-${idx}`} className="hover:bg-slate-50/70">
                  <td className="px-2.5 py-1.5 font-bold text-indigo-700 whitespace-nowrap">
                    {s.sessionNo != null && Number(s.sessionNo) > 0 ? `Buổi ${s.sessionNo}` : 'Buổi'}
                  </td>
                  <td className="px-2.5 py-1.5 font-semibold text-slate-800">
                    {s.studentName}
                    {s.studentCode ? (
                      <span className="ml-1 font-mono text-[10px] text-slate-400">({s.studentCode})</span>
                    ) : null}
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-600">{s.courseName || '-'}</td>
                  <td className="px-2.5 py-1.5 text-slate-600 whitespace-nowrap tabular-nums">
                    {formatSessionDate(s.date)}
                    {s.startTime ? ` ${s.startTime}` : ''}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                    {Number(s.allocatedAmount) > 0 ? `${Number(s.allocatedAmount).toLocaleString('vi-VN')}đ` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmedBy ? (
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
          <span>Người xác nhận: {confirmedBy}</span>
        </div>
      ) : null}
    </div>
  );
}
