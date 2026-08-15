import { useCallback, useRef, useState } from 'react';
import certPrepApi, { certPrepStudentErrorMessage } from '../services/certPrepApi';

function normalizeLevelPayload(raw) {
  if (!raw) return { course: null, level: null, expiresAt: null, tests: [] };
  if (Array.isArray(raw)) return { course: null, level: null, expiresAt: null, tests: raw };
  return {
    course: raw.course || null,
    level: raw.level || null,
    expiresAt: raw.expiresAt || null,
    tests: Array.isArray(raw.tests) ? raw.tests : [],
  };
}

export default function useCertPrepStudent() {
  const [catalog, setCatalog] = useState([]);
  const [levelPayload, setLevelPayload] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const res = await certPrepApi.student.getCatalog();
      const rows = Array.isArray(res.data) ? res.data : [];
      setCatalog(rows);
      return rows;
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const loadTests = useCallback(async (levelId) => {
    if (!levelId) {
      setLevelPayload(null);
      return null;
    }
    setLoadingTests(true);
    try {
      const res = await certPrepApi.student.getTests(levelId);
      const payload = normalizeLevelPayload(res.data);
      setLevelPayload(payload);
      return payload;
    } finally {
      setLoadingTests(false);
    }
  }, []);

  const startSession = useCallback(async (testId, options = {}) => {
    if (startingRef.current) return null;
    startingRef.current = true;
    setStarting(true);
    try {
      const res = await certPrepApi.student.startSession(testId, options);
      return res.data || null;
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, []);

  return {
    catalog,
    levelPayload,
    loadingCatalog,
    loadingTests,
    starting,
    loadCatalog,
    loadTests,
    startSession,
    errorMessage: certPrepStudentErrorMessage,
  };
}
