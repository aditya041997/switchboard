import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { FOCUSES, LEVELS, readiness, validateState } from '../shared/model.js';
import * as coach from './coach.js';
import { analyseMaterial, draftSection, resumePdf } from './resume.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const digest = (v) => createHash('sha256').update(v).digest();
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function createApp({
  store,
  ai,
  password = '',
  jitsiDomain = '',
  dist,
  temporaryDisk = false,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_, res, next) => {
    // Share tokens live in the URL, so never send it to another site.
    res.set({
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
    next();
  });

  let failures = [];
  function guard(req, res, next) {
    if (req.path === '/health' || req.path.startsWith('/shared/')) return next();
    if (!password) {
      // Without a password only local names are accepted, which blocks DNS rebinding.
      const host = (req.headers.host || '').replace(/:\d+$/, '');
      return LOCAL_HOSTS.has(host)
        ? next()
        : res.status(403).json({ error: 'Set APP_PASSWORD to use Switchboard from another host.' });
    }
    const now = Date.now();
    failures = failures.filter((t) => now - t < 60000);
    if (failures.length >= 20)
      return res.status(429).json({ error: 'Too many wrong passwords. Wait a minute.' });
    const supplied = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1] || '';
    const decoded = Buffer.from(supplied, 'base64').toString('utf8');
    if (supplied && timingSafeEqual(digest(decoded), digest(password))) return next();
    if (supplied) failures.push(now);
    return res.status(401).json({ error: 'Password required.' });
  }
  // The password is checked before any request body is read.
  app.use('/api', guard);
  app.use('/api', express.json({ limit: '8mb' }));

  app.get('/api/health', (_, res) => res.json({ ok: true }));
  app.get('/api/config', (_, res) =>
    res.json({ ai: ai.configured, video: Boolean(jitsiDomain), auth: Boolean(password) }),
  );
  app.get(
    '/api/state',
    route(async (_, res) => res.json(await store.load())),
  );
  app.get(
    '/api/storage',
    route(async (_, res) => {
      // Loading compares the two copies and sends any pending changes to MongoDB.
      await store.load().catch(() => {});
      res.json({ ...store.status(), temporaryDisk });
    }),
  );
  app.put(
    '/api/state',
    route(async (req, res) => {
      const problem = validateState(req.body);
      if (problem) throw fail(problem);
      const { data, backedUp } = await store.save(req.body);
      res.json({ ok: true, meta: data.meta, mongoBackup: backedUp });
    }),
  );
  app.get(
    '/api/shared/:token',
    route(async (req, res) => {
      const state = await store.load();
      const viewer = state.sharing.viewers.find((v) => v.token === req.params.token);
      if (!state.sharing.enabled || !viewer?.active)
        throw fail('This sharing link has been revoked or does not exist.', 404);
      res.json({
        owner: state.profile.name || 'Candidate',
        sessions: state.sessions.length,
        readiness: readiness(state.skills),
        completedActions: [...state.careerChecks, ...state.revisions].filter((x) => x.done).length,
        recent: state.sessions
          .slice(0, 5)
          .map(({ id, topic, exercise, date }) => ({ id, topic, exercise, date })),
      });
    }),
  );

  function coachRequest(body = {}) {
    const level = LEVELS.includes(body.level) ? body.level : 'SDE 2';
    const focus = FOCUSES.includes(body.focus) ? body.focus : 'Backend & API design';
    return { level, focus, profile: body.profile || {} };
  }
  app.post(
    '/api/coach',
    route(async (req, res) => {
      const request = coachRequest(req.body);
      const interviewer = req.body?.mode === 'interviewer';
      if (!ai.configured)
        return res.json({
          source: 'Built-in question bank',
          text: interviewer ? coach.localGuide(request.focus) : coach.localQuestion(request.focus),
        });
      const prompt = (interviewer ? coach.interviewerPrompt : coach.workoutPrompt)(request);
      res.json({ source: 'AI', text: await ai.ask(coach.COACH_RULES, prompt) });
    }),
  );
  app.post(
    '/api/coach/evaluate',
    route(async (req, res) => {
      const exercise = text(req.body?.exercise, 8000);
      const answer = text(req.body?.answer, 20000);
      if (!exercise || answer.length < 20)
        throw fail('Write your answer (at least a few lines) first.');
      const prompt = coach.evaluationPrompt({ ...coachRequest(req.body), exercise, answer });
      const reply = await ai.ask(coach.COACH_RULES, prompt, coach.EVALUATION_FORMAT);
      res.json(coach.parseEvaluation(reply));
    }),
  );

  app.post(
    '/api/problem',
    route(async (req, res) => {
      const title = text(req.body?.title, 200);
      if (!title) throw fail('The problem needs a title.');
      const prompt = coach.statementPrompt({
        title,
        pattern: text(req.body?.pattern, 80),
        difficulty: text(req.body?.difficulty, 20),
        language: text(req.body?.language, 30),
      });
      const reply = await ai.ask(coach.COACH_RULES, prompt, coach.STATEMENT_FORMAT);
      res.json(coach.parseStatement(reply));
    }),
  );

  app.post(
    '/api/coach/session',
    route(async (req, res) => {
      const body = req.body || {};
      const turn = {
        ...coachRequest(body),
        stage: body.stage === 'code' ? 'code' : 'approach',
        action: ['message', 'hint', 'review', 'teach'].includes(body.action)
          ? body.action
          : 'message',
        lessonStep: Math.max(0, Math.min(5, Math.trunc(Number(body.lessonStep)) || 0)),
        explainIn: body.explainIn === 'Hinglish' ? 'Hinglish' : 'English',
        problem: text(body.problem, 8000),
        code: typeof body.code === 'string' ? body.code.slice(0, 20000) : '',
        language: text(body.language, 30),
        hintsUsed: Math.max(0, Math.min(20, Number(body.hintsUsed) || 0)),
        messages: (Array.isArray(body.messages) ? body.messages : [])
          .filter((m) => ['user', 'assistant'].includes(m?.role) && text(m.content, 6000))
          .slice(-30)
          .map((m) => ({ role: m.role, content: text(m.content, 6000) })),
      };
      if (!turn.problem) throw fail('This session has no question.');
      if (turn.action === 'message' && turn.messages.at(-1)?.role !== 'user')
        throw fail('Write a message first.');
      if (turn.action === 'review' && turn.code.trim().length < 20)
        throw fail('Write your solution first.');
      const { input, format, parse } = coach.sessionTurn(turn);
      res.json(parse(await ai.ask(coach.COACH_RULES, input, format)));
    }),
  );

  app.post(
    '/api/resume/extract',
    route(async (req, res) => {
      const { fileName = '', dataUrl = '' } = req.body || {};
      if (
        !String(fileName).toLowerCase().endsWith('.pdf') ||
        !String(dataUrl).startsWith('data:application/pdf;base64,')
      )
        throw fail('Please upload a PDF resume.');
      const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      if (!buffer.length || buffer.length > 5 * 1024 * 1024)
        throw fail('Choose a PDF smaller than 5 MB.');
      let parsed;
      try {
        parsed = await pdf(buffer);
      } catch {
        throw fail('That PDF could not be read. Paste the resume text instead.');
      }
      const content = parsed.text.replace(/[ \t]+\n/g, '\n').trim();
      if (content.length < 40)
        throw fail('No readable text was found in this PDF. Paste the resume text instead.');
      res.json({ text: content, pages: parsed.numpages });
    }),
  );

  app.post(
    '/api/resume/review',
    route(async (req, res) => {
      const type = req.body?.type === 'linkedin' ? 'linkedin' : 'resume';
      const material = text(req.body?.text, 24000);
      const jd = text(req.body?.jobDescription, 16000);
      if (material.length < 40) throw fail('Add your resume or LinkedIn text first.');
      const analysis = analyseMaterial(material, jd);
      const base = { score: analysis.score, checks: analysis.checks };
      if (!ai.configured)
        return res.json({ ...base, source: 'Rule-based check', text: analysis.report });
      const prompt = `Review this ${type} for the candidate. Candidate context: ${coach.candidateContext(req.body?.profile)}
Use only facts present in the supplied text. Never invent employers, titles, technologies, ownership or metrics; write [add metric] or [verify] where evidence is missing. Keep the candidate's own specialisation.
Return these Markdown headings: ## Strengths, ## Gaps, ## Rewritten draft, ## Next actions.

<${type}>
${material}
</${type}>${jd ? `\n<job_description>\n${jd}\n</job_description>` : ''}`;
      const reply = await ai.ask(coach.COACH_RULES, prompt);
      const draft = draftSection(reply);
      res.json({
        ...base,
        source: 'AI',
        text: reply,
        pdfBase64: draft ? await resumePdf(draft) : null,
      });
    }),
  );

  app.post(
    '/api/resume/overleaf',
    route(async (req, res) => {
      const latex = text(req.body?.latex, 100000);
      const jd = text(req.body?.jobDescription, 16000);
      if (!/\\documentclass/.test(latex) || !/\\end\{document\}/.test(latex))
        throw fail('Upload the complete main .tex file, from \\documentclass to \\end{document}.');
      if (latex.length > 50000) throw fail('The .tex file is too large (limit 50,000 characters).');
      const prompt = `Rewrite the prose of this LaTeX resume. Candidate context: ${coach.candidateContext(req.body?.profile)}
Return ONLY the complete compilable LaTeX. Keep the preamble, macros, layout, contact details and section structure. Never invent achievements, metrics or technologies; use [add metric] or [verify].
${jd ? `<job_description>\n${jd}\n</job_description>\n` : ''}<latex>
${latex}
</latex>`;
      const output = (await ai.ask(coach.COACH_RULES, prompt))
        .replace(/^```(?:latex|tex)?\s*/i, '')
        .replace(/\s*```$/, '');
      if (!/\\documentclass/.test(output) || !/\\end\{document\}/.test(output))
        throw fail('The AI reply was not a complete LaTeX file. Please try again.', 502);
      res.json({ latex: output, fileName: 'switchboard-tailored-resume.tex' });
    }),
  );

  app.post('/api/interview-room', (req, res) => {
    const { consent, title } = req.body || {};
    if (consent !== true)
      return res
        .status(403)
        .json({ error: 'Both participants must approve before a room is created.' });
    if (!jitsiDomain)
      return res
        .status(503)
        .json({ error: 'Video rooms are not configured. Add JITSI_DOMAIN to .env.' });
    const slug = (text(title, 80) || 'mock')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 36);
    const room = `${slug}-${randomBytes(12).toString('hex')}`;
    res.json({ room, url: `https://${jitsiDomain}/${room}` });
  });

  app.use('/api', (_, res) => res.status(404).json({ error: 'Unknown API route.' }));
  if (dist && existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_, res) => res.sendFile(join(dist, 'index.html')));
  }
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err.message);
    // Errors raised on purpose carry a status; anything else stays private.
    res.status(status).json({ error: err.status ? err.message : 'Server error.' });
  });
  return app;
}
