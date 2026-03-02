import React, { useMemo, useState } from "react";
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
  isWithinInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import type { CalendarEventRow } from "../domain/calendarEvent";
import { useMonthCalendarEvents } from "../hooks/useMonthCalendarEvents";
import { useMonthApprovedAbsences } from "../hooks/useMonthApprovedAbsences";

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
  monthEnd: string; // YYYY-MM-DD
  onNavigate: (d: Date) => void;
}) {
  const { selectedDate, monthStart, monthEnd, onNavigate } = props;

  // eventos (view consolidada)
  const { loading, rows, error } = useMonthCalendarEvents(monthStart, monthEnd);

  // ausencias aprobadas (tabla technician_availability)
  const abs = useMonthApprovedAbsences(monthStart, monthEnd);

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
    for (const r of rows) (s as any)[r.event_type] = ((s as any)[r.event_type] ?? 0) + 1;
    return s;
  }, [rows]);

  /**
   * Construye un set de días (YYYY-MM-DD) bloqueados por ausencias aprobadas.
   * Sombreamos el día si al menos 1 ausencia aprobada cubre la fecha.
   */
  const blockedDaysSet = useMemo(() => {
    const set = new Set<string>();

    if (!abs.rows?.length) return set;

    const monthInterval = {
      start: new Date(`${monthStart}T00:00:00`),
      end: new Date(`${monthEnd}T23:59:59`),
    };

    for (const a of abs.rows) {
      // Intersección de [a.start_date, a.end_date] con el intervalo del mes
      const aStart = new Date(`${a.start_date}T00:00:00`);
      const aEnd = new Date(`${a.end_date}T23:59:59`);

      // Si no se cruzan, saltar (igual ya filtramos en SQL, pero por seguridad)
      if (aEnd < monthInterval.start || aStart > monthInterval.end) continue;

      const clampStart = aStart < monthInterval.start ? monthInterval.start : aStart;
      const clampEnd = aEnd > monthInterval.end ? monthInterval.end : aEnd;

      const days = eachDayOfInterval({ start: clampStart, end: clampEnd });
      for (const d of days) set.add(format(d, "yyyy-MM-dd"));
    }

    return set;
  }, [abs.rows, monthStart, monthEnd]);

  const blockedDaysCount = blockedDaysSet.size;

  const eventPropGetter = (_event: CalEvent) => {
    const base = {
      borderRadius: "8px",
      border: "1px solid rgba(0,0,0,0.08)",
      padding: "2px 6px",
    } as React.CSSProperties;

    return { style: base };
  };

  /**
   * Sombreado de día: SOLO afecta la celda del día.
   * En month view, RBC llama dayPropGetter para cada celda.
   */
  const dayPropGetter = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");

    if (!blockedDaysSet.has(key)) return {};

    // Sombreado muy suave (bloqueo visual), sin romper lectura.
    return {
      style: {
        backgroundColor: "rgba(255, 0, 0, 0.06)",
      } as React.CSSProperties,
      className: "mirega-day-blocked",
    };
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

            <span className="rounded-full border bg-white px-2 py-1">
              Días bloqueados: <b>{blockedDaysCount}</b>
            </span>

            <span className="rounded-full border bg-white px-2 py-1">
              Ausencias aprobadas: <b>{abs.rows.length}</b>
              {abs.error ? <span className="ml-1 text-red-600">({abs.error})</span> : null}
            </span>
          </div>
        </div>

        <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: "rgba(255, 0, 0, 0.06)", border: "1px solid rgba(0,0,0,0.08)" }}
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
          eventPropGetter={eventPropGetter as any}
          dayPropGetter={dayPropGetter as any}
        />
      </div>

      {/* Side panel */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-base font-semibold">Detalle</div>

        {!selected ? (
          <div className="space-y-2 text-sm text-slate-600">
            <div>Haz click en un evento del calendario para ver los detalles.</div>

            {/* Extra útil: si hoy cae en un día bloqueado */}
            <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
              <div className="font-semibold">Tip</div>
              <div>
                El sombreado rojo claro indica días con ausencias aprobadas. El planner
                se bloqueará en la siguiente mejora.
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