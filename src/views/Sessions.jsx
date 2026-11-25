import React, { useState } from 'react';
import {
  DIMENSIONS,
  FOCUSES,
  LEVELS,
  isScored,
  localDate,
  scoreSession,
  totalScore,
} from '../../shared/model.js';
import { api } from '../api.js';
import { CardTop, Empty, Modal, Select, formValues } from '../ui.jsx';

const splitList = (value) =>
  value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export function Sessions({ data, open, openSession }) {
  return (
    <section className="card table-card">
      <CardTop eyebrow="ACTIVITY HISTORY" title="Session log">
        <button className="primary mini" onClick={() => open('session')}>
          + Add reflection
        </button>
      </CardTop>
      {data.sessions.length ? (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Topic & exercise</th>
              <th>Status</th>
              <th>Score</th>
              <th>Gaps</th>
            </tr>
          </thead>
          <tbody>
            {data.sessions.map((s) => (
              <tr className="session-row" key={s.id} onClick={() => openSession(s.id)}>
                <td>{s.date}</td>
                <td>
                  <b>{s.topic}</b>
                  <span>{s.exercise}</span>
                </td>
                <td>
                  <span className={s.independent ? 'yes' : 'partial'}>
                    {!isScored(s) ? 'Not scored' : s.independent ? 'Independent' : 'Guided'}
                  </span>
                </td>
                <td>
                  <b>{isScored(s) ? `${totalScore(s)}/25` : '–'}</b>
                </td>
                <td>
                  {s.gaps.map((x) => (
                    <span className="tag muted" key={x}>
                      {x}
                    </span>
                  ))}
                  <button className="link detail-arrow">View →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty title="No sessions yet.">Start a workout or log one you did elsewhere.</Empty>
      )}
    </section>
  );
}

function ScoreForm({ session, onSave }) {
  return (
    <form
      onSubmit={(e) => {
        const f = formValues(e);
        onSave({
          scores: Object.fromEntries(DIMENSIONS.map(([key]) => [key, Number(f[key])])),
          independent: Boolean(f.independent),
          minutes: Number(f.minutes),
          gaps: splitList(f.gaps),
          mastered: splitList(f.mastered),
        });
      }}
    >
      <p className="form-caption">Rate each dimension (0–5)</p>
      <div className="scores">
        {DIMENSIONS.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              required
              name={key}
              type="number"
              min="0"
              max="5"
              defaultValue={session.scores?.[key] ?? ''}
            />
          </label>
        ))}
      </div>
      <label className="switch-line">
        <input type="checkbox" name="independent" defaultChecked={session.independent} /> Solved
        without help
      </label>
      <label>
        Minutes spent
        <input type="number" name="minutes" min="1" defaultValue={session.minutes || 15} />
      </label>
      <label>
        Gaps (comma separated, added to revisions)
        <input name="gaps" defaultValue={session.gaps.join(', ')} />
      </label>
      <label>
        Mastered (comma separated)
        <input name="mastered" defaultValue={session.mastered.join(', ')} />
      </label>
      <button className="primary submit">Save score</button>
    </form>
  );
}

export function SessionDetail({ data, update, config, id, back }) {
  const session = data.sessions.find((s) => s.id === id);
  const [answer, setAnswer] = useState(session?.answer || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!session)
    return (
      <section className="card empty-detail">
        <button className="text-btn" onClick={back}>
          ← Back to session log
        </button>
        <h3>Session not found.</h3>
      </section>
    );
  const patch = (fields) =>
    update((s) => ({
      ...s,
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...fields } : x)),
    }));
  const save = (result) => update((s) => scoreSession(s, id, { answer, ...result }));
  const question = session.summary || session.exercise;
  const evaluate = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api('/coach/evaluate', {
        method: 'POST',
        body: {
          exercise: question,
          answer,
          focus: session.topic,
          level: session.level || data.profile.level,
          profile: data.profile,
        },
      });
      // A score from the coach does not prove the work was done without help.
      await save({ ...result, independent: session.independent });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = () => {
    if (!confirm('Delete this session?')) return;
    update((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) }));
    back();
  };
  return (
    <>
      <button className="text-btn back-btn" onClick={back}>
        ← Back to session log
      </button>
      <section className="detail-hero">
        <div>
          <p className="eyebrow">
            {session.topic.toUpperCase()} · {session.date}
          </p>
          <h2>{session.exercise}</h2>
        </div>
        <div className="detail-score">
          <b>{isScored(session) ? totalScore(session) : '–'}</b>
          <span>/25</span>
        </div>
      </section>
      <div className="detail-grid">
        <section className="card">
          <p className="eyebrow">QUESTION</p>
          <div className="question">{question}</div>
          <label>
            Your answer
            <textarea
              rows="12"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer before asking for feedback: approach, trade-offs, failure cases, code."
            />
          </label>
          <div className="row-actions">
            <button className="small-btn" onClick={() => patch({ answer })}>
              Save answer
            </button>
            <button
              className="primary mini"
              onClick={evaluate}
              disabled={busy || !config?.ai || answer.trim().length < 20}
            >
              {busy ? 'Evaluating…' : 'Get AI feedback and score'}
            </button>
          </div>
          {!config?.ai && (
            <p className="interview-hint">AI is off. Score yourself with the form instead.</p>
          )}
          {error && <p className="coach-error">{error}</p>}
          {session.feedback && (
            <article className="career-result">
              <p className="eyebrow">COACH FEEDBACK</p>
              <pre>{session.feedback}</pre>
              {session.followUp && (
                <p>
                  <b>Follow-up:</b> {session.followUp}
                </p>
              )}
            </article>
          )}
        </section>
        <section className="card">
          <p className="eyebrow">EVALUATION</p>
          <h3>{isScored(session) ? 'Interview signals' : 'Score this session'}</h3>
          {/* The key resets the form when a new score arrives. */}
          <ScoreForm
            key={JSON.stringify([session.scores, session.gaps])}
            session={session}
            onSave={save}
          />
          <button className="text-btn danger" onClick={remove}>
            Delete session
          </button>
        </section>
      </div>
    </>
  );
}

