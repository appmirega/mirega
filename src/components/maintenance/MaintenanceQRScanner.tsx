// ...existing code...
import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../lib/supabase';
import { QrCode, AlertCircle, X } from 'lucide-react';

interface MaintenanceQRScannerProps {
  onScanSuccess: (data: {
    buildingId: string;
    buildingName: string;
    buildingAddress: string;
    clientId: string;
  }) => void;
  onCancel: () => void;
}

export function MaintenanceQRScanner({
  onScanSuccess,
  onCancel,
}: MaintenanceQRScannerProps) {
  // ...existing code...
  const [error, setError] = useState<string | null>(null);

  const handleScanFailure = (err: any) => {
    console.log('Scan error:', err);
  };

  const handleScanSuccess = async (decodedText: string) => {
    try {
      setError(null);
      const qrData = JSON.parse(decodedText);

      // Si el QR tiene buildingId, buscar el edificio directamente
      if (qrData.buildingId) {
        const { data: building, error: buildingError } = await supabase
          .from('buildings')
          .select('id, name, address, client_id')
          .eq('id', qrData.buildingId)
          .single();

        if (buildingError) throw buildingError;
        if (!building) throw new Error('Edificio no encontrado');

        onScanSuccess({
          buildingId: building.id,
          buildingName: building.name,
          buildingAddress: building.address,
          clientId: building.client_id,
        });
      } else if (qrData.clientId) {
        // Si solo tiene clientId, buscar el primer edificio del cliente
        const { data: buildings, error: buildingsError } = await supabase
          .from('buildings')
          .select('id, name, address, client_id')
          .eq('client_id', qrData.clientId)
          .eq('is_active', true)
          .limit(1);

        if (buildingsError) throw buildingsError;
        if (!buildings || buildings.length === 0) {
          throw new Error('No hay edificios registrados para este cliente');
        }

        const building = buildings[0];
        onScanSuccess({
          buildingId: building.id,
          buildingName: building.name,
          buildingAddress: building.address,
          clientId: building.client_id,
        });
      }
    } catch (err) {
      console.error('Error processing QR:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar código QR');
    }
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader-maintenance',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      false
    );

    scanner.render(handleScanSuccess, handleScanFailure);
    setScanning(true);

    return () => {
      scanner.clear().catch((err) => console.error('Error clearing scanner:', err));
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <QrCode className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Escanear Código QR - Mantenimiento
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
          Escanea el código QR del edificio para programar el mantenimiento.
          El sistema cargará automáticamente los datos del cliente y edificio.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error al escanear</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      <div
        id="qr-reader-maintenance"
        className="rounded-lg overflow-hidden border-2 border-gray-200"
      ></div>

      <div className="flex justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
