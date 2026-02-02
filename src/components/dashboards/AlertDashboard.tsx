import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Users,
  Wrench,
  Clock,
  TrendingUp,
  Zap,
  // ...existing code...
  AlertCircle,
  CheckCircle,
  // ...existing code...
  // ...existing code...
  FileText,
} from 'lucide-react';

interface AlertDashboardProps {
  onNavigate?: (path: string) => void;
}

interface AlertStats {
  activeEmergencies: number;
  pendingApprovals: number;
  clientRequests: number;
  techniciansAvailable: number;
  maintenanceToday: number;
  overdueTasks: number;
  elevatorIssues: number;
  pendingQuotations: number;
}

export function AlertDashboard({ onNavigate }: AlertDashboardProps = {}) {
  const [stats, setStats] = useState<AlertStats>({
    activeEmergencies: 0,
    pendingApprovals: 0,
    clientRequests: 0,
    techniciansAvailable: 0,
    maintenanceToday: 0,
    overdueTasks: 0,
    elevatorIssues: 0,
    pendingQuotations: 0,
  });
  const [loading, setLoading] = useState(true);

  // Mapeo de acciones a rutas de navegación
  const actionPaths: Record<string, string> = {
    'Ver emergencias': 'emergencies',
    'Revisar reportes': 'emergencies',
    'Gestionar urgentes': 'work-orders',
    'Aprobar órdenes': 'work-orders',
    'Ver solicitudes': 'service-requests',
    'Seguimiento': 'quotations',
    'Ver equipo': 'users',
    'Ver cronograma': 'maintenance-calendar',
  };

  useEffect(() => {
    loadAlertData();
    // Subscribe to real-time changes
    const emergencies = supabase
      .channel('emergencies_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_visits' }, () => {
        loadAlertData();
      })
      .subscribe();

    const workOrders = supabase
      .channel('workorders_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => {
        loadAlertData();
      })
      .subscribe();

    const serviceRequests = supabase
      .channel('requests_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        loadAlertData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(emergencies);
      supabase.removeChannel(workOrders);
      supabase.removeChannel(serviceRequests);
    };
  }, []);

  const loadAlertData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const threeDaysAgo = new Date(new Date().setDate(new Date().getDate() - 3)).toISOString();

      // Emergencias activas
      const { count: emergencies } = await supabase
        .from('emergency_visits')
        .select('id', { count: 'exact', head: true })
        .in('status', ['reported', 'assigned', 'in_progress']);

      // Órdenes pendientes de aprobación
      const { count: pendingWO } = await supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_approval');

      // Solicitudes de clientes sin revisar
      const { count: clientReqs } = await supabase
        .from('service_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('created_by_client', true);

      // Técnicos disponibles
      const { count: techs } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'technician')
        .eq('is_active', true);

      // Mantenimientos programados hoy
      const { count: maintenance } = await supabase
        .from('maintenance_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('scheduled_date', today);

      // Tareas vencidas (más de 3 días sin completar)
      const { count: overdue } = await supabase
        .from('work_orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_approval')
        .lt('created_at', threeDaysAgo);

      // Ascensores con problemas reportados
      const { count: elevatorProblems } = await supabase
        .from('emergency_visits')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'reported');

      // Cotizaciones pendientes
      const { count: quotes } = await supabase
        .from('quotations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent');

      setStats({
        activeEmergencies: emergencies || 0,
        pendingApprovals: pendingWO || 0,
        clientRequests: clientReqs || 0,
        techniciansAvailable: techs || 0,
        maintenanceToday: maintenance || 0,
        overdueTasks: overdue || 0,
        elevatorIssues: elevatorProblems || 0,
        pendingQuotations: quotes || 0,
      });
    } catch (error) {
      console.error('Error loading alert data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // Define alertas con severidad
  const alerts = [
    {
      id: 'emergencies',
      title: 'Emergencias Activas',
      value: stats.activeEmergencies,
      icon: AlertTriangle,
      color: 'red',
      severity: stats.activeEmergencies > 0 ? 'critical' : 'normal',
      description: 'Llamadas de emergencia que requieren atención inmediata',
      action: 'Ver emergencias',
    },
    {
      id: 'elevator-issues',
      title: 'Ascensores con Problemas',
      value: stats.elevatorIssues,
      icon: Zap,
      color: 'orange',
      severity: stats.elevatorIssues > 0 ? 'warning' : 'normal',
      description: 'Reportes de fallas en ascensores',
      action: 'Revisar reportes',
    },
    {
      id: 'pending-approvals',
      title: 'Pendientes de Aprobación',
      value: stats.pendingApprovals,
      icon: Clock,
      color: 'yellow',
      severity: stats.pendingApprovals > 0 ? 'warning' : 'normal',
      description: 'Órdenes de trabajo aguardando aprobación',
      action: 'Aprobar órdenes',
    },
    {
      id: 'overdue',
      title: 'Tareas Vencidas',
      value: stats.overdueTasks,
      icon: AlertCircle,
      color: 'red',
      severity: stats.overdueTasks > 0 ? 'critical' : 'normal',
      description: 'Órdenes sin completar por más de 3 días',
      action: 'Gestionar urgentes',
    },
    {
      id: 'client-requests',
      title: 'Solicitudes de Clientes',
      value: stats.clientRequests,
      icon: Users,
      color: 'blue',
      severity: stats.clientRequests > 2 ? 'warning' : 'normal',
      description: 'Nuevas solicitudes de servicio de clientes',
      action: 'Ver solicitudes',
    },
    {
      id: 'quotations',
      title: 'Cotizaciones Pendientes',
      value: stats.pendingQuotations,
      icon: FileText,
      color: 'purple',
      severity: stats.pendingQuotations > 0 ? 'warning' : 'normal',
      description: 'Cotizaciones enviadas a clientes en espera',
      action: 'Seguimiento',
    },
    {
      id: 'technicians',
      title: 'Técnicos Disponibles',
      value: stats.techniciansAvailable,
      icon: Wrench,
      color: 'green',
      severity: stats.techniciansAvailable > 1 ? 'normal' : 'warning',
      description: 'Técnicos activos en el sistema',
      action: 'Ver equipo',
    },
    {
      id: 'maintenance',
      title: 'Mantenimientos Hoy',
      value: stats.maintenanceToday,
      icon: TrendingUp,
      color: 'cyan',
      severity: stats.maintenanceToday > 0 ? 'normal' : 'normal',
      description: 'Mantenimientos programados para hoy',
      action: 'Ver cronograma',
    },
  ];

  // Separar alertas críticas, advertencias y normales
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const normalAlerts = alerts.filter(a => a.severity === 'normal');

  const AlertCard = ({ alert }: { alert: (typeof alerts)[0] }) => {
    const Icon = alert.icon;
    const bgColor =
      alert.severity === 'critical'
        ? 'bg-red-50 border-red-300'
        : alert.severity === 'warning'
        ? 'bg-yellow-50 border-yellow-300'
        : alert.color === 'red'
        ? 'bg-red-50 border-red-200'
        : alert.color === 'orange'
        ? 'bg-orange-50 border-orange-200'
        : alert.color === 'yellow'
        ? 'bg-yellow-50 border-yellow-200'
        : alert.color === 'blue'
        ? 'bg-blue-50 border-blue-200'
        : alert.color === 'purple'
        ? 'bg-purple-50 border-purple-200'
        : alert.color === 'green'
        ? 'bg-green-50 border-green-200'
        : 'bg-cyan-50 border-cyan-200';

    const textColor =
      alert.severity === 'critical'
        ? 'text-red-900'
        : alert.severity === 'warning'
        ? 'text-yellow-900'
        : alert.color === 'red'
        ? 'text-red-900'
        : alert.color === 'orange'
        ? 'text-orange-900'
        : alert.color === 'yellow'
        ? 'text-yellow-900'
        : alert.color === 'blue'
        ? 'text-blue-900'
        : alert.color === 'purple'
        ? 'text-purple-900'
        : alert.color === 'green'
        ? 'text-green-900'
        : 'text-cyan-900';

    const iconColor =
      alert.severity === 'critical'
        ? 'text-red-600'
        : alert.severity === 'warning'
        ? 'text-yellow-600'
        : alert.color === 'red'
        ? 'text-red-600'
        : alert.color === 'orange'
        ? 'text-orange-600'
        : alert.color === 'yellow'
        ? 'text-yellow-600'
        : alert.color === 'blue'
        ? 'text-blue-600'
        : alert.color === 'purple'
        ? 'text-purple-600'
        : alert.color === 'green'
        ? 'text-green-600'
        : 'text-cyan-600';

    const badgeColor =
      alert.severity === 'critical'
        ? 'bg-red-200 text-red-800'
        : alert.severity === 'warning'
        ? 'bg-yellow-200 text-yellow-800'
        : alert.color === 'red'
        ? 'bg-red-100 text-red-700'
        : alert.color === 'orange'
        ? 'bg-orange-100 text-orange-700'
        : alert.color === 'yellow'
        ? 'bg-yellow-100 text-yellow-700'
        : alert.color === 'blue'
        ? 'bg-blue-100 text-blue-700'
        : alert.color === 'purple'
        ? 'bg-purple-100 text-purple-700'
        : alert.color === 'green'
        ? 'bg-green-100 text-green-700'
        : 'bg-cyan-100 text-cyan-700';

    return (
      <div
        className={`relative border-2 rounded-xl p-5 overflow-hidden transition-all duration-300 hover:shadow-lg ${bgColor} ${
          alert.severity === 'critical' ? 'animate-pulse' : ''
        }`}
      >
        {/* Borde animado para críticos */}
        {alert.severity === 'critical' && (
          <div className="absolute inset-0 border-2 border-red-500 rounded-xl animate-pulse pointer-events-none"></div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${badgeColor}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <h3 className={`font-bold text-sm ${textColor}`}>{alert.title}</h3>
              <p className={`text-xs opacity-75 ${textColor}`}>{alert.description}</p>
            </div>
          </div>

          {/* Badge con el número */}
          <div className={`text-center ${badgeColor} rounded-lg px-3 py-1 min-w-fit`}>
            <span className="text-2xl font-bold">{alert.value}</span>
          </div>
        </div>

        {/* Botón de acción */}
        <button 
          onClick={() => {
            const path = actionPaths[alert.action];
            if (path && onNavigate) {
              onNavigate(path);
            }
          }}
          className={`w-full mt-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${badgeColor} hover:opacity-80 cursor-pointer`}
        >
          {alert.action} →
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ALERTAS CRÍTICAS */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
            <h2 className="text-lg font-bold text-red-600">ALERTAS CRÍTICAS</h2>
            <span className="ml-auto bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">
              {criticalAlerts.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {criticalAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* ALERTAS DE ADVERTENCIA */}
      {warningAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h2 className="text-lg font-bold text-yellow-600">ADVERTENCIAS</h2>
            <span className="ml-auto bg-yellow-600 text-white px-3 py-1 rounded-full text-xs font-bold">
              {warningAlerts.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warningAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* ESTADO NORMAL */}
      {normalAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-green-600">ESTADO OPERACIONAL</h2>
            <span className="ml-auto bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">
              {normalAlerts.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {normalAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Si todo está bien */}
      {criticalAlerts.length === 0 && warningAlerts.length === 0 && (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-green-900 mb-2">Sistema en Óptimas Condiciones</h3>
          <p className="text-green-700">Todas las operaciones están funcionando correctamente. Continúa monitoreando.</p>
        </div>
      )}
    </div>
  );
}
