// src/utils/fetchJson.ts
export async function fetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const ct = res.headers.get('content-type') || '';

  // Intentar parsear JSON cuando corresponde
  if (ct.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Error');
    return data;
  }

  // Fallback: texto (por si el server no envía JSON)
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Error');
  try {
    return JSON.parse(text);
  } catch {
    return { ok: res.ok, raw: text };
  }
}
