import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  FileText,
  TrendingUp,
  Building2,
  Plus,
  Zap,
  Tag,
} from 'lucide-react';
import { ClientServiceRequestForm } from '../forms/ClientServiceRequestForm';

interface ClientDashboardProps {
  onNavigate?: (path: string) => void;
}

export function ClientDashboard({ onNavigate }: ClientDashboardProps = {}) {
  const { profile } = useAuth();
  const [clientData, setClientData] = useState<any>(null);
  const [elevators, setElevators] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalElevators: 0,
    activeElevators: 0,
    maintenanceThisMonth: 0,
    pendingIssues: 0,
    totalRequests: 0,
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'dashboard' | 'new-request'>('dashboard');

  useEffect(() => {
    if (profile?.id) {
      loadClientData();
    }
  }, [profile]);

  const loadClientData = async () => {
    try {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', profile?.id)
        .maybeSingle();

      if (clientError) throw clientError;
      setClientData(client);

      if (client) {
        const { data: elevatorsData, error: elevatorsError } = await supabase
          .from('elevators')
          .select('*')
          .eq('client_id', client.id);

        if (elevatorsError) throw elevatorsError;
        setElevators(elevatorsData || []);

        const activeCount = elevatorsData?.filter(e => e.status === 'active').length || 0;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: maintenanceCount } = await supabase
          .from('maintenance_schedules')
          .select('id', { count: 'exact', head: true })
          .in('elevator_id', elevatorsData?.map(e => e.id) || [])
          .gte('scheduled_date', startOfMonth.toISOString().split('T')[0]);

        const { count: issuesCount } = await supabase
          .from('emergency_visits')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .in('status', ['reported', 'assigned', 'in_progress']);

        // Cargar solicitudes del cliente
        const { data: requests, error: requestsError } = await supabase
          .from('service_requests')
          .select('*')
          .eq('client_id', profile?.id)
          .eq('created_by_client', true)
          .order('created_at', { ascending: false });

        if (!requestsError) {
          setServiceRequests(requests || []);
        }

        setStats({
          totalElevators: elevatorsData?.length || 0,
          activeElevators: activeCount,
          maintenanceThisMonth: maintenanceCount || 0,
          pendingIssues: issuesCount || 0,
          totalRequests: requests?.length || 0,
        });
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'under_maintenance':
        return 'bg-orange-100 text-orange-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Operativo';
      case 'under_maintenance':
        return 'En Mantenimiento';
      case 'inactive':
        return 'Inactivo';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (viewMode === 'new-request') {
    return (
      <ClientServiceRequestForm
        onSuccess={() => {
          setViewMode('dashboard');
          loadClientData();
        }}
        onCancel={() => setViewMode('dashboard')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Atajos Rápidos</h1>
        <p className="text-slate-600 mt-1">{clientData?.company_name} - Acceso rápido a información de sus ascensores</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-slate-500 p-3 rounded-lg">
              <Wrench className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalElevators}</h3>
          <p className="text-sm text-slate-600">Total Ascensores</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-500 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.activeElevators}</h3>
          <p className="text-sm text-slate-600">Operativos</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.maintenanceThisMonth}</h3>
          <p className="text-sm text-slate-600">Mantenimientos Este Mes</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-500 p-3 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.totalRequests}</h3>
          <p className="text-sm text-slate-600">Solicitudes Realizadas</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-6 h-6 text-slate-900" />
          <h2 className="text-xl font-bold text-slate-900">Mis Ascensores</h2>
        </div>

        {elevators.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No hay ascensores registrados</p>
            <p className="text-sm text-slate-500 mt-1">Contacte con administración para agregar ascensores</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {elevators.map((elevator) => (
              <div
                key={elevator.id}
                className="border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg mb-1">
                      {elevator.internal_code}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {elevator.brand} {elevator.model}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      elevator.status
                    )}`}
                  >
                    {getStatusLabel(elevator.status)}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Ubicación:</span>
                    <span className="font-medium text-slate-900">{elevator.location_building}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Pisos:</span>
                    <span className="font-medium text-slate-900">{elevator.floors || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Capacidad:</span>
                    <span className="font-medium text-slate-900">
                      {elevator.capacity_persons ? `${elevator.capacity_persons} personas` : 'N/A'}
                    </span>
                  </div>
                </div>

                {elevator.next_certification_date && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-900">Próxima Certificación</p>
                        <p className="text-xs text-amber-700">
                          {new Date(elevator.next_certification_date).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button className="w-full mt-4 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition">
                  Ver Detalles
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-slate-900" />
            <h2 className="text-xl font-bold text-slate-900">Actividad Reciente</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Mantenimiento Completado</p>
                <p className="text-sm text-slate-600">Ascensor A - Torre Principal</p>
                <p className="text-xs text-slate-500 mt-1">Hace 2 días</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Nueva Cotización</p>
                <p className="text-sm text-slate-600">Reparación bomba hidráulica</p>
                <p className="text-xs text-slate-500 mt-1">Hace 5 días</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-slate-900" />
            <h2 className="text-xl font-bold text-slate-900">Resumen Mensual</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-900">Disponibilidad</p>
                <span className="text-lg font-bold text-green-600">98.5%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '98.5%' }}></div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-900">Mantenimientos Realizados</p>
                <span className="text-lg font-bold text-blue-600">12</span>
              </div>
              <p className="text-xs text-slate-600">Todos completados a tiempo</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-900">Tiempo de Respuesta Promedio</p>
                <span className="text-lg font-bold text-purple-600">1.8h</span>
              </div>
              <p className="text-xs text-slate-600">En emergencias</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-slate-900" />
            <h2 className="text-xl font-bold text-slate-900">Mis Solicitudes de Servicio</h2>
          </div>
          <button
            onClick={() => setViewMode('new-request')}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
          >
            <Plus className="w-4 h-4" />
            Nueva Solicitud
          </button>
        </div>

        {serviceRequests.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No tiene solicitudes aún</p>
            <p className="text-sm text-slate-500 mt-1">Cree su primera solicitud de servicio</p>
          </div>
        ) : (
          <div className="space-y-3">
            {serviceRequests.slice(0, 5).map((request) => {
              const statusColors: Record<string, string> = {
                created: 'bg-blue-50 text-blue-700 border-blue-200',
                analyzed: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                approved: 'bg-green-50 text-green-700 border-green-200',
                in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
                completed: 'bg-green-50 text-green-700 border-green-200',
                rejected: 'bg-red-50 text-red-700 border-red-200',
              };

              const requestTypeLabels: Record<string, string> = {
                emergency: '🚨 Emergencia',
                technical_visit: '🔧 Visita Técnica',
                rescue_training: '👥 Inducción Rescate',
                other: '❓ Otro',
              };

              return (
                <div key={request.id} className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-900">{request.title}</span>
                        <Tag className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-xs text-slate-600">{requestTypeLabels[request.request_type] || request.request_type}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[request.status] || 'bg-slate-50'}`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2 line-clamp-2">{request.description}</p>
                  <p className="text-xs text-slate-500">{new Date(request.created_at).toLocaleDateString('es-CL')}</p>
                </div>
              );
            })}
          </div>
        )}

        {serviceRequests.length > 5 && (
          <button className="w-full mt-4 py-2 text-center text-orange-600 hover:bg-orange-50 rounded-lg transition font-medium text-sm">
            Ver todas las solicitudes ({serviceRequests.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigate?.('client-emergencies')}
            className="p-6 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 transition text-left"
          >
            <AlertTriangle className="w-8 h-8 text-red-600 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">Emergencias</h3>
            <p className="text-sm text-slate-600">Historial de visitas de emergencia</p>
          </button>

          <button
            onClick={() => onNavigate?.('client-quotations')}
            className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition text-left"
          >
            <FileText className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">Cotizaciones</h3>
            <p className="text-sm text-slate-600">Ver y aprobar cotizaciones</p>
          </button>

          <button
            onClick={() => onNavigate?.('carpeta-cero')}
            className="p-6 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 transition text-left"
          >
            <FileText className="w-8 h-8 text-green-600 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">Carpeta Cero</h3>
            <p className="text-sm text-slate-600">Documentación legal</p>
          </button>

          <button
            onClick={() => onNavigate?.('rescue-training')}
            className="p-6 bg-purple-50 border-2 border-purple-200 rounded-xl hover:bg-purple-100 transition text-left"
          >
            <FileText className="w-8 h-8 text-purple-600 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">Capacitaciones</h3>
            <p className="text-sm text-slate-600">Inducción de rescate</p>
          </button>
      </div>

      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">¿Necesita Asistencia?</h2>
        <p className="text-slate-300 mb-6">
          Estamos disponibles 24/7 para atender cualquier emergencia o consulta
        </p>
        <div className="flex flex-wrap gap-4">
          <button className="bg-white text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-slate-100 transition">
            Reportar Emergencia
          </button>
          <button className="bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition border border-slate-700">
            Solicitar Cotización
          </button>
          <button className="bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition border border-slate-700">
            Contactar Soporte
          </button>
        </div>
      </div>
    </div>
  );
}
