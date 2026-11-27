import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Holds the app state and saves changes one at a time, in order. */
export function useStore() {
  const [data, setData] = useState(null),
    [error, setError] = useState(null),
    [saving, setSaving] = useState(0),
    [toast, setToast] = useState(''),
    [storage, setStorage] = useState(null);
  const latest = useRef(null);
  const rev = useRef(0);
  const chain = useRef(Promise.resolve());
  const generation = useRef(0);
  const timer = useRef();

  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 5000);
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await api('/state');
      latest.current = next;
      rev.current = next.meta.rev;
      setData(next);
      setError(null);
    } catch (err) {
      // Never fall back to empty data: saving it would erase the real data.
      latest.current = null;
      setData(null);
      setError(err);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const checkStorage = useCallback(
    () =>
      api('/storage')
        .then(setStorage)
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    if (data) checkStorage();
  }, [Boolean(data), checkStorage]);
  // Keep checking until MongoDB has caught up.
  const behind = Boolean(storage?.configured && !storage.synced);
  useEffect(() => {
    if (!behind) return;
    const poll = setInterval(checkStorage, 15000);
    return () => clearInterval(poll);
  }, [behind, checkStorage]);

  /** `change` receives the newest state and returns the next one. */
  const update = useCallback(
    (change) => {
      if (!latest.current) return Promise.resolve(false);
      const next = change(latest.current);
      latest.current = next;
      setData(next);
      setSaving((n) => n + 1);
      const mine = generation.current;
      const run = chain.current.then(async () => {
        if (mine !== generation.current) return false;
        try {
          const result = await api('/state', {
            method: 'PUT',
            body: { ...next, meta: { ...next.meta, rev: rev.current } },
          });
          rev.current = result.meta.rev;
          setStorage((s) => s && { ...s, synced: result.mongoBackup });
          notify(result.mongoBackup ? 'Saved and backed up to Mongo' : 'Saved on the server');
          return true;
        } catch (err) {
          notify(`Not saved: ${err.message}`);
          // A refused save is discarded and reloaded. After a network failure the changes stay
          // on screen and go out with the next save.
          if ([400, 401, 409].includes(err.status)) {
            generation.current += 1;
            await load();
          }
          return false;
        }
      });
      chain.current = run.finally(() => setSaving((n) => n - 1));
      return run;
    },
    [load, notify],
  );

  return { data, error, saving: saving > 0, toast, storage, update, reload: load };
}
