import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Zap,
  Clock3,
  BadgeCheck,
  Users,
  ClipboardList,
  UserCheck,
  TrendingUp,
} from 'lucide-react';

type EmergencyVisitRow = {
  id: string;
  status: string | null;
  final_status: string | null;
  reactivation_date?: string | null;
};

type ServiceRequestRow = {
  id: string;
  status: string | null;
  created_by_client?: boolean | null;
};

type WorkOrderRow = {
  id: string;
  status: string | null;
  scheduled_date?: string | null;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  role: string | null;
  is_active?: boolean | null;
};

type MaintenanceChecklistRow = {
  id: string;
  status: string | null;
  completion_date?: string | null;
  month?: number | null;
  year?: number | null;
};

interface AlertDashboardProps {
  onNavigate?: (target: string) => void;
}

interface AlertCardProps {
  title: string;
  value: number;
  description: string;
  buttonLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

function AlertCard({
  title,
  value,
  description,
  buttonLabel,
  icon: Icon,
  onClick,
}: AlertCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="w-6 h-6 text-slate-500 shrink-0" />
          <h3 className="text-[18px] font-semibold text-slate-900 leading-tight">{title}</h3>
        </div>
        <span className="text-[16px] font-bold text-slate-900 shrink-0">{value}</span>
      </div>

      <p className="text-[15px] text-slate-600 min-h-[56px]">{description}</p>

      <button
        type="button"
        onClick={onClick}
        className="mt-4 w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 transition"
      >
        {buttonLabel} →
      </button>
    </div>
  );
}

function isPendingServiceRequest(status: string | null | undefined): boolean {
  const normalized = (status || '').toLowerCase();
  return [
    'new',
    'created',
    'pending',
    'submitted',
    'in_review',
    'awaiting_approval',
    'analysis',
  ].includes(normalized);
}

function isEmergencyStillOpen(row: EmergencyVisitRow): boolean {
  const status = (row.status || '').toLowerCase();
  const finalStatus = (row.final_status || '').toLowerCase();

  return (
    ['reported', 'assigned', 'in_progress', 'pending'].includes(status) ||
    (['stopped', 'observation'].includes(finalStatus) && !row.reactivation_date)
  );
}

function isOlderThanThreeDays(value?: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return diffMs > 3 * 24 * 60 * 60 * 1000;
}

