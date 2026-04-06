import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Props {
  client?: any;
  isEditMode?: boolean;
  onSuccess?: () => void;
}

export function ClientForm({ client, isEditMode, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client?.id) return;

    setLoading(true);

    try {
      // =========================
      // 1. UPDATE CLIENT
      // =========================
      await supabase
        .from('clients')
        .update({
          name: client.name,
          rut: client.rut,
          address: client.address,
          region: client.region,
          comuna: client.comuna
        })
        .eq('id', client.id);

      // =========================
      // 2. GET EXISTING ELEVATORS
      // =========================
      const { data: existing } = await supabase
        .from('elevators')
        .select('id')
        .eq('client_id', client.id);

      const existingIds = existing?.map((e: any) => e.id) || [];
      const formIds: string[] = [];

      // =========================
      // 3. UPDATE / INSERT (SIMULADO EJEMPLO)
      // ⚠️ aquí debes usar TU groups real si lo tienes
      // =========================
      const elevators = client.elevators || [];

      for (const el of elevators) {
        const payload = {
          client_id: client.id,
          tower_name: el.tower_name || null,
          index_number: el.index_number,
          elevator_number: el.elevator_number,
          floors: el.floors,
          capacity_kg: el.capacity_kg,
          capacity_persons: el.capacity_persons,
          brand: el.brand,
          model: el.model
        };

        if (el.id) {
          formIds.push(el.id);

          await supabase
            .from('elevators')
            .update(payload)
            .eq('id', el.id);
        } else {
          const { data } = await supabase
            .from('elevators')
            .insert(payload)
            .select()
            .single();

          if (data) formIds.push(data.id);
        }
      }

      // =========================
      // 4. DELETE REMOVED
      // =========================
      const toDelete = existingIds.filter(id => !formIds.includes(id));

      if (toDelete.length > 0) {
        await supabase
          .from('elevators')
          .delete()
          .in('id', toDelete);
      }

      onSuccess?.();

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Editar Cliente</h2>

      <button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}

// 🔥 MUY IMPORTANTE (SOLUCIONA TU ERROR)
export default ClientForm;