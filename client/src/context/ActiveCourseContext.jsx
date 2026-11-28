import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dewskillClassApi from '../services/dewskillClassApi';
import dailyPracticeApi, { DAILY_PRACTICE_STATS_EVENT } from '../services/dailyPracticeApi';
import { isFreePortalSelfRegistrationStudent } from '../utils/enrollments';
import CourseOnboardingModal from '../components/student/courses/CourseOnboardingModal';

const DEFAULT_CONTEXT = {
  isDewskillStudent: false,
  enrolledCourses: [],
  allVisibleClasses: [],
  activeCourseId: '',
  activeCourse: null,
  hasCompletedOnboarding: true,
  loading: false,
  setActiveCourseId: () => {},
  startTrialCourse: () => {},
  markCourseEnrolled: () => {},
  openAddCourse: () => {},
  completeOnboarding: () => {},
  refreshCourses: async () => {},
};

const ActiveCourseContext = createContext(DEFAULT_CONTEXT);

function activeCourseStorageKey(studentId) {
  return `dewskill_active_course:${studentId || 'guest'}`;
}

function trialCoursesStorageKey(studentId) {
  return `dewskill_trial_courses:${studentId || 'guest'}`;
}

function onboardingStorageKey(studentId) {
  return `dewskill_onboarding_done:${studentId || 'guest'}`;
}

