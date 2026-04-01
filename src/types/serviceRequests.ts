// =============================================
// TIPOS PARA SISTEMA DE SOLICITUDES DE SERVICIO
// =============================================

export type RequestType = 'repair' | 'parts' | 'diagnostic';
export type InterventionType = 'preventive' | 'corrective' | 'improvement';

export type SourceType = 'maintenance_checklist' | 'emergency_visit' | 'manual';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

// 🔥 NUEVO FLUJO DE ESTADOS
export type ServiceRequestStatus =
  | 'pending'
  | 'analyzing'
  | 'info_requested'
  | 'processing'
  | 'quotation_pending'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'resolved'
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
  intervention_type: InterventionType | null;
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
  work_order_id?: string | null;

  // 🔥 NUEVOS CAMPOS CLAVE
  requires_quotation?: boolean;
  request_origin?: 'technician_internal' | 'technician_external' | 'client';
  workflow_path?: 'direct' | 'quotation_ot';
  processed_at?: string | null;
  closed_at?: string | null;

  // Relaciones
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