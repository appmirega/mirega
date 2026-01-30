import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Building2, Loader2, FileText, CheckCircle, Clock, Download, Share2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmergencyVisit {
  id: string;
  client_id: string;
  visit_date: string;
  completed_at?: string;
  failure_description: string;
  resolution_description: string;
  status: string;
  client_name?: string;
  elevator_numbers?: string[];
  final_status?: string;
  pdf_url?: string;
  reactivation_date?: string;
  reactivation_notes?: string;
}

interface EmergencyHistoryProps {
  onBack: () => void;
}

export function EmergencyHistory({ onBack }: EmergencyHistoryProps) {
  const [visits, setVisits] = useState<EmergencyVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'closed'>('all');

  useEffect(() => {
    loadHistory();
  }, [filterStatus]);

  const loadHistory = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        return;
      }

      // Build query
      let query = supabase
        .from('emergency_visits')
        .select(`
          id,
          client_id,
          visit_date,
          failure_description,
          resolution_summary,
          status,
          final_status,
          pdf_url,
          reactivation_date,
          reactivation_notes,
          completed_at,
          created_at,
          clients (
            company_name
          )
        `)
        .eq('technician_id', user.id)
        .in('status', ['completed', 'closed'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      // Apply status filter
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data: visitsData, error: visitsError } = await query;

      if (visitsError) {
        console.error('Error loading history:', visitsError);
        return;
      }

      console.log(`📋 Historial: ${visitsData?.length || 0} emergencias cargadas`);
      if (visitsData && visitsData.length > 0) {
        console.log('Última emergencia:', visitsData[0].completed_at, visitsData[0].status);
      }

      // Get elevator information for each visit
      const visitsWithElevators = await Promise.all(
        (visitsData || []).map(async (visit) => {
          const { data: elevatorsData } = await supabase
            .from('emergency_visit_elevators')
            .select('elevator_id, final_status, elevators(elevator_number)')
            .eq('emergency_visit_id', visit.id);

          return {
            id: visit.id,
            client_id: visit.client_id,
            visit_date: visit.visit_date,
            completed_at: visit.completed_at,
            failure_description: visit.failure_description,
            resolution_description: visit.resolution_summary,
            status: visit.status,
            client_name: (visit.clients as any)?.company_name,
            elevator_numbers: elevatorsData?.map(e => (e.elevators as any)?.elevator_number).filter(Boolean),
            final_status: visit.final_status || elevatorsData?.[0]?.final_status,
            pdf_url: visit.pdf_url,
            reactivation_date: visit.reactivation_date,
            reactivation_notes: visit.reactivation_notes
          };
        })
      );

      setVisits(visitsWithElevators);
    } catch (error) {
      console.error('Error loading emergency history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Fecha no disponible';
    // Convertir de UTC a hora chilena (UTC-3)
    const date = new Date(dateString);
    date.setHours(date.getHours() - 3);
    
    const fechaStr = date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const horaStr = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${fechaStr}, ${horaStr}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
            <CheckCircle className="w-3 h-3" />
            Completado
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
            <Clock className="w-3 h-3" />
            Cerrado
          </span>
        );
      default:
        return null;
    }
  };

  const getFinalStatusBadge = (finalStatus?: string) => {
    if (!finalStatus) return null;

    switch (finalStatus) {
      case 'operational':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
            Operativo
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
            Detenido
          </span>
        );
      case 'requires_parts':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
            Requiere Repuestos
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historial de Emergencias</h1>
            <p className="text-gray-600 text-sm mt-1">
              Registro completo de visitas realizadas
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Filtrar por estado:</span>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filterStatus === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completados
            </button>
            <button
              onClick={() => setFilterStatus('closed')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filterStatus === 'closed'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cerrados
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Empty state */}
        {!loading && visits.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay emergencias en el historial
            </h3>
            <p className="text-gray-600">
              {filterStatus === 'all' 
                ? 'Aún no has completado ninguna emergencia'
                : `No hay emergencias con estado "${filterStatus === 'completed' ? 'completado' : 'cerrado'}"`
              }
            </p>
          </div>
        )}

        {/* List */}
        {!loading && visits.length > 0 && (
          <div className="space-y-4">
            {visits.map((visit) => (
              <div
                key={visit.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {visit.client_name || 'Cliente desconocido'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(visit.status)}
                    {getFinalStatusBadge(visit.final_status)}
                  </div>
                </div>

                {/* Elevators */}
                {visit.elevator_numbers && visit.elevator_numbers.length > 0 && (
                  <p className="text-sm text-gray-600 mb-3">
                    Ascensor{visit.elevator_numbers.length > 1 ? 'es' : ''}: {visit.elevator_numbers.join(', ')}
                  </p>
                )}

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(visit.completed_at || visit.visit_date)}</span>
                </div>

                {/* Descriptions */}
                <div className="space-y-3">
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <p className="text-xs font-semibold text-red-900 mb-1">FALLA REPORTADA</p>
                    <p className="text-sm text-gray-700">
                      {visit.failure_description || 'Sin descripción'}
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <p className="text-xs font-semibold text-green-900 mb-1">RESOLUCIÓN</p>
                    <p className="text-sm text-gray-700">
                      {visit.resolution_description || 'Sin descripción'}
                    </p>
                  </div>

                  {/* Reactivation info if exists */}
                  {visit.reactivation_date && visit.reactivation_notes && (
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-xs font-semibold text-blue-900 mb-1">
                        REACTIVADO - {formatDate(visit.reactivation_date)}
                      </p>
                      <p className="text-sm text-gray-700">
                        {visit.reactivation_notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* PDF Actions */}
                {visit.pdf_url && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                    <a
                      href={visit.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <a
                      href={visit.pdf_url}
                      download
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: `Emergencia - ${visit.client_name}`,
                            url: visit.pdf_url
                          });
                        } else {
                          navigator.clipboard.writeText(visit.pdf_url!);
                          alert('URL copiada al portapapeles');
                        }
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && visits.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            {visits.length} emergencia{visits.length !== 1 ? 's' : ''} en el historial
          </div>
        )}
      </div>
    </div>
  );
}
