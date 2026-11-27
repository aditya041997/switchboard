import React from 'react';
import { DIMENSIONS } from '../../shared/model.js';
import { formValues } from '../ui.jsx';

const splitList = (value) =>
  value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export default function ScoreForm({ session, onSave }) {
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
