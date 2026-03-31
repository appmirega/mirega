import { supabase } from './supabase';
import type {
  CreateServiceRequestData,
  CreateRepairRequestData,
  CreatePartsRequestData,
  CreateSupportRequestData,
  Priority,
  RequestType,
} from '../types/serviceRequests';

// =============================================
// UTILIDADES DE NORMALIZACIÓN
// =============================================

function normalizeRequestType(type: string): RequestType {
  if (type === 'support' || type === 'inspection' || type === 'diagnostic') {
    return 'diagnostic';
  }
  if (type === 'parts') return 'parts';
  return 'repair';
}

function getRequestTypeLabel(type: RequestType) {
  const labels: Record<RequestType, string> = {
    repair: 'Trabajos / Reparación',
    parts: 'Repuestos',
    diagnostic: 'Diagnóstico Técnico',
  };

  return labels[type] || 'Solicitud';
}

// =============================================
// FUNCIÓN PRINCIPAL: Crear Solicitud de Servicio
// =============================================

export async function createServiceRequest(data: CreateServiceRequestData) {
  try {
    const normalizedRequestType = normalizeRequestType(data.request_type);

    console.log('📝 Creando service_request con datos:', {
      request_type: normalizedRequestType,
      intervention_type: data.intervention_type || null,
      elevator_id: data.elevator_id,
      client_id: data.client_id,
      created_by_technician_id: data.created_by_technician_id
    });

    // Generar título si no se provee
    let title = data.title?.trim();
    if (!title) {
      const typeLabel = getRequestTypeLabel(normalizedRequestType);

      const sourceLabel = {
        maintenance_checklist: 'Mantenimiento',
        emergency_visit: 'Emergencia',
        manual: 'Manual'
      }[data.source_type] || '';

      title = `${typeLabel} - ${sourceLabel}`;
    }

    const { data: serviceRequest, error } = await supabase
      .from('service_requests')
      .insert({
        request_type: normalizedRequestType,
        intervention_type: data.intervention_type || null,
        source_type: data.source_type,
        source_id: data.source_id || null,
        elevator_id: data.elevator_id,
        client_id: data.client_id,
        title,
        description: data.description,
        priority: data.priority,
        created_by_technician_id: data.created_by_technician_id,
        photo_1_url: data.photo_1_url || null,
        photo_2_url: data.photo_2_url || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error en INSERT service_requests:', error);
      throw error;
    }

    console.log('✅ Service request creado:', serviceRequest.id);

    return { success: true, data: serviceRequest };
  } catch (error) {
    console.error('Error creating service request:', error);
    return { success: false, error };
  }
}

// =============================================
// CREAR NOTIFICACIÓN PARA ADMINS
// =============================================

async function createNotificationForAdmins(requestData: {
  title: string;
  description: string;
  priority: Priority;
  requestType: RequestType;
}) {
  try {
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (adminsError) throw adminsError;
    if (!admins || admins.length === 0) return;

    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type: 'service_request',
      title: `Nueva Solicitud: ${requestData.title}`,
      message: `Prioridad: ${requestData.priority.toUpperCase()} - ${requestData.description.substring(0, 100)}...`,
      is_read: false,
      metadata: {
        request_type: requestData.requestType,
        priority: requestData.priority,
      }
    }));

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifError) throw notifError;
    console.log(`✅ ${notifications.length} notificación(es) creada(s) para admins`);
  } catch (error) {
    console.error('Error creating notifications:', error);
  }
}

// =============================================
// DESDE MANTENIMIENTO: Crear solicitudes desde observaciones
// =============================================

