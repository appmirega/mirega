import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle,
  Package,
  Users,
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  TrendingUp,
  AlertCircle,
  Plus,
} from 'lucide-react';
import type { ServiceRequest } from '../../types/serviceRequests';
import { ManualServiceRequestForm } from '../forms/ManualServiceRequestForm';

interface ServiceRequestWithDetails extends ServiceRequest {
  elevators?: {
    elevator_number: number;
    location_name: string;
    brand: string;
    model: string;
  };
  clients?: {
    company_name: string;
    building_name: string;
    address: string;
  };
  technician?: {
    full_name: string;
    email: string;
  };
}

export function ServiceRequestsDashboard({ onNavigate }: { onNavigate?: (path: string, clientId?: string) => void }) {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'new' | 'analyzing' | 'rejected' | 'in_progress' | 'completed'>('new');
  const [showManualForm, setShowManualForm] = useState(false);
  
  // Estadísticas separadas por estado
  const [stats, setStats] = useState({
    new: 0,
    analyzing: 0,
    rejected: 0,
    in_progress: 0,
    completed: 0,
    critical_count: 0,
  });
  
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestWithDetails | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalAction, setApprovalAction] = useState<'internal' | 'parts' | 'external' | null>(null);
  
  // Comentarios/Respuestas
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isRejectionResponse, setIsRejectionResponse] = useState(false);
  
  // Estados para Trabajo Interno
  const [showInternalWorkForm, setShowInternalWorkForm] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [workOrder, setWorkOrder] = useState({
    assigned_technicians: [] as string[],
    scheduled_date: '',
    scheduled_time: '',
    estimated_hours: '',
    notes: '',
  });

  // Estados para Cotización/Repuestos - Vinculación manual
  const [showPartsForm, setShowPartsForm] = useState(false);
  const [partsRequest, setPartsRequest] = useState({
    work_order_number: '',
    quotation_number: '',
    quotation_amount: '',
    notes: '',
  });

  // Estados para Apoyo Externo
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [externalWork, setExternalWork] = useState({
    is_reminder: false, // Si es solo recordatorio
    provider_name: '',
    scheduled_date: '',
    notes: '',
  });

  // Estado para zoom de fotos
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  
  const [taxRate] = useState(19); // IVA 19%
  
  // Verificar permisos
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isTechnician = profile?.role === 'technician';

  console.log('🔐 Permisos:', { role: profile?.role, isAdmin, isTechnician });

  useEffect(() => {
    loadRequests();
    if (isAdmin) {
      loadTechnicians();
    }
  }, [activeTab]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
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
          created_by_technician_id,
          assigned_to_admin_id,
          reviewed_at,
          rejection_count,
          last_rejection_at,
          last_response_at,
          admin_notes,
          assigned_technicians,
          scheduled_date,
          scheduled_time,
          estimated_hours,
          work_order_number,
          quotation_number,
          quotation_amount,
          provider_name,
          client_id,
          elevator_id,
          elevators:elevator_id (
            elevator_number,
            location_name,
            brand,
            model
          ),
          clients:client_id (
            company_name,
            building_name,
            address
          ),
          technician:created_by_technician_id (
            full_name,
            email
          )
        `)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      // Filtrar por rol
      if (isTechnician) {
        // Técnico solo ve sus propias solicitudes
        query = query.eq('created_by_technician_id', profile?.id);
      }

      // Filtrar por tab activo
      if (activeTab === 'new') {
        query = query.eq('status', 'pending');
      } else if (activeTab === 'analyzing') {
        query = query.eq('status', 'analyzing');
      } else if (activeTab === 'rejected') {
        query = query.eq('status', 'rejected');
      } else if (activeTab === 'in_progress') {
        query = query.eq('status', 'in_progress');
      } else if (activeTab === 'completed') {
        query = query.eq('status', 'completed');
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('🔍 Solicitudes cargadas:', data?.length);
      console.log('📸 Primera solicitud con fotos:', data?.find(r => r.photo_1_url || r.photo_2_url));

      setRequests(data || []);

      // Calcular estadísticas (todas las solicitudes para las tabs)
      let statsQuery = supabase
        .from('service_requests')
        .select('id, status, priority, created_by_technician_id');

      // Si es técnico, solo contar sus solicitudes
      if (isTechnician) {
        statsQuery = statsQuery.eq('created_by_technician_id', profile?.id);
      }

      const { data: allData } = await statsQuery;

      const newRequests = allData?.filter(r => r.status === 'pending').length || 0;
      const analyzing = allData?.filter(r => r.status === 'analyzing').length || 0;
      const rejected = allData?.filter(r => r.status === 'rejected').length || 0;
      const inProgress = allData?.filter(r => r.status === 'in_progress').length || 0;
      const completed = allData?.filter(r => r.status === 'completed').length || 0;
      const critical = allData?.filter(r => r.priority === 'critical').length || 0;
      const highPriority = allData?.filter(r => r.priority === 'high').length || 0;

      setStats({
        new: newRequests,
        analyzing,
        rejected,
        in_progress: inProgress,
        completed,
        critical_count: critical,
        high_priority_count: highPriority,
      });
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'technician')
        .order('full_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  // Cargar comentarios de una solicitud
  const loadComments = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from('service_request_comments')
        .select(`
          *,
          user:user_id (
            full_name,
            email,
            role
          )
        `)
        .eq('service_request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  // Abrir modal de comentarios
  const handleViewComments = async (request: ServiceRequestWithDetails) => {
    console.log('📋 Ver Detalles - Request completo:', request);
    console.log('📸 Fotos en request:', {
      photo_1_url: request.photo_1_url,
      photo_2_url: request.photo_2_url
    });
    setSelectedRequest(request);
    await loadComments(request.id);
    setShowCommentsModal(true);
    setIsRejectionResponse(request.status === 'rejected' && isTechnician);
  };

  // Enviar comentario o respuesta
  const submitComment = async () => {
    if (!selectedRequest || !newComment.trim()) {
      alert('Debes escribir un comentario');
      return;
    }

    try {
      // Insertar comentario
      const { error: commentError } = await supabase
        .from('service_request_comments')
        .insert({
          service_request_id: selectedRequest.id,
          user_id: profile?.id,
          comment: newComment,
          comment_type: isRejectionResponse ? 'rejection_response' : 'general',
          is_rejection_response: isRejectionResponse,
          resolves_rejection: isRejectionResponse, // Si es respuesta a rechazo, lo resuelve
        });

      if (commentError) throw commentError;

      // Si es respuesta a rechazo, cambiar estado a pending
      if (isRejectionResponse && selectedRequest.status === 'rejected') {
        const { error: updateError } = await supabase
          .from('service_requests')
          .update({
            status: 'pending',
            last_response_at: new Date().toISOString(),
            last_technician_action_at: new Date().toISOString(),
          })
          .eq('id', selectedRequest.id);

        if (updateError) throw updateError;

        // Registrar en historial
        await supabase.from('service_request_history').insert({
          service_request_id: selectedRequest.id,
          changed_by: profile?.id,
          change_type: 'reopened',
          old_status: 'rejected',
          new_status: 'pending',
          change_description: 'Solicitud reabierta con información adicional del técnico',
        });

        alert('✅ Respuesta enviada. La solicitud vuelve a la lista de pendientes para revisión');
      } else {
        alert('✅ Comentario agregado');
      }

      // Recargar comentarios y solicitudes
      await loadComments(selectedRequest.id);
      loadRequests();
      setNewComment('');
      
      if (isRejectionResponse) {
        setShowCommentsModal(false);
        setIsRejectionResponse(false);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al enviar comentario');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'NUEVA';
      case 'analyzing': return 'PENDIENTE';
      case 'approved': return 'APROBADA';
      case 'rejected': return 'RECHAZADA';
      case 'in_progress': return 'EN PROCESO';
      case 'completed': return 'COMPLETADA';
      default: return status.toUpperCase();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case 'repair':
        return <Wrench className="w-5 h-5" />;
      case 'parts':
        return <Package className="w-5 h-5" />;
      case 'support':
        return <Users className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Hace menos de 1 hora';
    if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    // Solo admin puede cambiar estados
    if (!isAdmin) {
      alert('No tienes permisos para cambiar el estado de solicitudes');
      return;
    }

    try {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: newStatus,
          assigned_to_admin_id: profile?.id,
          reviewed_at: new Date().toISOString(),
          last_admin_action_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      // Recargar sin alert
      await loadRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    }
  };

  const handleApprove = (request: ServiceRequestWithDetails) => {
    if (!isAdmin) {
      alert('Solo administradores pueden aprobar solicitudes');
      return;
    }
    setSelectedRequest(request);
    setShowApprovalModal(true);
  };

  const handleReject = (request: ServiceRequestWithDetails) => {
    if (!isAdmin) {
      alert('Solo administradores pueden rechazar solicitudes');
      return;
    }
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const submitApproval = async () => {
    if (!selectedRequest || !approvalAction) {
      alert('Debe seleccionar una acción');
      return;
    }

    // Cerrar modal de selección de acción
    setShowApprovalModal(false);

    // Abrir formulario según la acción seleccionada
    if (approvalAction === 'internal') {
      setShowInternalWorkForm(true);
    } else if (approvalAction === 'parts') {
      setShowPartsForm(true);
    } else if (approvalAction === 'external') {
      setShowExternalForm(true);
    }
  };

  const submitInternalWork = async () => {
    if (!selectedRequest || workOrder.assigned_technicians.length === 0 || !workOrder.scheduled_date) {
      alert('Debe asignar al menos un técnico y una fecha');
      return;
    }

    try {
      // Actualizar estado de solicitud
      const { error: requestError } = await supabase
        .from('service_requests')
        .update({
          status: 'approved',
          assigned_to_admin_id: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (requestError) throw requestError;

      // Crear orden de trabajo (usaremos la tabla service_requests con campos adicionales)
      const { error: workError } = await supabase
        .from('service_requests')
        .update({
          assigned_technicians: workOrder.assigned_technicians,
          scheduled_date: workOrder.scheduled_date,
          scheduled_time: workOrder.scheduled_time,
          estimated_hours: parseFloat(workOrder.estimated_hours) || null,
          admin_notes: workOrder.notes,
          status: 'in_progress',
        })
        .eq('id', selectedRequest.id);

      if (workError) throw workError;

      alert('✅ Trabajo asignado exitosamente');
      setShowInternalWorkForm(false);
      setWorkOrder({
        assigned_technicians: [],
        scheduled_date: '',
        scheduled_time: '',
        estimated_hours: '',
        notes: '',
      });
      setApprovalAction(null);
      setSelectedRequest(null);
      
      // Cambiar a tab "En Proceso"
      setActiveTab('in_progress');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al asignar trabajo');
    }
  };

  const submitPartsRequest = async () => {
    if (!selectedRequest || !partsRequest.work_order_number.trim() || !partsRequest.quotation_number.trim()) {
      alert('Debe ingresar número de OT y cotización');
      return;
    }

    try {
      // Actualizar solicitud con información de repuestos
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'approved',
          work_order_number: partsRequest.work_order_number,
          quotation_number: partsRequest.quotation_number,
          quotation_amount: partsRequest.quotation_amount ? parseFloat(partsRequest.quotation_amount) : null,
          admin_notes: partsRequest.notes,
          assigned_to_admin_id: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      alert('✅ Solicitud de repuestos vinculada exitosamente');
      setShowPartsForm(false);
      setPartsRequest({
        work_order_number: '',
        quotation_number: '',
        quotation_amount: '',
        notes: '',
      });
      setApprovalAction(null);
      setSelectedRequest(null);
      loadRequests();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al vincular repuestos');
    }
  };

  const submitExternalWork = async () => {
    if (!selectedRequest) return;

    // Si es recordatorio, solo agregar notas
    if (externalWork.is_reminder) {
      if (!externalWork.notes.trim()) {
        alert('Debe agregar notas para el recordatorio');
        return;
      }

      try {
        const { error } = await supabase
          .from('service_requests')
          .update({
            admin_notes: externalWork.notes,
            assigned_to_admin_id: profile?.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', selectedRequest.id);

        if (error) throw error;

        alert('✅ Recordatorio agregado a la solicitud');
        setShowExternalForm(false);
        setExternalWork({
          is_reminder: false,
          provider_name: '',
          scheduled_date: '',
          notes: '',
        });
        setApprovalAction(null);
        setSelectedRequest(null);
        loadRequests();
      } catch (error) {
        console.error('Error:', error);
        alert('Error al agregar recordatorio');
      }
    } else {
      // Si es asignación de proveedor, validar campos
      if (!externalWork.provider_name.trim() || !externalWork.scheduled_date) {
        alert('Debe ingresar nombre del proveedor y fecha programada');
        return;
      }

      try {
        const { error } = await supabase
          .from('service_requests')
          .update({
            status: 'in_progress',
            provider_name: externalWork.provider_name,
            scheduled_date: externalWork.scheduled_date,
            admin_notes: externalWork.notes,
            assigned_to_admin_id: profile?.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', selectedRequest.id);

        if (error) throw error;

        alert('✅ Proveedor externo asignado exitosamente');
        setShowExternalForm(false);
        setExternalWork({
          is_reminder: false,
          provider_name: '',
          scheduled_date: '',
          notes: '',
        });
        setApprovalAction(null);
        setSelectedRequest(null);
        
        // Cambiar a tab "En Proceso"
        setActiveTab('in_progress');
      } catch (error) {
        console.error('Error:', error);
        alert('Error al asignar proveedor externo');
      }
    }
  };

  const submitReject = async () => {
    if (!selectedRequest || !rejectReason.trim()) {
      alert('Debe ingresar un motivo');
      return;
    }

    try {
      // Actualizar solicitud
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'rejected',
          assigned_to_admin_id: profile?.id,
          reviewed_at: new Date().toISOString(),
          last_admin_action_at: new Date().toISOString(),
          admin_notes: rejectReason,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Registrar en historial
      await supabase.from('service_request_history').insert({
        service_request_id: selectedRequest.id,
        changed_by: profile?.id,
        change_type: 'rejection',
        old_status: selectedRequest.status,
        new_status: 'rejected',
        change_details: { rejection_reason: rejectReason },
        change_description: `Solicitud rechazada: ${rejectReason}`,
      });

      alert('✅ Solicitud rechazada. El técnico será notificado.');
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedRequest(null);
      
      // Si estamos en tab pending, recargar; si no, cambiar a rejected
      if (activeTab !== 'rejected' && isAdmin) {
        // Admin puede querer ver las rechazadas
        setActiveTab('rejected');
      } else {
        loadRequests();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al rechazar solicitud');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Solicitudes de Servicio</h1>
            <p className="text-gray-600">Gestión centralizada de solicitudes desde mantenimiento y emergencias</p>
          </div>
          <button
            onClick={() => setShowManualForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-md"
          >
            <Plus className="w-5 h-5" />
            Nueva Solicitud
          </button>
        </div>

        {/* Manual Form Modal */}
        {showManualForm && (
          <ManualServiceRequestForm
            onClose={() => setShowManualForm(false)}
            onSuccess={() => loadRequests()}
          />
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pendientes</p>
                <p className="text-3xl font-bold text-gray-900">{stats.analyzing}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Críticas</p>
                <p className="text-3xl font-bold text-red-600">{stats.critical_count}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Alta Prioridad</p>
                <p className="text-3xl font-bold text-orange-600">{stats.high_priority_count}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">En Progreso</p>
                <p className="text-3xl font-bold text-green-600">{stats.in_progress}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs por Estado */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'new'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              Nuevas
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'new' 
                  ? 'bg-white text-blue-600' 
                  : 'bg-blue-600 text-white'
              }`}>
                {stats.new}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('analyzing')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'analyzing'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Pendientes
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'analyzing' 
                  ? 'bg-white text-yellow-600' 
                  : 'bg-yellow-600 text-white'
              }`}>
                {stats.analyzing}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'rejected'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <XCircle className="w-4 h-4" />
              Rechazadas
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'rejected' 
                  ? 'bg-white text-red-600' 
                  : 'bg-red-600 text-white'
              }`}>
                {stats.rejected}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'in_progress'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              En Proceso
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'in_progress' 
                  ? 'bg-white text-green-600' 
                  : 'bg-green-600 text-white'
              }`}>
                {stats.in_progress}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'completed'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Completadas
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'completed' 
                  ? 'bg-white text-purple-600' 
                  : 'bg-purple-600 text-white'
              }`}>
                {stats.completed}
              </span>
            </button>
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Cargando solicitudes...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-xl font-semibold text-gray-900 mb-2">No hay solicitudes pendientes</p>
              <p className="text-gray-600">Todas las solicitudes han sido atendidas</p>
            </div>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-gray-100 p-2 rounded-lg">
                        {getRequestTypeIcon(request.request_type)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{request.title}</h3>
                        <p className="text-sm text-gray-600">
                          <button
                            onClick={() =>
                              onNavigate?.(
                                'client-profile',
                                request.client_id,
                              )
                            }
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {request.clients?.company_name ||
                              request.clients?.building_name}
                          </button>
                          {' - Ascensor #'}
                          {request.elevators?.elevator_number}
                        </p>
                      </div>
                    </div>

                    <p className="text-gray-700 mb-4">{request.description}</p>

                    {/* Fotos */}
                    {(request.photo_1_url || request.photo_2_url) && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Evidencia Fotográfica:</p>
                        <div className="flex gap-2">
                          {request.photo_1_url && (
                            <a
                              href={request.photo_1_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition"
                            >
                              <img
                                src={request.photo_1_url}
                                alt="Foto 1"
                                className="w-full h-full object-cover group-hover:scale-110 transition"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition flex items-center justify-center">
                                <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-semibold">Ver</span>
                              </div>
                            </a>
                          )}
                          {request.photo_2_url && (
                            <a
                              href={request.photo_2_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition"
                            >
                              <img
                                src={request.photo_2_url}
                                alt="Foto 2"
                                className="w-full h-full object-cover group-hover:scale-110 transition"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition flex items-center justify-center">
                                <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-semibold">Ver</span>
                              </div>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {getTimeAgo(request.created_at)}
                      </span>
                      <span className="text-gray-600">
                        Técnico: {request.technician?.full_name || 'No asignado'}
                      </span>
                    </div>
                  </div>

                  {/* Botones de Acción según Rol */}
                  <div className="flex gap-2 ml-4">
                    {/* Botón Ver Detalles/Comentarios - Todos */}
                    <button
                      onClick={() => handleViewComments(request)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      {request.status === 'rejected' && isTechnician ? 'Responder' : 'Ver Detalles'}
                    </button>

                    {/* Botones de Admin - Solo en tab new */}
                    {isAdmin && activeTab === 'new' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(request.id, 'analyzing')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Analizar
                        </button>
                        <button
                          onClick={() => handleApprove(request)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleReject(request)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Rechazar
                        </button>
                      </>
                    )}

                    {/* Botones de Admin - Tab analyzing (pendientes) */}
                    {isAdmin && activeTab === 'analyzing' && (
                      <>
                        <button
                          onClick={() => handleApprove(request)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleReject(request)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Aprobar */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Aprobar Solicitud</h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-blue-900">{selectedRequest.title}</p>
              <p className="text-sm text-blue-700 mt-1">{selectedRequest.description}</p>
            </div>

            <p className="text-gray-700 font-medium mb-4">¿Cómo desea proceder con esta solicitud?</p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => setApprovalAction('internal')}
                className={`w-full p-4 border-2 rounded-lg text-left transition ${
                  approvalAction === 'internal'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-green-300'
                }`}
              >
                <div className="font-semibold text-gray-900">✅ Trabajo Interno</div>
                <div className="text-sm text-gray-600 mt-1">
                  Asignar técnico(s), coordinar fecha y hora de visita
                </div>
              </button>

              <button
                onClick={() => setApprovalAction('parts')}
                className={`w-full p-4 border-2 rounded-lg text-left transition ${
                  approvalAction === 'parts'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-green-300'
                }`}
              >
                <div className="font-semibold text-gray-900">📦 Requiere Repuestos</div>
                <div className="text-sm text-gray-600 mt-1">
                  Vincular orden de trabajo y cotización externa
                </div>
              </button>

              <button
                onClick={() => setApprovalAction('external')}
                className={`w-full p-4 border-2 rounded-lg text-left transition ${
                  approvalAction === 'external'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-green-300'
                }`}
              >
                <div className="font-semibold text-gray-900">🤝 Apoyo Externo</div>
                <div className="text-sm text-gray-600 mt-1">
                  Coordinar con proveedor o especialista externo
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setApprovalAction(null);
                  setSelectedRequest(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitApproval}
                disabled={!approvalAction}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Aprobación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rechazar */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Rechazar Solicitud</h3>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-red-900">{selectedRequest.title}</p>
              <p className="text-sm text-red-700 mt-1">{selectedRequest.description}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo del rechazo (obligatorio)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explica por qué se rechaza esta solicitud..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedRequest(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim()}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Trabajo Interno */}
      {showInternalWorkForm && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Asignar Trabajo Interno</h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-blue-900">{selectedRequest.title}</p>
              <p className="text-sm text-blue-700 mt-1">{selectedRequest.description}</p>
              <p className="text-sm text-blue-600 mt-2">
                {selectedRequest.clients?.company_name || selectedRequest.clients?.building_name} - 
                Ascensor #{selectedRequest.elevators?.elevator_number}
              </p>
            </div>

            <div className="space-y-4">
              {/* Selección de Técnicos */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Técnico(s) Asignado(s) *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {technicians.map((tech) => (
                    <label key={tech.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={workOrder.assigned_technicians.includes(tech.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWorkOrder({
                              ...workOrder,
                              assigned_technicians: [...workOrder.assigned_technicians, tech.id]
                            });
                          } else {
                            setWorkOrder({
                              ...workOrder,
                              assigned_technicians: workOrder.assigned_technicians.filter(id => id !== tech.id)
                            });
                          }
                        }}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{tech.full_name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selecciona uno o más técnicos para este trabajo
                </p>
              </div>

              {/* Fecha y Hora */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fecha Programada *
                  </label>
                  <input
                    type="date"
                    value={workOrder.scheduled_date}
                    onChange={(e) => setWorkOrder({ ...workOrder, scheduled_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hora Programada
                  </label>
                  <input
                    type="time"
                    value={workOrder.scheduled_time}
                    onChange={(e) => setWorkOrder({ ...workOrder, scheduled_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Horas Estimadas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Horas Estimadas
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={workOrder.estimated_hours}
                  onChange={(e) => setWorkOrder({ ...workOrder, estimated_hours: e.target.value })}
                  placeholder="Ej: 2.5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Instrucciones / Notas
                </label>
                <textarea
                  value={workOrder.notes}
                  onChange={(e) => setWorkOrder({ ...workOrder, notes: e.target.value })}
                  placeholder="Instrucciones especiales, materiales necesarios, etc..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowInternalWorkForm(false);
                  setWorkOrder({
                    assigned_technicians: [],
                    scheduled_date: '',
                    scheduled_time: '',
                    estimated_hours: '',
                    notes: '',
                  });
                  setApprovalAction(null);
                  setSelectedRequest(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitInternalWork}
                disabled={workOrder.assigned_technicians.length === 0 || !workOrder.scheduled_date}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Asignar Trabajo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Repuestos - Vinculación Manual */}
      {showPartsForm && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">📦 Vincular Repuestos</h3>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-purple-900">{selectedRequest.title}</p>
              <p className="text-sm text-purple-700 mt-1">{selectedRequest.description}</p>
              <p className="text-sm text-purple-600 mt-2">
                {selectedRequest.clients?.company_name || selectedRequest.clients?.building_name} - 
                Ascensor #{selectedRequest.elevators?.elevator_number}
              </p>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <p className="text-sm text-yellow-800">
                ℹ️ Ingresa el número de OT y cotización que ya fueron generados externamente. 
                Esta solicitud quedará vinculada a esa orden de trabajo.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Número de Orden de Trabajo *
                </label>
                <input
                  type="text"
                  value={partsRequest.work_order_number}
                  onChange={(e) => setPartsRequest({ ...partsRequest, work_order_number: e.target.value })}
                  placeholder="Ej: OT-2024-1234"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Número de Cotización *
                </label>
                <input
                  type="text"
                  value={partsRequest.quotation_number}
                  onChange={(e) => setPartsRequest({ ...partsRequest, quotation_number: e.target.value })}
                  placeholder="Ej: COT-2024-5678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notas Adicionales
                </label>
                <textarea
                  value={partsRequest.notes}
                  onChange={(e) => setPartsRequest({ ...partsRequest, notes: e.target.value })}
                  placeholder="Repuestos solicitados, tiempos de espera, etc..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPartsForm(false);
                  setPartsRequest({
                    work_order_number: '',
                    quotation_number: '',
                    quotation_amount: '',
                    notes: '',
                  });
                  setApprovalAction(null);
                  setSelectedRequest(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitPartsRequest}
                disabled={!partsRequest.work_order_number.trim() || !partsRequest.quotation_number.trim()}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vincular Repuestos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Apoyo Externo */}
      {showExternalForm && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">🤝 Apoyo Externo</h3>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-orange-900">{selectedRequest.title}</p>
              <p className="text-sm text-orange-700 mt-1">{selectedRequest.description}</p>
              <p className="text-sm text-orange-600 mt-2">
                {selectedRequest.clients?.company_name || selectedRequest.clients?.building_name} - 
                Ascensor #{selectedRequest.elevators?.elevator_number}
              </p>
            </div>

            <div className="space-y-4">
              {/* Checkbox Recordatorio */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={externalWork.is_reminder}
                    onChange={(e) => setExternalWork({ 
                      ...externalWork, 
                      is_reminder: e.target.checked,
                      provider_name: e.target.checked ? '' : externalWork.provider_name,
                      scheduled_date: e.target.checked ? '' : externalWork.scheduled_date,
                    })}
                    className="w-5 h-5 rounded text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-blue-900">Solo crear recordatorio</span>
                    <p className="text-sm text-blue-700 mt-1">
                      La solicitud quedará pendiente hasta coordinar proveedor
                    </p>
                  </div>
                </label>
              </div>

              {/* Campos según tipo */}
              {!externalWork.is_reminder && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre del Proveedor / Especialista *
                    </label>
                    <input
                      type="text"
                      value={externalWork.provider_name}
                      onChange={(e) => setExternalWork({ ...externalWork, provider_name: e.target.value })}
                      placeholder="Ej: Empresa XYZ Ltda."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fecha Programada *
                    </label>
                    <input
                      type="date"
                      value={externalWork.scheduled_date}
                      onChange={(e) => setExternalWork({ ...externalWork, scheduled_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {externalWork.is_reminder ? 'Recordatorio / Notas' : 'Notas Adicionales'}
                </label>
                <textarea
                  value={externalWork.notes}
                  onChange={(e) => setExternalWork({ ...externalWork, notes: e.target.value })}
                  placeholder={externalWork.is_reminder 
                    ? "Describe lo que se necesita coordinar..." 
                    : "Información de contacto, detalles del trabajo, etc..."}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowExternalForm(false);
                  setExternalWork({
                    is_reminder: false,
                    provider_name: '',
                    scheduled_date: '',
                    notes: '',
                  });
                  setApprovalAction(null);
                  setSelectedRequest(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitExternalWork}
                disabled={
                  externalWork.is_reminder 
                    ? !externalWork.notes.trim()
                    : !externalWork.provider_name.trim() || !externalWork.scheduled_date
                }
                className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {externalWork.is_reminder ? 'Agregar Recordatorio' : 'Asignar Proveedor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Comentarios/Respuestas */}
      {showCommentsModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {isRejectionResponse ? 'Responder Solicitud Rechazada' : 'Detalles y Comentarios'}
            </h3>
            
            {/* Información de la Solicitud */}
            <div className={`border-2 rounded-lg p-4 mb-6 ${
              selectedRequest.status === 'rejected' 
                ? 'bg-red-50 border-red-200' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-900 text-lg">{selectedRequest.title}</p>
                  <p className="text-sm text-gray-700 mt-1">{selectedRequest.description}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    {selectedRequest.clients?.company_name || selectedRequest.clients?.building_name} - 
                    Ascensor #{selectedRequest.elevators?.elevator_number}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  selectedRequest.status === 'rejected' ? 'bg-red-200 text-red-800' :
                  selectedRequest.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                  selectedRequest.status === 'analyzing' ? 'bg-blue-200 text-blue-800' :
                  selectedRequest.status === 'in_progress' ? 'bg-green-200 text-green-800' :
                  'bg-gray-200 text-gray-800'
                }`}>
                  {getStatusLabel(selectedRequest.status)}
                </span>
              </div>

              {/* Motivo de Rechazo si aplica */}
              {selectedRequest.status === 'rejected' && selectedRequest.admin_notes && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3 mt-3">
                  <p className="text-sm font-semibold text-red-900">Motivo del Rechazo:</p>
                  <p className="text-sm text-red-800 mt-1">{selectedRequest.admin_notes}</p>
                </div>
              )}

              {/* Fotos */}
              {(selectedRequest.photo_1_url || selectedRequest.photo_2_url) ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">📸 Evidencia Fotográfica:</p>
                  <div className="flex gap-3">
                    {selectedRequest.photo_1_url && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setZoomedPhoto(selectedRequest.photo_1_url)}
                          className="relative group hover:opacity-90 transition-opacity"
                        >
                          <img 
                            src={selectedRequest.photo_1_url} 
                            className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300 shadow-md" 
                            alt="Foto 1"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg flex items-center justify-center transition-all">
                            <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100 bg-black bg-opacity-70 px-2 py-1 rounded">
                              🔍 Ver ampliada
                            </span>
                          </div>
                        </button>
                        <a
                          href={selectedRequest.photo_1_url}
                          download="foto-1.jpg"
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 text-center"
                        >
                          ⬇ Descargar
                        </a>
                      </div>
                    )}
                    {selectedRequest.photo_2_url && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setZoomedPhoto(selectedRequest.photo_2_url)}
                          className="relative group hover:opacity-90 transition-opacity"
                        >
                          <img 
                            src={selectedRequest.photo_2_url} 
                            className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300 shadow-md" 
                            alt="Foto 2"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg flex items-center justify-center transition-all">
                            <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100 bg-black bg-opacity-70 px-2 py-1 rounded">
                              🔍 Ver ampliada
                            </span>
                          </div>
                        </button>
                        <a
                          href={selectedRequest.photo_2_url}
                          download="foto-2.jpg"
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 text-center"
                        >
                          ⬇ Descargar
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Historial de Comentarios */}
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Historial de Comentarios
              </h4>
              
              {comments.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No hay comentarios aún</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className={`border rounded-lg p-3 ${
                      comment.is_rejection_response ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {comment.user?.full_name || 'Usuario'}
                            <span className="ml-2 text-xs font-normal text-gray-600">
                              ({comment.user?.role === 'technician' ? 'Técnico' : 'Administrador'})
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleString('es-CL')}
                          </p>
                        </div>
                        {comment.is_rejection_response && (
                          <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded-full font-semibold">
                            Respuesta
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{comment.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario de Nuevo Comentario */}
            <div className="border-t pt-4">
              {isRejectionResponse && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
                  <p className="text-sm font-semibold text-yellow-900">
                    ⚠️ Responde con la información solicitada para que la solicitud vuelva a revisión
                  </p>
                </div>
              )}

              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {isRejectionResponse ? 'Tu Respuesta *' : 'Agregar Comentario'}
              </label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={isRejectionResponse 
                  ? "Proporciona la información adicional solicitada..." 
                  : "Escribe un comentario o nota..."
                }
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCommentsModal(false);
                  setNewComment('');
                  setIsRejectionResponse(false);
                  setSelectedRequest(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                onClick={submitComment}
                disabled={!newComment.trim()}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRejectionResponse ? 'Enviar Respuesta' : 'Agregar Comentario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom de Foto */}
      {zoomedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setZoomedPhoto(null)}
        >
          <div className="relative max-w-6xl max-h-[90vh]">
            <button
              onClick={() => setZoomedPhoto(null)}
              className="absolute -top-12 right-0 text-white bg-red-600 hover:bg-red-700 rounded-full p-2 font-bold text-xl w-10 h-10 flex items-center justify-center"
            >
              ×
            </button>
            <img 
              src={zoomedPhoto} 
              alt="Foto ampliada" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
