import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Clock3,
  Users,
  FileText,
  UserCheck,
  Wrench,
  ShieldAlert,
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

interface AlertStats {
  emergencies: EmergencyBreakdown;
  pendingApprovals: number;
  overdueTasks: number;
  clientRequests: number;
  pendingQuotes: number;
  availableTechnicians: number;
  maintenancesToday: number;
}

function MetricPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${className}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
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
  tone?: 'slate' | 'amber' | 'purple' | 'green' | 'blue';
}) {
  const toneClasses = {
    slate: {
      card: 'bg-white border-slate-200',
      icon: 'text-slate-600',
      value: 'text-slate-900',
      button: 'bg-slate-100 hover:bg-slate-200 text-slate-900',
    },
    amber: {
      card: 'bg-white border-amber-200',
      icon: 'text-amber-600',
      value: 'text-amber-700',
      button: 'bg-amber-50 hover:bg-amber-100 text-amber-800',
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
    blue: {
      card: 'bg-white border-blue-200',
      icon: 'text-blue-600',
      value: 'text-blue-700',
      button: 'bg-blue-50 hover:bg-blue-100 text-blue-800',
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
        emergencies: {
          total: emergencies.length,
          active: activeEmergencies,
          stopped: stoppedCount,
          observation: observationCount,
          operational: operationalCount,
        },
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
      <div className="rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 via-white to-red-50 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-2xl bg-red-100">
            <ShieldAlert className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Resumen de Emergencias</h3>
            <p className="text-sm text-slate-600">
              Estado general de emergencias y cierres operativos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('emergencies')}
          className="mt-5 w-full md:w-auto rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-3 text-sm font-semibold transition"
        >
          Ver emergencias
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <ActionCard
          title="Pendientes de Aprobación"
          value={stats.pendingApprovals}
          description="Órdenes de trabajo aguardando aprobación administrativa."
          icon={<Clock3 className="w-7 h-7" />}
          buttonLabel="Aprobar órdenes"
          onClick={() => onNavigate?.('work-orders')}
          tone="amber"
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

        <ActionCard
          title="Solicitudes de Clientes"
          value={stats.clientRequests}
          description="Solicitudes registradas directamente por clientes."
          icon={<Users className="w-7 h-7" />}
          buttonLabel="Ver solicitudes"
          onClick={() => onNavigate?.('service-requests')}
          tone="purple"
        />

        <ActionCard
          title="Cotizaciones Pendientes"
          value={stats.pendingQuotes}
          description="Solicitudes que aún requieren cotización o revisión comercial."
          icon={<FileText className="w-7 h-7" />}
          buttonLabel="Seguimiento"
          onClick={() => onNavigate?.('service-requests')}
          tone="blue"
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
          title="Mantenimientos Hoy"
          value={stats.maintenancesToday}
          description="Mantenimientos completados hoy por el equipo técnico."
          icon={<Wrench className="w-7 h-7" />}
          buttonLabel="Ver cronograma"
          onClick={() => onNavigate?.('maintenance-checklist')}
          tone="slate"
        />
      </div>
    </section>
  );
}

export default AlertDashboard;