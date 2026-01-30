import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, FileText, Wrench, Zap, TrendingUp } from 'lucide-react';

// Panel Dinámico de Emergencias
export function EmergenciesPanel() {
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, today: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmergencies();
    const subscription = supabase
      .channel('emergencies_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_visits' }, () => {
        loadEmergencies();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const loadEmergencies = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_visits')
        .select('id, status, client_id, created_at, building_id, clients(company_name)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      const todayCount = (data || []).filter(e => e.created_at.startsWith(today)).length;
      const activeCount = (data || []).filter(e => ['reported', 'assigned', 'in_progress'].includes(e.status)).length;

      setEmergencies(data || []);
      setStats({ total: data?.length || 0, active: activeCount, today: todayCount });
    } catch (error) {
      console.error('Error loading emergencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'bg-red-100 text-red-800';
      case 'assigned': return 'bg-orange-100 text-orange-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="w-6 h-6 text-red-600" />
        <h3 className="text-xl font-bold text-slate-900">Emergencias Recientes</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-sm text-red-600 font-semibold">Total</p>
          <p className="text-2xl font-bold text-red-900">{stats.total}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <p className="text-sm text-orange-600 font-semibold">Activas</p>
          <p className="text-2xl font-bold text-orange-900">{stats.active}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-sm text-yellow-600 font-semibold">Hoy</p>
          <p className="text-2xl font-bold text-yellow-900">{stats.today}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
        </div>
      ) : emergencies.length === 0 ? (
        <p className="text-slate-600 text-center py-4">No hay emergencias registradas</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {emergencies.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
              <div className="flex-1">
                <p className="font-medium text-slate-900 text-sm">{e.clients?.company_name}</p>
                <p className="text-xs text-slate-500">{new Date(e.created_at).toLocaleDateString('es-CL')}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(e.status)}`}>
                {e.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Panel Dinámico de Mantenimientos
export function MaintenancesPanel() {
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaintenances();
  }, []);

  const loadMaintenances = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const monthStart = startOfMonth.toISOString().split('T')[0];

      const { count: total } = await supabase
        .from('maintenance_schedules')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_date', monthStart);

      const { count: completed } = await supabase
        .from('maintenance_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('scheduled_date', monthStart);

      const { count: pending } = await supabase
        .from('maintenance_schedules')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'completed')
        .gte('scheduled_date', monthStart);

      setStats({ total: total || 0, completed: completed || 0, pending: pending || 0 });
    } catch (error) {
      console.error('Error loading maintenances:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Wrench className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-slate-900">Mantenimientos del Mes</h3>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 font-semibold">Total</p>
            <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-semibold">Completados</p>
            <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600 font-semibold">Pendientes</p>
            <p className="text-2xl font-bold text-orange-900">{stats.pending}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Panel de Solicitudes (Técnicos + Clientes)
export function ServiceRequestsPanel() {
  const [stats, setStats] = useState({
    technicianRequests: 0,
    clientRequests: 0,
    pendingApproval: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServiceRequests();
  }, []);

  const loadServiceRequests = async () => {
    try {
      const { count: technicianCount } = await supabase
        .from('service_requests')
        .select('id', { count: 'exact', head: true })
        .eq('created_by_client', false);

      const { count: clientCount } = await supabase
        .from('service_requests')
        .select('id', { count: 'exact', head: true })
        .eq('created_by_client', true);

      const { count: pendingCount } = await supabase
        .from('service_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'created');

      setStats({
        technicianRequests: technicianCount || 0,
        clientRequests: clientCount || 0,
        pendingApproval: pendingCount || 0,
      });
    } catch (error) {
      console.error('Error loading service requests:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="w-6 h-6 text-purple-600" />
        <h3 className="text-xl font-bold text-slate-900">Solicitudes de Servicio</h3>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600 font-semibold">Técnicos</p>
            <p className="text-2xl font-bold text-purple-900">{stats.technicianRequests}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 font-semibold">Clientes</p>
            <p className="text-2xl font-bold text-blue-900">{stats.clientRequests}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600 font-semibold">Pendientes</p>
            <p className="text-2xl font-bold text-orange-900">{stats.pendingApproval}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Panel de Cotizaciones
export function QuotationsPanel() {
  const [stats, setStats] = useState({ total: 0, approvedThisMonth: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotations();
  }, []);

  const loadQuotations = async () => {
    try {
      const { count: total } = await supabase
        .from('quotations')
        .select('id', { count: 'exact', head: true });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const monthStart = startOfMonth.toISOString().split('T')[0];

      const { count: approved } = await supabase
        .from('quotations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('created_at', monthStart);

      setStats({ total: total || 0, approvedThisMonth: approved || 0 });
    } catch (error) {
      console.error('Error loading quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <TrendingUp className="w-6 h-6 text-green-600" />
        <h3 className="text-xl font-bold text-slate-900">Cotizaciones</h3>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-semibold">Total Emitidas</p>
            <p className="text-2xl font-bold text-green-900">{stats.total}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-lg">
            <p className="text-sm text-emerald-600 font-semibold">Aprobadas (Mes)</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.approvedThisMonth}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Panel de Órdenes de Trabajo
export function WorkOrdersPanel() {
  const [stats, setStats] = useState({ total: 0, inProgress: 0, pending: 0, closed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkOrders();
  }, []);

  const loadWorkOrders = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const monthStart = startOfMonth.toISOString().split('T')[0];

      const { count: total } = await supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart);

      const { count: inProgress } = await supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in_progress')
        .gte('created_at', monthStart);

      const { count: pending } = await supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_approval')
        .gte('created_at', monthStart);

      const { count: closed } = await supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', monthStart);

      setStats({ total: total || 0, inProgress: inProgress || 0, pending: pending || 0, closed: closed || 0 });
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Zap className="w-6 h-6 text-amber-600" />
        <h3 className="text-xl font-bold text-slate-900">Órdenes de Trabajo (Mes)</h3>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-amber-50 p-4 rounded-lg">
            <p className="text-sm text-amber-600 font-semibold">Total</p>
            <p className="text-2xl font-bold text-amber-900">{stats.total}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600 font-semibold">En Curso</p>
            <p className="text-2xl font-bold text-orange-900">{stats.inProgress}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-600 font-semibold">Pendientes</p>
            <p className="text-2xl font-bold text-red-900">{stats.pending}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-semibold">Cerradas</p>
            <p className="text-2xl font-bold text-green-900">{stats.closed}</p>
          </div>
        </div>
      )}
    </div>
  );
}
