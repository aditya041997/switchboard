const KEY = 'switchboard-auth';
const read = () => {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
};
let token = read();

export function setPassword(password) {
  token = btoa(String.fromCharCode(...new TextEncoder().encode(password)));
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    /* kept in memory only */
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the Switchboard server. Is `npm run dev` still running?');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw Object.assign(new Error(data?.error || 'Cannot reach the Switchboard server.'), {
      status: response.status,
    });
  return data;
}
