import PDFDocument from 'pdfkit';

const KEYWORDS = [
  'java',
  'spring boot',
  'spring',
  'python',
  'django',
  'fastapi',
  'golang',
  'node.js',
  'typescript',
  'javascript',
  'react',
  'c++',
  'c#',
  '.net',
  'kotlin',
  'rust',
  'kafka',
  'rabbitmq',
  'mysql',
  'postgresql',
  'mongodb',
  'redis',
  'elasticsearch',
  'sql',
  'aws',
  'azure',
  'gcp',
  'docker',
  'kubernetes',
  'terraform',
  'ci/cd',
  'rest',
  'grpc',
  'graphql',
  'microservices',
  'distributed systems',
  'system design',
  'testing',
  'observability',
  'performance',
  'concurrency',
];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const findKeywords = (text) =>
  KEYWORDS.filter((k) => new RegExp(`(?<![a-z0-9])${escape(k)}(?![a-z0-9+#])`, 'i').test(text));

/** Rule-based checks on the supplied text. This never writes or invents resume content. */
export function analyseMaterial(text, jobDescription = '') {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines.filter((l) => /^[•▪●◦*\-–]\s+/.test(l));
  const evidence = bullets.length ? bullets : lines;
  const measured = evidence.filter((l) =>
    /\d+(\.\d+)?\s*(%|x\b|ms\b|k\b|m\b|\+|seconds?|hours?|users|requests|rps|qps|tps|services|orders)|[₹$]\s?\d/i.test(
      l,
    ),
  );
  const weak = evidence.filter((l) =>
    /\b(responsible for|worked on|helped|involved in)\b/i.test(l),
  );
  const words = text.split(/\s+/).filter(Boolean).length;
  const wanted = findKeywords(jobDescription);
  const present = findKeywords(text);
  const missing = wanted.filter((k) => !present.includes(k));
  const checks = [
    [
      measured.length >= 2,
      'At least two lines show a measurable result',
      'Add real scale or outcome numbers (latency, throughput, users, cost, time saved).',
    ],
    [
      weak.length === 0,
      'No weak openings such as "worked on" or "responsible for"',
      `Rewrite ${weak.length} line(s) to start with what you did and what changed.`,
    ],
    [
      bullets.length >= 3,
      'Experience is written as bullet points',
      'Break experience into short bullets, one achievement each.',
    ],
    [
      words >= 150 && words <= 900,
      'Length is between 150 and 900 words',
      `The text is ${words} words.`,
    ],
    [
      present.length >= 3,
      'Names at least three technologies or engineering skills',
      'Name the technologies you actually used.',
    ],
  ].map(([passed, label, fix]) => ({ passed, label, fix }));
  if (wanted.length)
    checks.push({
      passed: missing.length === 0,
      label: 'Covers the keywords found in the job description',
      fix: `Not found: ${missing.join(', ')}. Add one only if you have really used it.`,
    });
  const score = Math.round((100 * checks.filter((c) => c.passed).length) / checks.length);
  const report = `Rule-based check (no AI). Passed ${checks.filter((c) => c.passed).length} of ${checks.length}.\n\n${checks
    .map((c) => `${c.passed ? '✓' : '✗'} ${c.label}${c.passed ? '' : `\n   Fix: ${c.fix}`}`)
    .join('\n')}`;
  return { checks, score, missing, report };
}

export function draftSection(markdown) {
  const match = markdown.match(/^#{1,4}\s*\**Rewritten draft\**:?\s*$/im);
  if (!match) return '';
  const rest = markdown.slice(match.index + match[0].length);
  const end = rest.search(
    /^#{1,4}\s*\**(Next actions|Clarifications|Strengths|Gaps|Missing evidence)/im,
  );
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

export function resumePdf(text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    doc.on('error', reject);
    // The built-in PDF fonts cannot draw the rupee sign or Markdown emphasis.
    const printable = text
      .replace(/₹/g, 'INR ')
      .replace(/[•▪●◦]/g, '-')
      .replace(/\*\*|^#{1,4}\s*/gm, '');
    doc.fontSize(10).fillColor('#172036').text(printable, { lineGap: 4 });
    doc.end();
  });
}
