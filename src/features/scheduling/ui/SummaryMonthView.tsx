import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar as RBCalendar,
  dateFnsLocalizer,
  Views,
  type Event as RBCEvent,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay, eachDayOfInterval } from "date-fns";
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

const messagesES = {
  allDay: "Todo el día",
  previous: "Anterior",
  next: "Siguiente",
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Evento",
  noEventsInRange: "No hay eventos en este rango.",
  showMore: (total: number) => `+ Ver ${total} más`,
};

type CalEvent = RBCEvent & { resource: CalendarEventRow };

function asDate(value: string) {
  return new Date(value);
}

function safe(v: any) {
  return v == null || v === "" ? "—" : String(v);
}

function typeLabel(t: CalendarEventRow["event_type"]) {
  if (t === "maintenance") return "Mantención";
  if (t === "emergency_shift") return "Turno emergencia";
  return "Visita emergencia";
}

export function SummaryMonthView(props: {
  selectedDate: Date;
  monthStart: string; // YYYY-MM-DD
  monthEnd: string; // YYYY-MM-DD
  onNavigate: (d: Date) => void;
}) {
  const { selectedDate, monthStart, monthEnd, onNavigate } = props;

  const { loading, rows, error } = useMonthCalendarEvents(monthStart, monthEnd);

  const [selected, setSelected] = useState<CalendarEventRow | null>(null);
  const [absLoading, setAbsLoading] = useState(false);
  const [absError, setAbsError] = useState("");
  const [approvedAbsencesCount, setApprovedAbsencesCount] = useState(0);
  const [blockedDaysSet, setBlockedDaysSet] = useState<Set<string>>(new Set());

  // ✅ Carga ausencias aprobadas directamente aquí
  useEffect(() => {
    const load = async () => {
      setAbsLoading(true);
      setAbsError("");

      try {
        const { data, error } = await supabase
          .from("technician_availability")
          .select("start_date, end_date")
          .eq("status", "approved")
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart);

        if (error) throw error;

        const list = data ?? [];
        setApprovedAbsencesCount(list.length);

        const set = new Set<string>();

        for (const a of list as any[]) {
          const start = new Date(`${a.start_date}T00:00:00`);
          const end = new Date(`${a.end_date}T00:00:00`);
          const days = eachDayOfInterval({ start, end });

          for (const d of days) set.add(format(d, "yyyy-MM-dd"));
        }

        setBlockedDaysSet(set);
      } catch (e: any) {
        setAbsError(e?.message || "Error cargando ausencias aprobadas");
        setBlockedDaysSet(new Set());
        setApprovedAbsencesCount(0);
      } finally {
        setAbsLoading(false);
      }
    };

    void load();
  }, [monthStart, monthEnd]);

  const events: CalEvent[] = useMemo(() => {
    return rows.map((r) => ({
      title: r.title,
      start: asDate(r.start_at),
      end: asDate(r.end_at),
      allDay: r.event_type === "maintenance",
      resource: r,
    }));
  }, [rows]);

  const stats = useMemo(() => {
    const s = { maintenance: 0, emergency_shift: 0, emergency_visit: 0 };
    for (const r of rows) (s as any)[r.event_type] = ((s as any)[r.event_type] ?? 0) + 1;
    return s;
  }, [rows]);

  const dayPropGetter = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    if (!blockedDaysSet.has(key)) return {};
    return {
      style: { backgroundColor: "rgba(255, 0, 0, 0.06)" } as React.CSSProperties,
    };
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
      <div className="rounded-lg border bg-white p-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            {loading ? "Cargando eventos..." : "Resumen maestro (solo lectura)"}
            {error ? <span className="ml-2 text-red-600">({error})</span> : null}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border bg-white px-2 py-1">
              Mantenciones: <b>{stats.maintenance}</b>
            </span>
            <span className="rounded-full border bg-white px-2 py-1">
              Turnos: <b>{stats.emergency_shift}</b>
            </span>
            <span className="rounded-full border bg-white px-2 py-1">
              Visitas: <b>{stats.emergency_visit}</b>
            </span>

            <span className="rounded-full border bg-white px-2 py-1">
              Días bloqueados: <b>{blockedDaysSet.size}</b>
            </span>

            <span className="rounded-full border bg-white px-2 py-1">
              Ausencias aprobadas: <b>{approvedAbsencesCount}</b>
              {absLoading ? <span className="ml-1 text-slate-500">(…)</span> : null}
              {absError ? <span className="ml-1 text-red-600">({absError})</span> : null}
            </span>
          </div>
        </div>

        <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{
              backgroundColor: "rgba(255, 0, 0, 0.06)",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          />
          <span>Día con ausencias aprobadas (bloqueo visual)</span>
        </div>

        <RBCalendar
          localizer={localizer}
          culture="es"
          messages={messagesES as any}
          events={events}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          defaultView={Views.MONTH}
          startAccessor="start"
          endAccessor="end"
          date={selectedDate}
          onNavigate={onNavigate}
          popup
          onSelectEvent={(ev) => setSelected((ev as CalEvent).resource)}
          dayPropGetter={dayPropGetter as any}
        />
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-base font-semibold">Detalle</div>

        {!selected ? (
          <div className="space-y-2 text-sm text-slate-600">
            <div>Haz click en un evento del calendario para ver los detalles.</div>
            <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
              <div className="font-semibold">Tip</div>
              <div>
                El sombreado rojo claro indica días con ausencias aprobadas. En el
                siguiente paso bloqueamos también el planner.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-slate-50 p-3">
              <div className="text-sm font-semibold">{selected.title}</div>
              <div className="text-xs text-slate-600">
                Tipo: <b>{typeLabel(selected.event_type)}</b> · Estado:{" "}
                <b>{safe(selected.status)}</b>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-xs font-semibold text-slate-700">Fecha</div>
                <div>{format(new Date(selected.start_at), "dd-MM-yyyy")}</div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-semibold text-slate-700">Horario</div>
                <div>
                  {format(new Date(selected.start_at), "HH:mm")} →{" "}
                  {format(new Date(selected.end_at), "HH:mm")}
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-semibold text-slate-700">Edificio</div>
                <div>{safe(selected.building_name)}</div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-semibold text-slate-700">Cliente (id)</div>
                <div className="break-all">{safe(selected.client_id)}</div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-semibold text-slate-700">Técnico (id)</div>
                <div className="break-all">{safe(selected.technician_id)}</div>
              </div>

              {selected.is_external ? (
                <div className="rounded-md border p-3">
                  <div className="text-xs font-semibold text-slate-700">Externo</div>
                  <div>{safe(selected.external_personnel_name)}</div>
                </div>
              ) : null}
            </div>

            <button
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
              onClick={() => setSelected(null)}
            >
              Limpiar selección
            </button>
          </div>
        )}
      </div>
    </div>
  );
}