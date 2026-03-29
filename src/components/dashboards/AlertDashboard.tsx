import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Wrench,
  ClipboardCheck,
  Clock3,
  Users,
  FileText,
  UserCheck,
  Activity,
} from 'lucide-react';

interface AlertDashboardProps {
  onNavigate?: (section: string) => void;
}

interface AlertStats {
  activeEmergencies: number;
  elevatorsWithProblems: number;
  pendingApprovals: number;
  overdueTasks: number;
  clientRequests: number;
  pendingQuotes: number;
  availableTechnicians: number;
  maintenancesToday: number;
}

function StatCard({
  title,
  value,
  description,
  icon,
  actionLabel,
  onClick,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  actionLabel: string;
  onClick?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-slate-600">{icon}</div>
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        </div>
        <span className="text-3xl font-bold text-slate-900">{value}</span>
      </div>

      <p className="text-sm text-slate-600 min-h-[48px]">{description}</p>

      <button
        type="button"
        onClick={onClick}
        className="mt-4 w-full rounded-xl bg-slate-100 hover:bg-slate-200 transition px-4 py-3 text-sm font-semibold text-slate-900"
      >
        {actionLabel}
      </button>
    </div>
  );
}

export function AlertDashboard({ onNavigate }: AlertDashboardProps) {
  const [stats, setStats] = useState<AlertStats>({
    activeEmergencies: 0,
    elevatorsWithProblems: 0,
    pendingApprovals: 0,
    overdueTasks: 0,
    clientRequests: 0,
    pendingQuotes: 0,
    availableTechnicians: 0,
    maintenancesToday: 0,
  });

  const todayRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  }, []);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [
        emergenciesRes,
        serviceRequestsRes,
        workOrdersRes,
        techniciansRes,
        maintenancesTodayRes,
      ] = await Promise.all([
        supabase
          .from('emergency_visits')
          .select('id, status, final_status, reactivation_date', { count: 'exact' }),

        supabase
          .from('service_requests')
          .select('id, status, created_by_client, request_type', { count: 'exact' }),

        supabase
          .from('work_orders')
          .select('id, status, created_at', { count: 'exact' }),

        supabase
          .from('profiles')
          .select('id, is_active, role', { count: 'exact' })
          .eq('role', 'technician')
          .eq('is_active', true),

        supabase
          .from('mnt_checklists')
          .select('id, status, completion_date', { count: 'exact' })
          .eq('status', 'completed')
          .gte('completion_date', todayRange.startIso)
          .lte('completion_date', todayRange.endIso),
      ]);

      const emergencies = emergenciesRes.data || [];
      const serviceRequests = serviceRequestsRes.data || [];
      const workOrders = workOrdersRes.data || [];

      const activeEmergencies = emergencies.filter((item: any) => {
        const status = item?.status;
        const finalStatus = item?.final_status;
        const reactivationDate = item?.reactivation_date;

        const inFlow =
          status === 'reported' ||
          status === 'assigned' ||
          status === 'in_progress' ||
          status === 'pending';

        const stoppedWithoutReactivation =
          (finalStatus === 'stopped' || finalStatus === 'observation') &&
          !reactivationDate;

        return inFlow || stoppedWithoutReactivation;
      }).length;

      const elevatorsWithProblems = emergencies.filter((item: any) => {
        const finalStatus = item?.final_status;
        const reactivationDate = item?.reactivation_date;
        return (finalStatus === 'stopped' || finalStatus === 'observation') && !reactivationDate;
      }).length;

      const pendingApprovals = workOrders.filter((item: any) =>
        ['pending_approval', 'awaiting_approval', 'submitted'].includes(item?.status)
      ).length;

      const overdueTasks = workOrders.filter((item: any) => {
        if (['completed', 'cancelled', 'rejected'].includes(item?.status)) return false;
        const createdAt = item?.created_at ? new Date(item.created_at).getTime() : 0;
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        return createdAt > 0 && Date.now() - createdAt > threeDaysMs;
      }).length;

      const clientRequests = serviceRequests.filter((item: any) => item?.created_by_client === true).length;

      const pendingQuotes = serviceRequests.filter((item: any) =>
        ['quote_pending', 'quotation_pending', 'pending_quote'].includes(item?.status)
      ).length;

      const availableTechnicians = techniciansRes.count || 0;
      const maintenancesToday = maintenancesTodayRes.count || 0;

      setStats({
        activeEmergencies,
        elevatorsWithProblems,
        pendingApprovals,
        overdueTasks,
        clientRequests,
        pendingQuotes,
        availableTechnicians,
        maintenancesToday,
      });
    } catch (error) {
      console.error('Error cargando AlertDashboard:', error);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <h2 className="text-4xl font-bold text-slate-900">Centro de Alertas y Notificaciones</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Emergencias Activas"
          value={stats.activeEmergencies}
          description="Llamadas de emergencia que requieren atención inmediata"
          icon={<AlertTriangle className="w-7 h-7" />}
          actionLabel="Ver emergencias →"
          onClick={() => onNavigate?.('emergencies')}
        />

        <StatCard
          title="Ascensores con Problemas"
          value={stats.elevatorsWithProblems}
          description="Reportes de fallas en ascensores"
          icon={<Activity className="w-7 h-7" />}
          actionLabel="Revisar reportes →"
          onClick={() => onNavigate?.('emergencies')}
        />

        <StatCard
          title="Pendientes de Aprobación"
          value={stats.pendingApprovals}
          description="Órdenes de trabajo aguardando aprobación"
          icon={<Clock3 className="w-7 h-7" />}
          actionLabel="Aprobar órdenes →"
          onClick={() => onNavigate?.('work_orders')}
        />

        <StatCard
          title="Tareas Vencidas"
          value={stats.overdueTasks}
          description="Órdenes sin completar por más de 3 días"
          icon={<AlertTriangle className="w-7 h-7" />}
          actionLabel="Gestionar urgentes →"
          onClick={() => onNavigate?.('work_orders')}
        />

        <StatCard
          title="Solicitudes de Clientes"
          value={stats.clientRequests}
          description="Nuevas solicitudes de servicio"
          icon={<Users className="w-7 h-7" />}
          actionLabel="Ver solicitudes →"
          onClick={() => onNavigate?.('service_requests')}
        />

        <StatCard
          title="Cotizaciones Pendientes"
          value={stats.pendingQuotes}
          description="Cotizaciones en espera"
          icon={<FileText className="w-7 h-7" />}
          actionLabel="Seguimiento →"
          onClick={() => onNavigate?.('quotes')}
        />

        <StatCard
          title="Técnicos Disponibles"
          value={stats.availableTechnicians}
          description="Técnicos activos en el sistema"
          icon={<UserCheck className="w-7 h-7" />}
          actionLabel="Ver equipo →"
          onClick={() => onNavigate?.('technicians')}
        />

        <StatCard
          title="Mantenimientos Hoy"
          value={stats.maintenancesToday}
          description="Mantenimientos completados hoy"
          icon={<Wrench className="w-7 h-7" />}
          actionLabel="Ver cronograma →"
          onClick={() => onNavigate?.('maintenances')}
        />
      </div>
    </section>
  );
}

export default AlertDashboard;