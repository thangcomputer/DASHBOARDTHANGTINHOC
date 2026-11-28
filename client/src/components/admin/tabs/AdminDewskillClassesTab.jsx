import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Gift,
  GraduationCap,
  Landmark,
  Laptop,
  Layers,
  LayoutGrid,
  Loader2,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Video,
} from 'lucide-react';
import CmsSelect from '../../ui/CmsSelect';
import dewskillClassApi, { dewskillClassErrorMessage } from '../../../services/dewskillClassApi';
import { useToast } from '../../../utils/useToast';
import { cmsConfirmAction } from '../../../utils/cmsDialog';
import { CATALOG_LEVEL_FILTERS, resolveCourseLevel } from '../../../utils/courseCatalogFilter';
import DewskillClassFormModal from '../dewskillClasses/DewskillClassFormModal';
import DewskillClassAccessManager from '../dewskillClasses/DewskillClassAccessManager';
import DewskillCatalogUiEditor from '../dewskillClasses/DewskillCatalogUiEditor';
import AdminReferralConfigPanel from '../subscription/AdminReferralConfigPanel';
import { LEVEL_META, TIER_META } from '../dewskillClasses/dewskillClassConstants';

const TIER_ICON_MAP = {
  'cap-1': { Icon: BookOpen, iconClass: 'text-teal-600' },
  'cap-2': { Icon: Laptop, iconClass: 'text-blue-600' },
  'cap-3': { Icon: GraduationCap, iconClass: 'text-indigo-600' },
  mos: { Icon: Award, iconClass: 'text-cyan-600' },
  'hs-sv': { Icon: Landmark, iconClass: 'text-violet-600' },
  'nguoi-di-lam': { Icon: Briefcase, iconClass: 'text-amber-600' },
  'chung-chi': { Icon: ShieldCheck, iconClass: 'text-rose-600' },
};

const COMPACT_VISIBILITY_OPTIONS = [
  { id: 'hidden', label: 'Ẩn (Nháp)' },
  { id: 'selected', label: 'Chỉ HV được cấp quyền' },
  { id: 'free_portal', label: 'Tài khoản miễn phí' },
  { id: 'all', label: 'Tất cả học viên' },
];

