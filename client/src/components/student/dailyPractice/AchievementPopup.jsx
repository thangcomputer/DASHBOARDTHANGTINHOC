import PracticeCompletionModal from './PracticeCompletionModal';

const CELEBRATED_MEMORY = new Set();

export function hasCelebratedSession(eventKey) {
  if (!eventKey) return false;
  if (CELEBRATED_MEMORY.has(eventKey)) return true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(`dp_achievement_celebrated:${eventKey}`) === '1';
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function markCelebratedSession(eventKey) {
  if (!eventKey) return;
  CELEBRATED_MEMORY.add(eventKey);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`dp_achievement_celebrated:${eventKey}`, '1');
    }
  } catch {
    /* ignore */
  }
}

export default PracticeCompletionModal;
