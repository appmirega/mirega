import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Users,
  UserCheck,
  Wrench,
  ShieldAlert,
  Briefcase,
  ClipboardList,
} from 'lucide-react';

interface AlertDashboardProps {
  onNavigate?: (section: string) => void;
}

interface EmergencyBreakdown {
  total: number;
  active: number;
  stopped: number;
  observation: number;
  operational: number;
}

interface MaintenanceBreakdown {
  totalElevators: number;
  completed: number;
  pending: number;
  percent: number;
}

interface WorkOrderBreakdown {
  total: number;
  approved: number;
  pending: number;
  inProgress: number;
}

interface AlertStats {
  emergencies: EmergencyBreakdown;
  maintenances: MaintenanceBreakdown;
  workOrders: WorkOrderBreakdown;
  overdueTasks: number;
  clientRequests: number;
  availableTechnicians: number;
  maintenancesToday: number;
}

function MetricPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number | string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${className}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

function SummaryCard({
  title,
  subtitle,
  icon,
  buttonLabel,
  onClick,
  wrapperClassName,
  buttonClassName,
  metrics,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  buttonLabel: string;
  onClick?: () => void;
  wrapperClassName: string;
  buttonClassName: string;
  metrics: React.ReactNode;
}) {
  return (
    <div className={`rounded-3xl border shadow-sm p-6 ${wrapperClassName}`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="p-3 rounded-2xl bg-white/70">
          {icon}
        </div>
        <div>
          <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {metrics}
      </div>

      <button
        type="button"
        onClick={onClick}
        className={`mt-5 w-full md:w-auto rounded-xl px-5 py-3 text-sm font-semibold transition ${buttonClassName}`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function ActionCard({
  title,
  value,
  description,
  icon,
  buttonLabel,
  onClick,
  tone = 'slate',
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  buttonLabel: string;
  onClick?: () => void;
  tone?: 'slate' | 'purple' | 'green';
}) {
  const toneClasses = {
    slate: {
      card: 'bg-white border-slate-200',
      icon: 'text-slate-600',
      value: 'text-slate-900',
      button: 'bg-slate-100 hover:bg-slate-200 text-slate-900',
    },
    purple: {
      card: 'bg-white border-purple-200',
      icon: 'text-purple-600',
      value: 'text-purple-700',
      button: 'bg-purple-50 hover:bg-purple-100 text-purple-800',
    },
    green: {
      card: 'bg-white border-green-200',
      icon: 'text-green-600',
      value: 'text-green-700',
      button: 'bg-green-50 hover:bg-green-100 text-green-800',
    },
  } as const;

  const styles = toneClasses[tone];

  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={styles.icon}>{icon}</div>
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        </div>
        <div className={`text-3xl font-bold ${styles.value}`}>{value}</div>
      </div>

      <p className="mt-3 text-sm text-slate-600 min-h-[48px]">{description}</p>

      <button
        type="button"
        onClick={onClick}
        className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${styles.button}`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export function AlertDashboard({ onNavigate }: AlertDashboardProps) {
  const [stats, setStats] = useState<AlertStats>({
    emergencies: {
      total: 0,
      active: 0,
      stopped: 0,
      observation: 0,
      operational: 0,
    },
    maintenances: {
      totalElevators: 0,
      completed: 0,
      pending: 0,
      percent: 0,
    },
    workOrders: {
      total: 0,
      approved: 0,
      pending: 0,
      inProgress: 0,
    },
    overdueTasks: 0,
    clientRequests: 0,
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
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [
        emergenciesRes,
        elevatorsRes,
        monthlyMaintenancesRes,
        serviceRequestsRes,
        workOrdersRes,
        techniciansRes,
        maintenancesTodayRes,
      ] = await Promise.all([
        supabase
          .from('emergency_visits')
          .select('id, status, final_status, reactivation_date', { count: 'exact' }),

        supabase
          .from('elevators')
          .select('id', { count: 'exact' })
          .eq('status', 'active'),

        supabase
          .from('mnt_checklists')
          .select('id, elevator_id, status, month, year', { count: 'exact' })
          .eq('status', 'completed')
          .eq('month', month)
          .eq('year', year),

        supabase
          .from('service_requests')
          .select('id, status, created_by_client', { count: 'exact' }),

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
      const activeElevators = elevatorsRes.data || [];
      const monthlyMaintenances = monthlyMaintenancesRes.data || [];
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

        const unresolvedStopped =
          (finalStatus === 'stopped' || finalStatus === 'observation') &&
          !reactivationDate;

        return inFlow || unresolvedStopped;
      }).length;

      const stoppedCount = emergencies.filter(
        (item: any) => item?.final_status === 'stopped' && !item?.reactivation_date
      ).length;

      const observationCount = emergencies.filter(
        (item: any) => item?.final_status === 'observation' && !item?.reactivation_date
      ).length;

      const operationalCount = emergencies.filter(
        (item: any) => item?.final_status === 'operational'
      ).length;

      const completedElevatorIds = new Set(
        monthlyMaintenances.map((item: any) => item.elevator_id).filter(Boolean)
      );
      const totalElevators = activeElevators.length;
      const completedMaintenances = completedElevatorIds.size;
      const pendingMaintenances = Math.max(totalElevators - completedMaintenances, 0);
      const maintenancePercent =
        totalElevators > 0
          ? Math.round((completedMaintenances / totalElevators) * 100)
          : 0;

      const approvedWorkOrders = workOrders.filter((item: any) =>
        ['approved', 'accepted'].includes(item?.status)
      ).length;

      const pendingWorkOrders = workOrders.filter((item: any) =>
        ['pending', 'pending_approval', 'awaiting_approval', 'submitted'].includes(item?.status)
      ).length;

      const inProgressWorkOrders = workOrders.filter((item: any) =>
        ['assigned', 'in_progress'].includes(item?.status)
      ).length;

      const overdueTasks = workOrders.filter((item: any) => {
        if (['completed', 'cancelled', 'rejected'].includes(item?.status)) return false;
        const createdAt = item?.created_at ? new Date(item.created_at).getTime() : 0;
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        return createdAt > 0 && Date.now() - createdAt > threeDaysMs;
      }).length;

      const clientRequests = serviceRequests.filter((item: any) => item?.created_by_client === true).length;

      const availableTechnicians = techniciansRes.count || 0;
      const maintenancesToday = maintenancesTodayRes.count || 0;

      setStats({
        emergencies: {
          total: emergencies.length,
          active: activeEmergencies,
          stopped: stoppedCount,
          observation: observationCount,
          operational: operationalCount,
        },
        maintenances: {
          totalElevators,
          completed: completedMaintenances,
          pending: pendingMaintenances,
          percent: maintenancePercent,
        },
        workOrders: {
          total: workOrders.length,
          approved: approvedWorkOrders,
          pending: pendingWorkOrders,
          inProgress: inProgressWorkOrders,
        },
        overdueTasks,
        clientRequests,
        availableTechnicians,
        maintenancesToday,
      });
    } catch (error) {
      console.error('Error cargando AlertDashboard:', error);
    }
  };

  return (
    <section className="space-y-6">
      <SummaryCard
        title="Resumen de Emergencias"
        subtitle="Estado general de emergencias y cierres operativos"
        icon={<ShieldAlert className="w-7 h-7 text-red-600" />}
        buttonLabel="Ver emergencias"
        onClick={() => onNavigate?.('emergencies')}
        wrapperClassName="border-red-200 bg-gradient-to-br from-red-50 via-white to-red-50"
        buttonClassName="bg-red-600 hover:bg-red-700 text-white"
        metrics={
          <>
            <MetricPill
              label="Total"
              value={stats.emergencies.total}
              className="bg-slate-100 text-slate-800"
            />
            <MetricPill
              label="Activas"
              value={stats.emergencies.active}
              className="bg-red-100 text-red-700"
            />
            <MetricPill
              label="Detenidas"
              value={stats.emergencies.stopped}
              className="bg-rose-100 text-rose-700"
            />
            <MetricPill
              label="En observación"
              value={stats.emergencies.observation}
              className="bg-amber-100 text-amber-700"
            />
            <MetricPill
              label="Operativas"
              value={stats.emergencies.operational}
              className="bg-green-100 text-green-700"
            />
          </>
        }
      />

      <SummaryCard
        title="Resumen de Mantenimientos"
        subtitle="Avance del mantenimiento mensual sobre ascensores activos"
        icon={<Wrench className="w-7 h-7 text-blue-600" />}
        buttonLabel="Ver mantenimientos"
        onClick={() => onNavigate?.('maintenance-checklist')}
        wrapperClassName="border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50"
        buttonClassName="bg-blue-600 hover:bg-blue-700 text-white"
        metrics={
          <>
            <MetricPill
              label="Total ascensores"
              value={stats.maintenances.totalElevators}
              className="bg-slate-100 text-slate-800"
            />
            <MetricPill
              label="Realizados"
              value={stats.maintenances.completed}
              className="bg-green-100 text-green-700"
            />
            <MetricPill
              label="Pendientes"
              value={stats.maintenances.pending}
              className="bg-amber-100 text-amber-700"
            />
            <MetricPill
              label="Avance"
              value={`${stats.maintenances.percent}%`}
              className="bg-blue-100 text-blue-700"
            />
            <MetricPill
              label="Hechos hoy"
              value={stats.maintenancesToday}
              className="bg-cyan-100 text-cyan-700"
            />
          </>
        }
      />

      <SummaryCard
        title="Resumen de Órdenes de Trabajo"
        subtitle="Estado actual de gestión de órdenes"
        icon={<Briefcase className="w-7 h-7 text-purple-600" />}
        buttonLabel="Ver órdenes de trabajo"
        onClick={() => onNavigate?.('work-orders')}
        wrapperClassName="border-purple-200 bg-gradient-to-br from-purple-50 via-white to-purple-50"
        buttonClassName="bg-purple-600 hover:bg-purple-700 text-white"
        metrics={
          <>
            <MetricPill
              label="Total"
              value={stats.workOrders.total}
              className="bg-slate-100 text-slate-800"
            />
            <MetricPill
              label="Aprobadas"
              value={stats.workOrders.approved}
              className="bg-green-100 text-green-700"
            />
            <MetricPill
              label="Pendientes"
              value={stats.workOrders.pending}
              className="bg-amber-100 text-amber-700"
            />
            <MetricPill
              label="En desarrollo"
              value={stats.workOrders.inProgress}
              className="bg-blue-100 text-blue-700"
            />
            <MetricPill
              label="Vencidas"
              value={stats.overdueTasks}
              className="bg-red-100 text-red-700"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <ActionCard
          title="Solicitudes de Clientes"
          value={stats.clientRequests}
          description="Solicitudes registradas directamente por clientes."
          icon={<ClipboardList className="w-7 h-7" />}
          buttonLabel="Ver solicitudes"
          onClick={() => onNavigate?.('service-requests')}
          tone="purple"
        />

        <ActionCard
          title="Técnicos Disponibles"
          value={stats.availableTechnicians}
          description="Técnicos activos en el sistema y disponibles para asignación."
          icon={<UserCheck className="w-7 h-7" />}
          buttonLabel="Ver equipo"
          onClick={() => onNavigate?.('users')}
          tone="green"
        />

        <ActionCard
          title="Tareas Vencidas"
          value={stats.overdueTasks}
          description="Órdenes sin completar por más de 3 días."
          icon={<AlertTriangle className="w-7 h-7" />}
          buttonLabel="Gestionar urgentes"
          onClick={() => onNavigate?.('work-orders')}
          tone="slate"
        />
      </div>
    </section>
  );
}

export default AlertDashboard;