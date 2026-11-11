import React from 'react';
import { Play } from 'lucide-react';
import Mascot from '../student/dailyPractice/Mascot';
import { DuoButton } from './DuoButton';

export function DuoHeroCard({
  playedToday = false,
  streak = 0,
  stageTitle = 'Chặng 1: Windows & Tin học căn bản',
  stageSubtitle,
  lessonSubtitle,
  progressPercent,
  progress,
  onPressContinue,
  onContinue,
  continueLabel,
  mascotReaction,
}) {
  const finalSubtitle = lessonSubtitle || stageSubtitle || 'Bắt đầu hành trình chinh phục kiến thức';
  const finalProgress = progressPercent ?? progress ?? 0;
  const finalOnContinue = onContinue || onPressContinue;
  const finalBtnLabel = continueLabel || (playedToday ? 'LUYỆN TẬP THÊM' : 'TIẾP TỤC HỌC');
  const mascotMood = mascotReaction || (playedToday ? 'happy' : streak > 0 ? 'determined' : 'studying');
  const pctDisplay = Math.min(100, Math.max(0, Math.round(finalProgress)));
  const barWidth = Math.min(100, Math.max(playedToday || finalProgress > 0 ? 5 : 0, finalProgress));

  return (
    <section className="duo-card flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-center gap-3.5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[20px] border border-emerald-100 bg-emerald-50">
          <Mascot mood={mascotMood} size={76} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <span className="inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black tracking-wide text-emerald-600">
            {playedToday ? 'ĐÃ HOÀN THÀNH HÔM NAY' : 'BÀI HỌC HIỆN TẠI'}
          </span>
          <h2 className="truncate text-base font-black text-slate-900">{stageTitle}</h2>
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-500">{finalSubtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${barWidth}%` }} />
        </div>
        <span className="w-9 text-right text-xs font-extrabold text-emerald-600">{pctDisplay}%</span>
      </div>
      <DuoButton
        variant={playedToday ? 'accent' : 'primary'}
        size="lg"
        fullWidth
        icon={<Play size={18} color="#FFFFFF" fill="#FFFFFF" aria-hidden="true" />}
        label={finalBtnLabel}
        onClick={finalOnContinue}
      />
    </section>
  );
}
