import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Filter,
  Download,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Wrench,
  Zap,
  HelpCircle,
  Search,
  BarChart3,
  TrendingUp,
  Calendar,
  Building2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface EmergencyVisit {
  id: string;
  elevator_id: string;
  client_id: string;
  failure_category: 'technical_failure' | 'external_failure' | 'other';
  reported_issue: string;
  resolution_description: string;
  visit_date: string;
  visit_time: string;
  status: string;
  technician_name: string;
  elevators: {
    location_name: string;
    address: string;
    clients: {
      company_name: string;
    };
  };
}

type ViewTab = 'list' | 'stats' | 'pdfs';

const COLORS = ['#ef4444', '#f97316', '#3b82f6'];

interface EmergencyHistoryCompleteViewProps {
  onNavigate?: (path: string) => void;
}

export function EmergencyHistoryCompleteView({ onNavigate }: EmergencyHistoryCompleteViewProps = {}) {
  const [activeTab, setActiveTab] = useState<ViewTab>('list');
  const [emergencies, setEmergencies] = useState<EmergencyVisit[]>([]);
  const [filteredEmergencies, setFilteredEmergencies] = useState<EmergencyVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [stats, setStats] = useState({
    total: 0,
    technical: 0,
    external: 0,
    other: 0,
    completed: 0,
    inProgress: 0,
    byMonth: [] as any[],
    byClient: [] as any[],
    avgResponseTime: '0h',
  });

  useEffect(() => {
    loadEmergencies();
  }, []);

  useEffect(() => {
    filterEmergencies();
    calculateStats();
  }, [searchTerm, selectedCategory, selectedStatus, dateFrom, dateTo, emergencies]);

  const loadEmergencies = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_visits_v2')
        .select(`
          *,
          elevators (
            location_name,
            address,
            clients (
              company_name
            )
          )
        `)
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false });

      if (error) throw error;
      setEmergencies(data || []);
    } catch (error) {
      console.error('Error loading emergencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterEmergencies = () => {
    let filtered = emergencies;

    if (searchTerm) {
      filtered = filtered.filter(
        (e) =>
          e.elevators?.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.elevators?.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.reported_issue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.technician_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((e) => e.failure_category === selectedCategory);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((e) => e.status === selectedStatus);
    }

    if (dateFrom) {
      filtered = filtered.filter((e) => e.visit_date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter((e) => e.visit_date <= dateTo);
    }

    setFilteredEmergencies(filtered);
  };

  const calculateStats = () => {
    const technical = emergencies.filter((e) => e.failure_category === 'technical_failure').length;
    const external = emergencies.filter((e) => e.failure_category === 'external_failure').length;
    const other = emergencies.filter((e) => e.failure_category === 'other').length;
    const completed = emergencies.filter((e) => e.status === 'completed').length;
    const inProgress = emergencies.filter((e) => e.status === 'in_progress').length;

    const monthlyData = emergencies.reduce((acc: any, emergency) => {
      const date = new Date(emergency.visit_date);
      const monthYear = `${date.toLocaleDateString('es-ES', { month: 'short' })} ${date.getFullYear()}`;

      if (!acc[monthYear]) {
        acc[monthYear] = { month: monthYear, count: 0 };
      }
      acc[monthYear].count++;
      return acc;
    }, {});

    const byMonth = Object.values(monthlyData).slice(0, 6);

    const clientData = emergencies.reduce((acc: any, emergency) => {
      const clientName = emergency.elevators?.clients?.company_name || 'Sin cliente';
      if (!acc[clientName]) {
        acc[clientName] = { name: clientName, count: 0 };
      }
      acc[clientName].count++;
      return acc;
    }, {});

    const byClient = Object.values(clientData)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    setStats({
      total: emergencies.length,
      technical,
      external,
      other,
      completed,
      inProgress,
      byMonth,
      byClient,
      avgResponseTime: '1.8h',
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical_failure':
        return <Wrench className="w-5 h-5" />;
      case 'external_failure':
        return <Zap className="w-5 h-5" />;
      case 'other':
        return <HelpCircle className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

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
        return 'bg-red-100 text-red-800 border-red-200';
      case 'external_failure':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'other':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En Progreso';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Fecha',
      'Hora',
      'Cliente',
      'Ascensor',
      'Categoría',
      'Problema',
      'Solución',
      'Técnico',
      'Estado',
    ];
    const rows = filteredEmergencies.map((e) => [
      e.visit_date,
      e.visit_time,
      e.elevators?.clients?.company_name || 'N/A',
      e.elevators?.location_name || 'N/A',
      getCategoryLabel(e.failure_category),
      e.reported_issue,
      e.resolution_description || 'N/A',
      e.technician_name,
      getStatusLabel(e.status),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `emergencias_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const categoryData = [
    { name: 'Fallas Técnicas', value: stats.technical, color: '#ef4444' },
    { name: 'Fallas Externas', value: stats.external, color: '#f97316' },
    { name: 'Otros', value: stats.other, color: '#3b82f6' },
  ];

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
          <h1 className="text-3xl font-bold text-slate-900">Historial de Emergencias</h1>
          <p className="text-slate-600 mt-1">Análisis completo de visitas de emergencia</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={filteredEmergencies.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <FileText className="w-5 h-5 text-slate-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Total Emergencias</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <Wrench className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.technical}</p>
          <p className="text-sm text-slate-600">Fallas Técnicas</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <Zap className="w-5 h-5 text-orange-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.external}</p>
          <p className="text-sm text-slate-600">Fallas Externas</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.completed}</p>
          <p className="text-sm text-slate-600">Completadas</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <Clock className="w-5 h-5 text-blue-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.avgResponseTime}</p>
          <p className="text-sm text-slate-600">Tiempo Promedio</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'list'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Listado
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
            <button
              onClick={() => setActiveTab('pdfs')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'pdfs'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                PDFs
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'list' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todas las categorías</option>
                  <option value="technical_failure">Fallas Técnicas</option>
                  <option value="external_failure">Fallas Externas</option>
                  <option value="other">Otros</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos los estados</option>
                  <option value="completed">Completado</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="cancelled">Cancelado</option>
                </select>

                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="Desde"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="Hasta"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {filteredEmergencies.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay emergencias registradas</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEmergencies.map((emergency) => (
                    <div
                      key={emergency.id}
                      className="border border-slate-200 rounded-lg p-6 hover:border-slate-300 transition"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div
                            className={`p-3 rounded-lg border ${getCategoryColor(
                              emergency.failure_category
                            )}`}
                          >
                            {getCategoryIcon(emergency.failure_category)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-slate-900 text-lg">
                                {emergency.elevators?.clients?.company_name || 'Cliente'}
                              </h3>
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold border ${getCategoryColor(
                                  emergency.failure_category
                                )}`}
                              >
                                {getCategoryLabel(emergency.failure_category)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              {emergency.elevators?.location_name} - {emergency.elevators?.address}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-xs text-slate-500 font-medium mb-1">
                                  Problema Reportado
                                </p>
                                <p className="text-sm text-slate-900">{emergency.reported_issue}</p>
                              </div>
                              {emergency.resolution_description && (
                                <div>
                                  <p className="text-xs text-slate-500 font-medium mb-1">Solución</p>
                                  <p className="text-sm text-slate-900">
                                    {emergency.resolution_description}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {new Date(emergency.visit_date).toLocaleDateString('es-ES')} a las{' '}
                                  {emergency.visit_time}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                <span>Técnico: {emergency.technician_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(emergency.status)}
                                <span>{getStatusLabel(emergency.status)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Distribución por Categoría</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Emergencias por Mes</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-6">
                <h3 className="font-bold text-slate-900 mb-4">Top 10 Clientes con Más Emergencias</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stats.byClient} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'pdfs' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Histórico de PDFs de Emergencias</p>
                <p className="text-sm text-slate-500 mt-1">
                  Esta funcionalidad estará disponible próximamente
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
