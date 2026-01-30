import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Settings,
  Filter,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download,
  MoreVertical,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { QuotationSettings } from '../quotations/QuotationSettings';
import { ExternalQuotationForm } from '../quotations/ExternalQuotationForm';
import { InternalQuotationForm } from '../quotations/InternalQuotationForm';

interface Quotation {
  id: string;
  quotation_number: string;
  client_id: string;
  quotation_date: string;
  expiry_date: string;
  urgency: 'urgent' | 'priority' | 'scheduled';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  type: 'external' | 'internal';
  total_amount: number;
  description: string;
  pdf_url?: string;
  clients: {
    name: string;
    company_name: string;
  };
  created_by_profile: {
    name: string;
    role: string;
  };
}

export function QuotationsManagementView() {
  const { user, profile } = useAuth();
  const [activeView, setActiveView] = useState<'list' | 'settings' | 'create-external' | 'create-internal'>('list');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [filteredQuotations, setFilteredQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (activeView === 'list') {
      loadQuotations();
    }
  }, [activeView]);

  useEffect(() => {
    filterQuotations();
  }, [quotations, searchTerm, statusFilter, urgencyFilter, typeFilter]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          *,
          clients:client_id (company_name, building_name),
          created_by_profile:created_by (full_name, role)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotations(data || []);
    } catch (error) {
      console.error('Error loading quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterQuotations = () => {
    let filtered = [...quotations];

    if (searchTerm) {
      filtered = filtered.filter(
        (q) =>
          q.quotation_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((q) => q.status === statusFilter);
    }

    if (urgencyFilter !== 'all') {
      filtered = filtered.filter((q) => q.urgency === urgencyFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((q) => q.type === typeFilter);
    }

    filtered.sort((a, b) => {
      const urgencyOrder = { urgent: 0, priority: 1, scheduled: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    setFilteredQuotations(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'in_progress':
        return 'En Proceso';
      case 'completed':
        return 'Completada';
      case 'rejected':
        return 'Rechazada';
      default:
        return status;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'text-red-600';
      case 'priority':
        return 'text-orange-600';
      case 'scheduled':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'Urgente';
      case 'priority':
        return 'Prioritaria';
      case 'scheduled':
        return 'Programable';
      default:
        return urgency;
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleDownloadPDF = async (pdfUrl: string) => {
    window.open(pdfUrl, '_blank');
  };

  if (activeView === 'settings') {
    return (
      <div className="p-6">
        <button
          onClick={() => setActiveView('list')}
          className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-2"
        >
          ← Volver a Cotizaciones
        </button>
        <QuotationSettings />
      </div>
    );
  }

  if (activeView === 'create-external') {
    return (
      <div className="p-6">
        <ExternalQuotationForm
          onSuccess={() => {
            setActiveView('list');
            loadQuotations();
          }}
          onCancel={() => setActiveView('list')}
        />
      </div>
    );
  }

  if (activeView === 'create-internal') {
    return (
      <div className="p-6">
        <InternalQuotationForm
          onSuccess={() => {
            setActiveView('list');
            loadQuotations();
          }}
          onCancel={() => setActiveView('list')}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Cotizaciones</h1>
        <p className="text-gray-600">
          Administra cotizaciones, configura alertas y gestiona el flujo completo
        </p>
      </div>

      {/* Botones de acción */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setActiveView('create-external')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" />
          Subir Cotización Externa
        </button>
        <button
          onClick={() => setActiveView('create-internal')}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <FileText className="h-4 w-4" />
          Crear Cotización Interna
        </button>
        <button
          onClick={() => setActiveView('settings')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <Settings className="h-4 w-4" />
          Configuración
        </button>
      </div>

      {/* Filtros y búsqueda */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Búsqueda */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número, cliente..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Estado */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="in_progress">En Proceso</option>
              <option value="completed">Completada</option>
              <option value="rejected">Rechazada</option>
            </select>
          </div>

          {/* Urgencia */}
          <div>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas las urgencias</option>
              <option value="urgent">Urgente</option>
              <option value="priority">Prioritaria</option>
              <option value="scheduled">Programable</option>
            </select>
          </div>

          {/* Tipo */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los tipos</option>
              <option value="external">Externa</option>
              <option value="internal">Interna</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Cotizaciones</p>
              <p className="text-2xl font-bold text-gray-900">{quotations.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600">
                {quotations.filter((q) => q.status === 'pending').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Urgentes</p>
              <p className="text-2xl font-bold text-red-600">
                {quotations.filter((q) => q.urgency === 'urgent' && q.status === 'pending').length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completadas</p>
              <p className="text-2xl font-bold text-green-600">
                {quotations.filter((q) => q.status === 'completed').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Lista de cotizaciones */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="text-center p-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No se encontraron cotizaciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Número
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha / Vigencia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Urgencia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQuotations.map((quotation) => {
                  const daysUntilExpiry = getDaysUntilExpiry(quotation.expiry_date);
                  const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;
                  const isExpired = daysUntilExpiry <= 0;

                  return (
                    <tr
                      key={quotation.id}
                      className={`hover:bg-gray-50 ${
                        quotation.urgency === 'urgent' ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {quotation.quotation_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {quotation.clients?.company_name || quotation.clients?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            quotation.type === 'external'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {quotation.type === 'external' ? 'Externa' : 'Interna'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${quotation.total_amount?.toLocaleString('es-CL') || '0'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(quotation.quotation_date).toLocaleDateString('es-CL')}
                        </div>
                        <div
                          className={`text-xs ${
                            isExpired
                              ? 'text-red-600 font-medium'
                              : isExpiringSoon
                              ? 'text-orange-600 font-medium'
                              : 'text-gray-500'
                          }`}
                        >
                          {isExpired
                            ? 'Vencida'
                            : isExpiringSoon
                            ? `Vence en ${daysUntilExpiry}d`
                            : `${daysUntilExpiry}d restantes`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getUrgencyColor(quotation.urgency)}`}>
                          {getUrgencyText(quotation.urgency)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                            quotation.status
                          )}`}
                        >
                          {getStatusText(quotation.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          {quotation.pdf_url && (
                            <button
                              onClick={() => handleDownloadPDF(quotation.pdf_url!)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Descargar PDF"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            className="text-gray-600 hover:text-gray-700"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-700" title="Más opciones">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
