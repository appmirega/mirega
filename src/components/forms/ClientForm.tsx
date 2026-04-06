import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface Props {
  client?: any;
  isEditMode?: boolean;
  onSuccess?: () => void;
}

export default function ClientForm({ client, isEditMode, onSuccess }: Props) {
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

  useEffect(() => {
    const loadClientData = async () => {
      if (!isEditMode || !client) return;

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

      const { data: elevators, error } = await supabase
        .from('elevators')
        .select('*')
        .eq('client_id', client.id)
        .order('elevator_number', { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      const groupsMap: Record<string, any> = {};

      elevators?.forEach((elevator: any) => {
        const tower = elevator.tower_name || 'default';

        if (!groupsMap[tower]) {
          groupsMap[tower] = {
            tower_name: tower === 'default' ? '' : tower,
            elevators: []
          };
        }

        groupsMap[tower].elevators.push({
          id: elevator.id,
          index_number: elevator.index_number,
          elevator_number: elevator.elevator_number,
          floors: elevator.floors || '',
          capacity_kg: elevator.capacity_kg || '',
          capacity_persons: elevator.capacity_persons || '',
          brand: elevator.brand || '',
          model: elevator.model || '',
          serial_number: elevator.serial_number || '',
          installation_year: elevator.installation_year || ''
        });
      });

      setGroups(Object.values(groupsMap));
    };

    loadClientData();
  }, [isEditMode, client]);

  const handleSubmit = async () => {
    try {
      if (isEditMode && client) {
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
              model: el.model,
              serial_number: el.serial_number,
              installation_year: el.installation_year
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

        if (toDelete.length > 0) {
          await supabase
            .from('elevators')
            .delete()
            .in('id', toDelete);
        }
      }

      onSuccess?.();

    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <h2>{isEditMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>

      <button onClick={handleSubmit}>
        Guardar
      </button>
    </div>
  );
}