/** Grade color scale: >=8 green, >=5 yellow, <5 red (scale /10) */
export function getGradeTier(grade) {
  const n = Number(grade);
  if (!Number.isFinite(n)) return 'neutral';
  if (n >= 8) return 'good';
  if (n >= 5) return 'mid';
  return 'low';
}

export function getGradeLabel(grade) {
  const tier = getGradeTier(grade);
  if (tier === 'good') return 'GI\u1eceI';
  if (tier === 'mid') return 'KH\u00c1';
  if (tier === 'low') return 'Y\u1ebeU';
  return '';
}

export function getGradeBadgeClasses(grade) {
  const tier = getGradeTier(grade);
  if (tier === 'good') return 'bg-green-50 text-green-700 border-green-200';
  if (tier === 'mid') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  if (tier === 'low') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-500 border-slate-200';
}

export function getGradeIconClasses(grade) {
  const tier = getGradeTier(grade);
  if (tier === 'good') return 'text-green-500';
  if (tier === 'mid') return 'text-yellow-500';
  if (tier === 'low') return 'text-red-500';
  return 'text-slate-400';
}

export function getGradeTextClasses(grade) {
  const tier = getGradeTier(grade);
  if (tier === 'good') return 'text-green-600';
  if (tier === 'mid') return 'text-yellow-600';
  if (tier === 'low') return 'text-red-600';
  return 'text-slate-500';
}

export function getGradePillClasses(grade) {
  const tier = getGradeTier(grade);
  if (tier === 'good') return 'bg-green-100 text-green-700';
  if (tier === 'mid') return 'bg-yellow-100 text-yellow-700';
  if (tier === 'low') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-500';
}