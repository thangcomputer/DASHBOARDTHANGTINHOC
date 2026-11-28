import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, CheckCircle2, Clock, User, Settings, BookOpen,
  Mail, Phone, MapPin, ChevronRight, ChevronDown,
  GraduationCap, KeyRound, Target, Camera, Bell, LogOut,
  Crown, History, Sparkles, Zap, Wallet, Shield,
  Award, Laptop, QrCode, Smartphone, Users, Lock, ArrowRight, Plus, Video,
} from 'lucide-react';
import DigitalCertificateModal from './DigitalCertificateModal';
import ShareAchievementModal, { ShareTriggerButton } from './ShareAchievementModal';
import { buildCourseOrCertShareData } from '../../../../shared/dailyPractice/shareAchievement.mjs';
import EditableAvatar from '../EditableAvatar';
import { openPinLockSettings } from '../../utils/pinLock';
import { openLearningGoal } from '../../utils/learningGoal';
import api from '../../services/api';
import dewskillClassApi from '../../services/dewskillClassApi';
import dailyPracticeApi, { DAILY_PRACTICE_STATS_EVENT } from '../../services/dailyPracticeApi';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import { isFreePortalCourseName, isFreePortalSelfRegistrationStudent } from '../../utils/enrollments';
import { evaluateCourseCertificateStatus } from '../../utils/examSubjects';
import { useStudentSubscription } from './subscription/subscriptionContext';
import useAIQuota from '../../hooks/useAIQuota';
import { deriveSidebarAiPlan } from '../../utils/sidebarAiPlan';
import { formatAiPlanExpiry } from '../../data/aiPackagesData';
import { getDewSkillThemeAttr } from '../../utils/dewskillTheme';
import { formatCourseExpiryDate, getCourseTimeRemaining } from '../../utils/courseAccessTime';
import { useActiveCourse } from '../../context/ActiveCourseContext';
import { formatVnd } from '../../utils/subscription';
import { useData } from '../../context/DataContext';
import { useToast } from '../../utils/useToast';
import { clearStorageKeepingPreferences } from '../../utils/logoutStorage';
import LanguageSwitcher from '../LanguageSwitcher';

function openChangePassword() {
  window.dispatchEvent(new CustomEvent('open-change-password-modal'));
}

function normalizeCourseName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function formatDateDisplay(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('vi-VN');
  } catch {
    return String(d);
  }
}

