// api/users/create.ts
import { createClient } from '@supabase/supabase-js';

type AnyReq = any;
type AnyRes = any;
type Role = 'admin' | 'technician' | 'client';

function setCORS(res: AnyRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Client-Info, Apikey'
  );
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
        error:
          'Faltan variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel.'
      });
    }

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const { email, password, full_name, phone = null, role } = body as {
      email: string;
      password: string;
      full_name: string;
      phone?: string | null;
      role: Role;
    };

    if (!email || !password || !full_name || !role) {
      return json(res, 400, {
        ok: false,
        error: 'Faltan campos: email, password, full_name, role.'
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false }
    });

    // 1) Buscar usuario por email
    const { data: listData, error: listErr } =
      await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });

    if (listErr) {
      return json(res, 500, {
        ok: false,
        error: `ListUsers: ${listErr.message}`
      });
    }

    let user =
      listData?.users?.find(
        (u: any) =>
          u.email && u.email.toLowerCase() === email.toLowerCase()
      ) || null;

    // 2) Crear si no existe
    if (!user) {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, phone, role }
        });

      if (createErr) {
        return json(res, 500, {
          ok: false,
          error: `CreateUser: ${createErr.message}`
        });
      }

      user = created?.user || null;
    }

    if (!user?.id) {
      return json(res, 500, {
        ok: false,
        error: 'No se obtuvo id de usuario (Auth).'
      });
    }

    const auth_id = user.id;

    // 3) Upsert en profiles
    const { data: profile, error: upsertErr } = await admin
      .from('profiles')
      .upsert(
        [
          {
            id: auth_id,
            email,
            full_name,
            phone,
            role,
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (upsertErr) {
      return json(res, 500, {
        ok: false,
        error: `Upsert profile: ${upsertErr.message}`
      });
    }

    return json(res, 200, {
      ok: true,
      user_id: auth_id,
      profile,
      marker: 'USERS_CREATE_FINAL_v1'
    });
  } catch (e: any) {
    return json(res, 500, {
      ok: false,
      error: e?.message || 'Error inesperado en endpoint'
    });
  }
}

