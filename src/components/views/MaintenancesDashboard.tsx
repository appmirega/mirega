import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Wrench,
  CheckCircle2,
  // ...existing code...
  Plus,
  MapPin,
  Calendar,
  AlertCircle,
  User,
  X,
  Download,
  Filter,
  QrCode,
  FileText,
} from 'lucide-react';
import { MaintenanceQRScanner } from '../maintenance/MaintenanceQRScanner';

interface MaintenanceSchedule {
  id: string;
  client_id: string;
  building_id: string;
  scheduled_date: string;
  scheduled_time?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_technicians?: string[];
  notes?: string;
  created_at: string;
  completed_at?: string;
  building?: {
    name: string;
    address: string;
  };
  clients?: {
    company_name: string;
  };
  technician?: {
    full_name: string;
    email: string;
  };
}

type ActiveTab = 'pending' | 'in_progress' | 'completed';

export function MaintenancesDashboard() {
  const { profile, user } = useAuth();
  const [maintenances, setMaintenances] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');
  const [showNewMaintenanceForm, setShowNewMaintenanceForm] = useState(false);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [buildings, setBuildings] = useState<any[]>([]);
  
  // Filtros
  const [clients, setClients] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [stats, setStats] = useState({
    pending: 0,
    in_progress: 0,
    completed: 0,
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'developer';
  const isTechnician = profile?.role === 'technician';

  useEffect(() => {
    loadMaintenances();
    if (isAdmin) {
      loadBuildings();
      loadClients();
    }
  }, [activeTab, selectedYear, selectedClient]);

  const loadBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('id, name, address, client_id')
        .eq('is_active', true);

      if (error) throw error;
      setBuildings(data || []);
    } catch (error) {
      console.error('Error loading buildings:', error);
    }
  };

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

  const loadMaintenances = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('maintenance_schedules')
        .select(`
          id,
          client_id,
          building_id,
          scheduled_date,
          scheduled_time,
          status,
          assigned_technicians,
          notes,
          created_at,
          completed_at,
          building:building_id (
            name,
            address
          ),
          clients:client_id (
            company_name
          )
        `);

      if (activeTab === 'pending') {
        query = query.eq('status', 'pending');
      } else if (activeTab === 'in_progress') {
        query = query.eq('status', 'in_progress');
      } else if (activeTab === 'completed') {
        query = query.eq('status', 'completed');
      }

      // Filtrar por técnico si es técnico
      if (isTechnician) {
        query = query.contains('assigned_technicians', [user?.id]);
      }

      // Aplicar filtros de año y cliente
      if (selectedYear !== 'all') {
        const yearStart = `${selectedYear}-01-01`;
        const yearEnd = `${selectedYear}-12-31`;
        query = query.gte('scheduled_date', yearStart).lte('scheduled_date', yearEnd);
      }

      if (selectedClient !== 'all') {
        query = query.eq('client_id', selectedClient);
      }

      query = query.order('scheduled_date', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []) as MaintenanceSchedule[];
      setMaintenances(typedData);

      // Actualizar stats
      const pending = typedData.filter(m => m.status === 'pending').length;
      const inProgress = typedData.filter(m => m.status === 'in_progress').length;
      const completed = typedData.filter(m => m.status === 'completed').length;
      setStats({ pending, in_progress: inProgress, completed });
    } catch (error) {
      console.error('Error loading maintenances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMaintenances = async (maintenanceId: string) => {
    try {
      const { error } = await supabase
        .from('maintenance_schedules')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', maintenanceId);

      if (error) throw error;

      await loadMaintenances();
    } catch (error) {
      console.error('Error completing maintenance:', error);
      alert('Error al completar mantenimiento');
    }
  };

  const handleStartMaintenance = async (maintenanceId: string) => {
    try {
      const { error } = await supabase
        .from('maintenance_schedules')
        .update({
          status: 'in_progress',
        })
        .eq('id', maintenanceId);

      if (error) throw error;

      await loadMaintenances();
    } catch (error) {
      console.error('Error starting maintenance:', error);
      alert('Error al iniciar mantenimiento');
    }
  };

  const handleBulkDownloadPDFs = async () => {
    setDownloading(true);
    try {
      // Buscar PDFs en mnt_checklists
      let query = supabase
        .from('mnt_checklists')
        .select('id, pdf_url, completed_at, clients(company_name, internal_alias), elevators(elevator_number), month, year')
        .not('pdf_url', 'is', null)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      // Aplicar mismos filtros
      if (selectedYear !== 'all') {
        query = query.eq('year', parseInt(selectedYear));
      }

      if (selectedClient !== 'all') {
        query = query.eq('client_id', selectedClient);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No hay PDFs de mantenimiento disponibles para los filtros seleccionados');
        return;
      }

      alert(`Iniciando descarga de ${data.length} PDFs. Esto puede tardar unos segundos...`);

      // Descargar cada PDF con delay
      for (let i = 0; i < data.length; i++) {
        const record = data[i];
        setTimeout(() => {
          const clientData = Array.isArray(record.clients) && record.clients.length > 0 
            ? record.clients[0] 
            : record.clients;
          const elevatorData = Array.isArray(record.elevators) && record.elevators.length > 0 
            ? record.elevators[0] 
            : record.elevators;
          
          const buildingName = (clientData as any)?.internal_alias || 'edificio';
          const elevatorNum = (elevatorData as any)?.elevator_number || 'asc';
          const monthName = new Date(record.year, record.month - 1).toLocaleString('es-CL', { month: 'long' });
          const filename = `mantenimiento_${buildingName}_${elevatorNum}_${monthName}_${record.year}.pdf`;
          
          const link = document.createElement('a');
          link.href = record.pdf_url!;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, i * 500);
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

  const handleQRScanSuccess = (data: {
    buildingId: string;
    buildingName: string;
    buildingAddress: string;
    clientId: string;
  }) => {
    setShowQRScanner(false);
    setShowNewMaintenanceForm(true);
    // El formulario inline puede pre-llenar estos datos si se actualiza
  };

  const filteredMaintenances = maintenances.filter(m => {
    if (activeTab === 'pending') return m.status === 'pending';
    if (activeTab === 'in_progress') return m.status === 'in_progress';
    if (activeTab === 'completed') return m.status === 'completed';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Programado', bg: 'bg-blue-100', text: 'text-blue-700', icon: '📅' };
      case 'in_progress':
        return { label: 'En Progreso', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '⏳' };
      case 'completed':
        return { label: 'Completado', bg: 'bg-green-100', text: 'text-green-700', icon: '✅' };
      default:
        return { label: 'Desconocido', bg: 'bg-gray-100', text: 'text-gray-700', icon: '❓' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Mantenimientos</h1>
            <p className="text-gray-600">Gestión centralizada de mantenimientos preventivos y asignación técnica</p>
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
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-md"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Mantenimiento
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Programados</p>
                <p className="text-3xl font-bold text-blue-600">{stats.pending}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">En Progreso</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.in_progress}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Wrench className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completados</p>
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
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Programados
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'pending'
                  ? 'bg-white text-blue-600'
                  : 'bg-blue-600 text-white'
              }`}>
                {stats.pending}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('in_progress')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'in_progress'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Wrench className="w-4 h-4" />
              En Progreso
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'in_progress'
                  ? 'bg-white text-yellow-600'
                  : 'bg-yellow-600 text-white'
              }`}>
                {stats.in_progress}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Completados
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

        {/* Listado de Mantenimientos */}
        {filteredMaintenances.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-50" />
            <p className="text-gray-600 font-medium text-lg">
              {activeTab === 'pending'
                ? 'No hay mantenimientos programados'
                : activeTab === 'in_progress'
                ? 'No hay mantenimientos en progreso'
                : 'No hay mantenimientos completados'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMaintenances.map((maintenance) => {
              const badge = getStatusBadge(maintenance.status);
              const isOverdue =
                maintenance.status === 'pending' &&
                new Date(maintenance.scheduled_date) < new Date();

              return (
                <div
                  key={maintenance.id}
                  className={`bg-white rounded-xl shadow-sm p-6 border-l-4 transition hover:shadow-md ${
                    maintenance.status === 'pending'
                      ? isOverdue
                        ? 'border-red-500 hover:border-red-600'
                        : 'border-blue-500 hover:border-blue-600'
                      : maintenance.status === 'in_progress'
                      ? 'border-yellow-500 hover:border-yellow-600'
                      : 'border-green-500 hover:border-green-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg text-gray-900">
                          {maintenance.clients?.company_name || 'Cliente'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                          {badge.icon} {badge.label}
                        </span>
                        {isOverdue && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            ⚠️ VENCIDO
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-sm text-gray-600 mb-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{maintenance.building?.name}</p>
                            <p className="text-xs">{maintenance.building?.address}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-500" />
                          <p>
                            <span className="font-medium">
                              {new Date(maintenance.scheduled_date).toLocaleDateString('es-CL')}
                            </span>
                            {maintenance.scheduled_time && (
                              <span> a las {maintenance.scheduled_time}</span>
                            )}
                          </p>
                        </div>

                        {maintenance.assigned_technicians && maintenance.assigned_technicians.length > 0 && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-purple-500" />
                            <p>
                              <span className="font-medium">{maintenance.assigned_technicians.length}</span> técnico(s)
                              asignado(s)
                            </p>
                          </div>
                        )}

                        {maintenance.notes && (
                          <div className="flex items-start gap-2 mt-3 p-2 bg-gray-50 rounded">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                            <p className="text-xs text-gray-600">{maintenance.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex gap-2 flex-shrink-0">
                        {maintenance.status === 'pending' && (
                          <button
                            onClick={() => handleStartMaintenance(maintenance.id)}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition"
                          >
                            Iniciar
                          </button>
                        )}
                        {maintenance.status === 'in_progress' && (
                          <button
                            onClick={() => handleCompleteMaintenances(maintenance.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                          >
                            Completar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Selección: QR o Manual */}
        {showCreationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                Nuevo Mantenimiento
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                Selecciona cómo quieres registrar el mantenimiento:
              </p>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => {
                    setShowCreationModal(false);
                    setShowQRScanner(true);
                  }}
                  className="flex items-center gap-4 p-6 border-2 border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition group"
                >
                  <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-600 transition">
                    <QrCode className="w-8 h-8 text-blue-600 group-hover:text-white" />
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
                    setShowNewMaintenanceForm(true);
                  }}
                  className="flex items-center gap-4 p-6 border-2 border-gray-300 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition group"
                >
                  <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-600 transition">
                    <FileText className="w-8 h-8 text-blue-600 group-hover:text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-bold text-lg text-gray-900">Ingreso Manual</h3>
                    <p className="text-sm text-gray-600">
                      Selecciona edificio manualmente
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
                <MaintenanceQRScanner
                  onScanSuccess={handleQRScanSuccess}
                  onCancel={() => setShowQRScanner(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Formulario Manual Modal */}
        {showNewMaintenanceForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Nuevo Mantenimiento</h2>
                <button
                  onClick={() => setShowNewMaintenanceForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <NewMaintenanceForm
                  buildings={buildings}
                  onSuccess={() => {
                    setShowNewMaintenanceForm(false);
                    loadMaintenances();
                  }}
                  onCancel={() => setShowNewMaintenanceForm(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface NewMaintenanceFormProps {
  buildings: any[];
  onSuccess: () => void;
  onCancel: () => void;
}

function NewMaintenanceForm({ buildings, onSuccess, onCancel }: NewMaintenanceFormProps) {
  const [formData, setFormData] = useState({
    building_id: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.building_id || !formData.scheduled_date) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('maintenance_schedules')
        .insert({
          building_id: formData.building_id,
          scheduled_date: formData.scheduled_date,
          scheduled_time: formData.scheduled_time || null,
          notes: formData.notes || null,
          status: 'pending',
          assigned_technicians: [],
        });

      if (error) throw error;

      alert('✅ Mantenimiento creado exitosamente');
      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear mantenimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Edificio *
        </label>
        <select
          value={formData.building_id}
          onChange={(e) => setFormData({ ...formData, building_id: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Selecciona un edificio</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} - {b.address}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fecha de Mantenimiento *
        </label>
        <input
          type="date"
          value={formData.scheduled_date}
          onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Hora (Opcional)
        </label>
        <input
          type="time"
          value={formData.scheduled_time}
          onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notas
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Describe detalles sobre el mantenimiento..."
        />
      </div>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Crear Mantenimiento'}
        </button>
      </div>
    </form>
  );
}
