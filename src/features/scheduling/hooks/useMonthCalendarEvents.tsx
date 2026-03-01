import { useEffect, useMemo, useState } from "react";
import type { CalendarEventRow } from "../domain/calendarEvent";
import { fetchMonthCalendarEvents } from "../data/calendarEventsRepo";

export function useMonthCalendarEvents(monthStart: string, monthEnd: string) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CalendarEventRow[]>([]);
  const [error, setError] = useState<string>("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMonthCalendarEvents({ monthStart, monthEnd });
      setRows(data);
    } catch (e: any) {
      setError(e?.message || "Error cargando eventos del mes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, monthEnd]);

  return useMemo(() => ({ loading, rows, error, reload }), [loading, rows, error]);
}