import React from 'react';

function Case({ title, input, output, explanation }) {
  return (
    <div className="case">
      <b>{title}</b>
      <pre>
        Input: {input}
        {'\n'}Output: {output}
      </pre>
      {explanation && <p>{explanation}</p>}
    </div>
  );
}

export default function Statement({ statement }) {
  return (
    <div className="statement">
      <p className="question">{statement.description}</p>
      {statement.signature && <pre>{statement.signature}</pre>}
      {statement.examples.map((c, i) => (
        <Case key={i} {...c} title={`Example ${i + 1}`} />
      ))}
      <h4>Constraints</h4>
      <ul>
        {statement.constraints.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
      <h4>Test cases</h4>
      {statement.testCases.map((c, i) => (
        <Case key={i} {...c} title={`Test ${i + 1}${c.name ? ` · ${c.name}` : ''}`} />
      ))}
    </div>
  );
}
