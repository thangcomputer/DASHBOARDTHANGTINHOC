import { useCallback, useRef, useState } from 'react';
import certPrepApi, { certPrepErrorMessage } from '../services/certPrepApi';

function idOf(doc) {
  return String(doc?._id || doc?.id || '');
}

export default function useCertPrepAdmin() {
  const [courses, setCourses] = useState([]);
  const [levels, setLevels] = useState([]);
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [accessRows, setAccessRows] = useState([]);

  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await certPrepApi.courses.list();
      setCourses(res.data || []);
      return res.data || [];
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const loadLevels = useCallback(async (courseId) => {
    if (!courseId) {
      setLevels([]);
      return [];
    }
    setLoadingLevels(true);
    try {
      const res = await certPrepApi.levels.list(courseId);
      setLevels(res.data || []);
      return res.data || [];
    } finally {
      setLoadingLevels(false);
    }
  }, []);

  const loadTests = useCallback(async (levelId) => {
    if (!levelId) {
      setTests([]);
      return [];
    }
    setLoadingTests(true);
    try {
      const res = await certPrepApi.tests.list(levelId);
      setTests(res.data || []);
      return res.data || [];
    } finally {
      setLoadingTests(false);
    }
  }, []);

  const loadQuestions = useCallback(async (testId) => {
    if (!testId) {
      setQuestions([]);
      return [];
    }
    setLoadingQuestions(true);
    try {
      const res = await certPrepApi.questions.list(testId);
      setQuestions(res.data || []);
      return res.data || [];
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  const loadAccess = useCallback(async (params = {}) => {
    setLoadingAccess(true);
    try {
      const res = await certPrepApi.access.list(params);
      setAccessRows(res.data || []);
      return res.data || [];
    } finally {
      setLoadingAccess(false);
    }
  }, []);

  const runSave = useCallback(async (fn) => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    try {
      return await fn();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  return {
    courses,
    levels,
    tests,
    questions,
    accessRows,
    loadingCourses,
    loadingLevels,
    loadingTests,
    loadingQuestions,
    loadingAccess,
    saving,
    loadCourses,
    loadLevels,
    loadTests,
    loadQuestions,
    loadAccess,
    runSave,
    idOf,
    errorMessage: certPrepErrorMessage,
  };
}
