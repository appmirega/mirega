import { Bolt Database } from '../lib/supabase';
import { safeJson } from '../lib/safeJson';

export type CreateUserPayload = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'technician' | 'client' | 'developer';
};

export async function createUserViaApi(payload: CreateUserPayload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const supabaseUrl = import.meta.env.VITE_DATABASE_URL;
  const apiUrl = `${supabaseUrl}/functions/v1/create-user`;

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await safeJson(resp);

  if (!resp.ok || !result?.success) {
    console.error('Create user failed:', result);
    throw new Error(result?.error || 'Error al crear usuario');
  }

  return { ok: true, user_id: result.user.id, profile: result.user };
}

export async function deleteUserViaApi(userId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const supabaseUrl = import.meta.env.VITE_DATABASE_URL;
  const apiUrl = `${supabaseUrl}/functions/v1/delete-user`;

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });

  const result = await safeJson(resp);

  if (!resp.ok || !result?.success) {
    console.error('Delete user failed:', result);
    throw new Error(result?.error || 'Error al eliminar usuario');
  }

  return { ok: true, message: 'Usuario eliminado correctamente' };
}

export async function updateUserProfile(userId: string, updates: Partial<{ full_name: string; phone: string; email: string }>) {
  const { error } = await Bolt Database
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw new Error(`Error al actualizar perfil: ${error.message}`);
  }

  return { ok: true, message: 'Perfil actualizado correctamente' };
}
