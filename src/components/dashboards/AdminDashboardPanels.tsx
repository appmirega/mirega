import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Wrench,
  ClipboardList,
  FileText,
  Users,
  ChevronRight,
} from 'lucide-react';

interface PanelProps {
  onNavigate?: (section: string) => void;
}

function BasePanel({
  title,
  total,
  subtitle,
  detail1,
  detail2,
  icon,
  actionLabel,
  onClick,
}: {
  title: string;
  total: number;
  subtitle: string;
  detail1?: string;
  detail2?: string;
  icon: React.ReactNode;
  actionLabel: string;
  onClick?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-slate-700">{icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="text-3xl font-bold text-slate-900">{total}</div>
      </div>

      <div className="space-y-1 text-sm text-slate-600 min-h-[44px]">
        {detail1 && <p>{detail1}</p>}
        {detail2 && <p>{detail2}</p>}
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-4 w-full rounded-xl bg-slate-100 hover:bg-slate-200 transition px-4 py-3 text-sm font-semibold text-slate-900 flex items-center justify-center gap-2"
      >
        {actionLabel}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export function EmergenciesPanel({ onNavigate }: PanelProps) {
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('emergency_visits')
          .select('id, status, final_status, reactivation_date');

        if (error) throw error;

        const rows = data || [];

        const activeCount = rows.filter((item: any) => {
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

        const stoppedCount = rows.filter(
          (item: any) =>
            (item?.final_status === 'stopped' || item?.final_status === 'observation') &&
            !item?.reactivation_date
        ).length;

        setTotal(rows.length);
        setActive(activeCount);
        setStopped(stoppedCount);
      } catch (err) {
        console.error('Error cargando panel de emergencias:', err);
      }
    };

    load();
  }, []);

  return (
    <BasePanel
      title="Emergencias Recientes"
      total={total}
      subtitle="Registro total de emergencias"
      detail1={`Activas o sin cierre operativo: ${active}`}
      detail2={`Ascensores detenidos / observación: ${stopped}`}
      icon={<AlertTriangle className="w-7 h-7" />}
      actionLabel="Ver emergencias"
      onClick={() => onNavigate?.('emergencies')}
    />
  );
}

export function MaintenancesPanel({ onNavigate }: PanelProps) {
  const [totalElevators, setTotalElevators] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const [elevatorsRes, checklistsRes] = await Promise.all([
          supabase
            .from('elevators')
            .select('id')
            .eq('status', 'active'),

          supabase
            .from('mnt_checklists')
            .select('id, elevator_id, status, month, year')
            .eq('status', 'completed')
            .eq('month', month)
            .eq('year', year),
        ]);

        if (elevatorsRes.error) throw elevatorsRes.error;
        if (checklistsRes.error) throw checklistsRes.error;

        const activeElevators = elevatorsRes.data || [];
        const completedRows = checklistsRes.data || [];

        const uniqueCompletedElevators = new Set(
          completedRows
            .map((item: any) => item.elevator_id)
            .filter(Boolean)
        );

        const total = activeElevators.length;
        const done = uniqueCompletedElevators.size;
        const missing = Math.max(total - done, 0);

        setTotalElevators(total);
        setCompleted(done);
        setPending(missing);
      } catch (err) {
        console.error('Error cargando panel de mantenimientos:', err);
      }
    };

    load();
  }, []);

  return (
    <BasePanel
      title="Mantenimientos del Mes"
      total={totalElevators}
      subtitle="Total de ascensores activos"
      detail1={`Mantenimientos listos: ${completed}`}
      detail2={`Mantenimientos faltantes: ${pending}`}
      icon={<Wrench className="w-7 h-7" />}
      actionLabel="Ver mantenimientos"
      onClick={() => onNavigate?.('maintenances')}
    />
  );
}

export function ServiceRequestsPanel({ onNavigate }: PanelProps) {
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);
  const [clientCreated, setClientCreated] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('service_requests')
          .select('id, status, created_by_client');

        if (error) throw error;

        const rows = data || [];

        const pendingCount = rows.filter((item: any) =>
          [
            'created',
            'pending',
            'open',
            'quote_pending',
            'quotation_pending',
            'pending_quote',
            'assigned',
            'in_review',
          ].includes(item?.status)
        ).length;

        const clientCount = rows.filter((item: any) => item?.created_by_client === true).length;

        setTotal(rows.length);
        setPending(pendingCount);
        setClientCreated(clientCount);
      } catch (err) {
        console.error('Error cargando panel de solicitudes:', err);
      }
    };

    load();
  }, []);

  return (
    <BasePanel
      title="Solicitudes de Servicio"
      total={total}
      subtitle="Solicitudes registradas"
      detail1={`Pendientes / abiertas: ${pending}`}
      detail2={`Creadas por clientes: ${clientCreated}`}
      icon={<ClipboardList className="w-7 h-7" />}
      actionLabel="Ver solicitudes"
      onClick={() => onNavigate?.('service_requests')}
    />
  );
}

export function QuotesPanel({ onNavigate }: PanelProps) {
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('service_requests')
          .select('id, status');

        if (error) throw error;

        const rows = data || [];

        const quotePendingCount = rows.filter((item: any) =>
          ['quote_pending', 'quotation_pending', 'pending_quote'].includes(item?.status)
        ).length;

        setTotal(rows.length);
        setPending(quotePendingCount);
      } catch (err) {
        console.error('Error cargando panel de cotizaciones:', err);
      }
    };

    load();
  }, []);

  return (
    <BasePanel
      title="Cotizaciones"
      total={pending}
      subtitle="Cotizaciones pendientes"
      detail1={`Total registros revisados: ${total}`}
      icon={<FileText className="w-7 h-7" />}
      actionLabel="Ver cotizaciones"
      onClick={() => onNavigate?.('quotes')}
    />
  );
}

export function TechniciansPanel({ onNavigate }: PanelProps) {
  const [activeTechs, setActiveTechs] = useState(0);
  const [availableTechs, setAvailableTechs] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, role, is_active')
          .eq('role', 'technician');

        if (error) throw error;

        const rows = data || [];
        const active = rows.filter((item: any) => item?.is_active === true).length;

        setActiveTechs(rows.length);
        setAvailableTechs(active);
      } catch (err) {
        console.error('Error cargando panel de técnicos:', err);
      }
    };

    load();
  }, []);

  return (
    <BasePanel
      title="Técnicos"
      total={activeTechs}
      subtitle="Técnicos registrados"
      detail1={`Técnicos activos: ${availableTechs}`}
      icon={<Users className="w-7 h-7" />}
      actionLabel="Ver técnicos"
      onClick={() => onNavigate?.('technicians')}
    />
  );
}

export default {
  EmergenciesPanel,
  MaintenancesPanel,
  ServiceRequestsPanel,
  QuotesPanel,
  TechniciansPanel,
};