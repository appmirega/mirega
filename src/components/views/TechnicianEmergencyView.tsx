import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  QrCode,
  AlertTriangle,
  Building2,
  Search,
  History,
  FileText,
  Download,
  ArrowLeft,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { EmergencyQRScanner } from '../emergency/EmergencyQRScanner';
import { MultiElevatorEmergencyForm } from '../emergency/MultiElevatorEmergencyForm';

interface Client {
  id: string;
  company_name: string;
  address: string;
}

interface Elevator {
  id: string;
  brand: string;
  model: string;
  serial_number: string;
  location_name: string;
  status: string;
}

interface EmergencyHistory {
  id: string;
  visit_date: string;
  visit_time: string;
  failure_category: string;
  reported_issue: string;
  resolution_description: string;
  status: string;
  elevators: {
    brand: string;
    model: string;
    location_name: string;
    clients: {
      company_name: string;
    };
  };
}

type ViewMode = 'start' | 'select-client' | 'emergency-form' | 'history' | 'pdfs' | 'stopped-elevators';

export function TechnicianEmergencyView() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('start');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showBuildingSearch, setShowBuildingSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [emergencyHistory, setEmergencyHistory] = useState<EmergencyHistory[]>([]);
  const [stoppedElevators, setStoppedElevators] = useState<Elevator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadClients();
      loadStoppedElevators();
    }
  }, [profile]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, address')
        .order('company_name');

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const loadEmergencyHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_visits_v2')
        .select(`
          id,
          visit_date,
          visit_time,
          failure_category,
          reported_issue,
          resolution_description,
          status,
          elevators (
            brand,
            model,
            location_name,
            clients (
              company_name
            )
          )
        `)
        .eq('technician_id', profile?.id)
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmergencyHistory(data || []);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const loadStoppedElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select(`
          id,
          brand,
          model,
          serial_number,
          location_name,
          status,
          clients (
            company_name
          )
        `)
        .in('status', ['stopped', 'under_observation'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setStoppedElevators(data || []);
    } catch (err) {
      console.error('Error loading stopped elevators:', err);
    }
  };

  const handleQRScan = async (qrCode: string) => {
    setLoading(true);
    setError(null);
    setShowQRScanner(false);

    try {
      const { data: elevatorData, error: elevatorError } = await supabase
        .from('elevators')
        .select(`
          id,
          client_id,
          clients (
            id,
            company_name,
            address
          )
        `)
        .eq('id', qrCode)
        .single();

      if (elevatorError) throw new Error('Código QR no válido');

      const client = elevatorData.clients as unknown as Client;
      setSelectedClient(client);
      setViewMode('emergency-form');
    } catch (err: any) {
      console.error('Error processing QR:', err);
      setError(err.message || 'Error al procesar el código QR');
    } finally {
      setLoading(false);
    }
  };

  const handleBuildingSelect = (client: Client) => {
    setSelectedClient(client);
    setShowBuildingSearch(false);
    setViewMode('emergency-form');
  };

  const handleEmergencyComplete = () => {
    setViewMode('start');
    setSelectedClient(null);
    loadStoppedElevators();
  };

  const handleViewHistory = () => {
    loadEmergencyHistory();
    setViewMode('history');
  };

  const handleViewStoppedElevators = () => {
    loadStoppedElevators();
    setViewMode('stopped-elevators');
  };

  const filteredClients = clients.filter((c) =>
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'technical_failure':
        return 'Falla Técnica';
      case 'external_failure':
        return 'Falla Externa';
      case 'other':
        return 'Otros';
      default:
        return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical_failure':
        return 'bg-red-100 text-red-800';
      case 'external_failure':
        return 'bg-orange-100 text-orange-800';
      case 'other':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'stopped':
        return 'bg-red-100 text-red-800';
      case 'under_observation':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'stopped':
        return 'Detenido';
      case 'under_observation':
        return 'En Observación';
      default:
        return status;
    }
  };

  if (viewMode === 'emergency-form' && selectedClient) {
    return (
      <div>
        <button
          onClick={() => {
            setViewMode('start');
            setSelectedClient(null);
          }}
          className="flex items-center gap-2 px-4 py-2 mb-4 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <MultiElevatorEmergencyForm
          clientId={selectedClient.id}
          onComplete={handleEmergencyComplete}
          onCancel={() => setViewMode('start')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Emergencias</h1>
          <p className="text-slate-600 mt-1">Gestión completa de emergencias</p>
        </div>
        {viewMode !== 'start' && (
          <button
            onClick={() => {
              setViewMode('start');
              setSelectedClient(null);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
        )}
      </div>

      {viewMode === 'start' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <button
              onClick={() => setShowQRScanner(true)}
              className="p-6 bg-white border-2 border-blue-200 rounded-xl hover:bg-blue-50 transition text-left"
            >
              <QrCode className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Escanear QR</h3>
              <p className="text-sm text-slate-600">Iniciar con código QR</p>
            </button>

            <button
              onClick={() => setShowBuildingSearch(true)}
              className="p-6 bg-white border-2 border-green-200 rounded-xl hover:bg-green-50 transition text-left"
            >
              <Building2 className="w-8 h-8 text-green-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Buscar Edificio</h3>
              <p className="text-sm text-slate-600">Seleccionar por nombre</p>
            </button>

            <button
              onClick={handleViewHistory}
              className="p-6 bg-white border-2 border-purple-200 rounded-xl hover:bg-purple-50 transition text-left"
            >
              <History className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Historial</h3>
              <p className="text-sm text-slate-600">Ver emergencias realizadas</p>
            </button>

            <button
              onClick={handleViewStoppedElevators}
              className="p-6 bg-white border-2 border-red-200 rounded-xl hover:bg-red-50 transition text-left"
            >
              <AlertCircle className="w-8 h-8 text-red-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Ascensores Detenidos</h3>
              <p className="text-sm text-slate-600">Ver estado crítico</p>
            </button>

            <button
              onClick={() => setViewMode('pdfs')}
              className="p-6 bg-white border-2 border-orange-200 rounded-xl hover:bg-orange-50 transition text-left"
            >
              <FileText className="w-8 h-8 text-orange-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">PDFs</h3>
              <p className="text-sm text-slate-600">Ver y descargar reportes</p>
            </button>
          </div>
        </div>
      )}

      {viewMode === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Historial de Emergencias</h2>
          {emergencyHistory.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No hay historial disponible</p>
          ) : (
            <div className="space-y-4">
              {emergencyHistory.map((emergency) => (
                <div
                  key={emergency.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-1">
                        {emergency.elevators?.clients?.company_name}
                      </h3>
                      <p className="text-sm text-slate-600 mb-2">
                        {emergency.elevators?.brand} {emergency.elevators?.model} -{' '}
                        {emergency.elevators?.location_name}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(
                        emergency.failure_category
                      )}`}
                    >
                      {getCategoryLabel(emergency.failure_category)}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-slate-700 mb-1">Problema Reportado:</p>
                    <p className="text-sm text-slate-900">{emergency.reported_issue}</p>
                  </div>

                  {emergency.resolution_description && (
                    <div className="bg-green-50 rounded-lg p-3 mb-3">
                      <p className="text-sm font-medium text-green-700 mb-1">Solución:</p>
                      <p className="text-sm text-green-900">{emergency.resolution_description}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        {new Date(emergency.visit_date).toLocaleDateString('es-ES')} a las{' '}
                        {emergency.visit_time}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'stopped-elevators' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Ascensores Detenidos y en Observación
          </h2>
          {stoppedElevators.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
              <p className="text-green-600 font-medium">
                No hay ascensores detenidos o en observación
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stoppedElevators.map((elevator) => (
                <div
                  key={elevator.id}
                  className="border-2 border-red-200 rounded-lg p-4 bg-red-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-1">
                        {(elevator as any).clients?.company_name}
                      </h3>
                      <p className="text-sm text-slate-600 mb-1">
                        {elevator.brand} {elevator.model}
                      </p>
                      <p className="text-sm text-slate-600">{elevator.location_name}</p>
                      <p className="text-xs text-slate-500 mt-1">S/N: {elevator.serial_number}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        elevator.status
                      )}`}
                    >
                      {getStatusLabel(elevator.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'pdfs' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">PDFs de Emergencias</h2>
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Funcionalidad próximamente disponible</p>
            <p className="text-sm text-slate-500 mt-1">
              Los PDFs de emergencias estarán disponibles en una futura actualización
            </p>
          </div>
        </div>
      )}

      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Escanear Código QR</h3>
            <EmergencyQRScanner
              onScan={handleQRScan}
              onClose={() => setShowQRScanner(false)}
            />
          </div>
        </div>
      )}

      {showBuildingSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Buscar Edificio</h3>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre de edificio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredClients.length === 0 ? (
                <p className="text-slate-600 text-center py-8">No se encontraron edificios</p>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleBuildingSelect(client)}
                    className="w-full p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                  >
                    <h4 className="font-bold text-slate-900">{client.company_name}</h4>
                    <p className="text-sm text-slate-600">{client.address}</p>
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowBuildingSearch(false);
                  setSearchTerm('');
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}