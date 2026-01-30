import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Camera, Save, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';

interface ElevatorPartsFormProps {
  elevatorId: string;
  clientId: string;
  onClose?: () => void;
  onSave?: () => void;
}

interface PartsFormData {
  control_board_model: string;
  motor_type: string;
  contactor_model: string;
  relay_types: string;
  door_operator_model: string;
  encoder_model: string;
  inverter_model: string;
  brake_type: string;
  cable_specifications: string;
  guide_rail_type: string;
  safety_gear_model: string;
  governor_model: string;
  buffer_type: string;
  additional_notes: string;
}

export function ElevatorPartsForm({ elevatorId, clientId, onClose, onSave }: ElevatorPartsFormProps) {
  const [loading, setLoading] = useState(false);
  const [existingFormId, setExistingFormId] = useState<string | null>(null);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photosPreviews, setPhotosPreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState<PartsFormData>({
    control_board_model: '',
    motor_type: '',
    contactor_model: '',
    relay_types: '',
    door_operator_model: '',
    encoder_model: '',
    inverter_model: '',
    brake_type: '',
    cable_specifications: '',
    guide_rail_type: '',
    safety_gear_model: '',
    governor_model: '',
    buffer_type: '',
    additional_notes: '',
  });

  useEffect(() => {
    loadExistingForm();
  }, [elevatorId]);

  useEffect(() => {
    calculateCompletion();
  }, [formData]);

  const loadExistingForm = async () => {
    try {
      const { data, error } = await supabase
        .from('elevator_parts_forms')
        .select('*')
        .eq('elevator_id', elevatorId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingFormId(data.id);
        setFormData({
          control_board_model: data.control_board_model || '',
          motor_type: data.motor_type || '',
          contactor_model: data.contactor_model || '',
          relay_types: data.relay_types || '',
          door_operator_model: data.door_operator_model || '',
          encoder_model: data.encoder_model || '',
          inverter_model: data.inverter_model || '',
          brake_type: data.brake_type || '',
          cable_specifications: data.cable_specifications || '',
          guide_rail_type: data.guide_rail_type || '',
          safety_gear_model: data.safety_gear_model || '',
          governor_model: data.governor_model || '',
          buffer_type: data.buffer_type || '',
          additional_notes: data.additional_notes || '',
        });
      }
    } catch (err) {
      console.error('Error loading form:', err);
    }
  };

  const calculateCompletion = () => {
    const fields = Object.keys(formData).filter(key => key !== 'additional_notes');
    const filledFields = fields.filter(key => formData[key as keyof PartsFormData].trim() !== '');
    const percentage = Math.round((filledFields.length / fields.length) * 100);
    setCompletionPercentage(percentage);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 2) {
      alert('Máximo 2 fotos permitidas');
      return;
    }

    setPhotos([...photos, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotosPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotosPreviews(photosPreviews.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const isComplete = completionPercentage === 100;

      let formId = existingFormId;

      if (existingFormId) {
        // Actualizar formulario existente
        const { error } = await supabase
          .from('elevator_parts_forms')
          .update({
            ...formData,
            is_complete: isComplete,
            completion_percentage: completionPercentage,
            last_updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFormId);

        if (error) throw error;
      } else {
        // Crear nuevo formulario
        const { data, error } = await supabase
          .from('elevator_parts_forms')
          .insert({
            elevator_id: elevatorId,
            client_id: clientId,
            ...formData,
            is_complete: isComplete,
            completion_percentage: completionPercentage,
            created_by: user.id,
            last_updated_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        formId = data.id;
        setExistingFormId(data.id);
      }

      // Subir fotos si hay
      if (photos.length > 0 && formId) {
        for (const photo of photos) {
          const fileName = `${formId}/${Date.now()}-${photo.name}`;
          const { error: uploadError } = await supabase.storage
            .from('elevator-parts-photos')
            .upload(fileName, photo);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('elevator-parts-photos')
            .getPublicUrl(fileName);

          await supabase
            .from('elevator_parts_photos')
            .insert({
              parts_form_id: formId,
              photo_url: publicUrl,
              photo_type: 'general',
              uploaded_by: user.id,
            });
        }
      }

      alert('Formulario guardado exitosamente');
      if (onSave) onSave();
      if (onClose) onClose();
    } catch (err: any) {
      console.error('Error saving form:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Formulario de Partes y Piezas</h2>
            <div className="flex items-center gap-2 mt-1">
              {completionPercentage === 100 ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-orange-600" />
              )}
              <span className="text-sm text-slate-600">
                Completitud: {completionPercentage}%
              </span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modelo de Tarjeta de Control
              </label>
              <input
                type="text"
                value={formData.control_board_model}
                onChange={(e) => setFormData({ ...formData, control_board_model: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Monarch NICE 3000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipo de Motor
              </label>
              <input
                type="text"
                value={formData.motor_type}
                onChange={(e) => setFormData({ ...formData, motor_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Motor Gearless 10HP"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modelo de Contactores
              </label>
              <input
                type="text"
                value={formData.contactor_model}
                onChange={(e) => setFormData({ ...formData, contactor_model: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Schneider LC1D80"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipos de Relés
              </label>
              <input
                type="text"
                value={formData.relay_types}
                onChange={(e) => setFormData({ ...formData, relay_types: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Omron MY4N, 24VDC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modelo de Operador de Puertas
              </label>
              <input
                type="text"
                value={formData.door_operator_model}
                onChange={(e) => setFormData({ ...formData, door_operator_model: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Fermator VVVF"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modelo de Encoder
              </label>
              <input
                type="text"
                value={formData.encoder_model}
                onChange={(e) => setFormData({ ...formData, encoder_model: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Tamagawa TS5214N141"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modelo de Inversor
              </label>
              <input
                type="text"
                value={formData.inverter_model}
                onChange={(e) => setFormData({ ...formData, inverter_model: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Yaskawa L1000A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipo de Freno
              </label>
              <input
                type="text"
                value={formData.brake_type}
                onChange={(e) => setFormData({ ...formData, brake_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Freno electromagnético 24VDC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Especificaciones de Cables
              </label>
              <input
                type="text"
                value={formData.cable_specifications}
                onChange={(e) => setFormData({ ...formData, cable_specifications: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: 6x19 IWRC, 13mm diámetro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipo de Rieles Guía
              </label>
              <input
                type="text"
                value={formData.guide_rail_type}
                onChange={(e) => setFormData({ ...formData, guide_rail_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: T70/B, maquinado"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modelo de Paracaídas
              </label>
              <input
                type="text"
                value={formData.safety_gear_model}
                onChange={(e) => setFormData({ ...formData, safety_gear_model: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Wittur SAG200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modelo de Limitador de Velocidad
              </label>
              <input
                type="text"
                value={formData.governor_model}
                onChange={(e) => setFormData({ ...formData, governor_model: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Dynatech OSG-15"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipo de Amortiguadores
              </label>
              <input
                type="text"
                value={formData.buffer_type}
                onChange={(e) => setFormData({ ...formData, buffer_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Poliuretano tipo oil buffer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notas Adicionales
            </label>
            <textarea
              value={formData.additional_notes}
              onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Información adicional relevante..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Camera className="w-4 h-4 inline mr-2" />
              Fotos (máximo 2)
            </label>
            <div className="space-y-3">
              {photosPreviews.map((preview, index) => (
                <div key={index} className="relative inline-block mr-3">
                  <img src={preview} alt={`Preview ${index + 1}`} className="w-32 h-32 object-cover rounded-lg border-2 border-slate-300" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {photos.length < 2 && (
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  Agregar Foto
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    multiple
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-4 flex justify-end gap-3">
          {onClose && (
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
