import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, X } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (qrCode: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        setScanning(false);
        scanner.clear();
        onScanSuccess(decodedText);
      },
      (errorMessage) => {
        console.log('QR Scan error:', errorMessage);
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <QrCode className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Escanear Código QR</h2>
              <p className="text-sm text-slate-600">Coloca el código QR del cliente frente a la cámara</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6">
          {scanning ? (
            <div>
              <div id="qr-reader" className="w-full"></div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Instrucciones:</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Mantén el código QR dentro del cuadro</li>
                  <li>Asegúrate de tener buena iluminación</li>
                  <li>Mantén la cámara estable</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Procesando código QR...</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-semibold"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
