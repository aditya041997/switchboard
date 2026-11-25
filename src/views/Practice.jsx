import React from 'react';
import {
  DSA_STATUSES,
  addRevisions,
  localDate,
  reviewRevision,
  skillStatus,
  uid,
} from '../../shared/model.js';
import { CardTop, Empty, Select, formValues } from '../ui.jsx';

const LEVELS = ['Easy', 'Medium', 'Hard'];

export function DsaLab({ data, update, startSession }) {
  const setStatus = (item, status) =>
    update((s) => ({
      ...s,
      dsa: s.dsa.map((x) => (x.id === item.id ? { ...x, status, lastPractised: localDate() } : x)),
      revisions: status.startsWith('Solved')
        ? addRevisions(
            s.revisions,
            [`DSA: ${item.problem}`],
            'DSA lab',
            status === 'Solved with help' ? 'High' : 'Medium',
          )
        : s.revisions,
    }));
  const start = (item) =>
    startSession(
      {
        topic: 'DSA & coding',
        exercise: item.problem,
        summary: `Solve: ${item.problem}\nPattern: ${item.pattern} · ${item.difficulty}\n\nWrite your approach, complexity, code and edge cases.`,
      },
      (s) => ({
        ...s,
        dsa: s.dsa.map((x) =>
          x.id === item.id ? { ...x, status: 'In progress', lastPractised: localDate() } : x,
        ),
      }),
    );
  return (
    <>
      <section className="dsa-hero card panel">
        <div>
          <p className="eyebrow">INTERVIEW REPETITIONS</p>
          <h2>
            DSA <em>without crutches.</em>
          </h2>
          <p>Attempt first. Explain your trade-offs. Then earn the hint.</p>
        </div>
        <div className="dsa-stats">
          {LEVELS.map((level) => {
            const all = data.dsa.filter((x) => x.difficulty === level);
            return (
              <span key={level}>
                <b>
                  {all.filter((x) => x.status.startsWith('Solved')).length}/{all.length}
                </b>
                {level}
              </span>
            );
          })}
        </div>
      </section>
      <section className="card table-card">
        <CardTop eyebrow="PATTERN LIBRARY" title="Practice queue" />
        <form
          className="inline-form"
          onSubmit={(e) => {
            const f = formValues(e);
            e.currentTarget.reset();
            update((s) => ({
              ...s,
              dsa: [{ id: uid(), ...f, status: 'To practise', lastPractised: '' }, ...s.dsa],
            }));
          }}
        >
          <label>
            Problem
            <input required name="problem" />
          </label>
          <label>
            Pattern
            <input required name="pattern" />
          </label>
          <Select label="Level" name="difficulty" options={LEVELS} />
          <button className="primary mini">+ Add problem</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Problem</th>
              <th>Level</th>
              <th>Progress</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.dsa.map((x) => (
              <tr key={x.id}>
                <td>
                  <b>{x.pattern}</b>
                </td>
                <td>{x.problem}</td>
                <td>
                  <span className={`difficulty ${x.difficulty.toLowerCase()}`}>{x.difficulty}</span>
                </td>
                <td>
                  <select
                    aria-label={`Progress for ${x.problem}`}
                    value={x.status}
                    onChange={(e) => setStatus(x, e.target.value)}
                  >
                    {DSA_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td className="row-actions">
                  <button className="small-btn" onClick={() => start(x)}>
                    Practise
                  </button>
                  <button
                    className="link danger"
                    onClick={() =>
                      confirm(`Remove ${x.problem}?`) &&
                      update((s) => ({ ...s, dsa: s.dsa.filter((p) => p.id !== x.id) }))
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

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
