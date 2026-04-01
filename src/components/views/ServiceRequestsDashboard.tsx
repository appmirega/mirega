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
  Info,
  ClipboardList,
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

type AdminTab =
  | 'new'
  | 'analyzing'
  | 'info_requested'
  | 'processing'
  | 'rejected'
  | 'in_progress'
  | 'completed';

type TechnicianTab =
  | 'new'
  | 'analyzing'
  | 'info_requested'
  | 'rejected'
  | 'in_progress'
  | 'completed';

export function ServiceRequestsDashboard() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab | TechnicianTab>('new');
  const [showManualForm, setShowManualForm] = useState(false);

  const [stats, setStats] = useState({
    new: 0,
    analyzing: 0,
    info_requested: 0,
    processing: 0,
    rejected: 0,
    in_progress: 0,
    completed: 0,
    critical_count: 0,
    high_priority_count: 0,
  });

  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestWithDetails | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoRequestNotes, setInfoRequestNotes] = useState('');

  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isRejectionResponse, setIsRejectionResponse] = useState(false);

  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isTechnician = profile?.role === 'technician';

  useEffect(() => {
    loadRequests();
  }, [activeTab, profile?.id, profile?.role]);

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
          intervention_type,
          source_type,
          source_id,
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
          info_request_notes,
          assigned_technicians,
          scheduled_date,
          scheduled_time,
          estimated_hours,
          work_order_number,
          quotation_number,
          quotation_amount,
          provider_name,
          requires_quotation,
          request_origin,
          workflow_path,
          processed_at,
          closed_at,
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

      if (isTechnician) {
        query = query.eq('created_by_technician_id', profile?.id);
      }

      if (activeTab === 'new') {
        query = query.eq('status', 'pending');
      } else if (activeTab === 'analyzing') {
        query = query.eq('status', 'analyzing');
      } else if (activeTab === 'info_requested') {
        query = query.eq('status', 'info_requested');
      } else if (activeTab === 'processing') {
        query = query.eq('status', 'processing');
      } else if (activeTab === 'rejected') {
        query = query.eq('status', 'rejected');
      } else if (activeTab === 'in_progress') {
        query = query.in('status', ['in_progress', 'resolved']);
      } else if (activeTab === 'completed') {
        query = query.in('status', ['completed']);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRequests((data as ServiceRequestWithDetails[]) || []);

      let statsQuery = supabase
        .from('service_requests')
        .select('id, status, priority, created_by_technician_id');

      if (isTechnician) {
        statsQuery = statsQuery.eq('created_by_technician_id', profile?.id);
      }

      const { data: allData } = await statsQuery;

      const newRequests = allData?.filter(r => r.status === 'pending').length || 0;
      const analyzing = allData?.filter(r => r.status === 'analyzing').length || 0;
      const infoRequested = allData?.filter(r => r.status === 'info_requested').length || 0;
      const processing = allData?.filter(r => r.status === 'processing').length || 0;
      const rejected = allData?.filter(r => r.status === 'rejected').length || 0;
      const inProgress = allData?.filter(r => r.status === 'in_progress' || r.status === 'resolved').length || 0;
      const completed = allData?.filter(r => r.status === 'completed').length || 0;
      const critical = allData?.filter(r => r.priority === 'critical').length || 0;
      const highPriority = allData?.filter(r => r.priority === 'high').length || 0;

      setStats({
        new: newRequests,
        analyzing,
        info_requested: infoRequested,
        processing,
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

  const handleViewComments = async (request: ServiceRequestWithDetails) => {
    setSelectedRequest(request);
    await loadComments(request.id);
    setShowCommentsModal(true);
    setIsRejectionResponse(
      (request.status === 'rejected' || request.status === 'info_requested') && isTechnician
    );
  };

  const submitComment = async () => {
    if (!selectedRequest || !newComment.trim()) {
      alert('Debes escribir un comentario');
      return;
    }

    try {
      const { error: commentError } = await supabase
        .from('service_request_comments')
        .insert({
          service_request_id: selectedRequest.id,
          user_id: profile?.id,
          comment: newComment,
          comment_type: isRejectionResponse ? 'rejection_response' : 'general',
          is_rejection_response: isRejectionResponse,
          resolves_rejection: isRejectionResponse,
        });

      if (commentError) throw commentError;

      if (
        isRejectionResponse &&
        (selectedRequest.status === 'rejected' || selectedRequest.status === 'info_requested')
      ) {
        const { error: updateError } = await supabase
          .from('service_requests')
          .update({
            status: 'pending',
            last_response_at: new Date().toISOString(),
            last_technician_action_at: new Date().toISOString(),
          })
          .eq('id', selectedRequest.id);

        if (updateError) throw updateError;

        await supabase.from('service_request_history').insert({
          service_request_id: selectedRequest.id,
          changed_by: profile?.id,
          change_type: 'reopened',
          old_status: selectedRequest.status,
          new_status: 'pending',
          change_description:
            selectedRequest.status === 'info_requested'
              ? 'Solicitud respondida por técnico luego de solicitud de información'
              : 'Solicitud reabierta con información adicional del técnico',
        });

        alert('✅ Respuesta enviada. La solicitud vuelve a revisión');
      } else {
        alert('✅ Comentario agregado');
      }

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
      case 'analyzing': return 'EN REVISIÓN';
      case 'info_requested': return 'INFO SOLICITADA';
      case 'processing': return 'EN COTIZACIÓN';
      case 'approved': return 'APROBADA';
      case 'resolved': return 'RESUELTA';
      case 'rejected': return 'RECHAZADA';
      case 'in_progress': return 'EN PROCESO';
      case 'completed': return 'COMPLETADA';
      default: return status.toUpperCase();
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'analyzing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info_requested':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'processing':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'resolved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'in_progress':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'completed':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
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
      case 'diagnostic':
        return <Users className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'repair':
        return 'Trabajos / Reparación';
      case 'parts':
        return 'Repuestos';
      case 'diagnostic':
        return 'Diagnóstico Técnico';
      default:
        return type;
    }
  };

  const getInterventionTypeLabel = (type: string | null | undefined) => {
    if (!type) return '-';

    switch (type) {
      case 'preventive':
        return 'Preventivo';
      case 'corrective':
        return 'Correctivo';
      case 'improvement':
        return 'Mejora / Modernización';
      default:
        return type;
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
      await loadRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    }
  };

  const handleProcess = async (request: ServiceRequestWithDetails) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'processing',
          requires_quotation: true,
          workflow_path: 'quotation_ot',
          assigned_to_admin_id: profile?.id,
          reviewed_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          last_admin_action_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      await supabase.from('service_request_history').insert({
        service_request_id: request.id,
        changed_by: profile?.id,
        change_type: 'processing',
        old_status: request.status,
        new_status: 'processing',
        change_description: 'Solicitud enviada a flujo de cotización / OT',
      });

      alert('✅ Solicitud enviada al flujo de cotización / OT');
      setActiveTab('processing');
    } catch (error) {
      console.error(error);
      alert('Error al procesar solicitud');
    }
  };

  const handleResolve = async (request: ServiceRequestWithDetails) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'resolved',
          requires_quotation: false,
          workflow_path: 'direct',
          assigned_to_admin_id: profile?.id,
          reviewed_at: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          last_admin_action_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      await supabase.from('service_request_history').insert({
        service_request_id: request.id,
        changed_by: profile?.id,
        change_type: 'resolved',
        old_status: request.status,
        new_status: 'resolved',
        change_description: 'Solicitud resuelta sin cotización / OT',
      });

      alert('✅ Solicitud resuelta sin cotización');
      setActiveTab('in_progress');
    } catch (error) {
      console.error(error);
      alert('Error al resolver solicitud');
    }
  };

  const handleOpenRequestInfo = (request: ServiceRequestWithDetails) => {
    if (!isAdmin) return;
    setSelectedRequest(request);
    setInfoRequestNotes(request.info_request_notes || '');
    setShowInfoModal(true);
  };

  const submitRequestInfo = async () => {
    if (!selectedRequest || !infoRequestNotes.trim()) {
      alert('Debes escribir qué información necesitas');
      return;
    }

    try {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'info_requested',
          info_request_notes: infoRequestNotes,
          assigned_to_admin_id: profile?.id,
          reviewed_at: new Date().toISOString(),
          last_admin_action_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      await supabase.from('service_request_history').insert({
        service_request_id: selectedRequest.id,
        changed_by: profile?.id,
        change_type: 'info_requested',
        old_status: selectedRequest.status,
        new_status: 'info_requested',
        change_description: `Se solicita más información: ${infoRequestNotes}`,
      });

      await supabase.from('service_request_comments').insert({
        service_request_id: selectedRequest.id,
        user_id: profile?.id,
        comment: `Información solicitada: ${infoRequestNotes}`,
        comment_type: 'general',
        is_rejection_response: false,
        resolves_rejection: false,
      });

      alert('✅ Se solicitó más información');
      setShowInfoModal(false);
      setInfoRequestNotes('');
      setSelectedRequest(null);
      setActiveTab('info_requested');
    } catch (error) {
      console.error(error);
      alert('Error al solicitar información');
    }
  };

  const handleReject = (request: ServiceRequestWithDetails) => {
    if (!isAdmin) {
      alert('Solo administradores pueden rechazar solicitudes');
      return;
    }
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!selectedRequest || !rejectReason.trim()) {
      alert('Debe ingresar un motivo');
      return;
    }

    try {
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

      if (activeTab !== 'rejected' && isAdmin) {
        setActiveTab('rejected');
      } else {
        loadRequests();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al rechazar solicitud');
    }
  };

  const renderAdminActions = (request: ServiceRequestWithDetails) => {
    if (!isAdmin) return null;

    if (activeTab === 'new') {
      return (
        <>
          <button
            onClick={() => handleUpdateStatus(request.id, 'analyzing')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Analizar
          </button>
          <button
            onClick={() => handleProcess(request)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            Procesar
          </button>
          <button
            onClick={() => handleResolve(request)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            Resolver
          </button>
          <button
            onClick={() => handleOpenRequestInfo(request)}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
          >
            Pedir Info
          </button>
          <button
            onClick={() => handleReject(request)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Rechazar
          </button>
        </>
      );
    }

    if (activeTab === 'analyzing') {
      return (
        <>
          <button
            onClick={() => handleProcess(request)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            Procesar
          </button>
          <button
            onClick={() => handleResolve(request)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            Resolver
          </button>
          <button
            onClick={() => handleOpenRequestInfo(request)}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
          >
            Pedir Info
          </button>
          <button
            onClick={() => handleReject(request)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Rechazar
          </button>
        </>
      );
    }

    if (activeTab === 'info_requested') {
      return (
        <button
          onClick={() => handleViewComments(request)}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <Info className="w-4 h-4" />
          Ver Respuesta
        </button>
      );
    }

    if (activeTab === 'processing') {
      return (
        <button
          onClick={() => window.location.href = '/work-orders'}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <ClipboardList className="w-4 h-4" />
          Ir a OT
        </button>
      );
    }

    return null;
  };

  const tabButtonClass = (tab: string, active: string, activeClasses: string) =>
    `px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
      active === tab ? activeClasses : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
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

        {showManualForm && (
          <ManualServiceRequestForm
            onClose={() => setShowManualForm(false)}
            onSuccess={() => loadRequests()}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">En revisión</p>
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
                <p className="text-sm text-gray-600 mb-1">En Progreso / Resueltas</p>
                <p className="text-3xl font-bold text-green-600">{stats.in_progress}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('new')}
              className={tabButtonClass('new', activeTab, 'bg-blue-600 text-white')}
            >
              <Clock className="w-4 h-4" />
              Nuevas
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'new' ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
              }`}>
                {stats.new}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('analyzing')}
              className={tabButtonClass('analyzing', activeTab, 'bg-yellow-600 text-white')}
            >
              <AlertCircle className="w-4 h-4" />
              En revisión
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'analyzing' ? 'bg-white text-yellow-600' : 'bg-yellow-600 text-white'
              }`}>
                {stats.analyzing}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('info_requested')}
              className={tabButtonClass('info_requested', activeTab, 'bg-amber-600 text-white')}
            >
              <Info className="w-4 h-4" />
              Info solicitada
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'info_requested' ? 'bg-white text-amber-600' : 'bg-amber-600 text-white'
              }`}>
                {stats.info_requested}
              </span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('processing')}
                className={tabButtonClass('processing', activeTab, 'bg-purple-600 text-white')}
              >
                <ClipboardList className="w-4 h-4" />
                En cotización
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                  activeTab === 'processing' ? 'bg-white text-purple-600' : 'bg-purple-600 text-white'
                }`}>
                  {stats.processing}
                </span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('rejected')}
              className={tabButtonClass('rejected', activeTab, 'bg-red-600 text-white')}
            >
              <XCircle className="w-4 h-4" />
              Rechazadas
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'rejected' ? 'bg-white text-red-600' : 'bg-red-600 text-white'
              }`}>
                {stats.rejected}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('in_progress')}
              className={tabButtonClass('in_progress', activeTab, 'bg-green-600 text-white')}
            >
              <TrendingUp className="w-4 h-4" />
              En Proceso
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'in_progress' ? 'bg-white text-green-600' : 'bg-green-600 text-white'
              }`}>
                {stats.in_progress}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={tabButtonClass('completed', activeTab, 'bg-slate-600 text-white')}
            >
              <CheckCircle2 className="w-4 h-4" />
              Completadas
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center ${
                activeTab === 'completed' ? 'bg-white text-slate-600' : 'bg-slate-600 text-white'
              }`}>
                {stats.completed}
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Cargando solicitudes...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-xl font-semibold text-gray-900 mb-2">No hay solicitudes en esta vista</p>
              <p className="text-gray-600">No existen registros para el estado seleccionado</p>
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
                          {request.clients?.company_name || request.clients?.building_name} - Ascensor #{request.elevators?.elevator_number}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-3 py-1 rounded-full border text-xs font-semibold bg-gray-100 text-gray-700 border-gray-300">
                        {getRequestTypeLabel(request.request_type)}
                      </span>

                      <span className="px-3 py-1 rounded-full border text-xs font-semibold bg-gray-100 text-gray-700 border-gray-300">
                        {getInterventionTypeLabel(request.intervention_type)}
                      </span>

                      <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${getPriorityColor(request.priority)}`}>
                        Prioridad: {request.priority.toUpperCase()}
                      </span>

                      <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${getStatusBadgeClass(request.status)}`}>
                        {getStatusLabel(request.status)}
                      </span>

                      <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                        request.requires_quotation
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {request.requires_quotation ? 'Requiere cotización' : 'No requiere cotización'}
                      </span>
                    </div>

                    <p className="text-gray-700 mb-4 whitespace-pre-line">{request.description}</p>

                    {request.info_request_notes && request.status === 'info_requested' && (
                      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-amber-900">Información solicitada por administración:</p>
                        <p className="text-sm text-amber-800 mt-1 whitespace-pre-line">{request.info_request_notes}</p>
                      </div>
                    )}

                    {request.admin_notes && ['rejected', 'resolved'].includes(request.status) && (
                      <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-slate-900">Notas de administración:</p>
                        <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{request.admin_notes}</p>
                      </div>
                    )}

                    {(request.photo_1_url || request.photo_2_url) && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Evidencia Fotográfica:</p>
                        <div className="flex gap-2">
                          {request.photo_1_url && (
                            <button
                              type="button"
                              onClick={() => setZoomedPhoto(request.photo_1_url || null)}
                              className="group relative w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition"
                            >
                              <img
                                src={request.photo_1_url}
                                alt="Foto 1"
                                className="w-full h-full object-cover group-hover:scale-110 transition"
                              />
                            </button>
                          )}

                          {request.photo_2_url && (
                            <button
                              type="button"
                              onClick={() => setZoomedPhoto(request.photo_2_url || null)}
                              className="group relative w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition"
                            >
                              <img
                                src={request.photo_2_url}
                                alt="Foto 2"
                                className="w-full h-full object-cover group-hover:scale-110 transition"
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {getTimeAgo(request.created_at)}
                      </span>

                      <span className="text-gray-600">
                        Técnico: {request.technician?.full_name || 'No asignado'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 ml-4 justify-end">
                    <button
                      onClick={() => handleViewComments(request)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      {(request.status === 'rejected' || request.status === 'info_requested') && isTechnician
                        ? 'Responder'
                        : 'Ver Detalles'}
                    </button>

                    {renderAdminActions(request)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {zoomedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-[70] flex items-center justify-center p-4"
          onClick={() => setZoomedPhoto(null)}
        >
          <img
            src={zoomedPhoto}
            alt="Foto ampliada"
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          />
        </div>
      )}

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

      {showInfoModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Solicitar Información</h3>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-yellow-900">{selectedRequest.title}</p>
              <p className="text-sm text-yellow-700 mt-1">{selectedRequest.description}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Información requerida
              </label>
              <textarea
                value={infoRequestNotes}
                onChange={(e) => setInfoRequestNotes(e.target.value)}
                placeholder="Indica qué información o evidencia adicional necesitas..."
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowInfoModal(false);
                  setInfoRequestNotes('');
                  setSelectedRequest(null);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitRequestInfo}
                disabled={!infoRequestNotes.trim()}
                className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Solicitar Información
              </button>
            </div>
          </div>
        </div>
      )}

      {showCommentsModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 my-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Detalles de Solicitud</h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-blue-900">{selectedRequest.title}</p>
              <p className="text-sm text-blue-700 mt-1 whitespace-pre-line">{selectedRequest.description}</p>
            </div>

            <div className="space-y-3 mb-6 max-h-72 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {comments.length === 0 ? (
                <p className="text-sm text-gray-500">No hay comentarios aún.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="border-b border-gray-100 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm text-gray-900">
                        {comment.user?.full_name || 'Usuario'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleString('es-CL')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {(selectedRequest.status === 'rejected' || selectedRequest.status === 'info_requested') && isTechnician
                  ? 'Responder'
                  : 'Agregar comentario'}
              </label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Escribe tu comentario..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCommentsModal(false);
                  setSelectedRequest(null);
                  setComments([]);
                  setNewComment('');
                  setIsRejectionResponse(false);
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
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}