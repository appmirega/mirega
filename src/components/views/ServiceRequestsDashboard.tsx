import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Wrench,
  Package,
  Users,
  FileText,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import type { ServiceRequest } from '../../types/serviceRequests';

interface ServiceRequestWithDetails extends ServiceRequest {
  elevators?: {
    elevator_number: number;
  };
  clients?: {
    company_name: string;
    building_name: string;
  };
  technician?: {
    full_name: string;
  };
}

export function ServiceRequestsDashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [requests, setRequests] = useState<ServiceRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);

    const { data } = await supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });

    setRequests(data || []);
    setLoading(false);
  };

  // 🔥 PROCESAR → flujo OT
  const handleProcessRequest = async (request: ServiceRequestWithDetails) => {
    await supabase
      .from('service_requests')
      .update({
        status: 'processing',
        requires_quotation: true,
        workflow_path: 'quotation_ot',
        assigned_to_admin_id: profile?.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    loadRequests();
  };

  // 🔥 RESOLVER DIRECTO
  const handleResolveDirect = async (request: ServiceRequestWithDetails) => {
    await supabase
      .from('service_requests')
      .update({
        status: 'resolved',
        requires_quotation: false,
        workflow_path: 'direct',
        assigned_to_admin_id: profile?.id,
        closed_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    loadRequests();
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'repair':
        return 'Trabajos / Reparación';
      case 'parts':
        return 'Repuestos';
      case 'diagnostic':
        return 'Diagnóstico Técnico';
      default:
        return type;
    }
  };

  const getInterventionTypeLabel = (type: string | null) => {
    if (!type) return '-';
    if (type === 'preventive') return 'Preventivo';
    if (type === 'corrective') return 'Correctivo';
    if (type === 'improvement') return 'Mejora / Modernización';
    return type;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'NUEVA';
      case 'analyzing': return 'EN REVISIÓN';
      case 'processing': return 'EN COTIZACIÓN';
      case 'resolved': return 'RESUELTA';
      case 'in_progress': return 'EN PROCESO';
      case 'completed': return 'COMPLETADA';
      case 'rejected': return 'RECHAZADA';
      default: return status;
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Solicitudes</h1>

      <div className="space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="bg-white p-5 rounded-xl shadow border">

            <div className="flex justify-between items-start">

              <div>
                <h3 className="font-bold text-lg">{request.title}</h3>

                <p className="text-sm text-gray-600">
                  {getRequestTypeLabel(request.request_type)} • {getInterventionTypeLabel(request.intervention_type)}
                </p>

                <p className="text-sm text-gray-500 mt-1">
                  Estado: {getStatusLabel(request.status)}
                </p>

                <p className="text-sm mt-1">
                  Cotización: 
                  <span className={`ml-2 font-semibold ${
                    request.requires_quotation ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {request.requires_quotation ? 'Requiere' : 'No requiere'}
                  </span>
                </p>
              </div>

              <div className="flex gap-2">

                <button className="px-3 py-2 bg-gray-600 text-white rounded">
                  <Eye size={16} />
                </button>

                {isAdmin && request.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleProcessRequest(request)}
                      className="px-3 py-2 bg-purple-600 text-white rounded"
                    >
                      Procesar
                    </button>

                    <button
                      onClick={() => handleResolveDirect(request)}
                      className="px-3 py-2 bg-green-600 text-white rounded"
                    >
                      Resolver
                    </button>
                  </>
                )}

              </div>

            </div>

          </div>
        ))}
      </div>
    </div>
  );
}