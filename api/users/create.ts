// api/users/create.ts
import { createClient } from '@supabase/supabase-js';

type AnyReq = any;
type AnyRes = any;

type Role = 'admin' | 'technician' | 'client';
type PersonType = 'internal' | 'external';

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

// Password por defecto solicitado: Mirega{AÑO}@@ (ej: Mirega2026@@)
function defaultPasswordForYear(date = new Date()) {
  const year = date.getFullYear();
  return `Mirega${year}@@`;
}

async function findUserByEmail(admin: any, email: string) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 1000;

  for (let i = 0; i < 50; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`ListUsers: ${error.message}`);

    const found =
      data?.users?.find((u: any) => u?.email && u.email.toLowerCase() === target) || null;

    if (found) return found;

    // Si vienen menos de perPage, ya no hay más
    if (!data?.users || data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

export default async function handler(req: AnyReq, res: AnyRes) {
  try {
    setCORS(res);

    if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method Not Allowed' });

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(res, 500, {
        ok: false,
        error: 'Faltan variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel.',
      });
    }

    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const {
      email,
      password,
      full_name,
      phone = null,
      role,
      person_type = 'internal',
      company_name = null,
      grant_access = true,
    } = body as {
      email: string;
      password?: string | null;
      full_name: string;
      phone?: string | null;
      role: Role;
      person_type?: PersonType;
      company_name?: string | null;
      grant_access?: boolean;
    };

    if (!email || !full_name || !role) {
      return json(res, 400, { ok: false, error: 'Faltan campos: email, full_name, role.' });
    }

    if (person_type !== 'internal' && person_type !== 'external') {
      return json(res, 400, { ok: false, error: 'person_type inválido (internal|external).' });
    }

    if (person_type === 'external' && !company_name) {
      return json(res, 400, { ok: false, error: 'Para técnico externo falta company_name.' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // 1) Buscar usuario por email
    let user = await findUserByEmail(admin, email);

    // Regla:
    // - Si el frontend envía password explícita (no vacía), se usa.
    // - Si no envía password, se usa la clave estándar del año.
    const passwordProvided = typeof password === 'string' && password.trim().length > 0;
    const effectivePassword = passwordProvided ? password.trim() : defaultPasswordForYear();

    const isNewUser = !user;

    // 2) Crear si no existe
    if (!user) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: effectivePassword,
        email_confirm: true,
        user_metadata: { full_name, phone, role, person_type, company_name },
      });

      if (createErr) {
        return json(res, 500, { ok: false, error: `CreateUser: ${createErr.message}` });
      }

      user = created?.user || null;
    } else {
      // 2b) Si ya existe: actualizar metadata + (opcional) password si se envió explícita
      try {
        const updatePayload: any = {
          user_metadata: { full_name, phone, role, person_type, company_name },
        };

        // Solo cambiamos password si el frontend envió una password explícita
        if (passwordProvided) {
          updatePayload.password = effectivePassword;
        }

        // Si ahora sí quieres dar acceso, intenta quitar baneo (si aplica)
        if (grant_access) {
          updatePayload.banned_until = null;
        }

        const { error: updErr } = await admin.auth.admin.updateUserById(user.id, updatePayload);
        if (updErr) {
          // no bloqueamos el flujo por esto
        }
      } catch {
        // Ignorar si la versión del SDK/Api difiere
      }
    }

    if (!user?.id) {
      return json(res, 500, { ok: false, error: 'No se obtuvo id de usuario (Auth).' });
    }

    const auth_id = user.id;

    // 3) Si NO se entrega acceso: bloquear (ban largo)
    if (!grant_access) {
      try {
        await admin.auth.admin.updateUserById(auth_id, {
          banned_until: '2999-12-31T00:00:00Z',
        } as any);
      } catch {
        // Si no soporta banned_until, igual queda is_active=false en profiles
      }
    }

    // 4) Upsert en profiles
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
            is_active: !!grant_access,
            person_type,
            company_name: person_type === 'external' ? company_name : null,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (upsertErr) {
      return json(res, 500, { ok: false, error: `Upsert profile: ${upsertErr.message}` });
    }

    return json(res, 200, {
      ok: true,
      user_id: auth_id,
      profile,
      // Solo informativo (si fue creado recién y no se envió password manual)
      initial_password: isNewUser && grant_access && !passwordProvided ? effectivePassword : null,
      marker: 'USERS_CREATE_FINAL_v2_PERSON_TYPE',
    });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || 'Error inesperado en endpoint' });
  }
}