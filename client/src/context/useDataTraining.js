import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';
import { questionMatchesExamSubject } from '../utils/htmlContent';
import {
  loadState,
  loadInitialStudentQuestions,
  loadInitialStudentExamMinutes,
  loadInitialStudentEssayExamMinutes,
  loadInitialStudentEssayRequired,
  INITIAL_TRAINING,
  STUDENT_QUESTIONS_KEY,
  HV_QUESTIONS_LEGACY_SEED,
  STUDENT_EXAM_MINUTES_KEY,
  STUDENT_ESSAY_EXAM_MINUTES_KEY,
  STUDENT_ESSAY_REQUIRED_KEY,
  STUDENT_EXAM_FILES_KEY,
  TEACHER_EXAM_TIME_LIMIT_KEY,
  TEACHER_EXAM_MINUTES_KEY,
  TEACHER_ESSAY_EXAM_MINUTES_KEY,
  DEFAULT_STUDENT_EXAM_MINUTES,
  DEFAULT_STUDENT_ESSAY_EXAM_MINUTES,
  DEFAULT_STUDENT_ESSAY_REQUIRED,
  DEFAULT_TEACHER_EXAM_MINUTES,
  DEFAULT_TEACHER_ESSAY_EXAM_MINUTES,
  loadInitialTeacherExamMinutes,
  loadInitialTeacherEssayExamMinutes,
} from './dataStorage';
import {
  BUILTIN_EXAM_SUBJECTS,
  mergeExamCatalog,
  mergedArrayToCatalog,
} from '../utils/examSubjects';

function trainingItemKey(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.id ?? item._id ?? '');
}

function matchTrainingItemId(item, id) {
  const want = String(id ?? '');
  if (!want) return false;
  const a = String(item?.id ?? '');
  const b = String(item?._id ?? '');
  return (a && a === want) || (b && b === want);
}

/**
 * Training materials + question banks (GV/HV) for DataProvider.
 */
