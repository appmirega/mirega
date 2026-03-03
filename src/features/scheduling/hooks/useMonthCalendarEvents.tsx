import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fetchMonthCalendarEvents } from "../data/calendarEventsRepo";
import type { CalendarEventRow } from "../domain/calendarEvent";

type DateLike = string | Date | undefined | null;

function normalizeToYmd(d: DateLike): string {
  if (!d) return "";
  if (typeof d === "string") return d; // esperamos "YYYY-MM-DD"
  if (d instanceof Date && !isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
  return "";
}

export function useMonthCalendarEvents(params: {
  monthStart: DateLike;
  monthEnd: DateLike;
}) {
  const [data, setData] = useState<CalendarEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const monthStart = useMemo(() => normalizeToYmd(params.monthStart), [params.monthStart]);
  const monthEnd = useMemo(() => normalizeToYmd(params.monthEnd), [params.monthEnd]);

  const reload = useCallback(async () => {
    // ✅ si faltan parámetros, no dispares query
    if (!monthStart || !monthEnd) {
      setData([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const rows = await fetchMonthCalendarEvents({ monthStart, monthEnd });
      setData(rows);
    } catch (e: any) {
      // ✅ esto te mostrará el error real
      console.error("Error fetching calendar events:", e);
      setError(e?.message || "Error fetching calendar events");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, monthStart, monthEnd };
}