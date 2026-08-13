'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadMod() {
  const file = path.join(__dirname, '../../client/src/utils/studentCertificationExam.js');
  return import(pathToFileURL(file).href);
}

function makeQ(id, options, answer) {
  return { id, text: `Q-${id}`, options: [...options], answer, imageUrl: '' };
}

/** Deterministic PRNG for stable shuffle assertions */
function seqRandom(seq) {
  let i = 0;
  return () => {
    const v = seq[i % seq.length];
    i += 1;
    return v;
  };
}

test('A — question shuffle: same ids, count, no duplicates', async () => {
  const {
    buildCertificationExamInstance,
  } = await loadMod();
  const raw = Array.from({ length: 10 }, (_, i) => makeQ(`id-${i}`, ['A', 'B', 'C', 'D'], i % 4));
  const original = structuredClone(raw);
  // Force a non-identity permutation via low values early
  const random = seqRandom([0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4, 0.55, 0.45, 0.99, 0.01]);
  const exam = buildCertificationExamInstance(raw, random);
  assert.equal(exam.length, 10);
  const ids = exam.map((q) => q.id).sort();
  assert.deepEqual(ids, raw.map((q) => q.id).sort());
  assert.equal(new Set(ids).size, 10);
  assert.deepEqual(raw, original);
});

test('B/C — option shuffle remaps answer to same text', async () => {
  const { withShuffledOptions } = await loadMod();
  const q = makeQ('x', ['A', 'B', 'C', 'D'], 2);
  const original = structuredClone(q);
  // Several shuffles with different sequences
  for (const seq of [
    [0.1, 0.2, 0.3, 0.4],
    [0.99, 0.5, 0.25, 0.1],
    [0.4, 0.9, 0.1, 0.7],
  ]) {
    const shuffled = withShuffledOptions(q, seqRandom(seq));
    assert.equal(shuffled.options.length, 4);
    assert.equal(new Set(shuffled.options).size, 4);
    assert.equal(shuffled.options[shuffled.answer], 'C');
    assert.deepEqual(q, original);
  }
});

test('D — multiple questions independent (no shared options array)', async () => {
  const { buildCertificationExamInstance } = await loadMod();
  const raw = [
    makeQ('1', ['A1', 'B1', 'C1', 'D1'], 0),
    makeQ('2', ['A2', 'B2', 'C2', 'D2'], 1),
  ];
  const exam = buildCertificationExamInstance(raw, seqRandom([0.2, 0.8, 0.3, 0.7, 0.1, 0.9]));
  exam[0].options[0] = 'MUTATED';
  assert.notEqual(exam[1].options[0], 'MUTATED');
  assert.equal(raw[0].options[0], 'A1');
});

test('E — grading regression with remapped answers', async () => {
  const { buildCertificationExamInstance, gradeMcByAnswerIndex } = await loadMod();
  const raw = [
    makeQ('1', ['Paris', 'London', 'Berlin', 'Rome'], 0),
    makeQ('2', ['W', 'X', 'Y', 'Z'], 3),
  ];
  const exam = buildCertificationExamInstance(raw, seqRandom([0.7, 0.2, 0.9, 0.1, 0.4, 0.6]));
  const correctAnswers = exam.map((q) => q.answer);
  assert.equal(gradeMcByAnswerIndex(exam, correctAnswers), 2);
  const wrong = correctAnswers.map((a) => (a + 1) % 4);
  assert.equal(gradeMcByAnswerIndex(exam, wrong), 0);
  exam.forEach((q, i) => {
    const rawQ = raw.find((r) => r.id === q.id);
    assert.equal(q.options[q.answer], rawQ.options[rawQ.answer]);
  });
});

test('F — no mutation of raw source', async () => {
  const { withShuffledOptions, buildCertificationExamInstance } = await loadMod();
  const q = makeQ('m', ['A', 'B', 'C', 'D'], 1);
  const snap = structuredClone(q);
  withShuffledOptions(q, seqRandom([0.9, 0.1, 0.5]));
  buildCertificationExamInstance([q], seqRandom([0.3, 0.6, 0.1]));
  assert.deepEqual(q, snap);
});

test('G — reload stability via resolveCertificationExamAttempt', async () => {
  const {
    buildCertificationExamInstance,
    resolveCertificationExamAttempt,
    bankFingerprint,
  } = await loadMod();
  const raw = Array.from({ length: 5 }, (_, i) => makeQ(`g-${i}`, ['A', 'B', 'C', 'D'], i % 4));
  const first = buildCertificationExamInstance(raw, seqRandom([0.8, 0.1, 0.6, 0.3, 0.9, 0.2]));
  const saved = {
    bankFingerprint: bankFingerprint(raw),
    questions: first,
    answers: [1, null, 2, null, 0],
    currentQ: 2,
    timeLeft: 500,
    isTracNghiemSubmitted: false,
    tab: 'trac_nghiem',
    examPhase: 'mc',
  };
  const resumed = resolveCertificationExamAttempt({
    rawQuestions: raw,
    saved,
    random: seqRandom([0.01, 0.99, 0.5]), // would reshuffle if bug
  });
  assert.equal(resumed.resumed, true);
  assert.deepEqual(resumed.questions, first);
  assert.deepEqual(resumed.answers, saved.answers);
  assert.equal(resumed.currentQ, 2);
  assert.equal(resumed.timeLeft, 500);
});

test('H — malformed options do not throw', async () => {
  const { withShuffledOptions, buildCertificationExamInstance } = await loadMod();
  assert.doesNotThrow(() => withShuffledOptions({ id: 'e', options: [], answer: 0 }));
  assert.doesNotThrow(() => withShuffledOptions({ id: 'e2', options: ['only'], answer: 0 }));
  assert.doesNotThrow(() => withShuffledOptions(null));
  const out = buildCertificationExamInstance([
    { id: 'ok', text: 't', options: ['A', 'B', 'C', 'D'], answer: 0 },
    { id: 'bad', text: 't2', options: [], answer: 0 },
  ], seqRandom([0.5, 0.5, 0.5]));
  assert.equal(out.length, 2);
});
