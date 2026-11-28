import React, { useEffect, useState } from 'react';
import { starterState, uid, localDate } from '../shared/model.js';
import { api, setPassword } from './api.js';
import { useStore } from './useStore.js';
import { formValues } from './ui.jsx';
import Overview from './views/Overview.jsx';
import { Sessions, SessionModal, CoachModal } from './views/Sessions.jsx';
import SessionDetail from './views/SessionDetail.jsx';
import DsaLab from './views/DsaLab.jsx';
import { Skills, Revisions } from './views/Practice.jsx';
import Pipeline from './views/Pipeline.jsx';
import CareerLab from './views/CareerLab.jsx';
import InterviewStudio from './views/InterviewStudio.jsx';
import { Sharing, SharedProgress } from './views/Sharing.jsx';
import Profile from './views/Profile.jsx';

const icons = {
  Overview: '⌂',
  Sessions: '◷',
  'DSA lab': '⌘',
  Skills: '◎',
  Revisions: '↻',
  Pipeline: '↗',
  'Career lab': '✦',
  'Interview studio': '◉',
  'Sharing & privacy': '♙',
  Profile: '☺',
};
const sessionFromPath = () => location.pathname.match(/^\/sessions\/([^/]+)$/)?.[1] || null;

export default function App() {
  const shared = location.pathname.match(/^\/shared\/([^/]+)$/)?.[1];
  return shared ? <SharedProgress token={shared} /> : <Workspace />;
}

function Login({ error, reload }) {
  return (
    <form
      className="auth"
      onSubmit={(e) => {
        setPassword(formValues(e).password);
        reload();
      }}
    >
      <h2>Switchboard</h2>
      <p className="interview-hint">{error.message}</p>
      <label>
        Password
        <input required autoFocus type="password" name="password" />
      </label>
      <button className="primary submit">Open →</button>
    </form>
  );
}

function Workspace() {
  const { data, error, saving, toast, storage, update, reload } = useStore();
  const [sessionId, setSessionId] = useState(sessionFromPath),
    [view, setView] = useState(sessionFromPath() ? 'Session detail' : 'Overview'),
    [modal, setModal] = useState(null),
    [config, setConfig] = useState(null);

  useEffect(() => {
    if (data)
      api('/config')
        .then(setConfig)
        .catch(() => {});
  }, [Boolean(data)]);
  useEffect(() => {
    const back = () => {
      const id = sessionFromPath();
      setSessionId(id);
      setView(id ? 'Session detail' : 'Overview');
    };
    addEventListener('popstate', back);
    return () => removeEventListener('popstate', back);
  }, []);

  if (error?.status === 401 || error?.status === 429)
    return <Login error={error} reload={reload} />;
  if (error)
    return (
      <div className="auth">
        <h2>Could not load your data</h2>
        <p className="coach-error">{error.message}</p>
        <button className="primary" onClick={reload}>
          Try again
        </button>
      </div>
    );
  if (!data) return <div className="loading">Loading your switchboard…</div>;

  const go = (next) => {
    setSessionId(null);
    setView(next);
    history.pushState({}, '', '/');
  };
  const openSession = (id) => {
    setSessionId(id);
    setView('Session detail');
    history.pushState({}, '', `/sessions/${id}`);
  };
  const startSession = (fields, also = (s) => s) => {
    const id = uid();
    const session = {
      id,
      date: localDate(),
      minutes: 15,
      independent: false,
      scores: null,
      gaps: [],
      mastered: [],
      answer: '',
      status: 'In progress',
      ...fields,
    };
    update((s) => also({ ...s, sessions: [session, ...s.sessions] }));
    setModal(null);
    openSession(id);
  };
  const reset = () => {
    if (
      !confirm(
        'Delete all sessions, revisions, applications, career drafts, interview rooms and sharing links? Your profile name and generated questions are kept. This cannot be undone.',
      )
    )
      return;
    update((s) => {
      const fresh = starterState();
      // Generated questions are kept, so they are not paid for twice.
      const dsa = fresh.dsa.map((p) => {
        const statement = s.dsa.find((old) => old.problem === p.problem)?.statement;
        return statement ? { ...p, statement } : p;
      });
      return { ...fresh, dsa, meta: s.meta, profile: { ...fresh.profile, name: s.profile.name } };
    });
    go('Overview');
  };
  const storageLabel = !storage
    ? 'Checking storage…'
    : !storage.configured
      ? 'Not using MongoDB'
      : storage.synced
        ? 'Stored in MongoDB'
        : 'Not yet in MongoDB';
  const storageWarning =
    storage?.configured && !storage.synced
      ? 'Your latest changes are not in MongoDB yet. Retrying automatically. Until this clears, a server restart can lose them.'
      : storage && !storage.configured && storage.temporaryDisk
        ? 'MongoDB is not set up, so a server restart will erase your sessions. Add MONGODB_URI in Render.'
        : '';
  const props = { data, update, config, go, open: setModal, openSession, startSession };

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span className="brand-mark">S</span>
          <div>
            switchboard<small>JOB SWITCH OS</small>
          </div>
        </div>
        <nav>
          {Object.entries(icons).map(([name, icon]) => (
            <button
              key={name}
              title={name}
              aria-label={name}
              className={view === name ? 'active' : ''}
              onClick={() => go(name)}
            >
              <i>{icon}</i>
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="pulse"></div>
          <span>{saving ? 'Saving…' : storageLabel}</span>
          <small>{config?.ai ? 'AI coach on' : 'AI off · built-in mode'}</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">
              {new Date()
                .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                .toUpperCase()}
            </p>
            <h1>
              {view === 'Overview' ? (
                <>
                  Make the next move <em>count.</em>
                </>
              ) : (
                view
              )}
            </h1>
          </div>
          <div className="header-actions">
            <button className="ghost" onClick={() => setModal('session')}>
              + Log session
            </button>
            <button
              className="avatar ghost"
              aria-label="Edit profile"
              onClick={() => go('Profile')}
            >
              {(data.profile.name || 'You')[0].toUpperCase()}
            </button>
          </div>
        </header>
        {storageWarning && (
          <p className="coach-error storage-warning" role="alert">
            {storageWarning}
          </p>
        )}
        {view === 'Overview' && <Overview {...props} />}
        {view === 'Sessions' && <Sessions {...props} />}
        {view === 'Session detail' && (
          <SessionDetail key={sessionId} {...props} id={sessionId} back={() => go('Sessions')} />
        )}
        {view === 'DSA lab' && <DsaLab {...props} />}
        {view === 'Skills' && <Skills {...props} />}
        {view === 'Revisions' && <Revisions {...props} />}
        {view === 'Pipeline' && <Pipeline {...props} />}
        {view === 'Career lab' && <CareerLab {...props} />}
        {view === 'Interview studio' && <InterviewStudio {...props} />}
        {view === 'Sharing & privacy' && <Sharing {...props} reset={reset} />}
        {view === 'Profile' && <Profile {...props} />}
      </main>
      {modal === 'session' && <SessionModal {...props} close={() => setModal(null)} />}
      {modal === 'coach' && <CoachModal {...props} close={() => setModal(null)} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
