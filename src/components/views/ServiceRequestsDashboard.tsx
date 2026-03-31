import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createWorkOrderFromRequest } from '@/lib/serviceRequestsService';

export default function ServiceRequestsDashboard() {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase.from('service_requests').select('*');
    setRequests(data || []);
  };

  const handleCreateOT = async (req: any) => {
    await createWorkOrderFromRequest(req);
    fetchRequests();
  };

  return (
    <div>
      <h2>Solicitudes</h2>

      {requests.map((req) => (
        <div key={req.id} className="border p-3 mb-3">

          <p><b>Tipo:</b> {req.request_type}</p>
          <p><b>Intervención:</b> {req.intervention_type}</p>
          <p><b>Prioridad:</b> {req.priority}</p>
          <p>{req.description}</p>

          {!req.work_order_id && (
            <button onClick={() => handleCreateOT(req)}>
              Crear OT
            </button>
          )}

          {req.work_order_id && (
            <p>OT creada</p>
          )}
        </div>
      ))}
    </div>
  );
}