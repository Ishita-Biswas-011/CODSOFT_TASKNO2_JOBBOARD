export const BASE = import.meta.env.VITE_API_URL || '/api';
export const tok = () => localStorage.getItem('t');
export async function api(p, o = {}) {
  const h = { ...(o.headers || {}) }; let body = o.body;
  if (tok()) h.Authorization = 'Bearer ' + tok();
  if (body && !(body instanceof FormData)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const r = await fetch(BASE + p, { ...o, headers: h, body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}