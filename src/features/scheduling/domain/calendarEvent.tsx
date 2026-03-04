export type CalendarEventType =
  | "maintenance"
  | "work_order"
  | "emergency_visit"
  | "emergency_shift"
  | "calendar_event"
  | "repair"
  | "parts"
  | "support"
  | "inspection"
  // ✅ nuevos tipos “otros trabajos”
  | "technical_visit"
  | "certification"
  | "rescue_training";

export type CalendarEventStatus = "scheduled" | "in_progress" | "done" | "cancelled";

export interface CalendarEvent {
  id: string;
  event_type: CalendarEventType;

  // Origen (si viene de otra tabla/flujo)
  source_id?: string | null;

  // Contexto
  client_id?: string | null;
  building_name?: string | null;

  // Asignación
  technician_id?: string | null;

  // Extras si trabajas con externos
  external_person?: string | null;
  is_external?: boolean | null;

  status: CalendarEventStatus;

  // Fechas
  event_date: string; // timestamptz o date según tu vista (lo tratamos como string ISO)
  start_at?: string | null;
  end_at?: string | null;

  // UI
  title: string;
  description?: string | null;
}