/** Plain-text form of a statement, so the coach judges against what the user sees. */
export function statementText(title, s) {
  const cases = (list, label) =>
    list.map((c, i) => `${label} ${i + 1}\nInput: ${c.input}\nExpected: ${c.output}`).join('\n');
  return [
    title,
    s.description,
    s.signature && `Signature: ${s.signature}`,
    cases(s.examples, 'Example'),
    `Constraints:\n${s.constraints.join('\n')}`,
    cases(s.testCases, 'Test'),
  ]
    .filter(Boolean)
    .join('\n\n');
}
