import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  KeyRound,
  Loader2,
  Monitor,
  Phone,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import dewskillClassApi, { dewskillClassErrorMessage } from '../../../services/dewskillClassApi';
import { aiSupportAPI, settingsAPI } from '../../../services/api';
import { generateVietQRUrl } from '../../bankSelectUtils';
import { useSocket } from '../../../context/SocketContext';
import { useData } from '../../../context/DataContext';
import { useActiveCourse } from '../../../context/ActiveCourseContext';
import { useToast } from '../../../utils/useToast';
import { ADMIN_ZALO_PHONE } from '../../../utils/adminZaloContact';
import { getDewSkillThemeAttr, isDewSkillAccount } from '../../../utils/dewskillTheme';
import { emitAiQuotaUpdated } from '../../ui/AiUsageIndicator';
import { buildAiPackageTransferRef, formatAiPlanExpiry } from '../../../data/aiPackagesData';
import { getCourseTimeRemaining } from '../../../utils/courseAccessTime';
import { TIER_STYLES } from './catalogMarketplaceData';

const IS_DEV = import.meta.env.DEV;

const BENEFITS = [
  'Mở toàn bộ bài giảng video & bài tập thực hành',
  'Học Google Meet trực tiếp cùng giảng viên',
  'Chấm điểm tự động & cố vấn hỗ trợ trên Web + Mobile',
];

function cleanCourseShortTitle(name) {
  return String(name || '').replace(/\s*\([^)]*\)\s*/g, '').trim() || String(name || 'Khóa học DewSkill');
}

function formatPriceVnd(value) {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? `${amount.toLocaleString('vi-VN')}đ` : '';
}

function CourseBadge3D({ course }) {
  const tierInfo = TIER_STYLES[course?.tier] || TIER_STYLES['cap-2'];
  const track = String(course?.track || '').toLowerCase();
  const nameLower = String(course?.name || '').toLowerCase();
  const isWord = track === 'word' || nameLower.includes('word');
  const isExcel = track === 'excel' || nameLower.includes('excel');
  const isPpt = track === 'powerpoint' || nameLower.includes('powerpoint') || nameLower.includes('ppt');

  let letter = null;
  let badgeGradient = tierInfo.gradient;
  if (isWord && !isExcel && !isPpt) {
    letter = 'W';
    badgeGradient = 'linear-gradient(145deg, #60A5FA 0%, #2563EB 60%, #1D4ED8 100%)';
  } else if (isExcel && !isWord) {
    letter = 'X';
    badgeGradient = 'linear-gradient(145deg, #34D399 0%, #10B981 55%, #047857 100%)';
  } else if (isPpt && !isWord) {
    letter = 'P';
    badgeGradient = 'linear-gradient(145deg, #FDBA74 0%, #F97316 55%, #EA580C 100%)';
  }

  return (
    <div
      className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl border border-white/80 text-white shadow-[0_14px_26px_-8px_rgba(16,185,129,0.42),inset_0_2px_4px_rgba(255,255,255,0.75)]"
      style={{ background: badgeGradient }}
      aria-hidden="true"
    >
      {letter ? (
        <span className="text-2xl font-black tracking-tight drop-shadow">{letter}</span>
      ) : (
        <Monitor size={26} strokeWidth={2.2} className="drop-shadow" />
      )}
    </div>
  );
}

