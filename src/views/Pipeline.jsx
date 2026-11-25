import React, { useState } from 'react';
import { STAGES, localDate, uid } from '../../shared/model.js';
import { Modal, Select, formValues } from '../ui.jsx';

export default function Pipeline({ data, update }) {
  // null: closed, {}: new entry, otherwise the entry being edited
  const [editing, setEditing] = useState(null);
  const today = localDate();
  const save = (id, fields) =>
    update((s) => ({
      ...s,
      applications: id
        ? s.applications.map((a) => (a.id === id ? { ...a, ...fields } : a))
        : [{ id: uid(), ...fields }, ...s.applications],
    }));
  const active = data.applications.filter((a) => a.stage !== 'Closed').length;
  return (
    <>
      <section className="card pipeline-head">
        <div>
          <p className="eyebrow">OPPORTUNITY ENGINE</p>
          <h3>
            {active} active {active === 1 ? 'opportunity' : 'opportunities'}
          </h3>
        </div>
        <button className="primary mini" onClick={() => setEditing({})}>
          + Add company
        </button>
      </section>
      <section className="kanban">
        {STAGES.map((stage) => {
          const cards = data.applications.filter((a) => a.stage === stage);
          return (
            <div className="lane" key={stage}>
              <h4>
                {stage}
                <small>{cards.length}</small>
              </h4>
              {cards.map((a) => (
                <article key={a.id}>
                  <h4>{a.company}</h4>
                  <p>{a.role}</p>
                  <select
                    aria-label={`Stage for ${a.company}`}
                    value={a.stage}
                    onChange={(e) => save(a.id, { stage: e.target.value })}
                  >
                    {STAGES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <footer>
                    <span>{a.next}</span>
                    <time
                      className={a.date && a.date <= today && stage !== 'Closed' ? 'danger' : ''}
                    >
                      {a.date}
                    </time>
                  </footer>
                  <div className="row-actions">
                    <button className="link" onClick={() => setEditing(a)}>
                      Edit
                    </button>
                    <button
                      className="link danger"
                      onClick={() =>
                        confirm(`Delete ${a.company}?`) &&
                        update((s) => ({
                          ...s,
                          applications: s.applications.filter((x) => x.id !== a.id),
                        }))
                      }
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          );
        })}
      </section>
      {editing && (
        <Modal
          title={editing.id ? 'Edit opportunity' : 'Add an opportunity'}
          close={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              save(editing.id, formValues(e));
              setEditing(null);
            }}
          >
            <label>
              Company
              <input required name="company" defaultValue={editing.company} />
            </label>
            <label>
              Role
              <input required name="role" defaultValue={editing.role} />
            </label>
            <div className="form-row">
              <Select label="Stage" name="stage" options={STAGES} defaultValue={editing.stage} />
              <label>
                Next action date
                <input name="date" type="date" defaultValue={editing.date ?? today} />
              </label>
            </div>
            <label>
              Next action
              <input name="next" defaultValue={editing.next} placeholder="e.g. Follow up" />
            </label>
            <button className="primary submit">Save</button>
          </form>
        </Modal>
      )}
    </>
  );
}
