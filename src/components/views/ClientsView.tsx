import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ClientForm } from '../forms/ClientForm';
import { Plus, Search, Edit2, Trash2, Power, RefreshCw } from 'lucide-react';

interface ContactItem {
name: string;
role?: string | null;
email?: string | null;
phone?: string | null;
source: 'admin' | 'primary' | 'additional';
}

interface ClientAlternateContactsPayload {
self_managed?: boolean;
admin_company?: string | null;
enable_building_contacts?: boolean;
additional_contacts?: Array<{
name?: string | null;
role?: string | null;
email?: string | null;
phone?: string | null;
}>;
}

interface ClientRow {
id: string;
company_name: string;
building_name: string | null;
internal_alias: string | null;
rut: string | null;
address: string;
commune: string | null;
city: string | null;
building_type: 'residencial' | 'corporativo' | null;
contact_name: string | null;
contact_person: string | null;
contact_email: string | null;
contact_phone: string | null;
admin_name: string | null;
admin_email: string | null;
admin_phone: string | null;
alternate_contacts: ClientAlternateContactsPayload | null;
client_code: string | null;
is_active: boolean | null;
created_at: string;
}

type Mode = 'create' | 'edit' | null;

const clean = (value?: string | null) => (value || '').trim();

function getClientContacts(client: ClientRow): ContactItem[] {
const items: ContactItem[] = [];

if (clean(client.admin_name) || clean(client.admin_email) || clean(client.admin_phone)) {
items.push({
name: clean(client.admin_name) || 'Administrador',
role: 'Administrador',
email: clean(client.admin_email) || null,
phone: clean(client.admin_phone) || null,
source: 'admin',
});
}

if (clean(client.contact_name) || clean(client.contact_email) || clean(client.contact_phone)) {
items.push({
name: clean(client.contact_name) || 'Contacto principal',
role: clean(client.contact_person) || 'Contacto principal',
email: clean(client.contact_email) || null,
phone: clean(client.contact_phone) || null,
source: 'primary',
});
}

for (const contact of client.alternate_contacts?.additional_contacts || []) {
if (!clean(contact?.name) && !clean(contact?.email) && !clean(contact?.phone)) continue;

```
items.push({
  name: clean(contact?.name) || 'Contacto adicional',
  role: clean(contact?.role) || 'Contacto adicional',
  email: clean(contact?.email) || null,
  phone: clean(contact?.phone) || null,
  source: 'additional',
});
```

}

return items;
}

export function ClientsView() {
const [clients, setClients] = useState<ClientRow[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [search, setSearch] = useState('');
const [drawerOpen, setDrawerOpen] = useState(false);
const [drawerMode, setDrawerMode] = useState<Mode>(null);
const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

const openCreate = () => {
setSelectedClient(null);
setDrawerMode('create');
setDrawerOpen(true);
setError(null);
};

const openEdit = (client: ClientRow) => {
setSelectedClient(client);
setDrawerMode('edit');
setDrawerOpen(true);
setError(null);
};

const closeDrawer = () => {
setDrawerOpen(false);
setDrawerMode(null);
setSelectedClient(null);
};

const handleFormSuccess = () => {
closeDrawer();
loadClients();
};

const loadClients = async () => {
try {
setLoading(true);
setError(null);

```
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  setClients((data || []) as ClientRow[]);
} catch (err: any) {
  console.error('Error loading clients:', err);
  setError(err.message || 'Error al cargar los clientes.');
} finally {
  setLoading(false);
}
```

};

useEffect(() => {
loadClients();
}, []);

const filtered = clients.filter((client) =>
(client.company_name + client.internal_alias + client.building_name)
.toLowerCase()
.includes(search.toLowerCase())
);

return ( <div className="p-6"> <h1 className="text-xl font-bold mb-4">Clientes</h1>

```
  <div className="space-y-4">
    {filtered.map((client) => (
      <div key={client.id} className="p-4 border rounded-lg bg-white">

        {/* 🔥 CAMBIO AQUÍ */}
        <div className="font-bold text-lg text-slate-900">
          {client.internal_alias || client.building_name || 'Cliente'}
        </div>

        <div className="text-sm text-slate-500">
          {client.company_name}
        </div>

      </div>
    ))}
  </div>
</div>
```

);
}