export async function createRequestsFromMaintenance(
  checklistId: string,
  elevatorId: string,
  clientId: string,
  technicianId: string,
  rejectedQuestions: Array<{
    question_number: number;
    text: string;
    observations: string;
    is_critical?: boolean;
    observation_photo_1?: string | null;
    observation_photo_2?: string | null;
  }>
) {
  const results = [];

  for (const question of rejectedQuestions) {
    if (!question.observations || question.observations.trim() === '') {
      continue;
    }

    const priority: Priority = question.is_critical ? 'high' : 'medium';

    const result = await createServiceRequest({
      request_type: 'repair',
      intervention_type: 'corrective',
      source_type: 'maintenance_checklist',
      source_id: checklistId,
      elevator_id: elevatorId,
      client_id: clientId,
      description: `Pregunta ${question.question_number}: ${question.text}\n\nObservaciones: ${question.observations}`,
      priority,
      created_by_technician_id: technicianId,
      photo_1_url: question.observation_photo_1 || null,
      photo_2_url: question.observation_photo_2 || null,
    });

    if (result.success && result.data) {
      results.push(result.data);
    } else {
      console.error('❌ Error creando service_request:', result.error);
    }
  }

  return results;
}

// =============================================
// DESDE EMERGENCIA: Crear solicitudes automáticas
// =============================================

export async function createRequestsFromEmergency(
  emergencyId: string,
  reportId: string,
  elevatorId: string,
  clientId: string,
  technicianId: string,
  reportData: {
    requires_parts: boolean;
    requires_repair: boolean;
    requires_support: boolean;
    final_state: 'operativo' | 'detenido' | 'observacion';
    final_status_text: string;
    observations?: string;
    parts?: Array<{
      part_name: string;
      quantity: number;
      zone: string;
      is_critical: boolean;
    }>;
    support_details?: {
      support_type: 'second_technician' | 'specialist' | 'supervisor' | 'external_contractor';
      reason: string;
      skills_needed?: string;
    };
  }
) {
  const results = [];

  const priority: Priority =
    reportData.final_state === 'detenido'
      ? 'critical'
      : reportData.final_state === 'observacion'
      ? 'high'
      : 'medium';

  // 1. Crear solicitud de trabajos / reparación
  if (reportData.requires_repair || reportData.final_state === 'detenido') {
    const repairRequest = await createServiceRequest({
      request_type: 'repair',
      intervention_type: 'corrective',
      source_type: 'emergency_visit',
      source_id: emergencyId,
      elevator_id: elevatorId,
      client_id: clientId,
      description: `Estado Final: ${reportData.final_status_text}\n\n${reportData.observations || ''}`,
      priority,
      created_by_technician_id: technicianId,
    });

    if (repairRequest.success && repairRequest.data) {
      await createRepairRequest({
        service_request_id: repairRequest.data.id,
        elevator_operational: reportData.final_state === 'operativo',
        can_wait: reportData.final_state !== 'detenido',
        max_wait_days: reportData.final_state === 'detenido' ? 1 : 7,
      });

      results.push(repairRequest.data);
    }
  }

  // 2. Crear solicitudes de repuestos
  if (reportData.requires_parts && reportData.parts && reportData.parts.length > 0) {
    for (const part of reportData.parts) {
      const partsRequest = await createServiceRequest({
        request_type: 'parts',
        intervention_type: 'corrective',
        source_type: 'emergency_visit',
        source_id: emergencyId,
        elevator_id: elevatorId,
        client_id: clientId,
        description: `Repuesto necesario: ${part.part_name} (${part.quantity} unidades) en zona: ${part.zone}`,
        priority: part.is_critical ? 'critical' : 'high',
        created_by_technician_id: technicianId,
      });

      if (partsRequest.success && partsRequest.data) {
        await createPartsRequest({
          service_request_id: partsRequest.data.id,
          part_name: part.part_name,
          quantity: part.quantity,
          zone: part.zone,
          urgency: part.is_critical ? 'immediate' : 'this_week',
          reason_for_urgency: reportData.final_state === 'detenido' ? 'Ascensor detenido' : undefined,
        });

        results.push(partsRequest.data);
      }
    }
  }

  // 3. Crear solicitud de diagnóstico técnico
  if (reportData.requires_support && reportData.support_details) {
    const diagnosticRequest = await createServiceRequest({
      request_type: 'diagnostic',
      intervention_type: 'corrective',
      source_type: 'emergency_visit',
      source_id: emergencyId,
      elevator_id: elevatorId,
      client_id: clientId,
      description: reportData.support_details.reason,
      priority: 'high',
      created_by_technician_id: technicianId,
    });

    if (diagnosticRequest.success && diagnosticRequest.data) {
      await createSupportRequest({
        service_request_id: diagnosticRequest.data.id,
        support_type: reportData.support_details.support_type,
        reason: reportData.support_details.reason,
        skills_needed: reportData.support_details.skills_needed,
      });

      results.push(diagnosticRequest.data);
    }
  }

  return results;
}

