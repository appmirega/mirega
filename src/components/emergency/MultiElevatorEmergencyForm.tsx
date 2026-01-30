import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Save,
  AlertCircle,
  Clock,
  Building2,
  Wrench,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { EmergencyPhotoCapture } from './EmergencyPhotoCapture';
import { EmergencySignature } from './EmergencySignature';

interface Elevator {
  id: string;
  internal_code: string;
  location: string;
}

interface EmergencyFormData {
  elevator_id: string;
  initial_status: 'stopped' | 'running';
  failure_details: string;
  before_photos: File[];
  final_status: 'operational' | 'under_observation' | 'stopped';
  observations: string;
  after_photos: File[];
  requires_parts: boolean;
  requires_repair: boolean;
  requires_technician_support: boolean;
  support_details: string;
}

interface MultiElevatorEmergencyFormProps {
  visitId: string;
  clientId: string;
  buildingName: string;
  buildingAddress: string;
  elevatorsInFailure: string[];
  availableElevators: Elevator[];
  onComplete: () => void;
  onCancel: () => void;
}

export function MultiElevatorEmergencyForm({
  visitId,
  clientId,
  buildingName,
  buildingAddress,
  elevatorsInFailure,
  availableElevators,
  onComplete,
  onCancel,
}: MultiElevatorEmergencyFormProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedReports, setCompletedReports] = useState<string[]>([]);
  const [showSignature, setShowSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [formData, setFormData] = useState<EmergencyFormData>({
    elevator_id: elevatorsInFailure[0],
    initial_status: 'stopped',
    failure_details: '',
    before_photos: [],
    final_status: 'operational',
    observations: '',
    after_photos: [],
    requires_parts: false,
    requires_repair: false,
    requires_technician_support: false,
    support_details: '',
  });

  const currentElevator = availableElevators.find((e) => e.id === formData.elevator_id);
  const totalElevators = elevatorsInFailure.length;
  const isLastElevator = currentIndex === totalElevators - 1;

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      handleAutoSave();
    }, 30000);

    return () => clearInterval(interval);
  }, [formData]);

  const handleAutoSave = async () => {
    try {
      await supabase
        .from('emergency_v2_visits')
        .update({ last_saved_at: new Date().toISOString() })
        .eq('id', visitId);

      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  };

  const uploadPhoto = async (file: File, reportId: string, type: 'before' | 'after', order: number) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${reportId}_${type}_${order}.${fileExt}`;
    const filePath = `${clientId}/${visitId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('emergency-photos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('emergency-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmitReport = async () => {
    if (!formData.failure_details.trim()) {
      alert('Por favor ingrese los detalles de la falla');
      return;
    }

    if (formData.before_photos.length < 2) {
      alert('Se requieren 2 fotos del estado inicial');
      return;
    }

    if (!formData.observations.trim()) {
      alert('Por favor ingrese las observaciones finales');
      return;
    }

    if (formData.after_photos.length < 2) {
      alert('Se requieren 2 fotos del estado final');
      return;
    }

    setSaving(true);

    try {
      const { data: report, error: reportError } = await supabase
        .from('emergency_v2_reports')
        .insert({
          visit_id: visitId,
          elevator_id: formData.elevator_id,
          report_number: '',
          initial_status: formData.initial_status,
          failure_details: formData.failure_details,
          final_status: formData.final_status,
          observations: formData.observations,
          requires_parts: formData.requires_parts,
          requires_repair: formData.requires_repair,
          requires_technician_support: formData.requires_technician_support,
          support_details: formData.support_details || null,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (reportError) throw reportError;

      for (let i = 0; i < formData.before_photos.length; i++) {
        const url = await uploadPhoto(formData.before_photos[i], report.id, 'before', i + 1);
        await supabase.from('emergency_v2_photos').insert({
          report_id: report.id,
          photo_type: 'before',
          photo_url: url,
          photo_order: i + 1,
        });
      }

      for (let i = 0; i < formData.after_photos.length; i++) {
        const url = await uploadPhoto(formData.after_photos[i], report.id, 'after', i + 1);
        await supabase.from('emergency_v2_photos').insert({
          report_id: report.id,
          photo_type: 'after',
          photo_url: url,
          photo_order: i + 1,
        });
      }

      if (formData.requires_technician_support) {
        await supabase.from('emergency_v2_support_requests').insert({
          report_id: report.id,
          requesting_technician_id: user?.id,
          request_reason: formData.support_details || 'Solicitud de apoyo técnico',
          status: 'pending',
        });
      }

      setCompletedReports([...completedReports, formData.elevator_id]);

      if (isLastElevator) {
        setShowSignature(true);
      } else {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setFormData({
          elevator_id: elevatorsInFailure[nextIndex],
          initial_status: 'stopped',
          failure_details: '',
          before_photos: [],
          final_status: 'operational',
          observations: '',
          after_photos: [],
          requires_parts: false,
          requires_repair: false,
          requires_technician_support: false,
          support_details: '',
        });
      }

      await handleAutoSave();
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Error al guardar el reporte');
    } finally {
      setSaving(false);
    }
  };

  const handleSignature = async (signatureName: string, signatureDataURL: string) => {
    setSaving(true);

    try {
      const blob = await (await fetch(signatureDataURL)).blob();
      const file = new File([blob], `signature_${visitId}.png`, { type: 'image/png' });

      const filePath = `${clientId}/${visitId}/signature.png`;
      const { error: uploadError } = await supabase.storage
        .from('emergency-signatures')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('emergency-signatures')
        .getPublicUrl(filePath);

      await supabase
        .from('emergency_v2_visits')
        .update({
          signature_name: signatureName,
          signature_url: publicUrl,
          end_time: new Date().toISOString(),
          status: 'completed',
          current_elevator_index: totalElevators,
        })
        .eq('id', visitId);

      onComplete();
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Error al guardar la firma');
    } finally {
      setSaving(false);
    }
  };

  if (showSignature) {
    return (
      <EmergencySignature
        onSave={handleSignature}
        onCancel={() => setShowSignature(false)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h1 className="text-2xl font-bold text-gray-900">Visita de Emergencia</h1>
          </div>
          {lastSaved && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Guardado {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-gray-600">Edificio</p>
              <p className="font-medium text-gray-900">{buildingName}</p>
              <p className="text-gray-500">{buildingAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Wrench className="h-4 w-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-gray-600">Ascensores en Falla</p>
              <p className="font-medium text-gray-900">{totalElevators} ascensores</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Progreso</h2>
          <span className="text-sm text-gray-600">
            {completedReports.length} de {totalElevators} completados
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(completedReports.length / totalElevators) * 100}%` }}
          />
        </div>
      </div>

      {/* Current Elevator Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-medium">Ascensor Actual</p>
            <p className="text-lg font-bold text-blue-900">
              {currentElevator?.internal_code} - {currentElevator?.location}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-600">Reporte</p>
            <p className="text-lg font-bold text-blue-900">
              {currentIndex + 1} / {totalElevators}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        {/* Estado Inicial */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estado Inicial del Ascensor *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="stopped"
                checked={formData.initial_status === 'stopped'}
                onChange={(e) =>
                  setFormData({ ...formData, initial_status: e.target.value as any })
                }
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Detenido</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="running"
                checked={formData.initial_status === 'running'}
                onChange={(e) =>
                  setFormData({ ...formData, initial_status: e.target.value as any })
                }
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Funcionando</span>
            </label>
          </div>
        </div>

        {/* Detalles de Falla */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Detalles de la Falla *
          </label>
          <textarea
            value={formData.failure_details}
            onChange={(e) => setFormData({ ...formData, failure_details: e.target.value })}
            rows={4}
            placeholder="Describa detalladamente la falla encontrada..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Fotos Estado Inicial */}
        <EmergencyPhotoCapture
          photoType="before"
          requiredPhotos={2}
          onPhotosChange={(photos) => setFormData({ ...formData, before_photos: photos })}
          existingPhotos={formData.before_photos}
        />

        {/* Estado Final */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estado Final del Ascensor *
          </label>
          <select
            value={formData.final_status}
            onChange={(e) =>
              setFormData({ ...formData, final_status: e.target.value as any })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="operational">Operativo</option>
            <option value="under_observation">En Observación (15 días)</option>
            <option value="stopped">Detenido</option>
          </select>

          {formData.final_status === 'under_observation' && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Observación:</strong> El ascensor quedará en observación por 15 días. Si
                ocurre una nueva emergencia, deberá cerrarse con un resultado concreto.
              </p>
            </div>
          )}

          {formData.final_status === 'stopped' && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Detenido:</strong> El ascensor queda fuera de servicio. Debe indicar si
                requiere repuestos, reparación o apoyo técnico.
              </p>
            </div>
          )}
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones Finales *
          </label>
          <textarea
            value={formData.observations}
            onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
            rows={4}
            placeholder="Describa el trabajo realizado y las observaciones finales..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Fotos Estado Final */}
        <EmergencyPhotoCapture
          photoType="after"
          requiredPhotos={2}
          onPhotosChange={(photos) => setFormData({ ...formData, after_photos: photos })}
          existingPhotos={formData.after_photos}
        />

        {/* Solicitudes Especiales */}
        {(formData.final_status === 'stopped' || formData.final_status === 'under_observation') && (
          <div className="border border-gray-300 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Solicitudes Especiales</h3>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requires_parts}
                  onChange={(e) =>
                    setFormData({ ...formData, requires_parts: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Requiere Repuestos</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requires_repair}
                  onChange={(e) =>
                    setFormData({ ...formData, requires_repair: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Requiere Reparación</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requires_technician_support}
                  onChange={(e) =>
                    setFormData({ ...formData, requires_technician_support: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Requiere Apoyo de Otro Técnico</span>
              </label>
            </div>

            {(formData.requires_parts ||
              formData.requires_repair ||
              formData.requires_technician_support) && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detalles de la Solicitud
                </label>
                <textarea
                  value={formData.support_details}
                  onChange={(e) =>
                    setFormData({ ...formData, support_details: e.target.value })
                  }
                  rows={3}
                  placeholder="Describa los detalles de lo que se requiere..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {(formData.requires_parts || formData.requires_repair) && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Cotización Automática:</strong> Se generará automáticamente una
                  solicitud de cotización de emergencia para el administrador.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAutoSave}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Save className="h-4 w-4" />
            Guardar Avance
          </button>
          <button
            onClick={handleSubmitReport}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : isLastElevator ? (
              <>
                <Check className="h-4 w-4" />
                Finalizar y Firmar
              </>
            ) : (
              <>
                Siguiente Ascensor
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
