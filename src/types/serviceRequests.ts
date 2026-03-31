export type ServiceRequestType =
  | 'repair'
  | 'parts'
  | 'diagnostic';

export type InterventionType =
  | 'preventive'
  | 'corrective'
  | 'improvement';

export type ServiceRequestStatus =
  | 'new'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'closed';

export interface ServiceRequest {
  id: string;
  client_id: string;
  elevator_id: string;

  request_type: ServiceRequestType;
  intervention_type: InterventionType | null;

  priority: 'low' | 'medium' | 'high';
  description: string;

  status: ServiceRequestStatus;

  work_order_id?: string | null;

  created_at?: string;
}