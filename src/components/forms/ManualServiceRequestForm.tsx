import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Building2, Wrench, Package, HelpCircle, AlertCircle, Camera } from 'lucide-react';
import { createServiceRequest } from '../../lib/serviceRequestsService';
import type { Priority, RequestType } from '../../types/serviceRequests';

interface ManualServiceRequestFormProps {
  onClose: () => void;
  onSuccess?: (requestId?: string) => void;
  forcedPriority?: Priority;
  prefilledClientId?: string;
  prefilledElevatorId?: string;
}

interface Client {
  id: string;
  company_name: string;
  building_name: string;
  internal_alias: string;
}

interface Elevator {
  id: string;
  elevator_number: string;
  location_name: string;
  client_id: string;
}

export function ManualServiceRequestForm({ 
  onClose, 
  onSuccess, 
  forcedPriority,
  prefilledClientId,
  prefilledElevatorId
}: ManualServiceRequestFormProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [filteredElevators, setFilteredElevators] = useState<Elevator[]>([]);

  const [formData, setFormData] = useState({
    clientId: prefilledClientId || '',
    elevatorId: prefilledElevatorId || '',
    requestType: 'repair' as RequestType,
    priority: (forcedPriority || 'medium') as Priority,
    title: '',
    description: '',
  });
  const [photo1, setPhoto1] = useState<string | null>(null);
  const [photo2, setPhoto2] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<1 | 2 | null>(null);

  useEffect(() => {
    loadClients();
    loadElevators();
  }, []);

  useEffect(() => {
    if (formData.clientId) {
      const filtered = elevators.filter(e => e.client_id === formData.clientId);
      setFilteredElevators(filtered);
    } else {
      setFilteredElevators([]);
    }
  }, [formData.clientId, elevators]);

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, building_name, internal_alias')
      .order('internal_alias');
    if (data) setClients(data);
  };

  const loadElevators = async () => {
    const { data } = await supabase
      .from('elevators')
      .select('id, elevator_number, location_name, client_id')
      .order('elevator_number');
    if (data) setElevators(data);
  };

  const handlePhotoUpload = async (file: File, photoNumber: 1 | 2) => {
    if (!file) return;

    // Validar tipo y tamaño
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar 5MB');
      return;
    }

    setUploadingPhoto(photoNumber);
    try {
      const fileName = `manual-request-${Date.now()}-${photoNumber}.${file.name.split('.').pop()}`;
      const filePath = `service-requests/${fileName}`;

      const { data, error } = await supabase.storage
        .from('maintenance-photos')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('maintenance-photos')
        .getPublicUrl(filePath);

      if (photoNumber === 1) {
        setPhoto1(publicUrl);
      } else {
        setPhoto2(publicUrl);
      }
    } catch (error) {
      console.error('Error subiendo foto:', error);
      alert('Error al subir la foto');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    if (!formData.title.trim()) {
      alert('El título es obligatorio');
      return;
    }

    if (!photo1 || !photo2) {
      alert('Debes subir ambas fotos obligatorias');
      return;
    }

    setLoading(true);
    try {
      const result = await createServiceRequest({
        request_type: formData.requestType,
        source_type: 'manual',
        source_id: null,
        elevator_id: formData.elevatorId,
        client_id: formData.clientId,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        created_by_technician_id: profile.id,
        photo_1_url: photo1,
        photo_2_url: photo2,
      });

      if (result.success && result.data) {
        alert('✅ Solicitud creada exitosamente');
        if (onSuccess) {
          onSuccess(result.data.id);
        }
        onClose();
      } else {
        throw new Error('Error al crear solicitud');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al crear la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const requestTypes = [
    { value: 'repair', label: 'Reparación', icon: Wrench, color: 'text-red-600' },
    { value: 'parts', label: 'Repuestos', icon: Package, color: 'text-blue-600' },
    { value: 'support', label: 'Soporte Técnico', icon: HelpCircle, color: 'text-purple-600' },
    { value: 'inspection', label: 'Inspección', icon: AlertCircle, color: 'text-orange-600' },
  ];

  const priorities = [
    { value: 'low', label: 'Baja', color: 'bg-gray-100 text-gray-700' },
    { value: 'medium', label: 'Media', color: 'bg-blue-100 text-blue-700' },
    { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
    { value: 'critical', label: 'Crítica', color: 'bg-red-100 text-red-700' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Nueva Solicitud Manual</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-4 h-4 inline mr-1" />
              Cliente *
            </label>
            <select
              required
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value, elevatorId: '' })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.internal_alias} - {client.company_name || client.building_name}
                </option>
              ))}
            </select>
          </div>

          {/* Ascensor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ascensor *
            </label>
            <select
              required
              value={formData.elevatorId}
              onChange={(e) => setFormData({ ...formData, elevatorId: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={!formData.clientId}
            >
              <option value="">Seleccionar ascensor...</option>
              {filteredElevators.map(elevator => (
                <option key={elevator.id} value={elevator.id}>
                  Ascensor {elevator.elevator_number} - {elevator.location_name}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Solicitud */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Solicitud *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {requestTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, requestType: type.value as RequestType })}
                  className={`p-4 border-2 rounded-lg flex items-center gap-3 transition ${
                    formData.requestType === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <type.icon className={`w-5 h-5 ${type.color}`} />
                  <span className="font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Prioridad *
            </label>
            {forcedPriority && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Prioridad automática: <span className="font-bold">CRÍTICA</span>
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Se asigna automáticamente porque el ascensor quedó detenido
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {priorities.map(priority => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => !forcedPriority && setFormData({ ...formData, priority: priority.value as Priority })}
                  disabled={!!forcedPriority}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                    formData.priority === priority.value
                      ? priority.color + ' ring-2 ring-offset-2'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } ${
                    forcedPriority ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {priority.label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título (Opcional)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Cambio de roldanas de puerta"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Si no se especifica, se generará automáticamente
            </p>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe el problema, repuesto necesario, o tipo de apoyo requerido..."
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Fotos Obligatorias */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <Camera className="w-4 h-4 inline mr-1" />
              Evidencia Fotográfica (2 fotos obligatorias) *
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Foto 1 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Foto 1 *</label>
                {photo1 ? (
                  <div className="relative">
                    <img src={photo1} alt="Foto 1" className="w-full h-40 object-cover rounded-lg border-2 border-green-500" />
                    <button
                      type="button"
                      onClick={() => setPhoto1(null)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 cursor-pointer transition">
                    {uploadingPhoto === 1 ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">Subir foto</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], 1)}
                      className="hidden"
                      disabled={uploadingPhoto === 1}
                    />
                  </label>
                )}
              </div>

              {/* Foto 2 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Foto 2 *</label>
                {photo2 ? (
                  <div className="relative">
                    <img src={photo2} alt="Foto 2" className="w-full h-40 object-cover rounded-lg border-2 border-green-500" />
                    <button
                      type="button"
                      onClick={() => setPhoto2(null)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 cursor-pointer transition">
                    {uploadingPhoto === 2 ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">Subir foto</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], 2)}
                      className="hidden"
                      disabled={uploadingPhoto === 2}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
