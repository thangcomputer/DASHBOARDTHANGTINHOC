import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import {
  loadState,
  loadInitialStudentQuestions,
  loadInitialStudentExamMinutes,
  INITIAL_TRAINING,
  STUDENT_QUESTIONS_KEY,
  HV_QUESTIONS_LEGACY_SEED,
  STUDENT_EXAM_MINUTES_KEY,
  TEACHER_EXAM_TIME_LIMIT_KEY,
  DEFAULT_STUDENT_EXAM_MINUTES,
} from './dataStorage';

/**
 * Training materials + question banks (GV/HV) for DataProvider.
 */
export function useDataTraining(currentUser) {
  const [trainingData, setTrainingData] = useState(() => loadState('thvp_trainingData', INITIAL_TRAINING));
  const [studentTrainingData, setStudentTrainingData] = useState(() =>
    loadState('thvp_studentTrainingData', INITIAL_TRAINING),
  );
  const [questions, setQuestions] = useState(() => loadState('thvp_questions', []));
  const [teacherExamBankHydrated, setTeacherExamBankHydrated] = useState(false);
  const [teacherExamTimeLimitMinutes, setTeacherExamTimeLimitMinutes] = useState(() =>
    loadState(TEACHER_EXAM_TIME_LIMIT_KEY, null),
  );
  const [studentQuestions, setStudentQuestions] = useState(loadInitialStudentQuestions);
  const [studentExamMinutes, setStudentExamMinutes] = useState(loadInitialStudentExamMinutes);
  const [studentExamBankHydrated, setStudentExamBankHydrated] = useState(false);

  const applyStudentExamConfigFromServer = useCallback((d) => {
    if (!d) return;
    if (d.hasStudentExamBank) {
      setStudentQuestions(Array.isArray(d.studentQuestions) ? d.studentQuestions : []);
    }
    if (d.studentExamMinutes && typeof d.studentExamMinutes === 'object') {
      setStudentExamMinutes(() => {
        const next = { ...DEFAULT_STUDENT_EXAM_MINUTES };
        for (const k of Object.keys(DEFAULT_STUDENT_EXAM_MINUTES)) {
          const n = Number(d.studentExamMinutes[k]);
          if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
        }
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'staff') {
      setTeacherExamBankHydrated(false);
      return;
    }
    let cancelled = false;
    setTeacherExamBankHydrated(false);
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
      } catch { /* ignore */ }
      if (!cancelled) setTeacherExamBankHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'staff') {
      setStudentExamBankHydrated(false);
      return;
    }
    let cancelled = false;
    setStudentExamBankHydrated(false);
    (async () => {
      try {
        const res = await api.settings.getStudentExamConfig();
        if (cancelled || !res?.success || !res.data) return;
        applyStudentExamConfigFromServer(res.data);
      } catch { /* ignore */ }
      if (!cancelled) setStudentExamBankHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role, applyStudentExamConfigFromServer]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'staff') return;
    if (!teacherExamBankHydrated) return;
    const t = setTimeout(() => {
      api.settings
        .updateTeacherExamConfig({ questions, timeLimitMinutes: teacherExamTimeLimitMinutes })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [questions, teacherExamTimeLimitMinutes, currentUser?.role, teacherExamBankHydrated]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'staff') return;
    if (!studentExamBankHydrated) return;
    const t = setTimeout(() => {
      api.settings
        .updateStudentExamConfig({ studentQuestions, studentExamMinutes })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [studentQuestions, studentExamMinutes, currentUser?.role, studentExamBankHydrated]);

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

  useEffect(() => {
    try {
      if (localStorage.getItem(HV_QUESTIONS_LEGACY_SEED)) return;
      const raw = localStorage.getItem(STUDENT_QUESTIONS_KEY);
      if (raw == null) {
        localStorage.setItem(HV_QUESTIONS_LEGACY_SEED, '1');
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        localStorage.setItem(HV_QUESTIONS_LEGACY_SEED, '1');
        return;
      }
      if (!Array.isArray(parsed) || parsed.length > 0) {
        localStorage.setItem(HV_QUESTIONS_LEGACY_SEED, '1');
        return;
      }
      const tq = loadState('thvp_questions', []);
      if (Array.isArray(tq) && tq.length > 0) {
        setStudentQuestions(JSON.parse(JSON.stringify(tq)));
      }
      localStorage.setItem(HV_QUESTIONS_LEGACY_SEED, '1');
    } catch {
      try { localStorage.setItem(HV_QUESTIONS_LEGACY_SEED, '1'); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => { localStorage.setItem('thvp_trainingData', JSON.stringify(trainingData)); }, [trainingData]);
  useEffect(() => { localStorage.setItem('thvp_studentTrainingData', JSON.stringify(studentTrainingData)); }, [studentTrainingData]);
  useEffect(() => { localStorage.setItem('thvp_questions', JSON.stringify(questions)); }, [questions]);
  useEffect(() => {
    localStorage.setItem(TEACHER_EXAM_TIME_LIMIT_KEY, JSON.stringify(teacherExamTimeLimitMinutes));
  }, [teacherExamTimeLimitMinutes]);
  useEffect(() => { localStorage.setItem('thvp_studentQuestions', JSON.stringify(studentQuestions)); }, [studentQuestions]);
  useEffect(() => { localStorage.setItem(STUDENT_EXAM_MINUTES_KEY, JSON.stringify(studentExamMinutes)); }, [studentExamMinutes]);

  const addStudentTrainingItem = useCallback((category, item) => {
    setStudentTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: [...(prev[category] || []), { ...item, id: Date.now() }],
      };
      api.settings?.updateStudentTrainingData(newData).catch(console.error);
      return newData;
    });
  }, []);

  const updateStudentTrainingItem = useCallback((category, id, updates) => {
    setStudentTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: (prev[category] || []).map((item) =>
          String(item.id) === String(id) ? { ...item, ...updates } : item),
      };
      api.settings?.updateStudentTrainingData(newData).catch(console.error);
      return newData;
    });
  }, []);

  const removeStudentTrainingItem = useCallback((category, id) => {
    setStudentTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: (prev[category] || []).filter((item) => item.id !== id),
      };
      api.settings?.updateStudentTrainingData(newData).catch(console.error);
      return newData;
    });
  }, []);

  const addTrainingItem = useCallback((category, item) => {
    setTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: [...(prev[category] || []), { ...item, id: Date.now() }],
      };
      api.settings?.updateTrainingData(newData).catch(console.error);
      return newData;
    });
  }, []);

  const updateTrainingItem = useCallback((category, id, updates) => {
    setTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: (prev[category] || []).map((item) =>
          String(item.id) === String(id) ? { ...item, ...updates } : item),
      };
      api.settings?.updateTrainingData(newData).catch(console.error);
      return newData;
    });
  }, []);

  const removeTrainingItem = useCallback((category, id) => {
    setTrainingData((prev) => {
      const newData = {
        ...prev,
        [category]: (prev[category] || []).filter((item) => String(item.id) !== String(id)),
      };
      api.settings?.updateTrainingData(newData).catch(console.error);
      return newData;
    });
  }, []);

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

  const addStudentQuestion = useCallback((q) => {
    setStudentQuestions((prev) => [...prev, { ...q, id: `sq_${Date.now()}` }]);
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

  const updateStudentExamMinutes = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setStudentExamMinutes((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_STUDENT_EXAM_MINUTES, k)) continue;
        const n = Number(v);
        if (Number.isFinite(n) && n >= 1 && n <= 600) next[k] = Math.round(n);
      }
      return next;
    });
  }, []);

  /** Used by background sync to hydrate from server payloads */
  const hydrateTrainingFromSync = useCallback((trainingDataRes, studentTrainingRes, studentExamCfg) => {
    if (trainingDataRes?.success) setTrainingData(trainingDataRes.data);
    if (studentTrainingRes?.success) setStudentTrainingData(studentTrainingRes.data);
    if (studentExamCfg?.success && studentExamCfg.data) applyStudentExamConfigFromServer(studentExamCfg.data);
  }, [applyStudentExamConfigFromServer]);

  const setTrainingDataFromSync = setTrainingData;
  const setStudentTrainingDataFromSync = setStudentTrainingData;
  const setQuestionsFromSync = setQuestions;

  return {
    trainingData,
    setTrainingData,
    studentTrainingData,
    setStudentTrainingData,
    questions,
    setQuestions,
    teacherExamTimeLimitMinutes,
    setTeacherExamTimeLimitMinutes,
    studentQuestions,
    setStudentQuestions,
    studentExamMinutes,
    updateStudentExamMinutes,
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
    addStudentQuestion,
    addStudentQuestionsBulk,
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