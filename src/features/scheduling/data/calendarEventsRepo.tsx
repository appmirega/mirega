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
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    // ✅ SOLO una orden estable
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Supabase error fetchMonthCalendarEvents:", error);
    const msg =
      (error as any)?.message ||
      (error as any)?.details ||
      (error as any)?.hint ||
      "Error querying v_calendar_events_month";
    throw new Error(msg);
  }

  return (data ?? []) as CalendarEventRow[];
}