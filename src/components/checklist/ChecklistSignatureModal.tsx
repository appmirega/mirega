import { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, RotateCcw, Check } from 'lucide-react';

interface ChecklistSignatureModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (signerName: string, signatureDataURL: string) => Promise<void> | void;
  clientName?: string;
  elevatorSummary?: string;
  periodLabel?: string;
}

export function ChecklistSignatureModal({
  open,
  onClose,
  onConfirm,
  clientName,
  elevatorSummary,
  periodLabel,
}: ChecklistSignatureModalProps) {
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const [signerName, setSignerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔄 Cada vez que se abre el modal, reseteamos nombre y firma
  useEffect(() => {
    if (open) {
      setSignerName('');
      setError(null);
      if (sigCanvas.current) {
        sigCanvas.current.clear();
      }
    }
  }, [open]);

  if (!open) return null;

  const handleClear = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = async () => {
    setError(null);

    if (!signerName.trim()) {
      setError('Debes ingresar el nombre de quien firma.');
      return;
    }

    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      setError('Debes dibujar la firma.');
      return;
    }

    try {
      setSaving(true);
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      await onConfirm(signerName.trim(), dataUrl);
    } catch (err) {
      console.error('Error al guardar la firma:', err);
      setError('Ocurrió un error al guardar la firma. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            Firma de visita de mantenimiento
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-100"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {(clientName || elevatorSummary || periodLabel) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
              {clientName && (
                <p>
                  <span className="font-semibold">Cliente:</span> {clientName}
                </p>
              )}
              {elevatorSummary && (
                <p>
                  <span className="font-semibold">Ascensores:</span> {elevatorSummary}
                </p>
              )}
              {periodLabel && (
                <p>
                  <span className="font-semibold">Periodo:</span> {periodLabel}
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                Esta firma se asociará a todos los checklists completados de este cliente en el periodo seleccionado.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">
              Nombre de quien firma *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: Juan Pérez, administrador del edificio"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">
              Firma *
            </label>
            <div className="border-2 border-slate-300 rounded-lg overflow-hidden bg-white">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: 'w-full h-48 touch-none',
                }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpiar firma
              </button>
              <p className="text-[11px] text-slate-500">
                Firma con el mouse o con el dedo (en pantallas táctiles).
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'Guardando...' : 'Guardar firma'}
          </button>
        </div>
      </div>
    </div>
  );
}

