import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Building2, Loader2, Calendar, CheckCircle, FileText, FileDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StoppedEmergency {
  id: string;
  visit_date: string;
  completed_at?: string;
  failure_description: string;
  client_id: string;
  client_name: string;
  elevator_numbers: string[];
  service_request_id: string | null;
  days_stopped: number;
  pdf_url: string | null;
}

interface StoppedElevatorsProps {
  onBack: () => void;
}

export function StoppedElevators({ onBack }: StoppedElevatorsProps) {
  const [emergencies, setEmergencies] = useState<StoppedEmergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmergency, setSelectedEmergency] = useState<StoppedEmergency | null>(null);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivationNotes, setReactivationNotes] = useState('');
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    loadStoppedElevators();
  }, []);

  const loadStoppedElevators = async () => {
    try {
      setLoading(true);

      // Get emergency visits with stopped status and not reactivated
      const { data, error } = await supabase
        .from('emergency_visits')
        .select(`
          id,
          visit_date,
          completed_at,
          failure_description,
          client_id,
          service_request_id,
          pdf_url,
          clients (
            company_name
          )
        `)
        .eq('final_status', 'stopped')
        .is('reactivation_date', null)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error loading stopped emergencies:', error);
        return;
      }

      if (!data) {
        setEmergencies([]);
        return;
      }

      // Get elevator numbers for each emergency
      const emergenciesWithElevators = await Promise.all(
        data.map(async (emergency) => {
          const { data: elevatorData } = await supabase
            .from('emergency_visit_elevators')
            .select('elevators(elevator_number)')
            .eq('emergency_visit_id', emergency.id);

          const elevatorNumbers = elevatorData?.map(e => (e.elevators as any)?.elevator_number).filter(Boolean) || [];
          
          // Calculate days stopped desde la fecha de completado
          const completedDate = new Date(emergency.completed_at || emergency.visit_date);
          const today = new Date();
          const daysStopped = Math.floor((today.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: emergency.id,
            visit_date: emergency.visit_date,
            completed_at: emergency.completed_at,
            failure_description: emergency.failure_description || 'Sin descripción',
            client_id: emergency.client_id,
            client_name: (emergency.clients as any)?.company_name || 'Cliente desconocido',
            elevator_numbers: elevatorNumbers,
            service_request_id: emergency.service_request_id,
            days_stopped: daysStopped,
            pdf_url: emergency.pdf_url
          };
        })
      );

      setEmergencies(emergenciesWithElevators);
    } catch (error) {
      console.error('Error loading stopped emergencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = (emergency: StoppedEmergency) => {
    setSelectedEmergency(emergency);
    setShowReactivateModal(true);
    setReactivationNotes('');
  };

  const confirmReactivation = async () => {
    if (!selectedEmergency || !reactivationNotes.trim()) {
      alert('Debes ingresar notas sobre la reactivación');
      return;
    }

    try {
      setReactivating(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { error } = await supabase
        .from('emergency_visits')
        .update({
          reactivation_date: new Date().toISOString(),
          reactivation_notes: reactivationNotes,
          reactivated_by: user.id
        })
        .eq('id', selectedEmergency.id);

      if (error) throw error;

      alert('✅ Ascensor dado de alta correctamente');
      setShowReactivateModal(false);
      setSelectedEmergency(null);
      loadStoppedElevators(); // Reload list
    } catch (error) {
      console.error('Error reactivating:', error);
      alert('Error al dar de alta el ascensor');
    } finally {
      setReactivating(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
            <h1 className="text-2xl font-bold text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-7 h-7 text-red-600" />
              Ascensores Detenidos
            </h1>
            <p className="text-red-700 text-sm mt-1 font-medium">
              Estado crítico - requiere atención inmediata
            </p>
          </div>
        </div>

        {/* Count badge */}
        {!loading && emergencies.length > 0 && (
          <div className="mb-6 inline-flex items-center gap-2 bg-red-100 border-2 border-red-300 text-red-900 px-4 py-2 rounded-lg font-bold">
            <AlertTriangle className="w-5 h-5" />
            {emergencies.length} ascensor{emergencies.length !== 1 ? 'es' : ''} detenido{emergencies.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        )}

        {/* Empty state */}
        {!loading && emergencies.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay ascensores detenidos
            </h3>
            <p className="text-gray-600">
              Todos los ascensores están operativos
            </p>
          </div>
        )}

        {/* List */}
        {!loading && emergencies.length > 0 && (
          <div className="space-y-4">
            {emergencies.map((emergency) => (
              <div
                key={emergency.id}
                className="bg-red-50 rounded-xl border-2 border-red-300 p-6 shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    {/* Client */}
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-5 h-5 text-red-700" />
                      <h3 className="text-lg font-bold text-red-900">
                        {emergency.client_name}
                      </h3>
                    </div>

                    {/* Elevator numbers */}
                    <p className="text-base font-semibold text-red-800 mb-3">
                      {emergency.elevator_numbers.length > 0 
                        ? `Ascensor${emergency.elevator_numbers.length > 1 ? 'es' : ''} N° ${emergency.elevator_numbers.join(', ')}`
                        : 'Sin ascensores asignados'}
                    </p>

                    {/* Failure description */}
                    <div className="bg-white rounded-lg p-3 mb-3 border border-red-200">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold text-red-900">Falla:</span>{' '}
                        {emergency.failure_description}
                      </p>
                    </div>

                    {/* Date and days */}
                    <div className="flex items-center gap-4 text-sm text-red-700 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Detenido desde: {formatDate(emergency.completed_at || emergency.visit_date)}</span>
                      </div>
                      <span className="font-bold">
                        ({emergency.days_stopped} día{emergency.days_stopped !== 1 ? 's' : ''})
                      </span>
                    </div>

                    {/* Service request badge and PDF button */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {emergency.service_request_id && (
                        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 w-fit">
                          <FileText className="w-4 h-4" />
                          <span>Solicitud de servicio creada</span>
                        </div>
                      )}
                      {emergency.pdf_url && (
                        <a
                          href={emergency.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-red-700 bg-red-100 px-3 py-2 rounded-lg border border-red-300 hover:bg-red-200 transition-colors font-medium"
                        >
                          <FileDown className="w-4 h-4" />
                          Ver PDF Informe Inicial
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full">
                      DETENIDO
                    </span>
                    <button
                      onClick={() => handleReactivate(emergency)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Dar de Alta
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reactivation Modal */}
        {showReactivateModal && selectedEmergency && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Dar de Alta Ascensor
              </h2>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-semibold">Cliente:</span> {selectedEmergency.client_name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Ascensor(es):</span> N° {selectedEmergency.elevator_numbers.join(', ')}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas de Reactivación *
                </label>
                <textarea
                  value={reactivationNotes}
                  onChange={(e) => setReactivationNotes(e.target.value)}
                  placeholder="Describe qué se realizó para poner el ascensor operativo nuevamente..."
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ejemplo: "Repuesto instalado correctamente, ascensor probado y funcionando"
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReactivateModal(false);
                    setSelectedEmergency(null);
                  }}
                  disabled={reactivating}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmReactivation}
                  disabled={reactivating || !reactivationNotes.trim()}
                  className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {reactivating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirmar Alta
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
