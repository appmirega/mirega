import { useEffect, useState } from 'react';

interface Props {
  client?: any;
  isEditMode?: boolean;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    supabase: any;
  }
}

// 🔥 EXPORT NOMBRADO (IMPORTANTE)
export function ClientForm({ client, isEditMode, onSuccess }: Props) {
  const [formData, setFormData] = useState<any>({
    name: '',
    rut: '',
    address: '',
    region: '',
    comuna: '',
    contact_name: '',
    contact_phone: '',
    contact_email: ''
  });

  const [groups, setGroups] = useState<any[]>([]);
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    if (window.supabase) {
      setSupabase(window.supabase);
    } else {
      console.error('Supabase no disponible');
    }
  }, []);

  useEffect(() => {
    if (!supabase || !isEditMode || !client) return;

    const loadClientData = async () => {
      setFormData({
        name: client.name || '',
        rut: client.rut || '',
        address: client.address || '',
        region: client.region || '',
        comuna: client.comuna || '',
        contact_name: client.contact_name || '',
        contact_phone: client.contact_phone || '',
        contact_email: client.contact_email || ''
      });

      const { data: elevators } = await supabase
        .from('elevators')
        .select('*')
        .eq('client_id', client.id);

      if (!elevators) return;

      const groupsMap: any = {};

      elevators.forEach((e: any) => {
        const tower = e.tower_name || 'default';

        if (!groupsMap[tower]) {
          groupsMap[tower] = {
            tower_name: tower === 'default' ? '' : tower,
            elevators: []
          };
        }

        groupsMap[tower].elevators.push(e);
      });

      setGroups(Object.values(groupsMap));
    };

    loadClientData();
  }, [supabase, isEditMode, client]);

  const handleSubmit = async () => {
    if (!supabase || !client) return;

    try {
      await supabase
        .from('clients')
        .update(formData)
        .eq('id', client.id);

      const { data: existing } = await supabase
        .from('elevators')
        .select('id')
        .eq('client_id', client.id);

      const existingIds = existing?.map((e: any) => e.id) || [];
      const formIds: string[] = [];

      for (const group of groups) {
        for (const el of group.elevators) {
          const payload = {
            client_id: client.id,
            tower_name: group.tower_name || null,
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
      }

      const toDelete = existingIds.filter(id => !formIds.includes(id));

      if (toDelete.length) {
        await supabase
          .from('elevators')
          .delete()
          .in('id', toDelete);
      }

      onSuccess?.();

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <h2>Editar Cliente</h2>
      <button onClick={handleSubmit}>Guardar</button>
    </div>
  );
}