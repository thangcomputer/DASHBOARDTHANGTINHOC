/** Giọng / vùng miền của giảng viên (hiển thị cho HV khi phân công). */
export const VOICE_REGION_OPTIONS = [
  { value: 'bac', label: 'Miền Bắc' },
  { value: 'trung', label: 'Miền Trung' },
  { value: 'nam', label: 'Miền Nam' },
  { value: 'tay', label: 'Miền Tây' },
];

export const VOICE_REGION_VALUES = VOICE_REGION_OPTIONS.map((o) => o.value);

export function normalizeVoiceRegion(value) {
  const s = String(value || '').trim().toLowerCase();
  return VOICE_REGION_VALUES.includes(s) ? s : '';
}

export function voiceRegionLabel(value) {
  const key = normalizeVoiceRegion(value);
  if (!key) return '';
  return VOICE_REGION_OPTIONS.find((o) => o.value === key)?.label || '';
}
