import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { parseStatement, sessionTurn } from '../server/coach.js';
import { statementText } from '../shared/statement.js';
import { newNumbers, parseLines } from '../shared/studio.js';
import { studioPdf } from '../server/resume.js';
import { mask, parseReview } from '../server/studio.js';
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

test('a statement is validated and passed to the coach as text', () => {
  const c = { name: 'n', input: '[2,7], 9', output: '[0,1]' };
  const parsed = parseStatement(
    JSON.stringify({
      known: true,
      description: 'Find two numbers.',
      signature: 'int[] f()',
      examples: [{ ...c, explanation: 'e' }],
      constraints: ['n >= 2'],
      testCases: [c],
    }),
  );
  assert.match(statementText('Two Sum', parsed), /Test 1\nInput: \[2,7\], 9\nExpected: \[0,1\]/);
  assert.throws(() => parseStatement('{"known":false}'), /does not recognise/);
  assert.throws(() => parseStatement('{"known":true,"description":"x"}'), /missing parts/);
});

test('document lines are parsed and invented numbers are flagged', async () => {
  const lines = parseLines(
    'Asha Rao\nEXPERIENCE\n• Built an API that served\nmany users\n• Cut latency',
  );
  assert.deepEqual(
    lines.map((l) => l.kind),
    ['name', 'heading', 'bullet', 'bullet'],
  );
  assert.equal(lines[2].text, 'Built an API that served many users');
  assert.deepEqual(newNumbers('Cut p99 latency 40% for 1,200 users', 'Cut p99 latency', '1200'), [
    '40',
  ]);
  assert.deepEqual(newNumbers('Moved p99 reads to S3 on EC2, 3x faster', ''), ['3']);
  assert.equal(mask('a@b.com +91 98765 43210').includes('98765'), false);
  const reply = JSON.stringify({
    score: 140,
    summary: 's',
    points: [
      { line: 'l2', priority: 'high', issue: 'heading', suggestion: 'x', question: '' },
      {
        line: 'l4',
        priority: 'high',
        issue: 'vague',
        suggestion: 'Cut latency by 30%',
        question: 'q',
      },
      { line: 'zz', priority: 'high', issue: 'x', suggestion: 'x', question: '' },
    ],
  });
  const review = parseReview(reply, lines);
  assert.equal(review.score, 100);
  assert.deepEqual(
    review.points.map((p) => [p.lineId, p.options[0].check]),
    [['l4', ['30']]],
  );
  const pdf = await studioPdf([
    ...lines,
    { kind: 'bullet', text: 'Saved ₹5 → done 🚀', mark: 'open', number: 1 },
  ]);
  assert.equal(Buffer.from(pdf, 'base64').subarray(0, 4).toString(), '%PDF');
});
