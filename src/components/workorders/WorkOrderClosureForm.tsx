import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import SignatureCanvas from 'react-signature-canvas';
import { X, Save, FileText } from 'lucide-react';
import { WorkOrderPhotoCapture } from './WorkOrderPhotoCapture';

interface WorkOrder {
  id: string;
  folio_number: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  client: {
    company_name: string;
  };
  assigned_technician: {
    full_name: string;
  };
  elevator?: {
    brand: string;
    model: string;
    location_name: string;
  };
}

interface WorkOrderClosureFormProps {
  workOrder: WorkOrder;
  onComplete: () => void;
  onCancel: () => void;
}

export function WorkOrderClosureForm({
  workOrder,
  onComplete,
  onCancel,
}: WorkOrderClosureFormProps) {
  const { profile } = useAuth();
  const [photos, setPhotos] = useState<{ [key: number]: File }>({});
  const [signerName, setSignerName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const signaturePadRef = useRef<SignatureCanvas>(null);

  const closureDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handlePhotoCapture = (photoNumber: number, file: File) => {
    setPhotos((prev) => ({ ...prev, [photoNumber]: file }));
  };

  const handleRemovePhoto = (photoNumber: number) => {
    setPhotos((prev) => {
      const newPhotos = { ...prev };
      delete newPhotos[photoNumber];
      return newPhotos;
    });
  };

  const clearSignature = () => {
    signaturePadRef.current?.clear();
  };

  const uploadPhoto = async (file: File, closureId: string, photoOrder: number) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${closureId}/${photoOrder}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('work-order-photos')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from('work-order-photos').getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Object.keys(photos).length === 0) {
      alert('Debes capturar al menos 1 foto');
      return;
    }

    if (!signerName.trim()) {
      alert('Debes ingresar el nombre del firmante');
      return;
    }

    if (signaturePadRef.current?.isEmpty()) {
      alert('Debes firmar el documento');
      return;
    }

    setLoading(true);

    try {
      const signatureData = signaturePadRef.current?.toDataURL();

      const { data: closure, error: closureError } = await supabase
        .from('work_order_closures')
        .insert({
          work_order_id: workOrder.id,
          closed_by_technician_id: profile?.id,
          closure_date: new Date().toISOString().split('T')[0],
          signer_name: signerName,
          signature_data: signatureData,
          notes: notes || null,
        })
        .select()
        .single();

      if (closureError) throw closureError;

      for (const [photoNumber, file] of Object.entries(photos)) {
        const photoUrl = await uploadPhoto(file, closure.id, parseInt(photoNumber));

        await supabase.from('work_order_closure_photos').insert({
          closure_id: closure.id,
          photo_url: photoUrl,
          photo_order: parseInt(photoNumber),
        });
      }

      await supabase.from('notifications').insert({
        type: 'work_order_closed',
        title: 'Orden de Trabajo Cerrada',
        message: `La OT #${workOrder.folio_number} - ${workOrder.title} ha sido cerrada`,
        metadata: {
          work_order_id: workOrder.id,
          closure_id: closure.id,
          client_name: workOrder.client.company_name,
        },
        created_at: new Date().toISOString(),
      });

      alert('Orden de trabajo cerrada exitosamente');
      onComplete();
    } catch (error: any) {
      console.error('Error closing work order:', error);
      alert(error.message || 'Error al cerrar la orden de trabajo');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      case 'low':
        return 'Baja';
      default:
        return priority;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cierre de Orden de Trabajo</h2>
          <p className="text-slate-600 mt-1">OT #{workOrder.folio_number}</p>
        </div>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Información de la OT
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-blue-700 font-medium">Cliente</p>
            <p className="text-blue-900 font-semibold">{workOrder.client.company_name}</p>
          </div>
          <div>
            <p className="text-sm text-blue-700 font-medium">Técnico Asignado</p>
            <p className="text-blue-900">{workOrder.assigned_technician.full_name}</p>
          </div>
          {workOrder.elevator && (
            <div>
              <p className="text-sm text-blue-700 font-medium">Ascensor</p>
              <p className="text-blue-900">
                {workOrder.elevator.brand} {workOrder.elevator.model} -{' '}
                {workOrder.elevator.location_name}
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-blue-700 font-medium">Prioridad</p>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(
                workOrder.priority
              )}`}
            >
              {getPriorityLabel(workOrder.priority)}
            </span>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-blue-700 font-medium">Título</p>
            <p className="text-blue-900 font-semibold">{workOrder.title}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-blue-700 font-medium">Descripción</p>
            <p className="text-blue-900">{workOrder.description}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Fecha de Cierre</h3>
          <p className="text-lg text-slate-700">{closureDate}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Fotografías (Mínimo 1, Máximo 4)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((num) => (
              <WorkOrderPhotoCapture
                key={num}
                photoNumber={num}
                onPhotoCapture={handlePhotoCapture}
                onRemovePhoto={handleRemovePhoto}
                capturedPhoto={photos[num] || null}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <label className="block font-bold text-slate-900 mb-2">
            Notas Adicionales (Opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ingresa observaciones o notas adicionales sobre el cierre..."
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <label className="block font-bold text-slate-900 mb-2">
            Nombre del Firmante <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Nombre completo del firmante"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block font-bold text-slate-900">
              Firma <span className="text-red-600">*</span>
            </label>
            <button
              type="button"
              onClick={clearSignature}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Limpiar Firma
            </button>
          </div>
          <div className="border-2 border-slate-300 rounded-lg bg-white">
            <SignatureCanvas
              ref={signaturePadRef}
              canvasProps={{
                className: 'w-full h-48',
              }}
            />
          </div>
          <p className="text-sm text-slate-500 mt-2">Firme dentro del recuadro usando su dedo o mouse</p>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Cerrando OT...' : 'Cerrar Orden de Trabajo'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
