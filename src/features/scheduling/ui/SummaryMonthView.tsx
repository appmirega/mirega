import React, { useMemo } from "react";
import {
  Calendar as RBCalendar,
  dateFnsLocalizer,
  Views,
  type Event,
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

function asDate(value: string) {
  return new Date(value);
}

function isAllDay(row: CalendarEventRow) {
  // Paso intermedio: mantención como all-day
  return row.event_type === "maintenance";
}

export function SummaryMonthView(props: {
  selectedDate: Date;
  monthStart: string; // YYYY-MM-DD
  monthEnd: string;   // YYYY-MM-DD
  onNavigate: (d: Date) => void;
}) {
  const { selectedDate, monthStart, monthEnd, onNavigate } = props;
  const { loading, rows, error } = useMonthCalendarEvents(monthStart, monthEnd);

  const events: Event[] = useMemo(() => {
    return rows.map((r) => ({
      title: r.title,
      start: asDate(r.start_at),
      end: asDate(r.end_at),
      allDay: isAllDay(r),
      resource: r,
    }));
  }, [rows]);

  return (
    <div className="rounded-lg border bg-white p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {loading ? "Cargando eventos..." : "Resumen maestro (solo lectura)"}
          {error ? <span className="ml-2 text-red-600">({error})</span> : null}
        </div>

        <div className="text-xs text-slate-500">
          Rango: {monthStart} → {monthEnd} · Eventos: {rows.length}
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
      />
    </div>
  );
}