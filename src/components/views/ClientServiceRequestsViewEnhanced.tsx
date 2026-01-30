import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  AlertTriangle,
  Package,
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  AlertCircle,
  Building2,
  Calendar,
  User,
  Download,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  TrendingUp,
  FileCheck,
  DollarSign,
  Zap,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface ServiceRequestWithDetails {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  request_type: string;
  source_type: string;
  photo_1_url: string | null;
  photo_2_url: string | null;
  created_at: string;
  reviewed_at: string | null;
  rejection_count: number;
  admin_notes: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  work_order_number: string | null;
  quotation_number: string | null;
  quotation_amount: number | null;
  elevators?: {
    elevator_number: number;
    location_name: string;
  };
  technician?: {
    full_name: string;
  };
}

interface WorkOrderPendingApproval {
  id: string;
  folio_number: string;
  service_request_id: string | null;
  building_id: string;
  description: string;
  status: string;
  quotation_amount: number | null;
  external_quotation_number: string | null;
  external_quotation_pdf_url: string | null;
  quotation_description: string | null;
  involves_foreign_parts: boolean;
  foreign_parts_supplier: string | null;
  foreign_parts_lead_time: string | null;
  work_warranty_months: number | null;
  work_warranty_description: string | null;
  parts_warranty_months: number | null;
  parts_warranty_description: string | null;
  advance_percentage: number | null;
  advance_amount: number | null;
  created_at: string;
  buildings?: {
    name: string;
    clients?: {
      company_name: string;
    };
  };
}

type ActiveView = 'service_requests' | 'pending_approvals' | 'history';

