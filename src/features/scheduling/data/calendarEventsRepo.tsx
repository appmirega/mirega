import { supabase } from "../../../lib/supabase";
import type { CalendarEventRow } from "../domain/calendarEvent";

export async function fetchMonthCalendarEvents(params: {
  monthStart: string; // YYYY-MM-DD
  monthEnd: string;   // YYYY-MM-DD
}) {
  const { monthStart, monthEnd } = params;

  const { data, error } = await supabase
    .from("v_calendar_events_month")
    .select("*")
    .gte("start_at", `${monthStart}T00:00:00`)
    .lte("start_at", `${monthEnd}T23:59:59`)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CalendarEventRow[];
}

/** Solo para diagnóstico (si lo necesitas) */
export async function testCalendarView(limit = 5) {
  const { data, error } = await supabase
    .from("v_calendar_events_month")
    .select("*")
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}