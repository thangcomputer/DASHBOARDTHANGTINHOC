import { useRef } from 'react';
import {
  Award,
  Bookmark,
  BookOpen,
  Briefcase,
  ChevronsUp,
  GraduationCap,
  Landmark,
  Laptop,
  Layers,
  LayoutGrid,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { CATALOG_CATEGORY_FILTERS, CATALOG_LEVEL_FILTERS } from '../../../utils/courseCatalogFilter';

const CATEGORY_ICON_META = {
  all: {
    Icon: LayoutGrid,
    idleClass: 'text-emerald-600 fill-emerald-500/20',
  },
  'my-courses': {
    Icon: Bookmark,
    idleClass: 'text-emerald-600 fill-emerald-500/85',
  },
  'cap-1': {
    Icon: BookOpen,
    idleClass: 'text-teal-600 fill-teal-500/25',
  },
  'cap-2': {
    Icon: Laptop,
    idleClass: 'text-blue-600 fill-blue-500/20',
  },
  'cap-3': {
    Icon: GraduationCap,
    idleClass: 'text-indigo-600 fill-indigo-500/25',
  },
  mos: {
    Icon: Award,
    idleClass: 'text-cyan-600 fill-cyan-500/20',
  },
  'hs-sv': {
    Icon: Landmark,
    idleClass: 'text-violet-600 fill-violet-500/20',
  },
  'nguoi-di-lam': {
    Icon: Briefcase,
    idleClass: 'text-amber-600 fill-amber-500/30',
  },
};

const LEVEL_ICON_META = {
  all: Sparkles,
  basic: TrendingUp,
  intermediate: Layers,
  advanced: ChevronsUp,
};

/**
 * Thanh bộ lọc trang Danh mục khóa học DewSkill theo phong cách tối giản chuẩn SaaS.
 */
export default function CatalogFilterBar({
  selectedCategory = 'all',
  onSelectCategory,
  selectedLevel = 'all',
  onSelectLevel,
  searchQuery = '',
  onSearchChange,
  className = '',
}) {
  const searchInputRef = useRef(null);

  return (
    <section
      aria-label="Bộ lọc khóa học"
      className={`rounded-[24px] bg-white/88 backdrop-blur-xl border border-white p-5 shadow-[0_14px_34px_-12px_rgba(15,23,42,0.08),inset_0_2px_0_#fff] space-y-4 ${className}`}
    >
      {/* Hàng 1 — 8 pill ngang Đối tượng */}
      <div className="flex flex-wrap items-center gap-2.5">
        {CATALOG_CATEGORY_FILTERS.map((cat) => {
          const active = selectedCategory === cat.id;
          const meta = CATEGORY_ICON_META[cat.id] || CATEGORY_ICON_META.all;
          const IconComponent = meta.Icon;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectCategory?.(cat.id)}
              className={`h-10 px-4 rounded-full inline-flex items-center gap-2 text-sm font-semibold transition cursor-pointer ${
                active
                  ? 'bg-gradient-to-b from-[#0D9488] to-[#047857] text-white shadow-[0_8px_18px_-4px_rgba(4,120,87,0.45),inset_0_1.5px_0_rgba(255,255,255,0.4)]'
                  : 'bg-white/95 border border-slate-100 text-slate-700 shadow-sm hover:border-emerald-200 hover:text-emerald-800'
              }`}
            >
              <IconComponent
                aria-hidden="true"
                className={`w-4 h-4 shrink-0 ${active ? 'text-white fill-white/20' : meta.idleClass}`}
              />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Đường kẻ chia mảnh */}
      <div className="h-px bg-slate-200/70" />

      {/* Hàng 2 — Trình độ (Segmented Control) + Tìm kiếm */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-full">
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-1.5">
            TRÌNH ĐỘ
          </div>
          <div
            role="group"
            aria-label="Lọc theo trình độ"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-full bg-slate-100/80 border border-slate-200/70"
          >
            {CATALOG_LEVEL_FILTERS.map((lvl) => {
              const active = selectedLevel === lvl.id;
              const LevelIcon = LEVEL_ICON_META[lvl.id] || Sparkles;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectLevel?.(lvl.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs sm:text-[13px] transition cursor-pointer ${
                    active
                      ? 'bg-white text-emerald-800 font-bold shadow-sm border border-emerald-200/80'
                      : 'border border-transparent font-semibold text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LevelIcon
                    aria-hidden="true"
                    className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-emerald-600' : 'text-slate-400'}`}
                  />
                  <span>{lvl.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-full bg-slate-50/90 border border-slate-200/80 pl-4 pr-1.5 py-1.5 flex items-center gap-2 w-full sm:w-72 focus-within:bg-white focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100 transition">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Tìm kiếm khóa học..."
            aria-label="Tìm kiếm khóa học"
            className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Xóa từ khóa tìm kiếm"
              onClick={() => {
                onSearchChange?.('');
                searchInputRef.current?.focus();
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Tìm kiếm"
            onClick={() => searchInputRef.current?.focus()}
            className="w-8 h-8 rounded-full bg-[#065F46] text-white flex items-center justify-center shrink-0 hover:bg-[#047857] transition cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
