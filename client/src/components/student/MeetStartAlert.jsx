import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Clock, Video, X } from 'lucide-react';
import meetClassApi from '../../services/meetClassApi';
import api from '../../services/api';
import { isMeetLiveNow, isMeetJoinWindow, meetLessonName, vnScheduleClock } from '../../utils/meetJoin';
import { normalizeScheduleDate } from '../../utils/scheduleTime';
import { NOTIFICATION_SOUND_URL, isSoundMuted, unlockAudio } from '../../utils/sound';

const STORAGE_KEY = 'meet_start_alerted';
const SNOOZE_MS = 5 * 60 * 1000; // Nhắc lại sau 5 phút nếu chưa vào lớp

function readDismissed() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    return typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    return {};
  }
}

function rememberDismissed(id, durationMs = SNOOZE_MS) {
  const map = readDismissed();
  map[String(id)] = Date.now() + durationMs;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore storage error */
  }
}

function isDismissed(id) {
  const map = readDismissed();
  const until = map[String(id)];
  return Boolean(until && Date.now() < until);
}

function dayLabel(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return 'Hôm nay';
  try {
    const date = new Date(`${day}T12:00:00+07:00`);
    const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' });
    const [, month, dateNum] = String(day).split('-');
    return `${weekday}, ${dateNum}/${month}`;
  } catch {
    return day;
  }
}

/**
 * Popup giữa màn hình + chuông khi đến giờ vào lớp học / dạy học theo lịch.
 * Hỗ trợ cả Học viên (role === 'student') và Giảng viên (role === 'teacher').
 */
