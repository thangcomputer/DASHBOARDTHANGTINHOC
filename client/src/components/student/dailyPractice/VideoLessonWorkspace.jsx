import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clapperboard,
  Download,
  FilePenLine,
  HelpCircle,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  UserRound,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi, {
  DAILY_PRACTICE_STATS_EVENT,
  emitDailyPracticeStats,
} from '../../../services/dailyPracticeApi';
import { extractYouTubeId } from '../../../utils/youtubeDuration';
import { setStudyMediaPlaying } from '../../../utils/learningGoal';
import { resolveCurrentStudentId, saveLastStudySession } from '../../../utils/resumeLearning';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
import { gameSounds } from '../../../utils/sound';
import { VIDEO_CHECK_ANSWER_XP } from '../../../utils/dailyPractice';
import {
  findTriggeredVideoCheck,
  sortVideoChecksAsc,
  videoCheckKey,
} from '../../../../../shared/dailyPractice/videoCheckpointPlayback.mjs';
import DropletExercisesPanel from './DropletExercisesPanel';

export const VIDEO_LESSON_PROGRESS_EVENT = 'dew:video-lesson-progress';

function buildVideoLessonProgressKey(unitId, nodeKey) {
  const sid = resolveCurrentStudentId() || 'guest';
  return `dew_video_lesson_progress:${sid}:${String(unitId || '')}:${String(nodeKey || 'study')}`;
}

export function readVideoLessonProgress(unitId, nodeKey) {
  if (!unitId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(buildVideoLessonProgressKey(unitId, nodeKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      answeredCount: Math.max(0, Number(parsed.answeredCount) || 0),
      totalQuestions: Math.max(0, Number(parsed.totalQuestions) || 0),
      passedIds: Array.isArray(parsed.passedIds) ? parsed.passedIds.map(String) : [],
      pct: Math.max(0, Math.min(100, Math.round(Number(parsed.pct) || 0))),
    };
  } catch {
    return null;
  }
}

function writeVideoLessonProgress(unitId, nodeKey, payload) {
  if (!unitId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(buildVideoLessonProgressKey(unitId, nodeKey), JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(VIDEO_LESSON_PROGRESS_EVENT, {
      detail: { unitId: String(unitId), nodeKey: String(nodeKey || 'study'), ...payload },
    }));
  } catch { /* ignore */ }
}

const DEFAULT_SECTION_ORDER = ['content', 'file', 'video', 'practice'];
const DIFFICULTY_LABELS = [
  { key: 'easy', label: 'Dễ' },
  { key: 'medium', label: 'Vừa' },
  { key: 'hard', label: 'Khó' },
];

const FALLBACK_DEMO_DURATION = 23;

const FALLBACK_DEFAULT_STEPS = [
  'Mở menu Start bằng cách bấm biểu tượng Windows ở góc dưới màn hình.',
  'Nhấp đúp chuột trái vào biểu tượng để mở ứng dụng hoặc thư mục.',
];

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg|m3u8)(\?|#|$)/i.test(String(url || '')) || /^\/uploads\//.test(String(url || ''));
}

function formatClock(sec) {
  const safe = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function normalizeSectionLocks(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of DEFAULT_SECTION_ORDER) {
    const val = String(src[key] || '').trim();
    out[key] = ['auto', 'unlocked', 'locked'].includes(val) ? val : 'auto';
  }
  return out;
}

function normalizeConfig(node, diff) {
  const cfg = node?.levelConfigs?.[diff];
  if (cfg) {
    const order = (Array.isArray(cfg.sectionOrder) ? cfg.sectionOrder : DEFAULT_SECTION_ORDER)
      .filter((k) => DEFAULT_SECTION_ORDER.includes(k));
    for (const k of DEFAULT_SECTION_ORDER) {
      if (!order.includes(k)) order.push(k);
    }
    return {
      sectionOrder: order,
      hiddenSections: Array.isArray(cfg.hiddenSections) ? cfg.hiddenSections : [],
      sequentialSections: cfg.sequentialSections !== false,
      sectionLocks: normalizeSectionLocks(cfg.sectionLocks),
      content: cfg.content || { title: '', description: '', body: '' },
      files: Array.isArray(cfg.files) ? cfg.files : [],
      video: cfg.video || { title: '', url: '', antiSeek: true, checks: [] },
      practice: cfg.practice || { title: '', description: '', video: { title: '', url: '', antiSeek: true, checks: [] } },
    };
  }
  const legacy = diff === 'easy' ? node?.levels?.[0] : null;
  const legacyVid = legacy?.videos?.[0];
  return {
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    sequentialSections: true,
    sectionLocks: normalizeSectionLocks(),
    content: { title: legacy?.title || '', description: '', body: legacy?.content || legacyVid?.content || '' },
    files: (legacy?.fileUrl || legacyVid?.fileUrl)
      ? [{
        id: 'legacy-file',
        title: legacy?.fileName || legacyVid?.fileName || 'Tài liệu đính kèm',
        url: legacy?.fileUrl || legacyVid?.fileUrl,
        name: legacy?.fileName || legacyVid?.fileName || 'Tài liệu đính kèm',
      }]
      : [],
    video: {
      id: legacyVid?.id || '',
      title: legacyVid?.title || '',
      url: legacyVid?.url || '',
      antiSeek: legacyVid?.antiSeek !== false,
      checks: legacyVid?.checks || [],
    },
    practice: { title: '', description: '' },
  };
}

