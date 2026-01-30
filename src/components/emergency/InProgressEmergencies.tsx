import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Building2, Loader2, Trash2, CheckSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface InProgressEmergency {
  id: string;
  client_id: string;
  created_at: string;
  last_autosave: string;
  client_name?: string;
  elevator_numbers?: string[];
}

interface InProgressEmergenciesProps {
  onBack: () => void;
  onResume?: (visitId: string, clientId: string, elevatorIds: string[]) => void;
}

export function InProgressEmergencies({ onBack, onResume }: InProgressEmergenciesProps) {
  const [emergencies, setEmergencies] = useState<InProgressEmergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadInProgressEmergencies();
  }, []);

  const loadInProgressEmergencies = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      // Get draft emergency visits
      const { data: emergenciesData, error: emergenciesError } = await supabase
        .from('emergency_visits')
        .select(`
          id,
          client_id,
          created_at,
          last_autosave,
          clients (
            company_name
          )
        `)
        .eq('technician_id', user.id)
        .eq('status', 'draft')
        .order('last_autosave', { ascending: false });

      if (emergenciesError) {
        console.error('Error loading emergencies:', emergenciesError);
        return;
      }

      // Get elevator information for each emergency
      const emergenciesWithElevators = await Promise.all(
        (emergenciesData || []).map(async (emergency) => {
          const { data: elevatorsData } = await supabase
            .from('emergency_visit_elevators')
            .select('elevator_id, elevators(elevator_number)')
            .eq('emergency_visit_id', emergency.id);

          return {
            id: emergency.id,
            client_id: emergency.client_id,
            created_at: emergency.created_at,
            last_autosave: emergency.last_autosave,
            client_name: (emergency.clients as any)?.company_name,
            elevator_numbers: elevatorsData?.map(e => (e.elevators as any)?.elevator_number).filter(Boolean)
          };
        })
      );

      setEmergencies(emergenciesWithElevators);
    } catch (error) {
      console.error('Error loading in-progress emergencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleResumeEmergency = async (emergencyId: string) => {
    try {
      // Cargar datos de la emergencia
      const { data: visitData, error: visitError } = await supabase
        .from('emergency_visits')
        .select('client_id')
        .eq('id', emergencyId)
        .single();
      
      if (visitError) throw visitError;
      
      // Cargar los IDs de ascensores vinculados
      const { data: elevatorsData, error: elevatorsError } = await supabase
        .from('emergency_visit_elevators')
        .select('elevator_id')
        .eq('emergency_visit_id', emergencyId);
      
      if (elevatorsError) throw elevatorsError;
      
      const elevatorIds = elevatorsData.map(e => e.elevator_id);
      
      // Llamar al callback con los datos necesarios
      if (onResume) {
        onResume(emergencyId, visitData.client_id, elevatorIds);
      }
    } catch (error) {
      console.error('Error resumiendo emergencia:', error);
      alert('Error al cargar la emergencia. Por favor intenta de nuevo.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Selecciona al menos un borrador para eliminar');
      return;
    }

    if (!confirm(`¿Eliminar ${selectedIds.size} borrador(es)? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('emergency_visits')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      setSelectedIds(new Set());
      await loadInProgressEmergencies();
      alert('Borradores eliminados exitosamente');
    } catch (error) {
      console.error('Error deleting drafts:', error);
      alert('Error al eliminar borradores');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (emergencies.length === 0) return;

    if (!confirm(`¿Eliminar TODOS los ${emergencies.length} borradores? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeleting(true);
    try {
      const ids = emergencies.map(e => e.id);
      const { error } = await supabase
        .from('emergency_visits')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setSelectedIds(new Set());
      await loadInProgressEmergencies();
      alert('Todos los borradores eliminados exitosamente');
    } catch (error) {
      console.error('Error deleting all drafts:', error);
      alert('Error al eliminar todos los borradores');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === emergencies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emergencies.map(e => e.id)));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergencias en Progreso</h1>
            <p className="text-gray-600 text-sm mt-1">
              Formularios sin firmar - guardados automáticamente
            </p>
          </div>
        </div>

        {/* Bulk Actions */}
        {!loading && emergencies.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === emergencies.length && emergencies.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5"
                />
                <span className="text-sm font-medium text-gray-700">
                  Seleccionar todos ({emergencies.length})
                </span>
              </label>
              {selectedIds.size > 0 && (
                <span className="text-sm text-blue-600 font-medium">
                  {selectedIds.size} seleccionado(s)
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0 || deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar seleccionados
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar todo
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Empty state */}
        {!loading && emergencies.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay emergencias en progreso
            </h3>
            <p className="text-gray-600">
              Todos tus formularios están completos o no has iniciado ninguno
            </p>
          </div>
        )}

        {/* List */}
        {!loading && emergencies.length > 0 && (
          <div className="space-y-4">
            {emergencies.map((emergency) => (
              <div
                key={emergency.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(emergency.id)}
                    onChange={() => toggleSelection(emergency.id)}
                    className="w-5 h-5 mt-1 cursor-pointer"
                  />
                  
                  <div className="flex-1">
                    {/* Client */}
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {emergency.client_name || 'Cliente desconocido'}
                      </h3>
                    </div>

                    {/* Elevators */}
                    {emergency.elevator_numbers && emergency.elevator_numbers.length > 0 && (
                      <p className="text-sm text-gray-600 mb-3">
                        Ascensores: {emergency.elevator_numbers.join(', ')}
                      </p>
                    )}

                    {/* Timestamps */}
                    <div className="flex flex-col gap-1 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Iniciado: {formatDate(emergency.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Último guardado: {formatDate(emergency.last_autosave)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="ml-4 flex flex-col gap-2">
                    <button
                      onClick={() => handleResumeEmergency(emergency.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Continuar
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('¿Eliminar este borrador? Esta acción no se puede deshacer.')) {
                          const { error } = await supabase
                            .from('emergency_visits')
                            .delete()
                            .eq('id', emergency.id);
                          
                          if (!error) {
                            loadInProgressEmergencies();
                          } else {
                            alert('Error al eliminar el borrador');
                          }
                        }
                      }}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && emergencies.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            {emergencies.length} emergencia{emergencies.length !== 1 ? 's' : ''} sin completar
          </div>
        )}
      </div>
    </div>
  );
}
