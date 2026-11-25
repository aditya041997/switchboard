export class AiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

/** The raw Responses API has no top-level output_text; that is an SDK-only helper. */
export function extractText(body) {
  return (body?.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

export function createAi({
  apiKey,
  model = 'gpt-6.2-astra',
  fetchImpl = fetch,
  timeoutMs = 120000,
}) {
  return {
    configured: Boolean(apiKey),
    async ask(instructions, input, format) {
      if (!apiKey)
        throw new AiError(
          'AI is not configured. Add OPENAI_API_KEY to .env and restart the server.',
          503,
        );
      let response;
      let body;
      try {
        response = await fetchImpl('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            instructions,
            input,
            store: false,
            ...(format && { text: { format } }),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        body = await response.json();
      } catch (err) {
        throw new AiError(`Could not get a reply from OpenAI: ${err.message}`);
      }
      if (!response.ok)
        throw new AiError(body?.error?.message || `OpenAI returned status ${response.status}.`);
      if (body.status === 'incomplete')
        throw new AiError('The AI reply was cut off before it finished. Try a shorter input.');
      const text = extractText(body);
      if (!text) throw new AiError('The AI reply contained no text. Please try again.');
      return text;
    },
  };
}
