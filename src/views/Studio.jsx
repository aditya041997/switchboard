import React, { useEffect, useRef, useState } from 'react';
import { uid } from '../../shared/model.js';
import { linesToText, parseLines, placeholders, rulePoints } from '../../shared/studio.js';
import { api } from '../api.js';

const LINKEDIN_PARTS = [
  ['Headline', 2],
  ['About', 7],
  ['Experience', 9],
  ['Skills', 3],
];
const QUICK = ['Stronger impact', 'Shorter', 'Match the job description'];
const post = (path, body) => api(path, { method: 'POST', body });
const readFile = (file, how) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader[how](file);
  });
function download(href, name) {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
}
/** Puts saved LinkedIn text back into its boxes. */
function splitParts(text) {
  const parts = {};
  let part = 'About';
  for (const line of text.split('\n')) {
    const found = LINKEDIN_PARTS.find(([p]) => p.toLowerCase() === line.trim().toLowerCase());
    if (found) part = found[0];
    else parts[part] = parts[part] ? `${parts[part]}\n${line}` : line;
  }
  return parts;
}
/** Review points with the number shown beside them and in the preview. */
const numbered = (points) => points.map((p, i) => ({ ...p, number: i + 1 }));
const sectionOf = (lines, id) => {
  let section = '';
  for (const line of lines) {
    if (line.kind === 'heading') section = line.text;
    if (line.id === id) return section;
  }
  return section;
};

