import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, RotateCcw, Check } from 'lucide-react';

interface EmergencySignatureProps {
  onSave: (signatureName: string, signatureDataURL: string) => void;
  onCancel: () => void;
}

export function EmergencySignature({ onSave, onCancel }: EmergencySignatureProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [signatureName, setSignatureName] = useState('');
  const [isEmpty, setIsEmpty] = useState(true);

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (!signatureName.trim()) {
      alert('Por favor ingrese el nombre de quien firma');
      return;
    }

    if (isEmpty || sigCanvas.current?.isEmpty()) {
      alert('Por favor firme antes de guardar');
      return;
    }

    const dataURL = sigCanvas.current?.toDataURL('image/png');
    if (dataURL) {
      onSave(signatureName, dataURL);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Firma de Cierre de Visita
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre Completo de Quien Firma *
            </label>
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Ingrese nombre completo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Canvas de firma */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Firma *
            </label>
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: 'w-full h-48 touch-none',
                  style: { touchAction: 'none' },
                }}
                onBegin={() => setIsEmpty(false)}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Firme dentro del recuadro usando su dedo o mouse
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={clearSignature}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Limpiar
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Check className="h-4 w-4" />
              Guardar Firma
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Importante:</strong> La firma certifica que se ha completado la visita de
            emergencia y que el técnico ha proporcionado la información sobre el estado de los
            ascensores.
          </p>
        </div>
      </div>
    </div>
  );
}
