const YT_QUALITY_ORDER = [
  'default', 'highres', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny',
] as const;

const YT_QUALITY_LABEL: Record<string, string> = {
  default: 'Auto',
  highres: '4K',
  hd2160: '4K',
  hd1440: '2K',
  hd1080: '1080p',
  hd720: '720p',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '144p',
  auto: 'Auto',
};

export function youtubeQualityLabel(level?: string | null) {
  const key = String(level || 'default');
  return YT_QUALITY_LABEL[key] || key;
}

export function orderYouTubeQualities(levels: string[]) {
  const fromYt = [...new Set(levels.map(String).filter((q) => q && q !== 'auto' && q !== 'default'))];
  const ordered = YT_QUALITY_ORDER.filter((q) => q !== 'default' && fromYt.includes(q));
  const extras = fromYt.filter((q) => !YT_QUALITY_ORDER.includes(q as typeof YT_QUALITY_ORDER[number]));
  return fromYt.length ? ['default', ...ordered, ...extras] : ['default'];
}

export function qualityButtonLabel(liveQuality?: string | null) {
  const liveLabel = liveQuality ? youtubeQualityLabel(liveQuality) : null;
  return liveLabel && liveLabel !== 'Auto' ? `Auto · ${liveLabel}` : 'Auto';
}