export const ClientServiceRequestsViewEnhanced: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestWithDetails[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderPendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('service_requests');
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'analyzing' | 'in_progress' | 'completed' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestWithDetails | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderPendingApproval | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [expandedWorkOrders, setExpandedWorkOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!profile?.id) return;
    
    try {
      setLoading(true);
      
      // Obtener cliente
      let { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!clientData && profile.email) {
        const { data: clientByEmail } = await supabase
          .from('clients')
          .select('id')
          .eq('contact_email', profile.email)
          .maybeSingle();
        clientData = clientByEmail;
      }

      if (!clientData) {
        setLoading(false);
        return;
      }

      // Cargar solicitudes de servicio
      const { data: srData } = await supabase
        .from('service_requests')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          request_type,
          source_type,
          photo_1_url,
          photo_2_url,
          created_at,
          reviewed_at,
          rejection_count,
          admin_notes,
          scheduled_date,
          scheduled_time,
          work_order_number,
          quotation_number,
          quotation_amount,
          elevators:elevator_id (
            elevator_number,
            location_name
          ),
          technician:created_by_technician_id (
            full_name
          )
        `)
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });

      if (srData) {
        const transformedData = (srData || []).map(item => ({
          ...item,
          elevators: Array.isArray(item.elevators) && item.elevators.length > 0 ? item.elevators[0] : item.elevators,
          technician: Array.isArray(item.technician) && item.technician.length > 0 ? item.technician[0] : item.technician
        }));
        setRequests(transformedData as any);
      }

      // Cargar órdenes de trabajo pendientes de aprobación
      const { data: woData } = await supabase
        .from('work_orders')
        .select(`
          id,
          folio_number,
          service_request_id,
          building_id,
          description,
          status,
          quotation_amount,
          external_quotation_number,
          external_quotation_pdf_url,
          quotation_description,
          involves_foreign_parts,
          foreign_parts_supplier,
          foreign_parts_lead_time,
          work_warranty_months,
          work_warranty_description,
          parts_warranty_months,
          parts_warranty_description,
          advance_percentage,
          advance_amount,
          created_at,
          buildings:building_id (
            name,
            clients:client_id (
              company_name
            )
          )
        `)
        .eq('buildings.client_id', clientData.id)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      if (woData) {
        const transformedWO = (woData || []).map(item => ({
          ...item,
          buildings: Array.isArray(item.buildings) && item.buildings.length > 0 ? item.buildings[0] : item.buildings
        }));
        setWorkOrders(transformedWO as any);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveWorkOrder = async (workOrderId: string) => {
    if (!profile?.id) return;
    
    try {
      setApproving(true);
      const { data, error } = await supabase
        .rpc('approve_work_order', {
          work_order_id: workOrderId,
          user_id: profile.id
        });

      if (error) throw error;

      // Actualizar lista
      setWorkOrders(workOrders.filter(wo => wo.id !== workOrderId));
      setShowWorkOrderModal(false);
      setSelectedWorkOrder(null);
    } catch (error) {
      console.error('Error approving work order:', error);
      alert('Error al aprobar la orden de trabajo');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectWorkOrder = async (workOrderId: string) => {
    if (!profile?.id || !rejectReason.trim()) {
      alert('Por favor ingrese una razón para el rechazo');
      return;
    }
    
    try {
      setRejecting(true);
      const { data, error } = await supabase
        .rpc('reject_work_order', {
          work_order_id: workOrderId,
          user_id: profile.id,
          reason: rejectReason
        });

      if (error) throw error;

      // Actualizar lista
      setWorkOrders(workOrders.filter(wo => wo.id !== workOrderId));
      setShowWorkOrderModal(false);
      setShowRejectModal(false);
      setSelectedWorkOrder(null);
      setRejectReason('');
    } catch (error) {
      console.error('Error rejecting work order:', error);
      alert('Error al rechazar la orden de trabajo');
    } finally {
      setRejecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      new: { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
      analyzing: { label: 'En Análisis', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle },
      in_progress: { label: 'En Progreso', color: 'bg-purple-100 text-purple-800', icon: Wrench },
      completed: { label: 'Completado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      pending_approval: { label: 'Pendiente Aprobación', color: 'bg-orange-100 text-orange-800', icon: Clock },
      approved: { label: 'Aprobado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
    };
    const config = statusConfig[status] || statusConfig.new;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: any = {
      emergency: { label: 'Emergencia', color: 'bg-red-500 text-white' },
      high: { label: 'Alta', color: 'bg-orange-500 text-white' },
      medium: { label: 'Media', color: 'bg-yellow-500 text-white' },
      low: { label: 'Baja', color: 'bg-green-500 text-white' },
    };
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getRequestTypeIcon = (type: string) => {
    const icons: any = {
      emergency: AlertTriangle,
      parts: Package,
      external: Wrench,
      internal: Wrench,
    };
    return icons[type] || Wrench;
  };


  const filteredRequests = activeTab === 'all' 
    ? requests 
    : requests.filter(r => r.status === activeTab);

  const stats = {
    total: requests.length,
    new: requests.filter(r => r.status === 'new').length,
    analyzing: requests.filter(r => r.status === 'analyzing').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const toggleExpandWorkOrder = (woId: string) => {
    const newExpanded = new Set(expandedWorkOrders);
    if (newExpanded.has(woId)) {
      newExpanded.delete(woId);
    } else {
      newExpanded.add(woId);
    }
    setExpandedWorkOrders(newExpanded);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header con Navegación */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-blue-600" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">Mis Solicitudes de Servicio</h2>
              <p className="text-sm text-slate-600">Seguimiento de solicitudes, aprobaciones e historial</p>
            </div>
          </div>

          {/* Tabs de Navegación */}
          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveView('service_requests')}
              className={`px-4 py-3 font-medium transition border-b-2 ${
                activeView === 'service_requests'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Solicitudes ({requests.length})
              </div>
            </button>
            <button
              onClick={() => setActiveView('pending_approvals')}
              className={`px-4 py-3 font-medium transition border-b-2 ${
                activeView === 'pending_approvals'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Aprobaciones Pendientes ({workOrders.length})
              </div>
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-4 py-3 font-medium transition border-b-2 ${
                activeView === 'history'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Historial
              </div>
            </button>
          </div>
        </div>

        {/* VISTA 1: SOLICITUDES DE SERVICIO */}
        {activeView === 'service_requests' && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            {/* Estadísticas */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <button
                onClick={() => setActiveTab('all')}
                className={`p-4 rounded-lg border-2 transition ${
                  activeTab === 'all' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm text-slate-600 mb-1">Total</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </button>
              
              <button
                onClick={() => setActiveTab('new')}
                className={`p-4 rounded-lg border-2 transition ${
                  activeTab === 'new' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm text-blue-600 mb-1">Nuevos</p>
                <p className="text-2xl font-bold text-blue-900">{stats.new}</p>
              </button>

              <button
                onClick={() => setActiveTab('analyzing')}
                className={`p-4 rounded-lg border-2 transition ${
                  activeTab === 'analyzing' 
                    ? 'border-yellow-500 bg-yellow-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm text-yellow-600 mb-1">Análisis</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.analyzing}</p>
              </button>

              <button
                onClick={() => setActiveTab('in_progress')}
                className={`p-4 rounded-lg border-2 transition ${
                  activeTab === 'in_progress' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm text-purple-600 mb-1">En Progreso</p>
                <p className="text-2xl font-bold text-purple-900">{stats.in_progress}</p>
              </button>

              <button
                onClick={() => setActiveTab('completed')}
                className={`p-4 rounded-lg border-2 transition ${
                  activeTab === 'completed' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm text-green-600 mb-1">Completados</p>
                <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
              </button>

              <button
                onClick={() => setActiveTab('rejected')}
                className={`p-4 rounded-lg border-2 transition ${
                  activeTab === 'rejected' 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm text-red-600 mb-1">Rechazados</p>
                <p className="text-2xl font-bold text-red-900">{stats.rejected}</p>
              </button>
            </div>

            {/* Lista de Solicitudes */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border-2 border-slate-200 rounded-lg">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">No hay solicitudes en esta categoría</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((request) => {
                  const TypeIcon = getRequestTypeIcon(request.request_type);
                  return (
                    <div
                      key={request.id}
                      className="p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-300 transition cursor-pointer"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowRequestModal(true);
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <TypeIcon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-1">{request.title}</h3>
                            <p className="text-sm text-slate-600 line-clamp-2">{request.description}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                              <Building2 className="w-3 h-3" />
                              <span>
                                Ascensor {request.elevators?.elevator_number} - {request.elevators?.location_name}
                              </span>
                              {request.technician && (
                                <>
                                  <span>•</span>
                                  <User className="w-3 h-3" />
                                  <span>{request.technician.full_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(request.status)}
                          {getPriorityBadge(request.priority)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(request.created_at).toLocaleDateString('es-CL')}</span>
                          </div>
                          {request.scheduled_date && (
                            <div className="flex items-center gap-1 text-purple-600">
                              <Clock className="w-3 h-3" />
                              <span>Programado: {new Date(request.scheduled_date).toLocaleDateString('es-CL')}</span>
                            </div>
                          )}
                        </div>
                        <button className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Ver Detalles
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VISTA 2: APROBACIONES PENDIENTES */}
        {activeView === 'pending_approvals' && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : workOrders.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border-2 border-slate-200 rounded-lg">
                <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">No hay órdenes de trabajo pendientes de aprobación</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workOrders.map((wo) => {
                  return (
                    <div
                      key={wo.id}
                      className="border-2 rounded-xl transition border-slate-200 hover:border-blue-300"
                    >
                      {/* Header colapsable */}
                      <div
                        onClick={() => toggleExpandWorkOrder(wo.id)}
                        className="p-4 cursor-pointer flex items-start justify-between"
                      >
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 rounded-lg bg-blue-100">
                            <Zap className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-slate-900">{wo.folio_number}</h3>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {wo.buildings?.name}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">{wo.description}</p>
                            
                            {/* Info rápida */}
                            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                              {wo.quotation_amount && (
                                <div className="flex items-center gap-1 font-semibold text-slate-900">
                                  <DollarSign className="w-3 h-3 text-green-600" />
                                  ${wo.quotation_amount.toLocaleString('es-CL')}
                                </div>
                              )}
                              {wo.advance_amount && (
                                <div className="flex items-center gap-1 text-orange-600">
                                  <TrendingUp className="w-3 h-3" />
                                  Adelanto: ${wo.advance_amount.toLocaleString('es-CL')}
                                </div>
                              )}
                              {wo.work_warranty_months && (
                                <div className="flex items-center gap-1 text-blue-600">
                                  <Shield className="w-3 h-3" />
                                  Garantía: {wo.work_warranty_months} meses
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <button className="p-2 hover:bg-slate-100 rounded-lg transition">
                          {expandedWorkOrders.has(wo.id) ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </div>

                      {/* Detalles expandidos */}
                      {expandedWorkOrders.has(wo.id) && (
                        <div className="border-t border-slate-200 p-4 space-y-4">
                          {/* Cotización Externa */}
                          {wo.external_quotation_number && (
                            <div className="p-3 bg-slate-50 rounded-lg">
                              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <FileCheck className="w-4 h-4 text-blue-600" />
                                Cotización Externa
                              </h4>
                              <div className="space-y-1 text-sm text-slate-600">
                                <p><span className="font-medium">Número:</span> {wo.external_quotation_number}</p>
                                {wo.quotation_description && (
                                  <p><span className="font-medium">Descripción:</span> {wo.quotation_description}</p>
                                )}
                                {wo.external_quotation_pdf_url && (
                                  <a
                                    href={wo.external_quotation_pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium mt-2"
                                  >
                                    <Download className="w-3 h-3" />
                                    Descargar PDF
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Repuestos y importación */}
                          {(wo.involves_foreign_parts || wo.foreign_parts_supplier || wo.foreign_parts_lead_time) && (
                            <div className="p-3 bg-slate-50 rounded-lg">
                              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <Package className="w-4 h-4 text-blue-600" />
                                Repuestos / Importación
                              </h4>
                              <div className="space-y-1 text-sm text-slate-600">
                                {wo.involves_foreign_parts && (
                                  <p className="font-medium text-slate-800">Incluye compras en el extranjero</p>
                                )}
                                {wo.foreign_parts_supplier && (
                                  <p><span className="font-medium">Proveedor/País:</span> {wo.foreign_parts_supplier}</p>
                                )}
                                {wo.foreign_parts_lead_time && (
                                  <p className="text-orange-700 font-semibold">
                                    ⏱️ Plazo estimado de importación: {wo.foreign_parts_lead_time}
                                  </p>
                                )}
                                {!wo.foreign_parts_lead_time && wo.involves_foreign_parts && (
                                  <p className="text-xs text-slate-500">El plazo de importación se confirmará con el proveedor.</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Garantías */}
                          {(wo.work_warranty_months || wo.parts_warranty_months) && (
                            <div className="p-3 bg-slate-50 rounded-lg">
                              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-blue-600" />
                                Garantías
                              </h4>
                              <div className="grid grid-cols-2 gap-3">
                                {wo.work_warranty_months && (
                                  <div className="text-sm">
                                    <p className="font-medium text-slate-900">Trabajo</p>
                                    <p className="text-slate-600">{wo.work_warranty_months} meses</p>
                                    {wo.work_warranty_description && (
                                      <p className="text-xs text-slate-500 mt-1">{wo.work_warranty_description}</p>
                                    )}
                                  </div>
                                )}
                                {wo.parts_warranty_months && (
                                  <div className="text-sm">
                                    <p className="font-medium text-slate-900">Repuestos</p>
                                    <p className="text-slate-600">{wo.parts_warranty_months} meses</p>
                                    {wo.parts_warranty_description && (
                                      <p className="text-xs text-slate-500 mt-1">{wo.parts_warranty_description}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Adelantos */}
                          {wo.advance_percentage && (
                            <div className="p-3 bg-slate-50 rounded-lg">
                              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-orange-600" />
                                Adelanto de Pago
                              </h4>
                              <div className="text-sm text-slate-600">
                                <p><span className="font-medium">Porcentaje:</span> {wo.advance_percentage}%</p>
                                <p><span className="font-medium">Monto:</span> ${wo.advance_amount?.toLocaleString('es-CL') || '0'}</p>
                              </div>
                            </div>
                          )}

                          {/* Botones de acción */}
                          <div className="flex gap-2 pt-2 border-t border-slate-200">
                            <button
                              onClick={() => {
                                setSelectedWorkOrder(wo);
                                setShowWorkOrderModal(true);
                              }}
                              disabled={approving}
                              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                            >
                              {approving ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Aprobando...
                                </>
                              ) : (
                                <>
                                  <ThumbsUp className="w-4 h-4" />
                                  Aprobar
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedWorkOrder(wo);
                                setShowRejectModal(true);
                              }}
                              disabled={rejecting}
                              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                            >
                              {rejecting ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Rechazando...
                                </>
                              ) : (
                                <>
                                  <ThumbsDown className="w-4 h-4" />
                                  Rechazar
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VISTA 3: HISTORIAL */}
        {activeView === 'history' && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="text-center py-12 bg-slate-50 border-2 border-slate-200 rounded-lg">
              <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Sección de historial en desarrollo</p>
              <p className="text-xs text-slate-500 mt-2">Aquí aparecerán órdenes completadas y documentos finales</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal - Detalle de Solicitud de Servicio */}
      {showRequestModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{selectedRequest.title}</h3>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedRequest.status)}
                    {getPriorityBadge(selectedRequest.priority)}
                  </div>
                </div>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Información del Ascensor */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Información del Equipo
                </h4>
                <p className="text-sm text-slate-600">
                  Ascensor {selectedRequest.elevators?.elevator_number} - {selectedRequest.elevators?.location_name}
                </p>
              </div>

              {/* Descripción */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Descripción</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedRequest.description}</p>
              </div>

              {/* Fotos */}
              {(selectedRequest.photo_1_url || selectedRequest.photo_2_url) && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Fotos Adjuntas</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedRequest.photo_1_url && (
                      <img
                        src={selectedRequest.photo_1_url}
                        alt="Foto 1"
                        className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                        onClick={() => setZoomedPhoto(selectedRequest.photo_1_url)}
                      />
                    )}
                    {selectedRequest.photo_2_url && (
                      <img
                        src={selectedRequest.photo_2_url}
                        alt="Foto 2"
                        className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                        onClick={() => setZoomedPhoto(selectedRequest.photo_2_url)}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Información adicional */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Fecha de Creación</p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(selectedRequest.created_at).toLocaleString('es-CL')}
                  </p>
                </div>
                {selectedRequest.reviewed_at && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Fecha de Revisión</p>
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(selectedRequest.reviewed_at).toLocaleString('es-CL')}
                    </p>
                  </div>
                )}
              </div>

              {/* Notas del Admin */}
              {selectedRequest.admin_notes && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 mb-2">Notas del Administrador</h4>
                  <p className="text-sm text-yellow-800 whitespace-pre-wrap">{selectedRequest.admin_notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setShowRequestModal(false)}
                className="w-full px-4 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Detalle de Orden de Trabajo */}
      {showWorkOrderModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{selectedWorkOrder.folio_number}</h3>
                  <p className="text-sm text-slate-600">{selectedWorkOrder.description}</p>
                </div>
                <button
                  onClick={() => setShowWorkOrderModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Resumen de Costos */}
              {selectedWorkOrder.quotation_amount && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Información de Costos
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-800">Monto Total:</span>
                      <span className="font-bold text-blue-900">${selectedWorkOrder.quotation_amount.toLocaleString('es-CL')}</span>
                    </div>
                    {selectedWorkOrder.advance_amount && (
                      <div className="flex justify-between">
                        <span className="text-blue-800">Adelanto ({selectedWorkOrder.advance_percentage}%):</span>
                        <span className="font-bold text-orange-600">${selectedWorkOrder.advance_amount.toLocaleString('es-CL')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Garantías */}
              {(selectedWorkOrder.work_warranty_months || selectedWorkOrder.parts_warranty_months) && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Garantías
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedWorkOrder.work_warranty_months && (
                      <div>
                        <p className="font-medium text-green-900">Garantía de Trabajo: {selectedWorkOrder.work_warranty_months} meses</p>
                        {selectedWorkOrder.work_warranty_description && (
                          <p className="text-green-800 text-xs mt-1">{selectedWorkOrder.work_warranty_description}</p>
                        )}
                      </div>
                    )}
                    {selectedWorkOrder.parts_warranty_months && (
                      <div>
                        <p className="font-medium text-green-900">Garantía de Repuestos: {selectedWorkOrder.parts_warranty_months} meses</p>
                        {selectedWorkOrder.parts_warranty_description && (
                          <p className="text-green-800 text-xs mt-1">{selectedWorkOrder.parts_warranty_description}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-2 pt-4 border-t border-slate-200">
                <button
                  onClick={() => handleApproveWorkOrder(selectedWorkOrder.id)}
                  disabled={approving}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  {approving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Aprobando...
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="w-4 h-4" />
                      Aprobar Orden
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowWorkOrderModal(false);
                    setShowRejectModal(true);
                  }}
                  disabled={rejecting}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  {rejecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Rechazando...
                    </>
                  ) : (
                    <>
                      <ThumbsDown className="w-4 h-4" />
                      Rechazar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Rechazar Orden */}
      {showRejectModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Rechazar Orden de Trabajo</h3>
              <p className="text-sm text-slate-600 mt-1">{selectedWorkOrder.folio_number}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Razón del Rechazo *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Indique por qué rechaza esta orden de trabajo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  rows={4}
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRejectWorkOrder(selectedWorkOrder.id)}
                disabled={rejecting || !rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition"
              >
                {rejecting ? 'Rechazando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Zoom de Foto */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50"
          onClick={() => setZoomedPhoto(null)}
        >
          <img
            src={zoomedPhoto}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
};