function parseQuickSteps(rawBody) {
  const text = String(rawBody || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();

  if (!text) return FALLBACK_DEFAULT_STEPS;

  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : FALLBACK_DEFAULT_STEPS;
}

function buildFallbackCheckpoints(durationSec) {
  const dur = Math.max(FALLBACK_DEMO_DURATION, Math.round(Number(durationSec) || FALLBACK_DEMO_DURATION));
  const at1 = dur <= 30 ? 6 : Math.max(6, Math.round(dur * 0.25));
  const at2 = dur <= 30 ? 15 : Math.max(at1 + 5, Math.round(dur * 0.65));
  const at3 = dur <= 30 ? 21 : Math.max(at2 + 5, Math.round(dur * 0.9));

  return [
    {
      id: 'local-check-1',
      atSec: at1,
      kind: 'choice',
      prompt: 'Để mở menu Start nhanh trên Windows, em nhấn hoặc bấm vào đâu?',
      choices: [
        'Biểu tượng Windows ở góc dưới thanh Taskbar',
        'Nhấp chuột phải vào màn hình Desktop',
        'Nhấn nút nguồn trên màn hình',
        'Kéo thả vào thùng rác Recycle Bin',
      ],
      correctIndex: 0,
      hint: 'Biểu tượng 4 ô vuông xanh ở thanh Taskbar dưới cùng chính là nút Start.',
      isLocalFallback: true,
    },
    {
      id: 'local-check-2',
      atSec: at2,
      kind: 'choice',
      prompt: 'Thao tác nào dùng để mở một ứng dụng hoặc thư mục trên Desktop?',
      choices: [
        'Nhấp đơn chuột phải vào biểu tượng',
        'Nhấp đúp chuột trái (2 lần liên tiếp) vào biểu tượng',
        'Di chuột ngang qua biểu tượng',
        'Nhấn giữ phím Space trên bàn phím',
      ],
      correctIndex: 1,
      hint: 'Trên Desktop Windows, em cần nhấp đúp chuột trái (double-click) để mở nhanh.',
      isLocalFallback: true,
    },
    {
      id: 'local-check-3',
      atSec: at3,
      kind: 'choice',
      prompt: 'Sau khi hoàn tất xem bài giảng và thử thao tác mẫu, bước tiếp theo tốt nhất là gì?',
      choices: [
        'Tắt máy tính ngay lập tức',
        'Xóa toàn bộ thư mục trên màn hình',
        'Chuyển sang Vòng 2: Luyện tập để thực hành ghi nhớ',
        'Không làm gì thêm',
      ],
      correctIndex: 2,
      hint: 'Hoàn thành Vòng 1 sẽ mở khóa Vòng 2: Luyện tập giúp em củng cố kiến thức.',
      isLocalFallback: true,
    },
  ];
}

function CrystalPadlockSvg() {
  return (
    <svg
      viewBox="0 0 96 108"
      className="mx-auto h-20 w-20 drop-shadow-[0_12px_20px_rgba(16,185,129,0.22)]"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dewLockShackle" x1="28" y1="10" x2="68" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="50%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="dewLockBody" x1="18" y1="38" x2="78" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
          <stop offset="45%" stopColor="#D1FAE5" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#A7F3D0" stopOpacity="0.92" />
        </linearGradient>
        <radialGradient id="dewLockGloss" cx="35%" cy="28%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="dewLockHole" x1="48" y1="54" x2="48" y2="79" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#065F46" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      {/* Móc khóa kim loại pha lê */}
      <path
        d="M31 44V30C31 19.5066 38.6112 11 48 11C57.3888 11 65 19.5066 65 30V44"
        stroke="url(#dewLockShackle)"
        strokeWidth="9.5"
        strokeLinecap="round"
      />
      <path
        d="M33 42V30C33 20.8 39.7 13.5 48 13.5C56.3 13.5 63 20.8 63 30V42"
        stroke="#FFFFFF"
        strokeOpacity="0.72"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Thân khóa tròn pha lê */}
      <circle cx="48" cy="65" r="28" fill="url(#dewLockBody)" stroke="#FFFFFF" strokeWidth="3" />
      <circle cx="48" cy="65" r="27" fill="url(#dewLockGloss)" />
      {/* Lỗ khóa */}
      <circle cx="48" cy="61" r="6" fill="url(#dewLockHole)" />
      <path d="M44.6 64.5H51.4L53 76.5C53 77.6 52.1 78.5 51 78.5H45C43.9 78.5 43 77.6 43 76.5L44.6 64.5Z" fill="url(#dewLockHole)" />
      {/* Điểm sáng thủy tinh */}
      <ellipse cx="36" cy="51" rx="7" ry="4" transform="rotate(-28 36 51)" fill="#FFFFFF" fillOpacity="0.78" />
    </svg>
  );
}

