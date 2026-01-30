import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmergencyQRScannerProps {
  onScanSuccess: (data: {
    clientId: string;
    buildingName: string;
    buildingAddress: string;
    elevators: Array<{ id: string; internal_code: string; location: string }>;
  }) => void;
  onCancel: () => void;
}

export function EmergencyQRScanner({ onScanSuccess, onCancel }: EmergencyQRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScanFailure = (err: any) => {
    console.log('Scan error:', err);
  };

  const handleScanSuccess = async (decodedText: string) => {
    try {
      setError(null);
      const qrData = JSON.parse(decodedText);

      if (!qrData.clientId) {
        throw new Error('Código QR inválido: falta información del cliente');
      }

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, company_name, address')
        .eq('id', qrData.clientId)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!client) throw new Error('Cliente no encontrado');

      const { data: elevators, error: elevatorsError } = await supabase
        .from('elevators')
        .select('id, internal_code, location')
        .eq('client_id', client.id)
        .order('internal_code');

      if (elevatorsError) throw elevatorsError;
      if (!elevators || elevators.length === 0) {
        throw new Error('No hay ascensores registrados para este cliente');
      }

      onScanSuccess({
        clientId: client.id,
        buildingName: client.company_name || client.name,
        buildingAddress: client.address || 'Sin dirección registrada',
        elevators: elevators,
      });
    } catch (err) {
      console.error('Error processing QR:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar código QR');
    }
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      },
      {
        verbose: false,
        formatsToSupport: undefined,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false,
        },
      }
    );

    scanner.render(handleScanSuccess as any, handleScanFailure);
    setScanning(true);

    return () => {
      if (scanning) {
        scanner.clear().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <QrCode className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Escanear Código QR - Emergencia
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Escanea el código QR del edificio para iniciar la visita de emergencia.
            El sistema cargará automáticamente los datos del cliente y los ascensores disponibles.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div id="qr-reader" className="w-full"></div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Instrucciones:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-sm text-blue-700">
            <li>• Apunta la cámara al código QR</li>
            <li>• Mantén el código dentro del recuadro</li>
            <li>• Espera a que se detecte automáticamente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
