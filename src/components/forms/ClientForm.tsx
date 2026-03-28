import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
Building2,
Mail,
Phone,
User,
X,
Plus,
Trash2,
MapPin,
Layers3,
Briefcase,
Users,
} from 'lucide-react';

/* =========================
(TIPOS Y FUNCIONES IGUALES)
========================= */

/* 👉 NO MODIFIQUÉ NADA ARRIBA */
/* 👉 TU ARCHIVO SIGUE IGUAL */

/* =========================
SOLO CAMBIO REAL DESDE AQUÍ
========================= */

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {

// ... TODO TU CÓDIGO ORIGINAL SIN CAMBIOS ...

const createClientAccessUsers = async (clientId: string) => {
const accessUsers = buildClientAccessUsers();
if (accessUsers.length === 0) return;

```
const {
  data: { session },
} = await supabase.auth.getSession();

if (!session) {
  throw new Error('No hay sesión activa para crear accesos cliente.');
}

const defaultPassword = getDefaultClientPassword();

for (let i = 0; i < accessUsers.length; i += 1) {
  const accessUser = accessUsers[i];

  const res = await fetch('/api/users/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: accessUser.email,
      password: defaultPassword,
      full_name: accessUser.full_name,
      phone: accessUser.phone,
      role: 'client',
      person_type: 'internal',
      company_name: null,
      grant_access: true,
      client_id: clientId,
      set_as_primary_client_user: i === 0,
    }),
  });

  const result = await res.json().catch(() => ({}));

  if (!res.ok || !result?.ok) {
    throw new Error(
      `No se pudo crear acceso cliente para ${accessUser.email}: ${
        result?.error || 'Error desconocido'
      }`
    );
  }
}
```

};

/* =========================
🔥 NUEVA FUNCIÓN (IMPORTANTE)
========================= */

const syncClientAccessWithProfiles = async (clientId: string) => {
const emails = new Set<string>();

```
const addEmail = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized) emails.add(normalized);
};

if (!clientData.self_managed) {
  addEmail(clientData.admin_email);
}

if (showBuildingContacts) {
  addEmail(clientData.primary_contact_email);

  additionalContacts.forEach((contact) => {
    addEmail(contact.email);
  });
}

const emailList = Array.from(emails);
if (emailList.length === 0) return;

const { data: profiles } = await supabase
  .from('profiles')
  .select('id, email')
  .in('email', emailList);

if (!profiles || profiles.length === 0) return;

const accessRows = profiles.map((p) => ({
  user_id: p.id,
  client_id: clientId,
  access_role: 'primary',
}));

await supabase
  .from('client_user_access')
  .upsert(accessRows, {
    onConflict: 'user_id,client_id',
  });
```

};

/* =========================
🔥 MODIFICACIÓN EN SUBMIT
========================= */

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
if (loading) return;

```
setLoading(true);
setError(null);
setSuccess(null);

try {
  validateClient();

  if (isEditMode && client?.id) {
    const { error: updateError } = await supabase
      .from('clients')
      .update(buildClientUpdatePayload())
      .eq('id', client.id);

    if (updateError) throw updateError;

    setSuccess('Cliente actualizado correctamente.');
    onSuccess?.();
  } else {
    validateGroups();

    const { data: insertedClient, error: clientError } = await supabase
      .from('clients')
      .insert(buildClientInsertPayload())
      .select('id')
      .single();

    if (clientError) throw clientError;
    if (!insertedClient?.id) {
      throw new Error('No se pudo recuperar el cliente creado.');
    }

    const elevatorPayloads = buildElevatorPayloads(insertedClient.id);

    if (elevatorPayloads.length > 0) {
      const { error: elevatorError } = await supabase
        .from('elevators')
        .insert(elevatorPayloads);

      if (elevatorError) {
        throw new Error(
          `Cliente creado, pero falló la creación de ascensores: ${elevatorError.message}`
        );
      }
    }

    /* 🔥 AQUÍ ESTÁ LA MAGIA */
    await createClientAccessUsers(insertedClient.id);
    await syncClientAccessWithProfiles(insertedClient.id);

    setSuccess(
      `Cliente creado correctamente con ${elevatorPayloads.length} ascensor(es) y accesos cliente generados.`
    );

    resetForm();
    onSuccess?.();
  }
} catch (err: any) {
  console.error(err);
  setError(err?.message || 'Error al guardar cliente.');
} finally {
  setLoading(false);
}
```

};

/* =========================
TODO EL RESTO IGUAL
========================= */

return ( <div className="rounded-xl bg-white p-6 shadow-lg">
{/* TU UI ORIGINAL COMPLETA */} </div>
);
}
