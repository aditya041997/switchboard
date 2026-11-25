import React from 'react';
import { metrics, readiness, skillStatus, totalScore, isScored } from '../../shared/model.js';
import { CardTop } from '../ui.jsx';

export default function Overview({ data, open, go }) {
  const m = metrics(data),
    ready = readiness(data.skills),
    latest = data.sessions[0];
  return (
    <>
      {!data.profile.stack && (
        <div className="banner">
          <span>Set your level, stack and target role so coaching fits you.</span>
          <button className="primary mini" onClick={() => go('Profile')}>
            Set up profile →
          </button>
        </div>
      )}
      <section className="hero">
        <div>
          <p className="eyebrow">YOUR JOB SWITCH JOURNEY</p>
          <h2>
            {data.profile.targetRole || 'Software Engineer'}
            <br />
            <span>{data.profile.level} in the making.</span>
          </h2>
          <p className="sub">{data.profile.goal || 'One deliberate rep at a time.'}</p>
          <button className="primary" onClick={() => open('coach')}>
            Start today’s workout <b>→</b>
          </button>
        </div>
        <div className="readiness">
          <div className="ring" style={{ '--value': `${ready * 3.6}deg` }}>
            <span>
              {ready}
              <small>%</small>
            </span>
          </div>
          <div>
            <b>Interview readiness</b>
            <p>Average of your self-rated skills</p>
            <button className="text-btn" onClick={() => go('Skills')}>
              Rate skills →
            </button>
          </div>
        </div>
      </section>
      <section className="metrics">
        {[
          [m.sessions, 'Sessions', 'last 7 days'],
          [m.average === null ? '–' : `${m.average}/25`, 'Average score', 'last 7 scored sessions'],
          [m.independent === null ? '–' : `${m.independent}%`, 'Independent', 'of those sessions'],
          [m.due, 'Revisions', 'due now'],
        ].map(([value, label, note]) => (
          <div className="metric" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
            <small>{note}</small>
          </div>
        ))}
      </section>
      <div className="grid">
        <section className="card">
          <CardTop eyebrow="NEXT UP" title={m.due ? 'Clear your revisions' : 'Practice workout'} />
          <p className="prompt">
            {m.due
              ? `${m.due} concept(s) are due. Recall each one before looking at notes.`
              : 'Pick a focus, answer one question, get it scored, and gaps join your revision queue.'}
          </p>
          <button className="text-btn" onClick={() => (m.due ? go('Revisions') : open('coach'))}>
            Begin <span>→</span>
          </button>
        </section>
        <section className="card">
          <CardTop eyebrow="RECENT PERFORMANCE" title="Your last session">
            <button className="link" onClick={() => go('Sessions')}>
              View all
            </button>
          </CardTop>
          {latest ? (
            <div className="last">
              <div className="score">
                <b>{isScored(latest) ? totalScore(latest) : '–'}</b>
                <span>/25</span>
              </div>
              <div>
                <h4>{latest.exercise}</h4>
                <p>
                  {latest.topic} · {latest.date}
                </p>
              </div>
            </div>
          ) : (
            <p className="prompt">Your first session will create the baseline.</p>
          )}
        </section>
      </div>
      <section className="card focus">
        <CardTop eyebrow="FOCUS RADAR" title="Skills that need attention">
          <button className="link" onClick={() => go('Skills')}>
            Skill matrix
          </button>
        </CardTop>
        {data.skills
          .slice()
          .sort((a, b) => a.confidence - b.confidence)
          .slice(0, 3)
          .map((s) => (
            <div className="skill-row" key={s.id}>
              <div>
                <b>{s.area}</b>
                <span>{s.focus}</span>
              </div>
              <div className="progress">
                <i style={{ width: `${s.confidence}%` }} />
              </div>
              <strong>{s.confidence}%</strong>
              <small className="status">{skillStatus(s.confidence)}</small>
            </div>
          ))}
      </section>
    </>
  );
}
