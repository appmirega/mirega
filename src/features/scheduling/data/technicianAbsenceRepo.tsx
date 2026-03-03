import { supabase } from "../../../lib/supabase";
import type { CalendarEventRow } from "../domain/calendarEvent";

export async function fetchMonthCalendarEvents(params: {
  monthStart: string; // YYYY-MM-DD
  monthEnd: string; // YYYY-MM-DD
}) {
  const { monthStart, monthEnd } = params;

  const { data, error } = await supabase
    .from("v_calendar_events_month")
    .select("*")
    // ✅ filtro seguro por DATE (no por timestamp)
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    .order("start_at", { ascending: true });

  if (error) {
    // ✅ para que veas el error real en UI/console
    const details =
      (error as any)?.details ||
      (error as any)?.hint ||
      (error as any)?.message ||
      "Error desconocido consultando v_calendar_events_month";
    throw new Error(details);
  }

  return (data ?? []) as CalendarEventRow[];
}

/** Solo para diagnóstico (si lo necesitas) */
export async function testCalendarView(limit = 5) {
  const { data, error } = await supabase
    .from("v_calendar_events_month")
    .select("*")
    .limit(limit);

  if (error) {
    const details =
      (error as any)?.details ||
      (error as any)?.hint ||
      (error as any)?.message ||
      "Error desconocido";
    throw new Error(details);
  }

  return data ?? [];
}