import { useState } from 'react';
import { createServiceRequest } from '@/lib/serviceRequestsService';

interface Props {
  clientId: string;
  elevatorId: string;
}

export function EmergencyForm({ clientId, elevatorId }: Props) {
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'detenido' | 'observacion' | 'operativo'>('detenido');

  const handleSubmit = async () => {
    try {
      // Aquí mantienes tu lógica actual de registro de emergencia
      // y además generas la solicitud asociada

      await createServiceRequest({
        client_id: clientId,
        elevator_id: elevatorId,
        request_type: 'diagnostic',
        intervention_type: 'corrective',
        priority: 'high',
        description: description || 'Solicitud generada desde emergencia',
        source_type: 'emergency_visit',
      });

      alert('Emergencia registrada y solicitud creada');
      setDescription('');
    } catch (error) {
      console.error(error);
      alert('Error al registrar emergencia');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label>Estado del Ascensor</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="detenido">Detenido</option>
          <option value="observacion">Observación</option>
          <option value="operativo">Operativo</option>
        </select>
      </div>

      <div>
        <label>Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe la emergencia..."
        />
      </div>

      <button onClick={handleSubmit}>
        Registrar Emergencia
      </button>
    </div>
  );
}

export default EmergencyForm;