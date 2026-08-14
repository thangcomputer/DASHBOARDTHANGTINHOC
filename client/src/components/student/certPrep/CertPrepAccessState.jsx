import { formatExpiry, isAccessExpired } from './certPrepStudentLabels';

export default function CertPrepAccessState({ expiresAt }) {
  if (isAccessExpired(expiresAt)) {
    return <p className="text-sm font-bold text-red-600">Quyền truy cập đã hết hạn.</p>;
  }
  if (expiresAt) {
    return (
      <p className="text-sm text-slate-500">
        Quyền truy cập đến: <span className="font-bold text-slate-700">{formatExpiry(expiresAt)}</span>
      </p>
    );
  }
  return <p className="text-sm text-slate-500">Quyền truy cập đang hiệu lực.</p>;
}
