import { useState } from 'react';
import { createServiceRequest } from '@/lib/serviceRequestsService';

interface Props {
  clientId: string;
  elevatorId: string;
}

export default function EmergencyForm({ clientId, elevatorId }: Props) {
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'detenido' | 'observacion' | 'operativo'>('detenido');

  const handleSubmit = async () => {
    try {
      // 1. Registrar emergencia (esto depende de tu lógica actual)
      // 👉 aquí no lo toco para no romper nada

      // 2. Crear solicitud automáticamente asociada
      await createServiceRequest({
        client_id: clientId,
        elevator_id: elevatorId,

        request_type: 'diagnostic', // 👈 cambio clave
        intervention_type: 'corrective',

        priority: 'high',
        description: description || 'Solicitud generada desde emergencia'
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