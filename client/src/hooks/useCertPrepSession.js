import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import certPrepApi, { certPrepPlayerErrorMessage } from '../services/certPrepApi';

const AUTOSAVE_MS = 500;
const RETRY_MS = 2000;
const MAX_RETRIES = 3;

function answersFromSession(session) {
  const map = {};
  for (const row of session?.answers || []) {
    if (!row?.questionId) continue;
    map[String(row.questionId)] = row.value;
  }
  return map;
}

function toPayload(answersMap) {
  return Object.entries(answersMap)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([questionId, value]) => ({ questionId, value }));
}

export function isQuestionAnswered(question, value) {
  if (!question) return false;
  if (question.type === 'single_choice') {
    return Number.isInteger(Number(value)) && value !== '' && value != null;
  }
  if (question.type === 'multiple_choice') {
    return Array.isArray(value) && value.length > 0;
  }
  if (question.type === 'matching') {
    const items = question.matchingItems || [];
    if (!items.length || !Array.isArray(value)) return false;
    const byItem = new Map(value.map((p) => [String(p.itemId), p.targetId]));
    return items.every((item) => Boolean(byItem.get(String(item.id))));
  }
  return false;
}

export function formatRemaining(seconds) {
  const n = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function useCertPrepSession(sessionId) {
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uiStatus, setUiStatus] = useState('loading');
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  );
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const answersRef = useRef({});
  const sessionRef = useRef(null);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const submittingRef = useRef(false);
  const expireOnceRef = useRef(false);
  const remainingRef = useRef(null);
  const tickRef = useRef(null);
  const remainingAtSyncRef = useRef(null);
  const syncAtRef = useRef(null);
  const flushSaveRef = useRef(async () => true);

  const applySession = useCallback((data, { restoreAnswers = false } = {}) => {
    if (!data) return;
    sessionRef.current = data;
    setSession(data);
    if (Array.isArray(data.questions) && data.questions.length) {
      setQuestions(data.questions);
    }
    if (restoreAnswers) {
      const next = answersFromSession(data);
      answersRef.current = next;
      setAnswers(next);
    }
    if (typeof data.remainingSeconds === 'number') {
      remainingAtSyncRef.current = data.remainingSeconds;
      syncAtRef.current = Date.now();
      remainingRef.current = data.remainingSeconds;
      setRemainingSeconds(data.remainingSeconds);
    }
    if (data.autoSubmitted) setAutoSubmitted(true);
    if (data.status === 'in_progress') setUiStatus('active');
    else if (data.status === 'submitted' || data.status === 'abandoned') {
      setUiStatus(data.status === 'abandoned' || data.autoSubmitted ? 'expired' : 'submitted');
    }
  }, []);

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setUiStatus('not-found');
      setLoading(false);
      setError('Không tìm thấy phiên làm bài.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await certPrepApi.student.getSession(sessionId);
      const data = res.data;
      applySession(data, { restoreAnswers: true });
      if (data?.status === 'submitted' || data?.status === 'abandoned') {
        setUiStatus(data.autoSubmitted || data.status === 'abandoned' ? 'expired' : 'expired');
      }
    } catch (err) {
      const status = err?.status;
      if (status === 403) setUiStatus('forbidden');
      else if (status === 404) setUiStatus('not-found');
      else if (status === 410) setUiStatus('expired');
      else setUiStatus('error');
      setError(certPrepPlayerErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId, applySession]);

  const flushSave = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.status !== 'in_progress') return true;
    if (!dirtyRef.current) return true;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true);
      setSaveError('Mất kết nối mạng.');
      return false;
    }
    setSaving(true);
    try {
      const res = await certPrepApi.student.saveAnswers(current.id, toPayload(answersRef.current));
      dirtyRef.current = false;
      retryCountRef.current = 0;
      setSaveError('');
      applySession(res.data);
      return true;
    } catch (err) {
      if (err?.status === 403) {
        setUiStatus('forbidden');
        setError(certPrepPlayerErrorMessage(err));
        dirtyRef.current = false;
        return false;
      }
      if (err?.status === 409 || err?.status === 410) {
        setUiStatus('expired');
        dirtyRef.current = false;
        return false;
      }
      setSaveError('Không thể lưu câu trả lời. Đang thử lại...');
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          flushSaveRef.current();
        }, RETRY_MS);
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [applySession]);

  useEffect(() => {
    flushSaveRef.current = flushSave;
  }, [flushSave]);

  const scheduleSave = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status !== 'in_progress') return;
    dirtyRef.current = true;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushSave();
    }, AUTOSAVE_MS);
  }, [flushSave]);

  const selectAnswer = useCallback((questionId, value) => {
    const current = sessionRef.current;
    if (!current || current.status !== 'in_progress' || submittingRef.current) return;
    if (remainingRef.current === 0) return;
    const next = { ...answersRef.current, [String(questionId)]: value };
    answersRef.current = next;
    setAnswers(next);
    scheduleSave();
  }, [scheduleSave]);

  const goToQuestion = useCallback((index) => {
    setCurrentIndex((prev) => {
      const max = Math.max(0, (questions.length || 1) - 1);
      const next = Number(index);
      if (!Number.isInteger(next)) return prev;
      return Math.min(max, Math.max(0, next));
    });
  }, [questions.length]);

  const next = useCallback(() => {
    goToQuestion(currentIndex + 1);
  }, [currentIndex, goToQuestion]);

  const previous = useCallback(() => {
    goToQuestion(currentIndex - 1);
  }, [currentIndex, goToQuestion]);

  const submit = useCallback(async ({ auto = false } = {}) => {
    const current = sessionRef.current;
    if (!current || submittingRef.current) return null;
    if (current.status !== 'in_progress') return current;
    if (!auto && typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true);
      setSaveError('Mất kết nối mạng.');
      return null;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setUiStatus('submitting');
    clearTimeout(saveTimerRef.current);
    try {
      await flushSave();
      const res = await certPrepApi.student.submitSession(current.id);
      const data = res.data;
      dirtyRef.current = false;
      applySession(data);
      setJustSubmitted(!data?.autoSubmitted && !auto);
      setAutoSubmitted(Boolean(data?.autoSubmitted || auto));
      setUiStatus(data?.autoSubmitted || auto ? 'expired' : 'submitted');
      return data;
    } catch (err) {
      if (auto) {
        setUiStatus('expired');
        return null;
      }
      if (err?.status === 403) {
        setUiStatus('forbidden');
        setError(certPrepPlayerErrorMessage(err));
      } else if (err?.status === 410 || err?.status === 409) {
        setUiStatus('expired');
      } else {
        setUiStatus('error');
        setError(certPrepPlayerErrorMessage(err, 'Không thể nộp bài. Vui lòng thử lại.'));
      }
      return null;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [applySession, flushSave]);

  useEffect(() => {
    // Resume the same session after refresh; do not create a new session.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load by sessionId
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      if (dirtyRef.current) flushSave();
    };
    const onOffline = () => {
      setOffline(true);
      setSaveError('Mất kết nối mạng.');
    };
    const onCustom = (e) => {
      if (typeof e?.detail?.online === 'boolean') {
        if (e.detail.online) onOnline();
        else onOffline();
      }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('cms:connectivity', onCustom);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('cms:connectivity', onCustom);
    };
  }, [flushSave]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirtyRef.current) return;
      if (sessionRef.current?.status !== 'in_progress') return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    clearInterval(tickRef.current);
    const active = session?.status === 'in_progress' && uiStatus === 'active';
    if (!active || remainingAtSyncRef.current == null || !syncAtRef.current) return undefined;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - syncAtRef.current) / 1000);
      const next = Math.max(0, remainingAtSyncRef.current - elapsed);
      remainingRef.current = next;
      setRemainingSeconds(next);
      if (next <= 0 && !expireOnceRef.current) {
        expireOnceRef.current = true;
        submit({ auto: true });
      }
    };
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickRef.current);
  }, [session?.status, uiStatus, session?.serverNow, session?.remainingSeconds, submit]);

  useEffect(() => () => {
    clearTimeout(saveTimerRef.current);
    clearTimeout(retryTimerRef.current);
    clearInterval(tickRef.current);
  }, []);

  const currentQuestion = questions[currentIndex] || null;
  const answeredCount = useMemo(
    () => questions.filter((q) => isQuestionAnswered(q, answers[q.id])).length,
    [questions, answers],
  );
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const locked = uiStatus !== 'active'
    || submitting
    || session?.status !== 'in_progress'
    || remainingSeconds === 0;

  return {
    session,
    questions,
    currentQuestion,
    currentIndex,
    answers,
    loading,
    saving,
    submitting,
    error,
    uiStatus,
    remainingSeconds,
    saveError,
    offline,
    justSubmitted,
    autoSubmitted,
    answeredCount,
    unansweredCount,
    locked,
    loadSession,
    selectAnswer,
    next,
    previous,
    goToQuestion,
    saveAnswer: flushSave,
    submit,
  };
}
