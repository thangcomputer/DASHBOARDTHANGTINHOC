import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentStudentAge,
  getTodayStudentAgeReferenceDate,
} from '../src/utils/studentAge.js';
import { mapStudent } from '../src/lib/entityMaps.js';

test('student age increases on the anniversary date', () => {
  const student = { age: 43, ageAsOf: '2025-09-29' };

  assert.equal(getCurrentStudentAge(student, '2026-09-28'), 43);
  assert.equal(getCurrentStudentAge(student, '2026-09-29'), 44);
});

test('legacy records use createdAt as the age reference date', () => {
  const student = { age: 43, createdAt: '2025-09-29T08:00:00.000Z' };

  assert.equal(getCurrentStudentAge(student, '2026-09-28'), 43);
  assert.equal(getCurrentStudentAge(student, '2026-09-29'), 44);
});

test('leap-day age entries advance on the last day of February in non-leap years', () => {
  const student = { age: 43, ageAsOf: '2024-02-29' };

  assert.equal(getCurrentStudentAge(student, '2025-02-27'), 43);
  assert.equal(getCurrentStudentAge(student, '2025-02-28'), 44);
});

test('changing age starts a new anniversary cycle without mutating the stored baseline', () => {
  const updated = { age: 44, ageAsOf: '2026-10-01' };

  assert.equal(getCurrentStudentAge(updated, '2026-10-01'), 44);
  assert.equal(getCurrentStudentAge(updated, '2027-10-01'), 45);
});

test('age reference dates follow the Vietnam calendar date', () => {
  assert.equal(
    getTodayStudentAgeReferenceDate(new Date('2026-09-29T17:30:00.000Z')),
    '2026-09-30',
  );
});

test('mapped students expose the current age and preserve the entered age for editing', () => {
  const mapped = mapStudent({
    _id: 'student-1',
    age: 43,
    ageAsOf: '2999-01-01',
  });

  assert.equal(mapped.age, 43);
  assert.equal(mapped.ageAtEntry, 43);
});