export default function MeetStartAlert({ role = 'student', session = null }) {
  const [item, setItem] = useState(null);
  const audioRef = useRef(null);
  const isFreePortal = role === 'student' && (
    session?.freePortal === true ||
    (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student'))
  );

  // Lắng nghe socket event 'class:reminder' từ server
  useEffect(() => {
    const onClassReminder = (e) => {
      const reminder = e?.detail;
      if (!reminder) return;
      const fakeId = `socket-${reminder.startTime || Date.now()}`;
      if (isDismissed(fakeId)) return;
      setItem({
        id: fakeId,
        title: reminder.course || reminder.title || 'Buổi học trực tuyến',
        course: reminder.course || reminder.title || 'Buổi học trực tuyến',
        startTime: reminder.startTime || '',
        endTime: reminder.endTime || '',
        linkHoc: reminder.linkHoc || reminder.meetingUrl || '',
        personInfo: role === 'teacher' ? (reminder.studentName ? `Học viên: ${reminder.studentName}` : '') : (reminder.teacherName ? `Giảng viên: ${reminder.teacherName}` : ''),
        isLive: true,
      });
    };

    window.addEventListener('class:live-reminder', onClassReminder);
    return () => window.removeEventListener('class:live-reminder', onClassReminder);
  }, [role]);

  // Quét định kỳ lịch học hôm nay từ API (mỗi 15 giây)
  useEffect(() => {
    let active = true;

    const tick = async () => {
      try {
        const clock = vnScheduleClock();
        const todayStr = clock.day;

        // 1. Quét lịch từ Schedule (Lịch 1 kèm 1 / lịch theo khóa - chỉ với GV hoặc học viên chính quy)
        let scheduleRows = [];
        if (!isFreePortal) {
          try {
            const schRes = await api.schedules.getAll({ limit: 100 });
            const allSch = Array.isArray(schRes) ? schRes : (Array.isArray(schRes?.data) ? schRes.data : []);
            scheduleRows = allSch.filter((s) => {
              const sDate = normalizeScheduleDate(s.date);
              const st = String(s.status || '').toLowerCase();
              return sDate === todayStr && st !== 'cancelled' && st !== 'no_show' && st !== 'completed';
            });
          } catch {
            /* Bỏ qua lỗi fetch schedules */
          }
        }

        // 2. Quét thêm từ MeetClass (Lớp Meet nhóm/chung nếu có)
        let meetRows = [];
        try {
          const mRes = await meetClassApi.mine();
          meetRows = Array.isArray(mRes?.data) ? mRes.data : [];
        } catch {
          /* Bỏ qua lỗi fetch meetClass */
        }

        // Gom danh sách ca học hôm nay
        const candidateItems = [];

        // Chuyển scheduleRows thành chuẩn chung
        scheduleRows.forEach((s) => {
          const id = String(s._id || s.id || '');
          if (!id || isDismissed(id)) return;
          const sDay = normalizeScheduleDate(s.date);
          const inWindow = isMeetJoinWindow({
            day: sDay,
            startTime: s.startTime,
            endTime: s.endTime,
            nowDay: clock.day,
            nowMinutes: clock.minutes,
            earlyMinutes: 1,
          });

          if (inWindow) {
            const isLive = isMeetLiveNow({
              day: sDay,
              startTime: s.startTime,
              endTime: s.endTime,
              nowDay: clock.day,
              nowMinutes: clock.minutes,
            });

            const link = String(
              s.linkHoc ||
              s.meetingUrl ||
              s.joinClassUrl ||
              session?.linkHoc ||
              session?.online_meeting_url ||
              ''
            ).trim();
            const person = role === 'teacher'
              ? `Học viên: ${s.studentName || s.studentId?.name || 'Học viên'}`
              : `Giảng viên: ${s.teacherName || s.teacherId?.name || 'Giảng viên'}`;

            candidateItems.push({
              id,
              course: s.course || s.courseName || 'Khóa học',
              title: s.title || s.course || 'Ca học theo lịch',
              day: sDay,
              startTime: s.startTime,
              endTime: s.endTime || '',
              linkHoc: link,
              personInfo: person,
              isLive,
            });
          }
        });

        // Chuyển meetRows thành chuẩn chung
        meetRows.forEach((m) => {
          const id = String(m._id || m.id || '');
          if (!id || isDismissed(id) || String(m.status) === 'cancelled') return;
          const inWindow = isMeetJoinWindow({
            day: m.day,
            startTime: m.startTime,
            endTime: m.endTime,
            nowDay: clock.day,
            nowMinutes: clock.minutes,
            earlyMinutes: 1,
          });

          if (inWindow) {
            const isLive = isMeetLiveNow({
              day: m.day,
              startTime: m.startTime,
              endTime: m.endTime,
              nowDay: clock.day,
              nowMinutes: clock.minutes,
            });

            candidateItems.push({
              id,
              course: m.title || 'Lớp học trực tuyến',
              title: meetLessonName(m),
              day: m.day,
              startTime: m.startTime,
              endTime: m.endTime || '',
              linkHoc: String(m.linkHoc || '').trim(),
              personInfo: '',
              isLive,
            });
          }
        });

        // Tìm ca học ưu tiên nhất (ưu tiên ca đang diễn ra isLive trước, sau đó đến ca sắp diễn ra)
        if (candidateItems.length > 0 && active) {
          candidateItems.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));
          const target = candidateItems[0];
          setItem((current) => current || target);
        }
      } catch {
        /* Im lặng khi mất kết nối */
      }
    };

    tick();
    const timer = setInterval(tick, 45000); // Quét lại mỗi 45 giây thay vì 15 giây
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [role, isFreePortal]);

  // Âm thanh chuông báo khi popup hiện
  useEffect(() => {
    if (!item || isSoundMuted()) return undefined;
    unlockAudio();
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.loop = true;
    audio.volume = 0.85;
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [item]);

  if (!item) return null;

  const close = () => {
    const id = String(item.id || '');
    if (id) {
      rememberDismissed(id, SNOOZE_MS);
    }
    setItem(null);
  };

  const onJoin = () => {
    const id = String(item.id || '');
    if (id) {
      rememberDismissed(id, 2 * 60 * 60 * 1000);
    }
    setItem(null);
  };

  const link = String(item.linkHoc || '').trim();
  const isTeacher = role === 'teacher';

  return (
    <div className="meet-start-alert" role="dialog" aria-modal="true" aria-labelledby="meet-start-alert-title">
      <button type="button" className="meet-start-alert__backdrop" aria-label="Đóng cảnh báo" onClick={close} />
      <div className="meet-start-alert__card">
        <button type="button" className="meet-start-alert__close" onClick={close} aria-label="Đóng">
          <X size={18} />
        </button>

        <p className="meet-start-alert__kicker">
          {item.isLive
            ? (isTeacher ? '🔴 ĐÃ ĐẾN GIỜ VÀO LỚP DẠY!' : '🔴 ĐÃ ĐẾN GIỜ VÀO HỌC!')
            : (isTeacher ? '⏰ SẮP ĐẾN GIỜ DẠY HỌC (CÒN 1 PHÚT)' : '⏰ SẮP ĐẾN GIỜ VÀO HỌC (CÒN 1 PHÚT)')}
        </p>

        <h2 id="meet-start-alert-title" className="meet-start-alert__title">
          {item.course || item.title}
        </h2>

        <p className="meet-start-alert__meta">
          <Clock size={16} className="text-red-500 shrink-0" aria-hidden="true" />
          <span>{item.startTime} {item.endTime ? `– ${item.endTime}` : ''}</span>
        </p>

        <p className="meet-start-alert__meta">
          <Calendar size={16} className="text-red-500 shrink-0" aria-hidden="true" />
          <span>{dayLabel(item.day)}</span>
        </p>

        {item.personInfo ? (
          <p className="mt-1 text-xs font-bold text-slate-600 bg-slate-50 py-1 px-3 rounded-lg inline-block border border-slate-200/60">
            {item.personInfo}
          </p>
        ) : null}

        <div className="meet-start-alert__actions mt-4">
          {link ? (
            <a
              className="meet-start-alert__join bg-red-600 hover:bg-red-700 text-white font-black text-sm py-2.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onJoin}
            >
              <Video size={18} aria-hidden="true" />
              <span>{isTeacher ? 'Vào lớp dạy ngay' : 'Vào lớp ngay'}</span>
            </a>
          ) : (
            <p className="meet-start-alert__nolink text-xs font-semibold text-amber-600 bg-amber-50 py-2 px-3 rounded-lg border border-amber-200">
              Buổi học này chưa được cấu hình đường link vào lớp
            </p>
          )}
          <button
            type="button"
            className="meet-start-alert__later text-xs font-bold text-slate-500 hover:text-slate-700 py-1.5 transition"
            onClick={close}
          >
            Nhắc lại sau 5 phút
          </button>
        </div>
      </div>
    </div>
  );
}
