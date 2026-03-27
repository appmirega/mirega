import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Building2,
} from 'lucide-react';

interface ClientDashboardProps {
  onNavigate?: (path: string) => void;
}

export function ClientDashboard({ onNavigate: _onNavigate }: ClientDashboardProps = {}) {
  const { profile, selectedClientId, selectedClient } = useAuth();
  const [clientData, setClientData] = useState<any>(null);
  const [elevators, setElevators] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalElevators: 0,
    activeElevators: 0,
    maintenanceThisMonth: 0,
    pendingIssues: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id && selectedClientId) {
      loadClientData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, selectedClientId]);

  const loadClientData = async () => {
    if (!selectedClientId) return;

    try {
      setLoading(true);

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', selectedClientId)
        .maybeSingle();

      if (clientError) throw clientError;
      setClientData(client);

      if (client) {
        const { data: elevatorsData, error: elevatorsError } = await supabase
          .from('elevators')
          .select('*')
          .eq('client_id', client.id)
          .order('elevator_number', { ascending: true });

        if (elevatorsError) throw elevatorsError;
        setElevators(elevatorsData || []);

        const activeCount = elevatorsData?.filter((e) => e.status === 'active').length || 0;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const elevatorIds = elevatorsData?.map((e) => e.id) || [];

        let maintenanceCount = 0;
        if (elevatorIds.length > 0) {
          const { count } = await supabase
            .from('maintenance_schedules')
            .select('id', { count: 'exact', head: true })
            .in('elevator_id', elevatorIds)
            .gte('scheduled_date', startOfMonth.toISOString().split('T')[0]);

          maintenanceCount = count || 0;
        }

        const { count: issuesCount } = await supabase
          .from('emergency_visits')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .in('status', ['reported', 'assigned', 'in_progress']);

        setStats({
          totalElevators: elevatorsData?.length || 0,
          activeElevators: activeCount,
          maintenanceThisMonth: maintenanceCount,
          pendingIssues: issuesCount || 0,
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

  const getElevatorDisplayName = (elevator: any) => {
    const main = elevator.elevator_number ? `Ascensor ${elevator.elevator_number}` : 'Ascensor';
    return elevator.tower_name ? `${main} · ${elevator.tower_name}` : main;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!selectedClientId) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600 font-medium">No hay edificio seleccionado</p>
      </div>
    );
  }

  const title =
    selectedClient?.internal_alias ||
    clientData?.building_name ||
    clientData?.company_name ||
    'Edificio';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Atajos Rápidos</h1>
        <p className="text-slate-600 mt-1">
          {title} - Acceso rápido a información de sus ascensores
        </p>
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
            <div className="bg-red-500 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.pendingIssues}</h3>
          <p className="text-sm text-slate-600">Incidencias Pendientes</p>
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
            <p className="text-sm text-slate-500 mt-1">
              Contacte con administración para agregar ascensores
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {elevators.map((elevator) => (
              <div
                key={elevator.id}
                className="border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg mb-1">
                      {getElevatorDisplayName(elevator)}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {elevator.brand || 'Marca no informada'} {elevator.model || ''}
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
                    <span className="font-medium text-slate-900">
                      {elevator.location_building || elevator.location_address || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Paradas:</span>
                    <span className="font-medium text-slate-900">
                      {elevator.floors || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Capacidad:</span>
                    <span className="font-medium text-slate-900">
                      {elevator.capacity_persons
                        ? `${elevator.capacity_persons} personas`
                        : elevator.capacity_kg
                        ? `${elevator.capacity_kg} kg`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {elevator.next_certification_date && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-900">
                          Próxima Certificación
                        </p>
                        <p className="text-xs text-amber-700">
                          {new Date(elevator.next_certification_date).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}