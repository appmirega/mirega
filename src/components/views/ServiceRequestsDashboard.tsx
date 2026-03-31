import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createWorkOrderFromRequest } from '@/lib/serviceRequestsService';

export function ServiceRequestsDashboard() {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setRequests(data || []);
  };

  const handleCreateOT = async (req: any) => {
    try {
      await createWorkOrderFromRequest(req);
      fetchRequests();
    } catch (error) {
      console.error(error);
      alert('Error al crear OT');
    }
  };

  const getTypeLabel = (type: string) => {
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

  const getInterventionLabel = (type: string) => {
    switch (type) {
      case 'preventive':
        return 'Preventivo';
      case 'corrective':
        return 'Correctivo';
      case 'improvement':
        return 'Mejora / Modernización';
      default:
        return type || '-';
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Solicitudes de Servicio</h2>

      {requests.map((req) => (
        <div key={req.id} className="border p-3 mb-3 rounded">

          <p><b>Tipo:</b> {getTypeLabel(req.request_type)}</p>
          <p><b>Intervención:</b> {getInterventionLabel(req.intervention_type)}</p>
          <p><b>Prioridad:</b> {req.priority}</p>
          <p><b>Estado:</b> {req.status}</p>

          <p className="mt-2">{req.description}</p>

          {!req.work_order_id && (
            <button
              onClick={() => handleCreateOT(req)}
              className="mt-3 bg-blue-600 text-white px-3 py-1 rounded"
            >
              Crear OT
            </button>
          )}

          {req.work_order_id && (
            <p className="mt-3 text-green-600 font-semibold">
              OT creada
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default ServiceRequestsDashboard;