/** Interactive review of a resume or LinkedIn profile. The work is saved with your data. */
export default function Studio({ type, data, update, config, back }) {
  const isResume = type === 'resume';
  const name = isResume ? 'resume' : 'LinkedIn profile';
  const key = `${type}Studio`;
  const doc = data.profile[key];
  const ai = Boolean(config?.ai);
  const [editingSource, setEditingSource] = useState(!doc),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const save = (change) =>
    update((s) => ({
      ...s,
      profile: { ...s.profile, [key]: change(s.profile[key]) },
    }));
  const run = async (label, task) => {
    setBusy(label);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const review = (lines, jobDescription) =>
    run(ai ? 'AI is reviewing every line…' : 'Checking…', async () => {
      const result = ai
        ? await post('/studio/review', { type, lines, jobDescription, profile: data.profile })
        : { summary: '', strengths: [], general: [], points: rulePoints(lines) };
      const text = linesToText(lines);
      const checked = await post('/resume/review-checks', {
        text,
        jobDescription,
      });
      const label = isResume ? 'resume' : 'LinkedIn';
      await update((s) => ({
        ...s,
        profile: {
          ...s.profile,
          [key]: { ...result, lines, jobDescription },
          [`${type}Text`]: text,
          [`${type}Score`]: checked.score,
        },
        // Replace this document's open fixes so repeated reviews do not pile up duplicates.
        careerChecks: [
          ...checked.checks
            .filter((c) => !c.passed)
            .map((c) => ({ id: uid(), title: c.label, note: c.fix, type: label, done: false })),
          ...s.careerChecks.filter((c) => c.done || c.type !== label),
        ],
      }));
      setEditingSource(false);
    });

  return (
    <>
      <button className="text-btn back-btn" onClick={back}>
        ← Back to career lab
      </button>
      <p className="interview-hint">
        {ai
          ? `Your ${name} text is sent to OpenAI. Email addresses and phone numbers are masked first.`
          : 'AI is off. You get rule-based points and can edit lines yourself.'}
      </p>
      {error && (
        <p className="coach-error" role="alert">
          {error}
        </p>
      )}
      {editingSource || !doc ? (
        <Source
          type={type}
          data={data}
          doc={doc}
          busy={busy}
          run={run}
          review={review}
          cancel={doc ? () => setEditingSource(false) : null}
        />
      ) : (
        <Board
          type={type}
          doc={doc}
          data={data}
          ai={ai}
          busy={busy}
          save={save}
          again={() =>
            confirm('Review the updated text again? The current points are replaced.') &&
            review(doc.lines, doc.jobDescription)
          }
          replace={() => setEditingSource(true)}
        />
      )}
      {isResume && ai && <Overleaf data={data} doc={doc} busy={busy} run={run} />}
    </>
  );
}

function Source({ type, data, doc, busy, run, review, cancel }) {
  const isResume = type === 'resume';
  const previous = doc ? linesToText(doc.lines) : data.profile[`${type}Text`] || '';
  const [text, setText] = useState(previous),
    [parts, setParts] = useState(() => splitParts(previous)),
    [jd, setJd] = useState(doc?.jobDescription || '');
  const source = isResume
    ? text
    : LINKEDIN_PARTS.filter(([part]) => parts[part]?.trim())
        .map(([part]) => `${part}\n${parts[part].trim()}`)
        .join('\n');
  const upload = (file) =>
    file &&
    run('Reading PDF…', async () => {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF smaller than 5 MB.');
      const dataUrl = await readFile(file, 'readAsDataURL');
      setText((await post('/resume/extract', { fileName: file.name, dataUrl })).text);
    });
  const start = () => {
    if (doc && !confirm('Start a new review? Decisions on the current points are replaced.'))
      return;
    review(parseLines(source, type), jd);
  };
  return (
    <section className="card interview-form">
      {isResume ? (
        <>
          <label>
            Upload resume PDF (max 5 MB)
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => upload(e.target.files[0])}
            />
          </label>
          <label>
            Resume text
            <textarea rows="12" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        </>
      ) : (
        LINKEDIN_PARTS.map(([part, rows]) => (
          <label key={part}>
            {part}
            <textarea
              rows={rows}
              value={parts[part] || ''}
              onChange={(e) => setParts({ ...parts, [part]: e.target.value })}
              placeholder={`Paste your ${part} from LinkedIn`}
            />
          </label>
        ))
      )}
      <label>
        Target job description (optional)
        <textarea rows="5" value={jd} onChange={(e) => setJd(e.target.value)} />
      </label>
      <div className="row-actions">
        <button
          className="primary mini"
          disabled={Boolean(busy) || source.trim().length < 40}
          onClick={start}
        >
          {busy || 'Review →'}
        </button>
        {cancel && (
          <button className="link" onClick={cancel}>
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}

function Board({ type, doc, data, ai, busy, save, again, replace }) {
  const isResume = type === 'resume';
  const [tab, setTab] = useState('open');
  const points = numbered(doc.points);
  const open = points.filter((p) => p.status === 'open');
  const shown = tab === 'open' ? open : points.filter((p) => p.status !== 'open');
  const lineOf = (id) => doc.lines.find((l) => l.id === id);
  const setLine = (d, id, text) => ({
    ...d,
    lines: d.lines.map((l) => (l.id === id ? { ...l, text } : l)),
  });
  const setPoint = (d, id, change) => ({
    ...d,
    points: d.points.map((p) => (p.id === id ? { ...p, ...change } : p)),
  });
  const decide = (point, status, text) =>
    save((d) => {
      const current = d.lines.find((l) => l.id === point.lineId).text;
      const saved = d.points.find((p) => p.id === point.id);
      if (status === 'accepted')
        return setLine(setPoint(d, point.id, { status, before: current }), point.lineId, text);
      const next = setPoint(d, point.id, { status, before: undefined });
      // Reopening an accepted point puts back what the line said before.
      return saved.status === 'accepted' && saved.before
        ? setLine(next, point.lineId, saved.before)
        : next;
    });
  const decided = points.length - open.length;

  return (
    <>
      <section className="card studio-summary">
        <div className="row-actions spread">
          <p className="eyebrow">
            {doc.score != null ? `AI SCORE ${doc.score}/100 · ` : ''}
            {decided} OF {points.length} POINTS HANDLED
          </p>
          <span className="row-actions">
            <button className="small-btn" disabled={Boolean(busy)} onClick={again}>
              {busy || 'Review again'}
            </button>
            <button className="link" onClick={replace}>
              Change text or job description
            </button>
          </span>
        </div>
        <progress max={points.length || 1} value={decided} aria-label="Points handled" />
        {doc.summary && <p>{doc.summary}</p>}
        {doc.strengths?.length > 0 && <p>Strengths: {doc.strengths.join(' · ')}</p>}
        {doc.general?.length > 0 && (
          <div className="studio-general">
            {doc.general.map((g) => (
              <label key={g.id} className={g.done ? 'done' : ''}>
                <input
                  type="checkbox"
                  checked={g.done}
                  onChange={() =>
                    save((d) => ({
                      ...d,
                      general: d.general.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)),
                    }))
                  }
                />
                <span>
                  <b>{g.title}</b> {g.detail}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>
      <div className="studio">
        <div className="studio-points">
          <div className="steps" role="tablist">
            {[
              ['open', `To review (${open.length})`],
              ['handled', `Handled (${decided})`],
              ['lines', 'All lines'],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'lines' ? (
            doc.lines.map((line) => (
              <LineEditor
                key={`${line.id}:${line.text}`}
                line={line}
                onSave={(text) => save((d) => setLine(d, line.id, text))}
                onAdd={
                  ai && !['name', 'heading'].includes(line.kind)
                    ? () => {
                        save((d) =>
                          d.points.some((p) => p.lineId === line.id)
                            ? setPoint(d, d.points.find((p) => p.lineId === line.id).id, {
                                status: 'open',
                              })
                            : {
                                ...d,
                                points: [
                                  ...d.points,
                                  {
                                    id: uid(),
                                    lineId: line.id,
                                    priority: 'low',
                                    issue: 'Added by you.',
                                    question: 'What should the AI know about this line?',
                                    options: [],
                                    status: 'open',
                                  },
                                ],
                              },
                        );
                        setTab('open');
                      }
                    : null
                }
              />
            ))
          ) : shown.length ? (
            shown.map((point) => (
              <Point
                key={point.id}
                type={type}
                point={point}
                line={lineOf(point.lineId)}
                section={sectionOf(doc.lines, point.lineId)}
                jobDescription={doc.jobDescription}
                profile={data.profile}
                ai={ai}
                decide={decide}
                change={(fields) => save((d) => setPoint(d, point.id, fields))}
              />
            ))
          ) : (
            <p className="interview-hint">
              {tab === 'open' ? 'Every point is handled.' : 'Nothing handled yet.'}
            </p>
          )}
        </div>
        {isResume ? (
          <PdfPreview lines={doc.lines} points={points} />
        ) : (
          <ProfilePreview lines={doc.lines} points={points} />
        )}
      </div>
    </>
  );
}

function Point({ type, point, line, section, jobDescription, profile, ai, decide, change }) {
  const [answer, setAnswer] = useState(''),
    [custom, setCustom] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!line) return null;
  const handled = point.status !== 'open';
  const rewrite = async (instruction = '') => {
    setBusy(true);
    setError('');
    try {
      const result = await post('/studio/rewrite', {
        type,
        line: line.text,
        section,
        answer,
        instruction,
        jobDescription,
        profile,
      });
      await change({ options: result.options, note: result.note, question: result.question });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={`card point ${point.status}`}>
      <p className="eyebrow">
        #{point.number} · {point.priority.toUpperCase()}
        {section ? ` · ${section.toUpperCase()}` : ''}
        {handled ? ` · ${point.status.toUpperCase()}` : ''}
      </p>
      <p className="issue">{point.issue}</p>
      <div className="now">
        <small>{handled ? 'NOW' : 'CURRENT'}</small>
        {line.text}
      </div>
      {handled ? (
        <button className="link" onClick={() => decide(point, 'open')}>
          {point.status === 'accepted' ? 'Undo this change' : 'Reopen'}
        </button>
      ) : (
        <>
          {point.options.map((o, i) => (
            <div className="option" key={i}>
              <small>SUGGESTION{point.options.length > 1 ? ` ${i + 1}` : ''}</small>
              {o.text}
              {o.check?.length > 0 && (
                <p className="verify">
                  Check these numbers, you did not give them: {o.check.join(', ')}
                </p>
              )}
              {placeholders(o.text).length > 0 && (
                <p className="verify">Fill in {placeholders(o.text).join(', ')} before sending.</p>
              )}
              <div className="row-actions">
                <button className="primary mini" onClick={() => decide(point, 'accepted', o.text)}>
                  Accept
                </button>
                <button className="small-btn" onClick={() => setCustom(o.text)}>
                  Edit
                </button>
              </div>
            </div>
          ))}
          {point.note && <p className="interview-hint">{point.note}</p>}
          {custom !== null && (
            <div className="option">
              <textarea
                rows="3"
                aria-label="Your version"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <button
                className="primary mini"
                disabled={!custom.trim()}
                onClick={() => decide(point, 'accepted', custom.trim())}
              >
                Use my version
              </button>
            </div>
          )}
          {ai && (
            <div className="ask">
              {point.question && <b>{point.question}</b>}
              <textarea
                rows="2"
                aria-label={`Your answer for point ${point.number}`}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer with real facts and the AI will rewrite the line"
              />
              <div className="row-actions">
                <button
                  className="small-btn"
                  disabled={busy || !answer.trim()}
                  onClick={() => rewrite()}
                >
                  {busy ? 'Writing…' : 'Rewrite with my answer'}
                </button>
                {QUICK.filter((q) => jobDescription || !q.includes('job')).map((q) => (
                  <button key={q} className="link" disabled={busy} onClick={() => rewrite(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="coach-error">{error}</p>}
          <div className="row-actions">
            <button className="link" onClick={() => setCustom(custom ?? line.text)}>
              Write my own
            </button>
            <button className="link" onClick={() => decide(point, 'skipped')}>
              Skip
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function LineEditor({ line, onSave, onAdd }) {
  const [text, setText] = useState(line.text);
  return (
    <div className={`line-edit ${line.kind}`}>
      <textarea
        rows={Math.min(6, Math.ceil(text.length / 70) || 1)}
        aria-label={`Line ${line.id.slice(1)}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() && text.trim() !== line.text && onSave(text.trim())}
      />
      {onAdd && (
        <button className="link" onClick={onAdd}>
          Improve with AI
        </button>
      )}
    </div>
  );
}

const markFor = (line, points) => {
  const point = points.find((p) => p.lineId === line.id);
  if (point?.status === 'open') return { mark: 'open', number: point.number };
  if (line.text !== line.original) return { mark: 'changed', number: point?.number };
  return {};
};

function PdfPreview({ lines, points }) {
  const [mode, setMode] = useState('marked'),
    [url, setUrl] = useState(''),
    [error, setError] = useState('');
  const body = lines.map(({ id, kind, text, original, ...line }) => ({
    id,
    kind,
    text: mode === 'original' ? original : text,
    ...(mode === 'marked' && markFor({ id, text, original, ...line }, points)),
  }));
  const signature = JSON.stringify(body);
  const latest = useRef(signature);
  latest.current = signature;
  useEffect(() => {
    const wait = setTimeout(async () => {
      try {
        const { pdfBase64 } = await post('/studio/pdf', { lines: body });
        if (latest.current !== signature) return;
        const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
        setUrl(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })));
        setError('');
      } catch (err) {
        setError(err.message);
      }
    }, 400);
    return () => clearTimeout(wait);
  }, [signature]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  const unfilled = lines.flatMap((l) => placeholders(l.text));
  const finish = async () => {
    try {
      const clean = lines.map(({ id, kind, text }) => ({ id, kind, text }));
      const { pdfBase64 } = await post('/studio/pdf', { lines: clean });
      download(`data:application/pdf;base64,${pdfBase64}`, 'resume-updated.pdf');
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <section className="card preview">
      <div className="steps" role="tablist">
        {[
          ['marked', 'With review marks'],
          ['clean', 'Updated'],
          ['original', 'Original'],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            className={mode === id ? 'active' : ''}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="interview-hint">
        Orange: waiting for you. Green: updated. Numbers match the points. This is a plain
        one-column layout, not your original design.
      </p>
      {error && <p className="coach-error">{error}</p>}
      {url ? <iframe title="Resume PDF preview" src={url} /> : <p>Preparing preview…</p>}
      {unfilled.length > 0 && (
        <p className="verify">
          {unfilled.length} placeholder(s) still in the text: {unfilled.join(', ')}
        </p>
      )}
      <div className="row-actions">
        <button className="primary mini" onClick={finish}>
          Download updated PDF
        </button>
        {url && (
          <a className="link" href={url} target="_blank" rel="noreferrer">
            Open preview in a new tab ↗
          </a>
        )}
      </div>
    </section>
  );
}

/** LinkedIn has no file to produce, so each section is shown ready to copy. */
function ProfilePreview({ lines, points }) {
  const [copied, setCopied] = useState('');
  const sections = [];
  for (const line of lines) {
    if (line.kind === 'heading' || !sections.length)
      sections.push({ title: line.kind === 'heading' ? line.text : 'Profile', lines: [] });
    if (line.kind !== 'heading') sections.at(-1).lines.push(line);
  }
  const copy = async (section) => {
    try {
      await navigator.clipboard.writeText(linesToText(section.lines));
      setCopied(section.title);
    } catch {
      setCopied('Copy failed. Select the text instead.');
    }
  };
  return (
    <section className="card preview profile-preview">
      <p className="eyebrow">UPDATED PROFILE</p>
      <p className="interview-hint">
        Orange: waiting for you. Green: updated. Copy each section into LinkedIn.
      </p>
      {sections.map((section, i) => {
        const length = linesToText(section.lines).length;
        const limit = { headline: 220, about: 2600 }[section.title.toLowerCase()];
        return (
          <div key={i}>
            <div className="row-actions spread">
              <h4>{section.title}</h4>
              <button className="link" onClick={() => copy(section)}>
                {copied === section.title ? 'Copied ✓' : `Copy ${section.title}`}
              </button>
            </div>
            {section.lines.map((line) => {
              const { mark, number } = markFor(line, points);
              return (
                <p key={line.id} className={mark || ''}>
                  {number ? <sup>{number}</sup> : null}
                  {line.kind === 'bullet' ? '• ' : ''}
                  {line.text}
                </p>
              );
            })}
            {limit && (
              <small className={length > limit ? 'verify' : ''}>
                {length} / {limit} characters
              </small>
            )}
          </div>
        );
      })}
      {copied.startsWith('Copy failed') && <p className="coach-error">{copied}</p>}
    </section>
  );
}

function Overleaf({ data, doc, busy, run }) {
  const [latex, setLatex] = useState('');
  return (
    <details className="card manual">
      <summary>Using Overleaf? Rewrite your .tex and keep your template</summary>
      <input
        type="file"
        accept=".tex"
        aria-label="LaTeX file"
        onChange={(e) =>
          e.target.files[0] &&
          run('Reading…', async () => setLatex(await readFile(e.target.files[0], 'readAsText')))
        }
      />
      <button
        className="small-btn"
        disabled={Boolean(busy) || !latex}
        onClick={() =>
          run('Rewriting LaTeX…', async () => {
            const body = await post('/resume/overleaf', {
              latex,
              jobDescription: doc?.jobDescription || '',
              profile: data.profile,
            });
            download(
              `data:text/plain;charset=utf-8,${encodeURIComponent(body.latex)}`,
              body.fileName,
            );
          })
        }
      >
        {busy || 'Rewrite and download .tex'}
      </button>
    </details>
  );
}
