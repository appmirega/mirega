import { useState } from 'react';
import { QrCode, Search, Clock, AlertTriangle, History } from 'lucide-react';
import { EmergencyQRScanner } from '../emergency/EmergencyQRScanner';
import { ClientSelector } from '../emergency/ClientSelector';

type ViewMode = 'main' | 'qr-scanner' | 'client-selector' | 'in-progress' | 'stopped' | 'history';

export function TechnicianEmergencyViewV3() {
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedElevatorId, setSelectedElevatorId] = useState<string | null>(null);

  // Renderizar vista según modo
  const renderContent = () => {
    switch (viewMode) {
      case 'qr-scanner':
        return (
          <EmergencyQRScanner
            onCancel={() => setViewMode('main')}
            onElevatorSelected={(clientId, elevatorId) => {
              setSelectedClientId(clientId);
              setSelectedElevatorId(elevatorId);
              // Aquí se abrirá el formulario de emergencia
            }}
          />
        );

      case 'client-selector':
        return (
          <ClientSelector
            onCancel={() => setViewMode('main')}
            onElevatorSelected={(clientId, elevatorId) => {
              setSelectedClientId(clientId);
              setSelectedElevatorId(elevatorId);
              // Aquí se abrirá el formulario de emergencia
            }}
          />
        );

      case 'in-progress':
        return <div className="p-6"><p>Emergencias en Progreso (por implementar)</p></div>;

      case 'stopped':
        return <div className="p-6"><p className="text-red-600">Ascensores Detenidos (por implementar)</p></div>;

      case 'history':
        return <div className="p-6"><p>Historial (por implementar)</p></div>;

      default:
        return (
          <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Emergencias</h1>
              <p className="text-gray-600 mt-2">Gestión completa de emergencias</p>
            </div>

            {/* Grid de opciones - Igual que mantenimiento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Escanear QR */}
              <button
                onClick={() => setViewMode('qr-scanner')}
                className="flex items-start gap-4 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-all"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Escanear Código QR
                  </h3>
                  <p className="text-sm text-gray-600">
                    Buscar cliente por QR
                  </p>
                </div>
              </button>

              {/* Buscar Cliente Manualmente */}
              <button
                onClick={() => setViewMode('client-selector')}
                className="flex items-start gap-4 p-6 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Buscar Cliente Manualmente
                  </h3>
                  <p className="text-sm text-gray-600">
                    Seleccionar de la lista
                  </p>
                </div>
              </button>

              {/* Emergencias en Progreso */}
              <button
                onClick={() => setViewMode('in-progress')}
                className="flex items-start gap-4 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl hover:bg-yellow-100 hover:border-yellow-300 transition-all"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Emergencias en Progreso
                  </h3>
                  <p className="text-sm text-gray-600">
                    Retomar formularios sin firmar
                  </p>
                </div>
              </button>

              {/* Ascensores Detenidos - NUEVO */}
              <button
                onClick={() => setViewMode('stopped')}
                className="flex items-start gap-4 p-6 bg-red-50 border-2 border-red-300 rounded-xl hover:bg-red-100 hover:border-red-400 transition-all shadow-md"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-red-900 mb-1">
                    Ascensores Detenidos
                  </h3>
                  <p className="text-sm text-red-700 font-medium">
                    Ver estado crítico
                  </p>
                </div>
              </button>

              {/* Historial */}
              <button
                onClick={() => setViewMode('history')}
                className="flex items-start gap-4 p-6 bg-purple-50 border-2 border-purple-200 rounded-xl hover:bg-purple-100 hover:border-purple-300 transition-all md:col-span-2"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                  <History className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Historial
                  </h3>
                  <p className="text-sm text-gray-600">
                    Ver emergencias realizadas
                  </p>
                </div>
              </button>
            </div>
          </div>
        );
    }
  };

  return <div className="min-h-screen bg-gray-50">{renderContent()}</div>;
}
