import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createAi } from './ai.js';
import { createApp } from './app.js';
import { listenConfig } from './config.js';
import { createStore, mongoBackup } from './store.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

let config;
try {
  config = listenConfig(process.env);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
const { MONGODB_URI, MONGODB_DATABASE, OPENAI_API_KEY, OPENAI_MODEL, JITSI_DOMAIN, DATA_FILE } =
  process.env;
const app = createApp({
  store: createStore({
    file: DATA_FILE || join(root, 'data/switchboard.json'),
    backup: mongoBackup(MONGODB_URI, MONGODB_DATABASE || undefined),
  }),
  ai: createAi({ apiKey: OPENAI_API_KEY, model: OPENAI_MODEL || undefined }),
  password: config.password,
  jitsiDomain: JITSI_DOMAIN,
  temporaryDisk: Boolean(process.env.RENDER),
  dist: join(root, 'dist'),
});
app.listen(config.port, config.host, () =>
  console.log(`Switchboard API: http://localhost:${config.port}`),
);
