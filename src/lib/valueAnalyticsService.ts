import { supabase } from './supabase';

export interface KPISummary {
  revenue90: number;
  profit90: number;
  inProgressRevenue: number;
  avoidableCost90: number;
  recurrenceRate: number;
  topAvoidableCost: number;
  conversionRate: number;
}

export interface RecurrentElevator {
  elevatorId: string;
  elevatorName: string;
  clientId?: string;
  countEmergency90: number;
  costEmergency90: number;
  revenueEmergency90: number;
  suggestion: string;
}

export interface ClientAttention {
  clientId: string;
  clientName?: string;
  elevatorsAffected: number;
  repeatEmergencies: number;
  avoidableCost90: number;
  callToAction: string;
}

// Helper to coalesce names
function formatElevatorName(e: any) {
  return e?.location_name || e?.building_name || e?.internal_code || 'Ascensor';
}

export async function getKPISummary(): Promise<KPISummary> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: completed, error: errCompleted } = await supabase
    .from('work_orders')
    .select('revenue, total_cost, closed_at')
    .eq('status', 'completed')
    .gte('closed_at', ninetyDaysAgo);
  if (errCompleted) throw new Error(`Completed orders query failed: ${errCompleted.message}`);

  const { data: inProgress, error: errProgress } = await supabase
    .from('work_orders')
    .select('revenue, status')
    .in('status', ['assigned', 'in_progress']);
  if (errProgress) throw new Error(`In-progress orders query failed: ${errProgress.message}`);

  // Emergency subset for avoidable cost: repeated emergencies in 90 days
  const { data: emergencyOrders, error: errEmergency } = await supabase
    .from('work_orders')
    .select('elevator_id, work_type, total_cost, revenue, closed_at')
    .eq('work_type', 'emergency')
    .gte('closed_at', ninetyDaysAgo);
  if (errEmergency) throw new Error(`Emergency orders query failed: ${errEmergency.message}`);

  const revenue90 = (completed || []).reduce((sum, o) => sum + (o.revenue || 0), 0);
  const profit90 = (completed || []).reduce((sum, o) => sum + ((o.revenue || 0) - (o.total_cost || 0)), 0);
  const inProgressRevenue = (inProgress || []).reduce((sum, o) => sum + (o.revenue || 0), 0);

  // Group emergency by elevator to detect repeats
  const emergencyByElevator = new Map<string, { count: number; cost: number }>();
  (emergencyOrders || []).forEach((o) => {
    const id = o.elevator_id || 'unknown';
    const current = emergencyByElevator.get(id) || { count: 0, cost: 0 };
    current.count += 1;
    current.cost += (o.total_cost || 0);
    emergencyByElevator.set(id, current);
  });

  let avoidableCost90 = 0;
  let recurrentElevatorsCount = 0;
  let maxAvoidableCost = 0;
  emergencyByElevator.forEach((v) => {
    if (v.count >= 2) {
      // Simple model: cost of repeats beyond 1 are avoidable
      avoidableCost90 += v.cost;
      recurrentElevatorsCount += 1;
      if (v.cost > maxAvoidableCost) maxAvoidableCost = v.cost;
    }
  });

  // Get total elevators count for recurrence rate
  const { count: totalElevators } = await supabase
    .from('elevators')
    .select('*', { count: 'exact', head: true });

  const recurrenceRate = totalElevators ? (recurrentElevatorsCount * 100) / totalElevators : 0;

  // Conversion rate: completed vs total orders in 90d
  const { count: totalOrders90 } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', ninetyDaysAgo);

  const conversionRate = totalOrders90 ? ((completed?.length || 0) * 100) / totalOrders90 : 0;

  return {
    revenue90,
    profit90,
    inProgressRevenue,
    avoidableCost90,
    recurrenceRate,
    topAvoidableCost: maxAvoidableCost,
    conversionRate,
  };
}

