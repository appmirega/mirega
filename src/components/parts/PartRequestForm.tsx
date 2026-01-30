import { useState } from 'react';
import { X, Plus, Camera, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PartRequest {
  part_name: string;
  part_type: string;
  manufacturer: string;
  model: string;
  specifications: {
    dimensions?: string;
    weight?: string;
    voltage?: string;
    current?: string;
    power?: string;
    other?: string;
  };
  quantity_needed: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  photos: string[];
  notes: string;
}

interface Props {
  elevatorId: string;
  clientId: string;
  technicianId: string;
  requestType: 'maintenance' | 'emergency' | 'repair' | 'manual';
  relatedId?: string;
  onRequestsChange: (requests: PartRequest[]) => void;
  initialRequests?: PartRequest[];
}

const PART_TYPES = [
  'Motor',
  'Tarjeta de Control',
  'Contactor',
  'Limitador de Velocidad',
  'Regulador',
  'Polea',
  'Roldana',
  'Cable de Tracción',
  'Cable de Compensación',
  'Pistón',
  'Válvula',
  'Botonera',
  'Display',
  'Sensor',
  'Encoder',
  'Fotocélula',
  'Puerta',
  'Operador de Puerta',
  'Guía',
  'Zapata',
  'Amortiguador',
  'Otro'
];

const URGENCY_LABELS = {
  low: { label: 'Baja', color: 'bg-green-100 text-green-800' },
  medium: { label: 'Media', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  critical: { label: 'Crítica', color: 'bg-red-100 text-red-800' }
};

export function PartRequestForm({
  elevatorId,
  clientId,
  technicianId,
  requestType,
  relatedId,
  onRequestsChange,
  initialRequests = []
}: Props) {
  const [requests, setRequests] = useState<PartRequest[]>(initialRequests);
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<PartRequest>({
    part_name: '',
    part_type: '',
    manufacturer: '',
    model: '',
    specifications: {},
    quantity_needed: 1,
    urgency: 'medium',
    photos: [],
    notes: ''
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `part-requests/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('maintenance-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('maintenance-photos')
        .getPublicUrl(filePath);

      setCurrentRequest(prev => ({
        ...prev,
        photos: [...prev.photos, publicUrl]
      }));
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Error al subir la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    setCurrentRequest(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const addRequest = () => {
    if (!currentRequest.part_name.trim()) {
      alert('El nombre del repuesto es obligatorio');
      return;
    }

    const newRequests = [...requests, currentRequest];
    setRequests(newRequests);
    onRequestsChange(newRequests);

    setCurrentRequest({
      part_name: '',
      part_type: '',
      manufacturer: '',
      model: '',
      specifications: {},
      quantity_needed: 1,
      urgency: 'medium',
      photos: [],
      notes: ''
    });
    setShowAddForm(false);
  };

  const removeRequest = (index: number) => {
    const newRequests = requests.filter((_, i) => i !== index);
    setRequests(newRequests);
    onRequestsChange(newRequests);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Solicitar Repuestos</h3>
          <p className="text-sm text-slate-600">
            Agrega los repuestos necesarios para esta {requestType === 'maintenance' ? 'mantención' : 'emergencia'}
          </p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Agregar Repuesto
          </button>
        )}
      </div>

      {requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((request, index) => (
            <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-slate-900">{request.part_name}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${URGENCY_LABELS[request.urgency].color}`}>
                      {URGENCY_LABELS[request.urgency].label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {request.part_type && (
                      <div>
                        <span className="text-slate-500">Tipo:</span> <span className="text-slate-900">{request.part_type}</span>
                      </div>
                    )}
                    {request.manufacturer && (
                      <div>
                        <span className="text-slate-500">Fabricante:</span> <span className="text-slate-900">{request.manufacturer}</span>
                      </div>
                    )}
                    {request.model && (
                      <div>
                        <span className="text-slate-500">Modelo:</span> <span className="text-slate-900">{request.model}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Cantidad:</span> <span className="text-slate-900">{request.quantity_needed}</span>
                    </div>
                  </div>
                  {request.photos.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {request.photos.map((photo, i) => (
                        <img key={i} src={photo} alt="Repuesto" className="w-16 h-16 object-cover rounded border" />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeRequest(index)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900">Nuevo Repuesto</h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre del Repuesto <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={currentRequest.part_name}
                onChange={(e) => setCurrentRequest(prev => ({ ...prev, part_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Roldana de puerta principal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Parte</label>
              <select
                value={currentRequest.part_type}
                onChange={(e) => setCurrentRequest(prev => ({ ...prev, part_type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar...</option>
                {PART_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Urgencia</label>
              <select
                value={currentRequest.urgency}
                onChange={(e) => setCurrentRequest(prev => ({ ...prev, urgency: e.target.value as any }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fabricante</label>
              <input
                type="text"
                value={currentRequest.manufacturer}
                onChange={(e) => setCurrentRequest(prev => ({ ...prev, manufacturer: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
              <input
                type="text"
                value={currentRequest.model}
                onChange={(e) => setCurrentRequest(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                value={currentRequest.quantity_needed}
                onChange={(e) => setCurrentRequest(prev => ({ ...prev, quantity_needed: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Especificaciones y Medidas</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Dimensiones (ej: 50x30mm)"
                value={currentRequest.specifications.dimensions || ''}
                onChange={(e) => setCurrentRequest(prev => ({
                  ...prev,
                  specifications: { ...prev.specifications, dimensions: e.target.value }
                }))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Peso"
                value={currentRequest.specifications.weight || ''}
                onChange={(e) => setCurrentRequest(prev => ({
                  ...prev,
                  specifications: { ...prev.specifications, weight: e.target.value }
                }))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Voltaje"
                value={currentRequest.specifications.voltage || ''}
                onChange={(e) => setCurrentRequest(prev => ({
                  ...prev,
                  specifications: { ...prev.specifications, voltage: e.target.value }
                }))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Corriente"
                value={currentRequest.specifications.current || ''}
                onChange={(e) => setCurrentRequest(prev => ({
                  ...prev,
                  specifications: { ...prev.specifications, current: e.target.value }
                }))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Potencia"
                value={currentRequest.specifications.power || ''}
                onChange={(e) => setCurrentRequest(prev => ({
                  ...prev,
                  specifications: { ...prev.specifications, power: e.target.value }
                }))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Otro"
                value={currentRequest.specifications.other || ''}
                onChange={(e) => setCurrentRequest(prev => ({
                  ...prev,
                  specifications: { ...prev.specifications, other: e.target.value }
                }))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Fotos del Repuesto</label>
            <div className="space-y-2">
              {currentRequest.photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentRequest.photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img src={photo} alt="Repuesto" className="w-24 h-24 object-cover rounded border" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 cursor-pointer">
                <Camera className="w-4 h-4" />
                {uploadingPhoto ? 'Subiendo...' : 'Agregar Foto'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas / Observaciones</label>
            <textarea
              value={currentRequest.notes}
              onChange={(e) => setCurrentRequest(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Información adicional sobre el repuesto..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addRequest}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Agregar Repuesto
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {requests.length === 0 && !showAddForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-600 text-sm">
            No se han agregado repuestos. Haz clic en "Agregar Repuesto" si necesitas solicitar alguno.
          </p>
        </div>
      )}
    </div>
  );
}