/** Modal kích hoạt khóa học hoặc Gói Hỏi AI Không Giới Hạn (tự nhận theme DewSkill / Trung tâm). */
export default function CourseEnrollmentModal({
  open,
  course = null,
  aiPackage = null,
  user = null,
  previewAsAdmin = false,
  onClose,
  onActivated,
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { socket } = useSocket() || {};
  const { currentUser } = useData() || {};
  const { markCourseEnrolled, setActiveCourseId } = useActiveCourse();

  const effectiveUser = user || currentUser || {};
  const isDewSkill = isDewSkillAccount(effectiveUser);
  const isAiPackageMode = Boolean(aiPackage);
  const aiPackageId = String(aiPackage?.id || '').trim().toLowerCase();
  const courseId = String(course?._id || course?.id || '').trim();
  const targetKey = isAiPackageMode ? `ai:${aiPackageId}` : courseId;

  const [activeTab, setActiveTab] = useState('qr'); // 'qr' | 'code'
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [paymentSession, setPaymentSession] = useState(null);
  const [previewBankInfo, setPreviewBankInfo] = useState(null);
  const [checkingNow, setCheckingNow] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const [activationCode, setActivationCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [codeError, setCodeError] = useState('');

  const [activated, setActivated] = useState(false);
  const activatedHandledRef = useRef(false);
  const initRunIdRef = useRef(0);

  const courseRef = useRef(course);
  courseRef.current = course;
  const aiPackageRef = useRef(aiPackage);
  aiPackageRef.current = aiPackage;
  const onActivatedRef = useRef(onActivated);
  onActivatedRef.current = onActivated;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const markCourseEnrolledRef = useRef(markCourseEnrolled);
  markCourseEnrolledRef.current = markCourseEnrolled;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [activatedAiPlan, setActivatedAiPlan] = useState(null);
  const [activatedCourseMeta, setActivatedCourseMeta] = useState(null);

  const handleActivationSuccess = useCallback((notifyToast = true, paidData = null) => {
    if (activatedHandledRef.current) return;
    activatedHandledRef.current = true;
    setActivated(true);
    setStatusNotice('');
    setCodeError('');
    const currentAiPackage = aiPackageRef.current;
    if (currentAiPackage) {
      const nextAiPlan = paidData?.aiPlan || {
        plan: currentAiPackage.id,
        code: currentAiPackage.code,
        label: currentAiPackage.name,
        isUnlimited: true,
        expiresAt: null,
      };
      setActivatedAiPlan(nextAiPlan);
      try {
        const raw = localStorage.getItem('student_user');
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed) {
          localStorage.setItem('student_user', JSON.stringify({ ...parsed, aiPlan: nextAiPlan }));
        }
        window.dispatchEvent(new CustomEvent('cms:ai-plan-updated', { detail: { aiPlan: nextAiPlan } }));
        emitAiQuotaUpdated({
          aiPlan: nextAiPlan,
          questionQuota: {
            applies: true,
            mode: 'percent',
            unit: 'percent',
            isUnlimited: true,
            percentLeft: 100,
            percentUsed: 0,
            aiPlan: nextAiPlan,
          },
        });
      } catch { /* ignore */ }
      if (notifyToast) {
        toastRef.current?.success(`Đã kích hoạt ${currentAiPackage.name} thành công!`);
      }
      if (onActivatedRef.current) {
        Promise.resolve(onActivatedRef.current({ aiPackage: currentAiPackage, aiPlan: nextAiPlan })).catch(() => { });
      }
      return;
    }

    const currentCourse = courseRef.current;
    const courseMeta = {
      expiresAt: paidData?.expiresAt || currentCourse?.accessExpiresAt || null,
      durationMonths: Number(paidData?.durationMonths || currentCourse?.durationMonths) || 12,
      includesMeet: paidData?.includesMeet !== undefined
        ? Boolean(paidData.includesMeet)
        : (currentCourse?.includesMeet !== false),
    };
    setActivatedCourseMeta(courseMeta);
    if (currentCourse) {
      markCourseEnrolledRef.current?.(currentCourse, courseMeta);
    }
    try {
      const raw = localStorage.getItem('student_user');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.freePortal === true && parsed.freeUnlocked !== true) {
        localStorage.setItem('student_user', JSON.stringify({ ...parsed, freeUnlocked: true }));
      }
      window.dispatchEvent(new CustomEvent('free-portal-unlocked'));
      window.dispatchEvent(new CustomEvent('cms:subscription-updated', { detail: { freeUnlocked: true } }));
    } catch { /* ignore */ }
    if (notifyToast) {
      toastRef.current?.success(`Đã mở khóa thành công ${cleanCourseShortTitle(currentCourse?.name)}!`);
    }
    if (onActivatedRef.current) {
      Promise.resolve(onActivatedRef.current(currentCourse)).catch(() => { });
    }
  }, []);

  const initCheckout = useCallback(async () => {
    if (!open || !targetKey) return;
    if (isAiPackageMode && !aiPackageId) return;
    if (!isAiPackageMode && !courseId) return;
    const runId = ++initRunIdRef.current;
    setSessionError('');
    setStatusNotice('');

    if (previewAsAdmin) {
      setLoadingSession(true);
      try {
        const res = await settingsAPI.getPayment();
        if (runId !== initRunIdRef.current || activatedHandledRef.current) return;
        const raw = res?.data || res || {};
        setPreviewBankInfo({
          bankCode: String(raw.centerBankCode || raw.bankCode || '').trim(),
          bankName: String(raw.centerBankName || raw.bankName || '').trim(),
          accountNumber: String(raw.centerBankAccountNumber || raw.accountNumber || '').trim(),
          accountName: String(raw.centerBankAccountName || raw.accountName || '').trim(),
        });
      } catch {
        if (runId === initRunIdRef.current) setPreviewBankInfo(null);
      } finally {
        if (runId === initRunIdRef.current) setLoadingSession(false);
      }
      return;
    }

    setLoadingSession(true);
    try {
      const res = isAiPackageMode
        ? await aiSupportAPI.checkoutPackage(aiPackageId)
        : await dewskillClassApi.checkoutClass(courseId);
      if (runId !== initRunIdRef.current || activatedHandledRef.current) return;
      const data = res?.data || res || {};
      if (!isAiPackageMode && data.owned) {
        handleActivationSuccess(false);
        return;
      }
      setPaymentSession(data);
    } catch (err) {
      if (runId === initRunIdRef.current && !activatedHandledRef.current) {
        setSessionError(
          isAiPackageMode
            ? (err?.message || 'Không tạo được mã chuyển khoản gói Hỏi AI')
            : dewskillClassErrorMessage(err, 'Không tạo được mã chuyển khoản tự động'),
        );
      }
    } finally {
      if (runId === initRunIdRef.current) setLoadingSession(false);
    }
  }, [open, targetKey, isAiPackageMode, aiPackageId, courseId, previewAsAdmin, handleActivationSuccess]);

  useEffect(() => {
    if (!open || !targetKey) {
      initRunIdRef.current += 1;
      return undefined;
    }
    activatedHandledRef.current = false;
    setActiveTab('qr');
    setActivationCode('');
    setCodeError('');
    setStatusNotice('');
    setActivated(false);
    setActivatedAiPlan(null);
    setActivatedCourseMeta(null);
    setPaymentSession(null);
    setSessionError('');
    initCheckout();
    return () => {
      initRunIdRef.current += 1;
    };
  }, [open, targetKey, previewAsAdmin, initCheckout]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const checkSessionStatus = useCallback(async (silent = true) => {
    const sid = paymentSession?.sessionId;
    if (!sid || previewAsAdmin || activatedHandledRef.current) return false;
    if (!silent) setCheckingNow(true);
    try {
      const res = isAiPackageMode
        ? await aiSupportAPI.getPackageSession(sid)
        : await dewskillClassApi.getPaymentSession(sid);
      if (activatedHandledRef.current) return true;
      const data = res?.data || res || {};
      setPaymentSession((prev) => (prev ? { ...prev, ...data } : data));
      if (data.paid || data.status === 'paid') {
        handleActivationSuccess(true, data);
        return true;
      }
      if (!silent) {
        const msg = 'Chưa ghi nhận giao dịch mới. Nếu bạn vừa chuyển khoản, hệ thống sẽ tự kích hoạt sau 1–3 phút.';
        setStatusNotice(msg);
        toastRef.current?.info('Chưa thấy giao dịch mới, vui lòng chờ 1–3 phút hoặc bấm kiểm tra lại.');
      }
      return false;
    } catch (err) {
      if (!silent) {
        toastRef.current?.error(
          isAiPackageMode
            ? (err?.message || 'Không kiểm tra được trạng thái thanh toán')
            : dewskillClassErrorMessage(err, 'Không kiểm tra được trạng thái thanh toán'),
        );
      }
      return false;
    } finally {
      if (!silent) setCheckingNow(false);
    }
  }, [paymentSession?.sessionId, previewAsAdmin, isAiPackageMode, handleActivationSuccess]);

  useEffect(() => {
    if (!open || activated || previewAsAdmin || !paymentSession?.sessionId) return undefined;
    const intervalId = window.setInterval(() => {
      checkSessionStatus(true);
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [open, activated, previewAsAdmin, paymentSession?.sessionId, checkSessionStatus]);

  useEffect(() => {
    if (!open || !socket || !paymentSession?.sessionId) return undefined;
    if (isAiPackageMode) {
      const onAiPaid = (payload) => {
        if (payload?.sessionId && payload.sessionId !== paymentSession.sessionId) return;
        handleActivationSuccess(true, payload);
      };
      socket.on('aiPackage:paid', onAiPaid);
      return () => socket.off('aiPackage:paid', onAiPaid);
    }
    const onPaid = (payload) => {
      if (payload?.sessionId && payload.sessionId !== paymentSession.sessionId) return;
      if (payload?.classId && String(payload.classId) !== courseId) return;
      checkSessionStatus(true);
    };
    socket.on('dewskillClass:paid', onPaid);
    return () => socket.off('dewskillClass:paid', onPaid);
  }, [open, socket, paymentSession?.sessionId, isAiPackageMode, courseId, checkSessionStatus, handleActivationSuccess]);

  const shortTitle = useMemo(() => (
    isAiPackageMode ? (aiPackage?.name || 'Gói Hỏi AI Không Giới Hạn') : cleanCourseShortTitle(course?.name)
  ), [isAiPackageMode, aiPackage?.name, course?.name]);
  const priceNumber = Math.max(0, Math.round(Number(paymentSession?.amount ?? (isAiPackageMode ? aiPackage?.price : course?.price) ?? 0)));
  const referralDiscountVnd = Math.max(0, Math.round(Number(paymentSession?.referralDiscountVnd) || 0));
  const sessionBasePrice = Math.max(0, Math.round(Number(paymentSession?.basePrice) || 0));
  const priceText = formatPriceVnd(priceNumber);
  const rawOriginalPriceValue = isAiPackageMode ? aiPackage?.originalPrice : course?.originalPrice;
  const originalPriceValue = referralDiscountVnd > 0
    ? Math.max(Number(rawOriginalPriceValue) || 0, sessionBasePrice)
    : rawOriginalPriceValue;
  const originalPriceText = formatPriceVnd(originalPriceValue);
  const hasDiscount = originalPriceText && Number(originalPriceValue || 0) > priceNumber && priceNumber > 0;

  const bank = paymentSession?.bankInfo || previewBankInfo || {};
  const fallbackRef = useMemo(() => {
    if (isAiPackageMode) {
      return buildAiPackageTransferRef(aiPackage?.code || '3M', effectiveUser);
    }
    const codePart = String(course?.code || 'DEW')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase() || 'LOP';
    const phonePart = String(effectiveUser?.phone || effectiveUser?.zalo || effectiveUser?.studentCode || '')
      .replace(/\s+/g, '');
    return `DEW ${codePart}${phonePart ? ` ${phonePart}` : ''}`.trim();
  }, [isAiPackageMode, aiPackage?.code, course?.code, effectiveUser]);

  const transferRef = paymentSession?.ref || fallbackRef;

  const qrUrl = useMemo(() => {
    if (paymentSession?.qrUrl) return paymentSession.qrUrl;
    if (bank?.bankCode && bank?.accountNumber) {
      return generateVietQRUrl(
        bank.bankCode,
        bank.accountNumber,
        priceNumber,
        transferRef,
        bank.accountName || ''
      );
    }
    return null;
  }, [paymentSession?.qrUrl, bank?.bankCode, bank?.accountNumber, bank?.accountName, priceNumber, transferRef]);

  const handleCopy = async (key, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedKey(key);
      toast.success('Đã sao chép');
      window.setTimeout(() => setCopiedKey(''), 1800);
    } catch {
      toast.error('Không sao chép được, vui lòng sao chép thủ công');
    }
  };

  const handleOpenZalo = () => {
    const phone = String(ADMIN_ZALO_PHONE || '0984623486').replace(/\D/g, '') || '0984623486';
    const msg = isAiPackageMode
      ? `Xin chào, mình cần hỗ trợ kích hoạt "${aiPackage?.name || 'Gói Hỏi AI Không Giới Hạn'}" (${aiPackage?.durationLabel || ''}).`
      : `Xin chào DewSkill, mình cần tư vấn kích hoạt khóa học "${course?.name || ''}"${course?.code ? ` (${course.code})` : ''}.`;
    window.open(`https://zalo.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleManualCheck = async () => {
    if (previewAsAdmin) {
      toast.info('Đang ở chế độ Xem trước của Admin. Học viên bấm nút này sẽ kiểm tra giao dịch tự động.');
      return;
    }
    if (!paymentSession?.sessionId) {
      await initCheckout();
      return;
    }
    await checkSessionStatus(false);
  };

  const handleSimulatePaid = async () => {
    if (!paymentSession?.sessionId || simulating || previewAsAdmin) return;
    setSimulating(true);
    try {
      const simRes = isAiPackageMode
        ? await aiSupportAPI.simulatePackagePaid(paymentSession.sessionId)
        : await dewskillClassApi.simulateClassPaid(paymentSession.sessionId);
      handleActivationSuccess(true, simRes?.data || simRes);
    } catch (err) {
      toast.error(
        isAiPackageMode
          ? (err?.message || 'Không giả lập được thanh toán')
          : dewskillClassErrorMessage(err, 'Không giả lập được thanh toán'),
      );
    } finally {
      setSimulating(false);
    }
  };

  const handleRedeemCode = async (e) => {
    e.preventDefault();
    const cleaned = activationCode.trim();
    if (!cleaned) {
      setCodeError('Vui lòng nhập mã kích hoạt trước khi xác nhận.');
      return;
    }
    if (previewAsAdmin) {
      toast.info('Đang ở chế độ Xem trước của Admin.');
      return;
    }
    setCodeError('');
    setRedeeming(true);
    try {
      const redeemRes = await dewskillClassApi.redeemClassCode(courseId, cleaned);
      handleActivationSuccess(true, redeemRes?.data || redeemRes);
    } catch (err) {
      setCodeError(dewskillClassErrorMessage(err, 'Mã kích hoạt không hợp lệ hoặc đã được sử dụng.'));
    } finally {
      setRedeeming(false);
    }
  };

  const handleEnterCourseNow = () => {
    if (courseId) setActiveCourseId(courseId);
    const firstTopic = course?.dailyPracticeTopicIds?.[0] || course?.topicIds?.[0];
    const topicId = String(firstTopic?._id || firstTopic?.id || firstTopic || '').trim();
    onClose?.();
    navigate(topicId ? `/student/daily-practice?topicId=${encodeURIComponent(topicId)}` : '/student/daily-practice');
  };

  if (!open || (!course && !aiPackage)) return null;

  const benefitsList = isAiPackageMode && Array.isArray(aiPackage?.benefits) && aiPackage.benefits.length
    ? aiPackage.benefits
    : BENEFITS;
  const aiPlanExpiryFormatted = formatAiPlanExpiry(activatedAiPlan?.expiresAt);
  const courseDurationMonths = Math.max(1, Number(course?.durationMonths) || 12);
  const activatedCourseTime = getCourseTimeRemaining(activatedCourseMeta?.expiresAt);

  const modal = (
    <div
      data-theme={getDewSkillThemeAttr(effectiveUser)}
      className="fixed inset-0 z-[9700] bg-slate-900/45 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isAiPackageMode ? 'Kích hoạt Gói Hỏi AI Không Giới Hạn' : 'Kích hoạt khóa học'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative w-full max-w-[94vw] sm:max-w-lg md:max-w-2xl lg:max-w-[740px]">
        {/* Giọt nước 3D trang trí chỉ hiển thị cho học viên DewSkill */}
        {isDewSkill ? (
          <>
            <span
              aria-hidden="true"
              className="dew-water-orb pointer-events-none absolute -top-5 -left-6 z-20 hidden h-14 w-14 opacity-85 lg:block"
            />
            <span
              aria-hidden="true"
              className="dew-water-orb pointer-events-none absolute top-14 -right-5 z-20 hidden h-10 w-10 opacity-80 lg:block"
            />
            <span
              aria-hidden="true"
              className="dew-water-orb pointer-events-none absolute -bottom-4 left-12 z-20 hidden h-9 w-9 opacity-75 lg:block"
            />
          </>
        ) : null}

        <div className="dew-modal w-full max-h-[88dvh] rounded-2xl sm:rounded-[24px] bg-white/95 backdrop-blur-2xl border border-white shadow-[0_28px_70px_-12px_rgba(4,120,87,0.28),inset_0_2px_0_#fff] overflow-hidden relative flex flex-col">
          {/* Thanh nhấn xanh ngọc 4px trên cùng */}
          <div className="h-1 w-full shrink-0 bg-gradient-to-r from-[#34D399] via-[#10B981] to-[#059669]" />

          {/* Header Modal */}
          <div className="relative flex shrink-0 items-center justify-center border-b border-emerald-100/80 bg-white/85 px-4 py-3 sm:px-5 sm:py-3.5">
            <h2 className="pr-8 text-sm font-black uppercase tracking-wide text-slate-900 sm:text-base">
              {isAiPackageMode ? 'Kích hoạt Gói Hỏi AI Không Giới Hạn' : 'Kích hoạt khóa học'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hộp thoại thanh toán"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {activated ? (
            /* 3. TRẠNG THÁI KÍCH HOẠT THÀNH CÔNG */
            <div className="flex flex-col items-center justify-center gap-3 overflow-y-auto bg-gradient-to-b from-[#ECFDF5]/85 via-white to-[#E0F2FE]/70 p-5 text-center sm:p-7">
              {isDewSkill ? (
                <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-2 border-white bg-gradient-to-b from-[#D1FAE5] to-[#A7F3D0] shadow-[0_18px_36px_-10px_rgba(16,185,129,0.42),inset_0_3px_6px_rgba(255,255,255,0.85)]">
                  <img
                    src="/mascot/thanh-toan-thanh-cong.gif"
                    alt="Mascot DewSkill chúc mừng mở khóa thành công"
                    onError={(e) => {
                      e.currentTarget.src = '/mascot/tot-nghiep-vui-ve.gif';
                    }}
                    className="h-20 w-20 sm:h-24 sm:w-24 object-contain drop-shadow"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-b from-[#34D399] to-[#059669] text-white shadow-lg">
                  <Check size={34} strokeWidth={3} />
                </div>
              )}

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100/90 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                <Sparkles size={13} /> Kích hoạt thành công
              </span>

              <h3 className="text-lg font-black text-slate-900 sm:text-xl">
                {isAiPackageMode
                  ? 'Đã kích hoạt Gói Hỏi AI Không Giới Hạn!'
                  : `Đã mở khóa thành công ${shortTitle}!`}
              </h3>

              <p className="max-w-md text-xs font-medium leading-relaxed text-slate-600 sm:text-sm">
                {isAiPackageMode ? (
                  <>
                    <strong>{aiPackage?.name}</strong> đã được bật trạng thái{' '}
                    <strong className="text-emerald-700">Không giới hạn</strong>
                    {aiPlanExpiryFormatted ? ` (hạn đến ${aiPlanExpiryFormatted})` : ''} trên cả Web &amp; Mobile.
                  </>
                ) : (
                  <>
                    Khóa học <strong>{course.name}</strong> đã được thêm vào danh sách khóa học của bạn và sẵn sàng học ngay trên Web &amp; Mobile.
                  </>
                )}
              </p>

              {!isAiPackageMode ? (
                <div className="max-w-md rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs font-semibold leading-relaxed text-emerald-900">
                  <div className="inline-flex items-center gap-1.5 font-extrabold text-emerald-800">
                    <Clock size={14} />
                    <span>
                      Thời hạn học {activatedCourseMeta?.durationMonths || courseDurationMonths} tháng · {activatedCourseTime.detailNote}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-emerald-800/90">
                    {activatedCourseMeta?.includesMeet !== false ? 'Bao gồm học Google Meet cùng giảng viên. ' : ''}
                    Khi hết thời hạn, khóa học sẽ bị khóa và tiến độ được đặt lại về ban đầu.
                  </p>
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                {isAiPackageMode ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="dew-btn-primary inline-flex items-center gap-2 px-7 py-3.5 text-sm font-extrabold cursor-pointer"
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    <span>Bắt đầu hỏi AI ngay</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleEnterCourseNow}
                      className="dew-btn-primary inline-flex items-center gap-2 px-7 py-3.5 text-sm font-extrabold cursor-pointer"
                    >
                      <Play size={14} fill="currentColor" aria-hidden="true" />
                      <span>Vào học ngay</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="dew-btn-white px-5 py-3 text-xs font-bold cursor-pointer"
                    >
                      Xem danh mục khóa học
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* 2. BỐ CỤC 2 CỘT CÂN ĐỐI */
            <div className="grid grid-cols-1 overflow-y-auto md:grid-cols-12">
              {/* CỘT TRÁI */}
              <div className="md:col-span-5 bg-gradient-to-b from-[#D1FAE5]/70 via-[#ECFDF5]/85 to-[#E0F2FE]/80 p-5 sm:p-6 flex flex-col justify-between gap-4 border-b md:border-b-0 md:border-r border-emerald-100/80">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-center gap-3">
                    {isDewSkill ? (
                      <img
                        src="/mascot/nang-dong.gif"
                        alt="Mascot DewSkill"
                        className="h-14 w-14 sm:h-16 sm:w-16 object-contain drop-shadow-[0_12px_20px_rgba(6,95,70,0.22)]"
                      />
                    ) : null}
                    {isAiPackageMode ? (
                      <div
                        className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl border border-white/80 text-white shadow-[0_14px_26px_-8px_rgba(16,185,129,0.42),inset_0_2px_4px_rgba(255,255,255,0.75)]"
                        style={{ background: 'linear-gradient(145deg, #34D399 0%, #10B981 55%, #047857 100%)' }}
                        aria-hidden="true"
                      >
                        <Sparkles size={24} strokeWidth={2.2} />
                      </div>
                    ) : (
                      <CourseBadge3D course={course} />
                    )}
                  </div>

                  <div className="text-center space-y-1.5">
                    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                      {isAiPackageMode ? 'Không giới hạn AI' : 'Mở toàn bộ lộ trình'}
                    </span>
                    <h3 className="text-base font-black leading-snug text-slate-900 sm:text-lg">
                      {isAiPackageMode ? aiPackage.name : course.name}
                    </h3>
                  </div>

                  <ul className="space-y-2 pt-0.5">
                    {benefitsList.map((text) => (
                      <li key={text} className="flex items-start gap-2 text-xs font-semibold leading-snug text-slate-700">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#34D399] to-[#059669] text-white shadow-xs">
                          <Check size={10} strokeWidth={3} />
                        </span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[22px] bg-white/95 border border-white p-4 text-center shadow-sm backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {isAiPackageMode
                          ? (aiPackage?.durationLabel || 'Không giới hạn')
                          : `Thời hạn ${courseDurationMonths} tháng`}
                      </span>
                      {referralDiscountVnd > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800">
                          Ưu đãi giới thiệu -{referralDiscountVnd.toLocaleString('vi-VN')}đ
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-baseline justify-center gap-2">
                      <span className="text-xl sm:text-2xl font-black text-emerald-700 tabular-nums">
                        {priceText || 'Trọn gói trung tâm'}
                      </span>
                      {hasDiscount ? (
                        <span className="text-xs sm:text-sm font-bold text-slate-400 line-through tabular-nums">
                          {originalPriceText}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                      {isAiPackageMode
                        ? 'Dùng chung trên Web & Mobile'
                        : 'Hết hạn cần gia hạn để tiếp tục lộ trình'}
                    </p>
                  </div>

                  <p className="text-center text-xs font-semibold text-slate-600">
                    Hotline hỗ trợ nhanh:{' '}
                    <a
                      href="tel:0984623486"
                      className="inline-flex items-center gap-1 font-extrabold text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      <Phone size={11} />
                      0984 623 486
                    </a>
                  </p>
                </div>
              </div>

              {/* CỘT PHẢI */}
              <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-4 bg-white/90">
                <div className="space-y-3.5">
                  <div className="text-center">
                    {!isAiPackageMode ? (
                      <div
                        className="mx-auto inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full border border-emerald-100 bg-slate-100/85 p-1 shadow-inner"
                        role="tablist"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeTab === 'qr'}
                          onClick={() => setActiveTab('qr')}
                          className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                            activeTab === 'qr'
                              ? 'dew-btn-primary text-white shadow-sm'
                              : 'text-slate-600 hover:text-emerald-700'
                          }`}
                        >
                          Chuyển khoản QR
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeTab === 'code'}
                          onClick={() => setActiveTab('code')}
                          className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                            activeTab === 'code'
                              ? 'dew-btn-primary text-white shadow-sm'
                              : 'text-slate-600 hover:text-emerald-700'
                          }`}
                        >
                          Nhập mã kích hoạt
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50/80 px-4 py-1.5 text-xs font-extrabold text-emerald-800">
                        Thanh toán chuyển khoản VietQR
                      </span>
                    )}
                  </div>

                  {activeTab === 'qr' ? (
                    <div className="space-y-3">
                      <div className="mx-auto flex h-36 w-36 sm:h-40 sm:w-40 items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white p-2 shadow-sm">
                        {loadingSession ? (
                          <div className="flex flex-col items-center gap-2 text-slate-500">
                            <Loader2 size={24} className="animate-spin text-emerald-600" />
                            <span className="text-[11px] font-semibold">Đang tạo mã VietQR...</span>
                          </div>
                        ) : sessionError ? (
                          <div className="space-y-2 px-2 text-center">
                            <p className="text-[11px] font-semibold text-rose-600">{sessionError}</p>
                            <button
                              type="button"
                              onClick={initCheckout}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                            >
                              <RefreshCw size={11} /> Tạo lại QR
                            </button>
                          </div>
                        ) : qrUrl ? (
                          <img
                            src={qrUrl}
                            alt="Mã VietQR thanh toán khóa học DewSkill"
                            className="h-full w-full rounded-xl object-contain"
                          />
                        ) : (
                          <p className="px-2 text-center text-[11px] font-medium leading-relaxed text-amber-700">
                            Trung tâm chưa cấu hình VietQR. Vui lòng nhắn Zalo hoặc gọi 0984 623 486 để nhận số tài khoản.
                          </p>
                        )}
                      </div>

                      <p className="text-center text-xs font-semibold text-slate-600">
                        Kích hoạt tự động sau 1–3 phút
                      </p>

                      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/80 divide-y divide-slate-200/70">
                        {(bank?.bankName || bank?.bankCode) ? (
                          <div className="flex items-center justify-between gap-2 px-3.5 py-2">
                            <span className="shrink-0 text-xs font-medium text-slate-500">
                              Ngân hàng:
                            </span>
                            <span className="pr-1 text-right text-xs font-extrabold text-slate-900">
                              {bank.bankName || bank.bankCode}
                            </span>
                          </div>
                        ) : null}

                        {bank?.accountNumber ? (
                          <div className="flex items-center justify-between gap-2 px-3.5 py-2">
                            <span className="shrink-0 text-xs font-medium text-slate-500">
                              Số tài khoản:
                            </span>
                            <div className="flex min-w-0 items-center justify-end gap-1.5">
                              <span className="font-mono text-xs font-extrabold text-slate-900">
                                {bank.accountNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy('acct', bank.accountNumber)}
                                aria-label="Sao chép số tài khoản"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                              >
                                {copiedKey === 'acct' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {priceNumber > 0 ? (
                          <div className="flex items-center justify-between gap-2 px-3.5 py-2">
                            <span className="shrink-0 text-xs font-medium text-slate-500">
                              Số tiền:
                            </span>
                            <div className="flex min-w-0 items-center justify-end gap-1.5">
                              <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                                {priceText}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy('amount', String(priceNumber))}
                                aria-label="Sao chép số tiền"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                              >
                                {copiedKey === 'amount' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between gap-2 px-3.5 py-2">
                          <span className="shrink-0 text-xs font-medium text-slate-500">
                            Nội dung CK:
                          </span>
                          <div className="flex min-w-0 items-center justify-end gap-1.5">
                            <span className="break-all rounded-lg border border-emerald-200 bg-emerald-50/90 px-2 py-0.5 font-mono text-[11px] font-black tracking-normal text-emerald-800">
                              {transferRef}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy('ref', transferRef)}
                              aria-label="Sao chép nội dung chuyển khoản"
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                            >
                              {copiedKey === 'ref' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {statusNotice ? (
                        <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-center text-[11px] font-semibold text-amber-800">
                          {statusNotice}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    /* Tab 2: Nhập mã kích hoạt */
                    <form id="dewskill-redeem-code-form" onSubmit={handleRedeemCode} className="space-y-4 py-2">
                      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-sky-50/60 p-4 text-xs font-medium leading-relaxed text-slate-600">
                        Dành cho học viên đã nhận thẻ / mã kích hoạt từ trung tâm hoặc giáo viên phụ trách. Mỗi mã áp dụng một lần để mở toàn bộ khóa học.
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="dewskill-activation-code-input"
                          className="block text-xs font-extrabold text-slate-700"
                        >
                          Mã kích hoạt khóa học
                        </label>
                        <div className="relative">
                          <KeyRound
                            size={16}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600"
                          />
                          <input
                            id="dewskill-activation-code-input"
                            type="text"
                            value={activationCode}
                            onChange={(e) => {
                              setActivationCode(e.target.value.toUpperCase());
                              if (codeError) setCodeError('');
                            }}
                            placeholder="Nhập mã kích hoạt (VD: DEW-XXXX-XXXX)"
                            autoComplete="off"
                            className="dew-input w-full rounded-2xl border border-emerald-200/90 bg-white/85 py-3.5 pr-4 pl-11 font-mono text-sm font-bold tracking-wider text-slate-900 placeholder:font-sans placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 shadow-inner backdrop-blur-md focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          />
                        </div>
                        {codeError ? (
                          <p className="text-xs font-semibold text-rose-600">{codeError}</p>
                        ) : null}
                      </div>
                    </form>
                  )}
                </div>

                {/* Khối CTA cuối cột phải */}
                <div className="space-y-2">
                  {activeTab === 'qr' ? (
                    <button
                      type="button"
                      disabled={checkingNow || loadingSession}
                      onClick={handleManualCheck}
                      className="dew-btn-primary flex w-full items-center justify-center gap-2 py-3 text-xs font-extrabold sm:text-[13px] disabled:opacity-60 cursor-pointer"
                    >
                      {checkingNow ? <Loader2 size={15} className="animate-spin" /> : null}
                      <span>{checkingNow ? 'Đang kiểm tra giao dịch...' : 'Tôi đã chuyển khoản — Kiểm tra ngay'}</span>
                      {!checkingNow ? <ArrowRight size={15} /> : null}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      form="dewskill-redeem-code-form"
                      disabled={redeeming}
                      className="dew-btn-primary flex w-full items-center justify-center gap-2 py-3 text-xs font-extrabold sm:text-[13px] disabled:opacity-60 cursor-pointer"
                    >
                      {redeeming ? <Loader2 size={15} className="animate-spin" /> : null}
                      <span>{redeeming ? 'Đang xác thực mã...' : 'Kích hoạt khóa học ngay'}</span>
                      {!redeeming ? <ArrowRight size={15} /> : null}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleOpenZalo}
                    className="dew-btn-white flex w-full items-center justify-center gap-2 py-2.5 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-black text-sky-700">
                      Zalo
                    </span>
                    <span>Nhắn Zalo tư vấn trước khi đăng ký</span>
                  </button>

                  {IS_DEV && activeTab === 'qr' && paymentSession?.sessionId && !previewAsAdmin ? (
                    <button
                      type="button"
                      disabled={simulating}
                      onClick={handleSimulatePaid}
                      className="w-full rounded-full border border-dashed border-amber-300 bg-amber-50/90 py-1.5 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60 cursor-pointer"
                    >
                      {simulating ? 'Đang giả lập...' : 'Giả lập chuyển khoản thành công (Dev)'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
