import React, { useEffect } from 'react';

export function Modal({ title, close, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="close" aria-label="Close" onClick={close}>
          ×
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const formValues = (event) => {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
};

export const Select = ({ label, options, ...props }) => (
  <label>
    {label}
    <select {...props}>
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  </label>
);

export const Empty = ({ title, children }) => (
  <div className="schedule-empty">
    <b>{title}</b>
    <span>{children}</span>
  </div>
);

export const CardTop = ({ eyebrow, title, children }) => (
  <div className="card-top">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
    </div>
    {children}
  </div>
);
