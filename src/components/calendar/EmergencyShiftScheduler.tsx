import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Users, Clock } from 'lucide-react';

interface Technician {
  technician_id: string;
  full_name: string;
  phone: string;
  email: string;
  person_type: 'internal' | 'external';
  company_name: string | null;
}

interface EmergencyShift {
  id: string;
  technician_id?: string | null;
  external_personnel_name?: string | null;
  external_personnel_phone?: string | null;
  shift_start_date: string;
  shift_end_date: string;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  is_24h_shift?: boolean | null;
  shift_type?: string | null;
  is_primary: boolean;
}

export function EmergencyShiftScheduler() {
  const [shifts, setShifts] = useState<EmergencyShift[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    technician_id: '',
    shift_start_date: '',
    shift_end_date: '',
    is_24h_shift: true,
    shift_start_time: '08:30',
    shift_end_time: '17:59',
    is_primary: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadShifts(), loadTechnicians()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadShifts = async () => {
    const { data, error } = await supabase
      .from('emergency_shifts')
      .select('*')
      .order('shift_start_date', { ascending: true });

    if (error) {
      console.error('Error loading shifts:', error);
      return;
    }

    setShifts(data || []);
  };

  const loadTechnicians = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email, person_type, company_name')
      .eq('role', 'technician')
      .order('full_name');

    if (error) {
      console.error('Error loading technicians:', error);
      return;
    }

    setTechnicians(
      (data || []).map((t: any) => ({
        technician_id: t.id,
        full_name: t.full_name,
        phone: t.phone || '',
        email: t.email || '',
        person_type: (t.person_type || 'internal') as 'internal' | 'external',
        company_name: t.company_name ?? null,
      }))
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.technician_id) {
      newErrors.technician_id = 'Seleccione un técnico';
    }

    if (!formData.shift_start_date) {
      newErrors.shift_start_date = 'Seleccione fecha de inicio';
    }

    if (!formData.shift_end_date) {
      newErrors.shift_end_date = 'Seleccione fecha de fin';
    }

    if (formData.shift_start_date && formData.shift_end_date) {
      if (new Date(formData.shift_start_date) >= new Date(formData.shift_end_date)) {
        newErrors.shift_end_date = 'La fecha de fin debe ser posterior a la de inicio';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const shift_start_date = formData.shift_start_date;
      const shift_end_date = formData.shift_end_date;

      const payload: any = {
        technician_id: formData.technician_id,
        // mantenemos columnas externas en null para compatibilidad / histórico
        external_personnel_name: null,
        external_personnel_phone: null,
        shift_start_date,
        shift_end_date,
        is_primary: formData.is_primary,
        is_24h_shift: formData.is_24h_shift,
        shift_start_time: formData.is_24h_shift ? '00:00:00' : formData.shift_start_time + ':00',
        shift_end_time: formData.is_24h_shift ? '23:59:59' : formData.shift_end_time + ':00'
      };

      const { error } = await supabase.from('emergency_shifts').insert([payload]);
      if (error) throw error;

      alert('✅ Turno de emergencia asignado exitosamente');
      window.dispatchEvent(new CustomEvent('turno-emergencia-actualizado'));

      setFormData({
        technician_id: '',
        shift_start_date: '',
        shift_end_date: '',
        is_24h_shift: true,
        shift_start_time: '08:30',
        shift_end_time: '17:59',
        is_primary: true
      });

      setShowForm(false);
      loadData();
    } catch (error: any) {
      console.error('Error creating shift:', error);
      alert('❌ Error al crear turno de emergencia: ' + (error?.message || JSON.stringify(error)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este turno de emergencia?')) return;

    try {
      const { error } = await supabase.from('emergency_shifts').delete().eq('id', id);
      if (error) throw error;

      alert('✅ Turno eliminado');
      window.dispatchEvent(new CustomEvent('turno-emergencia-actualizado'));
      loadData();
    } catch (error) {
      console.error('Error deleting shift:', error);
      alert('❌ Error al eliminar turno');
    }
  };

  const getShiftAssignee = (shift: EmergencyShift) => {
    // Si hay legacy data guardada como externo manual, la mostramos
    if (shift.external_personnel_name) {
      return `${shift.external_personnel_name} (Externo - legado)`;
    }
    const tech = technicians.find(t => t.technician_id === shift.technician_id);
    if (!tech) return 'Sin asignar';

    if (tech.person_type === 'external') {
      return `${tech.full_name} (Externo${tech.company_name ? ` - ${tech.company_name}` : ''})`;
    }
    return `${tech.full_name} (Interno)`;
  };

  const getShiftHours = (shift: EmergencyShift) => {
    if (shift.is_24h_shift) return '24h completo';
    if (shift.shift_start_time && shift.shift_end_time) {
      return `${shift.shift_start_time.substring(0, 5)} - ${shift.shift_end_time.substring(0, 5)}`;
    }
    return '24h completo';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando turnos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Turnos de Emergencia</h1>
              <p className="text-sm text-slate-600">Asignación de turnos semanales (24/7) para atender emergencias</p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Plus className="w-5 h-5" />
            Nuevo Turno
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {showForm && (
          <div className="bg-white border-b border-slate-200 p-6 m-4 rounded-lg max-h-[80vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Asignar Nuevo Turno</h2>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Técnico *</label>
                <select
                  value={formData.technician_id}
                  onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 ${
                    errors.technician_id ? 'border-red-300' : 'border-slate-300'
                  }`}
                >
                  <option value="">Seleccione técnico</option>
                  {technicians.map((tech) => {
                    const label =
                      tech.person_type === 'external'
                        ? `${tech.full_name} (Externo${tech.company_name ? ` - ${tech.company_name}` : ''})`
                        : `${tech.full_name} (Interno)`;

                    return (
                      <option key={tech.technician_id} value={tech.technician_id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                {errors.technician_id && <p className="text-xs text-red-600 mt-1">{errors.technician_id}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Inicio Turno *</label>
                  <input
                    type="date"
                    value={formData.shift_start_date}
                    onChange={(e) => setFormData({ ...formData, shift_start_date: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 ${
                      errors.shift_start_date ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  {errors.shift_start_date && <p className="text-xs text-red-600 mt-1">{errors.shift_start_date}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Fin Turno *</label>
                  <input
                    type="date"
                    value={formData.shift_end_date}
                    onChange={(e) => setFormData({ ...formData, shift_end_date: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 ${
                      errors.shift_end_date ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  {errors.shift_end_date && <p className="text-xs text-red-600 mt-1">{errors.shift_end_date}</p>}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-semibold text-blue-900">Horario del Turno</h4>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.is_24h_shift}
                      onChange={() => setFormData({ ...formData, is_24h_shift: true })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700 font-medium">Turno completo 24 horas (00:00 - 23:59)</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!formData.is_24h_shift}
                      onChange={() => setFormData({ ...formData, is_24h_shift: false })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700 font-medium">Turno con horario específico</span>
                  </label>

                  {!formData.is_24h_shift && (
                    <div className="grid grid-cols-2 gap-4 mt-3 pl-6">
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Hora Inicio</label>
                        <input
                          type="time"
                          value={formData.shift_start_time}
                          onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">Ej: 08:30</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Hora Fin</label>
                        <input
                          type="time"
                          value={formData.shift_end_time}
                          onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">Ej: 17:59</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.is_primary}
                    onChange={() => setFormData({ ...formData, is_primary: true })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Turno Primario (responsable principal de emergencias)</span>
                </label>
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="radio"
                    checked={!formData.is_primary}
                    onChange={() => setFormData({ ...formData, is_primary: false })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Turno Backup (apoyo si el primario no responde)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                  Crear Turno
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="p-4">
          {shifts.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-6 text-slate-600">
              No hay turnos registrados.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-4 py-3 border-b">Asignado</th>
                    <th className="text-left px-4 py-3 border-b">Inicio</th>
                    <th className="text-left px-4 py-3 border-b">Fin</th>
                    <th className="text-left px-4 py-3 border-b">Horario</th>
                    <th className="text-left px-4 py-3 border-b">Tipo</th>
                    <th className="text-right px-4 py-3 border-b">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 border-b">{getShiftAssignee(shift)}</td>
                      <td className="px-4 py-3 border-b">{shift.shift_start_date}</td>
                      <td className="px-4 py-3 border-b">{shift.shift_end_date}</td>
                      <td className="px-4 py-3 border-b">{getShiftHours(shift)}</td>
                      <td className="px-4 py-3 border-b">
                        {shift.is_primary ? 'Primario' : 'Backup'}
                      </td>
                      <td className="px-4 py-3 border-b text-right">
                        <button
                          onClick={() => handleDelete(shift.id)}
                          className="text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}