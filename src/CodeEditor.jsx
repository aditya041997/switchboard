import React, { useRef } from 'react';

const INDENT = '    ';

/** A small editor that runs entirely in the browser: line numbers and indentation help. */
export default function CodeEditor({ value, onChange, onBlur, label, code = true }) {
  const gutter = useRef(null);
  const lines = value.split('\n').length;
  const onKeyDown = (e) => {
    const el = e.target;
    const { selectionStart: start, selectionEnd: end } = el;
    const lineStart = el.value.lastIndexOf('\n', start - 1) + 1;
    if (e.key === 'Escape') return el.blur(); // lets keyboard users leave the editor
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey && !el.value.slice(start, end).includes('\n')) {
        el.setRangeText(INDENT, start, end, 'end');
      } else {
        const block = el.value.slice(lineStart, end);
        const next = e.shiftKey ? block.replace(/^ {1,4}/gm, '') : block.replace(/^/gm, INDENT);
        // With only a caret, keep it after the indentation so typing does not replace it.
        el.setRangeText(next, lineStart, end, start === end ? 'end' : 'select');
      }
    } else if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const before = el.value.slice(lineStart, start);
      const extra = code && /[{([:]\s*$/.test(before) ? INDENT : '';
      el.setRangeText(`\n${before.match(/^ */)[0]}${extra}`, start, end, 'end');
    } else return;
    onChange(el.value);
  };
  return (
    <div className={`editor ${code ? '' : 'prose'}`}>
      {code && (
        <pre ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
        </pre>
      )}
      <textarea
        aria-label={label}
        value={value}
        spellCheck={!code}
        autoCapitalize="off"
        autoCorrect={code ? 'off' : 'on'}
        wrap={code ? 'off' : 'soft'}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onScroll={(e) => gutter.current && (gutter.current.scrollTop = e.target.scrollTop)}
        placeholder="Write your solution here…"
      />
    </div>
  );
}
