import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar as RBCalendar,
  Views,
  dateFnsLocalizer,
  type Event as RBCEvent,
} from "react-big-calendar";
import {
  eachDayOfInterval,
  format,
  getDay,
  parse,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { supabase } from "../../../lib/supabase";
import type { CalendarEventRow } from "../domain/calendarEvent";
import { useMonthCalendarEvents } from "../hooks/useMonthCalendarEvents";

const locales = { es };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const typeLabel: Record<string, string> = {
  maintenance: "Mantención",
  emergency: "Emergencia",
  emergency_visit: "Emergencia",
  emergency_shift: "Turno emergencia",
  repair: "Reparación",
  inspection: "Inspección",
  training: "Capacitación",
  visit: "Visita",
  technical_visit: "Visita técnica",
  certification: "Certificación",
  rescue_training: "Capacitación rescate",
  work_order: "Orden de trabajo",
  calendar_event: "Evento",
  other: "Otro",
};

type UIEvent = RBCEvent & {
  _row: CalendarEventRow;
};

function safeText(value?: string | null) {
  return value == null || value === "" ? "—" : String(value);
}

function normalizeDateString(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function SummaryMonthView(props: {
  selectedDate: Date;
  monthStart: string;
  monthEnd: string;
  onNavigate: (date: Date) => void;
}) {
  const { selectedDate, monthStart, monthEnd, onNavigate } = props;

  const { data, error, loading, reload } = useMonthCalendarEvents({
    monthStart,
    monthEnd,
  });

  const [approvedAbsences, setApprovedAbsences] = useState<
    Array<{
      technician_id: string;
      start_date: string;
      end_date: string;
      source: "availability" | "leave";
    }>
  >([]);
  const [absError, setAbsError] = useState<string>("");

  useEffect(() => {
    const loadApprovedAbsences = async () => {
      setAbsError("");

      try {
        const [availabilityResult, leavesResult] = await Promise.all([
          supabase
            .from("technician_availability")
            .select("technician_id, start_date, end_date, status")
            .eq("status", "approved")
            .lte("start_date", monthEnd)
            .gte("end_date", monthStart),
          supabase
            .from("technician_leaves")
            .select("technician_id, start_date, end_date, status")
            .eq("status", "approved")
            .lte("start_date", monthEnd)
            .gte("end_date", monthStart),
        ]);

        if (availabilityResult.error) throw availabilityResult.error;
        if (leavesResult.error) throw leavesResult.error;

        const availabilityRows =
          (availabilityResult.data ?? []).map((row: any) => ({
            technician_id: row.technician_id,
            start_date: row.start_date,
            end_date: row.end_date,
            source: "availability" as const,
          })) ?? [];

        const leaveRows =
          (leavesResult.data ?? []).map((row: any) => ({
            technician_id: row.technician_id,
            start_date: row.start_date,
            end_date: row.end_date,
            source: "leave" as const,
          })) ?? [];

        setApprovedAbsences([...availabilityRows, ...leaveRows]);
      } catch (err: any) {
        console.error(err);
        setAbsError(
          err?.message || "No fue posible cargar las ausencias aprobadas."
        );
        setApprovedAbsences([]);
      }
    };

    void loadApprovedAbsences();
  }, [monthEnd, monthStart]);

  const blockedDays = useMemo(() => {
    const output = new Set<string>();

    approvedAbsences.forEach((absence) => {
      const start = new Date(`${normalizeDateString(absence.start_date)}T00:00:00`);
      const end = new Date(`${normalizeDateString(absence.end_date)}T00:00:00`);

      eachDayOfInterval({ start, end }).forEach((day) => {
        output.add(format(day, "yyyy-MM-dd"));
      });
    });

    return output;
  }, [approvedAbsences]);

  const events: UIEvent[] = useMemo(() => {
    return (data ?? []).map((row) => {
      const eventDate = normalizeDateString(row.event_date);
      const start = new Date(row.start_at || `${eventDate}T00:00:00`);
      const end = new Date(row.end_at || `${eventDate}T23:59:59`);
      const label = typeLabel[row.event_type] || row.event_type;

      const summary =
        safeText(row.title) !== "—"
          ? safeText(row.title)
          : safeText(row.description);

      return {
        title: `${label} • ${safeText(row.building_name)} • ${summary}`,
        start,
        end,
        allDay: true,
        _row: row,
      };
    });
  }, [data]);

  const dayPropGetter = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");

    if (blockedDays.has(key)) {
      return {
        style: {
          backgroundColor: "rgba(239, 68, 68, 0.08)",
        },
      };
    }

    return {};
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Resumen mensual (maestro)</div>
          <div className="text-xs text-slate-500">
            Solo lectura. Consolida mantenciones, turnos y asignaciones operativas.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-md border bg-white px-3 py-2 text-sm"
            onClick={() =>
              onNavigate(
                new Date(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth() - 1,
                  1
                )
              )
            }
          >
            ◀ Mes anterior
          </button>

          <button
            className="rounded-md border bg-white px-3 py-2 text-sm"
            onClick={() => onNavigate(new Date())}
          >
            Hoy
          </button>

          <button
            className="rounded-md border bg-white px-3 py-2 text-sm"
            onClick={() =>
              onNavigate(
                new Date(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth() + 1,
                  1
                )
              )
            }
          >
            Mes siguiente ▶
          </button>

          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={reload}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {absError && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {absError}
        </div>
      )}

      <div className="h-[72vh]">
        <RBCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={[Views.MONTH]}
          defaultView={Views.MONTH}
          date={selectedDate}
          onNavigate={(date) => onNavigate(date)}
          dayPropGetter={dayPropGetter}
          popup
        />
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Los días con ausencias aprobadas se marcan con fondo rojo suave.
      </div>
    </div>
  );
}