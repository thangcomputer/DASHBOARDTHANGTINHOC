import { useEffect, useState } from 'react';
import {
  PRACTICE_SESSION_ACTIVE_EVENT,
  isPracticeSessionActive,
  setPracticeSessionActive,
} from './practiceSessionState';

export {
  PRACTICE_SESSION_ACTIVE_EVENT,
  isPracticeSessionActive,
  setPracticeSessionActive,
};

/** Hook theo dõi trạng thái đang làm bài luyện tập trên Web App. */
export function usePracticeSessionActive() {
  const [active, setActive] = useState(isPracticeSessionActive);

  useEffect(() => {
    const sync = () => setActive(isPracticeSessionActive());
    sync();
    window.addEventListener(PRACTICE_SESSION_ACTIVE_EVENT, sync);
    return () => window.removeEventListener(PRACTICE_SESSION_ACTIVE_EVENT, sync);
  }, []);

  return active;
}
