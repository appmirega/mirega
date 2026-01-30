import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Phone,
  MapPin,
  Zap,
  Download,
  Filter,
  QrCode,
  FileText,
} from 'lucide-react';
import { MultiElevatorEmergencyForm } from '../emergency/MultiElevatorEmergencyForm';
import { EmergencyQRScanner } from '../emergency/EmergencyQRScanner';
import { ManualEmergencySelector } from '../emergency/ManualEmergencySelector';

interface EmergencyVisit {
  id: string;
  client_id: string;
  building_name: string;
  building_address: string;
  elevators_in_failure: string[];
  status: 'in_progress' | 'completed';
  created_at: string;
  completed_at?: string;
  technician_id: string;
  technician?: {
    full_name: string;
    email: string;
  };
  clients?: {
    company_name: string;
    contact_phone: string;
  };
}

type ActiveTab = 'in_progress' | 'completed';

export function EmergenciesDashboard() {
  const { profile, user } = useAuth();
  const [emergencies, setEmergencies] = useState<EmergencyVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('in_progress');
  const [showNewEmergencyForm, setShowNewEmergencyForm] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerData, setScannerData] = useState<any>(null);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [showManualSelector, setShowManualSelector] = useState(false);
  
  // Filtros
  const [clients, setClients] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [stats, setStats] = useState({
    in_progress: 0,
    completed: 0,
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'developer';
  const isTechnician = profile?.role === 'technician';

  useEffect(() => {
    loadEmergencies();
    if (isAdmin) {
      loadClients();
    }
  }, [activeTab, selectedYear, selectedClient]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .order('company_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadEmergencies = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('emergency_v2_visits')
        .select(`
          id,
          client_id,
          building_name,
          building_address,
          elevators_in_failure,
          status,
          created_at,
          completed_at,
          technician_id,
          technician:profiles!technician_id (
            full_name,
            email
          ),
          clients:clients!client_id (
            company_name,
            contact_phone
          )
        `);

      if (activeTab === 'in_progress') {
        query = query.eq('status', 'in_progress');
      } else if (activeTab === 'completed') {
        query = query.eq('status', 'completed');
      }

      // Filtrar por técnico si es técnico
      if (isTechnician) {
        query = query.eq('technician_id', user?.id);
      }

      // Aplicar filtros de año y cliente
      if (selectedYear !== 'all') {
        const yearStart = `${selectedYear}-01-01`;
        const yearEnd = `${selectedYear}-12-31`;
        query = query.gte('created_at', yearStart).lte('created_at', yearEnd);
      }

      if (selectedClient !== 'all') {
        query = query.eq('client_id', selectedClient);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []) as EmergencyVisit[];
      setEmergencies(typedData);

      // Actualizar stats
      const inProgress = typedData.filter(e => e.status === 'in_progress').length;
      const completed = typedData.filter(e => e.status === 'completed').length;
      setStats({ in_progress: inProgress, completed });
    } catch (error) {
      console.error('Error loading emergencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQRScanSuccess = (data: {
    clientId: string;
    buildingName: string;
    buildingAddress: string;
    elevators: Array<{ id: string; internal_code: string; location: string }>;
  }) => {
    setScannerData(data);
    setShowQRScanner(false);
    setShowNewEmergencyForm(true);
  };

  const handleManualBuildingSelected = (data: {
    clientId: string;
    buildingName: string;
    buildingAddress: string;
    elevators: Array<{ id: string; internal_code: string; location: string }>;
  }) => {
    setScannerData(data);
    setShowManualSelector(false);
    setShowNewEmergencyForm(true);
  };

  const handleCompleteEmergency = async (emergencyId: string) => {
    try {
      const { error } = await supabase
        .from('emergency_v2_visits')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', emergencyId);

      if (error) throw error;

      await loadEmergencies();
    } catch (error) {
      console.error('Error completing emergency:', error);
      alert('Error al completar emergencia');
    }
  };

  const handleBulkDownloadPDFs = async () => {
    setDownloading(true);
    try {
      // Nota: emergency_v2_visits no tiene pdf_url aún implementado
      // Por ahora buscaremos en emergency_visits (tabla legacy con PDFs)
      let query = supabase
        .from('emergency_visits')
        .select('id, pdf_url, visit_date, clients(company_name)')
        .not('pdf_url', 'is', null)
        .order('visit_date', { ascending: false });

      // Aplicar mismos filtros
      if (selectedYear !== 'all') {
        const yearStart = `${selectedYear}-01-01`;
        const yearEnd = `${selectedYear}-12-31`;
        query = query.gte('visit_date', yearStart).lte('visit_date', yearEnd);
      }

      if (selectedClient !== 'all') {
        query = query.eq('client_id', selectedClient);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No hay PDFs disponibles para los filtros seleccionados');
        return;
      }

      alert(`Iniciando descarga de ${data.length} PDFs. Esto puede tardar unos segundos...`);

      // Descargar cada PDF con delay para evitar bloqueos
      for (let i = 0; i < data.length; i++) {
        const record = data[i];
        setTimeout(() => {
          const clientData = Array.isArray(record.clients) && record.clients.length > 0 
            ? record.clients[0] 
            : record.clients;
          
          const clientName = (clientData as any)?.company_name || 'cliente';
          const date = new Date(record.visit_date).toLocaleDateString('es-CL').replace(/\//g, '-');
          const filename = `emergencia_${clientName}_${date}.pdf`;
          
          const link = document.createElement('a');
          link.href = record.pdf_url!;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, i * 500); // Delay 500ms entre descargas
      }

      setTimeout(() => {
        alert(`✅ Descarga completa: ${data.length} PDFs`);
        setDownloading(false);
      }, data.length * 500 + 1000);

    } catch (error) {
      console.error('Error downloading PDFs:', error);
      alert('Error al descargar PDFs');
      setDownloading(false);
    }
  };

  const filteredEmergencies = emergencies.filter(e => {
    if (activeTab === 'in_progress') return e.status === 'in_progress';
    if (activeTab === 'completed') return e.status === 'completed';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Emergencias</h1>
            <p className="text-gray-600">Gestión centralizada de llamadas de emergencia y asignación técnica</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition shadow-md ${
                    showFilters
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  Filtros
                </button>
                <button
                  onClick={() => setShowCreationModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition shadow-md"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Emergencia
                </button>
              </>
            )}
          </div>
        </div>

        {/* Panel de Filtros */}
        {isAdmin && showFilters && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Año
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos los años</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos los clientes</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleBulkDownloadPDFs}
                  disabled={downloading}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                    downloading
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Download className="w-5 h-5" />
                  {downloading ? 'Descargando...' : 'Descargar PDFs'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Emergencias Activas</p>
                <p className="text-3xl font-bold text-red-600">{stats.in_progress}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completadas Hoy</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs por Estado */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'in_progress'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Zap className="w-4 h-4" />
              Activas
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'in_progress'
                  ? 'bg-white text-red-600'
                  : 'bg-red-600 text-white'
              }`}>
                {stats.in_progress}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Resueltas
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'completed'
                  ? 'bg-white text-green-600'
                  : 'bg-green-600 text-white'
              }`}>
                {stats.completed}
              </span>
            </button>
          </div>
        </div>

        {/* Listado de Emergencias */}
        {filteredEmergencies.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-50" />
            <p className="text-gray-600 font-medium text-lg">
              {activeTab === 'in_progress'
                ? 'No hay emergencias activas'
                : 'No hay emergencias resueltas'}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {activeTab === 'in_progress'
                ? 'Todas las emergencias han sido resueltas'
                : 'Aún no hay emergencias completadas'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmergencies.map((emergency) => (
              <div
                key={emergency.id}
                className={`bg-white rounded-xl shadow-sm p-6 border-l-4 transition hover:shadow-md ${
                  emergency.status === 'in_progress'
                    ? 'border-red-500 hover:border-red-600'
                    : 'border-green-500 hover:border-green-600'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg text-gray-900">
                        {emergency.clients?.company_name || 'Cliente'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        emergency.status === 'in_progress'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {emergency.status === 'in_progress' ? '🔴 ACTIVA' : '✅ Resuelta'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{emergency.building_name}</p>
                          <p className="text-xs">{emergency.building_address}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-orange-500" />
                        <p>
                          <span className="font-medium">{emergency.elevators_in_failure?.length || 0}</span> ascensor(es)
                          en falla
                        </p>
                      </div>

                      {emergency.clients?.contact_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-blue-500" />
                          <p>{emergency.clients.contact_phone}</p>
                        </div>
                      )}

                      {emergency.technician?.full_name && (
                        <div className="flex items-center gap-2">
                          <p>
                            <span className="font-medium">Técnico:</span> {emergency.technician.full_name}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-4 h-4" />
                        <p>{new Date(emergency.created_at).toLocaleString('es-CL')}</p>
                      </div>
                    </div>
                  </div>

                  {emergency.status === 'in_progress' && isAdmin && (
                    <button
                      onClick={() => handleCompleteEmergency(emergency.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex-shrink-0"
                    >
                      Completar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de Selección: QR o Manual */}
        {showCreationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                Nueva Emergencia
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                Selecciona cómo quieres registrar la emergencia:
              </p>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => {
                    setShowCreationModal(false);
                    setShowQRScanner(true);
                  }}
                  className="flex items-center gap-4 p-6 border-2 border-gray-300 rounded-lg hover:border-red-600 hover:bg-red-50 transition group"
                >
                  <div className="bg-red-100 p-3 rounded-lg group-hover:bg-red-600 transition">
                    <QrCode className="w-8 h-8 text-red-600 group-hover:text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-bold text-lg text-gray-900">Escanear QR</h3>
                    <p className="text-sm text-gray-600">
                      Usa el escáner QR del edificio
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowCreationModal(false);
                    setShowManualSelector(true);
                  }}
                  className="flex items-center gap-4 p-6 border-2 border-gray-300 rounded-lg hover:border-red-600 hover:bg-red-50 transition group"
                >
                  <div className="bg-red-100 p-3 rounded-lg group-hover:bg-red-600 transition">
                    <FileText className="w-8 h-8 text-red-600 group-hover:text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-bold text-lg text-gray-900">Ingreso Manual</h3>
                    <p className="text-sm text-gray-600">
                      Selecciona cliente y edificio manualmente
                    </p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowCreationModal(false)}
                className="mt-6 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Manual Building Selector Modal */}
        {showManualSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-gray-900">
                  Seleccionar Edificio
                </h2>
                <button
                  onClick={() => setShowManualSelector(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <ManualEmergencySelector
                  onBuildingSelected={handleManualBuildingSelected}
                  onCancel={() => setShowManualSelector(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* QR Scanner Modal */}
        {showQRScanner && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Escanear QR de Edificio</h2>
                <button
                  onClick={() => setShowQRScanner(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <EmergencyQRScanner
                  onScanSuccess={handleQRScanSuccess}
                  onCancel={() => setShowQRScanner(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* New Emergency Form Modal */}
        {showNewEmergencyForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 max-h-screen overflow-y-auto">
            <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full my-8">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Nueva Emergencia</h2>
                <button
                  onClick={() => {
                    setShowNewEmergencyForm(false);
                    setScannerData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                {scannerData && (
                  <MultiElevatorEmergencyForm
                    initialData={{
                      clientId: scannerData.clientId,
                      buildingName: scannerData.buildingName,
                      buildingAddress: scannerData.buildingAddress,
                      elevatorsInFailure: [],
                      availableElevators: scannerData.elevators,
                    }}
                    onSuccess={() => {
                      setShowNewEmergencyForm(false);
                      setScannerData(null);
                      loadEmergencies();
                    }}
                    onCancel={() => {
                      setShowNewEmergencyForm(false);
                      setScannerData(null);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