function DemoDesktopPreview({ isPlaying, currentTime }) {
  const showStartMenu = currentTime >= 5;
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#0284C7] via-[#0EA5E9] to-[#1D4ED8] select-none">
      {/* Sóng nền Windows 11 Bloom */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(circle at 52% 46%, rgba(56,189,248,0.88) 0%, rgba(37,99,235,0.68) 38%, rgba(30,58,138,0.92) 82%)',
        }}
      />
      <svg viewBox="0 0 800 450" className="pointer-events-none absolute inset-0 h-full w-full opacity-65" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="winPetalA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="winPetalB" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
        </defs>
        <path d="M290 220C290 120 420 55 515 110C585 150 560 275 465 305C375 335 290 295 290 220Z" fill="url(#winPetalA)" />
        <path d="M350 265C325 170 430 95 540 140C620 175 615 295 520 335C435 370 370 335 350 265Z" fill="url(#winPetalB)" opacity="0.82" />
      </svg>

      {/* Biểu tượng Desktop góc trái */}
      <div className="relative z-[1] flex flex-col gap-3 p-4 text-[10px] font-semibold text-white/95 drop-shadow">
        <div className="flex w-14 flex-col items-center gap-1 rounded-lg p-1 bg-white/10 backdrop-blur-xs">
          <div className="h-6 w-6 rounded-md bg-sky-200/90 border border-white/70" />
          <span className="truncate">Recycle Bin</span>
        </div>
        <div className="flex w-14 flex-col items-center gap-1 rounded-lg p-1">
          <div className="h-6 w-6 rounded-md bg-amber-300/95 border border-white/70" />
          <span className="truncate">Bài tập</span>
        </div>
        <div className="flex w-14 flex-col items-center gap-1 rounded-lg p-1">
          <div className="h-6 w-6 rounded-md bg-emerald-300/95 border border-white/70" />
          <span className="truncate">Edge</span>
        </div>
      </div>

      {/* Cửa sổ Start Menu minh họa */}
      <div
        className={`absolute bottom-14 left-1/4 z-[2] w-[54%] max-w-[310px] rounded-2xl border border-white/80 bg-white/90 p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-500 ${showStartMenu ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-85 scale-95'
          }`}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-800">Start · Đã ghim</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
            {isPlaying ? 'Đang hướng dẫn' : 'Tạm dừng'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {['Edge', 'Word', 'Excel', 'Files', 'Paint', 'Calc', 'Notes', 'Help'].map((app, i) => (
            <div key={app} className="flex flex-col items-center gap-1 rounded-xl bg-slate-100/80 p-1.5">
              <div
                className={`h-5 w-5 rounded-md ${i % 3 === 0 ? 'bg-sky-500' : i % 3 === 1 ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
              />
              <span className="text-[8.5px] font-bold text-slate-600">{app}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Thanh Taskbar mờ */}
      <div className="absolute inset-x-0 bottom-0 z-[1] flex h-9 items-center justify-center gap-2 border-t border-white/25 bg-slate-900/35 backdrop-blur-md">
        <span className="grid h-5 w-5 grid-cols-2 gap-0.5 rounded bg-sky-400/90 p-0.5 shadow">
          <span className="bg-white/95 rounded-[1px]" />
          <span className="bg-white/95 rounded-[1px]" />
          <span className="bg-white/95 rounded-[1px]" />
          <span className="bg-white/95 rounded-[1px]" />
        </span>
        <span className="h-5 w-24 rounded-full bg-white/20 px-2 text-[9px] leading-5 text-white/80">
          Tìm kiếm...
        </span>
      </div>
    </div>
  );
}

/**
 * Màn hình học bài Giọt Nước 3D (`VideoLessonWorkspace`) khi học viên bấm vào Giọt nước 1 (`Học bài`).
 */
export default function VideoLessonWorkspace({
  topicName = '',
  unit,
  node,
  initialDifficulty = null,
  onClose,
  onProgressChanged,
  onStartNextStage,
}) {
  const completedListInitial = unit?.completedSections || [];
  const [completedSections, setCompletedSections] = useState(completedListInitial);
  const [passedExercises, setPassedExercises] = useState(() => unit?.passedExercises || []);
  const completedSet = useMemo(() => new Set(completedSections), [completedSections]);

  useEffect(() => {
    setCompletedSections(unit?.completedSections || []);
  }, [unit?.completedSections]);

  useEffect(() => {
    setPassedExercises(unit?.passedExercises || []);
  }, [unit?.passedExercises]);

  const isDiffConfigured = useCallback((diff) => {
    const c = normalizeConfig(node, diff);
    return Boolean(c.video?.url || c.content?.body || c.files?.length);
  }, [node]);

  const availableDiffs = useMemo(() => {
    const list = DIFFICULTY_LABELS.filter((item) => isDiffConfigured(item.key));
    return list.length > 0 ? list : [DIFFICULTY_LABELS[0]];
  }, [isDiffConfigured]);

  const [activeDiff, setActiveDiff] = useState(() => {
    if (initialDifficulty && DIFFICULTY_LABELS.some((d) => d.key === initialDifficulty)) {
      return initialDifficulty;
    }
    return availableDiffs[0]?.key || 'easy';
  });

  const cfg = useMemo(() => normalizeConfig(node, activeDiff), [node, activeDiff]);
  const exercisesList = useMemo(() => (Array.isArray(node?.exercises) ? node.exercises : []), [node?.exercises]);
  const hasOwnVideo = Boolean(String(cfg.video?.url || '').trim());
  const hasOwnContentOrFiles = Boolean(String(cfg.content?.body || '').trim() || (cfg.files && cfg.files.length > 0));
  const isExerciseOnlyNode = exercisesList.length > 0 && !hasOwnVideo && !hasOwnContentOrFiles;
  const showSummaryCard = hasOwnContentOrFiles || (exercisesList.length === 0 && node?.icon !== 'clipboard');

  const [userXP, setUserXP] = useState(0);
  const [unitVideosData, setUnitVideosData] = useState(null);
  const [passedIds, setPassedIds] = useState(
    () => new Set(readVideoLessonProgress(unit?.id, node?.key)?.passedIds || []),
  );
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0);
  const autoPickedInitialTabRef = useRef(false);
  const [unlockedByTimeIds, setUnlockedByTimeIds] = useState(() => new Set());
  const [pickedChoice, setPickedChoice] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: string }

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(FALLBACK_DEMO_DURATION);
  const [maxReachedTime, setMaxReachedTime] = useState(0);

  const playerFrameRef = useRef(null);
  const videoRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytHostId = useMemo(
    () => `dew-yt-workspace-${String(unit?.id || 'u').replace(/[^a-zA-Z0-9_-]/g, '')}-${activeDiff}`,
    [unit?.id, activeDiff],
  );
  const syncedSectionsRef = useRef(new Set());
  const videoMarkedRef = useRef(false);

  // Tải XP hiện tại & lắng nghe cập nhật XP
  useEffect(() => {
    let alive = true;
    dailyPracticeApi.student.overview()
      .then((res) => {
        if (alive && typeof res?.stats?.xpTotal === 'number') {
          setUserXP(res.stats.xpTotal);
        }
      })
      .catch(() => { });
    const onStats = (event) => {
      if (typeof event?.detail?.xpTotal === 'number') {
        setUserXP(event.detail.xpTotal);
      }
    };
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
    return () => {
      alive = false;
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
    };
  }, []);

  // Khóa cuộn trang nền và phím ESC để quay lại lộ trình
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose?.();
      }
    };
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === playerFrameRef.current));
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [onClose]);

  // Tải danh sách video & câu hỏi mốc thực tế từ server (bỏ qua nếu hạt chỉ có bài tập)
  useEffect(() => {
    if (!unit?.id || isExerciseOnlyNode) return undefined;
    let alive = true;
    dailyPracticeApi.student.unitVideos(unit.id)
      .then((res) => {
        if (!alive) return;
        setUnitVideosData(res);
      })
      .catch(() => { });
    return () => { alive = false; };
  }, [unit?.id, isExerciseOnlyNode]);

  // Chọn bản ghi video khớp với node/difficulty hiện tại (tuyệt đối không mượn video của hạt khác khi hạt này là bài tập/nội dung riêng không có video)
  const matchedServerVideo = useMemo(() => {
    if (!hasOwnVideo && (exercisesList.length > 0 || node?.icon === 'clipboard' || hasOwnContentOrFiles)) {
      return null;
    }
    const list = [
      ...(unitVideosData?.videos || []),
      ...(unitVideosData?.lesson?.videos || []),
    ];
    if (!list.length) return null;
    const expectedId = cfg.video?.id || `${node?.key || 'study'}:level:${activeDiff}`;
    return (
      list.find((v) => v.id === expectedId)
      || list.find((v) => cfg.video?.url && v.url === cfg.video.url)
      || list.find((v) => node?.key && v.nodeKey === node.key)
      || (node?.key === 'study' ? list[0] : null)
    );
  }, [unitVideosData, cfg.video?.id, cfg.video?.url, node?.key, node?.icon, activeDiff, exercisesList.length, hasOwnVideo, hasOwnContentOrFiles]);

  const rawVideoUrl = matchedServerVideo?.url || cfg.video?.url || '';
  const resolvedDirectUrl = useMemo(() => {
    if (!rawVideoUrl || extractYouTubeId(rawVideoUrl)) return '';
    return isDirectVideo(rawVideoUrl) ? resolveMediaUrl(rawVideoUrl) : '';
  }, [rawVideoUrl]);
  const ytId = useMemo(() => {
    if (!rawVideoUrl || isDirectVideo(rawVideoUrl)) return '';
    return extractYouTubeId(rawVideoUrl);
  }, [rawVideoUrl]);

  // Danh sách câu hỏi mốc (ưu tiên server -> config -> 3 câu mẫu mặc định)
  const checkpoints = useMemo(() => {
    const serverChecks = Array.isArray(matchedServerVideo?.checks) ? matchedServerVideo.checks : [];
    const configChecks = Array.isArray(cfg.video?.checks) ? cfg.video.checks : [];
    const sourceChecks = serverChecks.length > 0 ? serverChecks : configChecks;
    if (sourceChecks.length > 0) {
      return sortVideoChecksAsc(sourceChecks).map((c, idx) => ({
        ...c,
        id: videoCheckKey(c) || `check-${idx + 1}`,
        atSec: Math.max(1, Number(c?.atSec) || (idx + 1) * 6),
        kind: c?.kind || 'choice',
        choices: Array.isArray(c?.choices) ? c.choices : [],
        prompt: c?.prompt || `Câu hỏi kiểm tra nhanh số ${idx + 1}`,
        isLocalFallback: !serverChecks.length || !videoCheckKey(c),
      }));
    }
    return buildFallbackCheckpoints(duration);
  }, [matchedServerVideo?.checks, cfg.video?.checks, duration]);

  // Đồng bộ câu đã qua từ server (passedCheckIds / check.passed)
  useEffect(() => {
    const next = new Set();
    const serverPassed = new Set(unitVideosData?.passedCheckIds || []);
    const vidId = matchedServerVideo?.id || '';
    const isServerCompleted = matchedServerVideo?.state === 'completed';

    checkpoints.forEach((chk) => {
      if (chk.isLocalFallback) return;
      const cid = chk.id;
      if (isServerCompleted || chk.passed || serverPassed.has(cid) || (vidId && serverPassed.has(`${vidId}:${cid}`))) {
        next.add(cid);
      }
    });

    if (next.size > 0) {
      setPassedIds((prev) => {
        const merged = new Set(prev);
        next.forEach((id) => merged.add(id));
        return merged;
      });
    }
  }, [unitVideosData?.passedCheckIds, matchedServerVideo?.id, matchedServerVideo?.state, checkpoints]);

  // Reset trạng thái chọn câu trả lời khi chuyển tab câu hỏi hoặc đổi mức độ
  useEffect(() => {
    setPickedChoice(null);
    setAnswerText('');
    setFeedback(null);
  }, [selectedQuestionIdx, activeDiff]);

  // Đổi mức độ sẽ reset thời gian video về 0
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setMaxReachedTime(0);
    setDuration(FALLBACK_DEMO_DURATION);
    setUnlockedByTimeIds(new Set());
  }, [activeDiff, unit?.id, node?.key]);

  // Khôi phục tiến độ đã lưu theo chặng & tự chọn tab câu kế tiếp chưa làm
  useEffect(() => {
    autoPickedInitialTabRef.current = false;
    const saved = readVideoLessonProgress(unit?.id, node?.key);
    setPassedIds(new Set(saved?.passedIds || []));
  }, [unit?.id, node?.key]);

  useEffect(() => {
    if (autoPickedInitialTabRef.current || !checkpoints.length) return;
    const firstPending = checkpoints.findIndex((c) => !passedIds.has(c.id));
    setSelectedQuestionIdx(firstPending >= 0 ? firstPending : 0);
    autoPickedInitialTabRef.current = true;
  }, [checkpoints, passedIds]);

  // Lưu trạng thái học gần nhất cho ResumeLearning
  useEffect(() => {
    if (!unit?.id || !node?.key) return undefined;
    const persist = () => {
      saveLastStudySession({
        kind: 'daily_practice',
        unitId: String(unit.id),
        unitTitle: unit.title || '',
        lessonId: String(matchedServerVideo?.id || node.key),
        lessonTitle: node.label || unit.title || 'Bài 1: Học bài',
        sectionLabel: `Chặng ${unit.index || 1} · Học bài`,
        atSec: Math.floor(currentTime),
        href: '/student/daily-practice',
      });
    };
    persist();
    const t = window.setInterval(persist, 6000);
    return () => {
      persist();
      window.clearInterval(t);
    };
  }, [unit?.id, unit?.index, unit?.title, node?.key, node?.label, matchedServerVideo?.id, currentTime]);

  useEffect(() => {
    const key = `dp-workspace:${unit?.id}:${activeDiff}`;
    setStudyMediaPlaying(key, isPlaying);
    return () => setStudyMediaPlaying(key, false);
  }, [isPlaying, unit?.id, activeDiff]);

  const answeredCount = useMemo(
    () => checkpoints.filter((chk) => passedIds.has(chk.id)).length,
    [checkpoints, passedIds],
  );
  const totalQuestions = checkpoints.length;
  const exercisesDoneCount = useMemo(() => {
    const pSet = new Set(Array.isArray(passedExercises) ? passedExercises : []);
    return exercisesList.filter((ex) => ex.passed || (node?.key && pSet.has(`${node.key}:${ex.id}`))).length;
  }, [exercisesList, passedExercises, node?.key]);
  const hasRealMediaOrNoCustomOnly = Boolean(rawVideoUrl) || (!cfg.content?.body && !cfg.files?.length && !exercisesList.length);
  const allExercisesDone = exercisesList.length > 0 && exercisesDoneCount >= exercisesList.length;
  const allQuestionsDone = hasRealMediaOrNoCustomOnly
    ? (totalQuestions > 0 && answeredCount >= totalQuestions)
    : allExercisesDone;
  const lessonPct = hasRealMediaOrNoCustomOnly
    ? (totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0)
    : (exercisesList.length > 0 ? Math.round((exercisesDoneCount / exercisesList.length) * 100) : 0);

  // Lưu tiến độ cục bộ & phát sự kiện cập nhật % cho Giọt nước ngoài lộ trình
  useEffect(() => {
    if (!unit?.id || !node?.key) return;
    if (hasRealMediaOrNoCustomOnly) {
      if (!totalQuestions) return;
      if (answeredCount === 0 && !readVideoLessonProgress(unit.id, node.key)) return;
      writeVideoLessonProgress(unit.id, node.key, {
        answeredCount,
        totalQuestions,
        passedIds: Array.from(passedIds),
        pct: lessonPct,
      });
    } else if (exercisesList.length > 0) {
      if (exercisesDoneCount === 0 && !readVideoLessonProgress(unit.id, node.key)) return;
      writeVideoLessonProgress(unit.id, node.key, {
        answeredCount: exercisesDoneCount,
        totalQuestions: exercisesList.length,
        passedIds: Array.from(passedExercises || []),
        pct: lessonPct,
      });
    }
  }, [unit?.id, node?.key, hasRealMediaOrNoCustomOnly, answeredCount, totalQuestions, passedIds, exercisesList.length, exercisesDoneCount, passedExercises, lessonPct]);

  // Khi hoàn thành đủ tất cả câu hỏi -> đồng bộ server + cập nhật % Giọt nước
  useEffect(() => {
    if (!allQuestionsDone || !unit?.id || !node?.key) return undefined;
    if (!hasRealMediaOrNoCustomOnly && !hasOwnContentOrFiles) {
      onProgressChanged?.();
      return undefined;
    }
    let cancelled = false;

    const syncCompletion = async () => {
      if (matchedServerVideo?.id && !videoMarkedRef.current) {
        videoMarkedRef.current = true;
        try {
          await dailyPracticeApi.student.videoWatched(unit.id, matchedServerVideo.id);
        } catch {
          videoMarkedRef.current = false;
        }
      }
      const diffsToSync = Array.from(new Set([activeDiff, ...availableDiffs.map((d) => d.key)]));
      const sections = ['content', 'file', 'video', 'practice'];
      for (const diffKey of diffsToSync) {
        for (const secKey of sections) {
          if (completedSet.has(`${node.key}:${diffKey}:${secKey}`)) continue;
          const key = `${node.key}:${diffKey}:${secKey}`;
          if (syncedSectionsRef.current.has(key)) continue;
          syncedSectionsRef.current.add(key);
          try {
            const res = await dailyPracticeApi.student.completeSection(unit.id, {
              nodeKey: node.key,
              difficulty: diffKey,
              sectionKey: secKey,
              completed: true,
            });
            if (!cancelled && Array.isArray(res?.completedSections)) {
              setCompletedSections(res.completedSections);
            }
          } catch {
            syncedSectionsRef.current.delete(key);
          }
        }
      }
      if (!cancelled) {
        onProgressChanged?.();
      }
    };

    syncCompletion();
    return () => { cancelled = true; };
  }, [allQuestionsDone, unit?.id, node?.key, activeDiff, availableDiffs, matchedServerVideo?.id, completedSet, onProgressChanged, hasRealMediaOrNoCustomOnly, hasOwnContentOrFiles]);

  const pauseVideo = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch { /* ignore */ }
    }
    if (ytPlayerRef.current?.pauseVideo) {
      try { ytPlayerRef.current.pauseVideo(); } catch { /* ignore */ }
    }
  }, []);

  const playVideo = useCallback(() => {
    const atEnd = duration > 0 && currentTime >= duration - 0.25;
    if (atEnd) {
      setCurrentTime(0);
      if (videoRef.current) {
        try { videoRef.current.currentTime = 0; } catch { /* ignore */ }
      }
      if (ytPlayerRef.current?.seekTo) {
        try { ytPlayerRef.current.seekTo(0, true); } catch { /* ignore */ }
      }
    }
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play?.().catch?.(() => { });
      return;
    }
    if (ytPlayerRef.current?.playVideo) {
      try { ytPlayerRef.current.playVideo(); } catch { /* ignore */ }
    }
  }, [currentTime, duration]);

  const seekVideoTo = useCallback((sec) => {
    const safeMax = duration > 0 ? duration : FALLBACK_DEMO_DURATION;
    const antiSeekActive = cfg.video?.antiSeek !== false && !allQuestionsDone;
    const firstPending = checkpoints.find((chk) => !passedIds.has(chk.id));
    const maxCheckpointCap = antiSeekActive && firstPending ? Number(firstPending.atSec) || 0 : safeMax;
    const allowedForwardCap = antiSeekActive ? Math.max(maxReachedTime, currentTime) : safeMax;
    const clamped = Math.max(0, Math.min(Number(sec) || 0, maxCheckpointCap, allowedForwardCap, safeMax));

    setCurrentTime(clamped);
    if (videoRef.current) {
      try { videoRef.current.currentTime = clamped; } catch { /* ignore */ }
    }
    if (ytPlayerRef.current?.seekTo) {
      try { ytPlayerRef.current.seekTo(clamped, true); } catch { /* ignore */ }
    }
  }, [duration, cfg.video?.antiSeek, allQuestionsDone, checkpoints, passedIds, maxReachedTime, currentTime]);

  // Kiểm tra chạm mốc câu hỏi khi thời gian video tăng lên
  const handleTimeAdvance = useCallback((nextTime) => {
    const t = Math.max(0, Number(nextTime) || 0);
    setCurrentTime(t);
    setMaxReachedTime((prev) => Math.max(prev, t));

    const newlyUnlocked = checkpoints.filter((chk) => t >= chk.atSec);
    if (newlyUnlocked.length > 0) {
      setUnlockedByTimeIds((prev) => {
        let changed = false;
        const copy = new Set(prev);
        newlyUnlocked.forEach((c) => {
          if (!copy.has(c.id)) {
            copy.add(c.id);
            changed = true;
          }
        });
        return changed ? copy : prev;
      });
    }

    const pendingChecks = checkpoints.filter((chk) => !passedIds.has(chk.id));
    const triggered = findTriggeredVideoCheck(pendingChecks, t);
    if (triggered) {
      pauseVideo();
      const idx = checkpoints.findIndex((c) => c.id === triggered.id);
      if (idx >= 0) setSelectedQuestionIdx(idx);
      const triggerAt = Number(triggered.atSec) || 0;
      if (t > triggerAt + 0.8) {
        if (videoRef.current) videoRef.current.currentTime = triggerAt;
        if (ytPlayerRef.current?.seekTo) ytPlayerRef.current.seekTo(triggerAt, true);
        setCurrentTime(triggerAt);
      }
    }
  }, [checkpoints, passedIds, pauseVideo]);

  // Khởi tạo YouTube Player nếu URL là YouTube
  useEffect(() => {
    if (!ytId) return undefined;
    let cancelled = false;

    const mountYt = () => {
      if (cancelled || !window.YT?.Player) return;
      const el = document.getElementById(ytHostId);
      if (!el) return;
      ytPlayerRef.current = new window.YT.Player(ytHostId, {
        videoId: ytId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            const d = Number(e.target?.getDuration?.()) || 0;
            if (d > 0) setDuration(d);
            if (isMuted) e.target?.mute?.();
            else e.target?.unMute?.();
          },
          onStateChange: (e) => {
            if (cancelled || !window.YT?.PlayerState) return;
            if (e.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              const d = Number(e.target?.getDuration?.()) || 0;
              if (d > 0) setDuration(d);
            } else if (e.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (e.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              const d = Number(e.target?.getDuration?.()) || duration;
              handleTimeAdvance(d);
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      mountYt();
    } else {
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existing) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevReady?.();
        mountYt();
      };
    }

    return () => {
      cancelled = true;
      try { ytPlayerRef.current?.destroy?.(); } catch { /* ignore */ }
      ytPlayerRef.current = null;
    };
  }, [ytId, ytHostId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick timer cho YouTube và chế độ xem thử minh họa (khi chưa có file video trực tiếp)
  useEffect(() => {
    if (!isPlaying || resolvedDirectUrl) return undefined;
    const timer = window.setInterval(() => {
      if (ytId && ytPlayerRef.current?.getCurrentTime) {
        const t = Number(ytPlayerRef.current.getCurrentTime()) || 0;
        const d = Number(ytPlayerRef.current.getDuration?.()) || 0;
        if (d > 0) setDuration(d);
        handleTimeAdvance(t);
        return;
      }
      if (!ytId) {
        setCurrentTime((prev) => {
          const next = Math.min(duration, Number((prev + 0.25).toFixed(2)));
          window.setTimeout(() => handleTimeAdvance(next), 0);
          if (next >= duration) {
            setIsPlaying(false);
          }
          return next;
        });
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isPlaying, resolvedDirectUrl, ytId, duration, handleTimeAdvance]);

  const togglePlayPause = () => {
    if (isPlaying) pauseVideo();
    else playVideo();
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) videoRef.current.muted = nextMuted;
    if (ytPlayerRef.current) {
      try {
        if (nextMuted) ytPlayerRef.current.mute?.();
        else ytPlayerRef.current.unMute?.();
      } catch { /* ignore */ }
    }
  };

  const toggleFullscreen = async () => {
    const el = playerFrameRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen?.();
    } catch { /* ignore */ }
  };

  const activeQuestion = checkpoints[selectedQuestionIdx] || checkpoints[0];
  const isActivePassed = activeQuestion ? passedIds.has(activeQuestion.id) : false;
  const isActiveTimeUnlocked = activeQuestion
    ? (isActivePassed || unlockedByTimeIds.has(activeQuestion.id) || currentTime >= activeQuestion.atSec)
    : false;

  const handleSubmitQuestion = async (choiceOverride = null) => {
    if (!activeQuestion || grading || isActivePassed) return;
    const isChoice = activeQuestion.kind === 'choice' || (activeQuestion.choices && activeQuestion.choices.length > 0);
    const chosenIndex = choiceOverride !== null ? choiceOverride : pickedChoice;
    if (isChoice && chosenIndex == null) return;
    if (!isChoice && !answerText.trim()) return;

    if (isChoice && choiceOverride !== null) {
      setPickedChoice(choiceOverride);
    }

    setGrading(true);
    setFeedback(null);

    try {
      if (!activeQuestion.isLocalFallback && matchedServerVideo?.id) {
        const res = await dailyPracticeApi.student.answerVideoCheck(
          unit.id,
          matchedServerVideo.id,
          activeQuestion.id,
          { choiceIndex: chosenIndex, text: answerText },
        );
        if (typeof res?.profileXp === 'number') {
          setUserXP(res.profileXp);
          emitDailyPracticeStats({
            xpTotal: res.profileXp,
            ...(typeof res?.studyXpTotal === 'number' ? { studyXpTotal: res.studyXpTotal } : {}),
            ...(typeof res?.purchasedXp === 'number' ? { purchasedXp: res.purchasedXp } : {}),
            ...(typeof res?.dailyXp === 'number' ? { dailyXp: res.dailyXp } : {}),
          });
        }
        if (res?.correct) {
          gameSounds.win();
          setPassedIds((prev) => new Set(prev).add(activeQuestion.id));
          setFeedback({ type: 'success', text: `Chính xác! Bạn vừa nhận +${VIDEO_CHECK_ANSWER_XP} XP.` });
        } else {
          gameSounds.wrong();
          setPickedChoice(null);
          setFeedback({ type: 'error', text: res?.hint || 'Đáp án chưa chính xác, em thử chọn lại nhé!' });
        }
        return;
      }

      // Chấm điểm cục bộ cho bộ câu hỏi minh họa khi video chưa cấu hình check trên server
      const isCorrect = isChoice
        ? chosenIndex === (Number(activeQuestion.correctIndex) || 0)
        : answerText.trim().length > 0;
      if (isCorrect) {
        gameSounds.win();
        setPassedIds((prev) => new Set(prev).add(activeQuestion.id));
        setUserXP((prev) => prev + VIDEO_CHECK_ANSWER_XP);
        setFeedback({ type: 'success', text: `Chính xác! Bạn vừa nhận +${VIDEO_CHECK_ANSWER_XP} XP.` });
      } else {
        gameSounds.wrong();
        setPickedChoice(null);
        setFeedback({ type: 'error', text: activeQuestion.hint || 'Chưa đúng rồi, em xem lại nội dung và chọn đáp án khác nhé!' });
      }
    } catch (err) {
      if (err?.status === 402) {
        window.dispatchEvent(new CustomEvent(err?.suggestedAction === 'upgrade_plan' || err?.isFreeTier ? 'cms:open-upgrade-plan' : 'cms:open-buy-xp'));
      }
      setFeedback({ type: 'error', text: err?.message || 'Chưa chấm được câu trả lời, thử lại nhé.' });
    } finally {
      setGrading(false);
    }
  };

  const handleDownloadPracticeFile = async () => {
    gameSounds.tap();
    const primaryFile = cfg.files?.[0];
    if (primaryFile?.url) {
      const a = document.createElement('a');
      a.href = buildMediaDownloadUrl(primaryFile.url, primaryFile.name || primaryFile.title || 'bai-tap');
      a.download = primaryFile.name || primaryFile.title || 'bai-tap';
      a.target = '_blank';
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      // Tạo nhanh file hướng dẫn thực hành .txt nếu chặng chưa đính kèm file mẫu
      const contentText = [
        `DEWSKILL - BAI TAP THUC HANH CHANG ${unit?.index || 1}`,
        `Chu de: ${topicName || 'Hoc may tinh co ban'}`,
        `Bai hoc: ${cfg.content?.title || node?.label || 'Bai 1'}`,
        '',
        'CAC BUOC THUC HANH NHANH:',
        ...parseQuickSteps(cfg.content?.body).map((s, idx) => `${idx + 1}. ${s}`),
      ].join('\n');
      const blob = new Blob([contentText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DewSkill-Bai-tap-Chang-${unit?.index || 1}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    if (unit?.id && node?.key) {
      const fullKey = `${node.key}:${activeDiff}:file`;
      if (!completedSet.has(fullKey)) {
        try {
          const res = await dailyPracticeApi.student.completeSection(unit.id, {
            nodeKey: node.key,
            difficulty: activeDiff,
            sectionKey: 'file',
            completed: true,
          });
          if (Array.isArray(res?.completedSections)) {
            setCompletedSections(res.completedSections);
          }
          onProgressChanged?.();
        } catch { /* ignore */ }
      }
    }
  };

  const quickSteps = useMemo(() => parseQuickSteps(cfg.content?.body), [cfg.content?.body]);
  const headerTotal = hasRealMediaOrNoCustomOnly ? totalQuestions : Math.max(exercisesList.length, 1);
  const headerDone = hasRealMediaOrNoCustomOnly
    ? answeredCount
    : (exercisesList.length > 0 ? exercisesDoneCount : (completedSet.has(`${node?.key}:${activeDiff}:content`) ? 1 : 0));
  const headerProgressPct = headerTotal > 0 ? Math.round((headerDone / headerTotal) * 100) : 0;
  const unlockTargetSec = activeQuestion?.atSec || 1;
  const unlockProgressPct = Math.max(0, Math.min(100, Math.round((Math.min(currentTime, unlockTargetSec) / unlockTargetSec) * 100)));
  const timelinePct = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;

  return createPortal(
    <div
      data-theme={getDewSkillThemeAttr()}
      className="fixed inset-0 z-[9200] overflow-y-auto lms-canvas dew-student-theme bg-gradient-to-br from-[#E0F2FE] via-[#ECFEFF] to-[#ECFDF5] px-3 py-4 sm:px-6 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Không gian học bài DewSkill"
    >
      {/* Giọt nước trang trí nền */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="dew-water-orb -left-6 top-20 h-16 w-16 opacity-65" />
        <div className="dew-water-orb right-6 top-16 h-12 w-12 opacity-60" />
        <div className="dew-water-orb bottom-12 left-10 h-10 w-10 opacity-50" />
      </div>

      {/* 1. Thanh Header kính nổi trên cùng */}
      <header className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 rounded-full border border-white bg-white/88 px-5 py-3 shadow-[0_12px_30px_-10px_rgba(16,185,129,0.16),inset_0_2px_0_#fff] backdrop-blur-2xl">
        {/* Trái */}
        <div className="flex min-w-0 items-center gap-3.5">
          <button
            type="button"
            onClick={() => {
              pauseVideo();
              onClose?.();
            }}
            aria-label="Quay về lộ trình 5 giọt nước"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white bg-gradient-to-b from-white to-slate-50 text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.08),inset_0_2px_0_#fff] transition hover:scale-105 hover:text-emerald-700 cursor-pointer"
          >
            <ArrowLeft size={18} strokeWidth={2.3} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-extrabold uppercase tracking-wider text-emerald-600">
              {topicName || 'HỌC MÁY TÍNH CƠ BẢN'}
            </p>
            <h2 className="truncate text-base font-black tracking-tight text-slate-900 sm:text-lg">
              {node?.label && !/^học bài$/i.test(node.label)
                ? `${node.label}: Chặng ${unit?.index || 1}`
                : `Bài ${unit?.index || 1}: Chặng ${unit?.index || 1}`}
            </h2>
          </div>
        </div>

        {/* Phải */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-24 overflow-hidden rounded-full bg-slate-200/80 p-0.5 shadow-inner sm:w-32">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#34D399] to-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.45)] transition-all duration-300"
                style={{ width: `${Math.max(headerProgressPct, headerDone > 0 ? 14 : 6)}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-slate-600 sm:text-[13px]">
              {hasRealMediaOrNoCustomOnly
                ? `${headerDone}/${headerTotal} câu hỏi`
                : exercisesList.length > 0
                  ? `${headerDone}/${headerTotal} bài tập`
                  : 'Bài đọc & Tài liệu'}
            </span>
          </div>

          {!isExerciseOnlyNode ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-extrabold text-emerald-700">
              +{VIDEO_CHECK_ANSWER_XP} XP
            </span>
          ) : null}

          <span className="inline-flex items-center rounded-full bg-gradient-to-b from-[#34D399] via-[#10B981] to-[#059669] px-3.5 py-1.5 text-xs font-black text-white shadow-[0_6px_14px_rgba(16,185,129,0.3),inset_0_1.5px_0_rgba(255,255,255,0.5)] tabular-nums">
            + {userXP} XP
          </span>
        </div>
      </header>

      {/* 2. Bố cục 2 cột (nếu chỉ có bài tập thì căn giữa 1 cột gọn) */}
      <main className="relative z-10 mx-auto mt-5 grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-12">
        {/* CỘT TRÁI */}
        <div className={`space-y-5 ${hasRealMediaOrNoCustomOnly ? 'lg:col-span-7' : !showSummaryCard ? 'lg:col-span-12 mx-auto w-full max-w-3xl' : 'lg:col-span-12'}`}>
          {/* Card Video bài giảng */}
          {hasRealMediaOrNoCustomOnly ? (
            <section className="dew-app-card relative overflow-hidden rounded-[28px] border border-white bg-white/90 p-5 shadow-[0_18px_40px_-12px_rgba(16,185,129,0.16),inset_0_2px_0_#fff] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#06B6D4]" />

              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-900">
                  <Clapperboard size={18} strokeWidth={2} className="text-emerald-600" />
                  <h3 className="text-base font-extrabold tracking-tight">
                    {cfg.video?.title || matchedServerVideo?.title || 'Video 1'}
                  </h3>
                </div>

                {availableDiffs.length > 1 && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50/80 p-1 border border-emerald-100">
                    {availableDiffs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveDiff(tab.key)}
                        className={`rounded-full px-3 py-1 text-[11px] font-extrabold transition cursor-pointer ${activeDiff === tab.key
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-emerald-700'
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Khung phát Video bo góc */}
              <div
                ref={playerFrameRef}
                className="relative aspect-video overflow-hidden rounded-[20px] bg-slate-900 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.35)]"
              >
                {resolvedDirectUrl ? (
                  <video
                    ref={videoRef}
                    src={resolvedDirectUrl}
                    playsInline
                    preload="metadata"
                    muted={isMuted}
                    className="h-full w-full object-cover"
                    onLoadedMetadata={(e) => {
                      const d = Number(e.currentTarget.duration) || 0;
                      if (d > 0) setDuration(d);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={(e) => {
                      setIsPlaying(false);
                      handleTimeAdvance(e.currentTarget.duration || duration);
                    }}
                    onTimeUpdate={(e) => handleTimeAdvance(e.currentTarget.currentTime)}
                  />
                ) : ytId ? (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
                    <div id={ytHostId} className="h-full w-full scale-[1.03]" />
                  </div>
                ) : (
                  <DemoDesktopPreview isPlaying={isPlaying} currentTime={currentTime} />
                )}

                {/* Click vào khung video để Play/Pause nhanh */}
                <button
                  type="button"
                  aria-label={isPlaying ? 'Tạm dừng video' : 'Phát video'}
                  onClick={togglePlayPause}
                  className="absolute inset-0 z-[2] cursor-pointer bg-transparent focus:outline-none"
                />

                {/* Thanh điều khiển custom kiểu Giọt Nước */}
                <div className="absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-slate-950/85 via-slate-900/50 to-transparent px-4 pt-8 pb-3.5">
                  {/* Timeline xanh ngọc + các điểm mốc câu hỏi */}
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Thanh thời lượng video"
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration)}
                    aria-valuenow={Math.round(currentTime)}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                      seekVideoTo(ratio * duration);
                    }}
                    className="relative mb-3 flex h-5 cursor-pointer items-center"
                  >
                    <div className="h-2 w-full overflow-visible rounded-full bg-white/30 backdrop-blur-xs">
                      <div
                        className="relative h-full rounded-full bg-gradient-to-r from-[#34D399] to-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.75)] transition-[width] duration-150"
                        style={{ width: `${timelinePct}%` }}
                      >
                        <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-emerald-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]" />
                      </div>
                    </div>

                    {/* Các điểm mốc câu hỏi trên timeline */}
                    {checkpoints.map((chk, idx) => {
                      const posPct = duration > 0 ? Math.max(6, Math.min(95, (chk.atSec / duration) * 100)) : (idx + 1) * 28;
                      const done = passedIds.has(chk.id);
                      const isUnlocked = done || unlockedByTimeIds.has(chk.id) || currentTime >= chk.atSec;
                      const firstPendingIdx = checkpoints.findIndex((c) => !passedIds.has(c.id));
                      const isNextTarget = idx === firstPendingIdx;

                      return (
                        <button
                          key={chk.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuestionIdx(idx);
                            if (isUnlocked) seekVideoTo(chk.atSec);
                          }}
                          title={`Câu ${idx + 1} (${formatClock(chk.atSec)})`}
                          style={{ left: `${posPct}%` }}
                          className={`absolute top-1/2 z-[3] flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-black transition cursor-pointer ${done
                              ? 'bg-emerald-500 text-white ring-2 ring-white/90 shadow-[0_0_10px_rgba(16,185,129,0.85)]'
                              : isNextTarget
                                ? 'border-2 border-emerald-300 bg-slate-800/85 text-white ring-2 ring-white/60'
                                : 'border border-white/55 bg-slate-500/75 text-white/90 backdrop-blur-xs'
                            }`}
                        >
                          {done ? (
                            <Check size={11} strokeWidth={3} />
                          ) : isNextTarget ? (
                            <span>{idx + 1}</span>
                          ) : (
                            <Lock size={10} strokeWidth={2.4} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Hàng nút điều khiển */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlayPause();
                        }}
                        aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-[#34D399] to-[#059669] text-white shadow-[0_0_18px_rgba(16,185,129,0.7),inset_0_1.5px_0_rgba(255,255,255,0.6)] transition hover:scale-105 cursor-pointer"
                      >
                        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                      </button>

                      <span className="text-xs font-bold tabular-nums tracking-tight text-white/95 drop-shadow">
                        {formatClock(currentTime)} / {formatClock(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute();
                        }}
                        aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 cursor-pointer"
                      >
                        {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFullscreen();
                        }}
                        aria-label={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 cursor-pointer"
                      >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* Card Tóm tắt thao tác nhanh (chỉ hiện khi hạt có nội dung/tài liệu hoặc không phải hạt thuần bài tập) */}
          {showSummaryCard ? (
            <section className="dew-app-card relative overflow-hidden rounded-[28px] border border-white bg-white/90 p-5 shadow-[0_18px_40px_-12px_rgba(16,185,129,0.16),inset_0_2px_0_#fff] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#06B6D4]" />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <FilePenLine size={18} strokeWidth={2} className="text-emerald-600" />
                  <h3 className="text-base font-extrabold tracking-tight">Tóm tắt thao tác nhanh</h3>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadPracticeFile}
                  className="dew-btn-white inline-flex items-center gap-1.5 text-xs px-4 py-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Tải file bài tập</span>
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-100/80 bg-emerald-50/35 p-4">
                <h4 className="text-sm font-black text-slate-900">
                  {cfg.content?.title || 'Nội dung 1'}
                </h4>
                {cfg.content?.description ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-800/80">{cfg.content.description}</p>
                ) : null}
                <ol className="mt-2.5 space-y-2 text-[13.5px] leading-relaxed text-slate-700">
                  {quickSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-700">
                        {index + 1}
                      </span>
                      <span className="font-medium">{step}</span>
                    </li>
                  ))}
                </ol>

                {cfg.files?.length > 1 ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-emerald-100/80 pt-3">
                    {cfg.files.slice(1).map((f, idx) => (
                      <a
                        key={f.id || idx}
                        href={buildMediaDownloadUrl(f.url, f.name)}
                        download={f.name}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50"
                      >
                        <Download size={11} />
                        <span>{f.title || f.name}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {exercisesList.length > 0 ? (
            <DropletExercisesPanel
              unitId={unit?.id}
              nodeKey={node?.key}
              exercises={exercisesList}
              passedExercises={passedExercises}
              onExercisePassed={(res) => {
                if (Array.isArray(res?.passedExercises)) {
                  setPassedExercises(res.passedExercises);
                }
                onProgressChanged?.();
              }}
            />
          ) : null}

          {!hasRealMediaOrNoCustomOnly && allExercisesDone ? (
            <div className="dew-app-card flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50/90 px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2.5 text-sm font-black text-emerald-900">
                <img src="/mascot/om-trai-tim-vui.gif" alt="DewSkill Mascot" className="h-9 w-9 shrink-0 object-contain" />
                <span>Tuyệt vời! Bạn đã hoàn thành toàn bộ bài tập trong hạt nước này.</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onClose?.()}
                  className="dew-btn-white px-4 py-2 text-xs font-extrabold cursor-pointer"
                >
                  Quay lại lộ trình
                </button>
                {onStartNextStage ? (
                  <button
                    type="button"
                    onClick={() => onStartNextStage()}
                    className="dew-btn-primary px-4 py-2 text-xs font-black cursor-pointer"
                  >
                    Tiếp tục vòng tiếp theo
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* CỘT PHẢI */}
        {hasRealMediaOrNoCustomOnly ? (
          <div className="lg:col-span-5 lg:sticky lg:top-6 h-fit">
            <section className="dew-app-card relative overflow-hidden rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_18px_40px_-12px_rgba(16,185,129,0.16),inset_0_2px_0_#fff] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#06B6D4]" />

              <div className="flex items-center gap-2 text-slate-900">
                <HelpCircle size={18} strokeWidth={2} className="text-emerald-600" />
                <h3 className="text-base font-extrabold tracking-tight">Câu hỏi kiểm tra nhanh</h3>
              </div>

              {/* Hàng tab các mốc câu hỏi */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                {checkpoints.map((chk, idx) => {
                  const done = passedIds.has(chk.id);
                  const selected = idx === selectedQuestionIdx;
                  const unlocked = done || unlockedByTimeIds.has(chk.id) || currentTime >= chk.atSec;

                  return (
                    <button
                      key={chk.id}
                      type="button"
                      onClick={() => setSelectedQuestionIdx(idx)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${done
                          ? selected
                            ? 'bg-emerald-500 text-white shadow-[0_6px_14px_rgba(16,185,129,0.3)]'
                            : 'border border-emerald-200 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-100/80'
                          : selected
                            ? 'bg-gradient-to-b from-[#34D399] via-[#10B981] to-[#059669] text-white shadow-[0_6px_14px_rgba(16,185,129,0.3),inset_0_1.5px_0_rgba(255,255,255,0.5)]'
                            : unlocked
                              ? 'border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
                              : 'border border-slate-200/80 bg-slate-100/85 text-slate-500 hover:bg-slate-200/70'
                        }`}
                    >
                      {done ? (
                        <Check size={12} strokeWidth={3} />
                      ) : selected ? (
                        <UserRound size={12} strokeWidth={2.5} />
                      ) : !unlocked ? (
                        <Lock size={11} strokeWidth={2.3} />
                      ) : null}
                      <span>Câu {idx + 1}</span>
                    </button>
                  );
                })}
              </div>

              {/* Nội dung bên trong Card Phải */}
              {activeQuestion && !isActiveTimeUnlocked ? (
                /* Trạng thái khóa theo thời gian */
                <div className="mt-4 rounded-[22px] border border-emerald-100/90 bg-emerald-50/55 p-6 text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.8)]">
                  <CrystalPadlockSvg />

                  <h4 className="mt-3 text-base font-black text-slate-900 sm:text-[17px]">
                    Xem video đến mốc {formatClock(unlockTargetSec)} để mở Câu {selectedQuestionIdx + 1}
                  </h4>
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500 sm:text-[13px]">
                    Đã xem {formatClock(Math.min(currentTime, unlockTargetSec))} / {formatClock(unlockTargetSec)} — xem tới đâu câu trắc nghiệm mở tới đó.
                  </p>

                  {/* Thanh tiến độ mini */}
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/90 p-0.5 shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#34D399] to-[#0D9488] transition-all duration-200"
                      style={{ width: `${Math.max(unlockProgressPct, 4)}%` }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={playVideo}
                    className="dew-btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 py-3.5 text-sm font-black cursor-pointer"
                  >
                    <Play size={15} fill="currentColor" />
                    <span>{isPlaying ? 'Đang phát video...' : 'Tiếp tục xem video'}</span>
                  </button>
                </div>
              ) : activeQuestion ? (
                /* Trạng thái câu hỏi đã mở khóa */
                <div className="mt-4 rounded-[22px] border border-emerald-100/90 bg-emerald-50/45 p-5 shadow-[inset_0_2px_0_rgba(255,255,255,0.8)]">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
                      Mốc {formatClock(activeQuestion.atSec)}
                    </span>
                    {isActivePassed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                        <CheckCircle2 size={12} /> Đã trả lời đúng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-800">
                        <Sparkles size={11} /> +{VIDEO_CHECK_ANSWER_XP} XP
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-extrabold leading-snug text-slate-900 sm:text-[15px]">
                    {activeQuestion.prompt}
                  </p>

                  {activeQuestion.kind === 'text' ? (
                    <input
                      type="text"
                      disabled={isActivePassed || grading}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="Nhập câu trả lời của em..."
                      className="mt-3.5 w-full rounded-2xl border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  ) : (
                    <div className="mt-3.5 space-y-2.5">
                      {(activeQuestion.choices || []).map((choice, cIdx) => {
                        const expectedIdx = activeQuestion.reviewChoiceIndex ?? activeQuestion.correctIndex;
                        const isCorrectOption = isActivePassed && expectedIdx != null && cIdx === Number(expectedIdx);
                        const isPicked = pickedChoice === cIdx || isCorrectOption;

                        return (
                          <button
                            key={cIdx}
                            type="button"
                            disabled={isActivePassed || grading}
                            onClick={() => handleSubmitQuestion(cIdx)}
                            className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[13px] font-bold backdrop-blur-md transition cursor-pointer disabled:cursor-default ${isPicked
                                ? 'border-emerald-400 bg-emerald-50/95 text-emerald-950 shadow-[0_8px_18px_-6px_rgba(16,185,129,0.28)] ring-2 ring-emerald-200/70'
                                : 'border-white bg-white/88 text-slate-700 shadow-[0_6px_16px_-8px_rgba(15,23,42,0.1)] hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white'
                              }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition ${isPicked
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                              {String.fromCharCode(65 + cIdx)}
                            </span>
                            <span className="min-w-0 flex-1">{choice}</span>
                            {isCorrectOption || (isActivePassed && pickedChoice === cIdx) ? (
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                                <Check size={13} strokeWidth={3} />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {feedback ? (
                    <div
                      className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold ${feedback.type === 'success'
                          ? 'border-emerald-200 bg-emerald-100/80 text-emerald-900'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}
                    >
                      {feedback.text}
                    </div>
                  ) : null}

                  {!isActivePassed ? (
                    activeQuestion.kind === 'text' ? (
                      <button
                        type="button"
                        disabled={grading || !answerText.trim()}
                        onClick={() => handleSubmitQuestion()}
                        className="dew-btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        {grading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        <span>{grading ? 'Đang chấm điểm...' : 'Kiểm tra đáp án'}</span>
                      </button>
                    ) : (
                      <p className="mt-3 text-center text-[11px] font-semibold text-emerald-700/85">
                        {grading ? 'Đang chấm đáp án...' : 'Chạm chọn trực tiếp 1 đáp án ở trên để nhận +5 XP'}
                      </p>
                    )
                  ) : allQuestionsDone ? (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          seekVideoTo(0);
                          playVideo();
                        }}
                        className="dew-btn-white inline-flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold cursor-pointer"
                      >
                        <RotateCcw size={14} />
                        <span>Xem lại video</span>
                      </button>
                      {onStartNextStage ? (
                        <button
                          type="button"
                          onClick={() => {
                            pauseVideo();
                            onStartNextStage();
                          }}
                          className="dew-btn-primary inline-flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-black cursor-pointer"
                        >
                          <span>Sang Vòng 2: Luyện tập</span>
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx = checkpoints.findIndex((c) => !passedIds.has(c.id));
                        if (nextIdx >= 0) setSelectedQuestionIdx(nextIdx);
                        playVideo();
                      }}
                      className="dew-btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-black cursor-pointer"
                    >
                      <Play size={15} fill="currentColor" />
                      <span>Tiếp tục xem video</span>
                    </button>
                  )}
                </div>
              ) : null}

              {/* Chân card phải */}
              <div className="mt-5 flex items-center justify-center gap-2.5 border-t border-slate-100/90 pt-4">
                <img
                  src={allQuestionsDone ? '/mascot/om-trai-tim-vui.gif' : '/mascot/nang-dong.gif'}
                  alt="DewSkill Mascot"
                  className="h-8 w-8 shrink-0 object-contain"
                />
                <p className="text-xs font-bold text-slate-600">
                  {allQuestionsDone
                    ? 'Tuyệt vời! Bạn đã đạt 100% Vòng 1 · Giọt nước 1 đã xanh hoàn chỉnh.'
                    : `Hoàn thành đủ ${totalQuestions} câu để đạt 100% Vòng 1`}
                </p>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>,
    document.body,
  );
}
