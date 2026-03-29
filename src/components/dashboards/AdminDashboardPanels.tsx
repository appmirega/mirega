import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Wrench,
  FileText,
} from 'lucide-react';

type EmergencyVisitRow = {
  id: string;
  status: string | null;
  final_status: string | null;
  reactivation_date?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
};

type MaintenanceChecklistRow = {
  id: string;
  elevator_id: string;
  status: string | null;
  month: number | null;
  year: number | null;
  completion_date?: string | null;
};

type ServiceRequestRow = {
  id: string;
  status: string | null;
  created_at?: string | null;
  created_by_client?: boolean | null;
};

interface PanelCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  stats: Array<{
    label: string;
    value: number;
    valueClass: string;
    boxClass: string;
  }>;
  emptyMessage?: string;
}

function PanelCard({ title, icon: Icon, accentClass, stats, emptyMessage }: PanelCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[320px]">
      <div className="flex items-center gap-3 mb-6">
        <Icon className={`w-7 h-7 ${accentClass}`} />
        <h3 className="text-[18px] md:text-[20px] font-bold text-slate-900">{title}</h3>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-2xl px-4 py-5 ${stat.boxClass}`}>
            <p className="text-sm md:text-[15px] font-medium mb-2">{stat.label}</p>
            <p className={`text-2xl md:text-[26px] leading-none font-bold ${stat.valueClass}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {emptyMessage ? (
        <div className="flex items-center justify-center h-[110px] text-center text-slate-600 text-[16px]">
          {emptyMessage}
        </div>
      ) : null}
    </div>
  );
}

function isToday(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isEmergencyStillOpen(row: EmergencyVisitRow): boolean {
  const status = (row.status || '').toLowerCase();
  const finalStatus = (row.final_status || '').toLowerCase();

  const workflowOpen = ['reported', 'assigned', 'in_progress', 'pending'].includes(status);
  const unresolvedFinalState =
    ['stopped', 'observation'].includes(finalStatus) && !row.reactivation_date;

  return workflowOpen || unresolvedFinalState;
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

export default function AdminDashboardPanels() {
  const [loading, setLoading] = useState(true);
  const [emergencyRows, setEmergencyRows] = useState<EmergencyVisitRow[]>([]);
  const [maintenanceRows, setMaintenanceRows] = useState<MaintenanceChecklistRow[]>([]);
  const [serviceRequestRows, setServiceRequestRows] = useState<ServiceRequestRow[]>([]);
  const [activeElevatorsCount, setActiveElevatorsCount] = useState(0);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        emergencyResult,
        maintenanceResult,
        serviceRequestResult,
        elevatorCountResult,
      ] = await Promise.all([
        supabase
          .from('emergency_visits')
          .select('id, status, final_status, reactivation_date, created_at, completed_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('mnt_checklists')
          .select('id, elevator_id, status, month, year, completion_date')
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .limit(5000),
        supabase
          .from('service_requests')
          .select('id, status, created_at, created_by_client')
          .limit(5000),
        supabase
          .from('elevators')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
      ]);

      if (emergencyResult.error) throw emergencyResult.error;
      if (maintenanceResult.error) throw maintenanceResult.error;
      if (serviceRequestResult.error) throw serviceRequestResult.error;
      if (elevatorCountResult.error) throw elevatorCountResult.error;

      setEmergencyRows((emergencyResult.data as EmergencyVisitRow[]) || []);
      setMaintenanceRows((maintenanceResult.data as MaintenanceChecklistRow[]) || []);
      setServiceRequestRows((serviceRequestResult.data as ServiceRequestRow[]) || []);
      setActiveElevatorsCount(elevatorCountResult.count || 0);
    } catch (error) {
      console.error('Error loading admin dashboard panels:', error);
      setEmergencyRows([]);
      setMaintenanceRows([]);
      setServiceRequestRows([]);
      setActiveElevatorsCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const emergencyStats = useMemo(() => {
    const total = emergencyRows.length;
    const active = emergencyRows.filter(isEmergencyStillOpen).length;
    const today = emergencyRows.filter((row) => isToday(row.created_at || row.completed_at)).length;
    return { total, active, today };
  }, [emergencyRows]);

  const maintenanceStats = useMemo(() => {
    const completedElevatorIds = new Set(
      maintenanceRows
        .filter((row) => (row.status || '').toLowerCase() === 'completed' && !!row.elevator_id)
        .map((row) => row.elevator_id)
    );

    const total = activeElevatorsCount;
    const completed = completedElevatorIds.size;
    const pending = Math.max(total - completed, 0);

    return { total, completed, pending };
  }, [maintenanceRows, activeElevatorsCount]);

  const requestStats = useMemo(() => {
    const technician = serviceRequestRows.filter((row) => !row.created_by_client).length;
    const clients = serviceRequestRows.filter((row) => !!row.created_by_client).length;
    const pending = serviceRequestRows.filter((row) => isPendingServiceRequest(row.status)).length;
    return { technician, clients, pending };
  }, [serviceRequestRows]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[320px] animate-pulse">
            <div className="h-8 w-56 bg-slate-200 rounded mb-6" />
            <div className="grid grid-cols-3 gap-5">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-28 rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <PanelCard
        title="Emergencias Recientes"
        icon={AlertTriangle}
        accentClass="text-red-500"
        stats={[
          {
            label: 'Total',
            value: emergencyStats.total,
            valueClass: 'text-red-700',
            boxClass: 'bg-red-50 text-red-600',
          },
          {
            label: 'Activas',
            value: emergencyStats.active,
            valueClass: 'text-orange-700',
            boxClass: 'bg-orange-50 text-orange-600',
          },
          {
            label: 'Hoy',
            value: emergencyStats.today,
            valueClass: 'text-amber-700',
            boxClass: 'bg-amber-50 text-amber-700',
          },
        ]}
        emptyMessage={emergencyStats.total === 0 ? 'No hay emergencias registradas' : undefined}
      />

      <PanelCard
        title="Mantenimientos del Mes"
        icon={Wrench}
        accentClass="text-blue-500"
        stats={[
          {
            label: 'Total',
            value: maintenanceStats.total,
            valueClass: 'text-blue-700',
            boxClass: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Completados',
            value: maintenanceStats.completed,
            valueClass: 'text-green-700',
            boxClass: 'bg-green-50 text-green-600',
          },
          {
            label: 'Pendientes',
            value: maintenanceStats.pending,
            valueClass: 'text-orange-700',
            boxClass: 'bg-orange-50 text-orange-600',
          },
        ]}
      />

      <PanelCard
        title="Solicitudes de Servicio"
        icon={FileText}
        accentClass="text-violet-500"
        stats={[
          {
            label: 'Técnicos',
            value: requestStats.technician,
            valueClass: 'text-violet-700',
            boxClass: 'bg-violet-50 text-violet-600',
          },
          {
            label: 'Clientes',
            value: requestStats.clients,
            valueClass: 'text-blue-700',
            boxClass: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Pendientes',
            value: requestStats.pending,
            valueClass: 'text-orange-700',
            boxClass: 'bg-orange-50 text-orange-600',
          },
        ]}
      />
    </div>
  );
}
