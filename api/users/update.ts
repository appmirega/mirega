// api/users/update.ts
import { createClient } from '@supabase/supabase-js';

type AnyReq = any;
type AnyRes = any;
type Role = 'admin' | 'technician' | 'client' | 'developer';

function setCORS(res: AnyRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
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

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY; // Debe estar en Vercel

export default async function handler(req: AnyReq, res: AnyRes) {
  try {
    setCORS(res);

    if (req.method === 'OPTIONS') {
      return json(res, 200, { ok: true });
    }

    if (req.method !== 'POST') {
      return json(res, 405, { ok: false, error: 'Method Not Allowed' });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(res, 500, {
        ok: false,
        error: 'Faltan variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel.',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { user_id, email, full_name, phone = null, role, password } = body as {
      user_id: string;
      email: string;
      full_name: string;
      phone?: string | null;
      role: Role;
      password?: string;
    };

    if (!user_id || !email || !full_name || !role) {
      return json(res, 400, { ok: false, error: 'Faltan campos: user_id, email, full_name, role.' });
    }

    if (password && password.length < 8) {
      return json(res, 400, { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { error: updateAuthError } = await admin.auth.admin.updateUserById(user_id, {
      email,
      password: password || undefined,
      user_metadata: { full_name, phone, role },
    });

    if (updateAuthError) {
      return json(res, 500, { ok: false, error: `UpdateUser: ${updateAuthError.message}` });
    }

    const { data: profile, error: updateProfileError } = await admin
      .from('profiles')
      .update({
        email,
        full_name,
        phone,
        role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id)
      .select('*')
      .single();

    if (updateProfileError) {
      return json(res, 500, { ok: false, error: `Update profile: ${updateProfileError.message}` });
    }

    return json(res, 200, {
      ok: true,
      user_id,
      profile,
      marker: 'USERS_UPDATE_FINAL_v1',
    });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || 'Error inesperado en endpoint' });
  }
}
