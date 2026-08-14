import { useNavigate } from 'react-router-dom';
import { formatDateTime, formatDuration } from './certPrepStudentLabels';

export default function CertPrepAttemptHistory({ attempts = [], currentSessionId }) {
  const navigate = useNavigate();
  if (!attempts.length) return null;
  return (
    <section className="cms-card overflow-hidden">
      <h3 className="text-base font-bold text-slate-900 px-4 sm:px-5 py-4 border-b border-slate-100">Lịch sử làm bài</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Lần</th>
              <th className="px-4 py-3">Ngày</th>
              <th className="px-4 py-3">Điểm</th>
              <th className="px-4 py-3">Kết quả</th>
              <th className="px-4 py-3">Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((row) => {
              const active = String(row.sessionId) === String(currentSessionId);
              return (
                <tr key={row.sessionId} className={active ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3 font-bold">{row.attempt}</td>
                  <td className="px-4 py-3">{formatDateTime(row.submittedAt || row.startedAt)}</td>
                  <td className="px-4 py-3 font-bold">{row.score}</td>
                  <td className="px-4 py-3">
                    <span className={`font-black ${row.passed ? 'text-emerald-700' : 'text-red-600'}`}>
                      {row.passed ? 'Đạt' : 'Chưa đạt'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/student/cert-prep/result/${row.sessionId}`)}
                      className="font-bold text-red-600 hover:underline"
                    >
                      {formatDuration(row.durationSeconds)} · Xem
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
