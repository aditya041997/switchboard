import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MongoClient } from 'mongodb';
import { migrateState, starterState } from '../shared/model.js';

export class StoreError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

/** Backup adapter. Returns null when MongoDB is not configured. */
export function mongoBackup(uri, database = 'switchboard') {
  if (!uri) return null;
  let client;
  async function collection() {
    try {
      client ??= new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
      await client.connect();
      return client.db(database).collection('backups');
    } catch (err) {
      client = undefined;
      throw err;
    }
  }
  return {
    async read() {
      return (await (await collection()).findOne({ _id: 'primary' }))?.data ?? null;
    },
    async write(data) {
      await (
        await collection()
      ).updateOne({ _id: 'primary' }, { $set: { data, updatedAt: new Date() } }, { upsert: true });
    },
  };
}

export function createStore({ file, backup = null, now = Date.now, retryMs = 5000 }) {
  let queue = Promise.resolve();
  // One operation at a time, so two requests cannot interleave a read and a write.
  const exclusive = (fn) => {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  };

  // Whether MongoDB holds the newest copy. While it does not, the store keeps retrying.
  const status = { configured: Boolean(backup), synced: false, lastSync: null };
  let timer = null;
  let delay = retryMs;
  function mark(synced) {
    status.synced = synced;
    if (synced) {
      status.lastSync = now();
      delay = retryMs;
      clearTimeout(timer);
      timer = null;
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        exclusive(load).catch((err) => console.warn('Mongo retry failed:', err.message));
      }, delay);
      timer.unref();
      delay = Math.min(delay * 2, 60000);
    }
  }

  function readLocal() {
    if (!existsSync(file)) return null;
    try {
      return migrateState(JSON.parse(readFileSync(file, 'utf8')));
    } catch (err) {
      // Never replace an unreadable file with empty data.
      throw new StoreError(`Could not read ${file}: ${err.message}. The file was left untouched.`);
    }
  }
  function writeLocal(data) {
    mkdirSync(dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    writeFileSync(temp, JSON.stringify(data, null, 2));
    renameSync(temp, file);
  }
  async function pushBackup(data) {
    if (!backup) return false;
    try {
      await backup.write(data);
      mark(true);
      return true;
    } catch (err) {
      console.warn('Mongo backup skipped:', err.message);
      mark(false);
      return false;
    }
  }

  /** The newest copy wins. On a tie the local copy wins. */
  async function load() {
    const local = readLocal();
    if (!backup) return local ?? starterState();
    let cloud;
    try {
      const raw = await backup.read();
      cloud = raw ? migrateState(raw) : null;
    } catch (err) {
      console.warn('Mongo restore skipped:', err.message);
      mark(false);
      if (local) return local;
      // Starting empty here could later overwrite a good backup.
      throw new StoreError('The backup is unreachable and there is no local copy. Try again.', 503);
    }
    if (cloud && (!local || cloud.meta.updatedAt > local.meta.updatedAt)) {
      writeLocal(cloud);
      mark(true);
      return cloud;
    }
    if (local && (!cloud || local.meta.updatedAt > cloud.meta.updatedAt)) await pushBackup(local);
    else mark(true);
    return local ?? starterState();
  }

  return {
    load: () => exclusive(load),
    status: () => ({ ...status }),
    save: (next) =>
      exclusive(async () => {
        const current = await load();
        if (next.meta?.rev !== current.meta.rev)
          throw new StoreError(
            'This data changed in another tab or device. Reload before saving.',
            409,
          );
        const data = migrateState(next);
        data.meta.rev = current.meta.rev + 1;
        data.meta.updatedAt = Math.max(now(), current.meta.updatedAt + 1);
        writeLocal(data);
        return { data, backedUp: await pushBackup(data) };
      }),
  };
}
