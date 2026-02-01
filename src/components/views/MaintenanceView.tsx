import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Calendar, Wrench, Building2, AlertCircle, CheckCircle, X } from 'lucide-react';

interface Maintenance {
  id: string;
  elevator_id: string;
  scheduled_date: string;
  maintenance_type: string;
  status: string;
  assigned_technician_id?: string;
  notes?: string;
  elevators?: {
    brand: string;
    model: string;
    serial_number: string;
    clients?: {
      business_name: string;
    };
  };
  profiles?: {
    full_name: string;
  };
}

type ViewMode = 'list' | 'create';

export function MaintenanceView() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [formData, setFormData] = useState({
    elevator_id: '',
    scheduled_date: '',
    maintenance_type: 'preventive',
    assigned_technician_id: '',
    notes: '',
  });
  const [elevators, setElevators] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMaintenances();
    loadElevators();
    loadTechnicians();
  }, []);

  const loadMaintenances = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          *,
          elevators (
            brand,
            model,
            serial_number,
            clients (
              business_name
            )
          ),
          profiles (
            full_name
          )
        `)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      setMaintenances(data || []);
    } catch (error) {
      console.error('Error loading maintenances:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select('id, brand, model, serial_number, clients(business_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setElevators(data || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
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
      const { error } = await supabase.from('maintenance_schedules').insert([
        {
          elevator_id: formData.elevator_id,
          scheduled_date: formData.scheduled_date,
          maintenance_type: formData.maintenance_type,
          assigned_technician_id: formData.assigned_technician_id || null,
          notes: formData.notes || null,
          status: 'scheduled',
        },
      ]);

      if (error) throw error;

      alert('Mantenimiento programado exitosamente');
      setFormData({
        elevator_id: '',
        scheduled_date: '',
        maintenance_type: 'preventive',
        assigned_technician_id: '',
        notes: '',
      });
      setViewMode('list');
      loadMaintenances();
    } catch (error: any) {
      console.error('Error creating maintenance:', error);
      alert('Error al programar mantenimiento: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      preventive: 'Preventivo',
      corrective: 'Correctivo',
      emergency: 'Emergencia',
    };
    return labels[type as keyof typeof labels] || type;
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
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">Programar Mantenimiento</h2>
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
              Ascensor *
            </label>
            <select
              required
              value={formData.elevator_id}
              onChange={(e) => setFormData({ ...formData, elevator_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seleccionar ascensor</option>
              {elevators.map((elevator) => (
                <option key={elevator.id} value={elevator.id}>
                  {elevator.clients?.business_name} - {elevator.brand} {elevator.model} (S/N: {elevator.serial_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fecha Programada *
            </label>
            <input
              type="date"
              required
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tipo de Mantenimiento *
            </label>
            <select
              required
              value={formData.maintenance_type}
              onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="preventive">Preventivo</option>
              <option value="corrective">Correctivo</option>
              <option value="emergency">Emergencia</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Técnico Asignado
            </label>
            <select
              value={formData.assigned_technician_id}
              onChange={(e) => setFormData({ ...formData, assigned_technician_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sin asignar</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Notas adicionales sobre el mantenimiento..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {submitting ? 'Programando...' : 'Programar Mantenimiento'}
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
          <h1 className="text-3xl font-bold text-slate-900">Mantenimientos</h1>
          <p className="text-slate-600 mt-1">Gestión de mantenimientos preventivos y correctivos</p>
        </div>
        <button
          onClick={() => setViewMode('create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Programar Mantenimiento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-900">
                {maintenances.filter((m) => m.status === 'scheduled').length}
              </p>
              <p className="text-sm text-blue-700">Programados</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Wrench className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-900">
                {maintenances.filter((m) => m.status === 'in_progress').length}
              </p>
              <p className="text-sm text-yellow-700">En Proceso</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">
                {maintenances.filter((m) => m.status === 'completed').length}
              </p>
              <p className="text-sm text-green-700">Completados</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{maintenances.length}</p>
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
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Ascensor</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Fecha</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Tipo</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Técnico</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {maintenances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No hay mantenimientos programados</p>
                    <p className="text-sm text-slate-500 mt-1">Programa tu primer mantenimiento</p>
                  </td>
                </tr>
              ) : (
                maintenances.map((maintenance) => (
                  <tr key={maintenance.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">
                        {maintenance.elevators?.clients?.business_name || 'N/A'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">
                        {maintenance.elevators?.brand} {maintenance.elevators?.model}
                      </p>
                      <p className="text-xs text-slate-500">S/N: {maintenance.elevators?.serial_number}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">
                        {new Date(maintenance.scheduled_date).toLocaleDateString('es-ES')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{getTypeLabel(maintenance.maintenance_type)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{maintenance.profiles?.full_name || 'Sin asignar'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          maintenance.status
                        )}`}
                      >
                        {maintenance.status}
                      </span>
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
