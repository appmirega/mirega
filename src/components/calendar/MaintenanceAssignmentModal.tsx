  // Restaurar emergencyContext necesario para renderizado condicional
  const [emergencyContext, setEmergencyContext] = useState<string | null>(null);
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Building, User, Users, Clock, Calendar, Lock, AlertCircle, Trash2, Check, AlertTriangle } from 'lucide-react';

interface Technician {
  technician_id: string;
  full_name: string;
  phone: string;
  email: string;
  is_on_leave: boolean;
  assignments_today: number;
  emergency_shift_type?: string;
}

interface MaintenanceAssignment {
  id: string;
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end: string;
  building_name: string;
  client_name: string;
  assigned_to: string;
  is_external: boolean;
  status: string;
  is_fixed: boolean;
  is_holiday_date: boolean;
  display_status: string;
  estimated_duration_hours: number;
  assigned_technician_id?: string;
}

interface Building {
  id: string;
  name: string;
  address: string;
  client_id: string;
}

interface MaintenanceAssignmentModalProps {
  selectedDate: Date | null;
  assignment: MaintenanceAssignment | null;
  technicians: Technician[];
  technicianAbsences?: Map<string, Map<string, string[]>>;
  onClose: () => void;
  onSuccess: () => void;
}

export function MaintenanceAssignmentModal({
  selectedDate,
  assignment,
  technicians,
  technicianAbsences,
  onClose,
  onSuccess
}: MaintenanceAssignmentModalProps) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [formData, setFormData] = useState({
    building_id: '',
    assigned_technician_id: '',
    is_external: false,
    external_personnel_name: '',
    external_personnel_phone: '',
    scheduled_date: '',
    scheduled_time_start: '09:00',
    scheduled_time_end: '11:00',
    estimated_duration_hours: 2,
    is_fixed: false,
    notes: '',
    requires_additional_technicians: false,
    additional_technicians_count: 1,
    coordination_notes: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  // Eliminado setEmergencyContext no usado

  useEffect(() => {
    loadBuildings();
    if (selectedDate) {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, scheduled_date: dateStr }));
      checkHoliday(dateStr);
    }
    if (assignment) {
      loadAssignmentData();
    }
  }, [selectedDate, assignment]);

  const loadBuildings = async () => {
    const { data, error } = await supabase
      .from('buildings')
      .select('id, name, address, client_id')
      .order('name');

    if (error) {
      console.error('Error loading buildings:', error);
      return;
    }

    setBuildings(data || []);
  };

  const loadAssignmentData = async () => {
    if (!assignment) return;

    const { data, error } = await supabase
      .from('maintenance_assignments')
      .select('*')
      .eq('id', assignment.id)
      .single();

    if (error) {
      console.error('Error loading assignment:', error);
      return;
    }

    setFormData({
      building_id: data.building_id || '',
      assigned_technician_id: data.assigned_technician_id || '',
      is_external: data.is_external || false,
      external_personnel_name: data.external_personnel_name || '',
      external_personnel_phone: data.external_personnel_phone || '',
      scheduled_date: data.scheduled_date,
      scheduled_time_start: data.scheduled_time_start,
      scheduled_time_end: data.scheduled_time_end,
      estimated_duration_hours: data.estimated_duration_hours || 2,
      is_fixed: data.is_fixed || false,
      notes: data.notes || '',
      requires_additional_technicians: data.requires_additional_technicians || false,
      additional_technicians_count: data.additional_technicians_count || 1,
      coordination_notes: data.coordination_notes || ''
    });
  };

  const checkHoliday = async (date: string) => {
    const { data, error } = await supabase
      .rpc('is_holiday', { check_date: date });

    if (!error && data) {
      setIsHoliday(data);
    }
  };

  const validateForm = async () => {
    const newErrors: Record<string, string> = {};

    // Validar edificio
    if (!formData.building_id) {
      newErrors.building_id = 'Seleccione un edificio';
    }

    // Validar asignación (técnico o personal externo)
    if (!formData.is_external && !formData.assigned_technician_id) {
      newErrors.assigned_technician_id = 'Seleccione un técnico';
    }

    if (formData.is_external) {
      if (!formData.external_personnel_name) {
        newErrors.external_personnel_name = 'Ingrese el nombre del personal externo';
      }
      if (!formData.external_personnel_phone) {
        newErrors.external_personnel_phone = 'Ingrese el teléfono del personal externo';
      }
    }

    // Validar fecha y hora
    if (!formData.scheduled_date) {
      newErrors.scheduled_date = 'Seleccione una fecha';
    }

    if (!formData.scheduled_time_start) {
      newErrors.scheduled_time_start = 'Ingrese hora de inicio';
    }

    if (!formData.scheduled_time_end) {
      newErrors.scheduled_time_end = 'Ingrese hora de fin';
    }

    if (formData.scheduled_time_start >= formData.scheduled_time_end) {
      newErrors.scheduled_time_end = 'La hora de fin debe ser posterior a la de inicio';
    }

    // Validar que técnicos internos solo trabajen de lunes a viernes
    if (!formData.is_external) {
      // Parsear fecha sin problemas de zona horaria: YYYY-MM-DD -> new Date(year, month-1, day)
      const [year, month, day] = formData.scheduled_date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        newErrors.scheduled_date = 'Los técnicos internos solo trabajan de lunes a viernes. Use personal externo para fines de semana.';
      }

      // Validar disponibilidad del técnico
      if (formData.assigned_technician_id) {
        // Validar ausencia (vacaciones/permiso) usando mapa local
        const absencesForDate = technicianAbsences?.get(formData.scheduled_date);
        const reasons = absencesForDate?.get(formData.assigned_technician_id);
        if (reasons && reasons.length > 0) {
          newErrors.assigned_technician_id = `El técnico no está disponible (vacaciones/permiso: ${reasons.join(', ')})`;
        } else {
          // Validar disponibilidad del técnico vía RPC (respaldo)
          const { data: isAvailable } = await supabase
            .rpc('is_technician_available', {
              tech_id: formData.assigned_technician_id,
              check_date: formData.scheduled_date
            });

          if (!isAvailable) {
            newErrors.assigned_technician_id = 'El técnico no está disponible en esta fecha (vacaciones o permiso)';
          }
        }
      }
    }

    // Advertencia para días festivos (no bloquear, solo advertir)
    if (isHoliday && !formData.is_external) {
      newErrors.scheduled_date = 'El día seleccionado es festivo. Se recomienda usar personal externo.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!await validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        building_id: formData.building_id,
        scheduled_date: formData.scheduled_date,
        scheduled_time_start: formData.scheduled_time_start,
        scheduled_time_end: formData.scheduled_time_end,
        estimated_duration_hours: formData.estimated_duration_hours,
        is_external: formData.is_external,
        assigned_technician_id: formData.is_external ? null : formData.assigned_technician_id,
        external_personnel_name: formData.is_external ? formData.external_personnel_name : null,
        external_personnel_phone: formData.is_external ? formData.external_personnel_phone : null,
        is_fixed: formData.is_fixed,
        notes: formData.notes || null,
        status: 'scheduled',
        requires_additional_technicians: formData.requires_additional_technicians,
        additional_technicians_count: formData.additional_technicians_count,
        coordination_notes: formData.coordination_notes || null,
        calendar_month: formData.scheduled_date.substring(0, 7)
      };

      if (assignment) {
        // Actualizar asignación existente
        const { error } = await supabase
          .from('maintenance_assignments')
          .update(payload)
          .eq('id', assignment.id);

        if (error) throw error;
      } else {
        // Crear nueva asignación
        const { error } = await supabase
          .from('maintenance_assignments')
          .insert([payload]);

        if (error) throw error;
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving assignment:', error);
      setErrors({ submit: error.message || 'Error al guardar la asignación' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!assignment || !confirm('¿Está seguro de eliminar esta asignación de mantenimiento?')) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('maintenance_assignments')
        .update({ status: 'cancelled' })
        .eq('id', assignment.id);

      if (error) throw error;

      onSuccess();
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      setErrors({ submit: error.message || 'Error al eliminar la asignación' });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!assignment || !confirm('¿Confirmar que el mantenimiento fue completado?')) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('maintenance_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by_signature: 'Firmado desde calendario' // TODO: Implementar firma real
        })
        .eq('id', assignment.id);

      if (error) throw error;

      onSuccess();
    } catch (error: any) {
      console.error('Error completing assignment:', error);
      setErrors({ submit: error.message || 'Error al completar la asignación' });
    } finally {
      setLoading(false);
    }
  };

  const availableTechnicians = technicians.filter(t => !t.is_on_leave);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {assignment ? 'Editar Mantenimiento' : 'Asignar Mantenimiento'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Errores generales */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Advertencia de día festivo */}
          {isHoliday && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-800">
                El día seleccionado es festivo. Se recomienda asignar a personal externo.
              </p>
            </div>
          )}

          {/* Edificio */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Building className="w-4 h-4" />
              Edificio *
            </label>
            <select
              value={formData.building_id}
              onChange={(e) => setFormData({ ...formData, building_id: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.building_id ? 'border-red-300' : 'border-slate-300'
              }`}
            >
              <option value="">Seleccione un edificio</option>
              {buildings.map(building => (
                <option key={building.id} value={building.id}>
                  {building.name} - {building.address}
                </option>
              ))}
            </select>
            {errors.building_id && (
              <p className="text-xs text-red-600 mt-1">{errors.building_id}</p>
            )}
          </div>

          {/* Tipo de asignación */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Tipo de Asignación *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!formData.is_external}
                  onChange={() => setFormData({ ...formData, is_external: false })}
                  className="w-4 h-4 text-blue-600"
                />
                <User className="w-4 h-4 text-slate-600" />
                <span className="text-sm text-slate-700">Técnico Interno</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.is_external}
                  onChange={() => setFormData({ ...formData, is_external: true })}
                  className="w-4 h-4 text-blue-600"
                />
                <Users className="w-4 h-4 text-slate-600" />
                <span className="text-sm text-slate-700">Personal Externo</span>
              </label>
            </div>
          </div>

          {/* Técnico interno */}
          {!formData.is_external && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <User className="w-4 h-4" />
                Técnico *
              </label>
              <select
                value={formData.assigned_technician_id}
                onChange={(e) => setFormData({ ...formData, assigned_technician_id: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.assigned_technician_id ? 'border-red-300' : 'border-slate-300'
                }`}
              >
                <option value="">Seleccione un técnico</option>
                {availableTechnicians.map(tech => (
                  <option key={tech.technician_id} value={tech.technician_id}>
                    {tech.full_name} {tech.emergency_shift_type && `(Turno: ${tech.emergency_shift_type})`}
                  </option>
                ))}
              </select>
              {errors.assigned_technician_id && (
                <p className="text-xs text-red-600 mt-1">{errors.assigned_technician_id}</p>
              )}
            </div>
          )}

          {/* Personal externo */}
          {formData.is_external && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Nombre Personal Externo *
                </label>
                <input
                  type="text"
                  value={formData.external_personnel_name}
                  onChange={(e) => setFormData({ ...formData, external_personnel_name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.external_personnel_name ? 'border-red-300' : 'border-slate-300'
                  }`}
                  placeholder="Ej: Juan Pérez"
                />
                {errors.external_personnel_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.external_personnel_name}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={formData.external_personnel_phone}
                  onChange={(e) => setFormData({ ...formData, external_personnel_phone: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.external_personnel_phone ? 'border-red-300' : 'border-slate-300'
                  }`}
                  placeholder="+56912345678"
                />
                {errors.external_personnel_phone && (
                  <p className="text-xs text-red-600 mt-1">{errors.external_personnel_phone}</p>
                )}
              </div>
            </div>
          )}

          {/* Fecha y horario */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4" />
                Fecha *
              </label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => {
                  setFormData({ ...formData, scheduled_date: e.target.value });
                  checkHoliday(e.target.value);
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.scheduled_date ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.scheduled_date && (
                <p className="text-xs text-red-600 mt-1">{errors.scheduled_date}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Clock className="w-4 h-4" />
                Hora Inicio *
              </label>
              <input
                type="time"
                value={formData.scheduled_time_start}
                onChange={(e) => setFormData({ ...formData, scheduled_time_start: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.scheduled_time_start ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.scheduled_time_start && (
                <p className="text-xs text-red-600 mt-1">{errors.scheduled_time_start}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Clock className="w-4 h-4" />
                Hora Fin *
              </label>
              <input
                type="time"
                value={formData.scheduled_time_end}
                onChange={(e) => setFormData({ ...formData, scheduled_time_end: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.scheduled_time_end ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.scheduled_time_end && (
                <p className="text-xs text-red-600 mt-1">{errors.scheduled_time_end}</p>
              )}
            </div>
          </div>

          {/* Duración estimada */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Duración Estimada (horas)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="8"
              value={formData.estimated_duration_hours}
              onChange={(e) => setFormData({ ...formData, estimated_duration_hours: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Bloquear fecha */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_fixed}
                onChange={(e) => setFormData({ ...formData, is_fixed: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <Lock className="w-4 h-4 text-slate-600" />
              <span className="text-sm text-slate-700">
                Bloquear fecha (no permitir reprogramación)
              </span>
            </label>
          </div>

          {/* Contexto de Emergencias */}
          {emergencyContext && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800 whitespace-pre-wrap">
                  {emergencyContext}
                </div>
              </div>
            </div>
          )}

          {/* Solicitud de Apoyo Adicional */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requires_additional_technicians}
                onChange={(e) => setFormData({ ...formData, requires_additional_technicians: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Requiere apoyo adicional</span>
                <p className="text-xs text-slate-600">Se necesitan múltiples técnicos para este mantenimiento</p>
              </div>
            </label>

            {formData.requires_additional_technicians && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Cantidad total de técnicos necesarios
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.additional_technicians_count}
                    onChange={(e) => setFormData({ ...formData, additional_technicians_count: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Notas de coordinación
                  </label>
                  <textarea
                    value={formData.coordination_notes}
                    onChange={(e) => setFormData({ ...formData, coordination_notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Se requiere especialista eléctrico, soldador..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Notas / Observaciones
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Información adicional sobre el mantenimiento..."
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            {assignment && assignment.status !== 'completed' && (
              <>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Completar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancelar
                </button>
              </>
            )}
            
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="ml-auto px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Cerrar
            </button>
            
            {assignment?.status !== 'completed' && (
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Guardando...' : assignment ? 'Actualizar' : 'Asignar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
