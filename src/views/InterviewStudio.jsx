import React, { useState } from 'react';
import { FOCUSES, LEVELS, localDate, uid } from '../../shared/model.js';
import { api } from '../api.js';
import { CardTop, Empty, Modal, Select, formValues } from '../ui.jsx';

const SYLLABUS = {
  'SDE 1': [
    'Arrays, strings, maps, trees & graph basics',
    'Clean code, tests, APIs and SQL fundamentals',
    'Behavioral: ownership, learning and collaboration',
  ],
  'SDE 2': [
    'Medium DSA under time pressure',
    'API/data design, concurrency, caching, queues & failure handling',
    'Low-level design plus project-depth behavioral',
  ],
  'SDE 3': [
    'Ambiguous, multi-service system design',
    'Scale, SLOs, cost, migration and technical judgment',
    'Leadership, influence, trade-offs and incident ownership',
  ],
};

export default function InterviewStudio({ data, update, config }) {
  const [level, setLevel] = useState(data.profile.level),
    [focus, setFocus] = useState('System design'),
    [guide, setGuide] = useState(null),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [error, setError] = useState('');
  const makeGuide = async () => {
    setBusy(true);
    setError('');
    try {
      const body = { mode: 'interviewer', level, focus, profile: data.profile };
      setGuide(await api('/coach', { method: 'POST', body }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="card panel">
        <CardTop eyebrow="INTERVIEW MAP" title="Target the right bar" />
        <div className="inline-form">
          <Select
            label="Level"
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
          <button className="primary mini" onClick={makeGuide} disabled={busy}>
            {busy ? 'Preparing…' : 'Create interviewer guide'}
          </button>
        </div>
        <div className="syllabus">
          {SYLLABUS[level].map((x, i) => (
            <div key={x}>
              <b>0{i + 1}</b>
              <span>{x}</span>
            </div>
          ))}
        </div>
        {error && <p className="coach-error">{error}</p>}
        {guide && (
          <>
            <p className="eyebrow">
              {guide.source.toUpperCase()} · COPY AND SEND TO YOUR INTERVIEWER
            </p>
            <article className="coach-result">{guide.text}</article>
            <button
              className="small-btn"
              onClick={() => navigator.clipboard?.writeText(guide.text)}
            >
              Copy guide
            </button>
          </>
        )}
      </section>
      <section className="card table-card">
        <CardTop eyebrow="LIVE INTERVIEW ROOMS" title="Joinable interviews">
          <button
            className="primary mini"
            disabled={!config?.video}
            onClick={() => setCreating(true)}
          >
            + Create room
          </button>
        </CardTop>
        {data.interviews.length ? (
          <table>
            <tbody>
              {data.interviews.map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.title}</b>
                    <span>{x.area}</span>
                  </td>
                  <td>{x.interviewer}</td>
                  <td>
                    {x.date} {x.time}
                  </td>
                  <td>
                    <a className="room-link" href={x.roomUrl} target="_blank" rel="noreferrer">
                      Join room ↗
                    </a>
                  </td>
                  <td>
                    <button
                      className="link danger"
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          interviews: s.interviews.filter((i) => i.id !== x.id),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No interview rooms.">
            {config?.video
              ? 'Create one and send the link to your interviewer.'
              : 'Add JITSI_DOMAIN to .env to create rooms, or use any video app with the guide above.'}
          </Empty>
        )}
      </section>
      {creating && <RoomModal update={update} close={() => setCreating(false)} />}
    </>
  );
}

function RoomModal({ update, close }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    const values = formValues(e);
    setBusy(true);
    setError('');
    try {
      const body = { consent: Boolean(values.consent), title: values.title };
      const room = await api('/interview-room', { method: 'POST', body });
      const { consent, ...fields } = values;
      await update((s) => ({
        ...s,
        interviews: [{ id: uid(), ...fields, room: room.room, roomUrl: room.url }, ...s.interviews],
      }));
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Create live interview room" close={close}>
      <form onSubmit={submit} className="interview-form">
        <p className="interview-hint">This creates a video link. It does not send an invitation.</p>
        <label>
          Session title
          <input required name="title" defaultValue="Mock interview" />
        </label>
        <Select label="Area" name="area" options={FOCUSES} />
        <div className="form-row">
          <label>
            Date
            <input required type="date" name="date" defaultValue={localDate()} />
          </label>
          <label>
            Time
            <input required type="time" name="time" defaultValue="18:00" />
          </label>
        </div>
        <label>
          Interviewer name
          <input required name="interviewer" />
        </label>
        <label className="consent-line">
          <input required type="checkbox" name="consent" />
          <span>The interviewer agreed to this video room.</span>
        </label>
        {error && <p className="coach-error">{error}</p>}
        <button className="primary submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create room →'}
        </button>
      </form>
    </Modal>
  );
}
