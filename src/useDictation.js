import { useEffect, useRef, useState } from 'react';

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

const PROBLEMS = {
  'not-allowed': 'Microphone access is blocked. Allow it in the browser’s site settings.',
  'service-not-allowed': 'This browser does not allow speech recognition here.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition needs an internet connection and did not get one.',
  'language-not-supported': 'This browser does not support that speech language.',
};

/** Speech to text using the browser's own recognition. Finished phrases go to `onPhrase`. */
export default function useDictation(onPhrase) {
  const [listening, setListening] = useState(false),
    [interim, setInterim] = useState(''),
    [problem, setProblem] = useState('');
  const active = useRef(null);
  const handler = useRef(onPhrase);
  handler.current = onPhrase;

  const start = (lang) => {
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    let wanted = true;
    const finish = () => {
      active.current = null;
      setListening(false);
      setInterim('');
    };
    recognition.onresult = (event) => {
      let unfinished = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) unfinished += result[0].transcript;
        else if (result[0].transcript.trim()) handler.current(result[0].transcript.trim());
      }
      setInterim(unfinished);
    };
    recognition.onerror = (event) => {
      // Silence is normal while thinking; listening simply restarts.
      if (event.error === 'no-speech') return;
      wanted = false;
      if (event.error !== 'aborted')
        setProblem(PROBLEMS[event.error] || `Speech recognition failed (${event.error}).`);
    };
    recognition.onend = () => {
      // Browsers stop after a pause, so keep going until the user stops.
      if (wanted) {
        try {
          return recognition.start();
        } catch {
          /* fall through and stop */
        }
      }
      finish();
    };
    setProblem('');
    try {
      recognition.start();
    } catch (err) {
      return setProblem(`Could not start the microphone: ${err.message}`);
    }
    active.current = {
      // Lets the last phrase arrive before ending.
      stop: () => {
        wanted = false;
        recognition.stop();
      },
      abort: () => {
        wanted = false;
        recognition.onresult = null;
        recognition.abort();
      },
    };
    setListening(true);
  };
  useEffect(() => () => active.current?.abort(), []);

  return {
    supported: Boolean(Recognition),
    listening,
    interim,
    problem,
    start,
    stop: () => active.current?.stop(),
  };
}
