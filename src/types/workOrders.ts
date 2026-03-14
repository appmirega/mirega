export type WorkOrderStatus =
  | 'draft'
  | 'waiting_client_approval'
  | 'approved'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type ClientApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'approved_by_admin_override';

export type WorkType =
  | 'repair'
  | 'modernization'
  | 'normative'
  | 'improvement'
  | 'maintenance'
  | 'inspection';

export interface WorkOrder {
  id: string;

  ot_number: number;

  order_number?: string;

  title: string;
  description?: string;

  client_id?: string;
  building_id?: string;
  elevator_id?: string;

  assigned_technician_id?: string;

  work_type?: WorkType;

  status: WorkOrderStatus;

  client_approval_status?: ClientApprovalStatus;

  external_quotation_number?: string;
  external_quotation_pdf_url?: string;

  quotation_number?: string;
  quotation_pdf_url?: string;

  estimated_days?: number;
  required_technicians?: number;

  is_internal?: boolean;

  scheduled_date?: string;

  created_by?: string;

  created_at?: string;
  updated_at?: string;

  technician_started_at?: string;
  technician_finished_at?: string;

  closed_at?: string;

  is_closed?: boolean;

  estimated_hours?: number;
  actual_hours?: number;

  total_cost?: number;

  client_satisfaction_rating?: number;

  client_feedback?: string;
}