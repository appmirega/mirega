import { supabase } from './supabase';

export interface ElevatorRisk {
  elevatorId: string;
  elevatorName: string;
  buildingId?: string;
  clientId?: string;
  failures: number;
  probability: number; // 0-1
  avgCost: number;
  downtimeHours: number;
  impact: number; // monetary impact
  riskScore: number;
  band: 'low' | 'medium' | 'high';
}

export interface BacklogItem {
  workOrderId: string;
  elevatorId?: string;
  description: string;
  status: string;
  ageDays: number;
  value: number;
}

const FAILURE_STATUSES = [
  'pending',
  'analyzing',
  'quotation_sent',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'on_hold'
];

// ...existing code...

export async function getRiskData(): Promise<ElevatorRisk[]> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: elevators, error: elevError } = await supabase
    .from('elevators')
    .select('id, location_name, internal_code, client_id');

  if (elevError) throw new Error(`Elevators query failed: ${elevError.message}`);

  const { data: requests, error: reqError } = await supabase
    .from('service_requests')
    .select('elevator_id, status, created_at')
    .gte('created_at', oneYearAgo.toISOString());

  if (reqError) throw new Error(`Service requests query failed: ${reqError.message}`);

  const { data: workOrders, error: woError } = await supabase
    .from('work_orders')
    .select('elevator_id, labor_cost, parts_cost, created_at')
    .gte('created_at', oneYearAgo.toISOString());

  if (woError) throw new Error(`Work orders query failed: ${woError.message}`);

  const riskMap = new Map<string, ElevatorRisk>();

  (elevators || []).forEach((e) => {
    const name = e.location_name || e.internal_code || 'Ascensor';
    riskMap.set(e.id, {
      elevatorId: e.id,
      elevatorName: name,
      buildingId: e.building_id,
      clientId: e.client_id,
      failures: 0,
      probability: 0,
      avgCost: 0,
      downtimeHours: 0,
      impact: 0,
      riskScore: 0,
      band: 'low'
    });
  });

  // Contar fallas
  (requests || []).forEach((r) => {
    if (!r.elevator_id) return;
    if (!FAILURE_STATUSES.includes(r.status)) return;
    const current = riskMap.get(r.elevator_id);
    if (!current) return;
    current.failures += 1;
  });

  // Costos por ascensor
  const costAccumulator = new Map<string, { total: number; count: number }>();
  (workOrders || []).forEach((wo) => {
    if (!wo.elevator_id) return;
    const total = (wo.labor_cost || 0) + (wo.parts_cost || 0);
    const acc = costAccumulator.get(wo.elevator_id) || { total: 0, count: 0 };
    acc.total += total;
    acc.count += 1;
    costAccumulator.set(wo.elevator_id, acc);
  });

  // Construir riesgo
  riskMap.forEach((value, id) => {
    const failures = value.failures;
    const probability = Math.min(failures / 6, 1); // 6+ fallas/año = riesgo alto
    const costInfo = costAccumulator.get(id);
    const avgCost = costInfo && costInfo.count > 0 ? costInfo.total / costInfo.count : 250000; // CLP default
    const downtimeHours = failures * 3; // estimar 3h por falla
    const downtimeCost = downtimeHours * 50000;
    const impact = avgCost + downtimeCost;
    const riskScore = probability * impact;
    let band: 'low' | 'medium' | 'high' = 'low';
    if (riskScore > 600000) band = 'high';
    else if (riskScore > 250000) band = 'medium';

    riskMap.set(id, {
      ...value,
      probability,
      avgCost,
      downtimeHours,
      impact,
      riskScore,
      band
    });
  });

  return Array.from(riskMap.values()).sort((a, b) => b.riskScore - a.riskScore);
}

export async function getBacklog(): Promise<BacklogItem[]> {
  const { data: workOrders, error } = await supabase
    .from('work_orders')
    .select('id, elevator_id, description, status, created_at, revenue, total_cost')
    .neq('status', 'completed');

  if (error) throw new Error(`Backlog work orders query failed: ${error.message}`);

  const now = Date.now();
  return (workOrders || [])
    .map((wo) => {
      const ageDays = Math.max(
        0,
        Math.floor((now - new Date(wo.created_at).getTime()) / (1000 * 60 * 60 * 24))
      );
      const value = (wo.revenue || wo.total_cost || 0);
      return {
        workOrderId: wo.id,
        elevatorId: wo.elevator_id,
        description: wo.description || 'Orden de trabajo',
        status: wo.status,
        ageDays,
        value
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays);
}
