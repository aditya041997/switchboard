import React, { useState } from 'react';
import { CardTop, Empty } from '../ui.jsx';
import Studio from './Studio.jsx';

const NAMES = { resume: 'resume', linkedin: 'LinkedIn' };

export default function CareerLab({ data, update, config }) {
  const [reviewing, setReviewing] = useState(null);
  const change = (fn) => update((s) => ({ ...s, careerChecks: fn(s.careerChecks) }));
  if (reviewing)
    return (
      <Studio
        key={reviewing}
        type={reviewing}
        data={data}
        update={update}
        config={config}
        back={() => setReviewing(null)}
      />
    );
  return (
    <>
      <section className="career-hero">
        <div>
          <p className="eyebrow">PRESENT YOUR BEST WORK</p>
          <h2>
            Career materials, <em>under a lens.</em>
          </h2>
          <p>Go through your resume and LinkedIn point by point. You approve every change.</p>
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
                {data.profile[`${type}Studio`] ? 'Continue with' : 'Review'} my {name}{' '}
                <span>→</span>
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
    </>
  );
}
