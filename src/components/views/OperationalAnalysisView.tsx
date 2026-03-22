import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, Clock3, ShieldAlert, Wrench } from 'lucide-react';

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

type RankedRow = {
  name: string;
  value: number;
  extra?: string;
};

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

function isOpenEmergency(status?: string | null) {
  return !['resolved', 'closed', 'completed'].includes((status || '').toLowerCase());
}

export function OperationalAnalysisView() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [elevators, setElevators] = useState<ElevatorLite[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyLite[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestLite[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsRes, elevatorsRes, emergenciesRes, requestsRes] = await Promise.all([
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
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (elevatorsRes.error) throw elevatorsRes.error;
      if (emergenciesRes.error) throw emergenciesRes.error;
      if (requestsRes.error) throw requestsRes.error;

      setClients((clientsRes.data as ClientLite[]) || []);
      setElevators((elevatorsRes.data as ElevatorLite[]) || []);
      setEmergencies((emergenciesRes.data as EmergencyLite[]) || []);
      setServiceRequests((requestsRes.data as ServiceRequestLite[]) || []);
    } catch (error) {
      console.error('Error loading operational analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const clientMap = useMemo(() => new Map(clients.map((item) => [item.id, item])), [clients]);
  const elevatorMap = useMemo(() => new Map(elevators.map((item) => [item.id, item])), [elevators]);

  const openEmergencies = emergencies.filter((item) => isOpenEmergency(item.status));
  const criticalEmergencies = emergencies.filter((item) => (item.priority || '').toLowerCase() === 'critical');
  const highPriorityRequests = serviceRequests.filter((item) =>
    ['high', 'critical'].includes((item.priority || '').toLowerCase())
  );

  const avgClosureHours = useMemo(() => {
    const resolved = emergencies.filter((item) => item.reported_at && item.resolved_at);
    if (resolved.length === 0) return 0;

    const total = resolved.reduce((sum, item) => {
      const start = new Date(item.reported_at as string).getTime();
      const end = new Date(item.resolved_at as string).getTime();
      return sum + Math.max(0, end - start) / (1000 * 60 * 60);
    }, 0);

    return Math.round(total / resolved.length);
  }, [emergencies]);

  const topElevatorsByEmergencies: RankedRow[] = useMemo(() => {
    const map = new Map<string, { value: number; open: number }>();

    emergencies.forEach((item) => {
      const name = getElevatorName(item.elevator_id ? elevatorMap.get(item.elevator_id) : undefined);
      const current = map.get(name) || { value: 0, open: 0 };
      current.value += 1;
      if (isOpenEmergency(item.status)) current.open += 1;
      map.set(name, current);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: value.value, extra: `${value.open} abiertas` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [elevatorMap, emergencies]);

  const topBuildingsByEmergencies: RankedRow[] = useMemo(() => {
    const map = new Map<string, { value: number; critical: number }>();

    emergencies.forEach((item) => {
      const name = getClientName(item.client_id ? clientMap.get(item.client_id) : undefined);
      const current = map.get(name) || { value: 0, critical: 0 };
      current.value += 1;
      if ((item.priority || '').toLowerCase() === 'critical') current.critical += 1;
      map.set(name, current);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: value.value, extra: `${value.critical} críticas` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [clientMap, emergencies]);

  const repeatedOperationalRequests: RankedRow[] = useMemo(() => {
    const map = new Map<string, number>();

    serviceRequests.forEach((item) => {
      const name = getElevatorName(item.elevator_id ? elevatorMap.get(item.elevator_id) : undefined);
      map.set(name, (map.get(name) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [elevatorMap, serviceRequests]);

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
        <h1 className="text-3xl font-bold text-slate-900">Análisis Operativo</h1>
        <p className="text-slate-600 mt-1">
          Equipos más conflictivos, edificios con mayor carga y comportamiento de emergencias.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Emergencias abiertas" value={openEmergencies.length} detail={`${emergencies.length} registradas`} icon={AlertTriangle} />
        <MetricCard title="Emergencias críticas" value={criticalEmergencies.length} detail="Prioridad crítica" icon={ShieldAlert} />
        <MetricCard title="Solicitudes alta prioridad" value={highPriorityRequests.length} detail={`${serviceRequests.length} solicitudes totales`} icon={Wrench} />
        <MetricCard title="Cierre promedio" value={`${avgClosureHours} h`} detail="Según reported_at y resolved_at" icon={Clock3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RankingCard title="Ascensores con más emergencias" rows={topElevatorsByEmergencies} emptyLabel="Sin emergencias" valueLabel="casos" />
        <RankingCard title="Edificios con más emergencias" rows={topBuildingsByEmergencies} emptyLabel="Sin emergencias" valueLabel="casos" />
        <RankingCard title="Equipos con más solicitudes" rows={repeatedOperationalRequests} emptyLabel="Sin solicitudes" valueLabel="solicitudes" />
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
  rows: RankedRow[];
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