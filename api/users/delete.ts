// api/users/delete.ts — Eliminar usuario
import { createClient } from '@supabase/supabase-js';

type AnyReq = any;
type AnyRes = any;

function setCORS(res: AnyRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');
}

function json(res: AnyRes, status: number, body: unknown) {
  setCORS(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_DATABASE_URL ||
  process.env.SUPABASE_URL;

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: AnyReq, res: AnyRes) {
  try {
    setCORS(res);
    if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return json(res, 405, { ok: false, error: 'Method Not Allowed' });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(res, 200, {
        ok: false,
        error: 'Faltan variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel.',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { user_id } = body as { user_id: string };

    if (!user_id) {
      return json(res, 200, { ok: false, error: 'Falta user_id' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user_id);

    if (deleteAuthError) {
      return json(res, 200, { ok: false, error: `Error al eliminar usuario: ${deleteAuthError.message}` });
    }

    return json(res, 200, { ok: true, message: 'Usuario eliminado correctamente' });
  } catch (e: any) {
    return json(res, 200, { ok: false, error: e?.message || 'Error inesperado en endpoint' });
  }
}
