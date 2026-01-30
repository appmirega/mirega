import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Map, Calendar, User, X, AlertCircle } from 'lucide-react';

interface Route {
  id: string;
  route_name: string;
  assigned_technician_id: string;
  route_date: string;
  status: string;
  notes?: string;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

type ViewMode = 'list' | 'create';

export function RoutesView() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [formData, setFormData] = useState({
    route_name: '',
    assigned_technician_id: '',
    route_date: '',
    notes: '',
  });
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRoutes();
    loadTechnicians();
  }, []);

  const loadRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .order('route_date', { ascending: false });

      if (error) throw error;
      setRoutes(data || []);
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'technician')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase.from('routes').insert([
        {
          route_name: formData.route_name,
          assigned_technician_id: formData.assigned_technician_id,
          route_date: formData.route_date,
          notes: formData.notes || null,
          status: 'planned',
        },
      ]);

      if (error) throw error;

      alert('Ruta creada exitosamente');
      setFormData({
        route_name: '',
        assigned_technician_id: '',
        route_date: '',
        notes: '',
      });
      setViewMode('list');
      loadRoutes();
    } catch (error: any) {
      console.error('Error creating route:', error);
      alert('Error al crear ruta: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      planned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      planned: 'Planificada',
      in_progress: 'En Proceso',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };
    return labels[status as keyof typeof labels] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (viewMode === 'create') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Map className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">Crear Ruta</h2>
          </div>
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nombre de la Ruta *
            </label>
            <input
              type="text"
              required
              value={formData.route_name}
              onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: Ruta Centro - Zona Norte"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Asignar Técnico *
            </label>
            <select
              required
              value={formData.assigned_technician_id}
              onChange={(e) => setFormData({ ...formData, assigned_technician_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seleccionar técnico</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fecha de la Ruta *
            </label>
            <input
              type="date"
              required
              value={formData.route_date}
              onChange={(e) => setFormData({ ...formData, route_date: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notas / Instrucciones
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Detalles adicionales sobre la ruta, puntos de parada, etc..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {submitting ? 'Creando...' : 'Crear Ruta'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rutas</h1>
          <p className="text-slate-600 mt-1">Gestión de rutas y asignación de técnicos</p>
        </div>
        <button
          onClick={() => setViewMode('create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nueva Ruta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-900">
                {routes.filter((r) => r.status === 'planned').length}
              </p>
              <p className="text-sm text-blue-700">Planificadas</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Map className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-900">
                {routes.filter((r) => r.status === 'in_progress').length}
              </p>
              <p className="text-sm text-yellow-700">En Proceso</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">
                {routes.filter((r) => r.status === 'completed').length}
              </p>
              <p className="text-sm text-green-700">Completadas</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Map className="w-8 h-8 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{routes.length}</p>
              <p className="text-sm text-slate-700">Total</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Nombre de Ruta</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Técnico Asignado</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Fecha</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Estado</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {routes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No hay rutas creadas</p>
                    <p className="text-sm text-slate-500 mt-1">Crea tu primera ruta</p>
                  </td>
                </tr>
              ) : (
                routes.map((route) => (
                  <tr key={route.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{route.route_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <p className="text-sm text-slate-900">{route.profiles?.full_name || 'Sin asignar'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <p className="text-sm text-slate-900">
                          {new Date(route.route_date).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          route.status
                        )}`}
                      >
                        {getStatusLabel(route.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 max-w-xs truncate">{route.notes || 'Sin notas'}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
