import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { sessionTurn } from '../server/coach.js';
import { CATALOG, parseImport, slug } from '../shared/catalog.js';
import { patternVideosUrl, youtubeUrl } from '../shared/videos.js';
import { migrateState, starterState, validateState } from '../shared/model.js';

test('catalog has unique problems and LeetCode-style slugs', () => {
  assert.equal(new Set(CATALOG.map((p) => p.id)).size, CATALOG.length);
  assert.ok(CATALOG.length >= 150);
  assert.equal(slug('Implement Trie (Prefix Tree)'), 'implement-trie-prefix-tree');
  assert.equal(slug('Two Sum II - Input Array Is Sorted'), 'two-sum-ii-input-array-is-sorted');
  assert.equal(slug('Insert Delete GetRandom O(1)'), 'insert-delete-getrandom-o1');
});

test('existing data gains the catalog once and keeps progress', () => {
  const old = starterState();
  delete old.meta.catalog;
  old.dsa = [{ id: 'p1', pattern: 'x', problem: 'Two Sum', status: 'Solved with help' }];
  const upgraded = migrateState(old);
  assert.equal(upgraded.dsa.length, CATALOG.length);
  assert.equal(upgraded.dsa[0].status, 'Solved with help');
  assert.equal(validateState(upgraded), null);
  upgraded.dsa = upgraded.dsa.slice(0, 3);
  assert.equal(migrateState(upgraded).dsa.length, 3);
});

test('import skips duplicates and bad lines', () => {
  const added = parseImport('A | New one | hard\nA | new ONE\nbroken', [], () => 'i');
  assert.deepEqual(
    added.map((p) => [p.problem, p.difficulty]),
    [['New one', 'Hard']],
  );
});

const turn = {
  stage: 'approach',
  action: 'message',
  problem: 'Two Sum',
  code: '',
  language: 'Java',
  hintsUsed: 0,
  messages: [{ role: 'user', content: 'hash map' }],
  level: 'SDE 2',
  focus: 'DSA & coding',
  profile: {},
};

test('hints get stronger and the approach turn reports readiness', () => {
  const hint = (n) => sessionTurn({ ...turn, action: 'hint', hintsUsed: n }).input.at(-1).content;
  assert.match(hint(0), /small nudge/);
  assert.match(hint(5), /next one or two steps/);
  assert.deepEqual(sessionTurn(turn).parse('{"reply":"ok","ready":true}'), {
    reply: 'ok',
    ready: true,
  });
});

test('the session endpoint validates input and returns a verdict', async (t) => {
  const evaluation = {
    scores: { correctness: 4, depth: 3, problemSolving: 4, communication: 3, tradeoffs: 3 },
    feedback: 'f',
    gaps: [],
    mastered: [],
    followUp: '',
    verdict: 'correct',
  };
  const app = createApp({
    store: createStore({ file: join(mkdtempSync(join(tmpdir(), 'sb-')), 's.json') }),
    ai: { configured: true, ask: async () => JSON.stringify(evaluation) },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  t.after(() => server.close());
  const post = (body) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/coach/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal((await post({ ...turn, action: 'review', code: '' })).status, 400);
  const ok = await post({
    ...turn,
    stage: 'code',
    action: 'review',
    code: 'class Solution { int[] twoSum() {} }',
  });
  assert.equal((await ok.json()).verdict, 'correct');
});

test('lessons advance step by step in the chosen language', () => {
  const lesson = (lessonStep) =>
    sessionTurn({ ...turn, action: 'teach', lessonStep, explainIn: 'Hinglish' }).input.at(-1)
      .content;
  assert.match(lesson(0), /step 1 of 5[\s\S]*Hinglish/);
  assert.match(lesson(9), /step 5 of 5/);
  assert.match(sessionTurn({ ...turn, lessonStep: 2 }).input.at(-1).content, /patient tutor/);
});

test('only https YouTube links are accepted, and every pattern has videos', () => {
  assert.equal(youtubeUrl('javascript:alert(1)'), '');
  assert.equal(youtubeUrl('https://youtube.com.evil.example/x'), '');
  assert.ok(youtubeUrl('https://www.youtube.com/playlist?list=abc'));
  for (const p of CATALOG) assert.match(patternVideosUrl(p.pattern), /codestorywithMIK\/search/);
});
