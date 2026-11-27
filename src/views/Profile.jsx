import React from 'react';
import { LEVELS } from '../../shared/model.js';
import { CardTop, Select, formValues } from '../ui.jsx';

export default function Profile({ data, update, go }) {
  const p = data.profile;
  const field = (name, label, props = {}) => (
    <label>
      {label}
      <input name={name} defaultValue={p[name]} {...props} />
    </label>
  );
  return (
    <section className="card panel">
      <CardTop eyebrow="USED TO PERSONALISE COACHING" title="Your profile" />
      <form
        onSubmit={(e) => {
          const fields = formValues(e);
          update((s) => ({ ...s, profile: { ...s.profile, ...fields } }));
          go('Overview');
        }}
      >
        {field('name', 'Name')}
        {field('targetRole', 'Target role', { required: true, placeholder: 'Backend Engineer' })}
        <Select label="Target level" name="level" options={LEVELS} defaultValue={p.level} />
        {field('years', 'Years of experience', { type: 'number', min: 0, max: 50, step: 0.5 })}
        {field('stack', 'Primary stack', {
          required: true,
          placeholder: 'e.g. Python, FastAPI, PostgreSQL',
        })}
        <Select
          label="Lesson language"
          name="explainIn"
          options={['English', 'Hinglish']}
          defaultValue={p.explainIn}
        />
        {field('goal', 'Goal (private, never sent to AI)', {
          placeholder: 'e.g. target pay or companies',
        })}
        <button className="primary submit">Save profile</button>
      </form>
    </section>
  );
}
