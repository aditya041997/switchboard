// Data model shared by the browser and the API.
import { CATALOG_VERSION, mergeCatalog } from './catalog.js';

export const LEVELS = ['SDE 1', 'SDE 2', 'SDE 3'];
export const STAGES = ['Saved', 'Applied', 'Referral requested', 'Interview', 'Offer', 'Closed'];
export const DSA_STATUSES = [
  'To practise',
  'In progress',
  'Solved with help',
  'Solved independently',
];
export const DIMENSIONS = [
  ['correctness', 'Correctness'],
  ['depth', 'Depth'],
  ['problemSolving', 'Problem solving'],
  ['communication', 'Communication'],
  ['tradeoffs', 'Trade-offs'],
];
export const FOCUSES = [
  'DSA & coding',
  'Backend & API design',
  'Databases & data modelling',
  'Concurrency & performance',
  'System design',
  'Distributed systems',
  'CS foundations',
  'Testing & reliability',
  'Behavioral & leadership',
];
export const REVISION_INTERVALS = [1, 3, 7, 14, 30];
export const SCHEMA_VERSION = 2;

export const uid = () =>
  Array.from(globalThis.crypto.getRandomValues(new Uint8Array(8)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

/** Calendar date (YYYY-MM-DD) in the machine's local time zone, not UTC. */
export function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

const SKILLS = [
  ['k1', 'DSA', 'Patterns & problem solving'],
  ['k2', 'Programming', 'Language & runtime fundamentals'],
  ['k3', 'Backend engineering', 'APIs, data & reliability'],
  ['k4', 'System design', 'Scale, trade-offs & failure recovery'],
  ['k5', 'CS foundations', 'OS, networking & security'],
  ['k6', 'Leadership', 'Behavioral stories & influence'],
];
export const starterSkills = () =>
  SKILLS.map(([id, area, focus]) => ({ id, area, focus, confidence: 0 }));
export const starterProblems = () => mergeCatalog([]);

export function starterState() {
  return {
    meta: { version: SCHEMA_VERSION, rev: 0, updatedAt: 0, catalog: CATALOG_VERSION },
    profile: {
      name: '',
      targetRole: 'Backend Engineer',
      level: 'SDE 2',
      years: '',
      stack: '',
      goal: '',
      weeklyTarget: 5,
    },
    sessions: [],
    skills: starterSkills(),
    revisions: [],
    applications: [],
    dsa: starterProblems(),
    careerChecks: [],
    sharing: { enabled: false, viewers: [] },
    interviews: [],
  };
}

export const skillStatus = (confidence) =>
  confidence <= 0
    ? 'Not started'
    : confidence < 40
      ? 'Learning'
      : confidence < 75
        ? 'Practising'
        : 'Interview-ready';

export const isScored = (session) => Boolean(session?.scores);
export const totalScore = (session) =>
  DIMENSIONS.reduce((sum, [key]) => sum + Number(session?.scores?.[key] || 0), 0);

export function readiness(skills = []) {
  if (!skills.length) return 0;
  return Math.round(skills.reduce((s, k) => s + Number(k.confidence || 0), 0) / skills.length);
}

export function metrics(state, today = localDate()) {
  const weekStart = addDays(today, -6);
  const thisWeek = state.sessions.filter((s) => s.date >= weekStart && s.date <= today);
  const recent = state.sessions
    .filter(isScored)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  return {
    sessions: thisWeek.length,
    average: recent.length
      ? Math.round(recent.reduce((s, x) => s + totalScore(x), 0) / recent.length)
      : null,
    independent: recent.length
      ? Math.round((100 * recent.filter((s) => s.independent).length) / recent.length)
      : null,
    due: state.revisions.filter((r) => !r.done && r.due <= today).length,
  };
}

/** Adds one revision per new gap. An open revision for the same concept is not duplicated. */
export function addRevisions(
  revisions,
  concepts,
  source,
  priority = 'Medium',
  today = localDate(),
) {
  const open = new Set(revisions.filter((r) => !r.done).map((r) => r.concept.toLowerCase()));
  const added = [];
  for (const raw of concepts) {
    const concept = String(raw).trim();
    if (!concept || open.has(concept.toLowerCase())) continue;
    open.add(concept.toLowerCase());
    added.push({
      id: uid(),
      concept,
      source,
      priority,
      step: 0,
      due: addDays(today, REVISION_INTERVALS[0]),
      done: false,
    });
  }
  return [...added, ...revisions];
}

/** Spaced repetition: a successful recall moves to the next interval, a miss starts over. */
export function reviewRevision(revision, recalled, today = localDate()) {
  const step = recalled ? (revision.step || 0) + 1 : 0;
  if (step >= REVISION_INTERVALS.length) return { ...revision, step, done: true };
  return { ...revision, step, done: false, due: addDays(today, REVISION_INTERVALS[step]) };
}

/** Saves a score on a session and queues its gaps for revision. */
export function scoreSession(state, id, result, today = localDate()) {
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return state;
  const next = { ...session, ...result, status: 'Completed' };
  const priority = totalScore(next) < 15 ? 'High' : 'Medium';
  return {
    ...state,
    sessions: state.sessions.map((s) => (s.id === id ? next : s)),
    revisions: addRevisions(state.revisions, next.gaps || [], next.exercise, priority, today),
  };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const LISTS = [
  'sessions',
  'skills',
  'revisions',
  'applications',
  'dsa',
  'careerChecks',
  'interviews',
];

/** Returns a problem description, or null when the value is safe to store. */
export function validateState(state) {
  if (!isObject(state)) return 'State must be an object.';
  if (!isObject(state.profile)) return 'State is missing the profile.';
  for (const key of LISTS) {
    if (!Array.isArray(state[key]) || !state[key].every(isObject))
      return `State field "${key}" must be a list of records.`;
  }
  for (const s of state.sessions) {
    if (typeof s.id !== 'string' || typeof s.date !== 'string' || !Array.isArray(s.gaps))
      return 'Every session needs an id, a date and a list of gaps.';
    if (!Array.isArray(s.mastered)) return 'Every session needs a list of mastered concepts.';
  }
  if (!state.revisions.every((r) => typeof r.concept === 'string' && typeof r.due === 'string'))
    return 'Every revision needs a concept and a due date.';
  if (!isObject(state.sharing) || !Array.isArray(state.sharing.viewers))
    return 'State has invalid sharing settings.';
  return null;
}

const list = (v) => (Array.isArray(v) ? v.filter(isObject) : []);

/** Upgrades data written by earlier versions without dropping any of the user's records. */
export function migrateState(input) {
  const base = starterState();
  const source = isObject(input) ? input : {};
  const old = source.meta?.version !== SCHEMA_VERSION;
  const state = { ...base, ...source };
  for (const key of LISTS) state[key] = list(source[key]);
  state.profile = { ...base.profile, ...(isObject(source.profile) ? source.profile : {}) };
  state.sharing = {
    enabled: Boolean(source.sharing?.enabled),
    viewers: list(source.sharing?.viewers),
  };
  state.meta = {
    version: SCHEMA_VERSION,
    rev: Number(source.meta?.rev) || 0,
    updatedAt: Number(source.meta?.updatedAt) || 0,
    catalog: CATALOG_VERSION,
  };
  if (!state.skills.length) state.skills = starterSkills();
  // Runs once per catalog version, so problems the user removes later stay removed.
  if (isObject(input) && source.meta?.catalog !== CATALOG_VERSION)
    state.dsa = mergeCatalog(state.dsa);
  if (old) {
    state.interviews = state.interviews.filter((i) => i.roomUrl);
    state.sessions = state.sessions.map((s) => {
      const unscored =
        s.scores && totalScore(s) === 0 && ['Started', 'In progress'].includes(s.status);
      return {
        ...s,
        scores: unscored ? null : s.scores || null,
        gaps: Array.isArray(s.gaps) ? s.gaps : [],
        mastered: Array.isArray(s.mastered) ? s.mastered : [],
      };
    });
    state.revisions = state.revisions.map((r) => ({
      step: 0,
      priority: 'Medium',
      due: localDate(),
      ...r,
      concept: String(r.concept || 'Untitled'),
    }));
    for (const s of state.sessions.filter(isScored))
      state.revisions = addRevisions(state.revisions, s.gaps, s.exercise);
    state.dsa = state.dsa.map((p) => ({
      ...p,
      status: DSA_STATUSES.includes(p.status) ? p.status : 'To practise',
    }));
  }
  return state;
}
