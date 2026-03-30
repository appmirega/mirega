import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  AlertTriangle,
  Wrench,
  ClipboardList,
} from 'lucide-react';

interface PanelProps {
  onNavigate?: (view: string) => void;
}

interface BasePanelProps {
  title: string;
  total: number;
  subtitle: string;
  detail1: string;
  detail2: string;
  icon: React.ReactNode;
  actionLabel: string;
  onClick?: () => void;
  color?: string;
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
  color = 'blue',
}: BasePanelProps) {
  const colorMap: any = {
    red: 'bg-red-50 border-red-200 text-red-600',
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
  };

  return (
    <div className={`p-5 rounded-xl border ${colorMap[color]}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 font-semibold text-lg">
          {icon}
          {title}
        </div>
        <div className="text-3xl font-bold">{total}</div>
      </div>

      <div className="text-sm opacity-70 mb-2">{subtitle}</div>

      <div className="text-sm space-y-1 mb-4">
        <div>{detail1}</div>
        <div>{detail2}</div>
      </div>

      <button
        onClick={onClick}
        className="w-full bg-gray-100 hover:bg-gray-200 text-sm py-2 rounded-lg transition"
      >
        {actionLabel}
      </button>
    </div>
  );
}

//////////////////////////////////////////////////////////
// 🚨 EMERGENCIAS
//////////////////////////////////////////////////////////

export function EmergenciesPanel({ onNavigate }: PanelProps) {
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [critical, setCritical] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('emergencies').select('*');

      const rows = data || [];

      const activeStatuses = ['open', 'pending', 'active'];
      const criticalStatuses = ['detenido', 'critical', 'stopped'];

      setTotal(rows.length);

      setActive(
        rows.filter((e: any) =>
          activeStatuses.includes(String(e.status || '').toLowerCase())
        ).length
      );

      setCritical(
        rows.filter((e: any) =>
          criticalStatuses.includes(
            String(e.result || e.status || '').toLowerCase()
          )
        ).length
      );
    };

    load();
  }, []);

  return (
    <BasePanel
      title="Emergencias"
      total={total}
      subtitle="Registro total de emergencias"
      detail1={`Activas: ${active}`}
      detail2={`Ascensor detenido: ${critical}`}
      icon={<AlertTriangle className="w-6 h-6" />}
      actionLabel="Ver emergencias"
      onClick={() => onNavigate?.('emergencies')}
      color="red"
    />
  );
}

//////////////////////////////////////////////////////////
// 🔧 MANTENIMIENTOS
//////////////////////////////////////////////////////////

export function MaintenancesPanel({ onNavigate }: PanelProps) {
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: elevators } = await supabase
        .from('elevators')
        .select('id');

      const { data: maintenances } = await supabase
        .from('mnt_checklists')
        .select('*');

      const elevatorsCount = elevators?.length || 0;

      const completedCount =
        maintenances?.filter((m: any) => m.status === 'completed').length || 0;

      setTotal(elevatorsCount);
      setCompleted(completedCount);
      setPending(elevatorsCount - completedCount);
    };

    load();
  }, []);

  return (
    <BasePanel
      title="Mantenimientos del Mes"
      total={total}
      subtitle="Total de ascensores activos"
      detail1={`Mantenimientos listos: ${completed}`}
      detail2={`Mantenimientos faltantes: ${pending}`}
      icon={<Wrench className="w-6 h-6" />}
      actionLabel="Ver mantenimientos"
      onClick={() => onNavigate?.('maintenance')}
      color="blue"
    />
  );
}

//////////////////////////////////////////////////////////
// 📄 SOLICITUDES DE SERVICIO (FIX REAL)
//////////////////////////////////////////////////////////

export function ServiceRequestsPanel({ onNavigate }: PanelProps) {
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);
  const [clientCreated, setClientCreated] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('service_requests')
          .select('*');

        if (error) {
          console.error('Error service_requests:', error);
          return;
        }

        const rows = data || [];

        const pendingStatuses = [
          'new',
          'nueva',
          'created',
          'pending',
          'open',
          'assigned',
          'in_review',
          'in_progress',
          'quote_pending',
          'quotation_pending',
        ];

        const pendingCount = rows.filter((item: any) =>
          pendingStatuses.includes(
            String(item?.status || '').toLowerCase()
          )
        ).length;

        const clientCount = rows.filter((item: any) => {
          return (
            item?.created_by_client === true ||
            item?.request_origin === 'client' ||
            item?.source === 'client' ||
            item?.created_by_type === 'client'
          );
        }).length;

        setTotal(rows.length);
        setPending(pendingCount);
        setClientCreated(clientCount);
      } catch (err) {
        console.error('Error panel solicitudes:', err);
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
      icon={<ClipboardList className="w-6 h-6" />}
      actionLabel="Ver solicitudes"
      onClick={() => onNavigate?.('service_requests')}
      color="green"
    />
  );
}