export function SessionModal({ close, startSession }) {
  return (
    <Modal title="Log a session" close={close}>
      <form
        onSubmit={(e) => {
          const f = formValues(e);
          startSession({ topic: f.topic, exercise: f.exercise.trim(), date: f.date });
        }}
      >
        <Select label="Topic" name="topic" options={FOCUSES} />
        <label>
          Exercise
          <input required name="exercise" placeholder="What did you work on?" />
        </label>
        <label>
          Date
          <input required type="date" name="date" defaultValue={localDate()} />
        </label>
        <button className="primary submit">Continue to answer and score →</button>
      </form>
    </Modal>
  );
}

export function CoachModal({ close, data, startSession }) {
  const [focus, setFocus] = useState(FOCUSES[1]),
    [level, setLevel] = useState(data.profile.level),
    [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const body = { focus, level, profile: data.profile };
      const reply = await api('/coach', { method: 'POST', body });
      setResult({ ...reply, focus, level });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Practice workout" close={close}>
      <div className="coach-form">
        <Select
          label="Target level"
          options={LEVELS}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        />
        <Select
          label="Focus"
          options={FOCUSES}
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
        />
        <button className="primary submit" onClick={generate} disabled={busy}>
          {busy ? 'Preparing…' : 'Get one question →'}
        </button>
        {error && <p className="coach-error">{error}</p>}
        {result && (
          <>
            <p className="eyebrow">{result.source.toUpperCase()}</p>
            <article className="coach-result">{result.text}</article>
            <button
              className="primary submit"
              onClick={() =>
                startSession({
                  topic: result.focus,
                  level: result.level,
                  exercise: `${result.focus} · ${result.level}`,
                  summary: result.text,
                })
              }
            >
              Answer this question →
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
