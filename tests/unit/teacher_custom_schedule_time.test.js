'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const {
  normalizeTimeInput,
  endTimeFromStartOrDefault,
  assertEndAfterStart,
  timeRangesOverlap,
} = require('../../services/schedulingValidation');

test('Backend schedulingValidation honors explicit custom endTime and keeps 90m fallback', () => {
  assert.equal(normalizeTimeInput('8:5'), '8:5');
  assert.equal(normalizeTimeInput('8:05'), '08:05');
  assert.equal(normalizeTimeInput('24:00'), '23:59');
  assert.equal(normalizeTimeInput(''), '');

  // Custom durations preserved
  assert.equal(endTimeFromStartOrDefault('19:00', '21:00'), '21:00');
  assert.equal(endTimeFromStartOrDefault('08:15', '09:15'), '09:15');
  assert.equal(endTimeFromStartOrDefault('22:00', '24:00'), '23:59');

  // Empty/omitted falls back to +90 mins
  assert.equal(endTimeFromStartOrDefault('08:00', ''), '09:30');
  assert.equal(endTimeFromStartOrDefault('08:00'), '09:30');

  // Validation
  assert.equal(assertEndAfterStart('19:00', '21:00'), null);
  assert.equal(assertEndAfterStart('19:00', ''), null);
  assert.match(assertEndAfterStart('19:00', '19:00'), /lớn hơn/);
  assert.match(assertEndAfterStart('19:00', '18:30'), /lớn hơn/);
  assert.match(assertEndAfterStart('25:00', '26:00'), /không hợp lệ/);

  // Arbitrary range overlap checks
  assert.equal(timeRangesOverlap('19:00', '21:00', '20:30', '22:00'), true);
  assert.equal(timeRangesOverlap('19:00', '21:00', '21:00', '22:30'), false);
});

test('weeklySlotGrid encodes/parses custom ranges without preset collisions and detects overlaps', async () => {
  const mod = await import(pathToFileURL(path.join(ROOT, 'client/src/utils/weeklySlotGrid.js')).href);
  const {
    CUSTOM_SLOT_SENTINEL,
    CUSTOM_SLOT_OPTION_LABEL,
    WEEK_SLOT_OPTIONS,
    encodeSlotValue,
    parseSlotValue,
    slotValueFromSchedule,
    extraSlotOption,
    extraSlotOptionFromValue,
    slotEndForStart,
    otherTeacherRowRanges,
    rangesOverlapAny,
    weekSlotSelectMeta,
  } = mod;

  assert.equal(CUSTOM_SLOT_SENTINEL, '__custom__');
  assert.equal(CUSTOM_SLOT_OPTION_LABEL, 'Tự chọn giờ...');

  // Preset 90-min slot uses simple start value
  assert.equal(encodeSlotValue('19:00', '20:30'), '19:00');
  assert.equal(encodeSlotValue('22:30', '24:00'), '22:30');

  // Same startTime with custom endTime gets encoded distinctly so it never collapses into 19:00 - 20:30
  const customVal = encodeSlotValue('19:00', '21:00');
  assert.equal(customVal, '19:00|21:00');
  assert.deepEqual(parseSlotValue(customVal), { start: '19:00', end: '21:00' });
  assert.equal(slotEndForStart(customVal), '21:00');

  // Empty / sentinel treated as no schedule
  assert.deepEqual(parseSlotValue(''), { start: '', end: '' });
  assert.deepEqual(parseSlotValue(CUSTOM_SLOT_SENTINEL), { start: '', end: '' });
  assert.equal(slotValueFromSchedule(null), '');

  // Schedule with custom duration generates distinct extra option
  const customSch = { startTime: '19:00', endTime: '21:00' };
  assert.equal(slotValueFromSchedule(customSch), '19:00|21:00');
  assert.deepEqual(extraSlotOption(customSch), {
    start: '19:00',
    end: '21:00',
    value: '19:00|21:00',
    label: '19:00 - 21:00',
  });
  // Unsaved draft custom value also produces extra option
  assert.deepEqual(extraSlotOptionFromValue('08:15|09:45'), {
    start: '08:15',
    end: '09:45',
    value: '08:15|09:45',
    label: '08:15 - 09:45',
  });
  // Preset slot does NOT emit duplicate extra option
  assert.equal(extraSlotOption({ startTime: '19:00', endTime: '20:30' }), null);

  // Conflict & overlap checks respect custom endTime (19:00 - 21:00 overlaps 20:30 - 22:00)
  const dateKey = '2099-05-10';
  const rows = [
    { _id: 'hv1', course: 'Excel', displayName: 'HV 1' },
    { _id: 'hv2', course: 'Word', displayName: 'HV 2' },
  ];
  const schedules = [
    { _id: 's1', studentId: 'hv1', teacherId: 'gv1', course: 'Excel', date: dateKey, startTime: '19:00', endTime: '21:00', status: 'scheduled' },
  ];
  const otherRanges = otherTeacherRowRanges({
    rows,
    schedules,
    dateKey,
    excludeRowKey: 'hv2',
  });
  assert.equal(otherRanges.length, 1);
  assert.equal(otherRanges[0].start, '19:00');
  assert.equal(otherRanges[0].end, '21:00');
  assert.equal(rangesOverlapAny('20:30', '22:00', otherRanges), true);
  assert.equal(rangesOverlapAny('21:00', '22:30', otherRanges), false);

  const slot2030 = WEEK_SLOT_OPTIONS.find((o) => o.value === '20:30');
  const meta2030 = weekSlotSelectMeta(slot2030, dateKey, {
    schedules,
    teacherId: 'gv1',
    currentValue: '',
    extraTakenRanges: otherRanges,
  });
  assert.equal(meta2030.disabled, true);
  assert.match(meta2030.suffix, /đã chọn lịch/);
});

