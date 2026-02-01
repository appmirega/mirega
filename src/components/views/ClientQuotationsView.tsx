import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText,
  Check,
  X,
  Clock,
  AlertCircle,
  Download,
  Shield,
  Calendar,
  DollarSign,
  CheckCircle,
} from 'lucide-react';

interface Quotation {
  id: string;
  quotation_number: string;
  elevator_id: string;
  description: string;
  subtotal: number;
  tax: number;
  total: number;
  validity_days: number;
  warranty_months: number;
  status: string;
  created_at: string;
  elevators: {
    location_name: string;
    address: string;
  };
  quotation_approvals: Array<{
    id: string;
    status: string;
    approval_date: string | null;
    comments: string | null;
  }>;
}

export function ClientQuotationsView() {
  const { profile } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [filteredQuotations, setFilteredQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentQuotation, setCurrentQuotation] = useState<Quotation | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    inProgress: 0,
  });

  useEffect(() => {
    if (profile?.id) {
      loadQuotations();
    }
  }, [profile]);

  useEffect(() => {
    filterQuotations();
  }, [selectedStatus, quotations]);

  const loadQuotations = async () => {
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', profile?.id)
        .maybeSingle();

      if (!client) {
        setLoading(false);
        return;
      }

      const { data: elevatorsData } = await supabase
        .from('elevators')
        .select('id')
        .eq('client_id', client.id);

      const elevatorIds = elevatorsData?.map(e => e.id) || [];

      if (elevatorIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('quotations_v2')
        .select(`
          id,
          quotation_number,
          elevator_id,
          description,
          subtotal,
          tax,
          total,
          validity_days,
          warranty_months,
          status,
          created_at,
          elevators (
            location_name,
            address
          ),
          quotation_approvals (
            id,
            status,
            approval_date,
            comments
          )
        `)
        .in('elevator_id', elevatorIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const quotationsData = data || [];
      setQuotations(quotationsData);

      const pending = quotationsData.filter(
        q => !q.quotation_approvals.length || q.quotation_approvals[0].status === 'pending'
      ).length;
      const approved = quotationsData.filter(
        q => q.quotation_approvals.length && q.quotation_approvals[0].status === 'approved'
      ).length;
      const rejected = quotationsData.filter(
        q => q.quotation_approvals.length && q.quotation_approvals[0].status === 'rejected'
      ).length;
      const inProgress = quotationsData.filter(q => q.status === 'in_progress').length;

      setStats({
        total: quotationsData.length,
        pending,
        approved,
        rejected,
        inProgress,
      });
    } catch (error) {
      console.error('Error loading quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterQuotations = () => {
    if (selectedStatus === 'all') {
      setFilteredQuotations(quotations);
    } else {
      setFilteredQuotations(
        quotations.filter(q => {
          const approval = q.quotation_approvals[0];
          if (selectedStatus === 'pending') {
            return !approval || approval.status === 'pending';
          }
          return approval && approval.status === selectedStatus;
        })
      );
    }
  };

  const getApprovalStatus = (quotation: Quotation) => {
    if (!quotation.quotation_approvals.length) {
      return 'pending';
    }
    return quotation.quotation_approvals[0].status;
  };

  const handleApprovalAction = (quotation: Quotation, type: 'approve' | 'reject') => {
    setCurrentQuotation(quotation);
    setActionType(type);
    setApprovalComment('');
    setShowCommentModal(true);
  };

  const submitApproval = async () => {
    if (!currentQuotation) return;

    const approval = currentQuotation.quotation_approvals[0];
    const isApproving = actionType === 'approve';

    try {
      if (isApproving) {
        setApprovingId(currentQuotation.id);
      } else {
        setRejectingId(currentQuotation.id);
      }

      const { data: client } = await supabase
        .from('clients')
        .select('id, contact_name')
        .eq('profile_id', profile?.id)
        .maybeSingle();

      if (!client) throw new Error('Cliente no encontrado');

      if (approval) {
        const { error: updateError } = await supabase
          .from('quotation_approvals')
          .update({
            status: isApproving ? 'approved' : 'rejected',
            approval_date: new Date().toISOString(),
            comments: approvalComment || null,
            approved_by_name: client.contact_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', approval.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('quotation_approvals')
          .insert({
            quotation_id: currentQuotation.id,
            client_id: client.id,
            status: isApproving ? 'approved' : 'rejected',
            approval_date: new Date().toISOString(),
            comments: approvalComment || null,
            approved_by_name: client.contact_name,
          });

        if (insertError) throw insertError;
      }

      alert(`Cotización ${isApproving ? 'aprobada' : 'rechazada'} exitosamente`);
      setShowCommentModal(false);
      setCurrentQuotation(null);
      setApprovalComment('');
      loadQuotations();
    } catch (error: any) {
      console.error('Error updating approval:', error);
      alert('Error al procesar la solicitud: ' + error.message);
    } finally {
      setApprovingId(null);
      setRejectingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      default:
        return status;
    }
  };

  const isExpired = (createdAt: string, validityDays: number) => {
    const created = new Date(createdAt);
    const expiry = new Date(created);
    expiry.setDate(expiry.getDate() + validityDays);
    return new Date() > expiry;
  };

  const getExpiryDate = (createdAt: string, validityDays: number) => {
    const created = new Date(createdAt);
    const expiry = new Date(created);
    expiry.setDate(expiry.getDate() + validityDays);
    return expiry.toLocaleDateString('es-ES');
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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mis Cotizaciones</h1>
        <p className="text-slate-600 mt-1">
          Visualiza y gestiona las cotizaciones emitidas para tus ascensores
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-600">Total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
              <p className="text-sm text-slate-600">Pendientes</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.approved}</p>
              <p className="text-sm text-slate-600">Aprobadas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <X className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.rejected}</p>
              <p className="text-sm text-slate-600">Rechazadas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.inProgress}</p>
              <p className="text-sm text-slate-600">En Ejecución</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Filtrar por Estado</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedStatus === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todas ({stats.total})
          </button>
          <button
            onClick={() => setSelectedStatus('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedStatus === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            Pendientes ({stats.pending})
          </button>
          <button
            onClick={() => setSelectedStatus('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedStatus === 'approved'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            Aprobadas ({stats.approved})
          </button>
          <button
            onClick={() => setSelectedStatus('rejected')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedStatus === 'rejected'
                ? 'bg-red-600 text-white'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            Rechazadas ({stats.rejected})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {filteredQuotations.length} Cotización{filteredQuotations.length !== 1 ? 'es' : ''}
          </h2>
        </div>

        {filteredQuotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No hay cotizaciones</p>
            <p className="text-sm text-slate-500 mt-1">
              {selectedStatus !== 'all'
                ? 'Prueba cambiando el filtro'
                : 'Las cotizaciones aparecerán aquí cuando se emitan'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredQuotations.map((quotation) => {
              const approvalStatus = getApprovalStatus(quotation);
              const expired = isExpired(quotation.created_at, quotation.validity_days);

              return (
                <div key={quotation.id} className="p-6 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-slate-900 text-lg">
                          Cotización #{quotation.quotation_number}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                            approvalStatus
                          )}`}
                        >
                          {getStatusLabel(approvalStatus)}
                        </span>
                        {expired && approvalStatus === 'pending' && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                            Vencida
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-600 mb-1">
                        {quotation.elevators?.location_name || 'Ascensor'} -{' '}
                        {quotation.elevators?.address}
                      </p>
                      <p className="text-sm text-slate-700 mb-4">{quotation.description}</p>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-slate-600 mb-1">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-xs font-medium">Total</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">
                            ${quotation.total.toLocaleString('es-CL')}
                          </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-slate-600 mb-1">
                            <Calendar className="w-4 h-4" />
                            <span className="text-xs font-medium">Vigencia</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">
                            {quotation.validity_days} días
                          </p>
                          <p className="text-xs text-slate-600">
                            Hasta {getExpiryDate(quotation.created_at, quotation.validity_days)}
                          </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-slate-600 mb-1">
                            <Shield className="w-4 h-4" />
                            <span className="text-xs font-medium">Garantía</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">
                            {quotation.warranty_months} meses
                          </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-slate-600 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-medium">Creada</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">
                            {new Date(quotation.created_at).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </div>

                      {quotation.quotation_approvals.length > 0 &&
                        quotation.quotation_approvals[0].comments && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <p className="text-xs font-semibold text-blue-900 mb-1">Comentarios</p>
                            <p className="text-sm text-blue-800">
                              {quotation.quotation_approvals[0].comments}
                            </p>
                          </div>
                        )}

                      {approvalStatus === 'pending' && !expired && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApprovalAction(quotation, 'approve')}
                            disabled={approvingId === quotation.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {approvingId === quotation.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Aprobando...
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                Aprobar Cotización
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleApprovalAction(quotation, 'reject')}
                            disabled={rejectingId === quotation.id}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                          >
                            {rejectingId === quotation.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Rechazando...
                              </>
                            ) : (
                              <>
                                <X className="w-4 h-4" />
                                Rechazar
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">
              {actionType === 'approve' ? 'Aprobar' : 'Rechazar'} Cotización
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {actionType === 'approve'
                ? 'Al aprobar esta cotización, se notificará al administrador para proceder con la ejecución.'
                : 'Por favor indica el motivo del rechazo.'}
            </p>
            <textarea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              placeholder={
                actionType === 'approve' ? 'Comentarios (opcional)' : 'Motivo del rechazo'
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setCurrentQuotation(null);
                  setApprovalComment('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={submitApproval}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition ${
                  actionType === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3">Importante</h3>
        <ul className="space-y-2 text-sm text-blue-800 list-disc list-inside">
          <li>Las cotizaciones tienen una vigencia limitada. Revisa la fecha de vencimiento.</li>
          <li>Al aprobar una cotización, el administrador será notificado automáticamente.</li>
          <li>Puedes descargar las cotizaciones para revisarlas con tu equipo.</li>
          <li>Las cotizaciones aprobadas pasarán a estado "En Ejecución" una vez iniciados los trabajos.</li>
          <li>La garantía entra en vigencia una vez completado el trabajo.</li>
        </ul>
      </div>
    </div>
  );
}
