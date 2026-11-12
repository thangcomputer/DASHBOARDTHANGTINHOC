'use client';

import React from 'react';
import { cn } from "@/lib/utils";

interface KineticDotsLoaderProps {
  className?: string;
  dots?: number;
  message?: string;
  tone?: 'green' | 'emerald' | 'emerald-cyan' | 'cyan-blue' | 'brand';
}

export default function KineticDotsLoader({
  className,
  dots = 4,
  message,
  tone = 'emerald',
}: KineticDotsLoaderProps) {
  const isCyan = tone === 'cyan-blue';

  const ballGradient = isCyan
    ? 'bg-gradient-to-b from-cyan-300 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.6)]'
    : 'bg-gradient-to-b from-emerald-300 via-emerald-400 to-teal-600 shadow-[0_0_16px_rgba(16,185,129,0.75)]';

  const rippleColor = isCyan ? 'border-cyan-500/30' : 'border-emerald-500/40';
  const shadowColor = isCyan ? 'bg-cyan-500/40' : 'bg-emerald-500/45';

  return (
    <div className={cn('flex flex-col items-center justify-center min-h-[160px] p-6 bg-slate-950/0 select-none', className)}>
      <div className='flex gap-5'>
        {[...Array(dots)].map((_, i) => (
          <div
            key={i}
            className='relative flex flex-col items-center justify-end h-20 w-6'
          >
            {/* 1. THE BOUNCING DOT */}
            <div
              className='relative w-5 h-5 z-10'
              style={{
                animation: 'gravity-bounce 1.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
                animationDelay: `${i * 0.15}s`,
                willChange: 'transform'
              }}
            >
              <div 
                className={cn('w-full h-full rounded-full', ballGradient)}
                style={{
                  animation: 'rubber-morph 1.4s linear infinite',
                  animationDelay: `${i * 0.15}s`,
                  willChange: 'transform'
                }} 
              />
              
              {/* Specular highlight for liquid look */}
              <div className='absolute top-1 left-1 w-1.5 h-1.5 bg-white/70 rounded-full blur-[0.5px]' />
            </div>

            {/* 2. FLOOR RIPPLE (Shockwave on impact) */}
            <div 
               className={cn('absolute bottom-0 w-10 h-3 border rounded-[100%] opacity-0', rippleColor)}
               style={{
                 animation: 'ripple-expand 1.4s linear infinite',
                 animationDelay: `${i * 0.15}s`,
               }}
            />

            {/* 3. REFLECTIVE SHADOW */}
            <div 
              className={cn('absolute -bottom-1 w-5 h-1.5 rounded-[100%] blur-sm', shadowColor)}
              style={{
                animation: 'shadow-breathe 1.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          </div>
        ))}
      </div>

      {message && (
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-500 animate-pulse">
          {message}
        </p>
      )}

      <style>{`
        /* * 1. Gravity Bounce
         * Simulates the object falling and jumping up.
         * 0% = Ground (Hit)
         * 50% = Peak Height (Slowest)
         * 100% = Ground (Hit)
         */
        @keyframes gravity-bounce {
          0% { transform: translateY(0); animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1); } /* Hit ground, start jump fast */
          50% { transform: translateY(-40px); animation-timing-function: cubic-bezier(0.32, 0, 0.67, 0); } /* Hover at top, start fall slow */
          100% { transform: translateY(0); } /* Hit ground */
        }

        /* * 2. Rubber Morph (Squash & Stretch)
         * We decouple this from the translation to have finer control over the shape.
         */
        @keyframes rubber-morph {
          0% { transform: scale(1.4, 0.6); } /* Impact: Squashed flat */
          5% { transform: scale(0.9, 1.1); } /* Rebound: Slight stretch */
          15% { transform: scale(1, 1); }    /* Normal shape rising */
          50% { transform: scale(1, 1); }    /* Peak: Perfect sphere */
          85% { transform: scale(0.9, 1.1); } /* Falling: Stretch */
          100% { transform: scale(1.4, 0.6); } /* Impact: Squashed flat */
        }

        /* * 3. Shadow Breathe
         * Shadow shrinks and fades when object is high.
         */
        @keyframes shadow-breathe {
          0% { transform: scale(1.4); opacity: 0.6; }
          50% { transform: scale(0.5); opacity: 0.1; }
          100% { transform: scale(1.4); opacity: 0.6; }
        }

        /* * 4. Ripple Expand
         * Only appears briefly at 0% and 100% when the ball hits.
         */
        @keyframes ripple-expand {
          0% { transform: scale(0.5); opacity: 0; border-width: 4px; }
          5% { opacity: 0.8; }
          30% { transform: scale(1.5); opacity: 0; border-width: 0px; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
