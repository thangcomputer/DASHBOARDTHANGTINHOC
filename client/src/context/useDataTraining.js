import { useState, useCallback, useEffect } from 'react';
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
  // Cache ngân hàng sau khi đã hydrate từ server (không dùng làm SoT lúc boot)
  useEffect(() => {
    if (!teacherExamBankHydrated) return;
    localStorage.setItem('thvp_questions', JSON.stringify(questions));
  }, [questions, teacherExamBankHydrated]);
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
    if (!studentExamBankHydrated && currentUser?.role !== 'student') return;
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
    teacherExamMinutes,
    updateTeacherExamMinutes,
    teacherEssayExamMinutes,
    updateTeacherEssayExamMinutes,
    studentQuestions,
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