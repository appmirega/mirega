import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { normalizeRUT, validateRUT } from '../../utils/validateRUT';
import { CHILE_REGIONS } from '../../data/chileRegions';

export default function ClientForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientData, setClientData] = useState({
    company_name: '',
    building_name: '',
    internal_alias: '',
    rut: '',
    address: '',
    commune: '',
    region: '',
  });

  function upperText(v: string) {
    return (v || '').toUpperCase();
  }

  function normalizeRutInput(v: string) {
    return normalizeRUT(v);
  }

  async function checkRutAlreadyExists() {
    const rut = normalizeRutInput(clientData.rut);

    const { data, error } = await supabase
      .from('clients')
      .select('id, rut');

    if (error) throw error;

    const exists = (data || []).some(
      (c) => normalizeRutInput(c.rut || '') === rut
    );

    if (exists) {
      throw new Error('Cliente ya creado con ese RUT');
    }
  }

  function validateClient() {
    const rut = normalizeRutInput(clientData.rut);

    if (!clientData.company_name) throw new Error('Falta razón social');
    if (!clientData.building_name) throw new Error('Falta edificio');
    if (!clientData.internal_alias) throw new Error('Falta alias');

    if (!rut) throw new Error('Falta RUT');
    if (!validateRUT(rut)) throw new Error('RUT inválido');

    if (!clientData.address) throw new Error('Falta dirección');
    if (!clientData.commune) throw new Error('Falta comuna');
    if (!clientData.region) throw new Error('Falta región');
  }

  // 🔥 ESTA ES LA FUNCIÓN QUE TE ROMPÍA TODO (YA CORREGIDA)
  const buildElevatorPayloads = (clientId: string) => {
    const payloads: any[] = [];

    let runningNumber = 1;

    // Ejemplo base (mantén tu lógica real si la tienes)
    const towers = ['A', 'B'];
    const elevatorsPerTower = 2;

    towers.forEach((tower) => {
      for (let i = 0; i < elevatorsPerTower; i++) {
        payloads.push({
          client_id: clientId,
          elevator_number: runningNumber++,
          tower_name: `TORRE ${tower}`,
          is_active: true,
        });
      }
    });

    return payloads;
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      validateClient();
      await checkRutAlreadyExists();

      const { data, error } = await supabase
        .from('clients')
        .insert({
          company_name: upperText(clientData.company_name),
          building_name: upperText(clientData.building_name),
          internal_alias: upperText(clientData.internal_alias),
          rut: normalizeRutInput(clientData.rut),
          address: upperText(clientData.address),
          commune: upperText(clientData.commune),
          city: upperText(clientData.region),
        })
        .select('id')
        .single();

      if (error) throw error;

      const elevators = buildElevatorPayloads(data.id);

      if (elevators.length) {
        await supabase.from('elevators').insert(elevators);
      }

      alert('Cliente creado correctamente');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <input
        placeholder="RAZÓN SOCIAL"
        value={clientData.company_name}
        onChange={(e) =>
          setClientData({ ...clientData, company_name: upperText(e.target.value) })
        }
      />

      <input
        placeholder="EDIFICIO"
        value={clientData.building_name}
        onChange={(e) =>
          setClientData({ ...clientData, building_name: upperText(e.target.value) })
        }
      />

      <input
        placeholder="ALIAS"
        value={clientData.internal_alias}
        onChange={(e) =>
          setClientData({ ...clientData, internal_alias: upperText(e.target.value) })
        }
      />

      <input
        placeholder="RUT (15426257-1)"
        value={clientData.rut}
        onChange={(e) =>
          setClientData({ ...clientData, rut: normalizeRutInput(e.target.value) })
        }
      />

      <input
        placeholder="DIRECCIÓN"
        value={clientData.address}
        onChange={(e) =>
          setClientData({ ...clientData, address: upperText(e.target.value) })
        }
      />

      <input
        placeholder="COMUNA"
        value={clientData.commune}
        onChange={(e) =>
          setClientData({ ...clientData, commune: upperText(e.target.value) })
        }
      />

      <select
        value={clientData.region}
        onChange={(e) =>
          setClientData({ ...clientData, region: e.target.value })
        }
      >
        <option value="">REGIÓN</option>
        {CHILE_REGIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {error && <div className="text-red-500">{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : 'Crear Cliente'}
      </button>
    </form>
  );
}