export default function StudentProfileTab({
  studentData,
  progressPct: _progressPct = 0,
  setShowUpdateProfileModal,
  setShowTuitionModal,
  sessionGender = '',
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { onLogout, examSubjectsCatalog } = useData();
  const subCtx = useStudentSubscription();
  const aiQuota = useAIQuota({ autoFetch: true });
  const { enrolledCourses, activeCourseId, setActiveCourseId, openAddCourse } = useActiveCourse();
  const themeAttr = getDewSkillThemeAttr(studentData ? { ...studentData, role: 'student' } : null);
  const isDewSkill = themeAttr === 'dewskill';
  const isFreePortal = isFreePortalSelfRegistrationStudent(studentData ? { ...studentData, role: 'student' } : null)
    || (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student'));
  const history = subCtx?.overview?.history || [];

  const [openSections, setOpenSections] = useState({
    courses: true,
    freeSubjects: true,
    devices: false,
    support: false,
  });
  const [certificateCourse, setCertificateCourse] = useState(null);
  const [shareAchievementData, setShareAchievementData] = useState(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [showAllFreeSubjects, setShowAllFreeSubjects] = useState(false);
  const [coursePurchases, setCoursePurchases] = useState([]);
  const [showAllCoursePurchases, setShowAllCoursePurchases] = useState(false);
  const [lessonProgress, setLessonProgress] = useState({
    loading: true,
    error: '',
    catalogById: new Map(),
    catalogByName: new Map(),
    openedSubjects: [],
  });
  const [freePathTopics, setFreePathTopics] = useState({ loading: false, items: [] });
  const [freshExamProgress, setFreshExamProgress] = useState(null);
  const studentId = String(
    studentData?.id || studentData?._id || (() => {
      try { return JSON.parse(localStorage.getItem('student_user') || '{}').id; } catch { return ''; }
    })(),
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLessonProgress((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const res = await lessonPracticeApi.student.subjects();
        if (cancelled) return;
        const allCatalogCourses = res.data?.courses || [];
        const catalogById = new Map();
        const catalogByName = new Map();
        allCatalogCourses.forEach((course) => {
          catalogById.set(String(course.id), course);
          catalogByName.set(normalizeCourseName(course.name), course);
        });
        const openedSubjects = (res.data?.subjects || []).filter(
          (subj) => subj.opened && (Number(subj.totalUnitCount) || 0) > 0,
        );
        setLessonProgress({ loading: false, error: '', catalogById, catalogByName, openedSubjects });
      } catch (err) {
        if (!cancelled) {
          setLessonProgress({
            loading: false,
            error: err.message || 'Không tải được tiến độ bài học',
            catalogById: new Map(),
            catalogByName: new Map(),
            openedSubjects: [],
          });
        }
      }
    };
    const refresh = () => load();
    load();
    window.addEventListener('focus', refresh);
    window.addEventListener('lesson-practice-progress-updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('lesson-practice-progress-updated', refresh);
    };
  }, [studentId]);

  useEffect(() => {
    if (!isFreePortal) return undefined;
    let cancelled = false;
    const loadFreeTopics = async () => {
      setFreePathTopics((prev) => ({ ...prev, loading: prev.items.length === 0 }));
      try {
        const data = await dailyPracticeApi.student.path();
        if (cancelled) return;
        setFreePathTopics({ loading: false, items: Array.isArray(data?.topics) ? data.topics : [] });
      } catch {
        if (!cancelled) setFreePathTopics((prev) => ({ ...prev, loading: false }));
      }
    };
    loadFreeTopics();
    window.addEventListener('focus', loadFreeTopics);
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, loadFreeTopics);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadFreeTopics);
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, loadFreeTopics);
    };
  }, [isFreePortal, studentId]);

  useEffect(() => {
    if (!studentId) return undefined;
    let cancelled = false;
    const loadPurchaseHistory = async () => {
      try {
        const res = await dewskillClassApi.myPurchaseHistory();
        if (!cancelled && Array.isArray(res?.data)) {
          setCoursePurchases(res.data);
        }
      } catch { /* ignore */ }
    };
    loadPurchaseHistory();
    window.addEventListener('focus', loadPurchaseHistory);
    window.addEventListener('cms:subscription-updated', loadPurchaseHistory);
    window.addEventListener('cms:ai-plan-updated', loadPurchaseHistory);
    window.addEventListener('free-portal-unlocked', loadPurchaseHistory);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadPurchaseHistory);
      window.removeEventListener('cms:subscription-updated', loadPurchaseHistory);
      window.removeEventListener('cms:ai-plan-updated', loadPurchaseHistory);
      window.removeEventListener('free-portal-unlocked', loadPurchaseHistory);
    };
  }, [studentId]);

  useEffect(() => {
    if (isFreePortal || !studentId) return undefined;
    let cancelled = false;
    const loadExamProgress = async () => {
      try {
        const res = await api.students.getById(studentId);
        const data = res?.data || res;
        if (!cancelled && Array.isArray(data?.examProgress)) {
          setFreshExamProgress(data.examProgress);
        }
      } catch { /* ignore */ }
    };
    loadExamProgress();
    window.addEventListener('focus', loadExamProgress);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadExamProgress);
    };
  }, [isFreePortal, studentId]);

  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const profileGender = studentData?.gender || sessionGender || '';

  const teacherValue = Array.isArray(studentData?.teacherNames) && studentData.teacherNames.length
    ? studentData.teacherNames.join(', ')
    : (Array.isArray(studentData?.teacher)
      ? studentData.teacher.filter(Boolean).join(', ')
      : (studentData?.teacher || 'Chưa phân công'));

  const courses = Array.isArray(studentData?.courses) ? studentData.courses : [];
  const effectiveExamProgress = freshExamProgress || studentData?.examProgress || [];
  const catalogForCourse = (course) => {
    const courseId = String(course.courseId || '');
    return (courseId && lessonProgress.catalogById.get(courseId))
      || lessonProgress.catalogByName.get(normalizeCourseName(course.courseName || course.name))
      || null;
  };

  const freeSubjectItems = React.useMemo(() => {
    if (!isFreePortal) return [];
    const seenNames = new Set();
    const rows = [];
    (freePathTopics.items || []).forEach((item) => {
      const id = String(item?.topic?.id || '');
      const name = String(item?.topic?.name || '').trim();
      if (!id || !name) return;
      seenNames.add(normalizeCourseName(name));
      const total = Number(item.totalUnits) || 0;
      const done = Math.min(total, Number(item.completedUnits) || 0);
      const completed = total > 0 && done >= total;
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      rows.push({
        key: `path-${id}`,
        id,
        name,
        done,
        total,
        unitLabel: 'chặng',
        pct,
        completed,
        href: '/student/daily-practice',
      });
    });
    (lessonProgress.openedSubjects || []).forEach((subj) => {
      const id = String(subj?.id || '');
      const name = String(subj?.name || '').trim();
      if (!id || !name || seenNames.has(normalizeCourseName(name))) return;
      const total = Number(subj.totalUnitCount) || 0;
      const done = Math.min(total, Number(subj.completedUnitCount) || 0);
      const completed = total > 0 && done >= total;
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      rows.push({
        key: `lesson-${id}`,
        id,
        name,
        done,
        total,
        unitLabel: 'bài',
        pct,
        completed,
        href: `/student/lesson-practice/subjects/${encodeURIComponent(id)}`,
      });
    });
    return rows.sort((a, b) => Number(b.completed) - Number(a.completed) || b.pct - a.pct);
  }, [isFreePortal, freePathTopics.items, lessonProgress.openedSubjects]);
  const completedFreeSubjectsCount = freeSubjectItems.filter((item) => item.completed).length;

  const handleEnableNotification = async () => {
    if (!('Notification' in window)) {
      toast.error('Trình duyệt không hỗ trợ thông báo.');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        toast.success('Đã bật quyền thông báo cho trình duyệt này!');
      } else if (res === 'denied') {
        toast.error('Quyền thông báo đang bị chặn. Vui lòng cho phép trong cài đặt trình duyệt.');
      } else {
        toast.info('Bạn chưa xác nhận quyền thông báo.');
      }
    } catch {
      toast.error('Không thể kích hoạt thông báo.');
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      clearStorageKeepingPreferences();
      window.location.href = '/login';
    }
  };

  const aiPlanCard = deriveSidebarAiPlan({
    aiQuotaPercent: aiQuota.aiQuotaPercent,
    aiPlan: aiQuota.aiPlan,
    isPaidUnlimited: aiQuota.isPaidUnlimited,
  });
  const aiExpiryText = formatAiPlanExpiry(aiQuota.aiPlan?.expiresAt);
  const aiDurationLine = aiPlanCard.remainingDays > 0
    ? `Còn ${aiPlanCard.remainingDays} ngày sử dụng`
    : `Còn ${aiPlanCard.remainingHours} giờ`;
  const aiCardTone = aiPlanCard.isSubscribed
    ? {
      iconBg: 'bg-gradient-to-br from-[#F59E0B] to-[#D97706]',
      text: 'text-[#B45309]',
    }
    : aiPlanCard.quotaPercent <= 0
      ? {
        iconBg: 'bg-gradient-to-br from-[#EF4444] to-[#DC2626]',
        text: 'text-[#DC2626]',
      }
      : aiPlanCard.quotaPercent <= 20
        ? {
          iconBg: 'bg-gradient-to-br from-[#F97316] to-[#EA580C]',
          text: 'text-[#EA580C]',
        }
        : {
          iconBg: 'bg-gradient-to-br from-[#10B981] to-[#059669]',
          text: 'text-[#059669]',
        };

  return (
    <div data-theme={themeAttr} className="w-full max-w-6xl mx-auto space-y-4 sm:space-y-5 py-2 sm:py-4 px-1 sm:px-2 animate-in fade-in duration-300">
      {/* ── 1. Thẻ Hero hồ sơ cá nhân (Đồng bộ 100% Mobile App + Responsive Desktop) ── */}
      <div className="rounded-[22px] sm:rounded-[24px] border-[1.5px] p-4 sm:p-6 lg:px-7 flex items-center justify-between gap-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)] border-[#CCFBF1] bg-[#F0FDFA] dark:border-emerald-800/60 dark:bg-emerald-950/35">
        <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
          <div className="relative shrink-0">
            <EditableAvatar
              avatar={studentData?.avatar}
              name={studentData?.name}
              role="student"
              gender={profileGender}
              className="w-[76px] h-[76px] lg:w-[88px] lg:h-[88px] rounded-full border-2 border-white dark:border-emerald-700 shadow-xs cursor-pointer bg-[#CCFBF1] dark:bg-emerald-900/60"
            />
            <div className="absolute right-0 bottom-0 w-[25px] h-[25px] lg:w-[28px] lg:h-[28px] rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-white shadow-xs pointer-events-none bg-[#0FAF9F]">
              <Camera size={14} className="text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
            <p className="text-[11px] font-black tracking-[0.8px] uppercase text-[#0F766E] dark:text-teal-300">
              Hồ sơ cá nhân
            </p>
            <h2 className="text-[18px] sm:text-[22px] lg:text-[24px] font-black text-[#0F172A] dark:text-slate-50 truncate leading-tight">
              {studentData?.name || studentData?.phone || 'Học viên'}
            </h2>
            <p className="text-[12px] sm:text-[13px] font-medium text-[#64748B] dark:text-slate-300">
              Chạm vào ảnh để thay đổi ảnh đại diện
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowUpdateProfileModal(true)}
          className={isDewSkill
            ? 'hidden sm:inline-flex dew-btn-white !text-emerald-700 items-center gap-1.5 min-h-[38px] px-4 text-[13px] font-bold cursor-pointer shrink-0'
            : 'hidden sm:inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-xl text-[13px] font-bold transition cursor-pointer !shadow-none shrink-0 bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5] dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/80 border border-emerald-200/80 dark:border-emerald-700/60'}
        >
          <Settings size={15} />
          <span>Chỉnh sửa hồ sơ</span>
        </button>
      </div>

      {/* ── Lưới 2 cột Responsive cho Màn hình Vừa & Rộng ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        <div className="lg:col-span-6 space-y-4">
          {/* ── 2. Gói hỗ trợ AI & Lịch sử gia hạn ── */}
          <div className="rounded-[20px] bg-white border-[1.5px] border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.06)] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-[#F59E0B]" />
                <h3 className="text-[15px] font-extrabold text-[#1E293B]">Gói hỗ trợ AI</h3>
              </div>
              {aiPlanCard.isSubscribed && (
                <span
                  title="Không giới hạn"
                  className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-extrabold text-[#B45309]"
                >
                  Unlimited
                </span>
              )}
            </div>

            <div className="mt-3.5 p-3.5 rounded-[16px] bg-[#F8FAFC] border border-[#F1F5F9] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 text-white ${aiCardTone.iconBg}`}>
                  <Sparkles size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[14px] font-black text-[#0F172A] truncate">
                    {aiPlanCard.isSubscribed ? aiPlanCard.planName : 'Gói AI Miễn phí'}
                  </h4>
                  <p className={`text-[12px] font-bold truncate mt-0.5 ${aiCardTone.text}`}>
                    {aiPlanCard.isSubscribed
                      ? `${aiExpiryText ? `Hạn đến ${aiExpiryText} · ` : ''}${aiDurationLine}`
                      : (aiPlanCard.quotaPercent > 0
                        ? `Còn ${aiPlanCard.quotaPercent}% dung lượng AI hôm nay`
                        : 'Đã hết dung lượng AI hôm nay')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => aiQuota.openPackagesModal()}
                className={isDewSkill
                  ? 'dew-btn-primary shrink-0 min-h-[38px] px-4 py-1.5 text-[12.5px] font-extrabold text-white cursor-pointer'
                  : 'shrink-0 min-h-[36px] rounded-[12px] px-3.5 py-1.5 text-[12px] font-extrabold text-white transition hover:brightness-105 active:translate-y-[1px] !shadow-none cursor-pointer bg-[#10B981] border border-[#34D399] border-b-[3px] border-b-[#059669]'}
              >
                {aiPlanCard.isSubscribed ? 'Gia hạn' : 'Nâng cấp'}
              </button>
            </div>

            {history.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#64748B] mb-2">
                  <History size={14} />
                  <span>Lịch sử gia hạn</span>
                </div>
                <div className="divide-y divide-[#F1F5F9]">
                  {(showAllHistory ? history : history.slice(0, 1)).map((h, idx) => {
                    const sourceText = h.source === 'code'
                      ? 'Mã kích hoạt'
                      : h.source === 'admin'
                        ? 'Trung tâm cập nhật'
                        : 'Thanh toán';
                    return (
                      <div key={h.id || idx} className="py-2 flex items-center justify-between text-[12px]">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-semibold text-[#334155] truncate">
                            {sourceText} · {h.planLabel || h.planId || h.plan || 'Gói hỗ trợ AI'} {h.amount ? `· ${formatVnd(h.amount)}` : ''}
                          </p>
                        </div>
                        <span className="text-[#94A3B8] font-medium shrink-0">
                          {h.createdAt ? new Date(h.createdAt).toLocaleDateString('vi-VN') : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {history.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowAllHistory((prev) => !prev)}
                    className="mt-2 w-full py-1.5 rounded-[10px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[12px] font-bold flex items-center justify-center gap-1 transition cursor-pointer !shadow-none text-[#059669]"
                  >
                    <span>{showAllHistory ? 'Thu gọn' : `Xem thêm (${history.length - 1})`}</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${showAllHistory ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── 3. Khóa học đã đăng ký (tài khoản theo khóa) / Môn học & Chứng nhận (tài khoản miễn phí) ── */}
          {!isFreePortal ? (
            <div className="rounded-[20px] bg-white border-[1.5px] border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.06)] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('courses')}
                aria-expanded={openSections.courses}
                className={`w-full min-h-[48px] flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50/60 transition cursor-pointer !shadow-none ${openSections.courses ? 'border-b border-[#E9EEF2]' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen size={16} className="text-[#2563EB] shrink-0" />
                  <h3 className="text-[14px] font-extrabold text-[#0F172A] truncate">Khóa học đã đăng ký</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[11px] font-extrabold">
                    {courses.length}
                  </span>
                </div>
                <ChevronDown size={17} className={`text-[#64748B] shrink-0 transition-transform duration-200 ${openSections.courses ? 'rotate-180' : ''}`} />
              </button>

              {openSections.courses && (
                <div className="divide-y divide-[#E9EEF2]">
                  {courses.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <p className="text-[15px] font-bold text-[#0F172A]">Chưa có khóa học</p>
                      <p className="text-[13px] text-[#64748B] mt-1">Khóa học được phân công sẽ hiển thị tại đây.</p>
                    </div>
                  ) : (
                    <>
                      {(showAllCourses ? courses : courses.slice(0, 1)).map((c) => {
                      const title = c.courseName || c.name || 'Khóa học';
                      const freeCourse = isFreePortalCourseName(title);
                      const catalogCourse = catalogForCourse(c);
                      const total = freeCourse ? 0 : (Number(c.totalSessions) || 12);
                      const done = freeCourse ? 0 : (Number(c.completedSessions) || 0);
                      const sessionsDone = !freeCourse && ((total > 0 && done >= total) || c.status === 'completed');
                      const examEval = evaluateCourseCertificateStatus(c, {
                        examProgress: effectiveExamProgress,
                        examSubjectsCatalog,
                        fallbackExamSubjectIds: catalogCourse?.examSubjectIds || [],
                      });
                      const requiresExamPass = !freeCourse && examEval.totalExams > 0;
                      const isCompleted = !freeCourse && sessionsDone && (!requiresExamPass || examEval.allExamsPassed);
                      const awaitingExams = !freeCourse && sessionsDone && requiresExamPass && !examEval.allExamsPassed;
                      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100) || 0) : 0;

                      return (
                        <div key={c.id || c.enrollmentId || title} className="px-4 py-3.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-[14px] font-bold text-[#0F172A] truncate">{title}</h4>
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${isCompleted
                                ? 'bg-[#EFF6FF] text-[#2563EB]'
                                : awaitingExams
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-[#ECFDF5] text-[#16A34A]'
                              }`}>
                              {isCompleted ? 'Hoàn thành' : (awaitingExams ? `Chờ thi (${examEval.passedExams}/${examEval.totalExams} môn)` : 'Đang học')}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#64748B]">
                            GV: {c.teacherName || teacherValue || 'Chưa phân công'}{c.registeredAt ? ` · ${formatDateDisplay(c.registeredAt)}` : ''}
                          </p>
                          <div className="w-full bg-[#E9EFF0] h-2 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all bg-[#10B981]" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-[#64748B]">
                              {done}/{total} buổi · Tiến độ {pct}%
                            </span>
                            <span className="font-extrabold text-[#0F172A]">{c.avgGrade ?? 0} TB</span>
                          </div>
                          {requiresExamPass ? (
                            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
                                <span>Thi chứng nhận môn học</span>
                                <span className={examEval.allExamsPassed ? 'text-emerald-700' : 'text-amber-700'}>
                                  Đạt {examEval.passedExams}/{examEval.totalExams} môn
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {examEval.subjects.map((sub) => (
                                  <span
                                    key={sub.id}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10.5px] font-bold ${sub.passed
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border-slate-200 bg-white text-slate-600'
                                      }`}
                                  >
                                    {sub.passed ? <CheckCircle2 size={11} /> : <Clock size={11} className="text-amber-500" />}
                                    {sub.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {isCompleted ? (
                            <div className="pt-1 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setCertificateCourse({
                                  courseId: String(c.courseId || c.id || ''),
                                  courseTitle: title,
                                  instructorName: c.teacherName || (teacherValue && teacherValue !== 'Chưa phân công' ? teacherValue : '') || 'Trung tâm Thắng Tin Học',
                                  completionRate: 100,
                                  avgGrade: examEval.averageExamScore ?? (Number(c.avgGrade) > 0 ? Number(c.avgGrade) : null),
                                  examsPassed: true,
                                  scope: 'course',
                                })}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                              >
                                <QrCode size={13} /> Xem chứng nhận QR
                              </button>
                              <ShareTriggerButton
                                onClick={() => setShareAchievementData(buildCourseOrCertShareData({
                                  title,
                                  scope: 'course',
                                  studentName: studentData?.name || '',
                                  completionRate: 100,
                                  avgGrade: examEval.averageExamScore ?? (Number(c.avgGrade) > 0 ? Number(c.avgGrade) : null),
                                }))}
                                label="SHARE"
                                size="sm"
                              />
                            </div>
                          ) : awaitingExams ? (
                            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[11px] font-semibold text-amber-800">
                              <span className="inline-flex items-center gap-1.5 min-w-0">
                                <Lock size={12} className="shrink-0 text-amber-600" />
                                <span>Hoàn thành số buổi chưa đủ — cần thi đạt tất cả {examEval.totalExams} môn để nhận chứng nhận.</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => navigate('/student/exam')}
                                className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 text-[10.5px] font-extrabold transition cursor-pointer"
                              >
                                Vào phòng thi
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                      {courses.length > 1 && (
                        <div className="px-4 py-2.5 bg-white">
                          <button
                            type="button"
                            onClick={() => setShowAllCourses((prev) => !prev)}
                            className="w-full py-1.5 rounded-[10px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[12px] font-bold flex items-center justify-center gap-1 transition cursor-pointer !shadow-none text-[#059669]"
                          >
                            <span>{showAllCourses ? 'Thu gọn' : `Xem thêm (${courses.length - 1})`}</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${showAllCourses ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="dew-app-card dew-app-card--emerald mb-4 overflow-hidden">
                <div className={`w-full min-h-[52px] flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${openSections.courses ? 'border-b border-emerald-100/80' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggleSection('courses')}
                    aria-expanded={openSections.courses}
                    className="flex flex-1 items-center gap-2 min-w-0 text-left cursor-pointer !shadow-none hover:opacity-85 transition"
                  >
                    <GraduationCap size={17} className="text-[#059669] shrink-0" />
                    <h3 className="text-[14px] font-extrabold text-[#0F172A] truncate">
                      Khóa học đã đăng ký ({enrolledCourses.length})
                    </h3>
                    <span className="text-[11px] font-bold text-[#059669] shrink-0">
                      {openSections.courses ? 'Thu gọn' : 'Xem'}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-[#64748B] shrink-0 transition-transform duration-200 ${openSections.courses ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddCourse()}
                    className="dew-btn-primary inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                  >
                    <Plus size={13} /> Đăng ký thêm khóa
                  </button>
                </div>

                {openSections.courses && (
                  <div className="p-4 space-y-3">
                    {enrolledCourses.length === 0 ? (
                      <div className="py-5 text-center">
                        <p className="text-[14px] font-bold text-[#0F172A]">Bạn chưa đăng ký khóa học nào</p>
                        <p className="text-[12px] text-[#64748B] mt-1">Chọn lớp học phù hợp để bắt đầu luyện tập hoặc học thử miễn phí Chặng 1.</p>
                      </div>
                    ) : (
                      <>
                        {(showAllCourses ? enrolledCourses : enrolledCourses.slice(0, 1)).map((c) => {
                        const isCurrent = c.id === activeCourseId;
                        const isOwned = c.status === 'owned';
                        const pct = Math.max(0, Math.min(100, Number(c.progress) || 0));
                        const timeInfo = getCourseTimeRemaining(c.accessExpiresAt);
                        const durationMonths = Math.max(1, Number(c.durationMonths) || 12);
                        return (
                          <div
                            key={c.id}
                            className={`rounded-2xl border p-3.5 transition-all ${isCurrent
                                ? 'bg-emerald-50/75 border-emerald-200 shadow-sm'
                                : 'bg-white/80 border-white shadow-xs'
                              }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h4 className="text-[14px] font-extrabold text-[#0F172A] truncate">
                                    {c.title}
                                  </h4>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${isOwned
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-sky-100 text-sky-700'
                                      }`}
                                  >
                                    {isOwned ? 'Đã kích hoạt ✓' : 'Đang học thử'}
                                  </span>
                                  {isOwned && c.includesMeet !== false ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                                      <Video size={10} /> Có học Meet GV
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                                  {c.level || c.badge || 'Lộ trình DewSkill'} · {c.currentStage || 'Chặng 1'} · {pct}%
                                </p>
                                {isOwned ? (
                                  <div
                                    className={`mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold ${
                                      timeInfo.isExpiringSoon
                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                        : 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800'
                                    }`}
                                  >
                                    <Clock size={11} className="shrink-0" />
                                    <span>Gói {durationMonths} tháng · {timeInfo.detailNote}</span>
                                    <span className="font-medium text-slate-500">· Hết hạn sẽ khóa &amp; đặt lại về ban đầu</span>
                                  </div>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCourseId(c.id);
                                  navigate('/student/daily-practice');
                                }}
                                className="dew-btn-primary inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[11px] font-extrabold text-white shrink-0 cursor-pointer"
                              >
                                Vào học <ArrowRight size={12} />
                              </button>
                            </div>
                            <div className="mt-2.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#34D399] via-[#10B981] to-[#059669] transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                        {enrolledCourses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setShowAllCourses((prev) => !prev)}
                            className="w-full py-1.5 rounded-[10px] bg-white/80 hover:bg-emerald-50 border border-emerald-100 text-[12px] font-bold flex items-center justify-center gap-1 transition cursor-pointer !shadow-none text-[#059669]"
                          >
                            <span>{showAllCourses ? 'Thu gọn' : `Xem thêm (${enrolledCourses.length - 1})`}</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${showAllCourses ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-[20px] bg-white border-[1.5px] border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.06)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('freeSubjects')}
                  aria-expanded={openSections.freeSubjects}
                  className={`w-full min-h-[48px] flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50/60 transition cursor-pointer !shadow-none ${openSections.freeSubjects ? 'border-b border-[#E9EEF2]' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Award size={16} className="text-[#059669] shrink-0" />
                    <h3 className="text-[14px] font-extrabold text-[#0F172A] truncate">Môn học &amp; Chứng nhận</h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[11px] font-extrabold">
                      {completedFreeSubjectsCount}/{freeSubjectItems.length} xong
                    </span>
                  </div>
                  <ChevronDown size={17} className={`text-[#64748B] shrink-0 transition-transform duration-200 ${openSections.freeSubjects ? 'rotate-180' : ''}`} />
                </button>

                {openSections.freeSubjects && (
                  <div className="divide-y divide-[#E9EEF2]">
                    {freePathTopics.loading && freeSubjectItems.length === 0 ? (
                      <div className="py-6 px-4 text-center text-[13px] font-medium text-[#64748B]">
                        Đang tải tiến độ môn học...
                      </div>
                    ) : freeSubjectItems.length === 0 ? (
                      <div className="py-8 px-4 text-center">
                        <p className="text-[15px] font-bold text-[#0F172A]">Chưa có môn học</p>
                        <p className="text-[13px] text-[#64748B] mt-1">Hoàn thành từng môn học để mở khóa tải chứng nhận.</p>
                      </div>
                    ) : (
                      <>
                        {(showAllFreeSubjects ? freeSubjectItems : freeSubjectItems.slice(0, 1)).map((sub) => (
                        <div key={sub.key} className="px-4 py-3.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-[14px] font-bold text-[#0F172A] truncate">{sub.name}</h4>
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${sub.completed
                                ? 'bg-[#ECFDF5] text-[#059669]'
                                : 'bg-slate-100 text-slate-600'
                              }`}>
                              {sub.completed ? 'Đã học xong' : (sub.done > 0 ? 'Đang học' : 'Chưa học')}
                            </span>
                          </div>
                          <div className="w-full bg-[#E9EFF0] h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${sub.completed ? 'bg-[#059669]' : 'bg-[#10B981]'}`}
                              style={{ width: `${sub.pct}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                            <span className="text-[#64748B]">
                              {sub.done}/{sub.total} {sub.unitLabel} · Tiến độ {sub.pct}%
                            </span>
                            {sub.completed ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setCertificateCourse({
                                    courseId: sub.id,
                                    courseTitle: sub.name,
                                    instructorName: 'Trung tâm Thắng Tin Học',
                                    completionRate: 100,
                                    avgGrade: null,
                                    examsPassed: true,
                                    scope: 'subject',
                                  })}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                                >
                                  <QrCode size={13} /> Xem &amp; tải chứng nhận
                                </button>
                                <ShareTriggerButton
                                  onClick={() => setShareAchievementData(buildCourseOrCertShareData({
                                    title: sub.name,
                                    scope: 'subject',
                                    studentName: studentData?.name || '',
                                    completionRate: 100,
                                  }))}
                                  label="SHARE"
                                  size="sm"
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate(sub.href)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                              >
                                <Lock size={11} className="text-slate-400" /> Học xong để tải
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                        {freeSubjectItems.length > 1 && (
                          <div className="px-4 py-2.5 bg-white">
                            <button
                              type="button"
                              onClick={() => setShowAllFreeSubjects((prev) => !prev)}
                              className="w-full py-1.5 rounded-[10px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[12px] font-bold flex items-center justify-center gap-1 transition cursor-pointer !shadow-none text-[#059669]"
                            >
                              <span>{showAllFreeSubjects ? 'Thu gọn' : `Xem thêm (${freeSubjectItems.length - 1})`}</span>
                              <ChevronDown size={14} className={`transition-transform duration-200 ${showAllFreeSubjects ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Lịch sử thanh toán (Khóa học & Gói AI) ── */}
          {(isDewSkill || isFreePortal || coursePurchases.length > 0) ? (
            <div className="rounded-[20px] bg-white border-[1.5px] border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.06)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
                <div className="flex items-center gap-2">
                  <History size={17} className="text-[#059669]" />
                  <h3 className="text-[14px] font-extrabold text-[#0F172A]">Lịch sử thanh toán</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[11px] font-extrabold">
                  {coursePurchases.length} giao dịch
                </span>
              </div>

              {coursePurchases.length === 0 ? (
                <p className="py-4 text-center text-[12px] font-medium text-[#64748B]">
                  Chưa có lịch sử thanh toán. Khi đăng ký khóa học hoặc Gói AI, thông tin sẽ được lưu tại đây.
                </p>
              ) : (
                <>
                  <div className="divide-y divide-[#F1F5F9]">
                    {(showAllCoursePurchases ? coursePurchases : coursePurchases.slice(0, 1)).map((item, idx) => {
                      const isAi = item.purchaseType === 'ai_package';
                      const sourceLabel = item.source === 'code'
                        ? 'Mã kích hoạt'
                        : item.source === 'admin'
                          ? 'Trung tâm cấp'
                          : 'Chuyển khoản QR';
                      const timeLeft = getCourseTimeRemaining(item.expiresAt);
                      const isExpired = item.status === 'expired' || timeLeft.isExpired;
                      const durationText = item.durationLabel || `${item.durationMonths || 12} tháng`;
                      return (
                        <div key={item.id || idx} className="py-2.5 flex flex-wrap items-start justify-between gap-2 text-[12px]">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${
                                  isAi
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-sky-50 text-sky-700 border-sky-200'
                                }`}
                              >
                                {isAi ? 'Gói AI' : 'Khóa học'}
                              </span>
                              <p className="font-extrabold text-[#0F172A] truncate">{item.courseName}</p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  isExpired
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {isExpired ? (isAi ? 'Đã hết hạn' : 'Đã hết hạn · Đã đặt lại') : timeLeft.shortNote}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-[#64748B]">
                              {sourceLabel}
                              {item.amount > 0 ? ` · ${formatVnd(item.amount)}` : ''}
                              {` · Gói ${durationText}`}
                              {isAi ? ' · Hỏi AI Unlimited' : (item.includesMeet !== false ? ' · Có học Meet GV' : '')}
                            </p>
                          </div>
                          <div className="text-right shrink-0 text-[11px] font-semibold text-[#64748B]">
                            <div>Mua: {formatCourseExpiryDate(item.startsAt || item.createdAt) || '-'}</div>
                            {item.expiresAt ? (
                              <div className={isExpired ? 'text-rose-600' : 'text-emerald-700'}>
                                Hạn: {formatCourseExpiryDate(item.expiresAt)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {coursePurchases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllCoursePurchases((prev) => !prev)}
                      className="mt-2 w-full py-1.5 rounded-[10px] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[12px] font-bold flex items-center justify-center gap-1 transition cursor-pointer !shadow-none text-[#059669]"
                    >
                      <span>{showAllCoursePurchases ? 'Thu gọn' : `Xem thêm (${coursePurchases.length - 1})`}</span>
                      <ChevronDown size={14} className={`transition-transform duration-200 ${showAllCoursePurchases ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-6 space-y-4">
          {/* ── 5. Menu Bảo mật & Tiện ích (Đồng bộ vị trí & giao diện Mobile App) ── */}
          <div className="rounded-[20px] bg-white border-[1.5px] border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.06)] px-4 py-1 divide-y divide-[#F1F5F9]">
            <button
              type="button"
              onClick={() => setShowUpdateProfileModal(true)}
              className="w-full min-h-[60px] flex items-center gap-3.5 py-2.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer !shadow-none"
            >
              <span className="w-[38px] h-[38px] rounded-[12px] bg-[#F8FAFC] flex items-center justify-center shrink-0 text-[#10B981]">
                <User size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#0F172A]">Thông tin cá nhân</p>
                <p className="text-[12px] text-[#64748B] mt-0.5">Xem và chỉnh sửa họ tên, liên hệ, hồ sơ</p>
              </div>
              <ChevronRight size={18} className="text-[#64748B] shrink-0" />
            </button>

            <button
              type="button"
              onClick={openChangePassword}
              className="w-full min-h-[60px] flex items-center gap-3.5 py-2.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer !shadow-none"
            >
              <span className="w-[38px] h-[38px] rounded-[12px] bg-[#F8FAFC] flex items-center justify-center shrink-0 text-[#10B981]">
                <Settings size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#0F172A]">Thay đổi mật khẩu</p>
                <p className="text-[12px] text-[#64748B] mt-0.5">Cập nhật mật khẩu đăng nhập</p>
              </div>
              <ChevronRight size={18} className="text-[#64748B] shrink-0" />
            </button>

            <button
              type="button"
              onClick={openPinLockSettings}
              className="w-full min-h-[60px] flex items-center gap-3.5 py-2.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer !shadow-none"
            >
              <span className="w-[38px] h-[38px] rounded-[12px] bg-[#F8FAFC] flex items-center justify-center shrink-0 text-[#10B981]">
                <KeyRound size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#0F172A]">Khóa mã PIN</p>
                <p className="text-[12px] text-[#64748B] mt-0.5">Tự khóa màn hình khi không thao tác</p>
              </div>
              <ChevronRight size={18} className="text-[#64748B] shrink-0" />
            </button>

            <button
              type="button"
              onClick={openLearningGoal}
              className="w-full min-h-[60px] flex items-center gap-3.5 py-2.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer !shadow-none"
            >
              <span className="w-[38px] h-[38px] rounded-[12px] bg-[#F8FAFC] flex items-center justify-center shrink-0 text-[#10B981]">
                <Target size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#0F172A]">Mục tiêu học</p>
                <p className="text-[12px] text-[#64748B] mt-0.5">Đặt hoặc đổi số giờ học mỗi ngày</p>
              </div>
              <ChevronRight size={18} className="text-[#64748B] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/student/center-info')}
              className="w-full min-h-[60px] flex items-center gap-3.5 py-2.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer !shadow-none"
            >
              <span className="w-[38px] h-[38px] rounded-[12px] bg-[#F8FAFC] flex items-center justify-center shrink-0 text-[#10B981]">
                <Users size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#0F172A]">Liên hệ Trung tâm</p>
                <p className="text-[12px] text-[#64748B] mt-0.5">Thông tin trung tâm</p>
              </div>
              <ChevronRight size={18} className="text-[#64748B] shrink-0" />
            </button>

            {/* Thiết bị đã đăng nhập & bảo vệ tài khoản */}
            {(() => {
              const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
              const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
              const osLabel = /Windows NT/i.test(ua)
                ? 'Windows PC'
                : /Mac OS X|Macintosh/i.test(ua)
                  ? 'macOS'
                  : /Android/i.test(ua)
                    ? 'Android'
                    : /iPhone|iPad|iPod/i.test(ua)
                      ? 'iPhone / iPad'
                      : /Linux/i.test(ua)
                        ? 'Linux'
                        : 'Thiết bị Web';
              const browserLabel = /Edg\//i.test(ua)
                ? 'Microsoft Edge'
                : /Chrome\//i.test(ua) && !/Edg\//i.test(ua)
                  ? 'Google Chrome'
                  : /Safari\//i.test(ua) && !/Chrome\//i.test(ua)
                    ? 'Safari'
                    : /Firefox\//i.test(ua)
                      ? 'Firefox'
                      : 'Trình duyệt';
              const deviceCount = Math.min(3, Math.max(1, Number(studentData?.knownDeviceCount) || 1));
              const deviceSummary = String(studentData?.knownDeviceSummary || '').trim();
              const DeviceIcon = isMobileUa ? Smartphone : Laptop;
              return (
                <div>
                  <button
                    type="button"
                    onClick={() => toggleSection('devices')}
                    className="w-full min-h-[60px] flex items-center gap-3.5 py-2.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer !shadow-none"
                  >
                    <span className="w-[38px] h-[38px] rounded-[12px] bg-[#F8FAFC] flex items-center justify-center shrink-0 text-[#10B981]">
                      <Shield size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#0F172A]">Thiết bị đã đăng nhập</p>
                      <p className="text-[12px] text-[#64748B] mt-0.5 tabular-nums">
                        {deviceCount}/3 thiết bị được phép • Bảo vệ tài khoản
                      </p>
                    </div>
                    {openSections.devices ? (
                      <ChevronDown size={18} className="text-[#64748B] shrink-0" />
                    ) : (
                      <ChevronRight size={18} className="text-[#64748B] shrink-0" />
                    )}
                  </button>

                  {openSections.devices && (
                    <div className="pb-3.5 pt-1 pl-[52px] pr-1 space-y-2.5">
                      <div className="p-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-[10px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                            <DeviceIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-[#0F172A] truncate">
                              {osLabel} • {browserLabel}
                            </p>
                            <p className="text-[11px] text-[#64748B] mt-0.5">
                              Phiên trình duyệt hiện tại
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Đang hoạt động
                        </span>
                      </div>

                      {deviceSummary ? (
                        <p className="text-[11.5px] text-[#475569] leading-relaxed">
                          <span className="font-semibold text-[#0F172A]">Thiết bị đã ghi nhận:</span>{' '}
                          {deviceSummary}
                        </p>
                      ) : null}

                      <div className="p-2.5 rounded-[10px] bg-emerald-50/70 border border-emerald-200/70 text-[11px] text-emerald-800 leading-relaxed">
                        Hệ thống tự động ghi nhớ tối đa <strong>3 thiết bị</strong> quen thuộc ({deviceCount}/3 đang dùng) để bảo vệ tiến độ học tập và ngăn đăng nhập trái phép.
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Cài đặt và hỗ trợ (mặc định thu gọn, bấm vào mới mở) */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection('support')}
                aria-expanded={openSections.support}
                className="w-full min-h-[60px] flex items-center gap-3.5 py-2.5 text-left hover:bg-slate-50/70 transition-colors cursor-pointer !shadow-none"
              >
                <span className="w-[38px] h-[38px] rounded-[12px] bg-[#F8FAFC] flex items-center justify-center shrink-0 text-[#10B981]">
                  <Settings size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#0F172A]">Cài đặt và hỗ trợ</p>
                  <p className="text-[12px] text-[#64748B] mt-0.5">Ngôn ngữ, thông báo thiết bị &amp; hỗ trợ</p>
                </div>
                {openSections.support ? (
                  <ChevronDown size={18} className="text-[#64748B] shrink-0" />
                ) : (
                  <ChevronRight size={18} className="text-[#64748B] shrink-0" />
                )}
              </button>

              {openSections.support && (
                <div className="pb-3.5 pt-1 pl-1 sm:pl-[52px] pr-1 space-y-2.5">
                  <LanguageSwitcher variant="card" />
                  <button
                    type="button"
                    onClick={handleEnableNotification}
                    className="w-full min-h-[56px] flex items-center gap-3 text-left rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-slate-100/70 px-3 py-2 transition-colors cursor-pointer !shadow-none"
                  >
                    <span className="w-[34px] h-[34px] rounded-[10px] bg-white text-[#10B981] flex items-center justify-center shrink-0">
                      <Bell size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#0F172A]">Bật thông báo trên thiết bị</p>
                      <p className="text-[11.5px] text-[#64748B] mt-0.5">Bật quyền thông báo cho trình duyệt này</p>
                    </div>
                    <ChevronRight size={16} className="text-[#64748B] shrink-0" />
                  </button>
                  <p className="text-[11.5px] text-[#64748B] italic">
                    Liên kết quyền riêng tư, điều khoản và hỗ trợ đang chờ Trung tâm cấu hình.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── 8. Nút Đăng xuất ── */}
          <div className="pt-1 pb-6 flex justify-center lg:justify-end">
            <button
              type="button"
              onClick={handleLogout}
              className={isDewSkill
                ? 'dew-btn-white min-h-[46px] px-7 text-[14px] font-extrabold !text-rose-600 hover:!text-rose-700 inline-flex items-center justify-center gap-2 cursor-pointer'
                : 'cms-profile-logout min-h-[48px] px-7 rounded-[14px] border-[1.5px] border-[#FECACA] border-b-4 border-b-[#F87171] bg-white text-[#DC2626] dark:bg-rose-950/30 dark:border-rose-800/70 dark:border-b-rose-700 dark:text-rose-300 font-extrabold text-[14px] flex items-center justify-center gap-2 hover:bg-[#FEF2F2] dark:hover:bg-rose-950/50 active:translate-y-[3px] active:border-b transition-all cursor-pointer !shadow-none'}
            >
              <LogOut size={18} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>

      <DigitalCertificateModal
        open={Boolean(certificateCourse)}
        onClose={() => setCertificateCourse(null)}
        studentName={studentData?.name || 'Học viên'}
        studentCode={studentData?.studentCode || ''}
        studentId={studentId}
        courseId={certificateCourse?.courseId || certificateCourse?._id || certificateCourse?.id || ''}
        courseTitle={certificateCourse?.courseTitle || certificateCourse?.title || ''}
        instructorName={certificateCourse?.instructorName || 'Trung tâm Thắng Tin Học'}
        completionRate={
          Number(certificateCourse?.completionRate ?? certificateCourse?.progress) || 0
        }
        avgGrade={certificateCourse?.avgGrade ?? null}
        examsPassed={certificateCourse?.examsPassed !== false}
        certificateScope={certificateCourse?.scope || 'course'}
      />
      <ShareAchievementModal
        open={Boolean(shareAchievementData)}
        onClose={() => setShareAchievementData(null)}
        data={shareAchievementData}
      />
    </div>
  );
}
