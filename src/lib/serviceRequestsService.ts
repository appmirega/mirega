import { supabase } from '@/lib/supabase';

type ServiceRequestType = 'repair' | 'parts' | 'diagnostic';
type InterventionType = 'preventive' | 'corrective' | 'improvement';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface CreateServiceRequestInput {
  client_id: string;
  elevator_id: string;
  request_type: ServiceRequestType;
  intervention_type?: InterventionType | null;
  priority: Priority | string;
  description: string;
  title?: string;
  source_type?: 'manual' | 'maintenance_checklist' | 'emergency_visit' | string;
  source_id?: string | null;
  created_by_technician_id?: string | null;
  photo_1_url?: string | null;
  photo_2_url?: string | null;
}

interface MaintenanceRejectedQuestion {
  question_number: number;
  text: string;
  observations: string;
  is_critical?: boolean;
  observation_photo_1?: string | null;
  observation_photo_2?: string | null;
}

interface EmergencyPart {
  part_name: string;
  quantity: number;
  zone: string;
  is_critical: boolean;
}

interface EmergencySupportDetails {
  support_type: 'second_technician' | 'specialist' | 'supervisor' | 'external_contractor';
  reason: string;
  skills_needed?: string;
}

interface EmergencyRequestData {
  requires_parts: boolean;
  requires_repair: boolean;
  requires_support: boolean;
  final_state: 'operativo' | 'detenido' | 'observacion';
  final_status_text: string;
  observations?: string;
  parts?: EmergencyPart[];
  support_details?: EmergencySupportDetails;
}

function normalizeRequestType(type: string): ServiceRequestType {
  if (type === 'support' || type === 'inspection' || type === 'diagnostic') {
    return 'diagnostic';
  }
  if (type === 'parts') return 'parts';
  return 'repair';
}

function normalizePriority(priority: string): Priority {
  if (priority === 'critical') return 'high';
  if (priority === 'high') return 'high';
  if (priority === 'low') return 'low';
  return 'medium';
}

function buildDefaultTitle(
  requestType: ServiceRequestType,
  sourceType?: string
) {
  const typeLabel: Record<ServiceRequestType, string> = {
    repair: 'Trabajos / Reparación',
    parts: 'Repuestos',
    diagnostic: 'Diagnóstico Técnico',
  };

  const sourceLabelMap: Record<string, string> = {
    maintenance_checklist: 'Mantenimiento',
    emergency_visit: 'Emergencia',
    manual: 'Manual',
  };

  const sourceLabel = sourceType ? sourceLabelMap[sourceType] || sourceType : '';
  return sourceLabel
    ? `${typeLabel[requestType]} - ${sourceLabel}`
    : typeLabel[requestType];
}

export async function createServiceRequest(data: CreateServiceRequestInput) {
  try {
    const requestType = normalizeRequestType(data.request_type);
    const priority = normalizePriority(String(data.priority || 'medium'));

    const payload = {
      client_id: data.client_id,
      elevator_id: data.elevator_id,
      request_type: requestType,
      intervention_type: data.intervention_type ?? null,
      priority,
      description: data.description,
      title: data.title || buildDefaultTitle(requestType, data.source_type),
      source_type: data.source_type || 'manual',
      source_id: data.source_id || null,
      created_by_technician_id: data.created_by_technician_id || null,
      photo_1_url: data.photo_1_url || null,
      photo_2_url: data.photo_2_url || null,
      status: 'pending',
    };

    const { data: inserted, error } = await supabase
      .from('service_requests')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: inserted };
  } catch (error) {
    console.error('Error creating service request:', error);
    return { success: false, error };
  }
}

