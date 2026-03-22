import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  FileText,
  Gauge,
  Wrench,
  Activity,
  CheckCircle2,
} from 'lucide-react';

type ClientLite = {
  id: string;
  company_name?: string | null;
  building_name?: string | null;
  internal_alias?: string | null;
};

type ElevatorLite = {
  id: string;
  client_id?: string | null;
  elevator_number?: number | null;
  tower_name?: string | null;
  location_building?: string | null;
  internal_code?: string | null;
};

type EmergencyLite = {
  id: string;
  client_id?: string | null;
  elevator_id?: string | null;
  status?: string | null;
  priority?: string | null;
  reported_at?: string | null;
  resolved_at?: string | null;
  created_at?: string | null;
};

type ServiceRequestLite = {
  id: string;
  client_id?: string | null;
  elevator_id?: string | null;
  request_type?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
};

type QuotationLite = {
  id: string;
  client_id?: string | null;
  status?: string | null;
  total_amount?: number | null;
  created_at?: string | null;
};

type WorkOrderLite = {
  id: string;
  client_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type TopRow = {
  name: string;
  value: number;
  extra?: string;
};

const currency = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function getClientName(client?: ClientLite | null) {
  if (!client) return 'Sin cliente';
  return client.internal_alias || client.building_name || client.company_name || 'Sin cliente';
}

function getElevatorName(elevator?: ElevatorLite | null) {
  if (!elevator) return 'Ascensor sin identificar';

  const main =
    elevator.elevator_number !== null && elevator.elevator_number !== undefined
      ? `Ascensor ${elevator.elevator_number}`
      : elevator.internal_code || 'Ascensor';

  const detail = elevator.tower_name || elevator.location_building;
  return detail ? `${main} · ${detail}` : main;
}

function isClosedEmergency(status?: string | null) {
  return ['resolved', 'closed', 'completed'].includes((status || '').toLowerCase());
}

function isApprovedQuotation(status?: string | null) {
  return ['approved', 'accepted', 'completed'].includes((status || '').toLowerCase());
}

function isRejectedQuotation(status?: string | null) {
  return (status || '').toLowerCase() === 'rejected';
}

function isCompletedRequest(status?: string | null) {
  return ['approved', 'completed', 'in_progress'].includes((status || '').toLowerCase());
}

export function ExecutiveSummaryView() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [elevators, setElevators] = useState<ElevatorLite[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyLite[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestLite[]>([]);
  const [quotations, setQuotations] = useState<QuotationLite[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderLite[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        clientsRes,
        elevatorsRes,
        emergenciesRes,
        serviceRequestsRes,
        quotationsRes,
        workOrdersRes,
      ] = await Promise.all([
        supabase.from('clients').select('id, company_name, building_name, internal_alias'),
        supabase
          .from('elevators')
          .select('id, client_id, elevator_number, tower_name, location_building, internal_code'),
        supabase
          .from('emergency_visits')
          .select('id, client_id, elevator_id, status, priority, reported_at, resolved_at, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('service_requests')
          .select('id, client_id, elevator_id, request_type, status, priority, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('quotations')
          .select('id, client_id, status, total_amount, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('work_orders')
          .select('id, client_id, status, created_at')
          .order('created_at', { ascending: false }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (elevatorsRes.error) throw elevatorsRes.error;
      if (emergenciesRes.error) throw emergenciesRes.error;
      if (serviceRequestsRes.error) throw serviceRequestsRes.error;
      if (quotationsRes.error) throw quotationsRes.error;
      if (workOrdersRes.error) throw workOrdersRes.error;

      setClients((clientsRes.data as ClientLite[]) || []);
      setElevators((elevatorsRes.data as ElevatorLite[]) || []);
      setEmergencies((emergenciesRes.data as EmergencyLite[]) || []);
      setServiceRequests((serviceRequestsRes.data as ServiceRequestLite[]) || []);
      setQuotations((quotationsRes.data as QuotationLite[]) || []);
      setWorkOrders((workOrdersRes.data as WorkOrderLite[]) || []);
    } catch (error) {
      console.error('Error loading executive summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const clientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients]
  );

  const elevatorMap = useMemo(
    () => new Map(elevators.map((elevator) => [elevator.id, elevator])),
    [elevators]
  );

  const openEmergencies = emergencies.filter((item) => !isClosedEmergency(item.status)).length;
  const approvedQuotations = quotations.filter((item) => isApprovedQuotation(item.status)).length;
  const rejectedQuotations = quotations.filter((item) => isRejectedQuotation(item.status)).length;
  const convertedRequests = serviceRequests.filter((item) => isCompletedRequest(item.status)).length;
  const activeWorkOrders = workOrders.filter((item) =>
    ['assigned', 'in_progress', 'approved'].includes((item.status || '').toLowerCase())
  ).length;
  const totalQuotedAmount = quotations.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  const quotationApprovalRate = quotations.length > 0 ? Math.round((approvedQuotations / quotations.length) * 100) : 0;

  const topBuildingsByEmergencies: TopRow[] = useMemo(() => {
    const counts = new Map<string, number>();

    emergencies.forEach((item) => {
      const client = item.client_id ? clientMap.get(item.client_id) : undefined;
      const name = getClientName(client);
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [clientMap, emergencies]);

  const topElevatorsByEmergencies: TopRow[] = useMemo(() => {
    const counts = new Map<string, number>();

    emergencies.forEach((item) => {
      const elevator = item.elevator_id ? elevatorMap.get(item.elevator_id) : undefined;
      const name = getElevatorName(elevator);
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [elevatorMap, emergencies]);

  const topBuildingsByCommercialVolume: TopRow[] = useMemo(() => {
    const counts = new Map<string, { requests: number; quotations: number }>();

    serviceRequests.forEach((item) => {
      const name = getClientName(item.client_id ? clientMap.get(item.client_id) : undefined);
      const current = counts.get(name) || { requests: 0, quotations: 0 };
      current.requests += 1;
      counts.set(name, current);
    });

    quotations.forEach((item) => {
      const name = getClientName(item.client_id ? clientMap.get(item.client_id) : undefined);
      const current = counts.get(name) || { requests: 0, quotations: 0 };
      current.quotations += 1;
      counts.set(name, current);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({
        name,
        value: value.requests + value.quotations,
        extra: `${value.requests} solicitudes · ${value.quotations} cotizaciones`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [clientMap, quotations, serviceRequests]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Resumen Ejecutivo</h1>
        <p className="text-slate-600 mt-1">
          Vista general de operación, actividad comercial y carga activa del negocio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Clientes" value={clients.length} icon={Building2} detail={`${elevators.length} ascensores registrados`} />
        <MetricCard title="Emergencias activas" value={openEmergencies} icon={AlertTriangle} detail={`${emergencies.length} emergencias históricas`} />
        <MetricCard title="Solicitudes convertidas" value={convertedRequests} icon={ClipboardList} detail={`${serviceRequests.length} solicitudes totales`} />
        <MetricCard title="OT activas" value={activeWorkOrders} icon={Wrench} detail={`${workOrders.length} órdenes totales`} />
        <MetricCard title="Cotizaciones emitidas" value={quotations.length} icon={FileText} detail={`${approvedQuotations} con cierre favorable`} />
        <MetricCard title="Tasa aprobación" value={`${quotationApprovalRate}%`} icon={CheckCircle2} detail={`${rejectedQuotations} rechazadas`} />
        <MetricCard title="Monto cotizado" value={currency.format(totalQuotedAmount)} icon={Gauge} detail="Suma de total_amount disponible" />
        <MetricCard title="Actividad total" value={emergencies.length + serviceRequests.length + workOrders.length} icon={Activity} detail="Emergencias + solicitudes + OT" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RankingCard
          title="Edificios con más emergencias"
          rows={topBuildingsByEmergencies}
          emptyLabel="Sin emergencias registradas"
          valueLabel="casos"
        />
        <RankingCard
          title="Ascensores con más emergencias"
          rows={topElevatorsByEmergencies}
          emptyLabel="Sin emergencias registradas"
          valueLabel="casos"
        />
        <RankingCard
          title="Clientes con más actividad"
          rows={topBuildingsByCommercialVolume}
          emptyLabel="Sin actividad registrada"
          valueLabel="movimientos"
        />
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
          <p className="text-xs text-slate-500 mt-2">{detail}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-100 text-slate-700">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function RankingCard({
  title,
  rows,
  emptyLabel,
  valueLabel,
}: {
  title: string;
  rows: TopRow[];
  emptyLabel: string;
  valueLabel: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={`${row.name}-${index}`}
              className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{row.name}</p>
                {row.extra && <p className="text-xs text-slate-500 mt-1">{row.extra}</p>}
              </div>
              <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                {row.value} {valueLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}