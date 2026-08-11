import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, CheckCircle, Lock, ChevronRight, Clock, Award, BookOpen,
  ArrowLeft, Shield, Users, BarChart2, RefreshCw, GraduationCap,
  PlayCircle, ChevronDown, ChevronUp, Star, AlertCircle, CheckCircle2,
  FileBox, Video, Download, FileText, Timer, FileUp, UploadCloud, Link as LinkIcon
} from 'lucide-react';

import { useData } from '../context/DataContext';
import { getClientEnrollments } from '../utils/enrollments';
import {
  buildExamSubjectsFromProgress,
  getExamSubjectMeta,
  getSubjectIdsForStudent,
} from '../utils/examSubjects';
import StudentExamRoom from './StudentExamRoom';
import api, { buildMediaDownloadUrl, resolveMediaUrl, csrfFetch } from '../services/api';
import { useToast } from '../utils/toast';
import { htmlToPlainText, sanitizeRichHtml } from '../utils/htmlContent';
import { formatLessonDisplayTitle } from '../utils/lmsLessonUi';
import { getGradeBadgeClasses, getGradeIconClasses } from '../utils/gradeColors';
import LmsPlayerPanels, { LmsTabBar } from './lms/LmsPlayerTabs';

const MOCK_COURSES = [
  {
    _id: '1', title: 'Đào tạo Giảng viên Mới', progress: 0,
    videos: [{ title: 'Giới thiệu về Thắng Tin Học', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 635 }, { title: 'Tổng quan công việc', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 920 }],
    files: [{ title: 'Quy trình giảng dạy.pdf', type: 'PDF', size: '2 MB' }, { title: 'Sổ tay Giảng viên.docx', type: 'DOCX', size: '1 MB' }],
    notices: ['Chào mừng các bạn đến với TT', 'Hãy xem hết các video trước khi nhận lớp']
  },
  {
    _id: '2', title: 'Kỹ năng Đứng lớp Chuyên sâu', progress: 45,
    videos: [{ title: 'Xử lý tình huống học viên yếu', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 2412 }],
    files: [{ title: 'Quy trình xử lý.docx', type: 'DOCX', size: '500 KB' }],
    notices: ['Nhớ nộp bài thu hoạch trước 15/4 ngay sau khi xem video']
  },
  {
    _id: '3', title: 'Khóa học Excel Nâng cao', progress: 100,
    videos: [{ title: 'Hàm logic phức tạp', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 2100 }],
    files: [{ title: 'Bài tập thực hành.xlsx', type: 'EXCEL', size: '3.5 MB' }],
    notices: []
  },
  {
    _id: '4', title: 'Bảo mật và An toàn thông tin', progress: 80,
    videos: [{ title: 'Bảo quản dữ liệu học viên', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 1210 }],
    files: [],
    notices: ['Bắt buộc hoàn thành trong tháng 4']
  }
];

const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!deadline) return;
    const calc = () => {
      const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
      const d = new Date(new Date(deadline).toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
      d.setHours(23, 59, 59, 999);
      const diff = d.getTime() - now.getTime();
      if (diff <= 0) return 'Đã hết hạn';
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      return `${days} ngày ${h} giờ ${m} phút ${s}s`;
    };
    setTimeLeft(calc());
    const intv = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(intv);
  }, [deadline]);
  if (!deadline) return <span className="text-slate-400">Không có hạn chót</span>;
  return <span className="text-orange-600 font-bold">{timeLeft}</span>;
};

