import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Plus, Trash2, Clock, AlertCircle, Check, X } from 'lucide-react';

interface Technician {
  id: string;
  full_name: string;
}

interface Absence {
  id: string;
  technician_id: string;
  technician_name?: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
}

export function TechnicianAbsenceForm() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    technician_id: '',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadAbsences(), loadTechnicians()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAbsences = async () => {
    const { data, error } = await supabase
      .from('technician_availability')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error loading absences:', error);
      return;
    }

    const enrichedAbsences = await Promise.all(
      (data || []).map(async (absence) => {
        const { data: techData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', absence.technician_id)
          .single();

        return {
          ...absence,
          technician_name: techData?.full_name || 'Técnico desconocido'
        };
      })
    );

    setAbsences(enrichedAbsences);
  };

  const loadTechnicians = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'technician')
      .order('full_name');

    if (error) {
      console.error('Error loading technicians:', error);
      return;
    }

    setTechnicians(data || []);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.technician_id) {
      newErrors.technician_id = 'Seleccione un técnico';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Seleccione fecha de inicio';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'Seleccione fecha de fin';
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.start_date) >= new Date(formData.end_date)) {
        newErrors.end_date = 'La fecha de fin debe ser posterior a la de inicio';
      }
    }

    if (!formData.reason) {
      newErrors.reason = 'Especifique el motivo (Vacaciones/Permiso)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const absenceTypeMap: Record<string, string> = {
        Vacaciones: 'vacation',
        Permiso: 'personal_leave',
        Enfermo: 'sick_leave',
        Licencia: 'training',
        Otro: 'other'
      };

      const absence_type = absenceTypeMap[formData.reason] || 'other';

      const { error } = await supabase
        .from('technician_availability')
        .insert([
          {
            technician_id: formData.technician_id,
            start_date: formData.start_date,
            end_date: formData.end_date,
            absence_type,
            reason: formData.reason,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      alert('✅ Ausencia registrada. El administrador deberá aprobarla.');
      setFormData({
        technician_id: '',
        start_date: '',
        end_date: '',
        reason: ''
      });
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error('Error creating absence:', error);
      alert('❌ Error al registrar ausencia');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('technician_availability')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Ausencia aprobada');
      loadData();
    } catch (error) {
      console.error('Error approving absence:', error);
      alert('❌ Error al aprobar ausencia');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('technician_availability')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Ausencia rechazada');
      loadData();
    } catch (error) {
      console.error('Error rejecting absence:', error);
      alert('❌ Error al rechazar ausencia');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro de ausencia?')) return;

    try {
      const { error } = await supabase
        .from('technician_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('✅ Registro eliminado');
      loadData();
    } catch (error) {
      console.error('Error deleting absence:', error);
      alert('❌ Error al eliminar registro');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <Check className="w-4 h-4" />;
      case 'rejected':
        return <X className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando ausencias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Vacaciones y Permisos</h1>
              <p className="text-sm text-slate-600">Gestión de ausencias de técnicos (vacaciones, permisos, días enfermo)</p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Nueva Ausencia
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Formulario */}
        {showForm && (
          <div className="bg-white border-b border-slate-200 p-6 m-4 rounded-lg">
            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Registrar Ausencia</h2>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Técnico *
                </label>
                <select
                  value={formData.technician_id}
                  onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.technician_id ? 'border-red-300' : 'border-slate-300'
                  }`}
                >
                  <option value="">Seleccione técnico</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </option>
                  ))}
                </select>
                {errors.technician_id && (
                  <p className="text-xs text-red-600 mt-1">{errors.technician_id}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.start_date ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  {errors.start_date && (
                    <p className="text-xs text-red-600 mt-1">{errors.start_date}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Fecha Fin *
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.end_date ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  {errors.end_date && (
                    <p className="text-xs text-red-600 mt-1">{errors.end_date}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Motivo *
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.reason ? 'border-red-300' : 'border-slate-300'
                  }`}
                >
                  <option value="">Seleccione motivo</option>
                  <option value="Vacaciones">Vacaciones</option>
                  <option value="Permiso">Permiso</option>
                  <option value="Enfermo">Día Enfermo</option>
                  <option value="Licencia">Licencia</option>
                  <option value="Otro">Otro</option>
                </select>
                {errors.reason && (
                  <p className="text-xs text-red-600 mt-1">{errors.reason}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Registrar Ausencia
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

        {/* Lista de Ausencias */}
        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <strong>Nota:</strong> Las ausencias registradas aquí aparecerán bloqueadas en el calendario de mantenimientos. El admin debe aprobar las solicitudes pendientes.
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {absences.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">No hay ausencias registradas</p>
              </div>
            ) : (
              absences.map(absence => (
                <div
                  key={absence.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {absence.technician_name}
                        </h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getStatusColor(absence.status)}`}>
                          {getStatusIcon(absence.status)}
                          {absence.status === 'approved' && 'Aprobada'}
                          {absence.status === 'rejected' && 'Rechazada'}
                          {absence.status === 'pending' && 'Pendiente'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(absence.start_date).toLocaleDateString('es-CL')} hasta{' '}
                          {new Date(absence.end_date).toLocaleDateString('es-CL')}
                        </div>
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium">
                          {absence.reason}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {absence.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(absence.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition"
                            title="Aprobar"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleReject(absence.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                            title="Rechazar"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(absence.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
