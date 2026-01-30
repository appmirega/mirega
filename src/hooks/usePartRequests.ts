import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface PartRequest {
  id?: string;
  elevator_id: string;
  client_id: string;
  technician_id: string;
  request_type: 'maintenance' | 'emergency' | 'repair' | 'manual';
  related_id?: string;
  part_name: string;
  part_type: string;
  manufacturer: string;
  model: string;
  specifications: any;
  quantity_needed: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  photos: string[];
  notes: string;
  status?: string;
  quotation_id?: string;
  created_at?: string;
  updated_at?: string;
}

export function usePartRequests() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savePartRequests = async (requests: Omit<PartRequest, 'id'>[]) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('part_requests')
        .insert(requests)
        .select();

      if (insertError) throw insertError;

      // También guardar en elevator_specific_parts para la base de datos de partes
      const partsToInsert = requests.map(req => ({
        elevator_id: req.elevator_id,
        part_name: req.part_name,
        part_type: req.part_type,
        manufacturer: req.manufacturer,
        model: req.model,
        specifications: req.specifications,
        quantity: req.quantity_needed,
        photos: req.photos,
        notes: req.notes,
        condition_status: 'good'
      }));

      await supabase
        .from('elevator_specific_parts')
        .insert(partsToInsert);

      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPartRequestsByElevator = async (elevatorId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('part_requests')
        .select(`
          *,
          technician:profiles!part_requests_technician_id_fkey(full_name, email)
        `)
        .eq('elevator_id', elevatorId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      return data;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getPartRequestsByTechnician = async (technicianId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('part_requests')
        .select(`
          *,
          elevator:elevators(location_name, serial_number),
          client:clients(company_name, building_name)
        `)
        .eq('technician_id', technicianId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      return data;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updatePartRequestStatus = async (requestId: string, status: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from('part_requests')
        .update({ status })
        .eq('id', requestId)
        .select()
        .single();

      if (updateError) throw updateError;

      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    savePartRequests,
    getPartRequestsByElevator,
    getPartRequestsByTechnician,
    updatePartRequestStatus
  };
}
