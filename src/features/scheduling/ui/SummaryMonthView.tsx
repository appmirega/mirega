import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar as RBCalendar,
  dateFnsLocalizer,
  Views,
  type Event as RBCEvent,
} from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  eachDayOfInterval,
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

function safe(v: any) {
  return v == null || v === "" ? "—" : String(v);
}

/* ===============================
   LABELS POR TIPO (ACTUALIZADO)
================================ */
const typeLabel: Record<string, string> = {
  maintenance: "Mantención",
  work_order: "Solicitud",
  emergency_visit: "Emergencia",
  emergency_shift: "Turno emergencia",
  calendar_event: "Evento",
  repair: "Reparación",
  parts: "Repuestos",
  support: "Soporte",
  inspection: "Inspección",
  technical_visit: "Visita técnica",
  certification: "Certificación",
  rescue_training: "Inducción / Rescate",
};

type UIEvent = RBCEvent & {
  _row: CalendarEventRow;
};

export function SummaryMonthView(props: {
  selectedDate: Date;
  monthStart: string;
  monthEnd: string;
  onNavigate: (d: Date) => void;
}) {
  const { selectedDate, monthStart, monthEnd, onNavigate } = props;

  const { data, error, loading, reload } = useMonthCalendarEvents({
    monthStart,
    monthEnd,
  });

  const [approvedAbsences, setApprovedAbsences] = useState<
    Array<{ technician_id: string; start_date: string; end_date: string }>
  >([]);
  const [absError, setAbsError] = useState("");

  /* ===============================
     CARGAR AUSENCIAS APROBADAS
  =============================== */
  useEffect(() => {
    (async () => {
      setAbsError("");
      try {
        const { data, error } = await supabase
          .from("technician_availability")
          .select("technician_id, start_date, end_date")
          .eq("status", "approved")
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart);

        if (error) throw error;
        setApprovedAbsences((data ?? []) as any[]);
      } catch (e: any) {
        setAbsError(e?.message || "Error cargando ausencias aprobadas");
        setApprovedAbsences([]);
      }
    })();
  }, [monthStart, monthEnd]);

  /* ===============================
     DÍAS BLOQUEADOS
  =============================== */
  const blockedDays = useMemo(() => {
    const out = new Set<string>();
    for (const a of approvedAbsences) {
      const start = new Date(`${a.start_date}T00:00:00`);
      const end = new Date(`${a.end_date}T00:00:00`);
      const days = eachDayOfInterval({ start, end });
      for (const d of days) {
        out.add(d.toISOString().slice(0, 10));
      }
    }
    return out;
  }, [approvedAbsences]);

  /* ===============================
     MAPEO DE EVENTOS PARA CALENDAR
  =============================== */
  const events: UIEvent[] = useMemo(() => {
    return (data ?? []).map((r) => {
      const start = new Date(r.start_at || r.event_date);
      const end = new Date(r.end_at || r.event_date);

      return {
        title: `${typeLabel[r.event_type] || r.event_type} • ${safe(
          r.building_name
        )} • ${safe(r.title)}`,
        start,
        end,
        allDay: true,
        _row: r,
      } as UIEvent;
    });
  }, [data]);

  /* ===============================
     PINTAR DÍAS BLOQUEADOS
  =============================== */
  const dayPropGetter = (date: Date) => {
    const key = date.toISOString().slice(0, 10);
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
          <div className="text-base font-semibold">
            Resumen mensual (maestro)
          </div>
          <div className="text-xs text-slate-500">
            Solo lectura. Muestra asignaciones confirmadas del mes.
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
          onNavigate={(d) => onNavigate(d)}
          dayPropGetter={dayPropGetter}
          popup
        />
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Días con ausencias aprobadas se marcan en rojo suave.
      </div>
    </div>
  );
}