test('Web, Mobile, Backend routes, and i18n wire custom schedule time at top row with blank = no schedule', () => {
  const grid = read('client/src/components/teacher/TeacherWeeklySlotGrid.jsx');
  const sheet = read('client/src/components/teacher/TeacherStudentWeekSlotSheet.jsx');
  const modal = read('client/src/components/teacher/TeacherScheduleModal.jsx');
  const customModal = read('client/src/components/teacher/CustomScheduleTimeModal.jsx');
  const routes = read('routes/scheduleRoutes.js');
  const mobile = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');

  // Custom option appears at very first row of select in both Grid and Sheet
  const gridFirstOptionIdx = grid.indexOf('<option value={CUSTOM_SLOT_SENTINEL}>');
  const gridBlankOptionIdx = grid.indexOf('<option value="">{own ? \'Không có lịch (bỏ ca)\' : \'-\'}</option>');
  assert.ok(gridFirstOptionIdx > 0 && gridFirstOptionIdx < gridBlankOptionIdx);

  const sheetFirstOptionIdx = sheet.indexOf('<option value={CUSTOM_SLOT_SENTINEL}>');
  const sheetBlankOptionIdx = sheet.indexOf('<option value="">- Không có lịch -</option>');
  assert.ok(sheetFirstOptionIdx > 0 && sheetFirstOptionIdx < sheetBlankOptionIdx);

  // Modal renders From/To inputs and empty-means-no-schedule helper
  assert.match(customModal, /Từ giờ/);
  assert.match(customModal, /Đến giờ/);
  assert.match(customModal, /Không chọn giờ.*coi như không có lịch/);

  // Full ScheduleModal unlocks endTime
  assert.doesNotMatch(modal, /aria-readonly="true"/);
  assert.doesNotMatch(modal, /\n\s*readOnly\s*\n/);

  // Backend PUT passes effectiveEnd and POST uses resolvedEndTime
  assert.match(routes, /updates\.endTime\s*=\s*effectiveEnd;/);
  assert.match(routes, /startTime:\s*normalizedStartTime,\s*endTime:\s*resolvedEndTime/);

  // Mobile modal includes custom time option before slotOptions
  const mobileCustomIdx = mobile.indexOf('Tự chọn giờ...');
  const mobilePresetIdx = mobile.indexOf('slotOptions.map');
  assert.ok(mobileCustomIdx > 0 && mobileCustomIdx < mobilePresetIdx);
});

test('New custom schedule time phrases translate cleanly to English without leaked diacritics', async () => {
  const { translateText } = await import(pathToFileURL(path.join(ROOT, 'shared/i18n/translate.mjs')).href);
  const VI_ACCENT_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

  for (const phrase of [
    'Tự chọn giờ...',
    'Tự chọn giờ học',
    'Từ giờ',
    'Đến giờ',
    'Không có lịch',
    'Không có lịch (bỏ ca)',
    '- Không có lịch -',
    'Không chọn giờ (để trống cả hai ô) coi như không có lịch.',
  ]) {
    const out = translateText(phrase, 'en');
    assert.ok(out && out !== phrase, `Missing EN translation for "${phrase}"`);
    assert.ok(!VI_ACCENT_RE.test(out), `Leaked diacritics in "${phrase}" -> "${out}"`);
  }
});
