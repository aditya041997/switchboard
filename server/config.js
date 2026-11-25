const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

/** Decides where to listen, and refuses any setup that would expose data without a password. */
export function listenConfig(env) {
  const password = env.APP_PASSWORD || '';
  if (password && password.length < 12)
    throw new Error('APP_PASSWORD must be at least 12 characters.');
  const hosted = Boolean(env.RENDER) || env.NODE_ENV === 'production';
  const host = env.HOST || (hosted ? '0.0.0.0' : '127.0.0.1');
  if (!password && (hosted || !LOOPBACK.has(host)))
    throw new Error(
      'Refusing to start: set APP_PASSWORD (12+ characters) before hosting Switchboard.',
    );
  return { password, host, port: Number(env.PORT) || 8787 };
}
