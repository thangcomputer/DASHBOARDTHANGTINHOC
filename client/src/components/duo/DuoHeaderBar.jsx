import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Flame, Zap } from 'lucide-react';
import { isFreePortalSelfRegistrationStudent } from '../../utils/enrollments';
import { useStudentSubscription } from '../student/subscription/subscriptionContext';

function DuoPill({ onClick, className, borderClass, children, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded-full border border-b-2 px-2.5 py-1 text-xs font-black transition active:translate-y-px active:border-b ${className} ${borderClass}`}
    >
      {children}
    </button>
  );
}

export function DuoHeaderBar({
  streak = 0,
  xpTotal = 0,
  studentData,
  enrollments = [],
  activeCourseName = '',
  onPressStreak,
  onPressXp,
  onPressSubscription,
}) {
  const navigate = useNavigate();
  const subCtx = useStudentSubscription();
  const subState = subCtx?.subscription;

  const logoSrc = useMemo(() => {
    const isFreeStudent = isFreePortalSelfRegistrationStudent({
      ...studentData,
      role: 'student',
      course: activeCourseName || studentData?.course,
      enrollments: enrollments?.length ? enrollments : studentData?.enrollments,
      courses: studentData?.courses,
    });
    return isFreeStudent ? '/brand/logo.webp' : '/brand/logo-horizontal.png';
  }, [enrollments, activeCourseName, studentData]);

  const isMeetActive = subState?.state === 'active' || subState?.state === 'lifetime';
  const planLabel = subState?.planLabel
    || (studentData?.freePortal ? 'Miễn phí' : 'Học viên');

  const goStreak = onPressStreak || (() => navigate('/student/daily-practice'));
  const goXp = onPressXp || (() => navigate('/student/daily-practice'));
  const goSub = onPressSubscription || (() => navigate('/student#profile'));

  return (
    <header className="duo-header-bar flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-slate-100 bg-white px-4 py-2.5">
      <img src={logoSrc} alt="Thắng Tin Học" className="h-[30px] max-w-[140px] object-contain object-left" />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DuoPill
          onClick={goStreak}
          className="bg-orange-50 text-orange-700"
          borderClass="border-orange-100 border-b-orange-200"
          ariaLabel={`Chuỗi ${streak} ngày`}
        >
          <Flame size={16} className="text-orange-600" fill="#FB923C" aria-hidden="true" />
          <span>{streak}</span>
        </DuoPill>
        <DuoPill
          onClick={goXp}
          className="bg-amber-50 text-amber-800"
          borderClass="border-amber-100 border-b-amber-200"
          ariaLabel={`Ví ${xpTotal} XP`}
        >
          <Zap size={15} className="text-amber-600" fill="#F59E0B" aria-hidden="true" />
          <span>{Number(xpTotal).toLocaleString('vi-VN')}</span>
        </DuoPill>
        <DuoPill
          onClick={goSub}
          className={isMeetActive ? 'bg-amber-100 text-amber-900' : 'bg-slate-50 text-slate-600'}
          borderClass={isMeetActive ? 'border-amber-200 border-b-amber-300' : 'border-slate-100 border-b-slate-200'}
          ariaLabel="Trạng thái gói học"
        >
          <Crown
            size={14}
            className={isMeetActive ? 'text-amber-600' : 'text-slate-500'}
            fill={isMeetActive ? '#FCD34D' : 'transparent'}
            aria-hidden="true"
          />
          <span className="max-w-[88px] truncate text-[11px] font-extrabold">{planLabel}</span>
        </DuoPill>
      </div>
    </header>
  );
}
