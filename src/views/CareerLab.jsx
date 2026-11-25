import React, { useState } from 'react';
import { uid } from '../../shared/model.js';
import { api } from '../api.js';
import { CardTop, Empty, Modal } from '../ui.jsx';

const NAMES = { linkedin: 'LinkedIn', resume: 'resume' };

export default function CareerLab({ data, update, config }) {
  const [reviewing, setReviewing] = useState(null);
  const change = (fn) => update((s) => ({ ...s, careerChecks: fn(s.careerChecks) }));
  return (
    <>
      <section className="career-hero">
        <div>
          <p className="eyebrow">PRESENT YOUR BEST WORK</p>
          <h2>
            Career materials, <em>under a lens.</em>
          </h2>
          <p>Check your own text. Switchboard does not write claims for you in built-in mode.</p>
        </div>
      </section>
      <section className="career-grid">
        {Object.entries(NAMES).map(([type, name]) => {
          const score = data.profile[`${type}Score`];
          return (
            <article className="card material" key={type}>
              <p className="eyebrow">{name.toUpperCase()} CHECKLIST</p>
              <strong>
                {score ? score : '–'}
                <small>{score ? '% of checks passed' : ' not reviewed'}</small>
              </strong>
              <p>A rough writing checklist. It does not predict recruiter or ATS results.</p>
              <button className="text-btn" onClick={() => setReviewing(type)}>
                Review my {name} <span>→</span>
              </button>
            </article>
          );
        })}
      </section>
      <section className="card revision-card focus">
        <CardTop eyebrow="IMPROVEMENT QUEUE" title="Open fixes" />
        {!data.careerChecks.length && (
          <Empty title="Nothing queued.">Failed checks from a review appear here.</Empty>
        )}
        {data.careerChecks.map((c) => (
          <div className={`revision ${c.done ? 'done' : ''}`} key={c.id}>
            <button
              className="check"
              aria-label={`Mark ${c.title} ${c.done ? 'open' : 'done'}`}
              onClick={() =>
                change((all) => all.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))
              }
            >
              {c.done ? '✓' : ''}
            </button>
            <div>
              <h4>{c.title}</h4>
              <p>{c.note}</p>
            </div>
            <span className="tag muted">{c.type}</span>
            <button
              className="link danger"
              onClick={() => change((all) => all.filter((x) => x.id !== c.id))}
            >
              Remove
            </button>
          </div>
        ))}
      </section>
      {reviewing && (
        <ReviewModal
          type={reviewing}
          data={data}
          update={update}
          config={config}
          close={() => setReviewing(null)}
        />
      )}
    </>
  );
}

function download(href, name) {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
}
const readFile = (file, how) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader[how](file);
  });

function ReviewModal({ type, data, update, config, close }) {
  const name = NAMES[type];
  const [material, setMaterial] = useState(data.profile[`${type}Text`] || ''),
    [jd, setJd] = useState(''),
    [latex, setLatex] = useState(''),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
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
  const post = (path, body) => api(path, { method: 'POST', body });

  const uploadPdf = (file) =>
    file &&
    run('Reading PDF…', async () => {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF smaller than 5 MB.');
      const dataUrl = await readFile(file, 'readAsDataURL');
      setMaterial((await post('/resume/extract', { fileName: file.name, dataUrl })).text);
    });
  const review = () =>
    run('Reviewing…', async () => {
      setResult(null);
      const body = await post('/resume/review', {
        type,
        text: material,
        jobDescription: jd,
        profile: data.profile,
      });
      setResult(body);
      const failed = body.checks.filter((c) => !c.passed);
      await update((s) => ({
        ...s,
        profile: {
          ...s.profile,
          [`${type}Text`]: material,
          [`${type}Score`]: body.score,
        },
        // Replace this document's open fixes so repeated reviews do not pile up duplicates.
        careerChecks: [
          ...failed.map((c) => ({
            id: uid(),
            title: c.label,
            note: c.fix,
            type: name,
            done: false,
          })),
          ...s.careerChecks.filter((c) => c.done || c.type !== name),
        ],
      }));
    });
  const rewriteTex = () =>
    run('Rewriting LaTeX…', async () => {
      const body = await post('/resume/overleaf', {
        latex,
        jobDescription: jd,
        profile: data.profile,
      });
      download(`data:text/plain;charset=utf-8,${encodeURIComponent(body.latex)}`, body.fileName);
    });

  return (
    <Modal title={`Review my ${name}`} close={close}>
      <div className="interview-form">
        <p className="interview-hint">
          {config?.ai
            ? 'The text and job description below are sent to OpenAI. Remove contact details you do not want to share.'
            : 'AI is off. You get a rule-based checklist, and nothing is rewritten.'}
        </p>
        {type === 'resume' ? (
          <label>
            Upload resume PDF (max 5 MB)
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => uploadPdf(e.target.files[0])}
            />
          </label>
        ) : (
          <p className="interview-hint">Paste your headline, About and Experience text below.</p>
        )}
        <label>
          {name} text
          <textarea rows="11" value={material} onChange={(e) => setMaterial(e.target.value)} />
        </label>
        <label>
          Target job description (optional)
          <textarea rows="5" value={jd} onChange={(e) => setJd(e.target.value)} />
        </label>
        <button
          className="primary submit"
          disabled={Boolean(busy) || material.trim().length < 40}
          onClick={review}
        >
          {busy || 'Review →'}
        </button>
        {error && <p className="coach-error">{error}</p>}
        {result && (
          <article className="career-result">
            <p className="eyebrow">{result.source.toUpperCase()}</p>
            <pre>{result.text}</pre>
          </article>
        )}
        {result?.pdfBase64 && (
          <button
            className="small-btn"
            onClick={() =>
              download(`data:application/pdf;base64,${result.pdfBase64}`, `${type}-draft.pdf`)
            }
          >
            Download rewritten draft (PDF) — verify every claim
          </button>
        )}
        {type === 'resume' && config?.ai && (
          <div className="overleaf-panel">
            <b>Using Overleaf?</b>
            <span>Upload the main .tex file to rewrite it while keeping your template.</span>
            <input
              type="file"
              accept=".tex"
              onChange={(e) =>
                e.target.files[0] &&
                run('Reading…', async () =>
                  setLatex(await readFile(e.target.files[0], 'readAsText')),
                )
              }
            />
            <button className="small-btn" disabled={Boolean(busy) || !latex} onClick={rewriteTex}>
              Rewrite and download .tex
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
