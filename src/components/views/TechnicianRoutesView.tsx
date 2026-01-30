import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Route, Calendar, MapPin, Clock, Building2 } from 'lucide-react';

interface RouteData {
  id: string;
  name: string;
  description: string;
  scheduled_date: string;
  status: string;
  created_at: string;
  client: {
    company_name: string;
    address: string;
  };
  route_elevators: Array<{
    elevator: {
      brand: string;
      model: string;
      location_name: string;
      serial_number: string;
    };
  }>;
}

export function TechnicianRoutesView() {
  const { profile } = useAuth();
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignedRoutes();
  }, [profile]);

  const loadAssignedRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          id,
          name,
          description,
          scheduled_date,
          status,
          created_at,
          clients (
            company_name,
            address
          ),
          route_elevators (
            elevators (
              brand,
              model,
              location_name,
              serial_number
            )
          )
        `)
        .eq('assigned_technician_id', profile?.id)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const formattedData = (data || []).map((route) => ({
        ...route,
        client: Array.isArray(route.clients) ? route.clients[0] : route.clients,
        route_elevators: route.route_elevators.map((re: any) => ({
          elevator: Array.isArray(re.elevators) ? re.elevators[0] : re.elevators,
        })),
      }));

      setRoutes(formattedData);
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'in_progress':
        return 'En Curso';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mis Rutas Asignadas</h1>
        <p className="text-slate-600 mt-1">Rutas de mantenimiento programadas para ti</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : routes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Route className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No tienes rutas asignadas</p>
          <p className="text-sm text-slate-500 mt-1">
            Cuando se te asigne una ruta, aparecerá aquí
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => (
            <div
              key={route.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Route className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">{route.name}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          route.status
                        )}`}
                      >
                        {getStatusLabel(route.status)}
                      </span>
                    </div>
                    {route.description && (
                      <p className="text-slate-600 mb-3">{route.description}</p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-500">Cliente:</span>
                        <span className="text-slate-900 font-medium">
                          {route.client?.company_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-500">Dirección:</span>
                        <span className="text-slate-900">{route.client?.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-500">Fecha Programada:</span>
                        <span className="text-slate-900 font-medium">
                          {new Date(route.scheduled_date).toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-500">Creada:</span>
                        <span className="text-slate-900">
                          {new Date(route.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>

                    {route.route_elevators && route.route_elevators.length > 0 && (
                      <div className="border-t border-slate-200 pt-4">
                        <h4 className="font-semibold text-slate-900 mb-3">
                          Ascensores en esta Ruta ({route.route_elevators.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {route.route_elevators.map((re, index) => (
                            <div
                              key={index}
                              className="border border-slate-200 rounded-lg p-3 bg-slate-50"
                            >
                              <p className="font-medium text-slate-900">
                                {re.elevator.brand} {re.elevator.model}
                              </p>
                              <p className="text-sm text-slate-600">
                                {re.elevator.location_name}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                S/N: {re.elevator.serial_number}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
