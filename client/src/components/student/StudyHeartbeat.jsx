import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import { STUDY_MINUTE_EVENT, isStudyLocation, isStudyMediaPlaying } from '../../utils/learningGoal';

const BEAT_MS = 60 * 1000;
const IDLE_MS = 3 * 60 * 1000;
/** Đang thao tác bên trong khung nhúng (Vimeo…) — trang cha không nhận được sự kiện chuột. */
const EMBED_IDLE_MS = 30 * 60 * 1000;

/**
 * Cộng 1 phút học mỗi phút khi HV ở trang học và tab đang hiển thị, kèm một trong hai:
 * - video đang phát thật (không cần chạm chuột);
 * - cửa sổ trình duyệt đang được dùng (focus) và có thao tác trong 3 phút gần nhất.
 */
export default function StudyHeartbeat() {
  const location = useLocation();
  const studying = isStudyLocation(location.pathname, location.hash);
  const lastActiveRef = useRef(Date.now());

  useEffect(() => {
    const touch = () => { lastActiveRef.current = Date.now(); };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
    events.forEach((name) => window.addEventListener(name, touch, { passive: true, capture: true }));
    return () => events.forEach((name) => window.removeEventListener(name, touch, { capture: true }));
  }, []);

  useEffect(() => {
    if (!studying) return undefined;
    lastActiveRef.current = Date.now();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const onDailyPractice = /^\/student\/daily-practice(\/|$)/.test(location.pathname);
      if (onDailyPractice) {
        if (!isStudyMediaPlaying()) return;
      } else if (!isStudyMediaPlaying()) {
        if (!document.hasFocus()) return;
        const idleLimit = document.activeElement?.tagName === 'IFRAME' ? EMBED_IDLE_MS : IDLE_MS;
        if (Date.now() - lastActiveRef.current > idleLimit) return;
      }
      lessonPracticeApi.student.studyHeartbeat()
        .then((res) => {
          window.dispatchEvent(new CustomEvent(STUDY_MINUTE_EVENT, { detail: res?.data || {} }));
        })
        .catch(() => {});
    }, BEAT_MS);
    return () => window.clearInterval(timer);
  }, [studying]);

  return null;
}
