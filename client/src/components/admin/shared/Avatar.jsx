import React from 'react';

export default function Avatar({ initials, color = 'bg-red-500' }) {
  return (
    <div
      className={`w-10 h-10 rounded-2xl ${color} flex items-center justify-center text-white text-[12px] font-black shadow-inner border-2 border-white/20`}
    >
      {initials}
    </div>
  );
}