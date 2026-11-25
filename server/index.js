import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import PDFDocument from 'pdfkit';

dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');
const dataFile = join(dataDir, 'switchboard.json');
const app = express();
app.use(cors()); app.use(express.json({ limit: '8mb' }));

const starter = {
  profile: { name: 'Engineer', target: 'Senior Backend · Product / FinTech', goal: '35–40 LPA+', weeklyTarget: 5, linkedinScore: 0, resumeScore: 0 },
  sessions: [],
  skills: [
    { id: 'k1', area: 'DSA', focus: 'Patterns & problem solving', status: 'Not started', confidence: 0 },
    { id: 'k2', area: 'Programming', focus: 'Language & runtime fundamentals', status: 'Not started', confidence: 0 },
    { id: 'k3', area: 'Backend engineering', focus: 'APIs, data & reliability', status: 'Not started', confidence: 0 },
    { id: 'k4', area: 'System design', focus: 'Scale, trade-offs & failure recovery', status: 'Not started', confidence: 0 },
    { id: 'k5', area: 'CS foundations', focus: 'OS, networking & security', status: 'Not started', confidence: 0 },
    { id: 'k6', area: 'Leadership', focus: 'Behavioral stories & influence', status: 'Not started', confidence: 0 }
  ],
  revisions: [], applications: [], dsa: [], careerChecks: [], sharing: { enabled: false, viewers: [] }, interviews: []
};
function read() { if (!existsSync(dataFile)) { mkdirSync(dataDir, { recursive: true }); writeFileSync(dataFile, JSON.stringify(starter, null, 2)); } return JSON.parse(readFileSync(dataFile, 'utf8')); }
function localWrite(data) { mkdirSync(dataDir, { recursive: true }); writeFileSync(dataFile, JSON.stringify(data, null, 2)); }
let mongo;
async function mongoData() {
  if (!process.env.MONGODB_URI) return null;
  try { mongo ??= new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 }); await mongo.connect(); return (await mongo.db(process.env.MONGODB_DATABASE || 'switchboard').collection('backups').findOne({ _id: 'primary' }))?.data || null; }
  catch (err) { console.warn('Mongo restore skipped:', err.message); return null; }
}
async function backup(data) { if (!process.env.MONGODB_URI) return false; try { mongo ??= new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 }); await mongo.connect(); await mongo.db(process.env.MONGODB_DATABASE || 'switchboard').collection('backups').updateOne({ _id: 'primary' }, { $set: { data, updatedAt: new Date() } }, { upsert: true }); return true; } catch (err) { console.warn('Mongo backup skipped:', err.message); return false; } }
function discardDraftInterviews(data) { const interviews = (data.interviews || []).filter(item => item?.roomUrl); return interviews.length === (data.interviews || []).length ? data : { ...data, interviews }; }
app.get('/api/state', async (_, res) => { const local = read(); const cloud = await mongoData(); const source = cloud || local; const clean = discardDraftInterviews(source); if (clean !== source) { localWrite(clean); if (cloud) await backup(clean); } else if (cloud) localWrite(cloud); res.json(clean); });
app.put('/api/state', async (req, res) => { const data = req.body; localWrite(data); res.json({ ok: true, mongoBackup: await backup(data) }); });
app.get('/api/sessions/:id', async (req, res) => {
  const cloud = await mongoData(); const state = cloud || read();
  const session = state.sessions.find(item => item.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  res.json(session);
});
app.get('/api/shared/:token', async (req, res) => {
  const cloud = await mongoData(); const state = cloud || read(); const sharing = state.sharing || {}; const viewer = (sharing.viewers || []).find(item => item.token === req.params.token);
  if (!sharing.enabled || !viewer?.active) return res.status(404).json({ error: 'This sharing link has been revoked or does not exist.' });
  const sessions = state.sessions || []; const skills = state.skills || []; const checks = [...(state.careerChecks || []), ...(state.revisions || [])];
  const readiness = skills.length ? Math.round(skills.reduce((sum, skill) => sum + Number(skill.confidence || 0), 0) / skills.length) : 0;
  res.json({ owner: state.profile?.name || 'Candidate', sessions: sessions.length, readiness, completedActions: checks.filter(item => item.done).length, recent: sessions.slice(0, 5).map(({ id, topic, exercise, date }) => ({ id, topic, exercise, date })) });
});
app.get('/api/health', (_, res) => res.json({ localStore: true, mongoConfigured: Boolean(process.env.MONGODB_URI) }));
const coachRules = 'You are Switchboard, a rigorous backend engineering career coach. Do not reveal a coding solution before an attempt. Challenge vague answers with concrete failure scenarios. Be concise, practical, honest, and level-appropriate.';
const resumeContext = 'Target: Senior Backend Engineer (SDE 2/SDE 3). Ground recommendations in demonstrated Java/Spring, Kafka, MySQL/data modelling, distributed transactions/sagas, stock/order/pricing workflows, concurrency, reliability, production debugging, and API design. Prefer truthful, measurable ownership claims; do not invent metrics, employers, titles, or technologies.';
function localResumeImprovement(type, text, jd = '') { const keywords = [...new Set((jd.match(/\b(?:java|spring(?: boot)?|kafka|mysql|sql|microservices|distributed systems|api|aws|docker|kubernetes|redis|system design|testing|observability|performance|concurrency)\b/gi) || []).map(value => value.toLowerCase()))]; const missing = keywords.filter(keyword => !text.toLowerCase().includes(keyword)); const target = keywords.length ? keywords.slice(0, 6).join(', ') : 'Java, Spring Boot, Kafka, MySQL and distributed systems'; const draft = `Senior Backend Engineer\n\nSUMMARY\nBackend engineer focused on reliable, high-volume business workflows. Experienced with Java/Spring services, data-intensive APIs, Kafka-driven processing, MySQL, failure recovery and production troubleshooting. Targeted strengths for this role: ${target}.\n\nSELECTED IMPACT\n• Owned a Java/Spring service boundary for [system/workflow], improving [reliability, latency or throughput] by [add truthful metric].\n• Designed, debugged or operated Kafka-based processing with idempotency, ordering, retry and consumer-throughput considerations.\n• Improved MySQL-backed APIs through data modelling, query discipline, safe schema migration and observability.\n• Applied saga/compensation and concurrency reasoning to protect stock, order or pricing consistency under failure.\n\nTAILORING NOTES\nUse only evidence present in your original resume. Replace each [placeholder] with a truthful result; do not claim tools you have not used.`; return { source: 'local context', text: `## JD alignment\nTarget keywords: ${target}.\n${missing.length ? `Add evidence for: ${missing.join(', ')}.` : 'Your draft already contains the main detected keywords.'}\n\n## Rewritten draft\n${draft}\n\n## Next actions\n1. Put the closest JD language in the headline and first two bullets.\n2. Use measurable ownership, not responsibility-only phrasing.\n3. Keep one clear project story for each core requirement.`, draft, keywords, missing }; }
function resumePdf(text) { return new Promise((resolve, reject) => { const document = new PDFDocument({ margin: 48, size: 'A4' }); const chunks = []; document.on('data', chunk => chunks.push(chunk)); document.on('end', () => resolve(Buffer.concat(chunks).toString('base64'))); document.on('error', reject); document.fontSize(18).fillColor('#172036').text('Tailored Resume Draft'); document.moveDown(.5); document.fontSize(9).fillColor('#69748d').text('Generated by Switchboard - verify every claim before applying.'); document.moveDown(); document.fontSize(10).fillColor('#172036').text(text.replace(/[\u2022]/g, '-'), { lineGap: 4 }); document.end(); }); }
async function coach(prompt) {
  if (!process.env.OPENAI_API_KEY) throw new Error('AI coach is not configured. Add OPENAI_API_KEY to .env and restart the server.');
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-6.2-astra', instructions: coachRules, input: prompt }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || 'The AI coach request failed.');
  return body.output_text || 'The coach returned no text. Please try again.';
}
app.post('/api/coach', async (req, res) => {
  const { mode = 'workout', level = 'SDE 2', focus = 'backend engineering', profile = {} } = req.body || {};
  const task = mode === 'interviewer' ? `Create a 45-minute ${level} mock interview guide for a non-technical interviewer. Focus: ${focus}. Return an opening script, five ordered questions, a hidden interviewer-only follow-up after each question, simple scoring cues, and no answers to disclose. Candidate context: ${JSON.stringify(profile)}.` : `Create exactly one 15-minute ${level} exercise for ${focus}. Include context, constraints, the first question only, evaluation signals, and one failure scenario to introduce after the candidate answers. Candidate context: ${JSON.stringify(profile)}.`;
  try { res.json({ text: await coach(task) }); } catch (err) { res.status(503).json({ error: err.message }); }
});
app.post('/api/resume/extract', async (req, res) => {
  try {
    const { fileName = 'resume.pdf', dataUrl = '' } = req.body || {};
    if (!fileName.toLowerCase().endsWith('.pdf') || !dataUrl.startsWith('data:application/pdf;base64,')) throw new Error('Please upload a PDF resume.');
    const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error('Choose a PDF smaller than 5 MB.');
    const parsed = await pdf(buffer);
    const text = parsed.text.replace(/\s+\n/g, '\n').trim();
    if (text.length < 40) throw new Error('No readable text was found in this PDF. Please paste the resume text instead.');
    res.json({ text, pages: parsed.numpages, fileName });
  } catch (err) { res.status(400).json({ error: err.message || 'Could not read that PDF.' }); }
});
app.post('/api/resume/review', async (req, res) => {
  const { type = 'resume', text = '' } = req.body || {};
  if (typeof text !== 'string' || text.trim().length < 40) return res.status(400).json({ error: 'Add at least a short resume section before reviewing it.' });
  const clipped = text.trim().slice(0, 24000);
  try {
    if (process.env.OPENAI_API_KEY) {
      const prompt = `Review and improve this ${type} for the candidate context below. ${resumeContext}\n\nReturn exactly these Markdown sections: Strengths, Gaps, Rewritten draft, and Next actions. In Rewritten draft, keep only truthful evidence from the supplied content; use [add metric] where evidence is missing.\n\nSUPPLIED ${type.toUpperCase()}:\n${clipped}`;
      return res.json({ source: 'AI', text: await coach(prompt) });
    }
    const metricCount = (clipped.match(/\b\d+(?:[.,]\d+)?%?\b/g) || []).length;
    const output = `## Strengths\nYour material is being positioned for Java/Spring backend roles with Kafka, MySQL, distributed-workflow and reliability depth.\n\n## Gaps\n${metricCount ? 'Make the strongest metrics lead the relevant bullets; attach each to an ownership boundary and technical decision.' : 'Add truthful scale or outcome evidence to at least two bullets (latency, throughput, availability, cost, orders, users, or time saved).'}\n\n## Rewritten draft\n**Senior Backend Engineer | Java, Spring Boot, Kafka, MySQL**\nBackend engineer focused on reliable, high-volume business workflows and distributed systems. Built and troubleshot Java/Spring services across order, stock, pricing and workflow domains; apply clear API contracts, data modelling, failure recovery and production observability.\n\n- Owned a Java/Spring workflow spanning [system boundary], improving [reliability/performance outcome] by [add metric].\n- Designed or debugged Kafka-driven processing with attention to idempotency, ordering, retries and consumer throughput.\n- Improved MySQL-backed APIs through pragmatic data modelling, query discipline and safe migration practices.\n- Applied saga/compensation and concurrency reasoning to prevent inconsistent stock, order or pricing outcomes.\n\n## Next actions\n1. Replace every bracketed placeholder with evidence from your work.\n2. Keep 3-5 strongest experience bullets; start each with ownership and end with impact.\n3. Tailor the headline and first two bullets to each SDE 2/3 job description.`;
    res.json({ source: 'local context', text: output });
  } catch (err) { res.status(503).json({ error: err.message || 'Resume review failed.' }); }
});
app.post('/api/resume/improve', async (req, res) => {
  const { type = 'resume', text = '', jobDescription = '' } = req.body || {};
  if (typeof text !== 'string' || text.trim().length < 40) return res.status(400).json({ error: 'Add resume or LinkedIn text first.' });
  if (typeof jobDescription !== 'string') return res.status(400).json({ error: 'Job description must be text when supplied.' });
  const clippedText = text.trim().slice(0, 24000); const clippedJd = jobDescription.trim().slice(0, 16000); const mode = clippedJd.length >= 40 ? 'Tailor for this job description' : 'Perform a general senior-backend resume upgrade using the candidate context'; let result;
  try {
    if (process.env.OPENAI_API_KEY) {
      const prompt = `${mode}. ${resumeContext}\n\nReturn sections exactly named: Clarifications (only questions that materially improve accuracy; otherwise write “None”), Strengths, Missing evidence, Rewritten draft, and Next actions. Preserve truth: never invent metrics or experience; use [add metric] or [verify] where needed. Still provide the best usable rewritten draft even when clarifications are needed.\n\nCURRENT ${type.toUpperCase()}:\n${clippedText}${clippedJd.length >= 40 ? `\n\nJOB DESCRIPTION:\n${clippedJd}` : ''}`;
      const improved = await coach(prompt); result = { source: 'AI', text: improved, draft: improved, keywords: [], missing: [] };
    } else result = localResumeImprovement(type, clippedText, clippedJd);
  } catch (err) { console.warn('AI resume improvement skipped:', err.message); result = localResumeImprovement(type, clippedText, clippedJd); }
  try { res.json({ ...result, pdfBase64: await resumePdf(result.draft), fileName: `switchboard-tailored-${type}.pdf` }); } catch (err) { res.status(500).json({ error: 'The tailored draft was created but its PDF could not be generated.' }); }
});
app.post('/api/resume/overleaf', async (req, res) => {
  const { latex = '', jobDescription = '' } = req.body || {};
  if (typeof latex !== 'string' || latex.trim().length < 80 || !/\\documentclass|\\begin\{document\}/.test(latex)) return res.status(400).json({ error: 'Upload the main Overleaf .tex file (it must include the document preamble).' });
  if (typeof jobDescription !== 'string') return res.status(400).json({ error: 'Job description must be text when supplied.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Overleaf source rewriting requires OPENAI_API_KEY. You can still use the local PDF/text review without AI credits.' });
  try {
    const target = jobDescription.trim().length >= 40 ? `Tailor for this job description:\n${jobDescription.trim().slice(0, 16000)}` : 'Perform a general senior-backend upgrade using the candidate context; no specific job description was provided.';
    const prompt = `Rewrite this existing Overleaf resume source. ${resumeContext}\n\n${target}\n\nReturn ONLY complete compilable LaTeX. Preserve the preamble, packages, custom macros, layout, contact details and section structure whenever possible. Change only resume prose; do not invent achievements, metrics or technologies. Use [add metric] or [verify] when needed.\n\nLATEX SOURCE:\n${latex.trim().slice(0, 50000)}`;
    const output = (await coach(prompt)).replace(/^```(?:latex|tex)?\s*/i, '').replace(/\s*```$/, '');
    if (!/\\begin\{document\}/.test(output)) throw new Error('The AI response was not complete LaTeX. Please try again.');
    res.json({ latex: output, fileName: 'switchboard-tailored-resume.tex' });
  } catch (err) { res.status(503).json({ error: err.message || 'Could not tailor the Overleaf source.' }); }
});
app.post('/api/linkedin/extract', async (req, res) => {
  try {
    const { url = '' } = req.body || {};
    const parsed = new URL(url);
    if (!/(^|\.)linkedin\.com$/i.test(parsed.hostname) || !/^\/in\//i.test(parsed.pathname)) throw new Error('Use a public LinkedIn profile URL such as https://www.linkedin.com/in/your-name/.');
    const response = await fetch(parsed, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Switchboard career review)' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('LinkedIn did not make this profile available for automatic reading. Paste the profile text below instead.');
    const html = await response.text();
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (text.length < 100 || /authwall|sign in/i.test(text)) throw new Error('LinkedIn requires a sign-in for this profile. Paste the public profile text below instead.');
    res.json({ text: text.slice(0, 24000), url: parsed.toString() });
  } catch (err) { res.status(400).json({ error: err.message || 'Could not read that LinkedIn profile.' }); }
});
app.post('/api/interview-room', (req, res) => {
  const { consent, title = 'backend-mock' } = req.body || {};
  if (consent !== true) return res.status(403).json({ error: 'Both participants must approve the interview room before it is created.' });
  const domain = process.env.JITSI_DOMAIN;
  if (!domain) return res.status(503).json({ error: 'Video rooms are not configured. Add JITSI_DOMAIN before creating an interview room.' });
  const room = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 36)}-${Math.random().toString(36).slice(2, 8)}`;
  res.json({ room, url: `https://${domain}/${room}`, providerConfigured: true });
});
const port = process.env.PORT || 8787;
const dist = join(__dirname, '../dist');
if (existsSync(dist)) { app.use(express.static(dist)); app.get('*', (_, res) => res.sendFile(join(dist, 'index.html'))); }
app.listen(port, () => console.log(`Switchboard API: http://localhost:${port}`));
