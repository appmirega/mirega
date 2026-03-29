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

    items.push({
      name: clean(contact?.name) || 'Contacto adicional',
      role: clean(contact?.role) || 'Contacto adicional',
      email: clean(contact?.email) || null,
      phone: clean(contact?.phone) || null,
      source: 'additional',
    });
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

      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          company_name,
          building_name,
          internal_alias,
          rut,
          address,
          commune,
          city,
          building_type,
          contact_name,
          contact_person,
          contact_email,
          contact_phone,
          admin_name,
          admin_email,
          admin_phone,
          alternate_contacts,
          client_code,
          is_active,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients((data || []) as ClientRow[]);
    } catch (err: any) {
      console.error('Error loading clients:', err);
      setError(err.message || 'Error al cargar los clientes desde la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const enrichedClients = useMemo(
    () =>
      clients.map((client) => ({
        ...client,
        contacts: getClientContacts(client),
      })),
    [clients]
  );

  const toggleActive = async (client: ClientRow) => {
    try {
      setActionLoadingId(client.id);
      const newValue = !client.is_active;

      const { error } = await supabase
        .from('clients')
        .update({ is_active: newValue })
        .eq('id', client.id);

      if (error) throw error;

      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, is_active: newValue } : c)));
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'No se pudo actualizar el estado del cliente.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const deleteClient = async (client: ClientRow) => {
    const confirmMsg =
      '¿Seguro que deseas eliminar este cliente?\n\n' +
      'Si tiene registros relacionados, la base de datos puede bloquear la eliminación.\n' +
      'En ese caso usa solo la opción Activar/Desactivar.';

    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoadingId(client.id);

      const { error } = await supabase.from('clients').delete().eq('id', client.id);
      if (error) throw error;

      setClients((prev) => prev.filter((c) => c.id !== client.id));
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'No se pudo eliminar el cliente. Revisa si tiene registros asociados.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = enrichedClients.filter((client) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;

    const contactBlob = client.contacts
      .flatMap((contact) => [contact.name, contact.role || '', contact.email || '', contact.phone || ''])
      .join(' ')
      .toLowerCase();

    return [
      client.company_name,
      client.building_name || '',
      client.internal_alias || '',
      client.rut || '',
      client.address || '',
      client.commune || '',
      client.city || '',
      client.client_code || '',
      contactBlob,
    ]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Clientes</h1>
          <p className="text-sm text-slate-500">
            Administra la información de tus clientes, sus datos de contacto y estado.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadClients}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, edificio, contacto, email, teléfono, dirección o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-100 shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="text-5xl">📄</div>
            <div className="font-medium">No se encontraron clientes</div>
            <div className="text-sm">
              Crea un nuevo cliente con el botón <span className="font-semibold">“Nuevo Cliente”</span>.
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-left text-slate-500">
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Contacto</th>
                <th className="px-4 py-2 font-medium">Dirección</th>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium text-center">Estado</th>
                <th className="px-4 py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const mainLabel =
                  clean(client.internal_alias) ||
                  clean(client.building_name) ||
                  clean(client.company_name) ||
                  'Cliente';

                const secondaryLabel =
                  clean(client.company_name) ||
                  clean(client.building_name) ||
                  null;

                return (
                  <tr key={client.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                    <td className="px-4 py-2 align-top">
                      <div className="font-semibold text-slate-900">{mainLabel}</div>
                      {secondaryLabel && secondaryLabel !== mainLabel && (
                        <div className="text-xs text-slate-500">{secondaryLabel}</div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        Creado: {new Date(client.created_at).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-4 py-2 align-top">
                      <div className="space-y-2 min-w-[280px]">
                        {client.contacts.length === 0 ? (
                          <div className="text-xs text-slate-400">Sin contactos visibles</div>
                        ) : (
                          client.contacts.map((contact, index) => (
                            <div key={`${client.id}-contact-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <div className="text-sm font-medium text-slate-800">{contact.name}</div>
                              {contact.role && <div className="text-[11px] uppercase tracking-wide text-slate-500">{contact.role}</div>}
                              {contact.email && <div className="text-xs text-slate-600">{contact.email}</div>}
                              {contact.phone && <div className="text-xs text-slate-600">{contact.phone}</div>}
                            </div>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-2 align-top">
                      <div className="text-xs text-slate-700">{client.address}</div>
                    </td>

                    <td className="px-4 py-2 align-top">
                      <div className="text-xs font-mono text-slate-700">{client.client_code || '—'}</div>
                    </td>

                    <td className="px-4 py-2 align-top text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          client.is_active
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-slate-50 text-slate-500 border border-slate-100'
                        }`}
                      >
                        {client.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    <td className="px-4 py-2 align-top">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(client)}
                          className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600"
                          title="Editar cliente"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleActive(client)}
                          className="p-1.5 rounded-md hover:bg-slate-50 text-slate-700"
                          title={client.is_active ? 'Desactivar cliente' : 'Activar cliente'}
                          disabled={actionLoadingId === client.id}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteClient(client)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-500"
                          title="Eliminar cliente"
                          disabled={actionLoadingId === client.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/20" onClick={closeDrawer} />
          <div className="w-full max-w-3xl bg-white shadow-2xl h-full overflow-y-auto p-6">
            <ClientForm client={drawerMode === 'edit' ? selectedClient : null} onSuccess={handleFormSuccess} onCancel={closeDrawer} />
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientsView;