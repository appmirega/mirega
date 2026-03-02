import React, { useMemo, useState } from "react";
import {
  Calendar as RBCalendar,
  dateFnsLocalizer,
  Views,
  type Event as RBCEvent,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

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

function isAllDay(row: CalendarEventRow) {
  // Mantención como all-day (por ahora)
  return row.event_type === "maintenance";
}

function typeLabel(t: CalendarEventRow["event_type"]) {
  if (t === "maintenance") return "Mantención";
  if (t === "emergency_shift") return "Turno emergencia";
  return "Visita emergencia";
}

function safe(v: any) {
  return v == null || v === "" ? "—" : String(v);
}

export function SummaryMonthView(props: {
  selectedDate: Date;
  monthStart: string; // YYYY-MM-DD
  monthEnd: string;   // YYYY-MM-DD
  onNavigate: (d: Date) => void;
}) {
  const { selectedDate, monthStart, monthEnd, onNavigate } = props;
  const { loading, rows, error } = useMonthCalendarEvents(monthStart, monthEnd);

  const [selected, setSelected] = useState<CalendarEventRow | null>(null);

  const events: CalEvent[] = useMemo(() => {
    return rows.map((r) => ({
      title: r.title,
      start: asDate(r.start_at),
      end: asDate(r.end_at),
      allDay: isAllDay(r),
      resource: r,
    }));
  }, [rows]);

  const stats = useMemo(() => {
    const s = { maintenance: 0, emergency_shift: 0, emergency_visit: 0 };
    for (const r of rows) s[r.event_type] = (s as any)[r.event_type] + 1;
    return s;
  }, [rows]);

  const eventPropGetter = (event: CalEvent) => {
    const t = event.resource.event_type;
    // No fijamos colores globales, pero sí usamos clases inline leves (sin estilos raros)
    // Si quieres colores exactos, dime y lo dejamos fino.
    const base = {
      borderRadius: "8px",
      border: "1px solid rgba(0,0,0,0.08)",
      padding: "2px 6px",
    } as React.CSSProperties;

    if (t === "maintenance") return { style: { ...base } };
    if (t === "emergency_shift") return { style: { ...base } };
    return { style: { ...base } };
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
      {/* Calendar */}
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
          </div>
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
          eventPropGetter={eventPropGetter as any}
        />
      </div>

      {/* Side panel */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-base font-semibold">Detalle</div>

        {!selected ? (
          <div className="text-sm text-slate-600">
            Haz click en un evento del calendario para ver los detalles.
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