export default function AdminDewskillClassesTab() {
  const toast = useToast();

  const [subTab, setSubTab] = useState('classes'); // 'classes' | 'access' | 'catalog-ui'
  const [meta, setMeta] = useState(null);
  const [classes, setClasses] = useState([]);
  const [summary, setSummary] = useState({
    totalClasses: 0,
    hiddenCount: 0,
    selectedCount: 0,
    publicCount: 0,
    totalActiveGrants: 0,
    tierCounts: {},
  });
  const [loading, setLoading] = useState(true);

  const [tierFilter, setTierFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [savingClass, setSavingClass] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [busyQuickId, setBusyQuickId] = useState('');
  const [accessPreselectClassId, setAccessPreselectClassId] = useState('');

  const loadMeta = useCallback(async () => {
    try {
      const res = await dewskillClassApi.meta();
      setMeta(res.data || null);
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err, 'Không tải được cấu hình danh mục'));
    }
  }, [toast]);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dewskillClassApi.list({
        tier: tierFilter,
        visibilityMode: visibilityFilter,
        q: searchQuery.trim(),
      });
      setClasses(res.data?.items || []);
      if (res.data?.summary) setSummary(res.data.summary);
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err, 'Không tải được danh sách khóa học'));
    } finally {
      setLoading(false);
    }
  }, [tierFilter, visibilityFilter, searchQuery, toast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadClasses();
    }, 180);
    return () => clearTimeout(t);
  }, [loadClasses]);

  const levelCounts = useMemo(() => {
    const counts = { all: classes.length, basic: 0, intermediate: 0, advanced: 0 };
    for (const cls of classes) {
      const lvl = resolveCourseLevel(cls);
      if (counts[lvl] !== undefined) counts[lvl] += 1;
    }
    return counts;
  }, [classes]);

  const visibleClasses = useMemo(() => {
    if (!levelFilter || levelFilter === 'all') return classes;
    return classes.filter((cls) => resolveCourseLevel(cls) === levelFilter);
  }, [classes, levelFilter]);

  const hasActiveFilter = Boolean(tierFilter || levelFilter !== 'all' || visibilityFilter || searchQuery.trim());

  const resetFilters = () => {
    setTierFilter('');
    setLevelFilter('all');
    setVisibilityFilter('');
    setSearchQuery('');
  };

  const handleSeedDefaults = async () => {
    const ok = await cmsConfirmAction(
      'Hệ thống sẽ thêm các khóa học khung mẫu (Lớp 1–12 KNTT, MOS, Sinh viên, Người đi làm) chưa có trong danh sách. Mọi khóa mới tạo đều để mặc định "Ẩn (Nháp)".',
      {
        title: 'Tạo bộ khung khóa học mẫu',
        type: 'info',
        confirmText: 'Tạo khung mẫu',
      }
    );
    if (!ok) return;

    setSeeding(true);
    try {
      const res = await dewskillClassApi.seedDefaults();
      toast.success(res.message || 'Đã cập nhật khung mẫu khóa học');
      await loadClasses();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err));
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveClass = async (payload) => {
    setSavingClass(true);
    try {
      if (editingClass?._id) {
        await dewskillClassApi.update(editingClass._id, payload);
        toast.success('Đã cập nhật khóa học DewSkill');
      } else {
        await dewskillClassApi.create(payload);
        toast.success('Đã tạo khóa học DewSkill mới');
      }
      setModalOpen(false);
      setEditingClass(null);
      await loadClasses();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err));
    } finally {
      setSavingClass(false);
    }
  };

  const handleQuickVisibility = async (cls, nextMode) => {
    setBusyQuickId(String(cls._id));
    try {
      await dewskillClassApi.updateVisibility(cls._id, { visibilityMode: nextMode });
      toast.success(`Đã đổi hiển thị cho "${cls.name}"`);
      await loadClasses();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err));
    } finally {
      setBusyQuickId('');
    }
  };

  const handleQuickLevel = async (cls, nextLevel) => {
    setBusyQuickId(String(cls._id));
    try {
      await dewskillClassApi.update(cls._id, { level: nextLevel });
      const label = nextLevel ? LEVEL_META[nextLevel]?.label || nextLevel : 'Tự động';
      toast.success(`Đã đổi trình độ "${cls.name}" thành ${label}`);
      await loadClasses();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err));
    } finally {
      setBusyQuickId('');
    }
  };

  const handleQuickTier = async (cls, nextTier) => {
    if (!nextTier || nextTier === cls.tier) return;
    setBusyQuickId(String(cls._id));
    try {
      await dewskillClassApi.update(cls._id, { tier: nextTier, grade: null });
      const label = TIER_META[nextTier]?.shortLabel || nextTier;
      toast.success(`Đã chuyển "${cls.name}" sang đối tượng ${label}`);
      await loadClasses();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err));
    } finally {
      setBusyQuickId('');
    }
  };

  const handleDeleteClass = async (cls) => {
    const ok = await cmsConfirmAction(
      `Xóa khóa học "${cls.name}"? Các phân quyền hiển thị gắn với khóa này cũng sẽ bị gỡ bỏ.`,
      {
        title: 'Xóa khóa học DewSkill',
        type: 'danger',
        confirmText: 'Xóa khóa học',
      }
    );
    if (!ok) return;

    try {
      await dewskillClassApi.remove(cls._id);
      toast.success('Đã xóa khóa học DewSkill');
      await loadClasses();
    } catch (err) {
      toast.error(dewskillClassErrorMessage(err));
    }
  };

  const jumpToAccessForClass = (cls) => {
    setAccessPreselectClassId(String(cls._id));
    setSubTab('access');
  };

  const tiers = meta?.tiers || [];
  const activeDisplayCount = (summary.publicCount || 0) + (summary.selectedCount || 0);

  return (
    <div className="space-y-4">
      {/* Header & KPI */}
      <div className="cms-card space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700">
                <Layers size={12} />
                DewSkill · Quản lý khóa học
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                Đồng bộ 1-1 với bộ lọc Đối tượng &amp; Trình độ bên học viên
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-extrabold text-slate-900">
              Quản lý khóa học DewSkill
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cấu hình nhanh Đối tượng, Trình độ (Cơ bản / Trung cấp / Nâng cao) và Quyền hiển thị ngay trên từng dòng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedDefaults}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {seeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>Tạo bộ khung mẫu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingClass(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus size={15} />
              <span>Tạo khóa học mới</span>
            </button>
          </div>
        </div>

        {/* 4 compact KPIs */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
            <div className="text-[11px] font-bold text-slate-500">Tổng khóa học</div>
            <div className="mt-0.5 text-lg font-extrabold text-slate-900 tabular-nums">
              {summary.totalClasses}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-2.5">
            <div className="text-[11px] font-bold text-emerald-800">Đang hiển thị</div>
            <div className="mt-0.5 text-lg font-extrabold text-emerald-900 tabular-nums">
              {activeDisplayCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
            <div className="text-[11px] font-bold text-slate-500">Đang ẩn (Nháp)</div>
            <div className="mt-0.5 text-lg font-extrabold text-slate-700 tabular-nums">
              {summary.hiddenCount}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
            <div className="text-[11px] font-bold text-amber-800">Lượt cấp quyền</div>
            <div className="mt-0.5 text-lg font-extrabold text-amber-900 tabular-nums">
              {summary.totalActiveGrants}
            </div>
          </div>
        </div>

        {/* 3 sub-tabs */}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setSubTab('classes')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              subTab === 'classes'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers size={14} />
            <span>Danh sách khóa học ({summary.totalClasses})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('access')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              subTab === 'access'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users size={14} />
            <span>Phân quyền học viên ({summary.totalActiveGrants})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('catalog-ui')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              subTab === 'catalog-ui'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Palette size={14} />
            <span>Giao diện Danh mục</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('referral')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              subTab === 'referral'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Gift size={14} />
            <span>Ưu đãi giới thiệu</span>
          </button>
        </div>
      </div>

      {subTab === 'classes' ? (
        <div className="space-y-4">
          {/* Thanh bộ lọc 2 hàng chuẩn 1-1 trang Học viên */}
          <div className="cms-card space-y-3.5">
            {/* Hàng 1: Đối tượng */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTierFilter('')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition ${
                  tierFilter === ''
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:text-emerald-800'
                }`}
              >
                <LayoutGrid size={14} className={tierFilter === '' ? 'text-white' : 'text-emerald-600'} />
                <span>Tất cả</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
                    tierFilter === '' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {summary.totalClasses}
                </span>
              </button>

              {tiers.map((t) => {
                const active = tierFilter === t.id;
                const iconMeta = TIER_ICON_MAP[t.id] || { Icon: Layers, iconClass: 'text-slate-500' };
                const TierIcon = iconMeta.Icon;
                const displayLabel = TIER_META[t.id]?.shortLabel || t.shortLabel || t.label;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTierFilter(t.id)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition ${
                      active
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:text-emerald-800'
                    }`}
                  >
                    <TierIcon size={14} className={active ? 'text-white' : iconMeta.iconClass} />
                    <span>{displayLabel}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {summary.tierCounts?.[t.id] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="h-px bg-slate-100" />

            {/* Hàng 2: Trình độ (Segmented Control) + Hiển thị + Tìm kiếm */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Trình độ (khớp bộ lọc học viên)
                </div>
                <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/80 p-1">
                  {CATALOG_LEVEL_FILTERS.map((lvl) => {
                    const active = levelFilter === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setLevelFilter(lvl.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                          active
                            ? 'border border-emerald-200/80 bg-white text-emerald-800 shadow-sm'
                            : 'border border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {lvl.id !== 'all' && LEVEL_META[lvl.id] ? (
                          <span className={`h-2 w-2 rounded-full ${LEVEL_META[lvl.id].dotClass}`} />
                        ) : null}
                        <span>{lvl.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
                            active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200/70 text-slate-500'
                          }`}
                        >
                          {levelCounts[lvl.id] ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <CmsSelect
                    value={visibilityFilter}
                    aria-label="Lọc theo chế độ hiển thị"
                    className="!py-2 !text-xs bg-white"
                    onChange={(e) => setVisibilityFilter(e.target.value)}
                  >
                    <option value="">Mọi hiển thị</option>
                    {COMPACT_VISIBILITY_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </CmsSelect>
                </div>

                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên khóa học..."
                    className="w-48 sm:w-56 rounded-full border border-slate-200 bg-slate-50/80 py-2 pl-8 pr-3 text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </div>

                {hasActiveFilter ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    <RotateCcw size={12} />
                    <span>Đặt lại</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Danh sách dạng bảng gọn sạch */}
          {loading ? (
            <div className="cms-card inline-flex w-full items-center justify-center gap-2 py-12 text-xs text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Đang tải danh sách khóa học...
            </div>
          ) : visibleClasses.length === 0 ? (
            <div className="cms-card rounded-2xl border border-dashed border-slate-200 py-12 text-center space-y-2.5">
              <p className="text-sm font-bold text-slate-700">
                {hasActiveFilter
                  ? 'Không tìm thấy khóa học khớp bộ lọc hiện tại.'
                  : 'Chưa có khóa học nào trong danh mục DewSkill.'}
              </p>
              <p className="text-xs text-slate-500">
                {hasActiveFilter
                  ? 'Thử chọn lại Đối tượng, Trình độ hoặc bấm Đặt lại bộ lọc.'
                  : 'Bạn có thể bấm "Tạo bộ khung mẫu" để khởi tạo nhanh hoặc "Tạo khóa học mới".'}
              </p>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw size={13} />
                  <span>Xem tất cả khóa học</span>
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-100">
              {/* Desktop header */}
              <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_148px_185px_165px_auto] items-center gap-3 bg-slate-50/90 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                <div>Khóa học</div>
                <div>Đối tượng</div>
                <div>Trình độ (khớp HV)</div>
                <div>Hiển thị</div>
                <div className="text-right">Thao tác</div>
              </div>

              {visibleClasses.map((cls) => {
                const rowBusy = busyQuickId === String(cls._id);
                const linkedTopics = cls.dailyPracticeTopicIds || [];
                const linkedCerts = cls.certPrepCourseIds || [];
                const effectiveLevel = resolveCourseLevel(cls);
                const levelInfo = LEVEL_META[effectiveLevel] || LEVEL_META.intermediate;
                const isAutoLevel = !cls.level;
                const durationMonths = Number(cls.durationMonths) > 0 ? Number(cls.durationMonths) : 12;

                return (
                  <div
                    key={cls._id}
                    className="grid grid-cols-1 gap-3 px-4 py-3.5 transition hover:bg-slate-50/60 lg:grid-cols-[minmax(0,1fr)_148px_185px_165px_auto] lg:items-center"
                  >
                    {/* Cột 1: Tên & thông tin cốt lõi (không nhồi chip) */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-extrabold text-slate-900">
                          {cls.name}
                        </h3>
                        {cls.code ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                            {cls.code}
                          </span>
                        ) : null}
                        {!cls.isActive ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            Tạm ngưng
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                        <span
                          className={`font-bold ${
                            Number(cls.price) > 0 ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {Number(cls.price) > 0
                            ? `${Number(cls.price).toLocaleString('vi-VN')}đ`
                            : 'Chưa đặt giá'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                          Gói {durationMonths} tháng
                          {cls.includesMeet !== false ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-700" title="Có kèm buổi học Google Meet với giáo viên">
                              <Video size={11} /> Meet GV
                            </span>
                          ) : null}
                        </span>
                        <span className="text-slate-300">·</span>
                        {linkedTopics.length > 0 || linkedCerts.length > 0 ? (
                          <span className="inline-flex items-center gap-2 font-medium text-slate-600">
                            {linkedTopics.length > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <BookOpen size={11} className="text-emerald-600" />
                                {linkedTopics.length} chủ đề
                              </span>
                            ) : null}
                            {linkedCerts.length > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <Trophy size={11} className="text-amber-600" />
                                {linkedCerts.length} phòng thi
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-amber-700/90 font-medium">Chưa gắn bài học</span>
                        )}
                      </div>
                    </div>

                    {/* Cột 2: Đối tượng (Inline Select) */}
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase text-slate-400 lg:hidden">
                        Đối tượng
                      </div>
                      <CmsSelect
                        value={cls.tier}
                        disabled={rowBusy}
                        aria-label={`Đối tượng ${cls.name}`}
                        className="!py-1.5 !px-2.5 !text-xs bg-slate-50"
                        onChange={(e) => handleQuickTier(cls, e.target.value)}
                      >
                        {tiers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {TIER_META[t.id]?.shortLabel || t.shortLabel}
                          </option>
                        ))}
                      </CmsSelect>
                    </div>

                    {/* Cột 3: Trình độ (Inline Select + trạng thái tự động/chỉ định) */}
                    <div className="space-y-1">
                      <div className="mb-1 text-[10px] font-bold uppercase text-slate-400 lg:hidden">
                        Trình độ
                      </div>
                      <CmsSelect
                        value={cls.level || ''}
                        disabled={rowBusy}
                        aria-label={`Trình độ ${cls.name}`}
                        className="!py-1.5 !px-2.5 !text-xs bg-white"
                        onChange={(e) => handleQuickLevel(cls, e.target.value)}
                      >
                        <option value="">Tự động ({levelInfo.label})</option>
                        <option value="basic">Cơ bản</option>
                        <option value="intermediate">Trung cấp</option>
                        <option value="advanced">Nâng cao</option>
                      </CmsSelect>
                      <div className="flex items-center gap-1.5 px-0.5 text-[11px] font-semibold text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${levelInfo.dotClass}`} />
                        <span>
                          {isAutoLevel ? `Tự nhận: ${levelInfo.label}` : `Cố định: ${levelInfo.label}`}
                        </span>
                      </div>
                    </div>

                    {/* Cột 4: Hiển thị (Inline Select) */}
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase text-slate-400 lg:hidden">
                        Hiển thị
                      </div>
                      <CmsSelect
                        value={cls.visibilityMode}
                        disabled={rowBusy}
                        aria-label={`Chế độ hiển thị ${cls.name}`}
                        className="!py-1.5 !px-2.5 !text-xs bg-white"
                        onChange={(e) => handleQuickVisibility(cls, e.target.value)}
                      >
                        {COMPACT_VISIBILITY_OPTIONS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </CmsSelect>
                    </div>

                    {/* Cột 5: Thao tác */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => jumpToAccessForClass(cls)}
                        title="Cấp quyền hiển thị theo từng học viên"
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
                      >
                        <Users size={13} />
                        <span>HV ({cls.grantedStudentCount || 0})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingClass(cls);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Pencil size={13} />
                        <span>Sửa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteClass(cls)}
                        className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50/70 p-1.5 text-rose-700 transition hover:bg-rose-100"
                        aria-label={`Xóa khóa ${cls.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : subTab === 'access' ? (
        <DewskillClassAccessManager
          classes={classes}
          meta={meta}
          preselectedClassId={accessPreselectClassId}
          onChanged={loadClasses}
          toast={toast}
        />
      ) : subTab === 'referral' ? (
        <AdminReferralConfigPanel />
      ) : (
        <DewskillCatalogUiEditor toast={toast} />
      )}

      <DewskillClassFormModal
        open={modalOpen}
        initialData={editingClass}
        meta={meta}
        saving={savingClass}
        onClose={() => {
          setModalOpen(false);
          setEditingClass(null);
        }}
        onSubmit={handleSaveClass}
      />
    </div>
  );
}
