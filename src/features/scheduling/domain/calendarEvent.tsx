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
  | "parts"
  | "support"
  | string;

export type CalendarEventStatus =
  | "scheduled"
  | "pending"
  | "in_progress"
  | "done"
  | "cancelled"
  | string;

export interface CalendarEventRow {
  id: string;
  event_type: CalendarEventType;
  status?: CalendarEventStatus | null;
  source_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  building_id?: string | null;
  building_name?: string | null;
  technician_id?: string | null;
  technician_name?: string | null;
  external_person?: string | null;
  is_external?: boolean | null;
  event_date: string;
  start_at?: string | null;
  end_at?: string | null;
  title?: string | null;
  description?: string | null;
}