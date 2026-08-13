import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, CheckCircle, Lock, ChevronRight, Clock, Award, BookOpen,
  ArrowLeft, Shield, Users, BarChart2, RefreshCw, GraduationCap,
  PlayCircle, ChevronDown, ChevronUp, Star, AlertCircle, CheckCircle2,
  FileBox, Video, Download, FileText, Plus, Pencil
} from 'lucide-react';

import { useData } from '../context/DataContext';
import {
  filterTrainingItemsBySubject,
  resolveTeacherSubjectIds,
} from '../utils/trainingSubjectFilter';
import api, { buildMediaDownloadUrl, csrfFetch } from '../services/api';
import { htmlToPlainText, sanitizeRichHtml } from '../utils/htmlContent';
import { formatLessonDisplayTitle } from '../utils/lmsLessonUi';
import LmsPlayerPanels, { LmsTabBar } from './lms/LmsPlayerTabs';
import LmsBrandedPlayerChrome, { preferMaxYouTubeQuality } from './lms/LmsBrandedPlayerChrome';
import {
  isLessonAntiSeekEnabled,
  requiredWatchSeconds,
  ANTI_SEEK_PROGRESS_CODE,
  ANTI_SEEK_PROGRESS_MESSAGE,
} from '../utils/antiSeekPolicy';
import { useToast } from '../utils/toast';

const MOCK_COURSES = [
  { _id: '1', title: 'Đào tạo Giảng viên Mới', progress: 0, 
    videos: [{ title: 'Giới thiệu về Thắng Tin Học', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 635 }, { title: 'Tổng quan công việc', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 920 }],
    files: [{ title: 'Quy trình giảng dạy.pdf', type: 'PDF', size: '2 MB' }, { title: 'Sổ tay Giảng viên.docx', type: 'DOCX', size: '1 MB' }],
    notices: ['Chào mừng các bạn đến với TT', 'Hãy xem hết các video trước khi nhận lớp']
  },
  { _id: '2', title: 'Kỹ năng Đứng lớp Chuyên sâu', progress: 45, 
    videos: [{ title: 'Xử lý tình huống học viên yếu', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 2412 }],
    files: [{ title: 'Quy trình xử lý.docx', type: 'DOCX', size: '500 KB' }],
    notices: ['Nhớ nộp bài thu hoạch trước 15/4 ngay sau khi xem video']
  },
  { _id: '3', title: 'Khóa học Excel Nâng cao', progress: 100, 
    videos: [{ title: 'Hàm logic phức tạp', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 2100 }],
    files: [{ title: 'Bài tập thực hành.xlsx', type: 'EXCEL', size: '3.5 MB' }],
    notices: []
  },
  { _id: '4', title: 'Bảo mật và An toàn thông tin', progress: 80, 
    videos: [{ title: 'Bảo quản dữ liệu học viên', url: 'https://youtube.com/embed/dQw4w9WgXcQ', duration: 1210 }],
    files: [],
    notices: ['Bắt buộc hoàn thành trong tháng 4']
  }
];

