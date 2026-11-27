import React, { useState } from 'react';
import { DSA_STATUSES, addRevisions, localDate, uid } from '../../shared/model.js';
import { parseImport, problemUrl } from '../../shared/catalog.js';
import { PLAYLISTS_URL, patternVideosUrl, youtubeUrl } from '../../shared/videos.js';
import { CardTop, Empty, Select, formValues } from '../ui.jsx';

const LEVELS = ['Easy', 'Medium', 'Hard'];
const solved = (p) => p.status.startsWith('Solved');
const SHEETS = [
  [
    'Striver SDE sheet',
    'https://takeuforward.org/interviews/strivers-sde-sheet-top-coding-interview-problems/',
  ],
  ['AlgoMonster', 'https://algo.monster/problems'],
];

export default function DsaLab({ data, update, startSession, openSession }) {
  const [search, setSearch] = useState(''),
    [show, setShow] = useState('All'),
    [open, setOpen] = useState({}),
    [message, setMessage] = useState('');
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
  const practise = (item) => {
    const existing = data.sessions.find((s) => s.problemId === item.id && !s.scores);
    if (existing) return openSession(existing.id);
    startSession(
      {
        topic: 'DSA & coding',
        problemId: item.id,
        exercise: item.problem,
        summary: `Solve: ${item.problem}\nPattern: ${item.pattern} · ${item.difficulty}`,
      },
      (s) => ({
        ...s,
        dsa: s.dsa.map((x) =>
          x.id === item.id && !solved(x)
            ? { ...x, status: 'In progress', lastPractised: localDate() }
            : x,
        ),
      }),
    );
  };
  const savePlaylist = (pattern) => {
    const input = prompt(
      `YouTube playlist link for ${pattern} (leave empty to remove)`,
      data.profile.playlists?.[pattern] || '',
    );
    if (input === null) return;
    const url = youtubeUrl(input);
    if (input.trim() && !url) return setMessage('Use an https YouTube link.');
    setMessage('');
    update((s) => ({
      ...s,
      profile: { ...s.profile, playlists: { ...s.profile.playlists, [pattern]: url } },
    }));
  };
  const patterns = [...new Set(data.dsa.map((p) => p.pattern))];
  const query = search.trim().toLowerCase();
  const visible = data.dsa.filter(
    (p) =>
      (!query || `${p.problem} ${p.pattern}`.toLowerCase().includes(query)) &&
      (show === 'All' || (show === 'Unsolved' ? !solved(p) : p.difficulty === show)),
  );
  const next = visible.find((p) => !solved(p));

  return (
    <>
      <section className="dsa-hero card panel">
        <div>
          <p className="eyebrow">INTERVIEW REPETITIONS</p>
          <h2>
            DSA <em>without crutches.</em>
          </h2>
          <p>Discuss the approach. Write the code. Then earn the hint.</p>
        </div>
        <div className="dsa-stats">
          {LEVELS.map((level) => {
            const all = data.dsa.filter((x) => x.difficulty === level);
            return (
              <span key={level}>
                <b>
                  {all.filter(solved).length}/{all.length}
                </b>
                {level}
              </span>
            );
          })}
        </div>
      </section>
      <section className="card table-card">
        <CardTop eyebrow="PATTERN LIBRARY" title={`${data.dsa.length} problems by pattern`}>
          {next && (
            <button className="primary mini" onClick={() => practise(next)}>
              Practise next: {next.problem} →
            </button>
          )}
        </CardTop>
        <div className="inline-form">
          <label>
            Search
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Problem or pattern"
            />
          </label>
          <Select
            label="Show"
            options={['All', 'Unsolved', ...LEVELS]}
            value={show}
            onChange={(e) => setShow(e.target.value)}
          />
        </div>
        <p className="interview-hint">
          Watch, then practise.{' '}
          <a className="link" href={PLAYLISTS_URL} target="_blank" rel="noreferrer">
            All codestorywithMIK playlists ↗
          </a>
        </p>
        {message && <p className="interview-hint">{message}</p>}
        {!visible.length && <Empty title="No matching problems.">Change the search.</Empty>}
        {patterns.map((pattern) => {
          const rows = visible.filter((p) => p.pattern === pattern);
          if (!rows.length) return null;
          const all = data.dsa.filter((p) => p.pattern === pattern);
          return (
            <details
              className="pattern"
              key={pattern}
              open={query ? true : Boolean(open[pattern])}
              onToggle={(e) => {
                const isOpen = e.currentTarget.open;
                if (!query) setOpen((o) => ({ ...o, [pattern]: isOpen }));
              }}
            >
              <summary>
                <b>{pattern}</b>
                <span>
                  {all.filter(solved).length}/{all.length} solved
                </span>
              </summary>
              {(query || open[pattern]) && (
                <div className="resources playlist">
                  <a href={patternVideosUrl(pattern)} target="_blank" rel="noreferrer">
                    ▶ Learn this pattern with codestorywithMIK ↗
                  </a>
                  {youtubeUrl(data.profile.playlists?.[pattern]) && (
                    <a
                      href={youtubeUrl(data.profile.playlists[pattern])}
                      target="_blank"
                      rel="noreferrer"
                    >
                      My saved playlist ↗
                    </a>
                  )}
                  <button className="link" onClick={() => savePlaylist(pattern)}>
                    {data.profile.playlists?.[pattern] ? 'Change playlist' : 'Save a playlist link'}
                  </button>
                </div>
              )}
              {(query || open[pattern]) &&
                rows.map((x) => (
                  <div className="problem" key={x.id}>
                    <a href={problemUrl(x.problem)} target="_blank" rel="noreferrer">
                      {x.problem} ↗
                    </a>
                    <span className={`difficulty ${x.difficulty.toLowerCase()}`}>
                      {x.difficulty}
                    </span>
                    <select
                      aria-label={`Progress for ${x.problem}`}
                      value={x.status}
                      onChange={(e) => setStatus(x, e.target.value)}
                    >
                      {DSA_STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                    <button className="small-btn" onClick={() => practise(x)}>
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
                  </div>
                ))}
            </details>
          );
        })}
      </section>
      <section className="card panel add-problems">
        <CardTop eyebrow="FOLLOWING ANOTHER SHEET?" title="Add problems" />
        <p className="privacy-copy">
          {SHEETS.map(([name, url]) => (
            <a className="link" key={name} href={url} target="_blank" rel="noreferrer">
              {name} ↗{' '}
            </a>
          ))}
        </p>
        <form
          onSubmit={(e) => {
            const { lines } = formValues(e);
            const added = parseImport(lines, data.dsa, uid);
            setMessage(
              added.length
                ? `Added ${added.length} problem(s).`
                : 'Nothing added. Check the format, or they already exist.',
            );
            if (!added.length) return;
            e.currentTarget.reset();
            update((s) => ({ ...s, dsa: [...s.dsa, ...parseImport(lines, s.dsa, uid)] }));
          }}
        >
          <label>
            One per line: pattern | problem | difficulty
            <textarea
              required
              name="lines"
              rows="4"
              placeholder={"Arrays & hashing | Pascal's Triangle | Easy"}
            />
          </label>
          <button className="primary mini">Add to my list</button>
        </form>
      </section>
    </>
  );
}