function isToday(value?: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default function AlertDashboard({ onNavigate }: AlertDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [emergencyRows, setEmergencyRows] = useState<EmergencyVisitRow[]>([]);
  const [serviceRequestRows, setServiceRequestRows] = useState<ServiceRequestRow[]>([]);
  const [workOrderRows, setWorkOrderRows] = useState<WorkOrderRow[]>([]);
  const [profileRows, setProfileRows] = useState<ProfileRow[]>([]);
  const [maintenanceRows, setMaintenanceRows] = useState<MaintenanceChecklistRow[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const [emergencyResult, serviceRequestResult, workOrderResult, profileResult, maintenanceResult] =
        await Promise.all([
          supabase
            .from('emergency_visits')
            .select('id, status, final_status, reactivation_date')
            .limit(5000),
          supabase
            .from('service_requests')
            .select('id, status, created_by_client')
            .limit(5000),
          supabase
            .from('work_orders')
            .select('id, status, scheduled_date, created_at')
            .limit(5000),
          supabase
            .from('profiles')
            .select('id, role, is_active')
            .limit(5000),
          supabase
            .from('mnt_checklists')
            .select('id, status, completion_date, month, year')
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .limit(5000),
        ]);

      if (emergencyResult.error) throw emergencyResult.error;
      if (serviceRequestResult.error) throw serviceRequestResult.error;
      if (workOrderResult.error) throw workOrderResult.error;
      if (profileResult.error) throw profileResult.error;
      if (maintenanceResult.error) throw maintenanceResult.error;

      setEmergencyRows((emergencyResult.data as EmergencyVisitRow[]) || []);
      setServiceRequestRows((serviceRequestResult.data as ServiceRequestRow[]) || []);
      setWorkOrderRows((workOrderResult.data as WorkOrderRow[]) || []);
      setProfileRows((profileResult.data as ProfileRow[]) || []);
      setMaintenanceRows((maintenanceResult.data as MaintenanceChecklistRow[]) || []);
    } catch (error) {
      console.error('Error loading alert dashboard:', error);
      setEmergencyRows([]);
      setServiceRequestRows([]);
      setWorkOrderRows([]);
      setProfileRows([]);
      setMaintenanceRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const emergenciesActive = emergencyRows.filter(isEmergencyStillOpen).length;
    const elevatorsWithProblems = emergencyRows.filter(
      (row) => ['stopped', 'observation'].includes((row.final_status || '').toLowerCase()) && !row.reactivation_date
    ).length;

    const pendingApproval = workOrderRows.filter((row) =>
      ['pending_approval', 'awaiting_approval', 'submitted'].includes((row.status || '').toLowerCase())
    ).length;

    const overdueTasks = workOrderRows.filter((row) => {
      const status = (row.status || '').toLowerCase();
      const unfinished = !['completed', 'closed', 'cancelled'].includes(status);
      return unfinished && isOlderThanThreeDays(row.scheduled_date || row.created_at);
    }).length;

    const clientRequests = serviceRequestRows.filter((row) => !!row.created_by_client).length;

    const quotePending = serviceRequestRows.filter((row) =>
      ['quoted', 'awaiting_quote_approval', 'quote_pending'].includes((row.status || '').toLowerCase())
    ).length;

    const techniciansAvailable = profileRows.filter(
      (row) => (row.role || '').toLowerCase() === 'technician' && row.is_active !== false
    ).length;

    const maintenancesToday = maintenanceRows.filter(
      (row) =>
        (row.status || '').toLowerCase() === 'completed' &&
        isToday(row.completion_date)
    ).length;

    return {
      emergenciesActive,
      elevatorsWithProblems,
      pendingApproval,
      overdueTasks,
      clientRequests,
      quotePending,
      techniciansAvailable,
      maintenancesToday,
    };
  }, [emergencyRows, serviceRequestRows, workOrderRows, profileRows, maintenanceRows]);

  const handleNavigate = (target: string) => {
    if (onNavigate) onNavigate(target);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-pulse">
            <div className="h-7 w-40 bg-slate-200 rounded mb-4" />
            <div className="h-14 w-full bg-slate-100 rounded mb-4" />
            <div className="h-12 w-full bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <h2 className="text-3xl font-bold text-slate-900">Centro de Alertas y Notificaciones</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        <AlertCard
          title="Emergencias Activas"
          value={stats.emergenciesActive}
          description="Llamadas de emergencia que requieren atención inmediata"
          buttonLabel="Ver emergencias"
          icon={AlertTriangle}
          onClick={() => handleNavigate('emergencies')}
        />

        <AlertCard
          title="Ascensores con Problemas"
          value={stats.elevatorsWithProblems}
          description="Reportes de fallas en ascensores"
          buttonLabel="Revisar reportes"
          icon={Zap}
          onClick={() => handleNavigate('emergency-reports')}
        />

        <AlertCard
          title="Pendientes de Aprobación"
          value={stats.pendingApproval}
          description="Órdenes de trabajo aguardando aprobación"
          buttonLabel="Aprobar órdenes"
          icon={Clock3}
          onClick={() => handleNavigate('work-orders')}
        />

        <AlertCard
          title="Tareas Vencidas"
          value={stats.overdueTasks}
          description="Órdenes sin completar por más de 3 días"
          buttonLabel="Gestionar urgentes"
          icon={BadgeCheck}
          onClick={() => handleNavigate('overdue')}
        />

        <AlertCard
          title="Solicitudes de Clientes"
          value={stats.clientRequests}
          description="Nuevas solicitudes de servicio"
          buttonLabel="Ver solicitudes"
          icon={Users}
          onClick={() => handleNavigate('service-requests')}
        />

        <AlertCard
          title="Cotizaciones Pendientes"
          value={stats.quotePending}
          description="Cotizaciones en espera"
          buttonLabel="Seguimiento"
          icon={ClipboardList}
          onClick={() => handleNavigate('quotes')}
        />

        <AlertCard
          title="Técnicos Disponibles"
          value={stats.techniciansAvailable}
          description="Técnicos activos en el sistema"
          buttonLabel="Ver equipo"
          icon={UserCheck}
          onClick={() => handleNavigate('technicians')}
        />

        <AlertCard
          title="Mantenimientos Hoy"
          value={stats.maintenancesToday}
          description="Mantenimientos completados hoy"
          buttonLabel="Ver cronograma"
          icon={TrendingUp}
          onClick={() => handleNavigate('maintenances')}
        />
      </div>
    </div>
  );
}
