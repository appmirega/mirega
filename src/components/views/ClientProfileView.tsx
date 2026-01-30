import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ClientForm } from '../forms/ClientForm';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Users,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
} from 'lucide-react';

interface ClientData {
  id: string;
  company_name: string;
  building_name: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  admin_name: string | null;
  admin_email: string | null;
  admin_phone: string | null;
  address: string;
  is_active: boolean;
  created_at: string;
}

interface ElevatorData {
  id: string;
  location_name: string;
  elevator_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  status: string;
  created_at: string;
}

interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  request_type: string;
  priority: string;
  status: string;
  created_at: string;
}

interface ClientProfileViewProps {
  clientId: string;
  onNavigate?: (path: string, clientId?: string) => void;
  onBack?: () => void;
}

export function ClientProfileView({
  clientId,
  onNavigate,
  onBack,
}: ClientProfileViewProps) {
  const [client, setClient] = useState<ClientData | null>(null);
  const [elevators, setElevators] = useState<ElevatorData[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar datos del cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Cargar ascensores del cliente
      const { data: elevatorsData, error: elevatorsError } = await supabase
        .from('elevators')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (elevatorsError) throw elevatorsError;
      setElevators(elevatorsData || []);

      // Cargar solicitudes de servicio del cliente
      const { data: requestsData, error: requestsError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (requestsError) throw requestsError;
      setRequests(requestsData || []);
    } catch (err: any) {
      console.error('Error loading client data:', err);
      setError(err.message || 'Error al cargar datos del cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setShowEditForm(false);
    loadClientData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
      case 'critical':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-slate-600';
    }
  };

  const getElevatorStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'maintenance':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'stopped':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Building2 className="w-5 h-5 text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
        <p className="text-red-800 font-semibold mb-2">Error</p>
        <p className="text-red-700">{error || 'Cliente no encontrado'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Volver
        </button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {client.company_name}
            </h1>
            <p className="text-slate-600 mt-1">{client.building_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
        </div>
      </div>

      {/* Información Principal */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Contacto Principal */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-w-[280px] max-w-full md:max-w-[340px] flex-1">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Contacto Principal
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-600">Nombre</p>
              <p className="text-lg font-semibold text-slate-900">
                {client.contact_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </p>
              <a
                href={`mailto:${client.contact_email}`}
                className="text-blue-600 hover:underline"
              >
                {client.contact_email}
              </a>
            </div>
            {client.contact_phone && (
              <div>
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Teléfono
                </p>
                <a
                  href={`tel:${client.contact_phone}`}
                  className="text-blue-600 hover:underline"
                >
                  {client.contact_phone}
                </a>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-600 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Dirección
              </p>
              <p className="text-slate-900">{client.address}</p>
            </div>
          </div>
        </div>

        {/* Contactos Alternos (JSONB) */}
        {Array.isArray(client.alternate_contacts) && client.alternate_contacts.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 flex-1">
            {client.alternate_contacts.filter(c => c.enabled && (c.name || c.email || c.phone || c.role)).map((contact, idx) => (
              <div key={idx} className="bg-blue-50 rounded-xl border border-blue-200 p-6 min-w-[220px] max-w-full md:max-w-[260px] flex-1">
                <h2 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Contacto Alterno {idx + 1}
                </h2>
                <div className="space-y-2">
                  {contact.name && (
                    <div>
                      <p className="text-xs text-slate-600">Nombre</p>
                      <p className="text-base font-semibold text-slate-900">{contact.name}</p>
                    </div>
                  )}
                  {contact.role && (
                    <div>
                      <p className="text-xs text-slate-600">Cargo / Rol</p>
                      <p className="text-base text-slate-900">{contact.role}</p>
                    </div>
                  )}
                  {contact.email && (
                    <div>
                      <p className="text-xs text-slate-600 flex items-center gap-2"><Mail className="w-4 h-4" />Email</p>
                      <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      <p className="text-xs text-slate-600 flex items-center gap-2"><Phone className="w-4 h-4" />Teléfono</p>
                      <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ascensores */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-slate-600" />
          Ascensores ({elevators.length})
        </h2>
        {elevators.length === 0 ? (
          <p className="text-slate-600">No hay ascensores registrados</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {elevators.map((elevator) => (
              <div
                key={elevator.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-900">
                    {elevator.location_name}
                  </h3>
                  {getElevatorStatusIcon(elevator.status)}
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p>
                    <strong>Tipo:</strong> {elevator.elevator_type}
                  </p>
                  <p>
                    <strong>Fabricante:</strong> {elevator.manufacturer}
                  </p>
                  <p>
                    <strong>Modelo:</strong> {elevator.model}
                  </p>
                  <p>
                    <strong>Serie:</strong> {elevator.serial_number}
                  </p>
                  <p className="text-xs text-slate-500">
                    Registrado:{' '}
                    {new Date(elevator.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Solicitudes de Servicio */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-slate-600" />
          Solicitudes de Servicio Recientes ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <p className="text-slate-600">No hay solicitudes de servicio</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Asunto
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Tipo
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Prioridad
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Estado
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-900">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">
                        {request.title}
                      </p>
                      <p className="text-xs text-slate-600">
                        {request.description?.substring(0, 60)}...
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {request.request_type}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-sm font-semibold ${getPriorityColor(request.priority)}`}
                      >
                        {request.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(request.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-600 font-semibold text-sm">Total Ascensores</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">
            {elevators.length}
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-purple-600 font-semibold text-sm">
            Solicitudes Pendientes
          </p>
          <p className="text-3xl font-bold text-purple-900 mt-1">
            {requests.filter((r) => r.status === 'pending').length}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-600 font-semibold text-sm">
            Cliente desde
          </p>
          <p className="text-lg font-bold text-green-900 mt-1">
            {new Date(client.created_at).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
      </div>

      {/* Modal Editar Cliente */}
      {showEditForm && client && (
        <div className="fixed inset-0 z-50 flex">
          {/* fondo */}
          <div
            className="flex-1 bg-black/20"
            onClick={() => setShowEditForm(false)}
          />
          {/* panel */}
          <div className="w-full max-w-3xl bg-white shadow-2xl h-full overflow-y-auto p-6">
            <ClientForm
              client={{
                id: client.id,
                company_name: client.company_name,
                building_name: client.building_name,
                contact_name: client.contact_name,
                contact_email: client.contact_email,
                contact_phone: client.contact_phone,
                address: client.address,
              }}
              onSuccess={handleFormSuccess}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
