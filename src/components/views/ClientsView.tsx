import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ClientForm } from '../forms/ClientForm';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  RefreshCw,
  Eye,
  Download,
  X,
  Building2,
  MapPin,
  Mail,
  Phone,
  User,
  Wrench,
} from 'lucide-react';

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

interface ElevatorRow {
  id: string;
  client_id: string;
  tower_name: string | null;
  index_number: number | null;
  elevator_number: number | null;
  address_asc: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  capacity_kg: number | null;
  capacity_persons: number | null;
  floors: number | null;
  installation_date: string | null;
  has_machine_room: boolean | null;
  no_machine_room: boolean | null;
  stops_all_floors: boolean | null;
  stops_odd_floors: boolean | null;
  stops_even_floors: boolean | null;
  elevator_type: string | null;
  classification: string | null;
  created_at: string;
}

type Mode = 'create' | 'edit' | null;

const clean = (value?: string | null) => (value || '').trim();
const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

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

function escapeCsv(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return '""';
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function getElevatorStopPattern(elevator: ElevatorRow) {
  if (elevator.stops_all_floors) return 'Todos los pisos';
  if (elevator.stops_even_floors) return 'Pares';
  if (elevator.stops_odd_floors) return 'Impares';
  return 'Personalizado / no definido';
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

  const [detailClient, setDetailClient] = useState<ClientRow | null>(null);
  const [detailElevators, setDetailElevators] = useState<ElevatorRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  const closeDetail = () => {
    setDetailClient(null);
    setDetailElevators([]);
    setDetailError(null);
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
      if (detailClient?.id === client.id) {
        setDetailClient({ ...detailClient, is_active: newValue });
      }
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
      if (detailClient?.id === client.id) closeDetail();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'No se pudo eliminar el cliente. Revisa si tiene registros asociados.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openDetail = async (client: ClientRow) => {
    try {
      setDetailClient(client);
      setDetailLoading(true);
      setDetailError(null);
      setDetailElevators([]);

      const { data, error } = await supabase
        .from('elevators')
        .select(`
          id,
          client_id,
          tower_name,
          index_number,
          elevator_number,
          address_asc,
          manufacturer,
          model,
          serial_number,
          capacity_kg,
          capacity_persons,
          floors,
          installation_date,
          has_machine_room,
          no_machine_room,
          stops_all_floors,
          stops_odd_floors,
          stops_even_floors,
          elevator_type,
          classification,
          created_at
        `)
        .eq('client_id', client.id)
        .order('index_number', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setDetailElevators((data || []) as ElevatorRow[]);
    } catch (err: any) {
      console.error('Error loading client detail:', err);
      setDetailError(err.message || 'No se pudo cargar el detalle del cliente.');
    } finally {
      setDetailLoading(false);
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

  const exportClientsToCsv = () => {
    const rows = filtered.map((client) => {
      const contacts = client.contacts;
      const primary = contacts.find((item) => item.source === 'primary') || null;
      const admin = contacts.find((item) => item.source === 'admin') || null;
      const additional = contacts.filter((item) => item.source === 'additional');

      return {
        codigo_cliente: client.client_code || '',
        razon_social: client.company_name || '',
        edificio: client.building_name || '',
        alias_interno: client.internal_alias || '',
        rut: client.rut || '',
        direccion: client.address || '',
        comuna: client.commune || '',
        ciudad: client.city || '',
        tipo_edificio: client.building_type || '',
        administrador: admin?.name || '',
        email_administrador: admin?.email || '',
        telefono_administrador: admin?.phone || '',
        contacto_principal: primary?.name || '',
        cargo_contacto_principal: primary?.role || '',
        email_contacto_principal: primary?.email || '',
        telefono_contacto_principal: primary?.phone || '',
        contactos_adicionales: additional
          .map((item) => [item.name, item.role, item.email, item.phone].filter(Boolean).join(' | '))
          .join(' || '),
        estado: client.is_active ? 'Activo' : 'Inactivo',
        fecha_creacion: formatDate(client.created_at),
      };
    });

    if (rows.length === 0) {
      alert('No hay clientes para exportar con el filtro actual.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.map((header) => escapeCsv(header)).join(';'),
      ...rows.map((row) => headers.map((header) => escapeCsv((row as any)[header])).join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.setAttribute('download', `clientes_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const detailContacts = detailClient ? getClientContacts(detailClient) : [];
  const elevatorsGrouped = useMemo(() => {
    const map = new Map<string, ElevatorRow[]>();

    detailElevators.forEach((elevator) => {
      const key = clean(elevator.tower_name) || clean(elevator.address_asc) || 'Sin agrupación';
      const list = map.get(key) || [];
      list.push(elevator);
      map.set(key, list);
    });

    return Array.from(map.entries())
      .map(([groupName, items]) => [groupName, [...items].sort(compareElevators)] as [string, ElevatorRow[]])
      .sort(([groupA, itemsA], [groupB, itemsB]) => {
        const rankA = getNaturalGroupRank(groupA);
        const rankB = getNaturalGroupRank(groupB);

        if (rankA.kind === rankB.kind && rankA.kind !== 'custom' && rankA.value !== rankB.value) {
          return rankA.value - rankB.value;
        }

        if (rankA.kind !== rankB.kind) {
          const order = { letter: 0, number: 1, custom: 2 } as const;
          return order[rankA.kind] - order[rankB.kind];
        }

        const firstA = [...itemsA].sort(compareElevators)[0];
        const firstB = [...itemsB].sort(compareElevators)[0];
        const firstANumber = firstA?.elevator_number ?? firstA?.index_number ?? Number.MAX_SAFE_INTEGER;
        const firstBNumber = firstB?.elevator_number ?? firstB?.index_number ?? Number.MAX_SAFE_INTEGER;
        if (firstANumber !== firstBNumber) return firstANumber - firstBNumber;

        const createdA = firstA?.created_at ? new Date(firstA.created_at).getTime() : 0;
        const createdB = firstB?.created_at ? new Date(firstB.created_at).getTime() : 0;
        if (createdA !== createdB) return createdA - createdB;

        return groupA.localeCompare(groupB, 'es', { numeric: true, sensitivity: 'base' });
      });
  }, [detailElevators]);

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
            onClick={exportClientsToCsv}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            disabled={loading || filtered.length === 0}
          >
            <Download className="w-4 h-4" />
            Descargar Excel
          </button>
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

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-xl w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, edificio, contacto, email, teléfono, dirección o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <div className="text-xs text-slate-500">
          Mostrando <span className="font-semibold text-slate-700">{filtered.length}</span> cliente(s)
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

                const secondaryLabel = clean(client.company_name) || clean(client.building_name) || null;

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
                          onClick={() => openDetail(client)}
                          className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600"
                          title="Ver detalle del cliente"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

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

      {detailClient && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-slate-900/30" onClick={closeDetail} />
          <div className="w-full max-w-5xl bg-white shadow-2xl h-full overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <Building2 className="w-4 h-4" />
                  Ficha de cliente
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {clean(detailClient.internal_alias) || clean(detailClient.building_name) || detailClient.company_name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                    Código: {detailClient.client_code || '—'}
                  </span>
                  <span className={`px-2 py-1 rounded-full font-medium ${detailClient.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {detailClient.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <span>Creado: {formatDate(detailClient.created_at)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {detailError}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Datos generales</div>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><span className="font-medium text-slate-900">Razón social:</span> {detailClient.company_name || '—'}</div>
                      <div><span className="font-medium text-slate-900">Edificio:</span> {detailClient.building_name || '—'}</div>
                      <div><span className="font-medium text-slate-900">Alias interno:</span> {detailClient.internal_alias || '—'}</div>
                      <div><span className="font-medium text-slate-900">RUT:</span> {detailClient.rut || '—'}</div>
                      <div><span className="font-medium text-slate-900">Tipo edificio:</span> {detailClient.building_type || '—'}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Ubicación</div>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                        <div>
                          <div>{detailClient.address || '—'}</div>
                          <div className="text-slate-500">{[detailClient.commune, detailClient.city].filter(Boolean).join(', ') || 'Sin comuna / ciudad'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Resumen</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white border border-slate-200 px-3 py-4">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">Ascensores</div>
                      <div className="text-2xl font-bold text-slate-900 mt-1">{detailElevators.length}</div>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 px-3 py-4">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">Grupos / torres</div>
                      <div className="text-2xl font-bold text-slate-900 mt-1">{elevatorsGrouped.length}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-slate-500" />
                  <h3 className="font-semibold text-slate-900">Contactos del cliente</h3>
                </div>

                {detailContacts.length === 0 ? (
                  <div className="text-sm text-slate-500">No hay contactos visibles para este cliente.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {detailContacts.map((contact, index) => (
                      <div key={`detail-contact-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="font-medium text-slate-900">{contact.name}</div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 mt-1">{contact.role || 'Contacto'}</div>
                        {contact.email && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span>{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Wrench className="w-4 h-4 text-slate-500" />
                  <h3 className="font-semibold text-slate-900">Detalle de ascensores</h3>
                </div>

                {detailLoading ? (
                  <div className="text-sm text-slate-500">Cargando ascensores del cliente...</div>
                ) : detailElevators.length === 0 ? (
                  <div className="text-sm text-slate-500">Este cliente aún no tiene ascensores registrados.</div>
                ) : (
                  <div className="space-y-4">
                    {elevatorsGrouped.map(([groupName, items]) => (
                      <div key={groupName} className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{groupName}</div>
                            <div className="text-xs text-slate-500">{items.length} ascensor(es) en este grupo</div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-white border-b border-slate-100 text-slate-500">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium">Ascensor</th>
                                <th className="px-4 py-2 text-left font-medium">Marca / modelo</th>
                                <th className="px-4 py-2 text-left font-medium">Capacidad</th>
                                <th className="px-4 py-2 text-left font-medium">Paradas</th>
                                <th className="px-4 py-2 text-left font-medium">Operación</th>
                                <th className="px-4 py-2 text-left font-medium">Serie</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((elevator) => (
                                <tr key={elevator.id} className="border-b border-slate-50 last:border-0">
                                  <td className="px-4 py-3 align-top">
                                    <div className="font-medium text-slate-900">
                                      Ascensor #{elevator.elevator_number ?? elevator.index_number ?? '—'}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {elevator.address_asc || detailClient.address || 'Sin dirección'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <div className="text-slate-900">{elevator.manufacturer || '—'}</div>
                                    <div className="text-xs text-slate-500 mt-1">{elevator.model || 'Modelo no indicado'}</div>
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <div>{elevator.capacity_persons || '—'} personas</div>
                                    <div className="text-xs text-slate-500 mt-1">{elevator.capacity_kg || '—'} kg</div>
                                  </td>
                                  <td className="px-4 py-3 align-top">{elevator.floors || '—'}</td>
                                  <td className="px-4 py-3 align-top">
                                    <div>{getElevatorStopPattern(elevator)}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {elevator.has_machine_room ? 'Con sala de máquinas' : elevator.no_machine_room ? 'Sin sala de máquinas' : 'Sala no definida'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <div>{elevator.serial_number || '—'}</div>
                                    <div className="text-xs text-slate-500 mt-1">Instalación: {formatDate(elevator.installation_date)}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientsView;
