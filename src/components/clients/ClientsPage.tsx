import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Users,
} from 'lucide-react';
import { ClientForm } from '../forms/ClientForm';

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

type Mode = 'list' | 'create' | 'edit';

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [mode, setMode] = useState<Mode>('list');
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Cargar clientes
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
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      setClients(data || []);
    } catch (err: any) {
      console.error('Error cargando clientes:', err);
      setError(
        err.message || 'No se pudieron cargar los clientes.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  // Filtro de búsqueda en memoria (simple y efectivo)
  const filteredClients = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.company_name?.toLowerCase().includes(q) ||
      c.building_name?.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q) ||
      c.contact_email?.toLowerCase().includes(q) ||
      c.contact_phone?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      c.client_code?.toLowerCase().includes(q)
    );
  });

  // Abrir creación
  const handleNewClient = () => {
    setSelectedClient(null);
    setMode('create');
  };

  // Abrir edición
  const handleEditClient = (client: ClientRow) => {
    setSelectedClient(client);
    setMode('edit');
  };

  // Toggle activo/inactivo
  const handleToggleActive = async (client: ClientRow) => {
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
          c.id === client.id ? { ...c, is_active: newValue } : c
        )
      );
    } catch (err: any) {
      console.error('Error cambiando estado:', err);
      alert(
        err.message ||
          'No se pudo cambiar el estado del cliente.'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Eliminar cliente (duro; puedes cambiar a soft delete si quieres)
  const handleDeleteClient = async (client: ClientRow) => {
    if (
      !window.confirm(
        `¿Eliminar el cliente "${client.company_name}" y sus ascensores asociados? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      setActionLoadingId(client.id);

      // Si quieres borrar ascensores asociados de forma explícita:
      // await supabase.from('elevators').delete().eq('client_id', client.id);

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      setClients((prev) =>
        prev.filter((c) => c.id !== client.id)
      );
    } catch (err: any) {
      console.error('Error eliminando cliente:', err);
      alert(
        err.message ||
          'No se pudo eliminar el cliente.'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Ir a gestión de ascensores filtrado por cliente (ajusta según tu router)
  const handleGoToElevators = (client: ClientRow) => {
    // Si tienes react-router:
    // navigate(`/elevators?client_id=${client.id}`);
    // De momento solo mostramos el código, para que lo conectes donde corresponda.
    alert(
      `Aquí deberías navegar a Gestión de Ascensores filtrando por client_id=${client.id}`
    );
  };

  // Cuando se cierra el formulario (creación o edición) con éxito
  const handleFormSuccess = () => {
    setMode('list');
    setSelectedClient(null);
    loadClients();
  };

  const handleFormCancel = () => {
    setMode('list');
    setSelectedClient(null);
  };

  // Render: si estamos en modo formulario, mostramos el formulario ocupando la vista
  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="p-6">
        <ClientForm
          client={
            mode === 'edit' && selectedClient
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
                  address: selectedClient.address,
                }
              : null
          }
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </div>
    );
  }

  // Modo lista
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Gestión de Clientes
            </h1>
            <p className="text-sm text-slate-500">
              Administra la información de tus clientes. Desde
              aquí puedes crear, editar, activar/desactivar y
              eliminar perfiles.
            </p>
          </div>
        </div>
        <button
          onClick={handleNewClient}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, edificio, contacto, email, teléfono, dirección o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="text-xs text-slate-500">
          Total: {clients.length} cliente
          {clients.length !== 1 && 's'}
        </div>
      </div>

      {/* Estado de carga / error */}
      {loading && (
        <div className="p-4 text-sm text-slate-500">
          Cargando clientes...
        </div>
      )}

      {error && !loading && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabla de clientes */}
      {!loading && filteredClients.length === 0 && (
        <div className="mt-10 flex flex-col items-center text-slate-400">
          <Building2 className="w-10 h-10 mb-2" />
          <p className="text-sm">
            No se encontraron clientes.
          </p>
        </div>
      )}

      {!loading && filteredClients.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">
                  Cliente
                </th>
                <th className="px-4 py-2 text-left font-medium">
                  Contacto
                </th>
                <th className="px-4 py-2 text-left font-medium">
                  Dirección
                </th>
                <th className="px-4 py-2 text-left font-medium">
                  Código
                </th>
                <th className="px-4 py-2 text-center font-medium">
                  Estado
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-slate-900">
                      {c.company_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.building_name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Creado:{' '}
                      {new Date(
                        c.created_at
                      ).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-sm text-slate-800">
                      {c.contact_name}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Mail className="w-3 h-3" />
                      {c.contact_email}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Phone className="w-3 h-3" />
                      {c.contact_phone}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-1 text-xs text-slate-600">
                      <MapPin className="w-3 h-3 mt-0.5" />
                      <span>{c.address}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-700 font-mono">
                      {c.client_code || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-center">
                    <div className="inline-flex items-center gap-1 text-xs">
                      {c.is_active ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-emerald-600">
                            Activo
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span className="text-slate-500">
                            Inactivo
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-end gap-1">
                      {/* Ir a ascensores */}
                      <button
                        onClick={() =>
                          handleGoToElevators(c)
                        }
                        className="px-2 py-1 rounded-md text-[10px] text-blue-600 border border-blue-100 hover:bg-blue-50"
                      >
                        Ascensores
                      </button>

                      {/* Activar / desactivar */}
                      <button
                        onClick={() =>
                          handleToggleActive(c)
                        }
                        disabled={
                          actionLoadingId === c.id
                        }
                        className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
                        title={
                          c.is_active
                            ? 'Desactivar cliente'
                            : 'Activar cliente'
                        }
                      >
                        {c.is_active ? (
                          <ToggleRight className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {/* Editar */}
                      <button
                        onClick={() =>
                          handleEditClient(c)
                        }
                        className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                      </button>

                      {/* Eliminar */}
                      <button
                        onClick={() =>
                          handleDeleteClient(c)
                        }
                        disabled={
                          actionLoadingId === c.id
                        }
                        className="p-1.5 rounded-md border border-red-100 hover:bg-red-50"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>

                      <MoreVertical className="w-3 h-3 text-slate-300 ml-1" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
