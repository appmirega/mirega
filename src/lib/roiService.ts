import { supabase } from './supabase';

export interface HistoricalCosts {
  totalRepairCosts: number;
  repairCount: number;
  avgCostPerRepair: number;
  inactivityHours: number;
  costPerHourInactivity: number;
  lastMaintenanceDate: string;
  daysSinceLastMaintenance: number;
}

export interface ROIScenario {
  current: {
    annualRepairCost: number;
    annualInactivityCost: number;
    totalAnnualCost: number;
  };
  improved: {
    investmentCost: number;
    annualMaintenanceCost: number;
    annualRepairCost: number;
    annualInactivityCost: number;
    totalAnnualCost: number;
  };
  metrics: {
    annualSavings: number;
    paybackPeriod: number;
    roi: number;
    recommendation: 'procced' | 'review' | 'not_recommended';
  };
}

export async function getElevatorHistoricalCosts(
  elevatorId: string
): Promise<HistoricalCosts> {
  try {
    // Obtener work orders de los últimos 3 años
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const { data: workOrders, error: woError } = await supabase
      .from('work_orders')
      .select('actual_labor_cost, actual_parts_cost, completion_date, created_at')
      .eq('elevator_id', elevatorId)
      .gte('created_at', threeYearsAgo.toISOString())
      .in('status', ['completed', 'closed']);

    if (woError) throw woError;

    // Obtener service requests con rechazos (indicador de fallas)
    const { data: serviceRequests, error: srError } = await supabase
      .from('service_requests')
      .select('status, created_at')
      .eq('elevator_id', elevatorId)
      .gte('created_at', threeYearsAgo.toISOString());

    if (srError) throw srError;

    // Calcular costos históricos
    const totalRepairCosts = (workOrders || []).reduce((sum, wo) => {
      const labor = wo.actual_labor_cost || 0;
      const parts = wo.actual_parts_cost || 0;
      return sum + labor + parts;
    }, 0);

    const repairCount = workOrders?.length || 0;
    const avgCostPerRepair = repairCount > 0 ? totalRepairCosts / repairCount : 0;

    // Estimar horas de inactividad (asumiendo 2-4 horas por reparación)
    const inactivityHours = repairCount * 3;
    const costPerHourInactivity = 50000; // Costo de inactividad por hora (edificio pierde rentabilidad)

    // Obtener último mantenimiento
    const { data: lastMaintenance } = await supabase
      .from('mnt_checklists')
      .select('completion_date')
      .eq('elevator_id', elevatorId)
      .order('completion_date', { ascending: false })
      .limit(1)
      .single();

    const lastMaintenanceDate = lastMaintenance?.completion_date || new Date().toISOString();
    const daysSinceLastMaintenance = Math.floor(
      (new Date().getTime() - new Date(lastMaintenanceDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      totalRepairCosts,
      repairCount,
      avgCostPerRepair,
      inactivityHours,
      costPerHourInactivity,
      lastMaintenanceDate,
      daysSinceLastMaintenance,
    };
  } catch (error) {
    console.error('Error getting elevator historical costs:', error);
    throw error;
  }
}

export async function getClientHistoricalCosts(
  clientId: string
): Promise<HistoricalCosts> {
  try {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    // Obtener elevadores del cliente
    const { data: elevators, error: eleError } = await supabase
      .from('elevators')
      .select('id')
      .eq('client_id', clientId);

    if (eleError) throw eleError;

    const elevatorIds = elevators?.map((e) => e.id) || [];

    // Obtener work orders
    const { data: workOrders, error: woError } = await supabase
      .from('work_orders')
      .select('actual_labor_cost, actual_parts_cost')
      .in('elevator_id', elevatorIds)
      .gte('created_at', threeYearsAgo.toISOString())
      .in('status', ['completed', 'closed']);

    if (woError) throw woError;

    const totalRepairCosts = (workOrders || []).reduce((sum, wo) => {
      const labor = wo.actual_labor_cost || 0;
      const parts = wo.actual_parts_cost || 0;
      return sum + labor + parts;
    }, 0);

    const repairCount = workOrders?.length || 0;
    const avgCostPerRepair = repairCount > 0 ? totalRepairCosts / repairCount : 0;
    const inactivityHours = repairCount * 3;
    const costPerHourInactivity = 50000;

    return {
      totalRepairCosts,
      repairCount,
      avgCostPerRepair,
      inactivityHours,
      costPerHourInactivity,
      lastMaintenanceDate: new Date().toISOString(),
      daysSinceLastMaintenance: 0,
    };
  } catch (error) {
    console.error('Error getting client historical costs:', error);
    throw error;
  }
}

export function calculateROI(
  historicalCosts: HistoricalCosts,
  investmentCost: number,
  annualMaintenanceCost: number,
  expectedRepairReduction: number = 0.8, // 80% reduction in repairs
  expectedInactivityReduction: number = 0.95 // 95% reduction in inactivity
): ROIScenario {
  // Promediar costos anuales de los últimos 3 años
  const annualRepairCostCurrent = (historicalCosts.totalRepairCosts / 3) * 1.1; // +10% margen conservador
  const annualInactivityCostCurrent =
    (historicalCosts.inactivityHours / 3) * historicalCosts.costPerHourInactivity;
  const totalAnnualCostCurrent = annualRepairCostCurrent + annualInactivityCostCurrent;

  // Escenario mejorado
  const annualRepairCostImproved = annualRepairCostCurrent * (1 - expectedRepairReduction);
  const annualInactivityCostImproved =
    annualInactivityCostCurrent * (1 - expectedInactivityReduction);
  const totalAnnualCostImproved =
    annualMaintenanceCost + annualRepairCostImproved + annualInactivityCostImproved;

  // Cálculos de ROI
  const annualSavings = totalAnnualCostCurrent - totalAnnualCostImproved;
  const paybackPeriod =
    annualSavings > 0 ? Math.ceil(investmentCost / annualSavings) : Infinity;
  const roi =
    paybackPeriod !== Infinity ? ((annualSavings * paybackPeriod - investmentCost) / investmentCost) * 100 : 0;

  // Recomendación
  let recommendation: 'procced' | 'review' | 'not_recommended' = 'not_recommended';
  if (paybackPeriod <= 3 && annualSavings > investmentCost * 0.2) {
    recommendation = 'procced';
  } else if (paybackPeriod <= 5 && annualSavings > 0) {
    recommendation = 'review';
  }

  return {
    current: {
      annualRepairCost: annualRepairCostCurrent,
      annualInactivityCost: annualInactivityCostCurrent,
      totalAnnualCost: totalAnnualCostCurrent,
    },
    improved: {
      investmentCost,
      annualMaintenanceCost,
      annualRepairCost: annualRepairCostImproved,
      annualInactivityCost: annualInactivityCostImproved,
      totalAnnualCost: totalAnnualCostImproved,
    },
    metrics: {
      annualSavings,
      paybackPeriod,
      roi,
      recommendation,
    },
  };
}

export async function getBuildingHistoricalData(buildingId: string) {
  try {
    const { data: building, error: bError } = await supabase
      .from('buildings')
      .select('client_id, building_name')
      .eq('id', buildingId)
      .single();

    if (bError) throw bError;

    const historicalCosts = await getClientHistoricalCosts(building.client_id);

    return {
      buildingName: building.building_name,
      historicalCosts,
    };
  } catch (error) {
    console.error('Error getting building historical data:', error);
    throw error;
  }
}
