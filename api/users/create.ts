import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(res: VercelResponse, status: number, body: any) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

type PersonType = 'internal' | 'external'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(res, 500, {
      ok: false,
      error: 'Missing Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
    })
  }

  let body: any = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return json(res, 400, { ok: false, error: 'Invalid JSON body' })
  }

  const {
    email,
    password,
    full_name,
    phone = null,
    role = 'technician',
    person_type = 'internal',
    company_name = null,
    grant_access = true,
    client_id = null,
    set_as_primary_client_user = false,
  } = body as {
    email: string
    password: string | null
    full_name: string
    phone?: string | null
    role?: string
    person_type?: PersonType
    company_name?: string | null
    grant_access?: boolean
    client_id?: string | null
    set_as_primary_client_user?: boolean
  }

  if (!email || !full_name) {
    return json(res, 400, { ok: false, error: 'Faltan campos obligatorios: email, full_name' })
  }

  const normalizedPersonType: PersonType = person_type === 'external' ? 'external' : 'internal'

  if (normalizedPersonType === 'external' && !company_name) {
    return json(res, 400, { ok: false, error: 'Para técnico externo falta company_name.' })
  }

  const effectivePassword =
    grant_access && password
      ? password
      : `${crypto.randomUUID()}Aa1!`

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
    if (listErr) throw listErr

    const existing = listData?.users?.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    let userId: string

    if (!existing) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: effectivePassword,
        email_confirm: true,
        user_metadata: {
          full_name,
          phone,
          role,
          person_type: normalizedPersonType,
          company_name: normalizedPersonType === 'external' ? company_name : null,
          client_id,
        },
      })

      if (createErr) throw createErr
      if (!created?.user?.id) throw new Error('No se pudo crear el usuario (sin id).')

      userId = created.user.id
    } else {
      userId = existing.id

      const { error: updateUserErr } = await admin.auth.admin.updateUserById(userId, {
        email,
        ...(grant_access ? { password: effectivePassword } : {}),
        user_metadata: {
          full_name,
          phone,
          role,
          person_type: normalizedPersonType,
          company_name: normalizedPersonType === 'external' ? company_name : null,
          client_id,
        },
      } as any)

      if (updateUserErr) throw updateUserErr
    }

    if (!grant_access) {
      await admin.auth.admin.updateUserById(userId, {
        banned_until: '2999-12-31T00:00:00Z',
      } as any)
    } else {
      await admin.auth.admin.updateUserById(userId, {
        banned_until: null,
      } as any)
    }

    const profilePayload = {
      id: userId,
      email,
      full_name,
      phone,
      role,
      is_active: !!grant_access,
      person_type: normalizedPersonType,
      company_name: normalizedPersonType === 'external' ? company_name : null,
      client_id: role === 'client' ? client_id : null,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })

    if (upsertErr) throw upsertErr

    if (role === 'client' && client_id && set_as_primary_client_user) {
      const { error: clientLinkErr } = await admin
        .from('clients')
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', client_id)

      if (clientLinkErr) throw clientLinkErr
    }

    return json(res, 200, { ok: true, user_id: userId })
  } catch (err: any) {
    console.error('create user error:', err)
    return json(res, 500, { ok: false, error: err?.message || 'Unknown error' })
  }
}
