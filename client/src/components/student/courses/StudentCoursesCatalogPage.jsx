import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gamepad2,
  Gift,
  Loader2,
  Play,
  Video,
} from 'lucide-react';
import { resolveMediaUrl } from '../../../services/api';
import dewskillClassApi, { dewskillClassErrorMessage } from '../../../services/dewskillClassApi';
import { useData } from '../../../context/DataContext';
import { useSocket } from '../../../context/SocketContext';
import { useActiveCourse } from '../../../context/ActiveCourseContext';
import { getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
import { getCourseTimeRemaining } from '../../../utils/courseAccessTime';
import {
  CATALOG_CATEGORY_FILTERS,
  CATALOG_LEVEL_FILTERS,
  filterCatalogCourses,
} from '../../../utils/courseCatalogFilter';
import CatalogFilterBar from './CatalogFilterBar';
import CourseEnrollmentModal from './CourseEnrollmentModal';
import CoursePreviewModal from './CoursePreviewModal';
import './catalogMarketplace.css';
import {
  EMPTY_MASCOT_URL,
  FEATURED_MALL_BANNER,
  HERO_MINI_BANNERS,
  HERO_SLIDES,
  TIER_STYLES,
} from './catalogMarketplaceData';

function formatPriceVnd(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 ? `${n.toLocaleString('vi-VN')}đ` : '';
}

function resolveCatalogImage(url, fallback = '') {
  const raw = String(url || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/mascot/')) return raw;
  return resolveMediaUrl(raw) || fallback;
}

function HeroOfficeBadges() {
  const badges = [
    { letter: 'W', bg: 'from-[#60A5FA] to-[#1D4ED8]', pos: '-top-2 right-0 rotate-[10deg]' },
    { letter: 'X', bg: 'from-[#34D399] to-[#047857]', pos: 'top-1/2 -right-3 -translate-y-1/2 -rotate-[8deg]' },
    { letter: 'P', bg: 'from-[#FB923C] to-[#EA580C]', pos: 'bottom-0 -left-1 -rotate-[12deg]' },
  ];
  return (
    <>
      {badges.map((b) => (
        <span
          key={b.letter}
          aria-hidden="true"
          className={`pointer-events-none absolute ${b.pos} flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-br ${b.bg} text-base sm:text-lg font-black text-white shadow-[0_12px_20px_-6px_rgba(15,23,42,0.35),inset_0_2px_3px_rgba(255,255,255,0.6)]`}
        >
          {b.letter}
        </span>
      ))}
    </>
  );
}

function MiniBannerGraphic({ visual, customImageUrl, title }) {
  const resolvedCustom = resolveCatalogImage(customImageUrl, '');
  if (resolvedCustom) {
    return (
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/18 border border-white/40 shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)]">
        <img
          src={resolvedCustom}
          alt={title || 'Banner minh họa'}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  if (visual === 'trophy') {
    return (
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/18 border border-white/35 shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)]">
        <svg viewBox="0 0 64 64" className="h-12 w-12 drop-shadow-md" aria-hidden="true">
          <defs>
            <linearGradient id="dew-trophy-cup" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E0F2FE" />
              <stop offset="55%" stopColor="#93C5FD" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <path d="M18 14h28v13c0 9-6.2 16-14 16s-14-7-14-16V14z" fill="url(#dew-trophy-cup)" stroke="#FFFFFF" strokeWidth="2.5" />
          <path d="M18 18H11c0 7 3 11 7 12M46 18h7c0 7-3 11-7 12" fill="none" stroke="#E0F2FE" strokeWidth="3" strokeLinecap="round" />
          <rect x="28" y="43" width="8" height="7" rx="2" fill="#DBEAFE" />
          <rect x="20" y="50" width="24" height="6" rx="3" fill="#93C5FD" stroke="#FFFFFF" strokeWidth="1.5" />
          <polygon points="32,20 34.4,25 39.8,25.7 35.8,29.5 36.8,34.8 32,32.2 27.2,34.8 28.2,29.5 24.2,25.7 29.6,25" fill="#FBBF24" />
        </svg>
      </div>
    );
  }
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/18 border border-white/35 shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)]">
      <svg viewBox="0 0 64 64" className="h-12 w-12 drop-shadow-md" aria-hidden="true">
        <rect x="10" y="10" width="44" height="44" rx="11" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
        <text x="17" y="27" fill="#FFFFFF" fontSize="13" fontWeight="900" fontFamily="sans-serif">Ex=</text>
        <rect x="17" y="38" width="6" height="10" rx="2" fill="#FEF08A" />
        <rect x="27" y="32" width="6" height="16" rx="2" fill="#FFFFFF" />
        <rect x="37" y="26" width="6" height="22" rx="2" fill="#A7F3D0" />
      </svg>
    </div>
  );
}