const CircularProgress = ({ progress, size = 112 }) => {
  const isSmall = size < 100;
  const radius = isSmall ? 25 : 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  let strokeColor = 'text-slate-100';
  let pathColor = 'text-green-500';
  if (progress === 0) pathColor = 'text-slate-200';
  else if (progress === 100) pathColor = 'text-emerald-500';

  const viewBoxSize = isSmall ? 64 : 112;
  const center = viewBoxSize / 2;
  const strokeW = isSmall ? 4 : 6;

  return (
    <div className="relative flex items-center justify-center pt-1">
      <svg width={size} height={size} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="transform -rotate-90">
        <circle cx={center} cy={center} r={radius} stroke="currentColor" strokeWidth={strokeW} fill="transparent" className={strokeColor} />
        <circle cx={center} cy={center} r={radius} stroke="currentColor" strokeWidth={strokeW} fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          className={`${pathColor} transition-all duration-1000 ease-out`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        {progress === 100 ? (
          <CheckCircle2 size={isSmall ? 20 : 32} className="text-emerald-500" />
        ) : (
          <span className={`${isSmall ? 'text-xs pb-1 inline-block' : 'text-xl pb-1'} font-black text-slate-800 tracking-tighter`}>{progress}%</span>
        )}
      </div>
    </div>
  );
};

// ─── Helper: Gọi API training-lms ────────────────────────────────────────────
const lmsApiFetch = async (endpoint, options = {}) => {
  const token =
    localStorage.getItem('student_access_token') ||
    localStorage.getItem('teacher_access_token') ||
    localStorage.getItem('admin_access_token') ||
    (() => {
      try { return JSON.parse(localStorage.getItem('student_user') || '{}').token; } catch { return null; }
    })() ||
    (() => {
      try { return JSON.parse(localStorage.getItem('teacher_user') || '{}').token; } catch { return null; }
    })() ||
    (() => {
      try { return JSON.parse(localStorage.getItem('admin_user') || '{}').token; } catch { return null; }
    })();

  const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
  const res = await csrfFetch(`${API_BASE}/training-lms${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res.json();
};

// ─── Helper: Extract YouTube ID ──────────────────────────────────────────────
const extractYouTubeId = (url = '') => {
  if (!url) return '';
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : url.trim();
};

// ─── YOUTUBE PLAYER COMPONENT ────────────────────────────────────────────────
// Logic mới: Cho phép tua nhưng đếm giây XEM THỰC TẾ
// Mở khóa khi đã xem đủ 2/3 tổng thời lượng video
// ─── PLAYER LINH HOẠT CHO HỌC VIÊN ─────────────────────────────────────────────


const StudentVideoPlayer = ({
  videoId,
  lessonId,
  courseId,
  initialWatchedSeconds = 0,
  antiSeekEnabled = true,
  onSaveProgress,
  onVideoEnded,
  onEligibilityReached,
  playerApiRef = null,
}) => {
  const yId = extractYouTubeId(videoId);
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [hasEnded, setHasEnded] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [displayWatched, setDisplayWatched] = useState(0);
  const [isTabActive, setIsTabActive] = useState(true);
  /** Cho phép lăn chuột qua vùng video (iframe YT bắt wheel nếu pointer-events: auto). */
  const [playerInteractive, setPlayerInteractive] = useState(false);

  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const intervalRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const pauseTimeoutRef = useRef(null);

  // Restore watched seconds from sessionStorage or initialWatchedSeconds
  const bestInitial = useMemo(() => {
    const sessionWatched = sessionStorage.getItem(`student_lms_watched_${lessonId}`);
    if (sessionWatched !== null) {
      return Number(sessionWatched);
    }
    return Number(initialWatchedSeconds) || 0;
  }, [lessonId, initialWatchedSeconds]);

  const actualWatchedRef = useRef(bestInitial);

  // Chỉ reset overlay khi đổi bài — không bật lại nút Play khi parent cập nhật tiến độ
  useEffect(() => {
    const sessionWatched = sessionStorage.getItem(`student_lms_watched_${lessonId}`);
    const initial = sessionWatched !== null
      ? Number(sessionWatched)
      : (Number(initialWatchedSeconds) || 0);
    actualWatchedRef.current = initial;
    setDisplayWatched(initial);
    setHasEnded(false);
    setOverlayVisible(true);
    setPlayerInteractive(false);
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps -- lesson switch only

  useEffect(() => {
    if (bestInitial > actualWatchedRef.current) {
      actualWatchedRef.current = bestInitial;
      setDisplayWatched(bestInitial);
    }
  }, [bestInitial]);

  // ── Auto-Unlock khi đạt 2/3 ──────────────────────────────────────────
  useEffect(() => {
    if (!totalDuration || !onEligibilityReached) return;
    const reqSecs = Math.ceil(totalDuration * 2 / 3);
    // Nếu tắt chống tua (antiSeekEnabled === false) hoặc xem đủ mốc 2/3
    if (!antiSeekEnabled || (displayWatched >= reqSecs && displayWatched > 0)) {
      onEligibilityReached(displayWatched || totalDuration, totalDuration);
    }
  }, [displayWatched, totalDuration, onEligibilityReached, antiSeekEnabled]);

  // ── Giám sát tab ẩn (không dùng window.blur — iframe YouTube fire blur khi rê/click) ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTabActive(false);
        if (playerRef.current?.pauseVideo) {
          try { playerRef.current.pauseVideo(); } catch (e) { void 0; }
        }
      } else {
        setIsTabActive(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ── Khởi tạo YouTube Iframe API ──────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return;

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setIsReady(false);
      setHasEnded(false);
      setPlayerInteractive(false);

      playerRef.current = new window.YT.Player(`student-yt-player-${lessonId}`, {
        videoId: extractYouTubeId(videoId),
        playerVars: {
          controls: 1,           // Cho phép tua nhưng đếm giây thực tế
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 0,
          start: bestInitial ? Math.floor(bestInitial) : 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            setIsReady(true);
            const dur = event.target.getDuration();
            if (dur > 0) setTotalDuration(dur);
            if (bestInitial > 0) {
              event.target.seekTo(bestInitial, true);
            }
          },
          onStateChange: handleStateChange,
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      if (!document.getElementById('yt-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(autoSaveTimerRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId, lessonId]);

  // ── Đếm giây thực tế khi PLAYING ─────────────────────────────────────────────
  const startCounting = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      actualWatchedRef.current += 1;
      setDisplayWatched(actualWatchedRef.current);
      sessionStorage.setItem(`student_lms_watched_${lessonId}`, actualWatchedRef.current);
    }, 1000);
  }, [lessonId]);

  const stopCounting = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  // ── Auto-save mỗi 30 giây ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !lessonId || !courseId) return;
    autoSaveTimerRef.current = setInterval(() => {
      if (actualWatchedRef.current > 0 && onSaveProgress) {
        onSaveProgress(lessonId, actualWatchedRef.current);
      }
    }, 30000);
    return () => clearInterval(autoSaveTimerRef.current);
  }, [isReady, lessonId, courseId, onSaveProgress]);

  useEffect(() => {
    if (!playerApiRef) return undefined;
    playerApiRef.current = {
      getCurrentTime: () => {
        try {
          return Number(playerRef.current?.getCurrentTime?.()) || 0;
        } catch {
          return 0;
        }
      },
    };
    return () => {
      playerApiRef.current = null;
    };
  }, [playerApiRef, isReady, lessonId]);

  const handleStateChange = useCallback((event) => {
    const state = event.data;
    if (state === window.YT.PlayerState.PLAYING) {
      setOverlayVisible(false);
      setIsPaused(false);
      startCounting();
      if (!totalDuration || totalDuration === 0) {
        const dur = event.target.getDuration?.();
        if (dur > 0) setTotalDuration(dur);
      }
    }
    if (state === window.YT.PlayerState.PAUSED) {
      stopCounting();
      setIsPaused(true);
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1200);
    }
    if (state === window.YT.PlayerState.ENDED) {
      stopCounting();
      setHasEnded(true);
      setOverlayVisible(true);
      if (onVideoEnded) {
        onVideoEnded(actualWatchedRef.current, totalDuration);
      }
    }
  }, [onVideoEnded, startCounting, stopCounting, totalDuration]);

  if (!yId) {
    return (
      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center rounded-2xl relative overflow-hidden group">
        <AlertCircle size={40} className="text-slate-600 mb-4" />
        <p className="text-slate-400 font-bold">Chưa có link video</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div
        ref={containerRef}
        className="relative w-full h-full min-h-0 lg:rounded-2xl overflow-hidden bg-black shadow-lg group"
        onMouseLeave={() => setPlayerInteractive(false)}
      >
        <div
          id={`student-yt-player-${lessonId}`}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: playerInteractive || overlayVisible ? 'auto' : 'none' }}
        />
        {!overlayVisible && !playerInteractive ? (
          <button
            type="button"
            aria-label="Tương tác video"
            className="absolute inset-0 z-[15] cursor-default bg-transparent border-0 p-0"
            onClick={() => setPlayerInteractive(true)}
          />
        ) : null}

        {/* ▶️ PREMIUM OVERLAY — chỉ lúc chưa phát / xem lại */}
        {overlayVisible && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4"
            style={{ background: 'linear-gradient(135deg, rgba(10,14,24,0.88) 0%, rgba(15,25,50,0.75) 100%)' }}
            onContextMenu={e => e.preventDefault()}
          >
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
              <div className="bg-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded-md tracking-widest uppercase shadow-lg">THẮNG TIN HỌC</div>
            </div>
            <button
              type="button"
              onClick={() => playerRef.current?.playVideo?.()}
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-200 hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)', boxShadow: '0 0 32px rgba(16,185,129,0.4), 0 8px 24px rgba(0,0,0,0.35)' }}
              aria-label="Phát video"
            >
              <Play size={28} className="text-white ml-1 drop-shadow-lg" fill="white" />
            </button>
            <p className="mt-4 text-white/70 text-sm font-semibold tracking-wide text-center">
              {hasEnded ? 'Xem lại bài học' : 'Nhấn để bắt đầu học'}
            </p>
            {hasEnded && (
              <span className="mt-2 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle size={13} /> Đã xem xong
              </span>
            )}
          </div>
        )}

        {/* INACTIVE TAB OVERLAY */}
        {!isTabActive && !overlayVisible && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 text-center bg-slate-950/95"
            onContextMenu={e => e.preventDefault()}
          >
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mb-4">
              <Lock size={28} />
            </div>
            <h3 className="text-red-400 font-black text-sm uppercase tracking-wider">Video Đã Tạm Dừng</h3>
            <p className="text-slate-400 text-xs mt-2 max-w-[240px] leading-relaxed">
              Bạn đã chuyển tab hoặc rời khỏi trang học. Vui lòng quay lại tab này để tiếp tục học.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};




// ─── LESSON SIDEBAR ITEM ─────────────────────────────────────────────────────
const LessonItem = ({ lesson, index, isCurrent, onClick }) => {
  const mins = lesson.duration ? Math.floor(lesson.duration / 60) : 0;
  const secs = lesson.duration ? String(lesson.duration % 60).padStart(2, '0') : '00';

  return (
    <div
      onClick={() => lesson.isUnlocked && onClick(lesson)}
      className={`flex items-start gap-3 px-5 py-4 border-b border-slate-100 transition-all relative
        ${!lesson.isUnlocked ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        ${isCurrent ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : lesson.isCompleted ? 'bg-slate-50 border-l-4 border-l-transparent' : 'bg-white hover:bg-slate-50 border-l-4 border-l-transparent'}
      `}
    >
      {/* Status Icon */}
      <div className="mt-0.5 flex-shrink-0">
        {lesson.isCompleted ? (
          <CheckCircle size={18} className="text-emerald-600" />
        ) : !lesson.isUnlocked ? (
          <Lock size={16} className="text-slate-400" />
        ) : isCurrent ? (
          <div className="w-[18px] h-[18px] rounded-full border-2 border-emerald-600 flex items-center justify-center">
            <div className="w-2 h-2 bg-emerald-600 rounded-full animate-ping" />
          </div>
        ) : (
          <PlayCircle size={18} className="text-slate-300" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className={`text-sm leading-snug line-clamp-2 ${isCurrent ? 'text-emerald-700 font-black' : lesson.isCompleted ? 'text-slate-500 font-semibold' : 'text-slate-700 font-bold'}`}>
          {formatLessonDisplayTitle(lesson.title, index)}
        </h4>
        {lesson.duration ? (
          <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-semibold">
            <Clock size={9} /> {mins}:{secs}
          </span>
        ) : null}
      </div>

      {lesson.isCompleted && (
        <div className="flex-shrink-0 w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <CheckCircle size={10} className="text-emerald-400" />
        </div>
      )}
    </div>
  );
};

// ─── ADMIN PROGRESS PANEL ────────────────────────────────────────────────────
const AdminProgressPanel = ({ courseId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await lmsApiFetch(`/admin/progress/${courseId}`);
      if (res.success) setData(res.data);
    } catch (e) { void 0 }
    setLoading(false);
  };

  useEffect(() => { if (courseId) load(); }, [courseId]);

  return (
    <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden">
      <div className="px-8 py-6 bg-gradient-to-r from-green-900 to-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <Users size={20} />
          <h3 className="font-black text-base uppercase tracking-wide">Tiến độ Giảng viên</h3>
        </div>
        <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400">Đang tải...</div>
      ) : data.length === 0 ? (
        <div className="p-10 text-center text-slate-300 text-sm">Chưa có dữ liệu</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {data.map(t => (
            <div key={t.teacherId} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center font-black text-green-700 text-sm flex-shrink-0">
                {(t.teacherName || 'GV')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm truncate">{t.teacherName}</p>
                <p className="text-[10px] text-slate-400">{t.teacherPhone}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs font-black text-slate-700">
                    {t.completedLessons}/{t.totalLessons} bài
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${t.isCertified ? 'bg-emerald-500' : 'bg-green-500'}`}
                        style={{ width: `${t.progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-500">{t.progressPct}%</span>
                  </div>
                </div>
                {t.isCertified ? (
                  <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Award size={16} className="text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Lock size={14} className="text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const StudentTrainingLMS = ({ trainingDataProp, onBack }) => {
  const toast = useToast();
  const trainingData = trainingDataProp || { videos: [], guides: [], files: [] };
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [courseProgressMap, setCourseProgressMap] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [courseTab, setCourseTab] = useState('overview');
  const playerApiRef = useRef(null);
  const [mainTab, setMainTab] = useState('courses'); // courses | guides | files
  const [localSubmissions, setLocalSubmissions] = useState({});
  const [uploadingAssignId, setUploadingAssignId] = useState(null);
  const [expandedFileDescKey, setExpandedFileDescKey] = useState(null);
  const [expandedAssignKey, setExpandedAssignKey] = useState(null);

  const handleFileChange = async (assignmentObj, idx, file) => {
    if (!file) return;
    setUploadingAssignId(idx);
    try {
      const res = await api.assignments.uploadFile(file);
      if (res.success) {
        const fileUrl = res.fileUrl;
        const submitRes = await api.assignments.submit(assignmentObj._id, {
           studentId: student?.id || session?.id,
           teacherId: assignmentObj.teacherId || student?.teacherId || undefined,
           submittedFileUrl: fileUrl
        });

        if (submitRes.success) {
          setLocalSubmissions(prev => ({
            ...prev,
            [idx]: { fileName: file.name, date: new Date().toISOString() }
          }));
          toast?.success('Nộp bài thành công!');
        } else {
          toast?.error('Lỗi nộp bài: ' + submitRes.message);
        }
      } else {
        toast?.error('Lỗi tải file: ' + res.message);
      }
    } catch (e) {
      toast?.error('Lỗi mạng khi tải file. Vui lòng thử lại sau.');
    }
    setUploadingAssignId(null);
  };
  const isAdmin = false; // Always false for student view

  const { students, examSubjectsCatalog } = useData();
  const session = (() => { try { return JSON.parse(localStorage.getItem('student_user') || '{}'); } catch { return {}; } })();
  const student = (students || []).find(s => s.id === session.id) || {};

  const enrollments = useMemo(() => getClientEnrollments(student), [student]);
  const examScoreSubjectIds = useMemo(
    () => getSubjectIdsForStudent(enrollments, student?.course, examSubjectsCatalog),
    [enrollments, student?.course, examSubjectsCatalog]
  );
  const examScoreRows = useMemo(
    () => buildExamSubjectsFromProgress(student?.examProgress, examScoreSubjectIds).map((sub) => ({
      ...sub,
      label: getExamSubjectMeta(sub.id, examSubjectsCatalog).label,
    })),
    [student?.examProgress, examScoreSubjectIds, examSubjectsCatalog]
  );

  /** Bài tập chưa nộp — đã nộp/chấm điểm thì không tính badge tab */
  const pendingAssignmentCount = useMemo(() => {
    const list = trainingData?.assignments || [];
    return list.filter((a, idx) => !a.mySubmission && !localSubmissions[idx]).length;
  }, [trainingData?.assignments, localSubmissions]);

  // Lấy tiến độ khóa học từ server (TrainingProgress) — không dùng localStorage SoT
  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await lmsApiFetch('/progress/me');
        if (cancelled || !res?.success || !res.data) return;
        setCourseProgressMap(res.data);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, mainTab, selectedCourse, courses]);

  // Sync with trainingData from props
  useEffect(() => {
    if (trainingData && trainingData.videos) {
      setCourses(trainingData.videos);
      setLoading(false);
    }
  }, [trainingData]);

  // Load lessons khi chọn khoá học — ưu tiên API server (completed/unlocked)
  useEffect(() => {
    if (!selectedCourse) return;
    const courseId = selectedCourse._id || selectedCourse.id;
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await lmsApiFetch(`/courses/${courseId}/lessons`);
        if (cancelled) return;
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setLessons(res.data);
          const chapters = {};
          res.data.forEach((l) => { chapters[l.chapterTitle || 'Danh mục'] = true; });
          setExpandedChapters(chapters);
          const savedLessonId = sessionStorage.getItem('lms_lessonId');
          const firstActive = (savedLessonId && res.data.find((l) => String(l._id) === savedLessonId && l.isUnlocked))
            || res.data.find((l) => l.isUnlocked && !l.isCompleted)
            || res.data[0];
          setCurrentLesson(firstActive);
        } else {
          // Fallback cấu trúc từ props — completed chỉ từ server khi có API
          let list = [];
          (selectedCourse.chapters || [{ title: 'Danh mục', lessons: selectedCourse.lessons || selectedCourse.videos || [] }]).forEach((chap) => {
            (chap.lessons || []).forEach((l) => {
              const lId = l.id || l._id || `${courseId}-${list.length}`;
              list.push({ ...l, chapterTitle: chap.title, isUnlocked: true, isCompleted: false, _id: lId });
            });
          });
          setLessons(list);
          const chapters = {};
          list.forEach((l) => { chapters[l.chapterTitle || 'Danh mục'] = true; });
          setExpandedChapters(chapters);
          setCurrentLesson(list[0]);
        }
      } catch {
        /* keep prior lessons */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedCourse]);

  // ── Persist session khi reload (Issue #3) ──
  // Lưu courseId đang mở vào sessionStorage
  useEffect(() => {
    if (selectedCourse?._id) {
      sessionStorage.setItem('lms_courseId', selectedCourse._id);
      sessionStorage.setItem('lms_courseTitle', selectedCourse.title || '');
    } else {
      sessionStorage.removeItem('lms_courseId');
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (currentLesson?._id) {
      sessionStorage.setItem('lms_lessonId', currentLesson._id);
    }
  }, [currentLesson]);

  const fetchLessons = async (courseId) => {
    setLoading(true);
    try {
      const res = await lmsApiFetch(`/courses/${courseId}/lessons`);
      if (res?.success && Array.isArray(res.data)) {
        setLessons(res.data);
        const savedLessonId = sessionStorage.getItem('lms_lessonId');
        const firstActive = (savedLessonId && res.data.find(l => String(l._id) === savedLessonId && l.isUnlocked))
          || res.data.find(l => l.isUnlocked && !l.isCompleted)
          || res.data[0];
        setCurrentLesson(firstActive);
        const chapters = {};
        res.data.forEach(l => { chapters[l.chapterTitle || 'Chương 1'] = true; });
        setExpandedChapters(chapters);
      }
    } catch (e) { void 0 }
    setLoading(false);
  };

  // Restore session khi courses đã load
  useEffect(() => {
    const savedCourseId = sessionStorage.getItem('lms_courseId');
    if (!savedCourseId || selectedCourse) return; // Đã có course rồi
    if (courses.length === 0) return;
    const course = courses.find(c => String(c._id || c.id) === String(savedCourseId));
    if (course) {
      setSelectedCourse(course);
      fetchLessons(course._id || course.id);
    }
  }, [courses, selectedCourse]);

  // Auto-Unlock sự kiện khi đạt chuẩn 2/3 (Chạy ngầm, không nhảy video)
  const handleEligibilityReached = useCallback(async (actualWatched, totalDur) => {
    if (!currentLesson || !selectedCourse) return;
    try {
      await lmsApiFetch('/complete-lesson', {
        method: 'POST',
        body: JSON.stringify({
          lessonId: currentLesson._id || currentLesson.id,
          courseId: selectedCourse._id || selectedCourse.id,
          watchedSeconds: actualWatched,
        }),
      });
      const courseId = selectedCourse._id || selectedCourse.id;
      await fetchLessons(courseId);
      try {
        const prog = await lmsApiFetch('/progress/me');
        if (prog?.success && prog.data) setCourseProgressMap(prog.data);
      } catch { /* ignore */ }
    } catch (e) { }
  }, [currentLesson, selectedCourse]);

  // Video kết thúc (được component con tính toán 2/3 và gọi)
  const handleVideoEnded = useCallback(async (actualWatched, totalDur) => {
    if (!currentLesson || !selectedCourse || completing) return;

    const requiredSeconds = Math.ceil((totalDur || 0) * 2 / 3);
    // Tránh việc hiển thị Alert gây khó chịu, nếu người dùng tua video tới cuối mà chưa đủ % học
    // thì video sẽ kết thúc nhưng không gửi API mở khóa, chờ hệ thống tính toán tiến độ thực tế (actualWatched)
    if (false) {
      return;
    }

    setCompleting(true);
    try {
      await lmsApiFetch('/complete-lesson', {
        method: 'POST',
        body: JSON.stringify({
          lessonId: currentLesson._id || currentLesson.id,
          courseId: selectedCourse._id || selectedCourse.id,
          watchedSeconds: actualWatched, // Lưu luôn giây thực tế lúc complete
        }),
      });
      const courseId = selectedCourse._id || selectedCourse.id;
      const res = await lmsApiFetch(`/courses/${courseId}/lessons`);
      if (res?.success && Array.isArray(res.data)) {
        const updatedLessons = res.data;
        setLessons(updatedLessons);
        const currentIdx = updatedLessons.findIndex(l => String(l._id) === String(currentLesson._id));
        const next = updatedLessons[currentIdx + 1];
        if (next?.isUnlocked) {
          setTimeout(() => setCurrentLesson(next), 800);
        }
      }
      try {
        const prog = await lmsApiFetch('/progress/me');
        if (prog?.success && prog.data) setCourseProgressMap(prog.data);
      } catch { /* ignore */ }
    } catch (e) { void 0 }
    setCompleting(false);
  }, [currentLesson, selectedCourse, completing]);

  // Handle lưu progress tạm thời
  const handleSaveProgress = useCallback((lessonId, watchedSeconds) => {
    if (!selectedCourse) return;
    
    lmsApiFetch('/save-watch-progress', {
      method: 'POST',
      body: JSON.stringify({
        lessonId: lessonId,
        courseId: selectedCourse._id || selectedCourse.id,
        watchedSeconds: watchedSeconds,
      }),
    }).catch(e => void 0);
  }, [selectedCourse]);

  const overallProgress = lessons.length > 0
    ? Math.round((lessons.filter(l => l.isCompleted).length / lessons.length) * 100)
    : 0;

  // Group lessons theo chapter
  const groupedLessons = lessons.reduce((acc, l) => {
    const ch = l.chapterTitle || 'Chương 1';
    if (!acc[ch]) acc[ch] = [];
    acc[ch].push(l);
    return acc;
  }, {});

  // ── COURSE LIST VIEW ────────────────────────────────────────────────────────
  if (!selectedCourse) {
    return (
      <div className="w-full animate-in fade-in duration-500 min-h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex gap-3 min-w-0">
            {onBack && (
              <button type="button" onClick={onBack} className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm mt-0.5">
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-bold text-slate-800 tracking-tight leading-snug">
                Tài liệu học tập</h1>
              <p className="text-slate-500 font-medium mt-1 text-xs sm:text-sm leading-relaxed">
                Xem video bài giảng và hoàn thành bài tập về nhà để nắm vững kiến thức
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${showAdminPanel ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
              >
                <BarChart2 size={16} /> <span className="hidden sm:inline">Xem tiến độ</span>
              </button>
            )}
          </div>
        </div>

        {/* Admin Progress Panel */}
        {isAdmin && showAdminPanel && courses.length > 0 && (
          <div className="mb-6">
            <AdminProgressPanel courseId={courses[0]?._id} />
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-2 w-full mb-5 relative z-10">
          {[
            { key: 'courses', icon: PlayCircle, label: 'Video học tập', count: courses.length },
            { key: 'files', icon: FileBox, label: 'Tài liệu', count: trainingData?.files?.length || 0 },
            { key: 'assignments', icon: BookOpen, label: 'Bài tập về nhà', count: pendingAssignmentCount },
            { key: 'exams', icon: Award, label: 'Điểm thi', count: (student.examProgress || []).filter(ep => ep.status && ep.status !== 'chua_thi').length },
          ].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMainTab(t.key)}
              title={t.label}
              aria-label={t.label}
              className={`relative flex w-full min-w-0 flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl text-sm font-semibold transition-all ${mainTab === t.key
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              <t.icon size={15} className="shrink-0" aria-hidden="true" />
              <span className="text-[11px] leading-tight text-center line-clamp-2 min-h-[2.1rem]">
                {t.label}
              </span>
              {t.count > 0 && (
                <span className={`absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-black leading-none ${mainTab === t.key ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {mainTab === 'courses' && (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-gray-100 animate-pulse rounded-[32px] h-64" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-white rounded-3xl border border-dashed border-slate-200">
              <BookOpen size={48} className="mx-auto mb-4 text-slate-200" />
              <p className="font-bold">Chưa có khóa học nào</p>
              <p className="text-xs mt-1">Chưa có video đào tạo phù hợp với môn bạn đang học. Liên hệ Admin nếu bạn nghĩ đây là lỗi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {courses.map((course, idx) => {
                const gradients = [
                  "from-blue-600 to-indigo-700",
                  "from-emerald-500 to-teal-600",
                  "from-violet-600 to-fuchsia-600",
                  "from-cyan-500 to-blue-700"
                ];
                const bgClass = gradients[idx % gradients.length];
                const progress = courseProgressMap[course.id || course._id] || course.overallProgress || course.progress || 0;
                const lessonCount = course.chapters ? course.chapters.reduce((acc, ch) => acc + (ch.lessons ? ch.lessons.length : 0), 0) : ((course.lessons || course.videos || [1]).length);
                return (
                  <div onClick={() => {
                    setSelectedCourse(course);
                    setCourseTab('overview');
                    fetchLessons(course.id || course._id);
                  }} key={course.id || course._id} className="bg-white rounded-2xl border border-slate-100 shadow-md transition-all duration-200 cursor-pointer group flex flex-col overflow-hidden hover:shadow-xl lg:hover:-translate-y-1 lg:hover:shadow-xl">

                    <div className={`relative aspect-video bg-gradient-to-r ${bgClass} overflow-hidden`}>
                      <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors pointer-events-none" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_35%)] pointer-events-none" />

                      <div className="absolute top-4 right-4">
                        {course.category && String(course.category).trim() && String(course.category).toUpperCase() !== 'MẶC ĐỊNH' ? (
                          <span className="bg-white/20 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-medium uppercase tracking-wider">
                            {course.category}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                        {course.title}
                          </h3>
                        </div>
                        <div className="shrink-0 text-right min-w-[3rem]">
                          <p className="text-sm font-bold text-slate-700">{progress}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-4 flex-1">
                        {htmlToPlainText(course.description || course.desc) ||
                          'Hoàn thành khóa học này để nâng cao kiến thức và kỹ năng thực hành.'}
                      </p>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                        <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                          <Video size={14} className="text-slate-400" />
                          <span>{lessonCount} BÀI HỌC</span>
                        </div>

                        <div className="flex items-center gap-1 text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">
                          <span>VÀO HỌC</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* FILES TAB */}
        {mainTab === 'files' && (
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              <Download className="text-green-600" /> Tài liệu Khóa học
            </h2>
            <div className="space-y-3">
              {trainingData?.files?.map((file, idx) => {
                const fKey = file.id ?? `f-${idx}`;
                const descHtml = file.desc || '';
                const plain = htmlToPlainText(descHtml);
                const defaultNote = 'Tài liệu đính kèm từ Admin.';
                const hasHtml = /<[a-z][\s\S]*>/i.test(descHtml);
                const expanded = expandedFileDescKey === fKey;
                const showToggle = plain.length > 120 || hasHtml;
                return (
                  <div key={fKey} className="p-4 rounded-xl border border-slate-100 hover:bg-green-50/50 hover:border-green-200 transition-all flex flex-col md:flex-row justify-between md:items-start gap-4 group">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm ${file.fileType === 'PDF' ? 'bg-rose-500' : 'bg-green-500'}`}>
                        {file.fileType || 'FILE'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-green-700 transition-colors">{file.title}</h3>
                        {!descHtml && !plain ? (
                          <p className="text-[12px] text-slate-500 mt-1 mb-1">{defaultNote}</p>
                        ) : expanded && hasHtml ? (
                          <div
                            className="text-[12px] text-slate-600 mt-1 mb-1 max-h-[240px] overflow-y-auto leading-relaxed break-words [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-semibold [&_strong]:font-semibold [&_a]:text-green-600 [&_a]:underline"
                            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(descHtml) }}
                          />
                        ) : (
                          <p className={`text-[12px] text-slate-500 mt-1 mb-1 ${showToggle && !expanded ? 'line-clamp-2' : ''} whitespace-pre-wrap`}>
                            {plain || defaultNote}
                          </p>
                        )}
                        {showToggle ? (
                          <button
                            type="button"
                            onClick={() => setExpandedFileDescKey(expanded ? null : fKey)}
                            className="text-[11px] font-bold text-green-600 hover:text-green-800 mt-0.5"
                          >
                            {expanded ? 'Thu gọn' : 'Xem thêm mô tả / lưu ý'}
                          </button>
                        ) : null}
                        <p className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 w-fit rounded mt-1">{file.fileSize || 'N/A'}</p>
                      </div>
                    </div>
                    {!file.fileUrl ? (
                      <span className="w-full md:w-auto px-5 py-2.5 rounded-[10px] text-sm font-bold text-slate-400 border border-slate-100 bg-slate-50 text-center shrink-0 self-center md:self-start">Chưa có file</span>
                    ) : (() => {
                      const href = buildMediaDownloadUrl(
                        file.fileUrl,
                        file.fileOriginalName || file.title,
                      );
                      if (!href) {
                        return (
                          <span className="w-full md:w-auto px-5 py-2.5 rounded-[10px] text-sm font-bold text-amber-700 border border-amber-200 bg-amber-50 text-center shrink-0 self-center md:self-start">
                            Link lỗi — Admin upload lại
                          </span>
                        );
                      }
                      return (
                        <a
                          href={href}
                          className="w-full md:w-auto px-5 py-2.5 bg-green-50 text-green-700 border border-transparent rounded-[10px] text-sm font-bold group-hover:bg-green-600 group-hover:text-white group-hover:shadow-md transition-all shrink-0 flex items-center justify-center gap-2 self-center md:self-start no-underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download size={16} /> Tải về
                        </a>
                      );
                    })()}
                  </div>
                );
              })}
              {(!trainingData?.files || trainingData.files.length === 0) && (
                <div className="col-span-full py-16 text-center text-slate-400">
                  <FileBox size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="font-bold">Chưa có tài liệu</p>
                  <p className="text-xs mt-1">Chưa có tài liệu phù hợp với môn bạn đang học. Liên hệ Admin nếu bạn nghĩ đây là lỗi.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ASSIGNMENTS TAB */}
        {mainTab === 'assignments' && (
          <div className="bg-white rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 flex items-center gap-2.5">
              <BookOpen className="text-green-600" /> Bài tập được giao
            </h2>
            <div className="space-y-3">
              {trainingData?.assignments?.map((a, idx) => {
                const submission = a.mySubmission || localSubmissions[idx];
                let targetDate = null;
                let isLate = false;
                if (a.deadline) {
                  const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
                  targetDate = new Date(new Date(a.deadline).toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
                  targetDate.setHours(23, 59, 59, 999);
                  isLate = now.getTime() > targetDate.getTime();
                }
                const aKey = a._id || a.id || `a-${idx}`;
                const aDesc = a.description || '';
                const aPlain = htmlToPlainText(aDesc);
                const aHasHtml = /<[a-z][\s\S]*>/i.test(aDesc);
                const aExpanded = expandedAssignKey === aKey;
                const aShowToggle = aPlain.length > 160 || aHasHtml;
                const aDefault = 'Hoàn thành và nộp file bài tập theo đúng định dạng được yêu cầu (.zip, .rar, .pdf).';
                const isAdminAssign = ['admin', 'staff'].includes(String(a.assignedByRole || '').toLowerCase());
                const isTeacherAssign = String(a.assignedByRole || '').toLowerCase() === 'teacher'
                  || (!a.assignedByRole && !!a.teacherId);
                const assignerLabel = isAdminAssign
                  ? 'Admin giao'
                  : (isTeacherAssign ? 'Giáo viên' : (a.assignedByName ? String(a.assignedByName) : 'Giáo viên'));
                const teacherName = String(a.assignedByName || '').trim();
                return (
                  <div key={aKey} className="p-4 rounded-2xl border border-slate-100 transition-all flex gap-3 items-start bg-slate-50/40">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-100 to-indigo-100 flex items-center justify-center text-green-600 shrink-0 border border-green-200 shadow-inner">
                      <FileUp size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2 mb-2">
                        <h3 className="font-bold text-slate-800 text-base leading-tight flex items-center gap-2 flex-wrap">
                          <span className="line-clamp-2 min-w-0">{a.title}</span>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide border ${
                            isAdminAssign
                              ? 'bg-violet-100 text-violet-700 border-violet-200'
                              : 'bg-sky-100 text-sky-700 border-sky-200'
                          }`}>
                            {assignerLabel}
                          </span>
                        </h3>
                        {!isAdminAssign && teacherName && teacherName.toLowerCase() !== 'giảng viên' && (
                          <p className="text-[11px] text-slate-500 font-medium -mt-1">
                            Giao bởi: {teacherName}
                          </p>
                        )}
                        {!submission && a.deadline && (
                          <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 whitespace-nowrap w-fit ${isLate ? 'bg-red-50 text-red-600 border-red-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                            <Timer size={13} className={isLate ? '' : 'animate-pulse'} />
                            <CountdownTimer deadline={a.deadline} />
                          </div>
                        )}
                      </div>
                      {!aDesc && !aPlain ? (
                        <p className="text-xs text-slate-600 mb-3 line-clamp-2">{aDefault}</p>
                      ) : aExpanded && aHasHtml ? (
                        <div
                          className="text-xs text-slate-600 mb-3 max-h-[220px] overflow-y-auto leading-relaxed break-words [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_b]:font-semibold [&_a]:text-green-600"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(aDesc) }}
                        />
                      ) : (
                        <p className={`text-xs text-slate-600 mb-3 ${aShowToggle && !aExpanded ? 'line-clamp-2' : ''} whitespace-pre-wrap`}>
                          {aPlain || aDefault}
                        </p>
                      )}
                      {aShowToggle ? (
                        <button
                          type="button"
                          onClick={() => setExpandedAssignKey(aExpanded ? null : aKey)}
                          className="text-[11px] font-bold text-green-600 hover:text-green-800 -mt-1 mb-3"
                        >
                          {aExpanded ? 'Thu gọn' : 'Xem thêm hướng dẫn'}
                        </button>
                      ) : null}

                      <div className="grid grid-cols-1 gap-2">
                        <a href={a.fileUrl || '#'} target="_blank" className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:border-slate-300 hover:bg-slate-50 font-semibold text-sm transition-all shadow-sm">
                          <LinkIcon size={15} /> Tải đề bài
                        </a>
                        {(() => {
                          if (!submission) {
                            return (
                              <label className={`flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm ${uploadingAssignId === idx ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                                {uploadingAssignId === idx ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UploadCloud size={16} />}
                                {uploadingAssignId === idx ? 'Đang tải...' : 'Nộp bài tập'}
                                <input type="file" className="hidden" accept=".zip,.rar,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleFileChange(a, idx, e.target.files[0])} disabled={uploadingAssignId === idx} />
                              </label>
                            );
                          }
                          const isGraded = submission.status === 'graded';
                          return (
                            <>
                              {isGraded ? (
                                <div className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-xl font-semibold text-sm shadow-sm opacity-100 ${getGradeBadgeClasses(submission.grade)}`}>
                                  <CheckCircle2 size={16} className={getGradeIconClasses(submission.grade)} />
                                  Điểm: {submission.grade}/10
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl font-semibold text-sm cursor-not-allowed shadow-inner opacity-80">
                                  <CheckCircle2 size={16} />
                                  Đã nộp bài
                                </div>
                              )}
                              <label className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${isGraded ? 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60' : uploadingAssignId === idx ? 'bg-orange-50 border border-orange-200 text-orange-600 cursor-not-allowed opacity-50' : 'bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 cursor-pointer shadow-sm'}`}>
                                {uploadingAssignId === idx ? <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={16} />}
                                {uploadingAssignId === idx ? 'Đang tải...' : 'Nộp lại'}
                                <input type="file" className="hidden" accept=".zip,.rar,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleFileChange(a, idx, e.target.files[0])} disabled={uploadingAssignId === idx || isGraded} />
                              </label>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!trainingData?.assignments || trainingData.assignments.length === 0) && (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-sm">Hiện tại bạn không có bài tập nào cần nộp.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EXAMS TAB */}
        {mainTab === 'exams' && (() => {
          const examSubjects = examScoreRows;

          const renderEssayCell = (sub) => {
            if (sub.essayScore != null) {
              return (
                <span className={`font-bold px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs ${sub.essayScore >= 5 ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-red-700 bg-red-50 border border-red-100'}`}>
                  {sub.essayScore}/10
                </span>
              );
            }
            if (sub.thucHanh === 'da_nop') {
              return <span className="text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs">Chờ chấm</span>;
            }
            if (sub.thucHanh === 'chua_nop' || !sub.thucHanh) {
              return <span className="text-gray-400 font-medium text-[10px] sm:text-xs">Chưa làm</span>;
            }
            return <span className="text-gray-600 font-medium text-[10px] sm:text-xs break-words">{sub.thucHanh}</span>;
          };

          const renderResultCell = (sub) => {
            if (sub.status === 'dat') return <span className="text-emerald-600 font-black text-[10px] sm:text-xs">ĐẠT</span>;
            if (sub.status === 'khong_dat') return <span className="text-red-600 font-black text-[10px] sm:text-xs leading-tight">KHÔNG ĐẠT</span>;
            if (sub.status === 'dang_khoa') return <span className="text-orange-500 font-bold text-[10px] sm:text-xs">ĐANG KHÓA</span>;
            return <span className="text-gray-400 font-bold text-[10px] sm:text-xs">CHƯA THI</span>;
          };

          return (
            <div className="bg-white rounded-2xl p-3 sm:p-6 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[280px]">
              <div className="flex items-center justify-between mb-3 sm:mb-6">
                <h2 className="text-sm sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Award className="text-green-600 shrink-0" size={18} aria-hidden="true" />
                  Bảng Điểm Tổng Hợp
                </h2>
              </div>

              {/* Mobile: card rows — hiện đủ mọi cột */}
              <div className="sm:hidden space-y-2.5">
                {examSubjects.map((sub, idx) => {
                  const trScore = sub.tracNghiem ? `${sub.tracNghiem.score}/${sub.tracNghiem.total}` : '—';
                  return (
                    <article key={sub.id} className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                      <div className="flex items-start gap-2.5 mb-2.5">
                        <span className="text-[10px] font-black text-slate-400 tabular-nums shrink-0 pt-0.5">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-xs font-bold text-slate-800 leading-snug flex-1 min-w-0 break-words">
                          {sub.label}
                        </h3>
                        <div className="shrink-0 text-right">{renderResultCell(sub)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2 min-w-0">
                          <p className="font-bold uppercase tracking-wide text-slate-400 mb-0.5">Trắc nghiệm</p>
                          <p className="font-bold text-slate-700 tabular-nums break-words">{trScore}</p>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-100 px-2.5 py-2 min-w-0">
                          <p className="font-bold uppercase tracking-wide text-slate-400 mb-0.5 leading-tight">Tự luận / Thực hành</p>
                          <div className="mt-0.5">{renderEssayCell(sub)}</div>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {examSubjects.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-8">Chưa có dữ liệu điểm thi.</p>
                )}
              </div>

              {/* Tablet/desktop: bảng chữ nhỏ, cho phép xuống dòng */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-[11px] md:text-[13px] table-fixed">
                  <thead className="bg-[#f8fafc] border-b border-gray-200">
                    <tr>
                      <th className="px-2 md:px-4 py-2.5 md:py-3 font-black text-slate-500 w-10 md:w-14 text-center uppercase tracking-wide leading-tight">STT</th>
                      <th className="px-2 md:px-4 py-2.5 md:py-3 font-black text-slate-500 uppercase tracking-wide leading-tight">Tên môn thi</th>
                      <th className="px-2 md:px-3 py-2.5 md:py-3 font-black text-slate-500 text-center uppercase tracking-wide leading-tight w-[18%]">Trắc nghiệm</th>
                      <th className="px-2 md:px-3 py-2.5 md:py-3 font-black text-slate-500 text-center uppercase tracking-wide leading-tight w-[22%]">Tự luận / Thực hành</th>
                      <th className="px-2 md:px-3 py-2.5 md:py-3 font-black text-slate-500 text-center uppercase tracking-wide leading-tight w-[16%]">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {examSubjects.map((sub, idx) => {
                      const trScore = sub.tracNghiem ? `${sub.tracNghiem.score}/${sub.tracNghiem.total}` : '—';
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-2 md:px-4 py-2.5 md:py-3 font-bold text-slate-400 text-center tabular-nums align-top">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="px-2 md:px-4 py-2.5 md:py-3 font-bold text-slate-800 break-words whitespace-normal align-top leading-snug">
                            {sub.label}
                          </td>
                          <td className="px-2 md:px-3 py-2.5 md:py-3 font-bold text-center text-slate-600 tabular-nums align-top whitespace-normal break-words">
                            {trScore}
                          </td>
                          <td className="px-2 md:px-3 py-2.5 md:py-3 text-center align-top whitespace-normal break-words">
                            {renderEssayCell(sub)}
                          </td>
                          <td className="px-2 md:px-3 py-2.5 md:py-3 text-center align-top whitespace-normal break-words">
                            {renderResultCell(sub)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

      </div>
    );
  }

  // ── PLAYER VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex flex-col w-screen h-screen bg-[#0d1117] text-white overflow-hidden">

      {/* ─── TOPBAR ───────────────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 z-50" style={{ background: 'linear-gradient(180deg,#090e18 0%,#0d1117 100%)' }}>
        {/* Progress rail */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/5">
          <div
            className={`h-full transition-all duration-700 ${overallProgress === 100 ? 'bg-emerald-400' : 'bg-emerald-500'}`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        <div className="h-13 px-3 sm:px-5 flex items-center justify-between gap-2" style={{ height: '52px' }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => { setSelectedCourse(null); setLessons([]); setCurrentLesson(null); }}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all text-slate-400 hover:text-white flex-shrink-0"
              aria-label="Quay lại"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-px h-5 bg-white/10 flex-shrink-0 hidden sm:block" />
            <h2 className="font-bold text-[13px] text-slate-100 truncate leading-snug min-w-0">{selectedCourse.title}</h2>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {completing && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold animate-pulse uppercase tracking-widest">
                <RefreshCw size={11} className="animate-spin" /> Đang lưu...
              </div>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 tabular-nums">
              {overallProgress}%
              {overallProgress === 100 && <Award size={12} className="text-emerald-400" />}
            </span>
          </div>
        </div>
      </div>

      {/* ─── BODY: Udemy-style — cột trái scroll; video+tabs sticky; sidebar độc lập ─── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden" style={{ background: '#0b1018' }}>

        {/* ══ LEFT COLUMN ══ */}
        <div
          data-lms-scroll
          className="flex-1 basis-0 min-w-0 min-h-0 w-full overflow-y-scroll overscroll-y-contain custom-scrollbar-dark"
        >

          <div className="sticky top-0 z-20 bg-[#0b1018] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <div className="px-0 sm:px-4 pt-0 sm:pt-3 pb-0 sm:pb-2 flex justify-center w-full bg-black/40">
              <div
                className="relative overflow-hidden shadow-2xl shadow-black/80 w-full rounded-none sm:rounded-2xl bg-black h-[44dvh] sm:h-[50dvh] lg:h-[min(56dvh,560px)]"
              >
                <StudentVideoPlayer
                  key={currentLesson?._id}
                  videoId={currentLesson?.videoUrl}
                  lessonId={currentLesson?._id}
                  courseId={selectedCourse?._id || selectedCourse?.id}
                  initialWatchedSeconds={currentLesson?.watchedSeconds || 0}
                  antiSeekEnabled={
                    currentLesson?.antiSeek !== false
                    && localStorage.getItem('student_anti_seek_disabled') !== 'true'
                    && localStorage.getItem('admin_anti_seek_disabled') !== 'true'
                  }
                  onSaveProgress={handleSaveProgress}
                  onVideoEnded={handleVideoEnded}
                  onEligibilityReached={handleEligibilityReached}
                  playerApiRef={playerApiRef}
                />
              </div>
            </div>
            <LmsTabBar courseTab={courseTab} setCourseTab={setCourseTab} />
          </div>

          <div className="px-4 sm:px-6 py-4 sm:py-5 pb-16 w-full" style={{ background: '#0d1117' }}>
            <LmsPlayerPanels
              courseTab={courseTab}
              userId={session?.id || student?.id || 'student'}
              userName={student?.name || session?.name || 'Học viên'}
              selectedCourse={selectedCourse}
              currentLesson={currentLesson}
              lessons={lessons}
              groupedLessons={groupedLessons}
              overallProgress={overallProgress}
              expandedChapters={expandedChapters}
              setExpandedChapters={setExpandedChapters}
              onSelectLesson={(lesson) => {
                setCurrentLesson(lesson);
                setCourseTab('overview');
              }}
              getCurrentTime={() => {
                try {
                  return Number(playerApiRef.current?.getCurrentTime?.()) || 0;
                } catch {
                  return 0;
                }
              }}
              antiSeekEnabled={
                currentLesson?.antiSeek !== false
                && localStorage.getItem('student_anti_seek_disabled') !== 'true'
                && localStorage.getItem('admin_anti_seek_disabled') !== 'true'
              }
            />
          </div>
        </div>

        {/* ══ RIGHT SIDEBAR ══ */}
        <div
          className="hidden lg:flex flex-col lg:w-80 flex-shrink-0 border-l min-h-0 self-stretch overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0b1018' }}
        >

          {/* Sidebar Header */}
          <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-300">Nội dung khóa học</h3>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${overallProgress === 100
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                  }`}
              >
                {lessons.filter(l => l.isCompleted).length}/{lessons.length} BÀI
              </span>
            </div>
            {/* Mini progress bar */}
            <div className="h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${overallProgress === 100 ? 'bg-emerald-500' : 'bg-emerald-500'
                  }`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Lesson List */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}
          >
            {Object.entries(groupedLessons).map(([chapter, chapterLessons]) => {
              const isExpanded = expandedChapters[chapter] !== false;
              const chapterCompleted = chapterLessons.filter(l => l.isCompleted).length;
              return (
                <div key={chapter}>
                  {/* Chapter Header */}
                  <button
                    onClick={() => setExpandedChapters(prev => ({ ...prev, [chapter]: !prev[chapter] }))}
                    className="w-full px-5 py-3 flex items-center justify-between text-left transition-colors hover:bg-white/5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div>
                      <p className="text-[11px] font-bold text-slate-300">{chapter}</p>
                      <p className="text-[9px] text-slate-600 mt-0.5 font-semibold">{chapterCompleted}/{chapterLessons.length} hoàn thành</p>
                    </div>
                    {isExpanded
                      ? <ChevronUp size={13} className="text-slate-600" />
                      : <ChevronDown size={13} className="text-slate-600" />
                    }
                  </button>

                  {isExpanded && chapterLessons.map((lesson) => {
                    const globalIdx = lessons.findIndex(l => String(l._id) === String(lesson._id));
                    const isCurrent = currentLesson?._id === lesson._id;
                    return (
                      <div
                        key={lesson._id}
                        onClick={() => {
                          if (!lesson.isUnlocked) return;
                          setCurrentLesson(lesson);
                        }}
                        className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all relative ${!lesson.isUnlocked ? 'opacity-40 pointer-events-none' : ''
                          } ${isCurrent
                            ? 'bg-emerald-500/10 border-l-4 border-emerald-500'
                            : 'border-l-4 border-transparent hover:bg-white/[0.04]'
                          }`}
                      >
                        {/* Status icon */}
                        <div className="mt-0.5 flex-shrink-0">
                          {lesson.isCompleted ? (
                            <div className="w-[18px] h-[18px] rounded-full bg-emerald-500/20 flex items-center justify-center">
                              <CheckCircle size={12} className="text-emerald-400" />
                            </div>
                          ) : !lesson.isUnlocked ? (
                            <Lock size={14} className="text-slate-600" />
                          ) : isCurrent ? (
                            <div className="w-[18px] h-[18px] rounded-full border-2 border-emerald-500 flex items-center justify-center">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            </div>
                          ) : (
                            <PlayCircle size={16} className="text-slate-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className={`text-[12px] leading-snug line-clamp-2 ${isCurrent ? 'text-emerald-400 font-bold' : lesson.isCompleted ? 'text-slate-500 font-semibold' : 'text-slate-300 font-semibold'
                            }`}>
                            {formatLessonDisplayTitle(lesson.title, globalIdx)}
                          </h4>
                          {lesson.duration ? (
                            <span className="text-[10px] text-slate-600 flex items-center gap-1 mt-1">
                              <Clock size={9} />
                              {Math.floor(lesson.duration / 60)}:{String(lesson.duration % 60).padStart(2, '0')}
                            </span>
                          ) : null}
                        </div>

                        {lesson.isCompleted && (
                          <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                            <CheckCircle size={9} className="text-emerald-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Completion Card */}
            {overallProgress === 100 && (
              <div className="m-4 p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 text-center">
                <Award size={26} className="text-emerald-400 mx-auto mb-2" />
                <p className="font-black text-emerald-400 text-sm">Hoàn thành 100%</p>
                <p className="text-emerald-600/70 text-[11px] mt-1 font-medium">Chúc mừng bạn đã hoàn tất lộ trình</p>
              </div>
            )}
            <div className="h-6" />
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar-dark::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}} />
    </div>
  );
};

export default StudentTrainingLMS;






