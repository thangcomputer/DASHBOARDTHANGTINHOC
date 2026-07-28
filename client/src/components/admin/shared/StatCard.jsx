import React from 'react';

/**
 * KPI card — MD3 / HIG compact metric tile (≈88–92px).
 * Props giữ nguyên: icon, label, value, sub, color, trend.
 */
export default function StatCard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <div className="cms-kpi-card group">
      <div className={`cms-kpi-icon ${color || 'bg-red-600'}`}>
        <Icon size={22} className="text-white" strokeWidth={2.25} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate leading-tight">
            {label}
          </p>
          {trend != null && (
            <span
              className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                trend > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="cms-kpi-value truncate">{value}</p>
        {sub && (
          <p className="text-[12px] sm:text-[13px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
