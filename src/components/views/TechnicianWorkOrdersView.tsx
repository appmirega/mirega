import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Clock, CheckCircle, AlertCircle, Filter, Download, X } from 'lucide-react';
import { WorkOrderClosureForm } from '../workorders/WorkOrderClosureForm';

interface WorkOrder {
  id: string;
  folio_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  scheduled_date?: string;
  created_at: string;
  is_closed?: boolean;
  client: {
    company_name: string;
  };
  assigned_technician: {
    id: string;
    full_name: string;
  };
  elevator?: {
    brand: string;
    model: string;
    location_name: string;
  };
}

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed';
type ViewMode = 'list' | 'close';

export function TechnicianWorkOrdersView() {
  const { profile } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<WorkOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  useEffect(() => {
    loadWorkOrders();
  }, []);

  useEffect(() => {
    filterWorkOrders();
  }, [workOrders, statusFilter]);

  const loadWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          id,
          folio_number,
          title,
          description,
          status,
          priority,
          scheduled_date,
          created_at,
          is_closed,
          clients!work_orders_client_id_fkey (
            company_name
          ),
          profiles!work_orders_assigned_technician_id_fkey (
            id,
            full_name
          ),
          elevators (
            brand,
            model,
            location_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((order) => ({
        ...order,
        client: Array.isArray(order.clients) ? order.clients[0] : order.clients,
        assigned_technician: Array.isArray(order.profiles) ? order.profiles[0] : order.profiles,
      }));

      setWorkOrders(formattedData);
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterWorkOrders = () => {
    let filtered = [...workOrders];

    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  };

  const handleCloseWorkOrder = (workOrder: WorkOrder) => {
    setSelectedWorkOrder(workOrder);
    setViewMode('close');
  };

  const handleClosureComplete = () => {
    setViewMode('list');
    setSelectedWorkOrder(null);
    loadWorkOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'in_progress':
        return 'En Curso';
      case 'completed':
        return 'Completada';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-slate-600';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      case 'low':
        return 'Baja';
      default:
        return priority;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5" />;
      case 'in_progress':
        return <AlertCircle className="w-5 h-5" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  if (viewMode === 'close' && selectedWorkOrder) {
    return (
      <WorkOrderClosureForm
        workOrder={selectedWorkOrder}
        onComplete={handleClosureComplete}
        onCancel={() => {
          setViewMode('list');
          setSelectedWorkOrder(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Órdenes de Trabajo</h1>
        <p className="text-slate-600 mt-1">Visualiza y cierra órdenes de trabajo</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filtrar por Estado</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'Todas' },
            { value: 'pending', label: 'Pendientes' },
            { value: 'in_progress', label: 'En Curso' },
            { value: 'completed', label: 'Completadas' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value as StatusFilter)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === filter.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No hay órdenes de trabajo</p>
          <p className="text-sm text-slate-500 mt-1">
            {statusFilter !== 'all'
              ? 'Intenta cambiar el filtro para ver más órdenes'
              : 'No se encontraron órdenes de trabajo'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={getStatusColor(order.status) + ' p-3 rounded-lg'}>
                    {getStatusIcon(order.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">OT #{order.folio_number}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                      {order.is_closed && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                          Cerrada
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-slate-900 mb-2">{order.title}</h4>
                    <p className="text-slate-600 mb-3">{order.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Cliente:</span>{' '}
                        <span className="text-slate-900 font-medium">
                          {order.client?.company_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Técnico:</span>{' '}
                        <span className="text-slate-900 font-medium">
                          {order.assigned_technician?.full_name}
                        </span>
                      </div>
                      {order.elevator && (
                        <div>
                          <span className="text-slate-500">Ascensor:</span>{' '}
                          <span className="text-slate-900 font-medium">
                            {order.elevator.brand} {order.elevator.model} -{' '}
                            {order.elevator.location_name}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500">Prioridad:</span>{' '}
                        <span className={`font-semibold ${getPriorityColor(order.priority)}`}>
                          {getPriorityLabel(order.priority)}
                        </span>
                      </div>
                      {order.scheduled_date && (
                        <div>
                          <span className="text-slate-500">Fecha Programada:</span>{' '}
                          <span className="text-slate-900 font-medium">
                            {new Date(order.scheduled_date).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500">Creada:</span>{' '}
                        <span className="text-slate-900">
                          {new Date(order.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {!order.is_closed && order.status !== 'completed' && (
                  <button
                    onClick={() => handleCloseWorkOrder(order)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Cerrar OT
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
