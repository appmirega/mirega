export async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await res.json();
  const text = await res.text();
  return { ok: false, error: text?.slice(0, 250) || 'Respuesta no JSON' };
}