function CourseThumbnailGraphic({ cls, tierInfo }) {
  const track = String(cls.track || '').toLowerCase();
  const nameLower = String(cls.name || '').toLowerCase();
  const isExcel = track === 'excel' || nameLower.includes('excel') || cls.tier === 'nguoi-di-lam';
  const isWordPpt = track === 'word' || track === 'powerpoint' || nameLower.includes('word') || nameLower.includes('powerpoint');
  const isStudent = cls.tier === 'hs-sv';

  return (
    <div
      className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/80 shadow-[0_8px_18px_-8px_rgba(15,23,42,0.18),inset_0_2px_4px_rgba(255,255,255,0.6)]"
      style={{ background: tierInfo.thumbBg }}
    >
      {isExcel && !isWordPpt ? (
        <svg viewBox="0 0 110 70" className="h-14 w-22 drop-shadow-sm" aria-hidden="true">
          <rect x="8" y="10" width="94" height="50" rx="8" fill="#FFFFFF" fillOpacity="0.95" />
          <rect x="14" y="16" width="38" height="38" rx="4" fill="#D1FAE5" />
          <rect x="18" y="21" width="12" height="5" rx="1.5" fill="#059669" />
          <rect x="33" y="21" width="14" height="5" rx="1.5" fill="#34D399" />
          <rect x="18" y="30" width="29" height="4" rx="1.5" fill="#6EE7B7" />
          <rect x="18" y="38" width="29" height="4" rx="1.5" fill="#A7F3D0" />
          <rect x="58" y="32" width="8" height="20" rx="2" fill="#10B981" />
          <rect x="70" y="24" width="8" height="28" rx="2" fill="#059669" />
          <rect x="82" y="18" width="8" height="34" rx="2" fill="#F59E0B" />
        </svg>
      ) : isWordPpt ? (
        <svg viewBox="0 0 110 70" className="h-14 w-22 drop-shadow-sm" aria-hidden="true">
          <rect x="12" y="12" width="42" height="46" rx="6" fill="#FFFFFF" stroke="#93C5FD" strokeWidth="2" />
          <rect x="18" y="18" width="18" height="10" rx="2" fill="#2563EB" />
          <text x="22" y="26" fill="#FFFFFF" fontSize="8" fontWeight="900">W</text>
          <rect x="18" y="32" width="30" height="4" rx="2" fill="#CBD5E1" />
          <rect x="18" y="40" width="24" height="4" rx="2" fill="#CBD5E1" />
          <rect x="50" y="16" width="48" height="40" rx="7" fill="#FFF7ED" stroke="#FDBA74" strokeWidth="2" />
          <rect x="56" y="22" width="16" height="10" rx="2" fill="#EA580C" />
          <text x="61" y="30" fill="#FFFFFF" fontSize="8" fontWeight="900">P</text>
          <rect x="56" y="37" width="34" height="12" rx="3" fill="#FED7AA" />
        </svg>
      ) : isStudent ? (
        <svg viewBox="0 0 110 70" className="h-14 w-22 drop-shadow-sm" aria-hidden="true">
          <rect x="16" y="12" width="78" height="46" rx="8" fill="#EEF2FF" stroke="#FFFFFF" strokeWidth="2" />
          <rect x="22" y="18" width="40" height="28" rx="4" fill="#FFFFFF" />
          <rect x="27" y="23" width="14" height="14" rx="3" fill="#6366F1" />
          <rect x="45" y="24" width="13" height="4" rx="2" fill="#C7D2FE" />
          <rect x="45" y="31" width="10" height="4" rx="2" fill="#E0E7FF" />
          <rect x="66" y="18" width="22" height="16" rx="4" fill="#C4B5FD" />
          <rect x="66" y="38" width="22" height="8" rx="3" fill="#34D399" />
        </svg>
      ) : (
        <svg viewBox="0 0 110 70" className="h-14 w-22 drop-shadow-sm" aria-hidden="true">
          <rect x="16" y="12" width="54" height="36" rx="6" fill="#FFFFFF" stroke="#93C5FD" strokeWidth="2.5" />
          <rect x="21" y="17" width="44" height="26" rx="3" fill="#BAE6FD" />
          <rect x="37" y="48" width="12" height="6" rx="1" fill="#94A3B8" />
          <rect x="29" y="54" width="28" height="4" rx="2" fill="#64748B" />
          <rect x="75" y="20" width="20" height="36" rx="4" fill="#FDBA74" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="85" cy="48" r="2.5" fill="#FFFFFF" />
        </svg>
      )}
    </div>
  );
}

