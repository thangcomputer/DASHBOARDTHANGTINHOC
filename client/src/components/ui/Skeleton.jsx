/**
 * Bộ Skeleton UI dùng hiệu ứng shimmer trên GPU để giữ vững bố cục (CLS = 0)
 * thay cho spinner gây cảm giác giật khi chuyển tab hoặc tải dữ liệu.
 */
export function Skeleton({ className = '', rounded = 'rounded-xl' }) {
  return (
    <div
      aria-hidden="true"
      className={`cms-skeleton relative overflow-hidden bg-slate-200/75 ${rounded} ${className}`}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3.5 w-24" rounded="rounded-md" />
          <Skeleton className="h-7 w-20" rounded="rounded-lg" />
          <Skeleton className="h-3 w-32" rounded="rounded-md" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0" rounded="rounded-2xl" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6, columns = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' }) {
  return (
    <div className={`grid gap-4 ${columns}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
          <Skeleton className="h-36 w-full" rounded="rounded-xl" />
          <Skeleton className="h-5 w-3/4" rounded="rounded-lg" />
          <Skeleton className="h-3.5 w-1/2" rounded="rounded-md" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-4 w-20" rounded="rounded-md" />
            <Skeleton className="h-9 w-24" rounded="rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm" aria-hidden="true">
      <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-3.5 w-4/5" rounded="rounded-md" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3.5 grid gap-3 items-center" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-5/6' : 'w-2/3'}`} rounded="rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TabContentSkeleton({ stats = 4, rows = 5 }) {
  return (
    <div className="space-y-5 w-full" aria-hidden="true">
      {stats > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: stats }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      )}
      <TableSkeleton rows={rows} cols={4} />
    </div>
  );
}

