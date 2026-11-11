import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Route } from 'lucide-react';
import { unitColor } from '../../utils/dailyPractice';
import { collectUnitVideos, UnitStageHeader } from '../student/dailyPractice/PathUnitStageHeader';
import { UnitStageChest } from '../student/dailyPractice/UnitStageChest';
import { DuoButton } from './DuoButton';

export function DuoPathStagesCard({ pathTopic, loading = false, onPathRefresh }) {
  const navigate = useNavigate();
  const units = pathTopic?.units || [];
  const topicId = pathTopic?.topic?.id || '';

  if (loading) {
    return (
      <section className="duo-card flex flex-col gap-2.5 p-3.5" aria-busy="true">
        <p className="text-sm font-black text-slate-900">Các chặng</p>
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (!units.length) {
    return (
      <section className="duo-card flex flex-col gap-2.5 p-3.5">
        <p className="text-sm font-black text-slate-900">Lộ trình chặng</p>
        <p className="text-xs text-slate-500">Chưa có chặng học — vào Luyện tập để tải lộ trình.</p>
        <DuoButton
          variant="primary"
          size="sm"
          className="self-start"
          icon={<Route size={14} color="#FFFFFF" aria-hidden="true" />}
          label="Mở lộ trình"
          onClick={() => navigate('/student/daily-practice')}
        />
      </section>
    );
  }

  const nextUnitId = pathTopic?.next?.unitId || '';

  const openPath = (extra = {}) => {
    const q = new URLSearchParams({ mode: 'path', ...(topicId ? { topicId } : {}), ...extra });
    navigate(`/student/daily-practice?${q.toString()}`);
  };

  return (
    <section className="duo-card flex flex-col gap-2.5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Route size={16} className="text-emerald-600" aria-hidden="true" />
          Các chặng
          {pathTopic?.topic?.name ? (
            <span className="truncate text-xs font-semibold text-slate-500">· {pathTopic.topic.name}</span>
          ) : null}
        </h3>
        <span className="shrink-0 text-[11px] font-extrabold text-slate-500 tabular-nums">
          {pathTopic?.completedUnits || 0}/{pathTopic?.totalUnits || units.length}
        </span>
      </div>
      <ul className="flex max-h-[min(52vh,420px)] flex-col gap-2 overflow-y-auto pr-0.5">
        {units.map((unit) => {
          const hasVideo = Boolean(unit.lesson) || collectUnitVideos(unit).length > 0;
          const isNext = unit.id === nextUnitId;
          return (
            <li key={unit.id} className="space-y-2">
              <UnitStageHeader
                unit={unit}
                color={unitColor(unit.index)}
                highlight={isNext}
                hasVideo={hasVideo}
                onWatch={() => openPath({ watch: 'stage', ...(unit.id ? { unitId: unit.id } : {}) })}
                onTestOut={() => openPath({ ...(unit.id ? { unitId: unit.id } : {}), testOut: '1' })}
              />
              <UnitStageChest unit={unit} className="mx-auto" onClaimed={() => onPathRefresh?.()} />
            </li>
          );
        })}
      </ul>
      <DuoButton
        variant="accent"
        size="sm"
        fullWidth
        icon={<Route size={14} color="#FFFFFF" aria-hidden="true" />}
        label="Xem toàn bộ lộ trình"
        onClick={() => openPath()}
      />
    </section>
  );
}
