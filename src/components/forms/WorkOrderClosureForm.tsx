import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Camera,
  Trash2,
  Check,
  X,
  AlertCircle,
  Upload,
  DollarSign,
  Pencil,
  // ...existing code...
  Shield,
  // ...existing code...
  Star,
  // ...existing code...
} from 'lucide-react';
import SignaturePad from '../common/SignaturePad';

interface WorkOrderClosureFormProps {
  workOrderId: string;
  workOrderFolio: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ...existing code...

export const WorkOrderClosureForm: React.FC<WorkOrderClosureFormProps> = ({
  workOrderId,
  workOrderFolio,
  onSuccess,
  onCancel
}) => {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados del formulario
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [actualLaborCost, setActualLaborCost] = useState<number | ''>('');
  const [actualPartsCost, setActualPartsCost] = useState<number | ''>('');
  const [actualTotalCost, setActualTotalCost] = useState<number>(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [costVariance, setCostVariance] = useState<number>(0);
  const [workWarrantyActivated, setWorkWarrantyActivated] = useState(false);
  const [partsWarrantyActivated, setPartsWarrantyActivated] = useState(false);
  const [clientRating, setClientRating] = useState<number>(0);
  const [clientFeedback, setClientFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'photos' | 'signature' | 'costs' | 'warranty' | 'feedback'>('photos');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Obtener costo estimado de la orden de trabajo
  useEffect(() => {
    loadWorkOrderCost();
  }, []);

  // Actualizar costo total cuando cambian costos parciales
  useEffect(() => {
    const labor = typeof actualLaborCost === 'number' ? actualLaborCost : 0;
    const parts = typeof actualPartsCost === 'number' ? actualPartsCost : 0;
    const total = labor + parts;
    setActualTotalCost(total);

    // Calcular varianza
    if (estimatedCost > 0) {
      const variance = ((total - estimatedCost) / estimatedCost) * 100;
      setCostVariance(Math.round(variance * 100) / 100);
    }
  }, [actualLaborCost, actualPartsCost, estimatedCost]);

  const loadWorkOrderCost = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('quotation_amount')
        .eq('id', workOrderId)
        .single();

      if (error) throw error;
      if (data?.quotation_amount) {
        setEstimatedCost(data.quotation_amount);
      }
    } catch (err) {
      console.error('Error loading work order cost:', err);
    }
  };

  // Manejo de fotos
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 10) {
      setError('Máximo 10 fotos permitidas');
      return;
    }

    setPhotos([...photos, ...files]);

