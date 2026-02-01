import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus,
  Calendar,
  Wrench,
  Building2,
  AlertCircle,
  CheckCircle,
  X,
  Download,
  FileText,
  Mail,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { generateMaintenancePDF, generatePDFFilename } from '../../utils/pdfGenerator';

interface Maintenance {
  id: string;
  elevator_id: string;
  scheduled_date: string;
  maintenance_type: string;
  status: string;
  assigned_technician_id?: string;
  notes?: string;
  elevators?: {
    brand: string;
    model: string;
    serial_number: string;
    location_name: string;
    clients?: {
      company_name: string;
    };
  };
  profiles?: {
    full_name: string;
  };
}

interface PDFRecord {
  id: string;
  folio_number: number;
  file_name: string;
  sent_at: string | null;
  created_at: string;
  checklist: {
    month: number;
    year: number;
    completion_date: string;
    clients: {
      company_name: string;
      address: string;
      contact_name: string;
      email: string;
    };
    elevators: {
      brand: string;
      model: string;
      serial_number: string;
    };
    profiles: {
      full_name: string;
    };
  };
}

type ViewTab = 'schedule' | 'pdfs' | 'stats';

export function MaintenanceCompleteView() {
  const [activeTab, setActiveTab] = useState<ViewTab>('schedule');
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [pdfs, setPdfs] = useState<PDFRecord[]>([]);
  const [filteredMaintenances, setFilteredMaintenances] = useState<Maintenance[]>([]);
  const [filteredPdfs, setFilteredPdfs] = useState<PDFRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sentFilter, setSentFilter] = useState<'all' | 'sent' | 'not_sent'>('all');

  const [formData, setFormData] = useState({
    elevator_id: '',
    scheduled_date: '',
    maintenance_type: 'preventive',
    assigned_technician_id: '',
    notes: '',
  });
  const [elevators, setElevators] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    scheduled: 0,
    overdue: 0,
    pdfsSent: 0,
    pdfsNotSent: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
    calculateStats();
  }, [searchTerm, statusFilter, sentFilter, maintenances, pdfs]);

  const loadData = async () => {
    try {
      await Promise.all([loadMaintenances(), loadPDFs(), loadElevators(), loadTechnicians()]);
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenances = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          *,
          elevators (
            brand,
            model,
            serial_number,
            location_name,
            clients (
              company_name
            )
          ),
          profiles (
            full_name
          )
        `)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      setMaintenances(data || []);
    } catch (error) {
      console.error('Error loading maintenances:', error);
    }
  };

  const loadPDFs = async () => {
    try {
      const { data, error } = await supabase
        .from('mnt_maintenance_pdfs')
        .select(`
          *,
          checklist:mnt_checklists!inner (
            month,
            year,
            completion_date,
            clients (
              company_name,
              address,
              contact_name,
              email
            ),
            elevators (
              brand,
              model,
              serial_number
            ),
            profiles:profiles!mnt_checklists_technician_id_fkey (
              full_name
            )
          )
        `)
        .order('folio_number', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((item) => ({
        ...item,
        checklist: Array.isArray(item.checklist) ? item.checklist[0] : item.checklist,
      })) || [];

      setPdfs(formattedData);
    } catch (error) {
      console.error('Error loading PDFs:', error);
    }
  };

  const loadElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select('id, brand, model, serial_number, location_name, clients(company_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setElevators(data || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'technician')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const applyFilters = () => {
    let filteredM = maintenances;
    let filteredP = pdfs;

    if (searchTerm) {
      filteredM = filteredM.filter(
        (m) =>
          m.elevators?.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.elevators?.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.elevators?.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      filteredP = filteredP.filter(
        (p) =>
          p.checklist?.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.checklist?.elevators?.brand?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filteredM = filteredM.filter((m) => m.status === statusFilter);
    }

    if (sentFilter !== 'all') {
      filteredP = filteredP.filter((p) =>
        sentFilter === 'sent' ? p.sent_at !== null : p.sent_at === null
      );
    }

    setFilteredMaintenances(filteredM);
    setFilteredPdfs(filteredP);
  };

  const calculateStats = () => {
    const completed = maintenances.filter((m) => m.status === 'completed').length;
    const scheduled = maintenances.filter((m) => m.status === 'scheduled').length;
    const today = new Date().toISOString().split('T')[0];
    const overdue = maintenances.filter(
      (m) => m.status === 'scheduled' && m.scheduled_date < today
    ).length;
    const pdfsSent = pdfs.filter((p) => p.sent_at !== null).length;
    const pdfsNotSent = pdfs.filter((p) => p.sent_at === null).length;

    setStats({
      total: maintenances.length,
      completed,
      scheduled,
      overdue,
      pdfsSent,
      pdfsNotSent,
    });
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase.from('maintenance_schedules').insert({
        elevator_id: formData.elevator_id,
        scheduled_date: formData.scheduled_date,
        maintenance_type: formData.maintenance_type,
        assigned_technician_id: formData.assigned_technician_id || null,
        notes: formData.notes || null,
        status: 'scheduled',
      });

      if (error) throw error;

      alert('Mantenimiento programado exitosamente');
      setShowCreateModal(false);
      setFormData({
        elevator_id: '',
        scheduled_date: '',
        maintenance_type: 'preventive',
        assigned_technician_id: '',
        notes: '',
      });
      loadMaintenances();
    } catch (error: any) {
      console.error('Error creating maintenance:', error);
      alert('Error al programar mantenimiento: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPDF = async (pdf: PDFRecord) => {
    setDownloading(pdf.id);
    try {
      const pdfBlob = await generateMaintenancePDF(pdf as any);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generatePDFFilename(pdf.checklist.clients.company_name, pdf.folio_number);
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar PDF');
    } finally {
      setDownloading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'scheduled':
        return 'Programado';
      case 'in_progress':
        return 'En Progreso';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Mantenimientos</h1>
          <p className="text-slate-600 mt-1">Programación, historial y reportes PDF</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Programar Mantenimiento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <Wrench className="w-5 h-5 text-slate-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Total</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.completed}</p>
          <p className="text-sm text-slate-600">Completados</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <Clock className="w-5 h-5 text-blue-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.scheduled}</p>
          <p className="text-sm text-slate-600">Programados</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <AlertCircle className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.overdue}</p>
          <p className="text-sm text-slate-600">Vencidos</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <Mail className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.pdfsSent}</p>
          <p className="text-sm text-slate-600">PDFs Enviados</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <FileText className="w-5 h-5 text-orange-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.pdfsNotSent}</p>
          <p className="text-sm text-slate-600">PDFs Pendientes</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'schedule'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Programación
              </div>
            </button>
            <button
              onClick={() => setActiveTab('pdfs')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'pdfs'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Histórico PDFs
              </div>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'stats'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Estadísticas
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, marca o modelo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos los estados</option>
                  <option value="scheduled">Programados</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="completed">Completados</option>
                  <option value="cancelled">Cancelados</option>
                </select>
              </div>

              {filteredMaintenances.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay mantenimientos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMaintenances.map((maintenance) => (
                    <div
                      key={maintenance.id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-slate-900">
                              {maintenance.elevators?.clients?.company_name || 'Cliente'}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(maintenance.status)}`}>
                              {getStatusLabel(maintenance.status)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            {maintenance.elevators?.brand} {maintenance.elevators?.model} -{' '}
                            {maintenance.elevators?.location_name}
                          </p>
                          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {new Date(maintenance.scheduled_date).toLocaleDateString('es-ES')}
                            </div>
                            {maintenance.profiles && (
                              <div className="flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                {maintenance.profiles.full_name}
                              </div>
                            )}
                          </div>
                          {maintenance.notes && (
                            <p className="text-sm text-slate-600 mt-2 italic">{maintenance.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pdfs' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar PDFs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <select
                  value={sentFilter}
                  onChange={(e) => setSentFilter(e.target.value as any)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos</option>
                  <option value="sent">Enviados</option>
                  <option value="not_sent">No enviados</option>
                </select>
              </div>

              {filteredPdfs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay PDFs generados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPdfs.map((pdf) => (
                    <div
                      key={pdf.id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-slate-900">Folio #{pdf.folio_number}</h3>
                            {pdf.sent_at && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-semibold">
                                Enviado
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            {pdf.checklist?.clients?.company_name} - {pdf.checklist?.elevators?.brand}{' '}
                            {pdf.checklist?.elevators?.model}
                          </p>
                          <div className="flex gap-4 text-sm text-slate-600">
                            <span>
                              {new Date(
                                pdf.checklist?.year,
                                pdf.checklist?.month - 1
                              ).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                            </span>
                            <span>Técnico: {pdf.checklist?.profiles?.full_name}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => downloadPDF(pdf)}
                          disabled={downloading === pdf.id}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          <Download className="w-4 h-4" />
                          {downloading === pdf.id ? 'Descargando...' : 'Descargar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Estado de Mantenimientos</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Completados</span>
                      <span className="font-bold text-green-600">{stats.completed}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Programados</span>
                      <span className="font-bold text-blue-600">{stats.scheduled}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Vencidos</span>
                      <span className="font-bold text-red-600">{stats.overdue}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Reportes PDF</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Total generados</span>
                      <span className="font-bold text-slate-900">{pdfs.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Enviados</span>
                      <span className="font-bold text-green-600">{stats.pdfsSent}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Pendientes</span>
                      <span className="font-bold text-orange-600">{stats.pdfsNotSent}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Programar Mantenimiento</h3>

            <form onSubmit={handleCreateMaintenance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ascensor *</label>
                <select
                  required
                  value={formData.elevator_id}
                  onChange={(e) => setFormData({ ...formData, elevator_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar ascensor</option>
                  {elevators.map((elevator) => (
                    <option key={elevator.id} value={elevator.id}>
                      {elevator.clients?.company_name} - {elevator.brand} {elevator.model} ({elevator.serial_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tipo *</label>
                  <select
                    value={formData.maintenance_type}
                    onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="preventive">Preventivo</option>
                    <option value="corrective">Correctivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Técnico asignado</label>
                <select
                  value={formData.assigned_technician_id}
                  onChange={(e) => setFormData({ ...formData, assigned_technician_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sin asignar</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Programando...' : 'Programar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
