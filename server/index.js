import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');
const dataFile = join(dataDir, 'switchboard.json');
const app = express();
app.use(cors()); app.use(express.json({ limit: '1mb' }));

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
async function backup(data) { if (!process.env.MONGODB_URI) return; try { mongo ??= new MongoClient(process.env.MONGODB_URI); await mongo.connect(); await mongo.db(process.env.MONGODB_DATABASE || 'switchboard').collection('backups').updateOne({ _id: 'primary' }, { $set: { data, updatedAt: new Date() } }, { upsert: true }); } catch (err) { console.warn('Mongo backup skipped:', err.message); } }
app.get('/api/state', async (_, res) => { const local = read(); const cloud = await mongoData(); if (cloud) localWrite(cloud); res.json(cloud || local); });
app.put('/api/state', async (req, res) => { const data = req.body; localWrite(data); await backup(data); res.json({ ok: true, mongoBackup: Boolean(process.env.MONGODB_URI) }); });
app.get('/api/sessions/:id', async (req, res) => {
  const cloud = await mongoData(); const state = cloud || read();
  const session = state.sessions.find(item => item.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  res.json(session);
});
app.get('/api/health', (_, res) => res.json({ localStore: true, mongoConfigured: Boolean(process.env.MONGODB_URI) }));
const coachRules = 'You are Switchboard, a rigorous backend engineering career coach. Do not reveal a coding solution before an attempt. Challenge vague answers with concrete failure scenarios. Be concise, practical, honest, and level-appropriate.';
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
app.post('/api/interview-room', (req, res) => {
  const { consent, title = 'backend-mock' } = req.body || {};
  if (consent !== true) return res.status(403).json({ error: 'Both participants must approve the interview room before it is created.' });
  const room = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 36)}-${Math.random().toString(36).slice(2, 8)}`;
  const domain = process.env.JITSI_DOMAIN;
  res.json({ room, url: domain ? `https://${domain}/${room}` : null, providerConfigured: Boolean(domain) });
});
const port = process.env.PORT || 8787;
const dist = join(__dirname, '../dist');
if (existsSync(dist)) { app.use(express.static(dist)); app.get('*', (_, res) => res.sendFile(join(dist, 'index.html'))); }
app.listen(port, () => console.log(`Switchboard API: http://localhost:${port}`));