export async function getRecurrentElevators(): Promise<RecurrentElevator[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: emergencyOrders, error: errEmergency }, { data: elevators, error: errElevators }] = await Promise.all([
    supabase
      .from('work_orders')
      .select('elevator_id, work_type, total_cost, revenue, closed_at')
      .eq('work_type', 'emergency')
      .gte('closed_at', ninetyDaysAgo),
    supabase
      .from('elevators')
      .select('id, client_id, location_name, internal_code'),
  ]);

  if (errEmergency) throw new Error(`Emergency orders query failed: ${errEmergency.message}`);
  if (errElevators) throw new Error(`Elevators query failed: ${errElevators.message}`);

  const byElevator = new Map<string, { count: number; cost: number; revenue: number }>();
  (emergencyOrders || []).forEach((o) => {
    const id = o.elevator_id || 'unknown';
    const current = byElevator.get(id) || { count: 0, cost: 0, revenue: 0 };
    current.count += 1;
    current.cost += (o.total_cost || 0);
    current.revenue += (o.revenue || 0);
    byElevator.set(id, current);
  });

  const elevMap = new Map<string, any>();
  (elevators || []).forEach((e) => elevMap.set(e.id, e));

  const result: RecurrentElevator[] = Array.from(byElevator.entries())
    .filter(([_, v]) => v.count >= 2)
    .map(([id, v]) => {
      const e = elevMap.get(id);
      const name = formatElevatorName(e);
      const suggestion = v.count >= 3 ? 'Proponer intervención mayor (repuesto crítico / revisión completa)' : 'Proponer reparación puntual y ajuste preventivo';
      return {
        elevatorId: id,
        elevatorName: name,
        clientId: e?.client_id,
        countEmergency90: v.count,
        costEmergency90: v.cost,
        revenueEmergency90: v.revenue,
        suggestion,
      };
    })
    .sort((a, b) => b.costEmergency90 - a.costEmergency90)
    .slice(0, 20);

  return result;
}

export async function getClientsAttention(): Promise<ClientAttention[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: emergencyOrders, error: errEmergency }, { data: elevators, error: errElevators }, { data: clients, error: errClients }] = await Promise.all([
    supabase
      .from('work_orders')
      .select('elevator_id, work_type, total_cost, closed_at')
      .eq('work_type', 'emergency')
      .gte('closed_at', ninetyDaysAgo),
    supabase
      .from('elevators')
      .select('id, client_id, location_name'),
    supabase
      .from('clients')
      .select('id, company_name'),
  ]);

  if (errEmergency) throw new Error(`Emergency orders query failed: ${errEmergency.message}`);
  if (errElevators) throw new Error(`Elevators query failed: ${errElevators.message}`);
  if (errClients) throw new Error(`Clients query failed: ${errClients.message}`);

  const elevMap = new Map<string, { client_id?: string }>();
  (elevators || []).forEach((e) => elevMap.set(e.id, { client_id: e.client_id }));

  const clientAgg = new Map<string, { elevators: Set<string>; repeats: number; cost: number }>();
  (emergencyOrders || []).forEach((o) => {
    const elev = elevMap.get(o.elevator_id || 'unknown');
    const clientId = elev?.client_id || 'unknown';
    const agg = clientAgg.get(clientId) || { elevators: new Set<string>(), repeats: 0, cost: 0 };
    agg.repeats += 1;
    agg.cost += (o.total_cost || 0);
    if (o.elevator_id) agg.elevators.add(o.elevator_id);
    clientAgg.set(clientId, agg);
  });

  const clientNames = new Map<string, string>();
  (clients || []).forEach((c) => clientNames.set(c.id, c.company_name));

  const result: ClientAttention[] = Array.from(clientAgg.entries())
    .filter(([_, v]) => v.repeats >= 3)
    .map(([id, v]) => ({
      clientId: id,
      clientName: clientNames.get(id),
      elevatorsAffected: v.elevators.size,
      repeatEmergencies: v.repeats,
      avoidableCost90: v.cost,
      callToAction: 'Agendar reunión y presentar propuesta de mejora para reducir emergencias repetidas',
    }))
    .sort((a, b) => b.avoidableCost90 - a.avoidableCost90)
    .slice(0, 20);

  return result;
}
