import { useState } from 'react';
import { createServiceRequest } from '@/lib/serviceRequestsService';

export default function ManualServiceRequestForm({ clientId, elevatorId }: any) {
  const [requestType, setRequestType] = useState<'repair' | 'parts' | 'diagnostic'>('repair');
  const [interventionType, setInterventionType] = useState<'preventive' | 'corrective' | 'improvement'>('corrective');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    await createServiceRequest({
      client_id: clientId,
      elevator_id: elevatorId,
      request_type: requestType,
      intervention_type: interventionType,
      priority,
      description
    });

    alert('Solicitud creada');
  };

  return (
    <div className="space-y-4">

      {/* Tipo de solicitud */}
      <div>
        <label>Tipo de Solicitud</label>
        <select value={requestType} onChange={(e) => setRequestType(e.target.value as any)}>
          <option value="repair">Trabajos / Reparación</option>
          <option value="parts">Repuestos</option>
          <option value="diagnostic">Diagnóstico Técnico</option>
        </select>
      </div>

      {/* Tipo de intervención */}
      <div>
        <label>Tipo de Intervención</label>
        <select value={interventionType} onChange={(e) => setInterventionType(e.target.value as any)}>
          <option value="preventive">Preventivo</option>
          <option value="corrective">Correctivo</option>
          <option value="improvement">Mejora / Modernización</option>
        </select>
      </div>

      {/* Prioridad */}
      <div>
        <label>Prioridad</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
      </div>

      {/* Descripción */}
      <div>
        <label>Descripción</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <button onClick={handleSubmit}>Crear Solicitud</button>
    </div>
  );
}