const CircularProgress = ({ progress, size = 112 }) => {
  const isSmall = size < 100;
  const radius = isSmall ? 25 : 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  let strokeColor = 'text-slate-100';
  let pathColor = 'text-blue-500';
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
  // Thử token giảng viên trước, fallback sang admin
  const token =
    localStorage.getItem('teacher_access_token') ||
    localStorage.getItem('admin_access_token') ||
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
const YouTubePlayerSecure = ({
  videoId, lessonId, courseId, duration: lessonDuration,
  initialWatchedSeconds = 0,
  onVideoEnded, onSaveProgress, onEligibilityReached, isLocked,
  antiSeekEnabled = true,
  playerApiRef = null,
}) => {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const intervalRef = useRef(null);        // Đếm giây thực tế (1s tick)
  const autoSaveTimerRef = useRef(null);   // Auto-save mỗi 30s
  const [isReady, setIsReady] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTabActive, setIsTabActive] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxSeekableUi, setMaxSeekableUi] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const pauseTimeoutRef = useRef(null);
  const maxPosRef = useRef(0);
  const seekGuardRef = useRef(false);
  const eligibilitySentRef = useRef(false);
  const uiTickRef = useRef(null);

  // ── Bộ đếm thực tế ──────────────────────────────────────────────────────────
  const initialLocal = parseInt(sessionStorage.getItem(`lms_watched_${lessonId}`) || "0", 10);
  const bestInitial = Math.max(initialWatchedSeconds, initialLocal);
  const actualWatchedRef = useRef(bestInitial); // Số giây xem thực tế
  const [displayWatched, setDisplayWatched] = useState(bestInitial);
  const [totalDuration, setTotalDuration] = useState(lessonDuration || 0);

  // Reset overlay chỉ khi đổi bài — tránh bật lại nút Play khi cập nhật tiến độ
  useEffect(() => {
    const localSecs = parseInt(sessionStorage.getItem(`lms_watched_${lessonId}`) || '0', 10);
    const bestSecs = Math.max(Number(initialWatchedSeconds) || 0, localSecs);
    actualWatchedRef.current = bestSecs;
    setDisplayWatched(bestSecs);
    setTotalDuration(lessonDuration || 0);
    setHasEnded(false);
    setOverlayVisible(true);
    setIsPlaying(false);
    setCurrentTime(0);
    eligibilitySentRef.current = false;
    const savedPos = Number(sessionStorage.getItem(`lms_pos_${lessonId}`) || 0);
    maxPosRef.current = antiSeekEnabled ? Math.max(0, savedPos) : Math.max(0, savedPos, bestSecs);
    setMaxSeekableUi(maxPosRef.current);
    seekGuardRef.current = false;
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps -- lesson switch only

  useEffect(() => {
    const localSecs = parseInt(sessionStorage.getItem(`lms_watched_${lessonId}`) || '0', 10);
    const bestSecs = Math.max(Number(initialWatchedSeconds) || 0, localSecs);
    if (bestSecs > actualWatchedRef.current) {
      actualWatchedRef.current = bestSecs;
      setDisplayWatched(bestSecs);
    }
  }, [initialWatchedSeconds, lessonId]);

  useEffect(() => {
    if (lessonDuration > 0 && (!totalDuration || totalDuration === 0)) {
      setTotalDuration(lessonDuration);
    }
  }, [lessonDuration, totalDuration]);

  const formatTime = (secs) => {
    const s = Math.floor(secs);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const requiredSeconds = totalDuration > 0 ? Math.ceil(totalDuration * 2 / 3) : 0;

  // ── Auto-Unlock khi đạt 2/3 ──────────────────────────────────────────
  useEffect(() => {
    if (!totalDuration || !onEligibilityReached) return;
    if (eligibilitySentRef.current) return;
    const reqSecs = Math.ceil(totalDuration * 2 / 3);
    if (!antiSeekEnabled) {
      eligibilitySentRef.current = true;
      onEligibilityReached(displayWatched || totalDuration, totalDuration);
      return;
    }
    if (displayWatched >= reqSecs && displayWatched > 0) {
      eligibilitySentRef.current = true;
      onEligibilityReached(displayWatched, totalDuration);
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
    if (!videoId || isLocked) return;

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setIsReady(false);
      setHasEnded(false);
      setIsPlaying(false);

      playerRef.current = new window.YT.Player(`yt-player-${lessonId}`, {
        videoId: extractYouTubeId(videoId),
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 0,
          start: antiSeekEnabled ? Math.floor(maxPosRef.current || 0) : (bestInitial ? Math.floor(bestInitial) : 0),
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            setIsReady(true);
            const dur = event.target.getDuration();
            if (dur > 0) setTotalDuration(dur);
            preferMaxYouTubeQuality(event.target);
            try {
              event.target.setVolume?.(100);
              event.target.unMute?.();
            } catch { /* ignore */ }
            const resumeAt = antiSeekEnabled ? maxPosRef.current : bestInitial;
            if (resumeAt > 0) {
              event.target.seekTo(resumeAt, true);
              setCurrentTime(resumeAt);
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
      clearInterval(uiTickRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId, lessonId, isLocked, antiSeekEnabled]);

  // ── Đếm giây thực tế khi PLAYING + snap seek vượt maxPos ───────────────────
  const startCounting = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      try {
        const t = Number(playerRef.current?.getCurrentTime?.()) || 0;
        setCurrentTime(t);
        if (antiSeekEnabled && !seekGuardRef.current) {
          if (t > maxPosRef.current + 1.25) {
            seekGuardRef.current = true;
            playerRef.current?.seekTo?.(maxPosRef.current, true);
            setTimeout(() => { seekGuardRef.current = false; }, 450);
            return;
          }
          if (t >= maxPosRef.current - 0.35) {
            maxPosRef.current = Math.max(maxPosRef.current, t);
            setMaxSeekableUi(maxPosRef.current);
            sessionStorage.setItem(`lms_pos_${lessonId}`, String(maxPosRef.current));
          }
        } else if (!antiSeekEnabled && t > maxPosRef.current) {
          maxPosRef.current = t;
          setMaxSeekableUi(t);
        }
      } catch { /* ignore */ }

      if (seekGuardRef.current) return;
      actualWatchedRef.current += 1;
      setDisplayWatched(actualWatchedRef.current);
      sessionStorage.setItem(`lms_watched_${lessonId}`, actualWatchedRef.current);
    }, 1000);
  }, [lessonId, antiSeekEnabled]);

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
      setIsPlaying(true);
      setHasEnded(false);
      preferMaxYouTubeQuality(event.target);
      startCounting();
      if (!totalDuration || totalDuration === 0) {
        const dur = event.target.getDuration?.();
        if (dur > 0) setTotalDuration(dur);
      }
    }
    if (state === window.YT.PlayerState.PAUSED) {
      stopCounting();
      setIsPlaying(false);
      setIsPaused(true);
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1200);
    }
    if (state === window.YT.PlayerState.ENDED) {
      stopCounting();
      setIsPlaying(false);
      setHasEnded(true);
      setOverlayVisible(true);
      if (onVideoEnded) {
        onVideoEnded(actualWatchedRef.current, totalDuration);
      }
    }
  }, [onVideoEnded, startCounting, stopCounting, totalDuration]);

  useEffect(() => {
    clearInterval(uiTickRef.current);
    if (!isPlaying) return undefined;
    uiTickRef.current = setInterval(() => {
      try {
        const t = Number(playerRef.current?.getCurrentTime?.()) || 0;
        setCurrentTime(t);
        if (t > maxPosRef.current) {
          maxPosRef.current = t;
          setMaxSeekableUi(t);
          if (antiSeekEnabled) {
            sessionStorage.setItem(`lms_pos_${lessonId}`, String(t));
          }
        }
      } catch { /* ignore */ }
    }, 250);
    return () => clearInterval(uiTickRef.current);
  }, [isPlaying, antiSeekEnabled, lessonId]);

  if (isLocked) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center gap-4 rounded-2xl">
        <div className="w-20 h-20 bg-slate-700/60 rounded-2xl flex items-center justify-center border border-slate-600/40">
          <Lock size={36} className="text-slate-400" />
        </div>
        <p className="text-slate-400 font-bold text-sm">Hoàn thành bài trước để mở khóa</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div
        ref={containerRef}
        className="relative w-full h-full min-h-0 lg:rounded-2xl overflow-hidden bg-black shadow-lg group"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          id={`yt-player-${lessonId}`}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        <LmsBrandedPlayerChrome
          overlayVisible={overlayVisible}
          hasEnded={hasEnded}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={totalDuration}
          maxSeekable={maxSeekableUi}
          antiSeekEnabled={antiSeekEnabled}
          volume={volume}
          muted={muted}
          onPlay={() => playerRef.current?.playVideo?.()}
          onPause={() => playerRef.current?.pauseVideo?.()}
          onSeek={(t) => {
            try {
              const cap = antiSeekEnabled
                ? Math.max(maxPosRef.current, currentTime)
                : Number.POSITIVE_INFINITY;
              const capped = antiSeekEnabled ? Math.min(t, cap) : t;
              seekGuardRef.current = true;
              playerRef.current?.seekTo?.(capped, true);
              setCurrentTime(capped);
              setTimeout(() => { seekGuardRef.current = false; }, 500);
            } catch { /* ignore */ }
          }}
          onVolumeChange={(v) => {
            setVolume(v);
            setMuted(v === 0);
            try {
              playerRef.current?.setVolume?.(v);
              if (v > 0) playerRef.current?.unMute?.();
              else playerRef.current?.mute?.();
            } catch { /* ignore */ }
          }}
          onToggleMute={() => {
            try {
              if (muted) {
                playerRef.current?.unMute?.();
                playerRef.current?.setVolume?.(volume || 80);
                setMuted(false);
                if (volume === 0) setVolume(80);
              } else {
                playerRef.current?.mute?.();
                setMuted(true);
              }
            } catch { /* ignore */ }
          }}
        />

        {!isTabActive && !overlayVisible && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 text-center px-4 rounded-none lg:rounded-2xl">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/40 mb-4">
               <AlertCircle size={32} className="text-amber-400" />
            </div>
            <h3 className="text-white text-lg font-bold mb-2">Đã tạm dừng tính thời gian</h3>
            <p className="text-slate-300 text-xs max-w-xs font-medium">Vui lòng giữ tương tác và không rời khỏi trình duyệt để hệ thống tiếp tục ghi nhận tiến độ.</p>
          </div>
        )}

        {!isReady && (
          <div className="absolute inset-0 z-20 bg-slate-900 flex items-center justify-center rounded-none lg:rounded-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-[3px] border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
              <p className="text-slate-400 font-semibold text-xs animate-pulse tracking-widest uppercase">Đang tải video...</p>
            </div>
          </div>
        )}

        {hasEnded && !overlayVisible && (
          <div className="absolute top-3 right-3 z-20 bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-lg">
            <CheckCircle size={12} /> Đã xem xong
          </div>
        )}
        {requiredSeconds > 0 && !overlayVisible && !hasEnded && (
          <div className={`absolute top-3 right-3 z-10 text-xs px-2.5 py-1 rounded-full border backdrop-blur-md font-bold ${
            displayWatched >= requiredSeconds
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          }`}>
            {displayWatched >= requiredSeconds
              ? 'Đủ điều kiện'
              : `Cần xem ${formatTime(Math.max(0, requiredSeconds - displayWatched))} nữa`}
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
      <div className="px-8 py-6 bg-gradient-to-r from-blue-900 to-slate-900 flex items-center justify-between">
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
              <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center font-black text-blue-700 text-sm flex-shrink-0">
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
                        className={`h-full rounded-full transition-all ${t.isCertified ? 'bg-emerald-500' : 'bg-red-500'}`}
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
const TeacherTrainingLMS = ({ onBack, isAdmin = false }) => {
  const { trainingData, examSubjectsCatalog } = useData() || { trainingData: { videos: [], guides: [], files: [] } };
  const [teacherProfile, setTeacherProfile] = useState(null);

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    api.auth.me()
      .then((res) => {
        if (cancelled || !res?.success || !res.data) return;
        setTeacherProfile(res.data);
        try {
          const stored = JSON.parse(localStorage.getItem('teacher_user') || '{}');
          localStorage.setItem('teacher_user', JSON.stringify({
            ...stored,
            ...res.data,
            subjectIds: res.data.subjectIds || stored.subjectIds || [],
            specialty: res.data.specialty || stored.specialty || '',
          }));
        } catch { /* ignore */ }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin]);

  const teacherSubjectIds = useMemo(() => {
    if (isAdmin) return null;
    let user = teacherProfile;
    if (!user) {
      try { user = JSON.parse(localStorage.getItem('teacher_user') || '{}'); } catch { user = {}; }
    }
    return resolveTeacherSubjectIds(user, examSubjectsCatalog);
  }, [isAdmin, teacherProfile, examSubjectsCatalog]);

  const visibleTraining = useMemo(() => {
    if (isAdmin) return trainingData || { videos: [], guides: [], files: [] };
    const ids = teacherSubjectIds || [];
    const catalog = examSubjectsCatalog;
    return {
      ...(trainingData || {}),
      videos: filterTrainingItemsBySubject(trainingData?.videos, ids, catalog),
      guides: filterTrainingItemsBySubject(trainingData?.guides, ids, catalog),
      files: filterTrainingItemsBySubject(trainingData?.files, ids, catalog),
    };
  }, [trainingData, teacherSubjectIds, examSubjectsCatalog, isAdmin]);

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
  const [expandedGuideKey, setExpandedGuideKey] = useState(null);
  const toast = useToast();
  const teacherSession = (() => { try { return JSON.parse(localStorage.getItem('teacher_user') || '{}'); } catch { return {}; } })();

  // Lấy tiến độ các khóa học của GV để hiển thị bên ngoài (Bổ sung mới)
  useEffect(() => {
    if (isAdmin) return;
    let isMounted = true;
    lmsApiFetch('/progress/me').then(res => {
      if (res.success && isMounted) setCourseProgressMap(res.data || {});
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [isAdmin, mainTab, selectedCourse]);

  // Sync with trainingData from Admin (via DataContext), fallback API overview
  useEffect(() => {
    let cancelled = false;
    const applyCourses = (list) => {
      if (!cancelled) {
        setCourses(list || []);
        setLoading(false);
      }
    };

    if (visibleTraining?.videos?.length) {
      applyCourses(visibleTraining.videos);
      return () => { cancelled = true; };
    }

    setLoading(true);
    lmsApiFetch('/teacher/overview')
      .then((res) => {
        if (res?.success && res.data?.courses?.length) {
          applyCourses(filterTrainingItemsBySubject(res.data.courses, teacherSubjectIds || [], examSubjectsCatalog));
        } else if (visibleTraining?.videos) {
          applyCourses(visibleTraining.videos);
        } else {
          applyCourses([]);
        }
      })
      .catch(() => applyCourses(visibleTraining?.videos || []))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [visibleTraining, teacherSubjectIds]);

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
      if (res.success) {
        setLessons(res.data);
        // Khôi phục lesson đang xem nếu có savedLessonId
        const savedLessonId = sessionStorage.getItem('lms_lessonId');
        const firstActive = (savedLessonId && res.data.find(l => String(l._id) === savedLessonId && l.isUnlocked))
          || res.data.find(l => l.isUnlocked && !l.isCompleted)
          || res.data[0];
        setCurrentLesson(firstActive);
        // Expand all chapters by default
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
      const token = localStorage.getItem('teacher_access_token') ||
                    (localStorage.getItem('teacher_user') ? JSON.parse(localStorage.getItem('teacher_user')).token : '') ||
                    localStorage.getItem('admin_access_token');

      const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
      const httpRes = await csrfFetch(`${API_BASE}/training-lms/complete-lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lessonId: currentLesson._id || currentLesson.id,
          courseId: selectedCourse._id || selectedCourse.id,
          watchedSeconds: actualWatched,
        }),
      });
      const res = await httpRes.json().catch(() => ({}));
      if (res?.success === false && res?.code === ANTI_SEEK_PROGRESS_CODE) {
        toast.error(res.message || ANTI_SEEK_PROGRESS_MESSAGE);
        return;
      }
      if (res?.success === false) return;
      const lessonsRes = await lmsApiFetch(`/courses/${selectedCourse._id || selectedCourse.id}/lessons`);
      if (lessonsRes.success) {
        setLessons(lessonsRes.data);
      }
    } catch (e) { /* ignore */ }
  }, [currentLesson, selectedCourse, toast]);

  // Video kết thúc
  const handleVideoEnded = useCallback(async (actualWatched, totalDur) => {
    if (!currentLesson || !selectedCourse || completing) return;

    const antiOn = isLessonAntiSeekEnabled(currentLesson);
    const req = requiredWatchSeconds(totalDur || 0);
    if (antiOn && req > 0 && actualWatched < req) {
      toast.error(ANTI_SEEK_PROGRESS_MESSAGE);
      return;
    }

    setCompleting(true);
    try {
      const token =
        localStorage.getItem('teacher_access_token') ||
        (localStorage.getItem('teacher_user') ? JSON.parse(localStorage.getItem('teacher_user')).token : '') ||
        localStorage.getItem('admin_access_token') ||
        '';

      const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
      const httpRes = await csrfFetch(`${API_BASE}/training-lms/complete-lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lessonId: currentLesson._id || currentLesson.id,
          courseId: selectedCourse._id || selectedCourse.id,
          watchedSeconds: actualWatched,
        }),
      });
      const body = await httpRes.json().catch(() => ({}));
      if (body?.success === false && body?.code === ANTI_SEEK_PROGRESS_CODE) {
        toast.error(body.message || ANTI_SEEK_PROGRESS_MESSAGE);
        setCompleting(false);
        return;
      }
      if (body?.success === false) {
        setCompleting(false);
        return;
      }
      const lessonsRes = await lmsApiFetch(`/courses/${selectedCourse._id}/lessons`);
      if (lessonsRes.success) {
        const updatedLessons = lessonsRes.data;
        setLessons(updatedLessons);
        const currentIdx = updatedLessons.findIndex(l => String(l._id) === String(currentLesson._id));
        const next = updatedLessons[currentIdx + 1];
        if (next?.isUnlocked) {
          setTimeout(() => setCurrentLesson(next), 800);
        }
      }
    } catch (e) { void 0 }
    setCompleting(false);
  }, [currentLesson, selectedCourse, completing, toast]);

  // Handle lưu progress tạm thời
  const handleSaveProgress = useCallback((lessonId, watchedSeconds) => {
    if (!selectedCourse) return;
    const token = localStorage.getItem('teacher_access_token') ||
                  (localStorage.getItem('teacher_user') ? JSON.parse(localStorage.getItem('teacher_user')).token : '') ||
                  localStorage.getItem('admin_access_token');
                  
    const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
    csrfFetch(`${API_BASE}/training-lms/save-watch-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      <div className="p-4 sm:p-6 md:p-10 animate-in fade-in duration-500 min-h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-2xl lg:text-3xl font-bold text-slate-800 tracking-tight leading-tight">
              Trung tâm đào tạo nội bộ
            </h1>
            <p className="text-slate-500 font-medium mt-2 text-xs sm:text-sm lg:text-[15px]">
              Hoàn thành chương trình để được chứng nhận đủ điều kiện nhận lớp
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${showAdminPanel ? 'bg-red-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
              >
                <BarChart2 size={16} /> Xem tiến độ
              </button>
            )}
          </div>
        </div>

        {/* Admin Progress Panel */}
        {isAdmin && showAdminPanel && courses.length > 0 && (
          <div className="mb-10">
            <AdminProgressPanel courseId={courses[0]?._id} />
          </div>
        )}

        {/* TOP TABS FOR TEACHER */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-2 mb-6">
          {[
            { key: 'courses', icon: Video, label: 'Khóa học', count: courses.length },
            { key: 'guides', icon: FileText, label: 'Quy trình', count: visibleTraining?.guides?.length || 0 },
            { key: 'files', icon: Download, label: 'Tài liệu', count: visibleTraining?.files?.length || 0 },
          ].map(t => (
            <button key={t.key} onClick={() => setMainTab(t.key)}
              className={`relative flex w-full min-w-0 flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                mainTab === t.key
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              <t.icon size={15} className="shrink-0" />
              <span className="text-[11px] leading-tight text-center line-clamp-2 min-h-[2.1rem]">
                {t.label}
              </span>
              <span className={`absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full leading-none ${mainTab === t.key ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                {t.count}
              </span>
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
               <p className="text-xs mt-1">Hệ thống chưa có khóa học nào được xuất bản.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {courses.map((course, idx) => {
                 const gradients = [
                    "from-blue-600 to-indigo-700",
                    "from-teal-500 to-emerald-600",
                    "from-violet-600 to-fuchsia-600",
                    "from-sky-500 to-blue-700"
                 ];
                 const bgClass = gradients[idx % gradients.length];
                 const progress = courseProgressMap[course.id || course._id] || course.overallProgress || course.progress || 0;
                 const lessonCount = (course.lessons || course.videos || [1]).length;
                 return (
                 <div onClick={() => { 
                    setSelectedCourse(course);
                    setCourseTab('overview');
                    fetchLessons(course.id || course._id);
                  }} key={course.id || course._id} className="bg-white rounded-2xl border border-slate-100 shadow-md transition-all duration-200 cursor-pointer group flex flex-col overflow-hidden hover:shadow-xl lg:hover:-translate-y-1 lg:hover:shadow-xl">
                    
                    <div className={`relative aspect-video bg-gradient-to-r ${bgClass} overflow-hidden`}>
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
                          {course.description || course.desc || 'Hoàn thành khóa học nội bộ này để nâng cao kỹ năng sư phạm và chuyên môn giảng dạy.'}
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
              );})}
            </div>
          )
        )}

        {/* GUIDES TAB */}
        {mainTab === 'guides' && (
           <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
             <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
               <FileText className="text-blue-600" /> Quy trình & Hướng dẫn
             </h2>
             <div className="grid grid-cols-1 gap-4 w-full max-w-full">
               {visibleTraining?.guides?.map((guide, idx) => {
                 const gKey = guide.id ?? guide._id ?? `g-${idx}`;
                 const descHtml = guide.desc || '';
                 const plain = htmlToPlainText(descHtml);
                 const hasHtml = /<[a-z][\s\S]*>/i.test(descHtml);
                 const expanded = expandedGuideKey === gKey;
                 const showToggle = plain.length > 120 || hasHtml;
                 const emptyBody = !descHtml.trim() && !plain;
                 return (
                   <div
                     key={gKey}
                     className="p-5 sm:p-6 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex gap-4 sm:gap-5 items-start w-full"
                   >
                     <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl shrink-0">{guide.icon || '📄'}</div>
                     <div className="min-w-0 flex-1">
                       <h3 className="font-bold text-slate-800">{guide.title}</h3>
                       {emptyBody ? (
                         <p className="text-xs text-slate-400 mt-1">Chưa có nội dung chi tiết.</p>
                       ) : expanded && hasHtml ? (
                         <div
                           className="text-sm text-slate-600 mt-2 leading-relaxed break-words [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-semibold [&_strong]:font-semibold [&_a]:text-blue-600 [&_a]:underline"
                           dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(descHtml) }}
                         />
                       ) : (
                         <p className={`text-xs text-slate-500 mt-1 ${showToggle && !expanded ? 'line-clamp-2' : ''} whitespace-pre-wrap`}>
                           {plain}
                         </p>
                       )}
                       {showToggle ? (
                         <button
                           type="button"
                           onClick={() => setExpandedGuideKey(expanded ? null : gKey)}
                           className="text-[11px] font-bold text-blue-600 hover:text-blue-800 mt-1"
                         >
                           {expanded ? 'Thu gọn' : 'Xem thêm'}
                         </button>
                       ) : null}
                     </div>
                   </div>
                 );
               })}
               {(!visibleTraining?.guides || visibleTraining.guides.length === 0) && (
                 <p className="text-slate-400 text-sm">Chưa có quy trình nào.</p>
               )}
             </div>
           </div>
        )}

        {/* FILES TAB */}
        {mainTab === 'files' && (
           <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
             <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
               <Download className="text-green-600" /> Tài liệu Đào tạo
             </h2>
             <div className="space-y-3">
               {visibleTraining?.files?.map((file, idx) => (
                 <div key={idx} className="p-4 rounded-xl border border-slate-100 hover:bg-green-50 hover:border-green-200 transition-all flex justify-between items-center group cursor-pointer">
                   <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black text-white ${file.fileType === 'PDF' ? 'bg-red-500' : 'bg-green-500'}`}>{file.fileType || 'FILE'}</div>
                     <div>
                       <h3 className="font-bold text-slate-800">{file.title}</h3>
                       <p className="text-xs text-slate-400">{file.fileSize || 'N/A'}</p>
                     </div>
                   </div>
                   {file.fileUrl ? (
                     <a
                       href={buildMediaDownloadUrl(file.fileUrl, file.fileOriginalName || file.title)}
                       className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 group-hover:bg-green-500 group-hover:text-white group-hover:border-green-500 transition-all inline-block text-center"
                     >
                       Tải xuống
                     </a>
                   ) : (
                     <span className="px-4 py-2 rounded-lg text-sm font-bold text-slate-400 border border-slate-100 bg-slate-50 cursor-not-allowed">Chưa có file</span>
                   )}
                 </div>
               ))}
               {(!visibleTraining?.files || visibleTraining.files.length === 0) && (
                 <p className="text-slate-400 text-sm">Chưa có tài liệu nào.</p>
               )}
             </div>
           </div>
        )}

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

        <div
          data-lms-scroll
          className="flex-1 basis-0 min-w-0 min-h-0 w-full overflow-y-scroll overscroll-y-contain custom-scrollbar-dark"
        >

          <div className="bg-[#0b1018]">
            <div className="px-0 sm:px-4 pt-0 sm:pt-3 pb-0 sm:pb-2 flex justify-center w-full bg-black/40">
              <div className="relative w-full rounded-none sm:rounded-2xl overflow-hidden bg-black shadow-2xl shadow-black/80 h-[44dvh] sm:h-[50dvh] lg:h-[min(56dvh,620px)]">
                <YouTubePlayerSecure
                  key={currentLesson?._id}
                  videoId={currentLesson?.videoUrl}
                  lessonId={currentLesson?._id}
                  courseId={selectedCourse?._id}
                  duration={currentLesson?.duration}
                  initialWatchedSeconds={currentLesson?.watchedSeconds || 0}
                  onVideoEnded={handleVideoEnded}
                  onSaveProgress={handleSaveProgress}
                  onEligibilityReached={handleEligibilityReached}
                  isLocked={!currentLesson?.isUnlocked}
                  antiSeekEnabled={isLessonAntiSeekEnabled(currentLesson)}
                  playerApiRef={playerApiRef}
                />
              </div>
            </div>
            <LmsTabBar courseTab={courseTab} setCourseTab={setCourseTab} />
          </div>

          <div className="px-4 sm:px-6 py-4 sm:py-5 pb-16 w-full" style={{ background: '#0d1117' }}>
            <LmsPlayerPanels
              courseTab={courseTab}
              userId={teacherSession?.id || teacherSession?._id || 'teacher'}
              userName={teacherSession?.name || 'Giảng viên'}
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
              antiSeekEnabled={isLessonAntiSeekEnabled(currentLesson)}
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
                className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                  overallProgress === 100
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
                className={`h-full rounded-full transition-all duration-700 ${
                  overallProgress === 100 ? 'bg-emerald-500' : 'bg-emerald-500'
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
                        onClick={() => lesson.isUnlocked && setCurrentLesson(lesson)}
                        className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all relative ${
                          !lesson.isUnlocked ? 'opacity-40 pointer-events-none' : ''
                        } ${
                          isCurrent
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
                          <h4 className={`text-[12px] leading-snug line-clamp-2 ${
                            isCurrent ? 'text-emerald-400 font-bold' : lesson.isCompleted ? 'text-slate-500 font-semibold' : 'text-slate-300 font-semibold'
                          }`}>
                            {formatLessonDisplayTitle(lesson.title, globalIdx)}
                          </h4>
                          {lesson.duration ? (
                            <span className="text-[10px] text-slate-600 flex items-center gap-1 mt-1">
                              <Clock size={9} />
                              {Math.floor(lesson.duration / 60)}:{String(lesson.duration % 60).padStart(2,'0')}
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

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar-dark::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb:hover { background: #334155; }
        [id^="yt-player-"] iframe { width: 100% !important; height: 100% !important; object-fit: cover; }
      `}} />
    </div>
  );
};

export default TeacherTrainingLMS;
