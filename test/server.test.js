import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAi } from '../server/ai.js';
import { createApp } from '../server/app.js';
import { listenConfig } from '../server/config.js';
import { analyseMaterial, draftSection } from '../server/resume.js';
import { createStore } from '../server/store.js';
import { starterState } from '../shared/model.js';

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'sb-')), 'state.json');
const reply = (text) =>
  new Response(
    JSON.stringify({
      status: 'completed',
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', content: [{ type: 'output_text', text }] },
      ],
    }),
  );

async function serve(t, options = {}) {
  const app = createApp({
    store: createStore({ file: tempFile() }),
    ai: createAi({}),
    ...options,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, headers: res.headers, body: await res.json() };
  };
  call.port = server.address().port;
  return call;
}

test('AI text is read from the raw Responses API shape', async () => {
  const ai = createAi({ apiKey: 'k', fetchImpl: async () => reply('hello') });
  assert.equal(await ai.ask('i', 'q'), 'hello');
});

test('AI failures are reported and never replaced by invented content', async (t) => {
  const ai = createAi({
    apiKey: 'k',
    fetchImpl: async () => new Response('{"error":{"message":"quota exceeded"}}', { status: 429 }),
  });
  const call = await serve(t, { ai });
  const res = await call('/api/resume/review', {
    method: 'POST',
    body: { text: 'React developer who built a design system for forty engineers.' },
  });
  assert.equal(res.status, 502);
  assert.deepEqual(res.body, { error: 'quota exceeded' });
});

test('evaluation returns validated scores', async (t) => {
  const evaluation = {
    scores: { correctness: 4, depth: 3, problemSolving: 4, communication: 5, tradeoffs: 2 },
    feedback: 'ok',
    gaps: ['retries'],
    mastered: [],
    followUp: 'why?',
  };
  const ai = createAi({ apiKey: 'k', fetchImpl: async () => reply(JSON.stringify(evaluation)) });
  const call = await serve(t, { ai });
  const body = { exercise: 'q', answer: 'a sufficiently long answer here' };
  const res = await call('/api/coach/evaluate', { method: 'POST', body });
  assert.equal(res.body.scores.depth, 3);
});

test('built-in mode checks only the supplied resume and writes no claims', () => {
  const result = analyseMaterial(
    '- Worked on React screens\n- Built a TypeScript library',
    'Needs Kafka',
  );
  assert.deepEqual(result.missing, ['kafka']);
  assert.doesNotMatch(result.report, /Spring|saga/i);
  assert.equal(draftSection('## Gaps\nx\n## Rewritten draft\nmine\n## Next actions\ny'), 'mine');
});

test('invalid saves are refused and the server stays up', async (t) => {
  const call = await serve(t);
  assert.equal((await call('/api/state', { method: 'PUT', body: {} })).status, 400);
  assert.equal((await call('/api/state')).status, 200);
  assert.equal((await call('/api/shared/nope')).status, 404);
});

test('a stale tab cannot overwrite newer data', async (t) => {
  const call = await serve(t);
  const state = (await call('/api/state')).body;
  assert.equal((await call('/api/state', { method: 'PUT', body: state })).status, 200);
  assert.equal((await call('/api/state', { method: 'PUT', body: state })).status, 409);
});

test('no cross-origin access, and foreign host names are refused', async (t) => {
  const call = await serve(t);
  const res = await call('/api/state', { headers: { Origin: 'https://evil.example' } });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const status = await new Promise((resolve) =>
    request({ port: call.port, path: '/api/state', headers: { Host: 'evil.example' } }, (r) => {
      r.resume();
      resolve(r.statusCode);
    }).end(),
  );
  assert.equal(status, 403);
});

test('with a password, private routes need it and share links do not', async (t) => {
  const call = await serve(t, { password: 'correct horse battery' });
  assert.equal((await call('/api/state')).status, 401);
  assert.equal((await call('/API/state')).status, 401);
  const auth = (p) => ({ Authorization: `Bearer ${Buffer.from(p).toString('base64')}` });
  assert.equal((await call('/api/state', { headers: auth('wrong') })).status, 401);
  const ok = await call('/api/state', { headers: auth('correct horse battery') });
  assert.equal(ok.status, 200);
  assert.equal((await call('/api/shared/nope')).status, 404);
});

test('hosting without a password is refused', () => {
  assert.equal(listenConfig({}).host, '127.0.0.1');
  assert.throws(() => listenConfig({ HOST: '0.0.0.0' }));
  assert.throws(() => listenConfig({ RENDER: 'true' }));
  assert.throws(() => listenConfig({ APP_PASSWORD: 'short' }));
  assert.equal(
    listenConfig({ RENDER: 'true', APP_PASSWORD: 'long enough password' }).host,
    '0.0.0.0',
  );
});

function fakeBackup() {
  const box = {
    data: null,
    down: false,
    writesFail: false,
    async read() {
      if (box.down) throw Error('down');
      return structuredClone(box.data);
    },
    async write(data) {
      if (box.down || box.writesFail) throw Error('write failed');
      box.data = structuredClone(data);
    },
  };
  return box;
}

test('a failed backup write does not lose newer local data', async () => {
  const backup = fakeBackup();
  const store = createStore({ file: tempFile(), backup });
  await store.save(await store.load());
  backup.writesFail = true;
  const state = await store.load();
  state.applications = [{ id: 'n', company: 'NewCo' }];
  assert.equal((await store.save(state)).backedUp, false);
  assert.equal((await store.load()).applications[0].company, 'NewCo');
  backup.writesFail = false;
  await store.load();
  assert.equal(backup.data.applications[0].company, 'NewCo');
});

test('a new host restores the backup and never starts empty when it is unreachable', async () => {
  const backup = fakeBackup();
  backup.data = { ...starterState(), applications: [{ id: 'o', company: 'OldCo' }] };
  backup.data.meta.updatedAt = 5;
  const file = tempFile();
  backup.down = true;
  await assert.rejects(createStore({ file, backup }).load(), /unreachable/);
  assert.equal(existsSync(file), false);
  backup.down = false;
  assert.equal((await createStore({ file, backup }).load()).applications[0].company, 'OldCo');
});

test('a corrupt data file is left untouched', async () => {
  const file = tempFile();
  writeFileSync(file, '{broken');
  await assert.rejects(createStore({ file }).load(), /left untouched/);
  assert.equal(readFileSync(file, 'utf8'), '{broken');
});

test('a failed backup is retried without another save', async () => {
  const backup = fakeBackup();
  const store = createStore({ file: tempFile(), backup, retryMs: 20 });
  await store.save(await store.load());
  assert.equal(store.status().synced, true);
  backup.writesFail = true;
  const state = await store.load();
  state.sessions = [
    { id: 's1', date: '2026-11-27', topic: 'DSA & coding', exercise: 'Two Sum', answer: 'code' },
  ];
  const { backedUp } = await store.save(state);
  assert.equal(backedUp, false);
  assert.equal(store.status().synced, false);
  backup.writesFail = false;
  await new Promise((done) => setTimeout(done, 150));
  assert.equal(store.status().synced, true);
  assert.equal(backup.data.sessions[0].answer, 'code');
});