function readStoredTrialIds(studentId) {
  try {
    const raw = localStorage.getItem(trialCoursesStorageKey(studentId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? item : String(item?.id || '')))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeStoredTrialIds(studentId, ids) {
  try {
    const clean = [...new Set((ids || []).map((id) => String(id || '')).filter(Boolean))];
    localStorage.setItem(trialCoursesStorageKey(studentId), JSON.stringify(clean));
  } catch {
    /* ignore storage error */
  }
}

function cleanShortTitle(name) {
  return String(name || '').replace(/\s*\([^)]*\)\s*/g, '').trim() || String(name || 'Khóa học');
}

function computeCourseProgress(cls, pathTopics = []) {
  const topicIds = (cls?.dailyPracticeTopicIds || [])
    .map((t) => String(t?._id || t?.id || t || '').trim())
    .filter(Boolean);
  const topicNames = (cls?.dailyPracticeTopicIds || [])
    .map((t) => String(t?.name || '').trim())
    .filter(Boolean);
  const topicSet = new Set(topicIds);

  const matchedTopics = topicSet.size > 0
    ? (pathTopics || []).filter((pt) => topicSet.has(String(pt?.topic?.id || '')))
    : [];

  let doneSteps = 0;
  let totalSteps = 0;
  let doneUnits = 0;
  let totalUnits = 0;
  let activeUnitIndex = 1;
  let foundActive = false;

  matchedTopics.forEach((pt) => {
    totalUnits += Number(pt?.totalUnits) || (pt?.units?.length || 0);
    doneUnits += Number(pt?.completedUnits) || 0;
    (pt?.units || []).forEach((unit) => {
      if (!foundActive && unit.state === 'active') {
        activeUnitIndex = unit.index || 1;
        foundActive = true;
      }
      const steps = Array.isArray(unit.steps) ? unit.steps : [];
      totalSteps += steps.length;
      doneSteps += steps.filter((s) => s.state === 'completed').length;
    });
  });

  if (!foundActive && matchedTopics.length > 0 && doneUnits >= totalUnits && totalUnits > 0) {
    activeUnitIndex = totalUnits;
  }

  let progress = 0;
  if (totalSteps > 0) {
    progress = Math.min(100, Math.round((doneSteps / totalSteps) * 100));
  } else if (totalUnits > 0) {
    progress = Math.min(100, Math.round((doneUnits / totalUnits) * 100));
  }

  const isOwned = cls?.accessLevel === 'full';
  let currentStage;
  if (progress >= 100) {
    currentStage = `Chặng ${activeUnitIndex} · Đã hoàn thành 100%`;
  } else if (progress > 0) {
    currentStage = `Chặng ${activeUnitIndex} · Đã hoàn thành ${progress}%`;
  } else if (!isOwned) {
    currentStage = 'Chặng khởi động · Học thử 0%';
  } else {
    currentStage = 'Chặng khởi động · Mới mở 0%';
  }

  return {
    progress,
    currentStage,
    topicIds,
    topicNames,
  };
}

export function ActiveCourseProvider({ session, children }) {
  const navigate = useNavigate();
  const studentId = String(session?.id || session?._id || '').trim();
  const isDewskillStudent = Boolean(
    session?.role === 'student'
    && (
      session?.freePortal === true
      || session?.accountType === 'dewskill'
      || isFreePortalSelfRegistrationStudent(session)
    ),
  );

  const [allVisibleClasses, setAllVisibleClasses] = useState([]);
  const [pathTopics, setPathTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const refreshInFlightRef = useRef(null);
  const [trialIds, setTrialIds] = useState(() => readStoredTrialIds(studentId));
  const [activeCourseIdState, setActiveCourseIdState] = useState(() => {
    try {
      return localStorage.getItem(activeCourseStorageKey(studentId)) || '';
    } catch {
      return '';
    }
  });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    try {
      return localStorage.getItem(onboardingStorageKey(studentId)) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setTrialIds(readStoredTrialIds(studentId));
    try {
      setActiveCourseIdState(localStorage.getItem(activeCourseStorageKey(studentId)) || '');
      setHasCompletedOnboarding(localStorage.getItem(onboardingStorageKey(studentId)) === '1');
    } catch {
      /* ignore */
    }
  }, [studentId]);

  const refreshCourses = useCallback(async () => {
    if (!isDewskillStudent) {
      setAllVisibleClasses([]);
      setPathTopics([]);
      return;
    }
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    const run = (async () => {
      setLoading(true);
      try {
        const [clsRes, pathRes] = await Promise.allSettled([
          dewskillClassApi.myVisible(),
          dailyPracticeApi.student.path(),
        ]);
        if (clsRes.status === 'fulfilled' && Array.isArray(clsRes.value?.data)) {
          setAllVisibleClasses(clsRes.value.data);
        }
        if (pathRes.status === 'fulfilled' && Array.isArray(pathRes.value?.topics)) {
          setPathTopics(pathRes.value.topics);
        }
      } finally {
        refreshInFlightRef.current = null;
        setLoading(false);
      }
    })();
    refreshInFlightRef.current = run;
    return run;
  }, [isDewskillStudent]);

  useEffect(() => {
    refreshCourses();
    if (!isDewskillStudent) return undefined;
    const onRefresh = () => refreshCourses();
    window.addEventListener('cms:subscription-updated', onRefresh);
    window.addEventListener('free-portal-unlocked', onRefresh);
    window.addEventListener('cms:part-completed', onRefresh);
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, onRefresh);
    return () => {
      window.removeEventListener('cms:subscription-updated', onRefresh);
      window.removeEventListener('free-portal-unlocked', onRefresh);
      window.removeEventListener('cms:part-completed', onRefresh);
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, onRefresh);
    };
  }, [isDewskillStudent, refreshCourses]);

  const enrolledCourses = useMemo(() => {
    if (!isDewskillStudent || !allVisibleClasses.length) return [];
    const trialSet = new Set(trialIds);
    return allVisibleClasses
      .filter((cls) => cls?.accessLevel === 'full' || trialSet.has(String(cls?._id || '')))
      .map((cls) => {
        const id = String(cls._id);
        const status = cls.accessLevel === 'full' ? 'owned' : 'trial';
        const { progress, currentStage, topicIds, topicNames } = computeCourseProgress(cls, pathTopics);
        return {
          id,
          title: cls.name || 'Khóa học DewSkill',
          shortTitle: cleanShortTitle(cls.name),
          code: cls.code || '',
          tier: cls.tier || '',
          level: cls.tier || '',
          badge: cls.badge || '',
          progress,
          currentStage,
          status,
          accessExpiresAt: cls.accessExpiresAt || null,
          purchasedAt: cls.purchasedAt || null,
          durationMonths: Number(cls.durationMonths) || 12,
          includesMeet: cls.includesMeet !== false,
          topicIds,
          topicNames,
          rawClass: cls,
        };
      });
  }, [isDewskillStudent, allVisibleClasses, trialIds, pathTopics]);

  const setActiveCourseId = useCallback((nextId) => {
    const cleanId = String(nextId || '').trim();
    setActiveCourseIdState(cleanId);
    try {
      if (cleanId) localStorage.setItem(activeCourseStorageKey(studentId), cleanId);
      else localStorage.removeItem(activeCourseStorageKey(studentId));
    } catch {
      /* ignore */
    }
  }, [studentId]);

  useEffect(() => {
    if (!enrolledCourses.length) return;
    const exists = enrolledCourses.some((c) => c.id === activeCourseIdState);
    if (!activeCourseIdState || !exists) {
      setActiveCourseId(enrolledCourses[0].id);
    }
  }, [enrolledCourses, activeCourseIdState, setActiveCourseId]);

  const activeCourse = useMemo(
    () => enrolledCourses.find((c) => c.id === activeCourseIdState) || enrolledCourses[0] || null,
    [enrolledCourses, activeCourseIdState],
  );

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboarding(true);
    try {
      localStorage.setItem(onboardingStorageKey(studentId), '1');
    } catch {
      /* ignore */
    }
  }, [studentId]);

  const startTrialCourse = useCallback((clsOrId) => {
    const cid = typeof clsOrId === 'string' ? clsOrId : String(clsOrId?._id || clsOrId?.id || '');
    if (!cid) return;
    setTrialIds((prev) => {
      const next = prev.includes(cid) ? prev : [...prev, cid];
      writeStoredTrialIds(studentId, next);
      return next;
    });
    setActiveCourseId(cid);
    completeOnboarding();
  }, [studentId, setActiveCourseId, completeOnboarding]);

  const markCourseEnrolled = useCallback((clsOrCourse, extraMeta = null) => {
    const cid = typeof clsOrCourse === 'string'
      ? clsOrCourse.trim()
      : String(clsOrCourse?._id || clsOrCourse?.id || '').trim();
    if (!cid) return;
    const nextExpiresAt = extraMeta?.expiresAt || clsOrCourse?.accessExpiresAt || null;
    const nextDuration = Number(extraMeta?.durationMonths || clsOrCourse?.durationMonths) || 12;
    const nextIncludesMeet = extraMeta?.includesMeet !== undefined
      ? Boolean(extraMeta.includesMeet)
      : (clsOrCourse?.includesMeet !== false);
    setAllVisibleClasses((prev) => {
      const idx = prev.findIndex((item) => String(item?._id || '') === cid);
      if (idx >= 0) {
        return prev.map((item) => (String(item?._id || '') === cid
          ? {
            ...item,
            accessLevel: 'full',
            accessSource: 'owned',
            accessExpiresAt: nextExpiresAt || item.accessExpiresAt || null,
            durationMonths: nextDuration,
            includesMeet: nextIncludesMeet,
          }
          : item));
      }
      if (clsOrCourse && typeof clsOrCourse === 'object') {
        return [...prev, {
          ...clsOrCourse,
          _id: cid,
          accessLevel: 'full',
          accessSource: 'owned',
          accessExpiresAt: nextExpiresAt,
          durationMonths: nextDuration,
          includesMeet: nextIncludesMeet,
        }];
      }
      return prev;
    });
    setTrialIds((prev) => {
      if (!prev.includes(cid)) return prev;
      const next = prev.filter((id) => id !== cid);
      writeStoredTrialIds(studentId, next);
      return next;
    });
    setActiveCourseId(cid);
    completeOnboarding();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cms:subscription-updated'));
    } else {
      refreshCourses();
    }
  }, [studentId, setActiveCourseId, completeOnboarding, refreshCourses]);

  const openAddCourse = useCallback((tier = '') => {
    const query = tier ? `?tier=${encodeURIComponent(tier)}` : '';
    navigate(`/student/courses${query}`);
  }, [navigate]);

  const showOnboardingModal = Boolean(
    isDewskillStudent
    && !loading
    && !hasCompletedOnboarding
    && enrolledCourses.length === 0
    && allVisibleClasses.length > 0,
  );

  const value = useMemo(() => ({
    isDewskillStudent,
    enrolledCourses,
    allVisibleClasses,
    activeCourseId: activeCourse?.id || activeCourseIdState || '',
    activeCourse,
    hasCompletedOnboarding,
    loading,
    setActiveCourseId,
    startTrialCourse,
    markCourseEnrolled,
    openAddCourse,
    completeOnboarding,
    refreshCourses,
  }), [
    isDewskillStudent,
    enrolledCourses,
    allVisibleClasses,
    activeCourse,
    activeCourseIdState,
    hasCompletedOnboarding,
    loading,
    setActiveCourseId,
    startTrialCourse,
    markCourseEnrolled,
    openAddCourse,
    completeOnboarding,
    refreshCourses,
  ]);

  return (
    <ActiveCourseContext.Provider value={value}>
      {children}
      <CourseOnboardingModal
        open={showOnboardingModal}
        classes={allVisibleClasses}
        onSelectTrial={(cls) => {
          startTrialCourse(cls);
          const firstTopic = cls?.dailyPracticeTopicIds?.[0];
          const firstTopicId = String(firstTopic?._id || firstTopic?.id || firstTopic || '').trim();
          navigate(firstTopicId ? `/student/daily-practice?topicId=${encodeURIComponent(firstTopicId)}` : '/student/daily-practice');
        }}
      />
    </ActiveCourseContext.Provider>
  );
}

export function useActiveCourse() {
  return useContext(ActiveCourseContext);
}
