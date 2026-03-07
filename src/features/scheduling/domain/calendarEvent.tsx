export type CalendarEventType =
  | "maintenance"
  | "emergency"
  | "emergency_visit"
  | "emergency_shift"
  | "repair"
  | "inspection"
  | "training"
  | "visit"
  | "technical_visit"
  | "certification"
  | "rescue_training"
  | "work_order"
  | "calendar_event"
  | "other"
  | string;

export type CalendarEventStatus =
  | "scheduled"
  | "pending"
  | "approved"
  | "analyzing"
  | "in_progress"
  | "done"
  | "completed"
  | "cancelled"
  | "rejected"
  | string;

export interface CalendarEventRow {
  id: string;
  event_type: CalendarEventType;
  status?: CalendarEventStatus | null;
  source_id?: string | null;
  client_id?: string | null;
  building_name?: string | null;
  technician_id?: string | null;
  external_person?: string | null;
  is_external?: boolean | null;
  event_date: string;
  start_at?: string | null;
  end_at?: string | null;
  title?: string | null;
  description?: string | null;
}