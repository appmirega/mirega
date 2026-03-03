export type CalendarEventType =
  | "maintenance"
  | "emergency_shift"
  | "emergency_visit"
  | "repair"
  | "parts"
  | "support"
  | "inspection";

export interface CalendarEventRow {
  id: string; // e.g. "maintenance:<uuid>" or "repair:<uuid>"
  event_type: CalendarEventType;
  source_id: string; // uuid as text

  title: string;
  status: string | null;

  // strings returned by Postgres view
  event_date: string; // date/timestamp string
  start_at: string; // timestamp string
  end_at: string; // timestamp string

  client_id: string | null;
  building_name: string | null;

  technician_id: string | null;

  is_external: boolean | null;
  external_personnel_name: string | null;
}