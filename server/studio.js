import { newNumbers } from '../shared/studio.js';
import { AiError } from './ai.js';
import { candidateContext, readJson, record } from './coach.js';

const str = { type: 'string' };
const list = (items) => ({ type: 'array', items });
const priority = { type: 'string', enum: ['high', 'medium', 'low'] };

export const REVIEW_FORMAT = {
  type: 'json_schema',
  name: 'document_review',
  strict: true,
  schema: record({
    score: { type: 'integer' },
    summary: str,
    strengths: list(str),
    points: list(record({ line: str, priority, issue: str, suggestion: str, question: str })),
    general: list(record({ title: str, detail: str, priority })),
  }),
};
export const REWRITE_FORMAT = {
  type: 'json_schema',
  name: 'line_rewrite',
  strict: true,
  schema: record({ options: list(str), note: str, question: str }),
};

const NAMES = { resume: 'resume', linkedin: 'LinkedIn profile' };
const HONESTY =
  'Use only facts the candidate supplied. Never invent employers, titles, technologies, ownership or metrics; write [add metric] or [verify] where evidence is missing.';
const STYLE = {
  resume: 'Resume bullets are one line or two, start with an action and state the result.',
  linkedin:
    'Write in the first person for the About section, natural and searchable by recruiters. The headline is at most 220 characters and About at most 2600.',
};
/** Contact details are not needed to improve wording, so they are not sent. */
export const mask = (text) =>
  text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(?:\+?\d[\s-]?){10,13}/g, '[phone] ');

const limited = (value, max = 600) =>
  String(value ?? '')
    .slice(0, max)
    .trim();

export function reviewPrompt({ type, lines, jobDescription, profile }) {
  const body = lines.map((l) => `${l.id} (${l.kind}): ${mask(l.text)}`).join('\n');
  return `Review this ${NAMES[type]} line by line for the candidate. Candidate context: ${candidateContext(profile)}
${HONESTY} ${STYLE[type]}
Give an honest score from 0 to 100, a two-sentence summary and up to 4 strengths.
In points, pick the lines that most need work (at most 20, most important first, never the name or a heading). For each give the line id, priority, the specific issue, a replacement for that line only (no bullet symbol), and one question whose answer would let you make it stronger.
In general, give up to 6 improvements that are not about a single line, such as missing sections, ordering or keywords${jobDescription ? ' from the job description that the candidate may truthfully add' : ''}.

<document>
${body}
</document>${jobDescription ? `\n<job_description>\n${jobDescription}\n</job_description>` : ''}`;
}

export function parseReview(reply, lines) {
  const data = readJson(reply);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const used = new Set();
  const points = (Array.isArray(data.points) ? data.points : [])
    .filter((p) => {
      const line = byId.get(p?.line);
      if (!line || ['name', 'heading'].includes(line.kind) || used.has(p.line)) return false;
      used.add(p.line);
      return true;
    })
    .slice(0, 25)
    .map((p) => {
      const original = byId.get(p.line).text;
      let suggestion = limited(p.suggestion, 2600);
      // A masked contact detail must never replace the real one.
      if (/\[(email|phone)\]/.test(suggestion)) suggestion = '';
      return {
        id: `p${p.line}`,
        lineId: p.line,
        priority: ['high', 'medium', 'low'].includes(p.priority) ? p.priority : 'medium',
        issue: limited(p.issue),
        question: limited(p.question),
        options: suggestion ? [{ text: suggestion, check: newNumbers(suggestion, original) }] : [],
        status: 'open',
      };
    });
  const summary = limited(data.summary, 1200);
  if (!summary) throw new AiError('The AI review was incomplete. Please try again.');
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(data.score)) || 0)),
    summary,
    strengths: (Array.isArray(data.strengths) ? data.strengths : [])
      .slice(0, 4)
      .map((s) => limited(s)),
    points,
    general: (Array.isArray(data.general) ? data.general : []).slice(0, 6).map((g, i) => ({
      id: `g${i + 1}`,
      title: limited(g?.title, 160),
      detail: limited(g?.detail),
      priority: g?.priority || 'medium',
      done: false,
    })),
  };
}

export function rewritePrompt({
  type,
  line,
  section,
  answer,
  instruction,
  jobDescription,
  profile,
}) {
  return `Rewrite one line of a ${NAMES[type]}. Candidate context: ${candidateContext(profile)}
${HONESTY} ${STYLE[type]}
Return 3 clearly different options for this line only (no bullet symbol), a short note on what changed, and one follow-up question if a missing fact would still help (otherwise an empty string).
${section ? `Section: ${section}\n` : ''}<line>
${mask(line)}
</line>${answer ? `\n<facts_from_candidate>\n${answer}\n</facts_from_candidate>` : ''}${instruction ? `\n<requested_style>\n${instruction}\n</requested_style>` : ''}${jobDescription ? `\n<job_description>\n${jobDescription}\n</job_description>` : ''}`;
}

export function parseRewrite(reply, { line, answer }) {
  const data = readJson(reply);
  const options = (Array.isArray(data.options) ? data.options : [])
    .map((o) => limited(o, 2600))
    .filter((o) => o && !/\[(email|phone)\]/.test(o))
    .slice(0, 3)
    .map((text) => ({ text, check: newNumbers(text, line, answer) }));
  if (!options.length) throw new AiError('The AI returned no rewrite. Please try again.');
  return { options, note: limited(data.note), question: limited(data.question) };
}
