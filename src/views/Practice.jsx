import React from 'react';
import { addRevisions, localDate, reviewRevision, skillStatus, uid } from '../../shared/model.js';
import { CardTop, Empty, formValues } from '../ui.jsx';

export function Skills({ data, update }) {
  const rate = (id, confidence) =>
    update((s) => ({
      ...s,
      skills: s.skills.map((x) => (x.id === id ? { ...x, confidence } : x)),
    }));
  return (
    <section className="skill-grid">
      {data.skills.map((s) => (
        <article className="card skill-card" key={s.id}>
          <p className="eyebrow">{s.area}</p>
          <h3>{s.focus}</h3>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            aria-label={`Confidence in ${s.area}`}
            value={s.confidence}
            onChange={(e) => rate(s.id, Number(e.target.value))}
          />
          <div>
            <b>{s.confidence}% confidence</b>
            <span className="status">{skillStatus(s.confidence)}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

export function Revisions({ data, update }) {
  const today = localDate();
  const change = (id, fn) =>
    update((s) => ({ ...s, revisions: s.revisions.map((r) => (r.id === id ? fn(r) : r)) }));
  const sorted = data.revisions
    .slice()
    .sort((a, b) => a.done - b.done || a.due.localeCompare(b.due));
  return (
    <section className="card revision-card">
      <CardTop eyebrow="SPACED REPETITION · 1, 3, 7, 14, 30 DAYS" title="Revision queue">
        <span className="pill">{data.revisions.filter((r) => !r.done).length} open</span>
      </CardTop>
      <form
        className="inline-form"
        onSubmit={(e) => {
          const { concept } = formValues(e);
          e.currentTarget.reset();
          update((s) => ({
            ...s,
            revisions: addRevisions(s.revisions, [concept], 'Added by you'),
          }));
        }}
      >
        <label>
          Concept
          <input required name="concept" placeholder="e.g. isolation levels" />
        </label>
        <button className="primary mini">+ Add</button>
      </form>
      {!sorted.length && (
        <Empty title="Nothing to revise yet.">Gaps from scored sessions appear here.</Empty>
      )}
      {sorted.map((r) => (
        <div className={`revision ${r.done ? 'done' : ''}`} key={r.id}>
          <div>
            <h4>{r.concept}</h4>
            <p>From {r.source}</p>
          </div>
          <time>{r.done ? 'Mastered' : r.due <= today ? 'Due now' : `Due ${r.due}`}</time>
          <div className="row-actions">
            {!r.done && r.due <= today && (
              <>
                <button
                  className="small-btn"
                  onClick={() => change(r.id, (x) => reviewRevision(x, true))}
                >
                  Recalled
                </button>
                <button
                  className="small-btn"
                  onClick={() => change(r.id, (x) => reviewRevision(x, false))}
                >
                  Forgot
                </button>
              </>
            )}
            <button
              className="link danger"
              onClick={() =>
                update((s) => ({ ...s, revisions: s.revisions.filter((x) => x.id !== r.id) }))
              }
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
