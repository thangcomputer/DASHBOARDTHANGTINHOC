/** Giọng / vùng miền giảng viên */
const VOICE_REGION_VALUES = ['bac', 'trung', 'nam', 'tay'];

const VOICE_REGION_LABELS = {
  bac: 'Miền Bắc',
  trung: 'Miền Trung',
  nam: 'Miền Nam',
  tay: 'Miền Tây',
};

function normalizeVoiceRegion(value) {
  const s = String(value || '').trim().toLowerCase();
  return VOICE_REGION_VALUES.includes(s) ? s : '';
}

function voiceRegionLabel(value) {
  const key = normalizeVoiceRegion(value);
  return key ? (VOICE_REGION_LABELS[key] || '') : '';
}

module.exports = {
  VOICE_REGION_VALUES,
  VOICE_REGION_LABELS,
  normalizeVoiceRegion,
  voiceRegionLabel,
};
