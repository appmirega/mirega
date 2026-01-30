import { useState } from 'react';
import { X, Camera, Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  elevator: {
    id: string;
    location_name: string;
    serial_number: string;
    clients: {
      company_name: string;
      building_name: string;
    };
  };
  onClose: () => void;
}

interface PartFormData {
  part_name: string;
  part_type: string;
  manufacturer: string;
  model: string;
  specifications: string;
  quantity: number;
  photos: string[];
  installation_date: string;
  expected_lifetime_years: number;
  supplier: string;
  warranty_months: number;
  condition_status: string;
  notes: string;
}

const PART_TYPES = [
  'Motor', 'Tarjeta de Control', 'Contactor', 'Limitador de Velocidad',
  'Regulador', 'Polea', 'Roldana', 'Cable de Tracción', 'Cable de Compensación',
  'Pistón', 'Válvula', 'Botonera', 'Display', 'Sensor', 'Encoder',
  'Fotocélula', 'Puerta', 'Operador de Puerta', 'Guía', 'Zapata',
  'Amortiguador', 'Otro'
];

const CONDITION_STATUS = [
  { value: 'excellent', label: 'Excelente' },
  { value: 'good', label: 'Bueno' },
  { value: 'fair', label: 'Regular' },
  { value: 'poor', label: 'Malo' },
  { value: 'critical', label: 'Crítico' }
];

export function ManualPartsManagementForm({ elevator, onClose }: Props) {
  const { user } = useAuth();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const [partForm, setPartForm] = useState<PartFormData>({
    part_name: '',
    part_type: '',
    manufacturer: '',
    model: '',
    specifications: '',
    quantity: 1,
    photos: [],
    installation_date: '',
    expected_lifetime_years: 0,
    supplier: '',
    warranty_months: 0,
    condition_status: 'good',
    notes: ''
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `elevator-parts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('maintenance-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('maintenance-photos')
        .getPublicUrl(filePath);

      setPartForm(prev => ({
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
    setPartForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleSavePart = async () => {
    if (!partForm.part_name.trim()) {
      alert('El nombre de la parte es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('elevator_specific_parts')
        .insert({
          elevator_id: elevator.id,
          part_name: partForm.part_name,
          part_type: partForm.part_type,
          manufacturer: partForm.manufacturer,
          model: partForm.model,
          quantity: partForm.quantity,
          photos: partForm.photos,
          measurements: { specifications: partForm.specifications },
          installation_date: partForm.installation_date || null,
          expected_lifetime_years: partForm.expected_lifetime_years || null,
          supplier: partForm.supplier,
          warranty_months: partForm.warranty_months || null,
          condition_status: partForm.condition_status,
          notes: partForm.notes
        });

      if (error) throw error;

      alert('Parte guardada exitosamente');

      // Reset form
      setPartForm({
        part_name: '',
        part_type: '',
        manufacturer: '',
        model: '',
        specifications: '',
        quantity: 1,
        photos: [],
        installation_date: '',
        expected_lifetime_years: 0,
        supplier: '',
        warranty_months: 0,
        condition_status: 'good',
        notes: ''
      });
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al guardar la parte: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-8">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Gestión de Partes y Piezas</h2>
              <p className="text-sm text-slate-600 mt-1">
                {elevator.location_name} - {elevator.clients.building_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Instrucciones:</strong> Completa la información de cada parte o pieza del ascensor.
              Puedes guardar múltiples partes y cerrar el formulario en cualquier momento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre de la Parte <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={partForm.part_name}
                onChange={(e) => setPartForm({ ...partForm, part_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Motor Trifásico Principal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Parte</label>
              <select
                value={partForm.part_type}
                onChange={(e) => setPartForm({ ...partForm, part_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar...</option>
                {PART_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select
                value={partForm.condition_status}
                onChange={(e) => setPartForm({ ...partForm, condition_status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {CONDITION_STATUS.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fabricante</label>
              <input
                type="text"
                value={partForm.manufacturer}
                onChange={(e) => setPartForm({ ...partForm, manufacturer: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
              <input
                type="text"
                value={partForm.model}
                onChange={(e) => setPartForm({ ...partForm, model: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                value={partForm.quantity}
                onChange={(e) => setPartForm({ ...partForm, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
              <input
                type="text"
                value={partForm.supplier}
                onChange={(e) => setPartForm({ ...partForm, supplier: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Instalación</label>
              <input
                type="date"
                value={partForm.installation_date}
                onChange={(e) => setPartForm({ ...partForm, installation_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vida Útil (años)</label>
              <input
                type="number"
                min="0"
                value={partForm.expected_lifetime_years}
                onChange={(e) => setPartForm({ ...partForm, expected_lifetime_years: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Garantía (meses)</label>
              <input
                type="number"
                min="0"
                value={partForm.warranty_months}
                onChange={(e) => setPartForm({ ...partForm, warranty_months: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Especificaciones Técnicas</label>
              <textarea
                value={partForm.specifications}
                onChange={(e) => setPartForm({ ...partForm, specifications: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Dimensiones, voltaje, potencia, etc."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Fotos</label>
              <div className="space-y-2">
                {partForm.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {partForm.photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img src={photo} alt="Parte" className="w-24 h-24 object-cover rounded border" />
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas Adicionales</label>
              <textarea
                value={partForm.notes}
                onChange={(e) => setPartForm({ ...partForm, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-xl flex gap-3">
          <button
            onClick={handleSavePart}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Guardando...' : 'Guardar Parte'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