export function useDataTraining(currentUser) {
  const [trainingData, setTrainingData] = useState(() => loadState('thvp_trainingData', INITIAL_TRAINING));
  const [studentTrainingData, setStudentTrainingData] = useState(() =>
    loadState('thvp_studentTrainingData', INITIAL_TRAINING),
  );
  // Ngân hàng câu hỏi: khởi tạo rỗng — hydrate từ server (tránh localStorage SoT cũ)
  const [questions, setQuestions] = useState([]);
  const [teacherExamBankHydrated, setTeacherExamBankHydrated] = useState(false);
  const [teacherExamTimeLimitMinutes, setTeacherExamTimeLimitMinutes] = useState(() =>
    loadState(TEACHER_EXAM_TIME_LIMIT_KEY, null),
  );
  const [teacherExamMinutes, setTeacherExamMinutes] = useState(loadInitialTeacherExamMinutes);
  const [teacherEssayExamMinutes, setTeacherEssayExamMinutes] = useState(loadInitialTeacherEssayExamMinutes);
  const [studentQuestions, setStudentQuestions] = useState([]);
  const [studentExamMinutes, setStudentExamMinutes] = useState(loadInitialStudentExamMinutes);
  const [studentEssayExamMinutes, setStudentEssayExamMinutes] = useState(loadInitialStudentEssayExamMinutes);
  const [studentEssayRequired, setStudentEssayRequired] = useState(loadInitialStudentEssayRequired);
  const [studentExamFiles, setStudentExamFiles] = useState(() => loadState(STUDENT_EXAM_FILES_KEY, {}));
  const [examWarningSoundUrl, setExamWarningSoundUrl] = useState('');
  const [studentExamBankHydrated, setStudentExamBankHydrated] = useState(false);
  const [examSubjectsCatalog, setExamSubjectsCatalog] = useState(BUILTIN_EXAM_SUBJECTS);

  useEffect(() => {
    const role = currentUser?.role;
    if (role === 'teacher' || role === 'student') {
      localStorage.removeItem('thvp_questions');
      localStorage.removeItem('thvp_studentQuestions');
    }
  }, [currentUser?.id, currentUser?.role]);

  const applyExamCatalogFromServer = useCallback((d) => {
    if (!d) return;
    if (Array.isArray(d.examSubjectsMerged) && d.examSubjectsMerged.length) {
      setExamSubjectsCatalog(mergedArrayToCatalog(d.examSubjectsMerged));
    } else if (Array.isArray(d.examSubjectsCustom)) {
      setExamSubjectsCatalog(mergeExamCatalog(d.examSubjectsCustom));
    } else if (Array.isArray(d.merged)) {
      setExamSubjectsCatalog(mergedArrayToCatalog(d.merged));
    } else if (Array.isArray(d.custom)) {
      setExamSubjectsCatalog(mergeExamCatalog(d.custom));
    }
  }, []);

  const applyStudentExamConfigFromServer = useCallback((d) => {
    if (!d) return;
    applyExamCatalogFromServer(d);
    if (d.hasStudentExamBank) {
      const serverQs = Array.isArray(d.studentQuestions) ? d.studentQuestions : [];
      // Server là nguồn sự thật — tránh localStorage seed cũ che ngân hàng Admin
      setStudentQuestions(serverQs);
    }
    if (d.studentExamMinutes && typeof d.studentExamMinutes === 'object') {
      setStudentExamMinutes(() => {
        const next = { ...DEFAULT_STUDENT_EXAM_MINUTES };
        for (const k of Object.keys(d.studentExamMinutes)) {
          const n = Number(d.studentExamMinutes[k]);
          if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
        }
        return next;
      });
    }
    if (d.studentEssayExamMinutes && typeof d.studentEssayExamMinutes === 'object') {
      setStudentEssayExamMinutes(() => {
        const next = { ...DEFAULT_STUDENT_ESSAY_EXAM_MINUTES };
        for (const k of Object.keys(d.studentEssayExamMinutes)) {
          const n = Number(d.studentEssayExamMinutes[k]);
          if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
        }
        return next;
      });
    }
    if (d.studentEssayRequired && typeof d.studentEssayRequired === 'object') {
      setStudentEssayRequired(() => {
        const next = { ...DEFAULT_STUDENT_ESSAY_REQUIRED };
        for (const k of Object.keys(d.studentEssayRequired)) {
          const v = d.studentEssayRequired[k];
          if (v === true || v === false) next[k] = v;
          else if (v === 1 || v === '1' || String(v).toLowerCase() === 'true') next[k] = true;
          else if (v === 0 || v === '0' || String(v).toLowerCase() === 'false') next[k] = false;
        }
        return next;
      });
    }
    if (d.studentExamFiles && typeof d.studentExamFiles === 'object') {
      setStudentExamFiles(d.studentExamFiles);
    }
    if (typeof d.examWarningSoundUrl === 'string') {
      setExamWarningSoundUrl(d.examWarningSoundUrl.trim());
    }
  }, [applyExamCatalogFromServer]);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.settings.getExamSubjectsCatalog();
        if (!cancelled && res?.success) applyExamCatalogFromServer(res.data);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role, applyExamCatalogFromServer]);

  useEffect(() => {
    if (!currentUser) return;
    const isStaff = currentUser.role === 'admin' || currentUser.role === 'staff';
    const isTeacher = currentUser.role === 'teacher';
    
    const perms = currentUser.permissions || [];
    const isSuper = currentUser.id === 'admin' || currentUser.adminRole === 'SUPER_ADMIN' || currentUser.adminRole === 'HIGH_ADMIN';
    const hasSystemPerm = isSuper || perms.includes('system_settings');

    if (!isTeacher && (!isStaff || !hasSystemPerm)) {
      setTeacherExamBankHydrated(false);
      return;
    }
    let cancelled = false;
    setTeacherExamBankHydrated(false);
    (async () => {
      try {
        const res = await api.settings.getTeacherExamConfig();
        if (cancelled || !res?.success || !res.data) return;
        if (isStaff && res.data.hasTeacherExamBank) {
          setQuestions(Array.isArray(res.data.questions) ? res.data.questions : []);
        }
        const tm = res.data.timeLimitMinutes;
        setTeacherExamTimeLimitMinutes(
          tm != null && Number.isFinite(Number(tm)) ? Math.round(Number(tm)) : null,
        );
        if (res.data.teacherExamMinutes && typeof res.data.teacherExamMinutes === 'object') {
          setTeacherExamMinutes(() => {
            const next = { ...DEFAULT_TEACHER_EXAM_MINUTES };
            for (const k of Object.keys(res.data.teacherExamMinutes)) {
              const n = Number(res.data.teacherExamMinutes[k]);
              if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
            }
            return next;
          });
        } else if (!res.data.hasTeacherExamMinutes) {
          setTeacherExamMinutes(() => ({ ...DEFAULT_TEACHER_EXAM_MINUTES }));
        }
        if (res.data.teacherEssayExamMinutes && typeof res.data.teacherEssayExamMinutes === 'object') {
          setTeacherEssayExamMinutes(() => {
            const next = { ...DEFAULT_TEACHER_ESSAY_EXAM_MINUTES };
            for (const k of Object.keys(res.data.teacherEssayExamMinutes)) {
              const n = Number(res.data.teacherEssayExamMinutes[k]);
              if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
            }
            return next;
          });
        } else if (!res.data.hasTeacherEssayExamMinutes) {
          setTeacherEssayExamMinutes(() => ({ ...DEFAULT_TEACHER_ESSAY_EXAM_MINUTES }));
        }
      } catch { /* ignore */ }
      if (!cancelled) setTeacherExamBankHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'staff';
    const perms = currentUser?.permissions || [];
    const isSuper = currentUser?.id === 'admin' || currentUser?.adminRole === 'SUPER_ADMIN' || currentUser?.adminRole === 'HIGH_ADMIN';
    const hasSystemPerm = isSuper || perms.includes('system_settings');

    if (!isStaff || !hasSystemPerm) {
      setStudentExamBankHydrated(false);
      return;
    }
    let cancelled = false;
    setStudentExamBankHydrated(false);
    (async () => {
      try {
        const res = await api.settings.getStudentExamConfig();
        if (cancelled || !res?.success || !res.data) return;
        const d = res.data;
        const serverQs = d.hasStudentExamBank && Array.isArray(d.studentQuestions) ? d.studentQuestions : [];
        const localQs = loadInitialStudentQuestions();
        const needsPush =
          localQs.length > 0
          && (!d.hasStudentExamBank || serverQs.length === 0);
        if (needsPush) {
          const mins = d.studentExamMinutes || loadInitialStudentExamMinutes();
          const essayMins = d.studentEssayExamMinutes || loadInitialStudentEssayExamMinutes();
          await api.settings.updateStudentExamConfig({
            studentQuestions: localQs,
            studentExamMinutes: mins,
            studentEssayExamMinutes: essayMins,
          });
          setStudentQuestions(localQs);
          if (d.studentExamMinutes) applyStudentExamConfigFromServer({ ...d, studentQuestions: localQs });
        } else {
          applyStudentExamConfigFromServer(d);
        }
      } catch { /* ignore */ }
      if (!cancelled) setStudentExamBankHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role, applyStudentExamConfigFromServer]);

  // Học viên: luôn hydrate ngân hàng câu hỏi từ server (không phụ thuộc sync nền)
  useEffect(() => {
    if (currentUser?.role !== 'student') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.settings.getStudentExamConfig();
        if (!cancelled && res?.success && res.data) {
          applyStudentExamConfigFromServer(res.data);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role, applyStudentExamConfigFromServer]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'staff') return;
    if (!teacherExamBankHydrated) return;
    const t = setTimeout(() => {
      api.settings
        .updateTeacherExamConfig({
          questions,
          timeLimitMinutes: teacherExamTimeLimitMinutes,
        })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [questions, teacherExamTimeLimitMinutes, currentUser?.role, teacherExamBankHydrated]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'staff') return;
    if (!studentExamBankHydrated) return;
    const t = setTimeout(() => {
      api.settings
        .updateStudentExamConfig({
          studentQuestions,
          studentExamMinutes,
          studentEssayExamMinutes,
          studentEssayRequired,
          studentExamFiles,
          examWarningSoundUrl,
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [studentQuestions, studentExamMinutes, studentEssayExamMinutes, studentEssayRequired, studentExamFiles, examWarningSoundUrl, currentUser?.role, studentExamBankHydrated]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'teacher') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.settings.getTeacherExamConfig();
        if (cancelled || !res?.success || !res.data) return;
        if (res.data.hasTeacherExamBank) {
          setQuestions(Array.isArray(res.data.questions) ? res.data.questions : []);
        }
        const tm = res.data.timeLimitMinutes;
        setTeacherExamTimeLimitMinutes(
          tm != null && Number.isFinite(Number(tm)) ? Math.round(Number(tm)) : null,
        );
        if (res.data.hasTeacherExamMinutes && res.data.teacherExamMinutes && typeof res.data.teacherExamMinutes === 'object') {
          setTeacherExamMinutes(res.data.teacherExamMinutes);
        }
        if (res.data.hasTeacherEssayExamMinutes && res.data.teacherEssayExamMinutes && typeof res.data.teacherEssayExamMinutes === 'object') {
          setTeacherEssayExamMinutes(res.data.teacherEssayExamMinutes);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'student') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.settings.getStudentExamConfig();
        if (cancelled || !res?.success || !res.data) return;
        applyStudentExamConfigFromServer(res.data);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role, applyStudentExamConfigFromServer]);

  // Không seed ngân hàng HV từ localStorage/thvp_questions — server là SoT

  useEffect(() => { localStorage.setItem('thvp_trainingData', JSON.stringify(trainingData)); }, [trainingData]);
  useEffect(() => { localStorage.setItem('thvp_studentTrainingData', JSON.stringify(studentTrainingData)); }, [studentTrainingData]);

  // Ref + chuỗi PUT tuần tự — tránh request cũ (không có files) ghi đè request mới.
  const studentTrainingDataRef = useRef(studentTrainingData);
  studentTrainingDataRef.current = studentTrainingData;
  const studentTrainingWriteChainRef = useRef(Promise.resolve());
  const studentTrainingWritePendingRef = useRef(0);

  const trainingDataRef = useRef(trainingData);
  trainingDataRef.current = trainingData;
  const trainingWriteChainRef = useRef(Promise.resolve());
  const trainingWritePendingRef = useRef(0);

  const persistStudentTrainingData = useCallback(() => {
    studentTrainingWritePendingRef.current += 1;
    studentTrainingWriteChainRef.current = studentTrainingWriteChainRef.current
      .catch(() => {})
      .then(async () => {
        const payload = studentTrainingDataRef.current;
        try {
          const res = await api.settings?.updateStudentTrainingData(payload);
          if (res && res.success === false) {
            throw new Error(res.message || 'Lưu dữ liệu đào tạo HV thất bại');
          }
          return res;
        } finally {
          studentTrainingWritePendingRef.current = Math.max(0, studentTrainingWritePendingRef.current - 1);
        }
      });
    return studentTrainingWriteChainRef.current;
  }, []);

  const persistTrainingData = useCallback(() => {
    trainingWritePendingRef.current += 1;
    trainingWriteChainRef.current = trainingWriteChainRef.current
      .catch(() => {})
      .then(async () => {
        const payload = trainingDataRef.current;
        try {
          const res = await api.settings?.updateTrainingData(payload);
          if (res && res.success === false) {
            throw new Error(res.message || 'Lưu dữ liệu đào tạo GV thất bại');
          }
          return res;
        } finally {
          trainingWritePendingRef.current = Math.max(0, trainingWritePendingRef.current - 1);
        }
      });
    return trainingWriteChainRef.current;
  }, []);

  // Cache ngân hàng sau khi đã hydrate từ server (không dùng làm SoT lúc boot)
  useEffect(() => {
    if (currentUser?.role === 'teacher' || currentUser?.role === 'student') {
      localStorage.removeItem('thvp_questions');
      return;
    }
    if (!teacherExamBankHydrated) return;
    localStorage.setItem('thvp_questions', JSON.stringify(questions));
  }, [questions, teacherExamBankHydrated, currentUser?.role]);
  useEffect(() => {
    localStorage.setItem(TEACHER_EXAM_TIME_LIMIT_KEY, JSON.stringify(teacherExamTimeLimitMinutes));
  }, [teacherExamTimeLimitMinutes]);
  useEffect(() => {
    localStorage.setItem(TEACHER_EXAM_MINUTES_KEY, JSON.stringify(teacherExamMinutes));
  }, [teacherExamMinutes]);
  useEffect(() => {
    localStorage.setItem(TEACHER_ESSAY_EXAM_MINUTES_KEY, JSON.stringify(teacherEssayExamMinutes));
  }, [teacherEssayExamMinutes]);
  useEffect(() => {
    if (currentUser?.role === 'teacher' || currentUser?.role === 'student') {
      localStorage.removeItem('thvp_studentQuestions');
      return;
    }
    if (!studentExamBankHydrated) return;
    localStorage.setItem('thvp_studentQuestions', JSON.stringify(studentQuestions));
  }, [studentQuestions, studentExamBankHydrated, currentUser?.role]);
  useEffect(() => { localStorage.setItem(STUDENT_EXAM_MINUTES_KEY, JSON.stringify(studentExamMinutes)); }, [studentExamMinutes]);
  useEffect(() => {
    localStorage.setItem(STUDENT_ESSAY_EXAM_MINUTES_KEY, JSON.stringify(studentEssayExamMinutes));
  }, [studentEssayExamMinutes]);
  useEffect(() => {
    localStorage.setItem(STUDENT_ESSAY_REQUIRED_KEY, JSON.stringify(studentEssayRequired));
  }, [studentEssayRequired]);
  useEffect(() => { localStorage.setItem(STUDENT_EXAM_FILES_KEY, JSON.stringify(studentExamFiles)); }, [studentExamFiles]);

  const addStudentTrainingItem = useCallback((category, item) => {
    const newId = item.id || item._id || Date.now();
    setStudentTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: [...(prev[category] || []), { ...item, id: newId }],
      };
      studentTrainingDataRef.current = newData;
      return newData;
    });
    return persistStudentTrainingData();
  }, [persistStudentTrainingData]);

  const updateStudentTrainingItem = useCallback((category, id, updates) => {
    setStudentTrainingData((prev) => {
      const list = prev[category] || [];
      const exists = list.some((item) => matchTrainingItemId(item, id));
      const mergedUpdates = {
        ...updates,
        id: updates?.id ?? updates?._id ?? id,
      };
      const newData = {
        ...prev,
        [category]: exists
          ? list.map((item) =>
            (matchTrainingItemId(item, id)
              ? { ...item, ...mergedUpdates, id: trainingItemKey(item) || trainingItemKey(mergedUpdates) || id }
              : item))
          : [...list, { ...mergedUpdates, id: id || Date.now() }],
      };
      studentTrainingDataRef.current = newData;
      return newData;
    });
    return persistStudentTrainingData();
  }, [persistStudentTrainingData]);

  const removeStudentTrainingItem = useCallback((category, id) => {
    setStudentTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: (prev[category] || []).filter((item) => !matchTrainingItemId(item, id)),
      };
      studentTrainingDataRef.current = newData;
      return newData;
    });
    return persistStudentTrainingData();
  }, [persistStudentTrainingData]);

  const addTrainingItem = useCallback((category, item) => {
    const newId = item.id || item._id || Date.now();
    setTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: [...(prev[category] || []), { ...item, id: newId }],
      };
      trainingDataRef.current = newData;
      return newData;
    });
    return persistTrainingData();
  }, [persistTrainingData]);

  const updateTrainingItem = useCallback((category, id, updates) => {
    setTrainingData((prev) => {
      const list = prev[category] || [];
      const exists = list.some((item) => matchTrainingItemId(item, id));
      const mergedUpdates = {
        ...updates,
        id: updates?.id ?? updates?._id ?? id,
      };
      const newData = {
        ...prev,
        [category]: exists
          ? list.map((item) =>
            (matchTrainingItemId(item, id)
              ? { ...item, ...mergedUpdates, id: trainingItemKey(item) || trainingItemKey(mergedUpdates) || id }
              : item))
          : [...list, { ...mergedUpdates, id: id || Date.now() }],
      };
      trainingDataRef.current = newData;
      return newData;
    });
    return persistTrainingData();
  }, [persistTrainingData]);

  const removeTrainingItem = useCallback((category, id) => {
    setTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: (prev[category] || []).filter((item) => !matchTrainingItemId(item, id)),
      };
      trainingDataRef.current = newData;
      return newData;
    });
    return persistTrainingData();
  }, [persistTrainingData]);

  const addQuestion = useCallback((q) => {
    setQuestions((prev) => [...prev, { ...q, id: `q_${Date.now()}` }]);
  }, []);

  const addQuestionsBulk = useCallback((items) => {
    if (!items?.length) return;
    setQuestions((prev) => {
      const base = Date.now();
      const appended = items.map((q, i) => ({
        ...q,
        id: `q_${base + i}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: q.createdAt ?? base + i,
      }));
      return [...prev, ...appended];
    });
  }, []);

  const updateQuestion = useCallback((id, updates) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  }, []);

  const removeQuestion = useCallback((id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const resetQuestions = useCallback(() => {
    setQuestions([]);
  }, []);

  const replaceTeacherQuestionsForSubject = useCallback((sectionId, items) => {
    const sid = String(sectionId || '').trim();
    if (!sid) return;
    setQuestions((prev) => {
      const kept = (prev || []).filter((q) => q.section !== sid);
      const base = Date.now();
      const appended = (items || []).map((q, i) => ({
        ...q,
        section: sid,
        id: q.id || `q_${base + i}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: q.createdAt ?? base + i,
      }));
      return [...kept, ...appended];
    });
  }, []);

  const updateTeacherExamMinutes = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setTeacherExamMinutes((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
      }
      return next;
    });
  }, []);

  const updateTeacherEssayExamMinutes = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setTeacherEssayExamMinutes((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
      }
      return next;
    });
  }, []);

  const addStudentQuestion = useCallback((q) => {
    setStudentQuestions((prev) => [...prev, { ...q, id: q.id || `sq_${Date.now()}` }]);
  }, []);

  const addStudentQuestionsBulk = useCallback((items) => {
    if (!items?.length) return;
    setStudentQuestions((prev) => {
      const base = Date.now();
      const appended = items.map((q, i) => ({
        ...q,
        id: `sq_${base + i}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: q.createdAt ?? base + i,
      }));
      return [...prev, ...appended];
    });
  }, []);

  const replaceStudentQuestionsForSubject = useCallback((subjectId, items) => {
    if (!subjectId) return;
    setStudentQuestions((prev) => {
      const kept = (prev || []).filter((q) => !questionMatchesExamSubject(q.section, subjectId));
      const base = Date.now();
      const appended = (items || []).map((q, i) => ({
        ...q,
        section: subjectId,
        id: `sq_${base + i}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: q.createdAt ?? base + i,
      }));
      return [...kept, ...appended];
    });
  }, []);

  const updateStudentQuestion = useCallback((id, updates) => {
    setStudentQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  }, []);

  const removeStudentQuestion = useCallback((id) => {
    setStudentQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const resetStudentQuestions = useCallback(() => {
    setStudentQuestions([]);
  }, []);

  const copyTeacherQuestionBankToStudents = useCallback(() => {
    setStudentQuestions(() => JSON.parse(JSON.stringify((questions || []).filter(Boolean))));
  }, [questions]);

  const addCustomExamSubject = useCallback(async (payload) => {
    const res = await api.settings.addExamSubject(payload);
    if (!res?.success) {
      throw new Error(res?.message || 'Khong them duoc mon thi');
    }
    const subject = res.data?.subject;
    if (Array.isArray(res.data?.merged)) {
      setExamSubjectsCatalog(mergedArrayToCatalog(res.data.merged));
    } else if (subject) {
      setExamSubjectsCatalog((prev) => ({
        ...prev,
        [subject.id]: {
          id: subject.id,
          label: subject.label,
          short: subject.short || subject.label.slice(0, 2).toUpperCase(),
          bg: subject.bg || 'bg-gray-600',
          minutes: subject.minutes || 90,
          custom: true,
        },
      }));
    }
    if (subject?.id) {
      setStudentExamMinutes((prev) => ({
        ...prev,
        [subject.id]: Number(subject.minutes) > 0 ? Number(subject.minutes) : 90,
      }));
      setStudentEssayExamMinutes((prev) => ({
        ...prev,
        [subject.id]: 60,
      }));
    }
    return subject;
  }, []);

  const removeCustomExamSubject = useCallback(async (subjectId) => {
    const id = String(subjectId || '').trim();
    if (!id) throw new Error('Ma mon thi khong hop le');
    const res = await api.settings.deleteExamSubject(id);
    if (!res?.success) {
      throw new Error(res?.message || 'Khong xoa duoc mon thi');
    }
    if (Array.isArray(res.data?.merged)) {
      setExamSubjectsCatalog(mergedArrayToCatalog(res.data.merged));
    } else {
      setExamSubjectsCatalog((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setStudentExamMinutes((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setStudentEssayExamMinutes((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    return true;
  }, []);

  const updateCustomExamSubject = useCallback(async (subjectId, payload) => {
    const id = String(subjectId || '').trim();
    if (!id) throw new Error('Ma mon thi khong hop le');
    const res = await api.settings.updateExamSubject(id, payload);
    if (!res?.success) {
      throw new Error(res?.message || 'Khong sua duoc mon thi');
    }
    const subject = res.data?.subject;
    if (Array.isArray(res.data?.merged)) {
      setExamSubjectsCatalog(mergedArrayToCatalog(res.data.merged));
    } else if (subject) {
      setExamSubjectsCatalog((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          ...subject,
          id,
          custom: true,
        },
      }));
    }
    return subject;
  }, []);

  const updateStudentExamMinutes = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setStudentExamMinutes((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
      }
      return next;
    });
  }, []);

  const updateStudentEssayExamMinutes = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setStudentEssayExamMinutes((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
      }
      return next;
    });
  }, []);

  const updateStudentEssayRequired = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setStudentEssayRequired((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        if (v === true || v === false) next[k] = v;
        else if (v === 1 || v === '1' || String(v).toLowerCase() === 'true') next[k] = true;
        else if (v === 0 || v === '0' || String(v).toLowerCase() === 'false') next[k] = false;
      }
      return next;
    });
  }, []);

  const setStudentExamFile = useCallback((subjectId, fileMeta) => {
    const sid = String(subjectId || '').trim();
    if (!sid) return;
    setStudentExamFiles((prev) => {
      const next = { ...prev };
      if (!fileMeta) {
        delete next[sid];
      } else {
        next[sid] = {
          fileUrl: fileMeta.fileUrl || '',
          fileName: fileMeta.fileName || '',
          fileType: fileMeta.fileType || '',
        };
      }
      return next;
    });
  }, []);

  /** Sync từ server: khi đang PUT local thì giữ files/chapters mới hơn trên từng khóa video. */
  const mergeTrainingVideosPreferLocal = useCallback((localData, serverData) => {
    if (!serverData || typeof serverData !== 'object') return localData;
    if (!localData || typeof localData !== 'object') return serverData;
    const localVideos = Array.isArray(localData.videos) ? localData.videos : [];
    const serverVideos = Array.isArray(serverData.videos) ? serverData.videos : [];
    const localById = new Map(
      localVideos.map((v) => [String(v?.id ?? v?._id ?? ''), v]).filter(([k]) => k),
    );
    const mergedVideos = serverVideos.map((sv) => {
      const id = String(sv?.id ?? sv?._id ?? '');
      const lv = localById.get(id);
      if (!lv) return sv;
      const localFiles = Array.isArray(lv.files) ? lv.files : [];
      const serverFiles = Array.isArray(sv.files) ? sv.files : [];
      const files = localFiles.length >= serverFiles.length ? localFiles : serverFiles;
      const localChapters = Array.isArray(lv.chapters) ? lv.chapters : [];
      const serverChapters = Array.isArray(sv.chapters) ? sv.chapters : [];
      const chapters = localChapters.length >= serverChapters.length ? localChapters : serverChapters;
      return {
        ...sv,
        files,
        chapters: chapters.length ? chapters : (sv.chapters || lv.chapters),
        lessons: sv.lessons || lv.lessons,
        videos: sv.videos || lv.videos,
      };
    });
    const serverIds = new Set(mergedVideos.map((v) => String(v?.id ?? v?._id ?? '')));
    localVideos.forEach((lv) => {
      const id = String(lv?.id ?? lv?._id ?? '');
      if (id && !serverIds.has(id)) mergedVideos.push(lv);
    });
    return {
      ...serverData,
      videos: mergedVideos,
      files: Array.isArray(serverData.files) ? serverData.files : (localData.files || []),
      guides: Array.isArray(serverData.guides) ? serverData.guides : (localData.guides || []),
      softwareLinks: Array.isArray(serverData.softwareLinks)
        ? serverData.softwareLinks
        : (localData.softwareLinks || []),
    };
  }, []);

  const setStudentTrainingDataFromSync = useCallback((serverData) => {
    if (!serverData) return;
    if (studentTrainingWritePendingRef.current > 0) {
      setStudentTrainingData((local) => {
        const merged = mergeTrainingVideosPreferLocal(local, serverData);
        studentTrainingDataRef.current = merged;
        return merged;
      });
      return;
    }
    studentTrainingDataRef.current = serverData;
    setStudentTrainingData(serverData);
  }, [mergeTrainingVideosPreferLocal]);

  const setTrainingDataFromSync = useCallback((serverData) => {
    if (!serverData) return;
    if (trainingWritePendingRef.current > 0) {
      setTrainingData((local) => {
        const merged = mergeTrainingVideosPreferLocal(local, serverData);
        trainingDataRef.current = merged;
        return merged;
      });
      return;
    }
    trainingDataRef.current = serverData;
    setTrainingData(serverData);
  }, [mergeTrainingVideosPreferLocal]);

  const setQuestionsFromSync = setQuestions;

  /** Used by background sync to hydrate from server payloads */
  const hydrateTrainingFromSync = useCallback((trainingDataRes, studentTrainingRes, studentExamCfg) => {
    if (trainingDataRes?.success) setTrainingDataFromSync(trainingDataRes.data);
    if (studentTrainingRes?.success) setStudentTrainingDataFromSync(studentTrainingRes.data);
    if (studentExamCfg?.success && studentExamCfg.data) applyStudentExamConfigFromServer(studentExamCfg.data);
  }, [applyStudentExamConfigFromServer, setTrainingDataFromSync, setStudentTrainingDataFromSync]);

  const isExamCandidate = currentUser?.role === 'teacher' || currentUser?.role === 'student';

  return {
    trainingData,
    setTrainingData,
    studentTrainingData,
    setStudentTrainingData,
    questions: isExamCandidate ? [] : questions,
    setQuestions,
    teacherExamTimeLimitMinutes,
    setTeacherExamTimeLimitMinutes,
    teacherExamMinutes,
    updateTeacherExamMinutes,
    teacherEssayExamMinutes,
    updateTeacherEssayExamMinutes,
    studentQuestions: isExamCandidate ? [] : studentQuestions,
    setStudentQuestions,
    studentExamMinutes,
    updateStudentExamMinutes,
    studentEssayExamMinutes,
    updateStudentEssayExamMinutes,
    studentEssayRequired,
    updateStudentEssayRequired,
    studentExamFiles,
    setStudentExamFile,
    examWarningSoundUrl,
    setExamWarningSoundUrl,
    examSubjectsCatalog,
    addCustomExamSubject,
    updateCustomExamSubject,
    removeCustomExamSubject,
    applyStudentExamConfigFromServer,
    addStudentTrainingItem,
    updateStudentTrainingItem,
    removeStudentTrainingItem,
    addTrainingItem,
    updateTrainingItem,
    removeTrainingItem,
    addQuestion,
    addQuestionsBulk,
    updateQuestion,
    removeQuestion,
    resetQuestions,
    replaceTeacherQuestionsForSubject,
    addStudentQuestion,
    addStudentQuestionsBulk,
    replaceStudentQuestionsForSubject,
    updateStudentQuestion,
    removeStudentQuestion,
    resetStudentQuestions,
    copyTeacherQuestionBankToStudents,
    hydrateTrainingFromSync,
    setTrainingDataFromSync,
    setStudentTrainingDataFromSync,
    setQuestionsFromSync,
  };
}