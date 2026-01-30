import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, CheckCircle, Wrench, Users, Zap, HelpCircle, X } from 'lucide-react';
// ...existing code...
import { useAuth } from '../../contexts/AuthContext';

interface ClientServiceRequestFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type RequestType = 'emergency' | 'technical_visit' | 'rescue_training' | 'other';

interface FormData {
  request_type: RequestType;
  title: string;
  description: string;
  elevator_id?: string;
  priority?: 'high' | 'medium' | 'low';
  contact_phone?: string;
  contact_email?: string;
  preferred_date?: string;
  preferred_time?: string;
}

export function ClientServiceRequestForm({ onSuccess, onCancel }: ClientServiceRequestFormProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [elevators, setElevators] = useState<any[]>([]);
  const [loadingElevators, setLoadingElevators] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    request_type: 'technical_visit',
    title: '',
    description: '',
    elevator_id: '',
    priority: 'medium',
    contact_phone: profile?.phone || '',
    contact_email: profile?.email || '',
    preferred_date: '',
    preferred_time: '',
  });

  // Cargar ascensores del cliente
  const loadElevators = async () => {
    if (!profile?.id) return;
    setLoadingElevators(true);
    try {
      const { error } = await supabase
        .from('elevators')
        .select('id, identifier, building_id, buildings(name)')
        .eq('building_id', profile.id) // Asumiendo que client_id = profile.id para simplificar
        .order('identifier', { ascending: true });

      if (error) throw error;
      setElevators(data || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
    } finally {
      setLoadingElevators(false);
    }
  };

  const getRequestTypeLabel = (type: RequestType): string => {
    switch (type) {
      case 'emergency':
        return 'Emergencia';
      case 'technical_visit':
        return 'Visita Técnica';
      case 'rescue_training':
        return 'Inducción de Rescate';
      case 'other':
        return 'Otro Requerimiento';
      default:
        return 'Solicitud';
    }
  };

  const getRequestTypeIcon = (type: RequestType) => {
    switch (type) {
      case 'emergency':
        return <AlertCircle className="w-5 h-5" />;
      case 'technical_visit':
        return <Wrench className="w-5 h-5" />;
      case 'rescue_training':
        return <Users className="w-5 h-5" />;
      case 'other':
        return <HelpCircle className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const getRequestTypeColor = (type: RequestType): string => {
    switch (type) {
      case 'emergency':
        return 'bg-red-100 border-red-300 hover:bg-red-50';
      case 'technical_visit':
        return 'bg-blue-100 border-blue-300 hover:bg-blue-50';
      case 'rescue_training':
        return 'bg-green-100 border-green-300 hover:bg-green-50';
      case 'other':
        return 'bg-purple-100 border-purple-300 hover:bg-purple-50';
      default:
        return 'bg-gray-100 border-gray-300 hover:bg-gray-50';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.title.trim() || !formData.description.trim()) {
      setMessage({ type: 'error', text: 'El título y descripción son requeridos' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const { data, error } = await supabase
        .from('service_requests')
        .insert([
          {
            request_type: formData.request_type,
            title: formData.title,
            description: formData.description,
            elevator_id: formData.elevator_id || null,
            priority: formData.request_type === 'emergency' ? 'high' : formData.priority,
            status: 'created',
            contact_phone: formData.contact_phone,
            contact_email: formData.contact_email,
            preferred_date: formData.preferred_date || null,
            preferred_time: formData.preferred_time || null,
            created_by_client: true,
            created_by: session.user.id,
            client_id: profile?.id,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Solicitud de ${getRequestTypeLabel(formData.request_type).toLowerCase()} creada exitosamente`,
      });

      // Limpiar formulario
      setFormData({
        request_type: 'technical_visit',
        title: '',
        description: '',
        elevator_id: '',
        priority: 'medium',
        contact_phone: profile?.phone || '',
        contact_email: profile?.email || '',
        preferred_date: '',
        preferred_time: '',
      });

      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error al crear solicitud' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-orange-600" />
          <h2 className="text-2xl font-bold text-slate-900">Nueva Solicitud de Servicio</h2>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-300'
              : 'bg-red-50 text-red-700 border border-red-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Solicitud */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Tipo de Solicitud *
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['emergency', 'technical_visit', 'rescue_training', 'other'] as RequestType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, request_type: type })}
                className={`p-4 rounded-lg border-2 transition flex flex-col items-center gap-2 font-medium ${
                  formData.request_type === type
                    ? `${getRequestTypeColor(type)} border-current`
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                }`}
              >
                {getRequestTypeIcon(type)}
                <span className="text-xs text-center">{getRequestTypeLabel(type)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Título */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">Título de la Solicitud *</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Ej: Problema con puerta de ascensor"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">Descripción Detallada *</label>
          <textarea
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={5}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            placeholder="Describe tu solicitud en detalle..."
          />
        </div>

        {/* Ascensor (opcional) */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">Ascensor Relacionado (Opcional)</label>
          <select
            value={formData.elevator_id || ''}
            onChange={(e) => setFormData({ ...formData, elevator_id: e.target.value })}
            disabled={loadingElevators}
            onFocus={loadElevators}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Selecciona un ascensor (opcional)</option>
            {elevators.map((elevator) => (
              <option key={elevator.id} value={elevator.id}>
                {elevator.identifier} - {elevator.buildings?.name || 'Sin edificio'}
              </option>
            ))}
          </select>
        </div>

        {/* Prioridad */}
        {formData.request_type !== 'emergency' && (
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Prioridad</label>
            <select
              value={formData.priority || 'medium'}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
          </div>
        )}

        {/* Información de Contacto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Teléfono de Contacto</label>
            <input
              type="tel"
              value={formData.contact_phone || ''}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="+56 9 XXXX XXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Email de Contacto</label>
            <input
              type="email"
              value={formData.contact_email || ''}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="contacto@empresa.cl"
            />
          </div>
        </div>

        {/* Fecha y hora preferida */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Fecha Preferida</label>
            <input
              type="date"
              value={formData.preferred_date || ''}
              onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Hora Preferida</label>
            <input
              type="time"
              value={formData.preferred_time || ''}
              onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-4 pt-4 border-t border-slate-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </div>
      </form>
    </div>
  );
}
