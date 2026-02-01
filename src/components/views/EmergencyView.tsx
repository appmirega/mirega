import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, AlertTriangle, Clock, CheckCircle, X, User } from 'lucide-react';

interface Emergency {
  id: string;
  elevator_id: string;
  reported_at: string;
  reported_by: string;
  issue_description: string;
  priority: string;
  status: string;
  assigned_technician_id?: string;
  resolution_notes?: string;
  resolved_at?: string;
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

export function EmergencyView() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [formData, setFormData] = useState({
    elevator_id: '',
    reported_by: '',
    issue_description: '',
    priority: 'medium',
    assigned_technician_id: '',
  });
  const [elevators, setElevators] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEmergencies();
    loadElevators();
    loadTechnicians();
  }, []);

  const loadEmergencies = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_visits')
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
        .order('reported_at', { ascending: false });

      if (error) throw error;
      setEmergencies(data || []);
    } catch (error) {
      console.error('Error loading emergencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select('id, brand, model, serial_number, clients(business_name)')
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
      const { error } = await supabase.from('emergency_visits').insert([
        {
          elevator_id: formData.elevator_id,
          reported_by: formData.reported_by,
          issue_description: formData.issue_description,
          priority: formData.priority,
          assigned_technician_id: formData.assigned_technician_id || null,
          status: 'reported',
          reported_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      alert('Emergencia reportada exitosamente');
      setFormData({
        elevator_id: '',
        reported_by: '',
        issue_description: '',
        priority: 'medium',
        assigned_technician_id: '',
      });
      setViewMode('list');
      loadEmergencies();
    } catch (error: any) {
      console.error('Error creating emergency:', error);
      alert('Error al reportar emergencia: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      reported: 'bg-red-100 text-red-800',
      assigned: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      low: 'bg-slate-100 text-slate-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return badges[priority as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      critical: 'Crítica',
    };
    return labels[priority as keyof typeof labels] || priority;
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
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl font-bold text-slate-900">Reportar Emergencia</h2>
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
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
              Reportado Por *
            </label>
            <input
              type="text"
              required
              value={formData.reported_by}
              onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Nombre de quien reporta"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Descripción del Problema *
            </label>
            <textarea
              required
              value={formData.issue_description}
              onChange={(e) => setFormData({ ...formData, issue_description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Describe detalladamente el problema..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Prioridad *
            </label>
            <select
              required
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Asignar Técnico
            </label>
            <select
              value={formData.assigned_technician_id}
              onChange={(e) => setFormData({ ...formData, assigned_technician_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Sin asignar</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
            >
              {submitting ? 'Reportando...' : 'Reportar Emergencia'}
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
          <h1 className="text-3xl font-bold text-slate-900">Emergencias</h1>
          <p className="text-slate-600 mt-1">Gestión de emergencias y atención inmediata</p>
        </div>
        <button
          onClick={() => setViewMode('create')}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          <Plus className="w-4 h-4" />
          Reportar Emergencia
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-900">
                {emergencies.filter((e) => e.status === 'reported').length}
              </p>
              <p className="text-sm text-red-700">Reportadas</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-900">
                {emergencies.filter((e) => e.status === 'in_progress').length}
              </p>
              <p className="text-sm text-blue-700">En Proceso</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">
                {emergencies.filter((e) => e.status === 'resolved').length}
              </p>
              <p className="text-sm text-green-700">Resueltas</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{emergencies.length}</p>
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
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Reportado</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Problema</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Prioridad</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Técnico</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {emergencies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No hay emergencias reportadas</p>
                    <p className="text-sm text-slate-500 mt-1">Las emergencias aparecerán aquí</p>
                  </td>
                </tr>
              ) : (
                emergencies.map((emergency) => (
                  <tr key={emergency.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">
                        {emergency.elevators?.clients?.business_name || 'N/A'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">
                        {emergency.elevators?.brand} {emergency.elevators?.model}
                      </p>
                      <p className="text-xs text-slate-500">S/N: {emergency.elevators?.serial_number}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{emergency.reported_by}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(emergency.reported_at).toLocaleString('es-ES')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900 max-w-xs truncate">{emergency.issue_description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityBadge(
                          emergency.priority
                        )}`}
                      >
                        {getPriorityLabel(emergency.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{emergency.profiles?.full_name || 'Sin asignar'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          emergency.status
                        )}`}
                      >
                        {emergency.status}
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
