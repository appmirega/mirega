import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, CheckCircle, Clock, MessageSquare } from 'lucide-react';

interface CoordinationRequest {
  id: string;
  assigned_technician_name: string;
  assigned_technician_id: string;
  building_name: string;
  scheduled_date: string;
  requires_additional_technicians: boolean;
  additional_technicians_count?: number;
  coordination_notes?: string;
  related_emergency_visits?: string;
  emergency_context_notes?: string;
}

export function CoordinationRequestsPanel() {
  const [requests, setRequests] = useState<CoordinationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_assignments')
        .select(`
          id,
          assigned_technician_id,
          building_name,
          scheduled_date,
          requires_additional_technicians,
          additional_technicians_count,
          coordination_notes,
          related_emergency_visits,
          emergency_context_notes,
          profiles!maintenance_assignments_assigned_technician_id_fkey(full_name)
        `)
        .eq('requires_additional_technicians', true)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const enrichedRequests: CoordinationRequest[] = (data || []).map((item: any) => ({
        id: item.id,
        assigned_technician_name: item.profiles?.full_name || 'Desconocido',
        assigned_technician_id: item.assigned_technician_id,
        building_name: item.building_name,
        scheduled_date: item.scheduled_date,
        requires_additional_technicians: item.requires_additional_technicians,
        additional_technicians_count: item.additional_technicians_count,
        coordination_notes: item.coordination_notes,
        related_emergency_visits: item.related_emergency_visits,
        emergency_context_notes: item.emergency_context_notes,
      }));

      setRequests(enrichedRequests);
    } catch (error) {
      console.error('Error loading coordination requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRequests = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (filter === 'pending') {
      return requests.filter(r => new Date(r.scheduled_date) >= now);
    } else if (filter === 'approved') {
      return requests.filter(r => new Date(r.scheduled_date) < now);
    }
    return requests;
  };

  const filteredRequests = getFilteredRequests();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 text-lg mb-3">
          Solicitudes de Coordinación ({filteredRequests.length})
        </h3>
        
        <div className="flex gap-2">
          {(['all', 'pending', 'approved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded transition ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f === 'all' && 'Todas'}
              {f === 'pending' && 'Próximas'}
              {f === 'approved' && 'Pasadas'}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-slate-600">No hay solicitudes de coordinación pendientes</p>
          </div>
        ) : (
          filteredRequests.map(request => (
            <div key={request.id} className="p-4 hover:bg-slate-50 transition">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-slate-900">
                    {request.building_name}
                  </h4>
                  <p className="text-sm text-slate-600">
                    Técnico: {request.assigned_technician_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <span className="px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded">
                    {request.additional_technicians_count || 1} técnicos
                  </span>
                </div>
              </div>

              <div className="text-sm text-slate-600 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {new Date(request.scheduled_date).toLocaleDateString('es-CL')}
              </div>

              {request.coordination_notes && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                  <div className="flex gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-900 mb-1">Notas de Coordinación:</p>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">
                        {request.coordination_notes}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {request.emergency_context_notes && (
                <div className="bg-orange-50 border border-orange-200 rounded p-3">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-orange-900 mb-1">Contexto de Emergencia:</p>
                      <p className="text-sm text-orange-800 whitespace-pre-wrap">
                        {request.emergency_context_notes}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {filteredRequests.length > 0 && (
        <div className="px-4 py-3 bg-slate-50 text-xs text-slate-600 border-t border-slate-200">
          Se actualiza automáticamente cada 30 segundos
        </div>
      )}
    </div>
  );
}
