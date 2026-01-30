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
  User
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

export const ClientServiceRequestsView: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'analyzing' | 'in_progress' | 'completed' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    if (!profile?.id) {
      console.error('❌ [Requests] No profile found');
      return;
    }

    try {
      setLoading(true);
      
      console.log('🔍 [Requests] Profile ID:', profile.id);
      console.log('📧 [Requests] Profile Email:', profile.email);
      
      // Intentar por profile_id primero
      let { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, company_name, building_name, internal_alias')
        .eq('profile_id', profile.id)
        .maybeSingle();

      console.log('🏢 [Requests] Client Data (by profile_id):', clientData);
      console.log('⚠️ [Requests] Client Error:', clientError);

      // Fallback a email matching
      if (!clientData && profile.email) {
        console.log('🔄 [Requests] Trying fallback: matching by email...');
        const { data: clientByEmail } = await supabase
          .from('clients')
          .select('id, company_name, building_name, internal_alias')
          .eq('contact_email', profile.email)
          .maybeSingle();
        
        clientData = clientByEmail;
        console.log('📧 [Requests] Client Data (by email):', clientData);
      }

      if (!clientData) {
        console.error('❌ [Requests] No client found for this profile (tried profile_id and email)');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
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

      console.log('📋 [Requests] Service Requests Data:', data);
      console.log('⚠️ [Requests] Service Requests Error:', error);

      if (error) throw error;
      
      // Transformar los datos para manejar los arrays de Supabase
      const transformedData = (data || []).map(item => ({
        ...item,
        elevators: Array.isArray(item.elevators) && item.elevators.length > 0 ? item.elevators[0] : item.elevators,
        technician: Array.isArray(item.technician) && item.technician.length > 0 ? item.technician[0] : item.technician
      }));
      
      console.log('✅ [Requests] Transformed Data:', transformedData);
      
      setRequests(transformedData as any);
    } catch (error) {
      console.error('Error loading service requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      new: { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
      analyzing: { label: 'En Análisis', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle },
      in_progress: { label: 'En Progreso', color: 'bg-purple-100 text-purple-800', icon: Wrench },
      completed: { label: 'Completado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-blue-600" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">Mis Solicitudes de Servicio</h2>
              <p className="text-sm text-slate-600">Seguimiento de solicitudes realizadas</p>
            </div>
          </div>

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
                      setShowDetailModal(true);
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
                        {request.quotation_number && (
                          <div className="flex items-center gap-1 text-blue-600">
                            <Package className="w-3 h-3" />
                            <span>Cotización #{request.quotation_number}</span>
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
      </div>

      {/* Modal de Detalles */}
      {showDetailModal && selectedRequest && (
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
                  onClick={() => setShowDetailModal(false)}
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
                {selectedRequest.scheduled_date && (
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 mb-1">Fecha Programada</p>
                    <p className="text-sm font-medium text-purple-900">
                      {new Date(selectedRequest.scheduled_date).toLocaleDateString('es-CL')} 
                      {selectedRequest.scheduled_time && ` - ${selectedRequest.scheduled_time}`}
                    </p>
                  </div>
                )}
                {selectedRequest.work_order_number && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">Orden de Trabajo</p>
                    <p className="text-sm font-medium text-blue-900">#{selectedRequest.work_order_number}</p>
                  </div>
                )}
                {selectedRequest.quotation_number && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 mb-1">Cotización</p>
                    <p className="text-sm font-medium text-green-900">
                      #{selectedRequest.quotation_number}
                      {selectedRequest.quotation_amount && (
                        <span className="block text-xs">
                          ${selectedRequest.quotation_amount.toLocaleString('es-CL')}
                        </span>
                      )}
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

              {selectedRequest.status === 'rejected' && selectedRequest.rejection_count > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Solicitud Rechazada</h4>
                  <p className="text-sm text-red-800">
                    Esta solicitud ha sido rechazada. Por favor contacte con el administrador para más información.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full px-4 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Zoom de Foto */}
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
