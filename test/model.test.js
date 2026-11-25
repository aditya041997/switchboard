import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../shared/model.js';

test('starter state is valid and has practice content', () => {
  const s = m.starterState();
  assert.equal(m.validateState(s), null);
  assert.ok(s.dsa.length >= 20 && s.skills.length === 6);
  assert.equal(m.readiness([]), 0);
});

test('scoring a session queues each gap once', () => {
  let s = m.starterState();
  s.sessions = [
    { id: 'a', date: '2026-11-25', exercise: 'x', gaps: [], mastered: [], scores: null },
  ];
  const scores = Object.fromEntries(m.DIMENSIONS.map(([k]) => [k, 2]));
  s = m.scoreSession(s, 'a', { scores, gaps: ['Retries', 'retries'] }, '2026-11-25');
  s = m.scoreSession(s, 'a', { scores, gaps: ['Retries'] }, '2026-11-25');
  assert.equal(s.revisions.length, 1);
  assert.equal(s.revisions[0].due, '2026-11-26');
  assert.equal(s.revisions[0].priority, 'High');
});

test('spaced repetition advances, resets and finishes', () => {
  let r = { step: 0, due: '2026-12-31', done: false };
  r = m.reviewRevision(r, true, '2026-12-31');
  assert.equal(r.due, '2027-01-03');
  assert.equal(m.reviewRevision(r, false, '2027-01-03').due, '2027-01-04');
  for (let i = 0; i < 4; i++) r = m.reviewRevision(r, true);
  assert.equal(r.done, true);
});

test('metrics use a rolling week and ignore unscored sessions', () => {
  const s = m.starterState();
  const scores = Object.fromEntries(m.DIMENSIONS.map(([k]) => [k, 4]));
  s.sessions = [
    { date: '2027-03-01', scores, independent: true },
    { date: '2027-03-01', scores: null },
    { date: '2027-01-01', scores, independent: false },
  ];
  const result = m.metrics(s, '2027-03-02');
  assert.deepEqual([result.sessions, result.average, result.independent], [2, 20, 50]);
});

test('data from the first version is upgraded without losing records', () => {
  const legacy = {
    profile: { name: 'A', goal: 'g' },
    sessions: [
      {
        id: '1',
        date: '2026-11-20',
        exercise: 'e',
        status: 'Started',
        scores: { depth: 0 },
        gaps: [],
        mastered: [],
      },
      {
        id: '2',
        date: '2026-11-21',
        exercise: 'f',
        scores: { depth: 3 },
        gaps: ['joins'],
        mastered: [],
      },
    ],
    skills: [],
    dsa: [],
    revisions: [],
    applications: [{ id: 'z', company: 'Acme' }],
  };
  const s = m.migrateState(legacy);
  assert.equal(m.validateState(s), null);
  assert.equal(s.sessions[0].scores, null);
  assert.equal(s.applications[0].company, 'Acme');
  assert.equal(s.revisions[0].concept, 'joins');
  assert.ok(s.skills.length && s.dsa.length);
});

test('invalid state is rejected', () => {
  assert.ok(m.validateState({}));
  assert.ok(m.validateState({ ...m.starterState(), sessions: [null] }));
});
