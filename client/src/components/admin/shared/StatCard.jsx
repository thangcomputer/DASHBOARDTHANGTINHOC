import React from 'react';

export default function StatCard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <div className="group bg-white rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100/50 flex items-start gap-4 sm:gap-5 hover:shadow-[0_20px_40px_rgba(220,38,38,0.08)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden min-w-0">
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:scale-110 transition-transform ${color}`} />
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${color} group-hover:rotate-6 transition-transform`}>
        <Icon size={26} className="text-white drop-shadow-md" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400 font-black uppercase tracking-widest">{label}</p>
          {trend != null && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="text-xl sm:text-2xl font-black text-gray-900 leading-tight truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1 font-bold italic">{sub}</p>}
      </div>
    </div>
  );
}
