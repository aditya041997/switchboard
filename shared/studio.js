/** Line model shared by the resume and LinkedIn studios. */
const BULLET = /^\s*(?:[•▪●◦‣·]\s*|[-–*]\s+)/;
const HEADINGS =
  /^(headline|about|summary|professional summary|profile|objective|experience|work experience|professional experience|employment|skills|technical skills|core skills|projects|personal projects|education|achievements|awards|certifications?|publications|activities|interests|languages)\s*:?$/i;

const isHeading = (line) =>
  HEADINGS.test(line) || (line.length <= 40 && /[A-Z]{3}/.test(line) && !/[a-z\d@|]/.test(line));

/** Splits text into editable lines and joins lines that PDF extraction wrapped. */
export function parseLines(text, type = 'resume') {
  const lines = [];
  for (const raw of String(text).split('\n')) {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value) continue;
    const bullet = BULLET.test(value);
    const content = value.replace(BULLET, '').trim();
    const last = lines.at(-1);
    const wrapped =
      !bullet &&
      last &&
      (last.kind === 'bullet' || last.kind === 'text') &&
      !/[.!?:]$/.test(last.text) &&
      (/^[a-z(%]/.test(value) || /(,| and| the| of| to| with| for| by)$/i.test(last.text));
    if (wrapped) {
      last.text = last.original = `${last.text} ${value}`;
      continue;
    }
    if (!content) continue;
    const kind = bullet
      ? 'bullet'
      : isHeading(content)
        ? 'heading'
        : type === 'resume' && !lines.length
          ? 'name'
          : 'text';
    lines.push({ id: `l${lines.length + 1}`, kind, text: content, original: content });
  }
  return lines.slice(0, 300);
}

export const linesToText = (lines) =>
  lines.map((l) => (l.kind === 'bullet' ? `- ${l.text}` : l.text)).join('\n');

/** Numbers in a suggestion that the candidate never supplied, so they must be checked. */
export function newNumbers(suggestion, ...sources) {
  const find = (s) =>
    String(s || '')
      .replace(/(\d),(?=\d)/g, '$1')
      .match(/(?<![A-Za-z\d.])\d+(?:\.\d+)?/g) || [];
  const known = new Set(sources.flatMap(find));
  return [...new Set(find(suggestion))].filter((n) => !known.has(n));
}

export const placeholders = (text) => String(text).match(/\[(add|verify)[^\]]*\]/gi) || [];

/** Points found without AI. They carry advice only, never replacement text. */
export function rulePoints(lines) {
  const points = [];
  for (const line of lines) {
    if (line.kind !== 'bullet') continue;
    const weak = /\b(responsible for|worked on|helped|involved in)\b/i.test(line.text);
    if (!weak && /\d/.test(line.text)) continue;
    points.push({
      id: `r${line.id}`,
      lineId: line.id,
      priority: weak ? 'high' : 'medium',
      issue: weak ? 'Weak opening that hides what you did.' : 'No measurable result.',
      question: weak
        ? 'What did you personally build or decide, and what changed?'
        : 'What scale, speed, cost or user number shows the result?',
      options: [],
      status: 'open',
    });
  }
  return points.slice(0, 25);
}
