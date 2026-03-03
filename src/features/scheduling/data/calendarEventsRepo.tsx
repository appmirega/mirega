import { supabase } from "../../../lib/supabase";
import type { CalendarEventRow } from "../domain/calendarEvent";

export async function fetchMonthCalendarEvents(params: {
  monthStart: string;
  monthEnd: string;
}) {
  const { monthStart, monthEnd } = params;

  const { data, error } = await supabase
    .from("v_calendar_events_month")
    .select("*")
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Error fetching calendar events:", error);
    throw error;
  }

  return (data ?? []) as CalendarEventRow[];
}