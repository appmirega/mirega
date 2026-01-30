import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, FileText, Clock, CheckCircle, X, AlertCircle } from 'lucide-react';

interface WorkOrder {
  id: string;
  elevator_id: string;
  created_at: string;
  work_type: string;
  description: string;
  status: string;
  assigned_technician_id?: string;
  priority: string;
  scheduled_date?: string;
  completed_at?: string;
  notes?: string;
  elevators?: {
    brand: string;
    model: string;
    serial_number: string;
    clients?: {
      business_name: string;
    };
  };
  profiles?: {
    full_name: string;
  };
}

type ViewMode = 'list' | 'create';

export function WorkOrdersView() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [formData, setFormData] = useState({
    elevator_id: '',
    work_type: 'maintenance',
    description: '',
    priority: 'medium',
    assigned_technician_id: '',
    scheduled_date: '',
    notes: '',
  });
  const [elevators, setElevators] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWorkOrders();
    loadElevators();
    loadTechnicians();
  }, []);

  const loadWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          elevators (
            brand,
            model,
            serial_number,
            clients (
              business_name
            )
          ),
          profiles (
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select('id, brand, model, serial_number, clients(business_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setElevators(data || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'technician')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase.from('work_orders').insert([
        {
          elevator_id: formData.elevator_id,
          work_type: formData.work_type,
          description: formData.description,
          priority: formData.priority,
          assigned_technician_id: formData.assigned_technician_id || null,
          scheduled_date: formData.scheduled_date || null,
          notes: formData.notes || null,
          status: 'pending',
        },
      ]);

      if (error) throw error;

      alert('Orden de trabajo creada exitosamente');
      setFormData({
        elevator_id: '',
        work_type: 'maintenance',
        description: '',
        priority: 'medium',
        assigned_technician_id: '',
        scheduled_date: '',
        notes: '',
      });
      setViewMode('list');
      loadWorkOrders();
    } catch (error: any) {
      console.error('Error creating work order:', error);
      alert('Error al crear orden de trabajo: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      low: 'bg-slate-100 text-slate-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return badges[priority as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getWorkTypeLabel = (type: string) => {
    const labels = {
      maintenance: 'Mantenimiento',
      repair: 'Reparacin',
      installation: 'Instalacin',
      inspection: 'Inspeccin',
      emergency: 'Emergencia',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente',
    };
    return labels[priority as keyof typeof labels] || priority;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }
  // ...resto del código de la vista de órdenes de trabajo...
}
