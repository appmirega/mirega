// =============================================
// TIPOS PARA SISTEMA DE SOLICITUDES DE SERVICIO
// =============================================

export type RequestType = 'repair' | 'parts' | 'support' | 'inspection';
export type SourceType = 'maintenance_checklist' | 'emergency_visit' | 'manual';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type ServiceRequestStatus =
  | 'pending'
  | 'analyzing'
  | 'quotation_sent'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'on_hold';

export type ResolutionType = 'quotation' | 'work_order' | 'internal_work' | 'no_action';

export type RepairCategory =
  | 'motor'
  | 'doors'
  | 'electrical'
  | 'hydraulic'
  | 'control_panel'
  | 'cabin'
  | 'cables'
  | 'other';

export type PartUrgency = 'immediate' | 'this_week' | 'this_month' | 'normal';

export type PartStatus =
  | 'pending'
  | 'approved'
  | 'ordered'
  | 'in_transit'
  | 'arrived'
  | 'installed'
  | 'cancelled';

export type SupportType =
  | 'second_technician'
  | 'specialist'
  | 'supervisor'
  | 'external_contractor';

export type SupportStatus =
  | 'pending'
  | 'assigned'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

// =============================================
// INTERFACES DE DATOS
// =============================================

export interface ServiceRequest {
  id: string;
  request_type: RequestType;
  source_type: SourceType;
  source_id: string | null;
  elevator_id: string;
  client_id: string;
  title: string;
  description: string;
  priority: Priority;
  status: ServiceRequestStatus;
  created_by_technician_id: string | null;
  created_at: string;
  assigned_to_admin_id: string | null;
  reviewed_at: string | null;
  resolution_type: ResolutionType | null;
  resolution_notes: string | null;
  completed_at: string | null;
  updated_at: string;
  
  // Relaciones (cuando se hace JOIN)
  elevators?: {
    elevator_number: number;
    location_name: string;
    brand: string;
    model: string;
  };
  clients?: {
    company_name: string;
    building_name: string;
    address: string;
  };
  technician?: {
    full_name: string;
    email: string;
  };
  admin?: {
    full_name: string;
  };
}

export interface RepairRequest {
  id: string;
  service_request_id: string;
  repair_category: RepairCategory | null;
  estimated_hours: number | null;
  estimated_cost: number | null;
  requires_multiple_technicians: boolean;
  number_of_technicians: number;
  requires_specialized_technician: boolean;
  specialization_needed: string | null;
  requires_special_tools: boolean;
  tools_needed: string | null;
  elevator_operational: boolean;
  can_wait: boolean;
  max_wait_days: number | null;
  photos: Photo[];
  created_at: string;
}

export interface PartsRequest {
  id: string;
  service_request_id: string;
  part_name: string;
  part_code: string | null;
  brand: string | null;
  model: string | null;
  quantity: number;
  zone: string | null;
  urgency: PartUrgency;
  reason_for_urgency: string | null;
  status: PartStatus;
  approved_at: string | null;
  ordered_at: string | null;
  estimated_arrival: string | null;
  arrived_at: string | null;
  installed_at: string | null;
  unit_price: number | null;
  total_price: number | null;
  supplier: string | null;
  photos: Photo[];
  created_at: string;
  updated_at: string;
}

export interface SupportRequest {
  id: string;
  service_request_id: string;
  support_type: SupportType;
  reason: string;
  skills_needed: string | null;
  specific_requirements: string | null;
  assigned_technician_id: string | null;
  assigned_at: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: SupportStatus;
  completion_notes: string | null;
  completed_at: string | null;
  created_at: string;
  
  // Relación con técnico asignado
  assigned_technician?: {
    full_name: string;
    phone: string;
    email: string;
  };
}

export interface Photo {
  url: string;
  description?: string;
  uploaded_at?: string;
}

// =============================================
// TIPOS PARA EMERGENCIAS V3
// =============================================

export type FailureType = 'terceros' | 'tecnico';
export type EmergencyStatus = 'in_progress' | 'completed' | 'stopped';
export type FinalState = 'operativo' | 'detenido' | 'observacion';

export interface EmergencyVisitV3 {
  id: string;
  client_id: string;
  building_name: string;
  building_address: string;
  elevators_in_failure: string[]; // Array de UUIDs
  total_elevators_in_failure: number;
  same_failure_all: boolean;
  failure_type: FailureType;
  technician_id: string;
  visit_date: string;
  visit_time: string;
  started_at: string;
  completed_at: string | null;
  status: EmergencyStatus;
  signer_name: string | null;
  signature_url: string | null;
  signed_at: string | null;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  last_saved_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Relaciones
  clients?: {
    company_name: string;
    building_name: string;
    address: string;
  };
  technician?: {
    full_name: string;
  };
}

export interface EmergencyReportV3 {
  id: string;
  visit_id: string;
  elevator_id: string;
  elevator_number: number;
  was_working_on_arrival: boolean;
  initial_status_text: string;
  initial_photos: Photo[];
  final_status_text: string;
  final_photos: Photo[];
  final_state: FinalState;
  requires_parts: boolean;
  requires_repair: boolean;
  requires_support: boolean;
  observations: string | null;
  report_number: string | null;
  completed_at: string | null;
  created_at: string;
  
  // Relación con ascensor
  elevators?: {
    elevator_number: number;
    location_name: string;
    brand: string;
    model: string;
  };
}

export interface EmergencyPartsRequestV3 {
  id: string;
  report_id: string;
  part_name: string;
  quantity: number;
  part_type: string | null;
  zone: string;
  is_critical: boolean;
  reason: string | null;
  photos: Photo[];
  linked_parts_request_id: string | null;
  created_at: string;
}

// =============================================
// TIPOS PARA FORMULARIOS
// =============================================

export interface CreateServiceRequestData {
  request_type: RequestType;
  source_type: SourceType;
  source_id?: string;
  elevator_id: string;
  client_id: string;
  title?: string; // Se auto-genera si no se provee
  description: string;
  priority: Priority;
  created_by_technician_id: string;
  photo_1_url?: string | null;
  photo_2_url?: string | null;
}

export interface CreateRepairRequestData {
  service_request_id: string;
  repair_category?: RepairCategory;
  estimated_hours?: number;
  requires_multiple_technicians?: boolean;
  number_of_technicians?: number;
  requires_specialized_technician?: boolean;
  specialization_needed?: string;
  requires_special_tools?: boolean;
  tools_needed?: string;
  elevator_operational?: boolean;
  can_wait?: boolean;
  max_wait_days?: number;
  photos?: Photo[];
}

export interface CreatePartsRequestData {
  service_request_id: string;
  part_name: string;
  part_code?: string;
  brand?: string;
  model?: string;
  quantity: number;
  zone?: string;
  urgency: PartUrgency;
  reason_for_urgency?: string;
  photos?: Photo[];
}

export interface CreateSupportRequestData {
  service_request_id: string;
  support_type: SupportType;
  reason: string;
  skills_needed?: string;
  specific_requirements?: string;
}

// =============================================
// TIPOS PARA VISTAS Y DASHBOARDS
// =============================================

export interface ServiceRequestWithDetails extends ServiceRequest {
  repair_details?: RepairRequest;
  parts_details?: PartsRequest[];
  support_details?: SupportRequest;
}

export interface ServiceRequestStats {
  total_pending: number;
  total_in_progress: number;
  total_completed: number;
  critical_count: number;
  high_priority_count: number;
  avg_resolution_time_hours: number;
}

export interface EmergencyDashboardData {
  in_progress_count: number;
  stopped_elevators_count: number;
  completed_today: number;
  avg_response_time_minutes: number;
}
