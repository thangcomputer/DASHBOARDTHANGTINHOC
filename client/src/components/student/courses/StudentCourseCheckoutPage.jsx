import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import dewskillClassApi, { dewskillClassErrorMessage } from '../../../services/dewskillClassApi';
import { generateVietQRUrl } from '../../bankSelectUtils';
import { useSocket } from '../../../context/SocketContext';
import { useToast } from '../../../utils/useToast';

const IS_DEV = import.meta.env.DEV;

export default function StudentCourseCheckoutPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { socket } = useSocket() || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [checkingNow, setCheckingNow] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const fetchStatus = useCallback(async (silent = true) => {
    if (!sessionId) return;
    if (!silent) setCheckingNow(true);
    try {
      const res = await dewskillClassApi.getPaymentSession(sessionId);
      const data = res?.data || res;
      setSession(data);
      setError('');
    } catch (err) {
      if (!silent) {
        toast.error(dewskillClassErrorMessage(err, 'Không kiểm tra được trạng thái thanh toán'));
      } else {
        setError(dewskillClassErrorMessage(err, 'Không tìm thấy phiên chuyển khoản'));
      }
    } finally {
      setLoading(false);
      setCheckingNow(false);
    }
  }, [sessionId, toast]);

  useEffect(() => {
    setLoading(true);
    fetchStatus(true);
  }, [fetchStatus]);

  useEffect(() => {
    if (!sessionId || !session || session.paid || session.status === 'paid' || session.status === 'expired') {
      return undefined;
    }
    pollRef.current = setInterval(() => {
      fetchStatus(true);
    }, 3000);
    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, session, fetchStatus]);

  useEffect(() => {
    if (!socket || !sessionId) return undefined;
    const onPaid = (payload) => {
      if (payload?.sessionId && payload.sessionId !== sessionId) return;
      fetchStatus(true);
    };
    socket.on('dewskillClass:paid', onPaid);
    return () => socket.off('dewskillClass:paid', onPaid);
  }, [socket, sessionId, fetchStatus]);

  const handleCopy = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedKey(key);
      toast.success('Đã sao chép');
      setTimeout(() => setCopiedKey(''), 1800);
    } catch {
      toast.error('Không sao chép được, vui lòng chép thủ công');
    }
  };

  const handleSimulatePaid = async () => {
    if (!sessionId || simulating) return;
    setSimulating(true);
    try {
      await dewskillClassApi.simulateClassPaid(sessionId);
      toast.success('Đã giả lập thanh toán thành công!');
      await fetchStatus(true);
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err, 'Không thể giả lập thanh toán'));
    } finally {
      setSimulating(false);
    }
  };

  const bank = session?.bankInfo || {};
  const amount = Number(session?.amount || 0);
  const qrUrl = session?.qrUrl
    || (bank.bankCode && bank.accountNumber
      ? generateVietQRUrl(bank.bankCode, bank.accountNumber, amount, session?.ref || '', bank.accountName || '')
      : null);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center gap-3 p-6 text-slate-500">
        <Loader2 size={28} className="animate-spin text-emerald-600" />
        <p className="text-sm font-semibold">Đang tạo thông tin chuyển khoản...</p>
      </div>
    );
  }

  if (error || !session || session.status === 'not_found') {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">Không tìm thấy phiên chuyển khoản</h2>
          <p className="text-sm text-slate-500">{error || 'Phiên thanh toán không tồn tại hoặc đã hết hạn.'}</p>
          <button
            type="button"
            onClick={() => navigate('/student/courses')}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <ArrowLeft size={14} /> Quay lại Danh mục khóa học
          </button>
        </div>
      </div>
    );
  }

  const isPaid = Boolean(session.paid || session.status === 'paid');

  if (isPaid) {
    const classTarget = session.classId
      ? `/student/courses?openClass=${encodeURIComponent(session.classId)}`
      : '/student/courses';
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-[28px] border border-emerald-200 bg-white p-8 text-center shadow-xl space-y-5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={46} />
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <Sparkles size={13} /> Mở khóa thành công
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {session.unlockedByAdmin ? 'Admin đã mở khóa lớp học cho bạn!' : 'Lớp học đã được mở khóa!'}
            </h1>
            <p className="text-sm text-slate-600">
              Khóa học <strong>{session.courseName || 'DewSkill'}</strong> đã chuyển sang quyền truy cập toàn bộ.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(classTarget)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700"
            >
              Vào lớp học ngay
            </button>
            <button
              type="button"
              onClick={() => navigate('/student/courses')}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Danh mục khóa học
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/student/courses')}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
        >
          <ArrowLeft size={14} /> Quay lại Danh mục khóa học
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200">
          <ShieldCheck size={14} /> Xác nhận tự động 24/7 qua SePay
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Cột trái: Thông tin chuyển khoản */}
        <div className="lg:col-span-7 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CreditCard size={20} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Đăng ký lớp học DewSkill</p>
              <h1 className="mt-0.5 text-xl font-extrabold text-slate-900">
                {session.courseName || 'Khóa học DewSkill'}
              </h1>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-sky-50/70 p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500">Số tiền cần chuyển khoản</div>
              <div className="mt-0.5 text-3xl font-black text-emerald-700 tabular-nums">
                {amount > 0 ? `${amount.toLocaleString('vi-VN')}đ` : 'Liên hệ / Theo gói'}
              </div>
            </div>
            {session.studentName ? (
              <div className="text-right text-xs text-slate-500">
                <div>Học viên</div>
                <div className="font-bold text-slate-800">{session.studentName}</div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2.5">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Thông tin tài khoản nhận chuyển khoản
            </h2>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-slate-500">Ngân hàng</span>
                <span className="font-bold text-slate-900">{bank.bankName || bank.bankCode || 'Chưa cấu hình'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-slate-500">Số tài khoản</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-slate-900">{bank.accountNumber || '—'}</span>
                  {bank.accountNumber ? (
                    <button
                      type="button"
                      onClick={() => handleCopy('acct', bank.accountNumber)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      {copiedKey === 'acct' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      Sao chép
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-slate-500">Chủ tài khoản</span>
                <span className="font-bold text-slate-900">{bank.accountName || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm bg-amber-50/70 rounded-b-2xl">
                <span className="font-semibold text-amber-900">Nội dung chuyển khoản</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-extrabold text-amber-800 border border-amber-200">
                    {session.ref}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('ref', session.ref)}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
                  >
                    {copiedKey === 'ref' ? <Check size={12} /> : <Copy size={12} />}
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            Vui lòng giữ nguyên <strong>Nội dung chuyển khoản</strong> để hệ thống tự động mở toàn bộ lớp học sau vài giây. Bạn cũng có thể liên hệ Admin để được mở khóa trực tiếp ngay sau khi chuyển khoản.
          </p>
        </div>

        {/* Cột phải: Mã VietQR + Polling */}
        <div className="lg:col-span-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col items-center justify-between gap-4">
          <div className="text-center">
            <h2 className="text-base font-extrabold text-slate-900">Quét mã VietQR</h2>
            <p className="mt-0.5 text-xs text-slate-500">Mở app Ngân hàng bất kỳ để quét mã</p>
          </div>

          <div className="flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white p-2 shadow-inner">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="Mã QR chuyển khoản VietQR"
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="px-4 text-center text-xs font-medium text-amber-700">
                Trung tâm chưa cấu hình tài khoản ngân hàng VietQR. Vui lòng liên hệ Admin để được hỗ trợ chuyển khoản &amp; mở khóa lớp học.
              </p>
            )}
          </div>

          <div className="w-full space-y-2.5">
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-600">
              <RefreshCw size={13} className="animate-spin text-emerald-600 shrink-0" />
              <span>Đang tự động kiểm tra thanh toán… ({seconds}s)</span>
            </div>

            <button
              type="button"
              disabled={checkingNow}
              onClick={() => fetchStatus(false)}
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
            >
              {checkingNow ? 'Đang kiểm tra...' : 'Tôi đã chuyển khoản · Kiểm tra ngay'}
            </button>

            {IS_DEV ? (
              <button
                type="button"
                disabled={simulating}
                onClick={handleSimulatePaid}
                className="w-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 py-2.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
              >
                {simulating ? 'Đang giả lập...' : 'Giả lập chuyển khoản thành công (Dev)'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