function MarketplaceCourseCard({
  cls,
  isOwned = false,
  onOpen,
  onEnterCourse,
  onTrial,
  onRegister,
  registeringId,
}) {
  const tierInfo = TIER_STYLES[cls.tier] || TIER_STYLES['cap-2'];
  const isFull = Boolean(isOwned || cls.accessLevel === 'full');
  const allowTrial = cls.allowTrial !== false;
  const allowReg = cls.allowRegistration !== false;
  const priceText = formatPriceVnd(cls.price);
  const originalPriceText = formatPriceVnd(cls.originalPrice);
  const isRegistering = registeringId === String(cls._id);
  const primaryBadge = cls.badge || tierInfo.cardTag || tierInfo.shortLabel;
  const durationMonths = Math.max(1, Number(cls.durationMonths) || 12);
  const includesMeet = cls.includesMeet !== false;
  const timeInfo = getCourseTimeRemaining(cls.accessExpiresAt);

  return (
    <article
      onClick={() => onOpen(cls)}
      className="dew-card dew-card-hover group flex h-full cursor-pointer flex-col justify-between p-4"
    >
      <div>
        <div className="flex items-start justify-between gap-2.5">
          <CourseThumbnailGraphic cls={cls} tierInfo={tierInfo} />
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${tierInfo.pillBg}`}>
              {primaryBadge}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${
                isFull
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {isFull ? (
                <>
                  <span>Đã sở hữu</span>
                  <Check size={10} strokeWidth={3} aria-hidden="true" />
                </>
              ) : (
                'Học thử'
              )}
            </span>
          </div>
        </div>

        <h3 className="mt-3 line-clamp-2 text-[14.5px] font-extrabold leading-snug text-slate-900 group-hover:text-emerald-700">
          {cls.name}
        </h3>

        {!isFull && priceText ? (
          <div className="mt-1.5 space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-extrabold text-emerald-700">{priceText}</span>
              {originalPriceText ? (
                <span className="text-[11px] font-semibold text-slate-400 line-through">
                  {originalPriceText}
                </span>
              ) : null}
            </div>
            <p className="text-[10.5px] font-bold text-slate-500">
              Gói {durationMonths} tháng{includesMeet ? ' · Có học Meet cùng GV' : ''}
            </p>
          </div>
        ) : (
          <div className="mt-1 space-y-1">
            <p className="line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
              {cls.shortDescription || tierInfo.curriculum}
            </p>
            {!isFull ? (
              <p className="text-[10.5px] font-bold text-slate-500">
                Gói {durationMonths} tháng{includesMeet ? ' · Có học Meet cùng GV' : ''}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-3.5 pt-1">
        {isFull ? (
          <div className="space-y-2">
            <div
              className={`flex flex-wrap items-center justify-between gap-1 rounded-xl border px-2.5 py-1.5 text-[10.5px] font-bold ${
                timeInfo.isExpiringSoon
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200/80 bg-emerald-50/90 text-emerald-800'
              }`}
            >
              <span className="inline-flex items-center gap-1 min-w-0">
                <Clock size={11} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{timeInfo.detailNote}</span>
              </span>
              {includesMeet ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-700 shrink-0">
                  <Video size={11} aria-hidden="true" />
                  Meet GV
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEnterCourse?.(cls);
              }}
              className="dew-btn-primary inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 text-xs font-extrabold cursor-pointer"
            >
              <Play size={12} fill="currentColor" aria-hidden="true" />
              <span>Vào học ngay</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {allowTrial ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrial?.(cls);
                }}
                className="dew-btn-white inline-flex flex-1 items-center justify-center px-3 py-2 text-xs cursor-pointer"
              >
                Học thử
              </button>
            ) : null}
            {allowReg ? (
              <button
                type="button"
                disabled={isRegistering}
                onClick={(e) => {
                  e.stopPropagation();
                  onRegister(cls);
                }}
                className="dew-btn-primary inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs disabled:opacity-60 cursor-pointer"
              >
                {isRegistering ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Đăng ký</span>
              </button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

export default function StudentCoursesCatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const coursesGridRef = useRef(null);
  const { currentUser } = useData() || {};
  const { socket } = useSocket();
  const {
    enrolledCourses,
    setActiveCourseId,
    startTrialCourse,
  } = useActiveCourse();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [catalogUi, setCatalogUi] = useState(null);
  const [referralDiscount, setReferralDiscount] = useState(null);
  const [previewAsAdmin, setPreviewAsAdmin] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [enrollingClass, setEnrollingClass] = useState(null);
  const [registeringId] = useState('');
  const [showAllCourses, setShowAllCourses] = useState(false);

  const [slideIndex, setSlideIndex] = useState(() => (HERO_SLIDES.length > 1 ? 1 : 0));
  const [slidePaused, setSlidePaused] = useState(false);

  const themeAttr = getDewSkillThemeAttr(currentUser);

  const loadCatalog = useCallback(async (silent = false) => {
    const isSilent = silent === true;
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const res = await dewskillClassApi.myVisible();
      setItems(Array.isArray(res.data) ? res.data : []);
      setPreviewAsAdmin(Boolean(res.meta?.previewAsAdmin));
      if (res.meta?.catalogUi) {
        setCatalogUi(res.meta.catalogUi);
      }
      setReferralDiscount(res.meta?.referralDiscount || null);
    } catch (err) {
      if (!isSilent) {
        setError(dewskillClassErrorMessage(err, 'Không tải được danh mục khóa học'));
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  const handleCloseEnrollmentModal = useCallback(() => {
    setEnrollingClass(null);
  }, []);

  const handleEnrollmentActivated = useCallback(() => {
    loadCatalog(true);
  }, [loadCatalog]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleCatalogUiUpdated = (nextUi) => {
      if (nextUi && typeof nextUi === 'object') {
        setCatalogUi(nextUi);
      }
    };
    const handleClassMembershipChanged = () => {
      loadCatalog(true);
    };
    socket.on('dewskill:catalog-ui-updated', handleCatalogUiUpdated);
    socket.on('dewskillClass:paid', handleClassMembershipChanged);
    socket.on('dewskillClass:expired', handleClassMembershipChanged);
    return () => {
      socket.off('dewskill:catalog-ui-updated', handleCatalogUiUpdated);
      socket.off('dewskillClass:paid', handleClassMembershipChanged);
      socket.off('dewskillClass:expired', handleClassMembershipChanged);
    };
  }, [socket, loadCatalog]);

  const heroSlides = useMemo(() => {
    const raw = Array.isArray(catalogUi?.heroSlides) ? catalogUi.heroSlides : HERO_SLIDES;
    const activeOnly = raw.filter((s) => s && s.isActive !== false);
    return activeOnly.length > 0 ? activeOnly : HERO_SLIDES;
  }, [catalogUi]);

  const miniBanners = useMemo(() => {
    if (!catalogUi || !Array.isArray(catalogUi.miniBanners)) return HERO_MINI_BANNERS;
    return catalogUi.miniBanners.filter((m) => m && m.isActive !== false).slice(0, 2);
  }, [catalogUi]);

  const featuredBanner = useMemo(() => ({
    ...FEATURED_MALL_BANNER,
    ctaPath: '/student/support',
    gradient: 'linear-gradient(180deg, #10B981 0%, #059669 52%, #0EA5E9 100%)',
    ...(catalogUi?.featuredBanner || {}),
  }), [catalogUi]);

  const showHeroSection = catalogUi?.showHeroSection !== false;
  const showFilterBar = catalogUi?.showFilterBar !== false;
  const showFeaturedBanner = catalogUi?.showFeaturedBanner !== false;
  const autoPlayMs = Math.min(20000, Math.max(2000, (Number(catalogUi?.autoPlaySeconds) || 5.5) * 1000));

  useEffect(() => {
    setSlideIndex((prev) => (prev >= heroSlides.length ? 0 : prev));
  }, [heroSlides.length]);

  useEffect(() => {
    const tierParam = searchParams.get('tier');
    if (tierParam && (tierParam === 'all' || TIER_STYLES[tierParam] || tierParam === 'my-courses')) {
      setSelectedCategory(tierParam);
      const next = new URLSearchParams(searchParams);
      next.delete('tier');
      setSearchParams(next, { replace: true });
      window.setTimeout(() => coursesGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const openClassId = searchParams.get('openClass');
    if (!openClassId || items.length === 0) return;
    const found = items.find((c) => String(c._id) === String(openClassId));
    if (found) {
      setSelectedClass(found);
      const next = new URLSearchParams(searchParams);
      next.delete('openClass');
      setSearchParams(next, { replace: true });
    }
  }, [items, searchParams, setSearchParams]);

  useEffect(() => {
    if (!showHeroSection || slidePaused || heroSlides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, autoPlayMs);
    return () => window.clearInterval(timer);
  }, [showHeroSection, slidePaused, heroSlides.length, autoPlayMs]);

  const scrollToCourses = () => {
    coursesGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRegisterClass = (cls) => {
    const cid = String(cls?._id || '');
    if (!cid) return;
    setSelectedClass(null);
    setEnrollingClass(cls);
  };

  const ownedIdSet = useMemo(
    () => new Set((enrolledCourses || []).filter((c) => c.status === 'owned').map((c) => String(c.id))),
    [enrolledCourses],
  );

  const myCourseIdSet = useMemo(() => {
    const next = new Set((enrolledCourses || []).map((c) => String(c.id)));
    items.forEach((cls) => {
      if (cls.accessLevel === 'full' && cls._id) next.add(String(cls._id));
    });
    return next;
  }, [enrolledCourses, items]);

  const filteredItems = useMemo(
    () => filterCatalogCourses(items, {
      selectedCategory,
      selectedLevel,
      searchQuery,
      myCourseIds: myCourseIdSet,
    }),
    [items, selectedCategory, selectedLevel, searchQuery, myCourseIdSet],
  );

  const hasActiveFilter = selectedCategory !== 'all' || selectedLevel !== 'all' || Boolean(searchQuery.trim());

  const resetAllFilters = () => {
    setSelectedCategory('all');
    setSelectedLevel('all');
    setSearchQuery('');
    setShowAllCourses(true);
  };

  const handleHeroSlideAction = (slide) => {
    if (slide.action?.type === 'tier' && slide.action.tier) {
      setSelectedCategory(slide.action.tier);
    }
    scrollToCourses();
  };

  const handleEnterCourse = (clsOrCourse) => {
    const id = String(clsOrCourse?._id || clsOrCourse?.id || '');
    if (id) setActiveCourseId(id);
    const firstTopic = clsOrCourse?.dailyPracticeTopicIds?.[0] || clsOrCourse?.topicIds?.[0];
    const topicId = String(firstTopic?._id || firstTopic?.id || firstTopic || '').trim();
    navigate(topicId ? `/student/daily-practice?topicId=${encodeURIComponent(topicId)}` : '/student/daily-practice');
  };

  const handleStartTrial = (cls) => {
    startTrialCourse(cls);
    setSelectedClass(cls);
  };

  const activeSlide = heroSlides[slideIndex] || heroSlides[0];
  const isDefaultAllView = !hasActiveFilter;
  const showFeaturedCard = isDefaultAllView && showFeaturedBanner;
  const visibleLimit = isDefaultAllView && !showAllCourses ? 4 : filteredItems.length;
  const displayedItems = filteredItems.slice(0, visibleLimit);
  const remainingCount = Math.max(0, filteredItems.length - displayedItems.length);

  const activeCategoryMeta = CATALOG_CATEGORY_FILTERS.find((c) => c.id === selectedCategory);
  const activeLevelMeta = CATALOG_LEVEL_FILTERS.find((l) => l.id === selectedLevel);

  return (
    <div data-theme={themeAttr} className="dew-marketplace-canvas min-h-full px-3 pt-2.5 pb-6 sm:px-5 sm:pt-3 sm:pb-8">
      {/* Giọt nước trang trí nền */}
      <span
        aria-hidden="true"
        className="dew-water-orb pointer-events-none absolute -top-6 right-16 hidden h-20 w-20 opacity-70 lg:block"
      />
      <span
        aria-hidden="true"
        className="dew-water-orb pointer-events-none absolute bottom-12 left-6 hidden h-14 w-14 opacity-60 lg:block"
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        {previewAsAdmin ? (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-2 text-xs font-semibold text-amber-900 shadow-xs">
            Bạn đang xem trước với tài khoản Quản trị (hiển thị toàn bộ lớp đang hoạt động). Học viên chỉ nhìn thấy các lớp được cấp quyền.
          </div>
        ) : null}

        {/* TẦNG 1 — CỤM BANNER QUẢNG CÁO TRÊN CÙNG */}
        {showHeroSection ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Banner Carousel Trái */}
            <div
              onMouseEnter={() => setSlidePaused(true)}
              onMouseLeave={() => setSlidePaused(false)}
              className={`dew-glossy-banner relative flex h-[340px] flex-col justify-between overflow-hidden rounded-[28px] p-6 text-white sm:h-[288px] sm:p-8 ${
                miniBanners.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'
              }`}
              style={{ background: activeSlide.gradient }}
            >
              {activeSlide.imageMode === 'cover' && activeSlide.mascotUrl ? (
                <>
                  <img
                    src={resolveCatalogImage(activeSlide.mascotUrl, HERO_SLIDES[0].mascotUrl)}
                    alt={activeSlide.title}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-900/45 to-slate-900/15"
                  />
                </>
              ) : null}

              <span
                aria-hidden="true"
                className="dew-water-orb pointer-events-none absolute right-8 top-6 h-10 w-10 opacity-45"
              />
              <span
                aria-hidden="true"
                className="dew-water-orb pointer-events-none absolute bottom-10 left-12 h-6 w-6 opacity-40"
              />

              {heroSlides.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Slide trước"
                    onClick={() => setSlideIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
                    className="absolute left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xs transition hover:bg-white/35 cursor-pointer"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label="Slide tiếp theo"
                    onClick={() => setSlideIndex((prev) => (prev + 1) % heroSlides.length)}
                    className="absolute right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xs transition hover:bg-white/35 cursor-pointer"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              ) : null}

              <div className="relative z-10 my-auto grid grid-cols-1 items-center gap-4 px-4 sm:grid-cols-12 sm:gap-5 sm:px-6">
                {activeSlide.imageMode !== 'cover' ? (
                  <div className="relative mx-auto flex h-32 w-32 items-center justify-center sm:col-span-5 sm:h-40 sm:w-40">
                    <img
                      src={resolveCatalogImage(activeSlide.mascotUrl, HERO_SLIDES[0].mascotUrl)}
                      alt={activeSlide.title}
                      className="h-full w-full object-contain drop-shadow-[0_16px_26px_rgba(6,78,59,0.28)]"
                    />
                    {activeSlide.showOfficeBadges ? <HeroOfficeBadges /> : null}
                  </div>
                ) : null}

                <div
                  className={`space-y-2.5 text-center sm:text-left ${
                    activeSlide.imageMode === 'cover' ? 'sm:col-span-12 sm:max-w-xl' : 'sm:col-span-7'
                  }`}
                >
                  <h2 className="line-clamp-2 text-2xl font-black leading-tight tracking-tight text-white drop-shadow-xs sm:text-3xl lg:text-[32px]">
                    {activeSlide.title}
                  </h2>
                  <p className="line-clamp-2 max-w-md text-xs font-medium leading-relaxed text-emerald-50/95 sm:text-sm">
                    {activeSlide.description}
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleHeroSlideAction(activeSlide)}
                      className="dew-btn-white inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm cursor-pointer"
                    >
                      <span>{activeSlide.ctaLabel}</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {heroSlides.length > 1 ? (
                <div className="relative z-10 mt-2 flex items-center justify-center gap-2">
                  {heroSlides.map((s, idx) => (
                    <button
                      key={s.id || idx}
                      type="button"
                      aria-label={`Chuyển đến slide ${idx + 1}`}
                      onClick={() => setSlideIndex(idx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === slideIndex ? 'w-6 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'
                      }`}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {/* 2 Mini Banner Phải */}
            {miniBanners.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:h-[288px] lg:grid-cols-1 lg:grid-rows-2">
                {miniBanners.map((mini) => (
                  <button
                    key={mini.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(mini.targetTier || 'all');
                      scrollToCourses();
                    }}
                    className="dew-glossy-banner flex h-[124px] items-center justify-between gap-3 rounded-[24px] p-5 text-left text-white lg:h-full cursor-pointer"
                    style={{ background: mini.gradient }}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-base font-black leading-snug sm:text-lg">{mini.title}</h3>
                      <p className="text-xs font-medium text-white/90">{mini.subtitle}</p>
                    </div>
                    <MiniBannerGraphic
                      visual={mini.visual}
                      customImageUrl={mini.customImageUrl}
                      title={mini.title}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* TẦNG 2 — BỘ LỌC CHỌN TRÌNH ĐỘ, CẤP HỌC & TÌM KIẾM */}
        {showFilterBar ? (
          <CatalogFilterBar
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            selectedLevel={selectedLevel}
            onSelectLevel={setSelectedLevel}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            className="mt-5"
          />
        ) : null}

        {/* TẦNG 3 — LƯỚI KHÓA HỌC PHÙ HỢP */}
        <section ref={coursesGridRef} className="mt-6 scroll-mt-4">
          {referralDiscount?.enabled !== false
          && referralDiscount?.applyToCourses !== false
          && Number(referralDiscount?.availableDiscountVnd) > 0 ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/95 via-white to-emerald-50/90 px-4 py-2.5 shadow-xs">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Gift size={15} aria-hidden="true" />
                </span>
                <span>
                  Bạn đang có ưu đãi giới thiệu giảm{' '}
                  <strong className="font-extrabold text-emerald-700">
                    {Number(referralDiscount.availableDiscountVnd).toLocaleString('vi-VN')}đ
                  </strong>
                  {' — tự động trừ trực tiếp vào số tiền VietQR khi đăng ký khóa học'}
                  {Number(referralDiscount.minOrderAmountVnd) > 0
                    ? ` (từ ${Number(referralDiscount.minOrderAmountVnd).toLocaleString('vi-VN')}đ)`
                    : ''}
                  .
                </span>
              </div>
              {referralDiscount.referredByCode ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-emerald-800">
                  Mã {referralDiscount.referredByCode}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-black uppercase tracking-wide text-slate-900 sm:text-lg">
                {String(catalogUi?.sectionTitle || '').trim() || 'KHÓA HỌC PHÙ HỢP'}
              </h2>
              {hasActiveFilter ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-0.5 text-xs font-bold text-emerald-800">
                  {[
                    activeCategoryMeta?.label,
                    selectedLevel !== 'all' ? activeLevelMeta?.label : '',
                    searchQuery.trim() ? `“${searchQuery.trim()}”` : '',
                  ].filter(Boolean).join(' · ')}
                  {' '}({filteredItems.length})
                </span>
              ) : null}
            </div>

            {hasActiveFilter ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="dew-card flex min-h-[240px] flex-col items-center justify-center gap-2.5 p-8 text-sm font-semibold text-slate-600">
              <Loader2 size={24} className="animate-spin text-emerald-600" />
              <span>Đang tải danh mục khóa học của bạn...</span>
            </div>
          ) : error ? (
            <div className="dew-card flex min-h-[240px] flex-col items-center justify-center gap-3 border-rose-200 bg-rose-50/90 p-6 text-center">
              <p className="text-sm font-bold text-rose-700">{error}</p>
              <button
                type="button"
                onClick={loadCatalog}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="dew-card flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center">
              <img src={EMPTY_MASCOT_URL} alt="DewSkill" className="h-24 w-24 object-contain" />
              <h3 className="mt-2 text-base font-extrabold text-slate-900">
                Chưa có lớp học nào được mở cho tài khoản của bạn
              </h3>
              <p className="mt-1 max-w-md text-xs font-medium leading-relaxed text-slate-500">
                Admin sẽ cấp quyền hiển thị các lớp học phù hợp với trình độ của bạn. Trong lúc chờ, bạn vẫn có thể vào khu Luyện tập chung.
              </p>
              <button
                type="button"
                onClick={() => navigate('/student/daily-practice')}
                className="dew-btn-primary mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 text-xs cursor-pointer"
              >
                <Gamepad2 size={14} />
                <span>Vào Luyện tập ngay</span>
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="dew-card flex min-h-[220px] flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
              <p className="text-sm font-bold text-slate-700">
                Chưa có lớp học nào phù hợp với bộ lọc hoặc từ khóa hiện tại.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="dew-btn-white px-4 py-2 text-xs font-bold text-emerald-700 cursor-pointer"
              >
                Xem tất cả khóa học
              </button>
            </div>
          ) : (
            <>
              <div
                className={
                  showFeaturedCard
                    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
                    : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                }
              >
                {showFeaturedCard ? (
                  <div
                    className="dew-glossy-banner flex h-full flex-col items-center justify-between rounded-[24px] p-5 text-center text-white"
                    style={{ background: featuredBanner.gradient }}
                  >
                    <div className="relative mt-1 flex h-28 w-28 items-center justify-center">
                      <img
                        src={resolveCatalogImage(featuredBanner.mascotUrl, FEATURED_MALL_BANNER.mascotUrl)}
                        alt={`${featuredBanner.titleLine1 || 'DewSkill'} ${featuredBanner.titleLine2 || 'Chọn lọc'}`}
                        className="h-full w-full object-contain drop-shadow-[0_14px_24px_rgba(6,78,59,0.28)]"
                      />
                    </div>

                    <div className="my-3 space-y-1.5">
                      <h3 className="text-xl font-black uppercase leading-tight tracking-wide text-white">
                        <span className="block">{featuredBanner.titleLine1}</span>
                        <span className="block">{featuredBanner.titleLine2}</span>
                      </h3>
                      <p className="mx-auto max-w-[200px] text-xs font-medium leading-relaxed text-emerald-50/95">
                        {featuredBanner.subtitle}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(featuredBanner.ctaPath || '/student/support')}
                      className="dew-btn-white inline-flex items-center gap-1.5 px-4 py-2 text-xs cursor-pointer"
                    >
                      <span>{featuredBanner.ctaLabel}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ) : null}

                {displayedItems.map((cls) => (
                  <MarketplaceCourseCard
                    key={cls._id}
                    cls={cls}
                    isOwned={ownedIdSet.has(String(cls._id))}
                    onOpen={setSelectedClass}
                    onEnterCourse={handleEnterCourse}
                    onTrial={handleStartTrial}
                    onRegister={handleRegisterClass}
                    registeringId={registeringId}
                  />
                ))}
              </div>

              {remainingCount > 0 ? (
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllCourses(true)}
                    className="dew-btn-white inline-flex items-center gap-1.5 px-5 py-2 text-xs cursor-pointer"
                  >
                    <span>Hiển thị thêm {remainingCount} khóa học</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <CoursePreviewModal
        cls={selectedClass}
        user={currentUser}
        onClose={() => setSelectedClass(null)}
        onRegister={handleRegisterClass}
        registeringId={registeringId}
        onGoTopic={(topicId) => {
          setSelectedClass(null);
          navigate(`/student/daily-practice?topicId=${encodeURIComponent(topicId)}`);
        }}
        onGoCertPrep={() => {
          setSelectedClass(null);
          navigate('/student/cert-prep');
        }}
        onGoDailyPractice={() => {
          setSelectedClass(null);
          navigate('/student/daily-practice');
        }}
      />

      <CourseEnrollmentModal
        open={Boolean(enrollingClass)}
        course={enrollingClass}
        user={currentUser}
        previewAsAdmin={previewAsAdmin}
        onClose={handleCloseEnrollmentModal}
        onActivated={handleEnrollmentActivated}
      />
    </div>
  );
}
