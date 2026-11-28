import React, { useEffect, useRef, useState } from 'react';
import { addRevisions, isScored, scoreSession, totalScore } from '../../shared/model.js';
import { problemUrl } from '../../shared/catalog.js';
import { patternVideosUrl, problemVideoUrl, youtubeUrl } from '../../shared/videos.js';
import { api } from '../api.js';
import CodeEditor from '../CodeEditor.jsx';
import useDictation from '../useDictation.js';
import ScoreForm from './ScoreForm.jsx';
import Statement from './Statement.jsx';
import { statementText } from '../../shared/statement.js';

const LANGUAGES = ['Java', 'Python', 'C++', 'JavaScript', 'Go'];
const guessLanguage = (stack = '') =>
  /python/i.test(stack)
    ? 'Python'
    : /c\+\+/i.test(stack)
      ? 'C++'
      : /java(?!script)/i.test(stack)
        ? 'Java'
        : /javascript|typescript|node|react/i.test(stack)
          ? 'JavaScript'
          : /golang|\bgo\b/i.test(stack)
            ? 'Go'
            : 'Java';

/** Sessions created by earlier versions have no problem id, so they are matched by title. */
const findProblem = (state, session) =>
  state.dsa.find((p) => p.id === session?.problemId) ||
  (session?.topic === 'DSA & coding'
    ? state.dsa.find((p) => p.problem.toLowerCase() === session.exercise.toLowerCase())
    : undefined);

/** Questions being written now, so reopening a problem does not request a second one. */
const writing = new Map();

/** Saves the score and, for a DSA problem, records the progress. */
function complete(state, id, result) {
  const next = scoreSession(state, id, result);
  const session = next.sessions.find((s) => s.id === id);
  const item = findProblem(next, session);
  if (!item || result.verdict === 'needs_work') return next;
  const status = result.independent ? 'Solved independently' : 'Solved with help';
  return {
    ...next,
    dsa: next.dsa.map((p) =>
      p.id === item.id ? { ...p, status, lastPractised: session.date } : p,
    ),
    revisions: addRevisions(
      next.revisions,
      [`DSA: ${item.problem}`],
      'DSA lab',
      result.independent ? 'Medium' : 'High',
    ),
  };
}