// =============================================
// FUNCIONES AUXILIARES PARA CREAR DETALLES
// =============================================

export async function createRepairRequest(data: CreateRepairRequestData) {
  try {
    const { error } = await supabase.from('repair_requests').insert({
      service_request_id: data.service_request_id,
      repair_category: data.repair_category,
      estimated_hours: data.estimated_hours,
      requires_multiple_technicians: data.requires_multiple_technicians || false,
      number_of_technicians: data.number_of_technicians || 1,
      requires_specialized_technician: data.requires_specialized_technician || false,
      specialization_needed: data.specialization_needed,
      requires_special_tools: data.requires_special_tools || false,
      tools_needed: data.tools_needed,
      elevator_operational: data.elevator_operational ?? false,
      can_wait: data.can_wait ?? true,
      max_wait_days: data.max_wait_days,
      photos: data.photos || [],
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating repair request:', error);
    return { success: false, error };
  }
}

export async function createPartsRequest(data: CreatePartsRequestData) {
  try {
    const { error } = await supabase.from('parts_requests').insert({
      service_request_id: data.service_request_id,
      part_name: data.part_name,
      part_code: data.part_code,
      brand: data.brand,
      model: data.model,
      quantity: data.quantity,
      zone: data.zone,
      urgency: data.urgency,
      reason_for_urgency: data.reason_for_urgency,
      status: 'pending',
      photos: data.photos || [],
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating parts request:', error);
    return { success: false, error };
  }
}

export async function createSupportRequest(data: CreateSupportRequestData) {
  try {
    const { error } = await supabase.from('support_requests').insert({
      service_request_id: data.service_request_id,
      support_type: data.support_type,
      reason: data.reason,
      skills_needed: data.skills_needed,
      specific_requirements: data.specific_requirements,
      status: 'pending',
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error creating support request:', error);
    return { success: false, error };
  }
}

// =============================================
// UTILIDADES
// =============================================

function categorizeRepairFromQuestion(questionText: string): 'motor' | 'doors' | 'electrical' | 'hydraulic' | 'control_panel' | 'cabin' | 'cables' | 'other' {
  const text = questionText.toLowerCase();

  if (text.includes('motor') || text.includes('tracción')) return 'motor';
  if (text.includes('puerta') || text.includes('door')) return 'doors';
  if (text.includes('eléctric') || text.includes('electric') || text.includes('contacto')) return 'electrical';
  if (text.includes('hidráulic') || text.includes('hydraulic') || text.includes('pistón')) return 'hydraulic';
  if (text.includes('botonera') || text.includes('control') || text.includes('panel')) return 'control_panel';
  if (text.includes('cabina') || text.includes('cabin')) return 'cabin';
  if (text.includes('cable') || text.includes('polea')) return 'cables';

  return 'other';
}

// =============================================
// FUNCIÓN PARA OBTENER SOLICITUDES PENDIENTES
// =============================================

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

// =============================================
// FUNCIÓN PARA ACTUALIZAR ESTADO DE SOLICITUD
// =============================================

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

    if (notes) {
      updateData.resolution_notes = notes;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

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