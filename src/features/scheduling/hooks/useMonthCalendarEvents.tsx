import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fetchMonthCalendarEvents } from "../data/calendarEventsRepo";
import type { CalendarEventRow } from "../domain/calendarEvent";

type DateLike = string | Date | undefined | null;

function normalizeToYmd(value: DateLike): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, "yyyy-MM-dd");
  }
  return "";
}

export function useMonthCalendarEvents(params: {
  monthStart: DateLike;
  monthEnd: DateLike;
}) {
  const [data, setData] = useState<CalendarEventRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const monthStart = useMemo(() => normalizeToYmd(params.monthStart), [params.monthStart]);
  const monthEnd = useMemo(() => normalizeToYmd(params.monthEnd), [params.monthEnd]);

  const reload = useCallback(async () => {
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
    } catch (err: any) {
      console.error("Error fetching calendar events:", err);
      setError(err?.message || "No fue posible cargar el resumen mensual.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [monthEnd, monthStart]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    loading,
    error,
    reload,
    monthStart,
    monthEnd,
  };
}