import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, AlertTriangle, Clock, CheckCircle, X, User } from 'lucide-react';

interface Emergency {
  id: string;
  elevator_id: string;
  reported_at: string;
  reported_by: string;
  issue_description: string;
  priority: string;
  status: string;
  assigned_technician_id?: string;
  resolution_notes?: string;
  resolved_at?: string;
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

export function EmergencyView() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [formData, setFormData] = useState({
    elevator_id: '',
    reported_by: '',
    issue_description: '',
    priority: 'medium',
    assigned_technician_id: '',
  });
  const [elevators, setElevators] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEmergencies();
    loadElevators();
    loadTechnicians();
  }, []);

  const loadEmergencies = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_visits')
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
        .order('reported_at', { ascending: false });

      if (error) throw error;
      setEmergencies(data || []);
    } catch (error) {
      console.error('Error loading emergencies:', error);
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
      const { error } = await supabase.from('emergency_visits').insert([
        {
          elevator_id: formData.elevator_id,
          reported_by: formData.reported_by,
          issue_description: formData.issue_description,
          priority: formData.priority,
          assigned_technician_id: formData.assigned_technician_id || null,
          status: 'reported',
          reported_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      alert('Emergencia reportada exitosamente');
      setFormData({
        elevator_id: '',
        reported_by: '',
        issue_description: '',
        priority: 'medium',
        assigned_technician_id: '',
      });
      setViewMode('list');
      loadEmergencies();
    } catch (error: any) {
      console.error('Error creating emergency:', error);
      alert('Error al reportar emergencia: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      reported: 'bg-red-100 text-red-800',
      assigned: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      low: 'bg-slate-100 text-slate-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return badges[priority as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      critical: 'Crtica',
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

  if (viewMode === 'create') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl font-bold text-slate-900">Reportar Emergencia</h2>
          </div>
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
        </div>
        {/* ...resto del código del formulario... */}
      </div>
    );
  }
  // ...resto del código de la vista de emergencias...
}
