import { useCallback, useState } from 'react';
import certPrepApi, { certPrepResultErrorMessage } from '../services/certPrepApi';

export default function useCertPrepResult(sessionId) {
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);

  const loadResult = useCallback(async () => {
    if (!sessionId) {
      setError('Không tìm thấy phiên làm bài.');
      setErrorStatus(404);
      setResult(null);
      return null;
    }
    setLoading(true);
    setError('');
    setErrorStatus(null);
    try {
      const res = await certPrepApi.student.getResult(sessionId);
      const data = res.data || null;
      setResult(data);
      return data;
    } catch (err) {
      setResult(null);
      setErrorStatus(err?.status || 500);
      setError(certPrepResultErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const loadReview = loadResult;

  const loadAttempts = useCallback(async (testId) => {
    if (!testId) {
      setAttempts([]);
      return [];
    }
    setLoadingAttempts(true);
    try {
      const res = await certPrepApi.student.getAttempts(testId);
      const rows = Array.isArray(res.data) ? res.data : [];
      setAttempts(rows);
      return rows;
    } catch {
      setAttempts([]);
      return [];
    } finally {
      setLoadingAttempts(false);
    }
  }, []);

  return {
    result,
    review: result,
    attempts,
    loading,
    loadingAttempts,
    error,
    errorStatus,
    loadResult,
    loadReview,
    loadAttempts,
  };
}