    // Crear previsualizaciones
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    setError(null);
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index));
  };

  // Manejo de firma
  const handleSignatureChange = (signature: string | null) => {
    setSignatureData(signature);
  };

  // Upload de fotos a storage
  const uploadPhotos = async (): Promise<string[]> => {
    if (photos.length === 0) return [];

    const uploadedUrls: string[] = [];

    for (const file of photos) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${workOrderId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('work-order-closures')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('work-order-closures')
          .getPublicUrl(fileName);

        uploadedUrls.push(data.publicUrl);
      } catch (err) {
        console.error('Error uploading photo:', err);
      }
    }

    return uploadedUrls;
  };

  // Generar PDF (simulado - en producción usarías una librería como jsPDF)
  const generatePDF = async (photosUrls: string[]): Promise<string | null> => {
    // Placeholder - en producción integrar con jsPDF o similar
    // Por ahora retorna null, pero en el closure se guarda como documento
    return null;
  };

  // Guardar cierre de orden
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.id) {
      setError('Usuario no autenticado');
      return;
    }

    if (typeof actualLaborCost !== 'number' || typeof actualPartsCost !== 'number') {
      setError('Por favor ingrese los costos de mano de obra y repuestos');
      return;
    }

    if (!signatureData) {
      setError('Por favor firme el documento');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Upload de fotos
      setUploading(true);
      const photoUrls = await uploadPhotos();
      setUploading(false);

      // Generar PDF (placeholder)
      const pdfUrl = await generatePDF(photoUrls);

      // Insertar en work_order_closures
      const { error: closureError } = await supabase
        .from('work_order_closures')
        .insert({
          work_order_id: workOrderId,
          closed_by: profile.id,
          completion_date: new Date().toISOString(),
          photos_urls: photoUrls,
          signature_data: signatureData,
          technician_notes: technicianNotes,
          actual_labor_cost: actualLaborCost,
          actual_parts_cost: actualPartsCost,
          actual_total_cost: actualTotalCost,
          cost_variance_percentage: costVariance,
          work_warranty_activated: workWarrantyActivated,
          parts_warranty_activated: partsWarrantyActivated,
          client_rating: clientRating > 0 ? clientRating : null,
          client_feedback: clientFeedback || null,
          closure_pdf_url: pdfUrl,
          closure_pdf_generated_at: pdfUrl ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (closureError) throw closureError;

      // Actualizar estado de work_order a 'completed'
      const { error: updateError } = await supabase
        .from('work_orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', workOrderId);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err) {
      console.error('Error closing work order:', err);
      setError('Error al guardar el cierre de la orden. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <Check className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">¡Orden Cerrada!</h3>
          <p className="text-slate-600 mb-4">{workOrderFolio}</p>
          <p className="text-sm text-slate-500">La orden ha sido cerrada exitosamente con todos los documentos guardados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Cierre de Orden</h2>
              <p className="text-sm text-slate-600 mt-1">{workOrderFolio}</p>
            </div>
            <button
              onClick={onCancel}
              disabled={loading}
              className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Mensajes de error */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {/* Tabs de navegación */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'photos' as const, label: 'Fotos', icon: Camera },
            { id: 'signature' as const, label: 'Firma', icon: Pencil },
            { id: 'costs' as const, label: 'Costos', icon: DollarSign },
            { id: 'warranty' as const, label: 'Garantías', icon: Shield },
            { id: 'feedback' as const, label: 'Evaluación', icon: Star }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* TAB 1: FOTOS */}
          {activeTab === 'photos' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Fotos del Trabajo ({photos.length}/10)
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Cargue fotos del trabajo completado. Máximo 10 fotos.
                </p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photos.length >= 10}
                  className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 transition disabled:opacity-50 flex items-center justify-center gap-2 text-slate-600"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Subiendo...' : 'Seleccionar Fotos'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  disabled={photos.length >= 10}
                  className="hidden"
                />
              </div>

              {/* Previsualización de fotos */}
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {photoPreviews.map((preview, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={preview}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photos.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Camera className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm">No hay fotos seleccionadas</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FIRMA */}
          {activeTab === 'signature' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Firma Digital *
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Firme en el recuadro para confirmar que el trabajo ha sido completado.
                </p>

                <SignaturePad
                  onSignatureChange={handleSignatureChange}
                  height={200}
                  disabled={loading}
                />
              </div>

              {/* Notas del técnico */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Notas del Técnico
                </label>
                <textarea
                  value={technicianNotes}
                  onChange={(e) => setTechnicianNotes(e.target.value)}
                  placeholder="Describa el trabajo realizado, observaciones, recomendaciones..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* TAB 3: COSTOS */}
          {activeTab === 'costs' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Presupuesto Estimado</h4>
                <p className="text-sm text-blue-800">
                  ${estimatedCost.toLocaleString('es-CL')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Costo de Mano de Obra *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={actualLaborCost}
                      onChange={(e) => setActualLaborCost(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="0"
                      min="0"
                      step="1000"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Costo de Repuestos *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={actualPartsCost}
                      onChange={(e) => setActualPartsCost(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="0"
                      min="0"
                      step="1000"
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Resumen de costos */}
              <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Costo Total:</span>
                  <span className="font-bold text-slate-900">${actualTotalCost.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Varianza:</span>
                  <span className={`font-bold ${costVariance > 0 ? 'text-red-600' : costVariance < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                    {costVariance > 0 ? '+' : ''}{costVariance}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GARANTÍAS */}
          {activeTab === 'warranty' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 transition">
                  <input
                    type="checkbox"
                    checked={workWarrantyActivated}
                    onChange={(e) => setWorkWarrantyActivated(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Activar Garantía de Trabajo</p>
                    <p className="text-xs text-slate-500">Confirma que el trabajo realizado está garantizado</p>
                  </div>
                  <Shield className={`w-5 h-5 ${workWarrantyActivated ? 'text-green-600' : 'text-slate-400'}`} />
                </label>

                <label className="flex items-center gap-3 p-4 border-2 border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 transition">
                  <input
                    type="checkbox"
                    checked={partsWarrantyActivated}
                    onChange={(e) => setPartsWarrantyActivated(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Activar Garantía de Repuestos</p>
                    <p className="text-xs text-slate-500">Confirma que los repuestos están garantizados</p>
                  </div>
                  <Shield className={`w-5 h-5 ${partsWarrantyActivated ? 'text-green-600' : 'text-slate-400'}`} />
                </label>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">💡 Información de Garantías</p>
                <p className="text-xs">Indique si los periodos de garantía especificados en la orden deben ser activados. El cliente será notificado de las fechas de vencimiento.</p>
              </div>
            </div>
          )}

          {/* TAB 5: EVALUACIÓN */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Calificación del Cliente
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Seleccione una calificación (opcional)
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setClientRating(clientRating === rating ? 0 : rating)}
                      className={`px-4 py-3 rounded-lg font-medium transition flex items-center gap-1 ${
                        clientRating >= rating
                          ? 'bg-yellow-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                      {rating}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Comentarios Adicionales
                </label>
                <textarea
                  value={clientFeedback}
                  onChange={(e) => setClientFeedback(e.target.value)}
                  placeholder="Comentarios sobre el trabajo realizado, satisfacción del cliente, etc..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || uploading || !signatureData || (typeof actualLaborCost !== 'number') || (typeof actualPartsCost !== 'number')}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Cerrar Orden
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
