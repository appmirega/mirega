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
    console.error("Supabase error fetchMonthCalendarEvents:", error);
    const message =
      (error as any)?.message ||
      (error as any)?.details ||
      (error as any)?.hint ||
      "Error consultando v_calendar_events_month";

    throw new Error(message);
  }

  return (data ?? []) as CalendarEventRow[];
}