import React, { useState } from 'react';
import { FOCUSES, LEVELS, isScored, localDate, totalScore } from '../../shared/model.js';
import { api } from '../api.js';
import { CardTop, Empty, Modal, Select, formValues } from '../ui.jsx';

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
