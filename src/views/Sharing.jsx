import React, { useEffect, useState } from 'react';
import { uid } from '../../shared/model.js';
import { api } from '../api.js';
import { CardTop, formValues } from '../ui.jsx';

const newToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

export function Sharing({ data, update, reset }) {
  const viewer = data.sharing.viewers[0];
  const active = data.sharing.enabled && viewer?.active;
  const link = active ? `${location.origin}/shared/${viewer.token}` : '';
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const create = (e) => {
    const { name } = formValues(e);
    update((s) => ({
      ...s,
      sharing: { enabled: true, viewers: [{ id: uid(), token: newToken(), name, active: true }] },
    }));
  };
  // Revoking discards the token, so an old link can never start working again.
  const revoke = () => update((s) => ({ ...s, sharing: { enabled: false, viewers: [] } }));
  return (
    <>
      <section className="card panel">
        <CardTop eyebrow="READ-ONLY PROGRESS LINK" title="Share with a mentor" />
        <p className="privacy-copy">
          Shows your name, session count, readiness, completed actions and the topic, title and date
          of your last five sessions. Never answers, gaps, resume text or applications.
        </p>
        {local && (
          <p className="coach-error">
            This link only opens on this computer. Host Switchboard with a password to share it.
          </p>
        )}
        {active ? (
          <div className="share-link">
            <b>Link for {viewer.name}</b>
            <code>{link}</code>
            <button className="small-btn" onClick={() => navigator.clipboard?.writeText(link)}>
              Copy link
            </button>
            <button className="text-btn revoke" onClick={revoke}>
              Revoke access
            </button>
          </div>
        ) : (
          <form onSubmit={create}>
            <label>
              Viewer name
              <input required name="name" />
            </label>
            <button className="primary submit">Create read-only link →</button>
          </form>
        )}
      </section>
      <section className="card panel danger-zone">
        <CardTop eyebrow="DATA CONTROLS" title="Delete your data" />
        <p className="privacy-copy">
          Clears saved data here and in the Mongo backup. If the backup is unreachable, it is
          overwritten the next time it connects.
        </p>
        <button className="text-btn" onClick={reset}>
          Delete all Switchboard data →
        </button>
      </section>
    </>
  );
}

export function SharedProgress({ token }) {
  const [summary, setSummary] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    api(`/shared/${encodeURIComponent(token)}`)
      .then(setSummary)
      .catch((e) => setError(e.message));
  }, [token]);
  if (error)
    return (
      <div className="shared-page">
        <h1>Link unavailable</h1>
        <p>{error}</p>
      </div>
    );
  if (!summary) return <div className="loading">Loading shared progress…</div>;
  return (
    <div className="shared-page">
      <p className="eyebrow">SWITCHBOARD · READ-ONLY PROGRESS</p>
      <h1>{summary.owner}'s job-switch journey</h1>
      <section className="shared-metrics">
        {[
          [summary.sessions, 'sessions'],
          [`${summary.readiness}%`, 'self-rated readiness'],
          [summary.completedActions, 'actions completed'],
        ].map(([value, label]) => (
          <div key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <section className="card">
        <h3>Recent activity</h3>
        {summary.recent.length ? (
          summary.recent.map((item) => (
            <p key={item.id}>
              <b>{item.topic}</b> · {item.exercise} <small>{item.date}</small>
            </p>
          ))
        ) : (
          <p>No activity yet.</p>
        )}
      </section>
    </div>
  );
}
