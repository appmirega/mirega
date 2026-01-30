// src/components/views/ClientsView.tsx

import { useEffect, useState } from 'react';
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
} from 'lucide-react';

interface ClientRow {
  id: string;
  company_name: string;
  building_name: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  client_code: string | null;
  is_active: boolean | null;
  created_at: string;
}

type Mode = 'create' | 'edit' | null;

interface ClientsViewProps {
  onNavigate?: (path: string, clientId?: string) => void;
}

export function ClientsView({ onNavigate }: ClientsViewProps) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<Mode>(null);
  const [selectedClient, setSelectedClient] =
    useState<ClientRow | null>(null);

  const [actionLoadingId, setActionLoadingId] =
    useState<string | null>(null);

  // ------------------------
  // Helpers
  // ------------------------

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

  // ------------------------
  // Load clients
  // ------------------------

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('clients')
        .select(
          `
          id,
          company_name,
          building_name,
          contact_name,
          contact_email,
          contact_phone,
          address,
          client_code,
          is_active,
          created_at
        `,
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      console.error('Error loading clients:', err);
      setError(
        err.message ||
          'Error al cargar los clientes desde la base de datos.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  // ------------------------
  // Actions: activar / desactivar / eliminar
  // ------------------------

  const toggleActive = async (client: ClientRow) => {
    try {
      setActionLoadingId(client.id);
      const newValue = !client.is_active;

      const { error } = await supabase
        .from('clients')
        .update({ is_active: newValue })
        .eq('id', client.id);

      if (error) throw error;

      setClients((prev) =>
        prev.map((c) =>
          c.id === client.id
            ? { ...c, is_active: newValue }
            : c,
        ),
      );
    } catch (err: any) {
      console.error(err);
      alert(
        err.message ||
          'No se pudo actualizar el estado del cliente.',
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const deleteClient = async (client: ClientRow) => {
    const confirmMsg =
      '¿Seguro que deseas eliminar este cliente?\n\n' +
      'Si tiene ascensores asociados, la base de datos puede bloquear la eliminación.\n' +
      'En ese caso usa solo la opción Activar/Desactivar.';

    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoadingId(client.id);

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      setClients((prev) =>
        prev.filter((c) => c.id !== client.id),
      );
    } catch (err: any) {
      console.error(err);
      alert(
        err.message ||
          'No se pudo eliminar el cliente. Revisa si tiene ascensores asociados.',
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // ------------------------
  // Filtered list
  // ------------------------

  const filtered = clients.filter((c) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;

    return (
      c.company_name.toLowerCase().includes(term) ||
      (c.building_name || '')
        .toLowerCase()
        .includes(term) ||
      c.contact_name.toLowerCase().includes(term) ||
      c.contact_email.toLowerCase().includes(term) ||
      c.contact_phone.toLowerCase().includes(term) ||
      c.address.toLowerCase().includes(term) ||
      (c.client_code || '')
        .toLowerCase()
        .includes(term)
    );
  });

  // ------------------------
  // Render
  // ------------------------

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Gestión de Clientes
          </h1>
          <p className="text-sm text-slate-500">
            Administra la información de tus clientes,
            sus datos de contacto y estado.
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

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, contacto, dirección, código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table / Empty */}
      <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-100 shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">
            Cargando clientes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="text-5xl">📄</div>
            <div className="font-medium">
              No se encontraron clientes
            </div>
            <div className="text-sm">
              Crea un nuevo cliente con el botón
              &nbsp;
              <span className="font-semibold">
                “Nuevo Cliente”
              </span>
              .
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-left text-slate-500">
                <th className="px-4 py-2 font-medium">
                  Cliente
                </th>
                <th className="px-4 py-2 font-medium">
                  Contacto
                </th>
                <th className="px-4 py-2 font-medium">
                  Dirección
                </th>
                <th className="px-4 py-2 font-medium">
                  Código
                </th>
                <th className="px-4 py-2 font-medium text-center">
                  Estado
                </th>
                <th className="px-4 py-2 font-medium text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-50 hover:bg-blue-50/50 cursor-pointer transition"
                  onClick={() =>
                    onNavigate?.('client-profile', c.id)
                  }
                >
                  <td className="px-4 py-2 align-top">
                    <div className="font-semibold text-slate-900">
                      {c.company_name}
                    </div>
                    {c.building_name && (
                      <div className="text-xs text-slate-500">
                        Edificio: {c.building_name}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400">
                      Creado:{' '}
                      {new Date(
                        c.created_at,
                      ).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <div className="text-slate-800">
                      {c.contact_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.contact_email}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.contact_phone}
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <div className="text-xs text-slate-700">
                      {c.address}
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <div className="text-xs font-mono text-slate-700">
                      {c.client_code || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.is_active
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : 'bg-slate-50 text-slate-500 border border-slate-100'
                      }`}
                    >
                      {c.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate?.('client-profile', c.id);
                        }}
                        className="p-1.5 rounded-md hover:bg-purple-50 text-purple-600"
                        title="Ver perfil del cliente"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(c);
                        }}
                        className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive(c);
                        }}
                        className="p-1.5 rounded-md hover:bg-slate-50 text-slate-700"
                        title={
                          c.is_active
                            ? 'Desactivar cliente'
                            : 'Activar cliente'
                        }
                        disabled={
                          actionLoadingId === c.id
                        }
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteClient(c);
                        }}
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-500"
                        title="Eliminar cliente"
                        disabled={
                          actionLoadingId === c.id
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer lateral con ClientForm */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* fondo */}
          <div
            className="flex-1 bg-black/20"
            onClick={closeDrawer}
          />
          {/* panel */}
          <div className="w-full max-w-3xl bg-white shadow-2xl h-full overflow-y-auto p-6">
            <ClientForm
              client={
                drawerMode === 'edit' &&
                selectedClient
                  ? {
                      id: selectedClient.id,
                      company_name:
                        selectedClient.company_name,
                      building_name:
                        selectedClient.building_name,
                      contact_name:
                        selectedClient.contact_name,
                      contact_email:
                        selectedClient.contact_email,
                      contact_phone:
                        selectedClient.contact_phone,
                      address:
                        selectedClient.address,
                    }
                  : null
              }
              onSuccess={handleFormSuccess}
              onCancel={closeDrawer}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientsView;