export async function createWorkOrderFromRequest(request: any) {
  const { data: workOrder, error } = await supabase
    .from('work_orders')
    .insert([
      {
        client_id: request.client_id,
        elevator_id: request.elevator_id,
        description: request.description,
        service_request_id: request.id,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  const { error: updateError } = await supabase
    .from('service_requests')
    .update({ work_order_id: workOrder.id })
    .eq('id', request.id);

  if (updateError) throw updateError;

  return workOrder;
}

export async function createRequestsFromMaintenance(
  checklistId: string,
  elevatorId: string,
  clientId: string,
  technicianId: string,
  rejectedQuestions: MaintenanceRejectedQuestion[]
) {
  const results: any[] = [];

  for (const question of rejectedQuestions) {
    if (!question.observations || question.observations.trim() === '') continue;

    const priority: Priority = question.is_critical ? 'high' : 'medium';

    const result = await createServiceRequest({
      request_type: 'repair',
      source_type: 'maintenance_checklist',
      source_id: checklistId,
      elevator_id: elevatorId,
      client_id: clientId,
      description: `Pregunta ${question.question_number}: ${question.text}\n\nObservaciones: ${question.observations}`,
      priority,
      intervention_type: 'corrective',
      created_by_technician_id: technicianId,
      photo_1_url: question.observation_photo_1 || null,
      photo_2_url: question.observation_photo_2 || null,
    });

    if (result.success && result.data) {
      results.push(result.data);
    } else {
      console.error('Error creando solicitud desde mantenimiento:', result.error);
    }
  }

  return results;
}

export async function createRequestsFromEmergency(
  emergencyId: string,
  reportId: string,
  elevatorId: string,
  clientId: string,
  technicianId: string,
  reportData: EmergencyRequestData
) {
  const results: any[] = [];

  const priority: Priority =
    reportData.final_state === 'detenido'
      ? 'high'
      : reportData.final_state === 'observacion'
      ? 'high'
      : 'medium';

  if (reportData.requires_repair || reportData.final_state === 'detenido') {
    const repairRequest = await createServiceRequest({
      request_type: 'repair',
      source_type: 'emergency_visit',
      source_id: emergencyId,
      elevator_id: elevatorId,
      client_id: clientId,
      description: `Estado Final: ${reportData.final_status_text}\n\n${reportData.observations || ''}`,
      priority,
      intervention_type: 'corrective',
      created_by_technician_id: technicianId,
    });

    if (repairRequest.success && repairRequest.data) {
      results.push(repairRequest.data);
    }
  }

  if (reportData.requires_parts && reportData.parts?.length) {
    for (const part of reportData.parts) {
      const partsRequest = await createServiceRequest({
        request_type: 'parts',
        source_type: 'emergency_visit',
        source_id: emergencyId,
        elevator_id: elevatorId,
        client_id: clientId,
        description: `Repuesto necesario: ${part.part_name} (${part.quantity} unidades) en zona: ${part.zone}`,
        priority: part.is_critical ? 'high' : 'medium',
        intervention_type: 'corrective',
        created_by_technician_id: technicianId,
      });

      if (partsRequest.success && partsRequest.data) {
        results.push(partsRequest.data);
      }
    }
  }

  if (reportData.requires_support && reportData.support_details) {
    const diagnosticRequest = await createServiceRequest({
      request_type: 'diagnostic',
      source_type: 'emergency_visit',
      source_id: emergencyId,
      elevator_id: elevatorId,
      client_id: clientId,
      description: reportData.support_details.reason,
      priority: 'high',
      intervention_type: 'corrective',
      created_by_technician_id: technicianId,
    });

    if (diagnosticRequest.success && diagnosticRequest.data) {
      results.push(diagnosticRequest.data);
    }
  }

  return results;
}

export async function getPendingServiceRequests(adminId?: string) {
  try {
    let query = supabase
      .from('service_requests')
      .select(`
        *,
        elevators:elevator_id (
          elevator_number,
          location_name,
          brand,
          model
        ),
        clients:client_id (
          company_name,
          building_name,
          address
        ),
        technician:created_by_technician_id (
          full_name,
          email
        )
      `)
      .in('status', ['pending', 'analyzing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (adminId) {
      query = query.or(`assigned_to_admin_id.eq.${adminId},assigned_to_admin_id.is.null`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    return { success: false, error };
  }
}

export async function updateServiceRequestStatus(
  requestId: string,
  status: string,
  adminId: string,
  notes?: string
) {
  try {
    const updateData: any = {
      status,
      reviewed_at: new Date().toISOString(),
      assigned_to_admin_id: adminId,
    };

    if (notes) updateData.resolution_notes = notes;
    if (status === 'completed') updateData.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from('service_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating service request:', error);
    return { success: false, error };
  }
}