export default function SessionDetail({ data, update, config, id, back }) {
  const session = data.sessions.find((s) => s.id === id);
  const [code, setCode] = useState(session?.answer || ''),
    [draft, setDraft] = useState(''),
    [pending, setPending] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [statementError, setStatementError] = useState('');
  const requested = useRef(false);
  const log = useRef(null);
  const timer = useRef(null);
  const unsaved = useRef(null);

  const patch = (change) =>
    update((s) => ({
      ...s,
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...change(x) } : x)),
    }));
  // Code is saved shortly after typing stops, and when leaving the page.
  const flush = () => {
    clearTimeout(timer.current);
    if (unsaved.current === null) return;
    const answer = unsaved.current;
    unsaved.current = null;
    patch(() => ({ answer }));
  };
  const edit = (value) => {
    setCode(value);
    unsaved.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1500);
  };
  useEffect(() => {
    // Switching tabs or closing the page also saves what was typed.
    const hidden = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      flush();
    };
  }, []);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [session?.chat?.length, pending]);

  // Spoken phrases are added to the message box, to be checked before sending.
  const mic = useDictation((phrase) => setDraft((d) => (d ? `${d.trimEnd()} ${phrase}` : phrase)));
  const problem = findProblem(data, session);
  const statement = problem?.statement || session?.statement;
  // Written once per problem, then kept with your data.
  const loadStatement = async () => {
    requested.current = true;
    setLoading(true);
    setStatementError('');
    try {
      let job = writing.get(problem.id);
      if (!job) {
        job = api('/problem', {
          method: 'POST',
          body: {
            title: problem.problem,
            pattern: problem.pattern,
            difficulty: problem.difficulty,
            language: session.language || guessLanguage(data.profile.stack),
          },
        })
          .then((result) =>
            update((s) => ({
              ...s,
              dsa: s.dsa.map((p) => (p.id === problem.id ? { ...p, statement: result } : p)),
            })),
          )
          .finally(() => writing.delete(problem.id));
        writing.set(problem.id, job);
      }
      await job;
    } catch (err) {
      setStatementError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (config?.ai && problem && !statement && !requested.current) loadStatement();
  }, [config?.ai, problem?.id, Boolean(statement)]);

  if (!session)
    return (
      <section className="card empty-detail">
        <button className="text-btn" onClick={back}>
          ← Back to session log
        </button>
        <h3>Session not found.</h3>
      </section>
    );

  const ai = Boolean(config?.ai);
  const coding = session.topic === 'DSA & coding';
  const chat = session.chat || [];
  const stage = session.stage || (session.answer || isScored(session) ? 'code' : 'approach');
  const hintsUsed = session.hintsUsed || 0;
  const language = session.language || guessLanguage(data.profile.stack);
  const question = statement
    ? statementText(session.exercise, statement)
    : session.summary || session.exercise;
  const lessonStep = session.lessonStep || 0;
  // Being taught or hinted means the problem was not solved independently.
  const unaided = hintsUsed === 0 && lessonStep === 0;
  const item = problem;

  const request = (action, messages) =>
    api('/coach/session', {
      method: 'POST',
      body: {
        action,
        stage,
        messages,
        problem: question,
        code: stage === 'code' ? code : '',
        language: coding ? language : '',
        hintsUsed,
        lessonStep,
        explainIn: data.profile.explainIn,
        focus: session.topic,
        level: session.level || data.profile.level,
        profile: data.profile,
      },
    });
  const run = async (label, task) => {
    setBusy(label);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
      setPending('');
    }
  };
  const send = (e) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || busy || mic.listening) return;
    const message = { role: 'user', content };
    if (!ai) {
      setDraft('');
      return patch((x) => ({ chat: [...(x.chat || []), message] }));
    }
    setPending(content);
    setDraft('');
    run('Coach is thinking…', async () => {
      try {
        const result = await request('message', [...chat, message]);
        await patch((x) => ({
          chat: [...(x.chat || []), message, { role: 'assistant', content: result.reply }],
          approachApproved: x.approachApproved || Boolean(result.ready),
        }));
      } catch (err) {
        setDraft(content); // keep what was typed so it can be sent again
        throw err;
      }
    });
  };
  const hint = () =>
    run('Preparing a hint…', async () => {
      const result = await request('hint', chat);
      await patch((x) => ({
        hintsUsed: (x.hintsUsed || 0) + 1,
        chat: [...(x.chat || []), { role: 'assistant', kind: 'Hint', content: result.reply }],
      }));
    });
  const teach = () =>
    run('Preparing the lesson…', async () => {
      const result = await request('teach', chat);
      const kind = `Lesson ${lessonStep + 1} of 5`;
      await patch((x) => ({
        lessonStep: (x.lessonStep || 0) + 1,
        chat: [
          ...(x.chat || []),
          // Included in the history so the next step can build on this one.
          { role: 'assistant', kind, content: result.reply },
        ],
      }));
    });
  const review = () =>
    run('Reviewing your solution…', async () => {
      flush();
      const result = await request('review', chat);
      const solved = result.verdict === 'correct';
      const content = `${solved ? 'Looks correct.' : 'Needs work.'}\n\n${result.feedback}${result.followUp ? `\n\nFollow-up: ${result.followUp}` : ''}`;
      await patch((x) => ({
        review: result,
        answer: code,
        chat: [...(x.chat || []), { role: 'assistant', kind: 'Review', content }],
      }));
      if (solved)
        await update((s) => complete(s, id, { ...result, answer: code, independent: unaided }));
    });
  const saveScore = (result) => {
    flush();
    return update((s) => complete(s, id, { ...result, answer: code }));
  };
  const goTo = (next) => {
    flush();
    patch(() => ({ stage: next }));
  };
  const remove = () => {
    if (!confirm('Delete this session?')) return;
    unsaved.current = null;
    update((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) }));
    back();
  };

  return (
    <>
      <button className="text-btn back-btn" onClick={back}>
        ← Back to session log
      </button>
      <section className="detail-hero compact">
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

      <div className="steps" role="tablist">
        {[
          ['approach', '1 · Discuss approach'],
          ['code', coding ? '2 · Code and review' : '2 · Write and review'],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={stage === key}
            className={stage === key ? 'active' : ''}
            onClick={() => goTo(key)}
          >
            {label}
          </button>
        ))}
        <span>
          {hintsUsed} hint{hintsUsed === 1 ? '' : 's'} used
        </span>
      </div>

      <div className={`workspace ${stage}`}>
        <section className="card chat">
          {item ? (
            <>
              <p className="eyebrow">
                {item.pattern.toUpperCase()} · {item.difficulty.toUpperCase()}
              </p>
              {statement && <Statement statement={statement} />}
              {loading && <p className="interview-hint">Writing the question and test cases…</p>}
              {statementError && <p className="coach-error">{statementError}</p>}
              {!statement && !ai && (
                <p className="interview-hint">
                  Turn on AI to show the question here, or open it using the link below.
                </p>
              )}
              {statement && (
                <p className="interview-hint">
                  AI-written. Check doubtful test cases against the original.
                </p>
              )}
              {ai && !loading && (
                <button type="button" className="link" onClick={loadStatement}>
                  {statement ? 'Rewrite question' : 'Load question'}
                </button>
              )}
            </>
          ) : (
            <div className="question">{question}</div>
          )}
          {item && (
            <div className="resources">
              <a href={problemUrl(item.problem)} target="_blank" rel="noreferrer">
                Statement and tests on LeetCode ↗
              </a>
              <a href={problemVideoUrl(item.problem)} target="_blank" rel="noreferrer">
                Find MIK’s video for this problem ↗
              </a>
              <a href={patternVideosUrl(item.pattern)} target="_blank" rel="noreferrer">
                {item.pattern} videos ↗
              </a>
              {youtubeUrl(data.profile.playlists?.[item.pattern]) && (
                <a
                  href={youtubeUrl(data.profile.playlists[item.pattern])}
                  target="_blank"
                  rel="noreferrer"
                >
                  My saved playlist ↗
                </a>
              )}
            </div>
          )}
          <div className="messages" ref={log} aria-live="polite">
            {!chat.length && !pending && (
              <p className="interview-hint">
                {ai
                  ? 'Explain how you would solve it: idea, data structures, complexity and edge cases. The coach will question it before you write.'
                  : 'AI is off. Note your approach here, then continue to step 2.'}
              </p>
            )}
            {chat.map((m, i) => (
              <div
                key={i}
                className={`bubble ${m.role} ${m.kind ? m.kind.split(' ')[0].toLowerCase() : ''}`}
              >
                <b>{m.role === 'user' ? 'You' : m.kind || 'Coach'}</b>
                {m.content}
              </div>
            ))}
            {pending && (
              <div className="bubble user">
                <b>You</b>
                {pending}
              </div>
            )}
            {busy && <p className="interview-hint">{busy}</p>}
          </div>
          {error && <p className="coach-error">{error}</p>}
          <form onSubmit={send}>
            <textarea
              rows="3"
              aria-label="Message to coach"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && send(e)}
              placeholder={stage === 'approach' ? 'I would start by…' : 'Ask about your solution…'}
            />
            {mic.listening && (
              <p className="interview-hint" aria-live="polite">
                Listening… {mic.interim}
              </p>
            )}
            {mic.problem && <p className="coach-error">{mic.problem}</p>}
            {mic.supported ? (
              <div className="row-actions">
                <button
                  type="button"
                  className={mic.listening ? 'primary mini' : 'small-btn'}
                  aria-pressed={mic.listening}
                  onClick={() =>
                    mic.listening ? mic.stop() : mic.start(data.profile.micLang || 'en-IN')
                  }
                >
                  {mic.listening ? '■ Stop mic' : '🎤 Speak'}
                </button>
                <select
                  aria-label="Speech language"
                  value={data.profile.micLang || 'en-IN'}
                  disabled={mic.listening}
                  onChange={(e) => {
                    const micLang = e.target.value;
                    update((s) => ({ ...s, profile: { ...s.profile, micLang } }));
                  }}
                >
                  <option value="en-IN">English / Hinglish</option>
                  <option value="hi-IN">Hindi + English</option>
                </select>
              </div>
            ) : (
              <p className="interview-hint">Voice input needs Chrome, Edge or Safari.</p>
            )}
            <div className="row-actions">
              <button
                className="primary mini"
                disabled={Boolean(busy) || loading || mic.listening || !draft.trim()}
              >
                {ai ? 'Send' : 'Add note'}
              </button>
              {ai && stage === 'approach' && lessonStep < 5 && (
                <button
                  type="button"
                  className="small-btn"
                  onClick={teach}
                  disabled={Boolean(busy) || loading}
                >
                  {lessonStep ? `Next lesson step (${lessonStep + 1}/5)` : 'Teach me story-first'}
                </button>
              )}
              {ai && (
                <button
                  type="button"
                  className="small-btn"
                  onClick={hint}
                  disabled={Boolean(busy) || loading}
                >
                  Give me a hint
                </button>
              )}
              {stage === 'approach' && (
                <button
                  type="button"
                  className={session.approachApproved ? 'primary mini' : 'link'}
                  onClick={() => goTo('code')}
                >
                  {session.approachApproved
                    ? `Approach agreed. ${coding ? 'Start coding' : 'Write it up'} →`
                    : 'Skip to step 2'}
                </button>
              )}
            </div>
          </form>
        </section>

        {stage === 'code' && (
          <section className="card solution">
            <div className="row-actions spread">
              <p className="eyebrow">{coding ? 'YOUR CODE' : 'YOUR SOLUTION'}</p>
              {coding && (
                <select
                  aria-label="Language"
                  value={language}
                  onChange={(e) => {
                    const next = e.target.value;
                    patch(() => ({ language: next }));
                  }}
                >
                  {LANGUAGES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              )}
            </div>
            <CodeEditor
              code={coding}
              label={coding ? 'Code editor' : 'Your solution'}
              value={code}
              onChange={edit}
              onBlur={flush}
            />
            <div className="row-actions">
              <button
                className="primary mini"
                onClick={review}
                disabled={!ai || Boolean(busy) || loading || code.trim().length < 20}
              >
                Submit for review
              </button>
              <button
                className="small-btn"
                onClick={() => navigator.clipboard?.writeText(code)}
                disabled={!code}
              >
                Copy
              </button>
              {session.review?.verdict === 'needs_work' && (
                <button
                  className="link"
                  onClick={() => saveScore({ ...session.review, independent: unaided })}
                >
                  Stop here and save this score
                </button>
              )}
            </div>
            <p className="interview-hint">
              {ai
                ? 'The AI reads your code and does not run it. Confirm with real tests before relying on the verdict.'
                : 'AI is off. Score yourself below.'}
            </p>
          </section>
        )}
      </div>

      <details className="card manual" open={!ai}>
        <summary>Score, gaps and manual edits</summary>
        {/* The key resets the form when a new score arrives. */}
        <ScoreForm
          key={JSON.stringify([session.scores, session.gaps])}
          session={session}
          onSave={saveScore}
        />
        <button className="text-btn danger" onClick={remove}>
          Delete session
        </button>
      </details>
    </>
  );
}
