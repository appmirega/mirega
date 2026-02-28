import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, Views, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { supabase } from "../../lib/supabase";

type Props = {
  onNavigate?: (path: string) => void;
};

type EmergencyShift = {
  id: string | number;
  date?: string;
  start_time?: string;
  end_time?: string;
  technician_name?: string;
};

type EmergencyVisit = {
  id: string | number;
  emergency_id?: string | number;
  visit_date?: string;
  start_time?: string;
};

type CalendarEventRow = {
  id: string | number;
  title?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  type?: string;
};

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

function toDate(dateStr?: string, timeStr?: string) {
  // dateStr: YYYY-MM-DD
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;

  let hh = 0;
  let mm = 0;
  if (timeStr && typeof timeStr === "string") {
    const parts = timeStr.split(":");
    hh = Number(parts[0] ?? 0);
    mm = Number(parts[1] ?? 0);
  }

  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export default function AdminCalendarDashboard({ onNavigate }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  const [emergencyShifts, setEmergencyShifts] = useState<EmergencyShift[]>([]);
  const [emergencyVisits, setEmergencyVisits] = useState<EmergencyVisit[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRow[]>([]);

  const monthStart = useMemo(() => format(startOfMonth(selectedDate), "yyyy-MM-dd"), [selectedDate]);
  const monthEnd = useMemo(() => format(endOfMonth(selectedDate), "yyyy-MM-dd"), [selectedDate]);

  const go = (path: string) => {
    if (onNavigate) onNavigate(path);
  };

  const events: Event[] = useMemo(() => {
    const out: Event[] = [];

    // Turnos de emergencia
    for (const s of emergencyShifts) {
      const start = toDate(s.date, s.start_time) ?? toDate(s.date, "00:00");
      const end = toDate(s.date, s.end_time) ?? start;
      if (!start || !end) continue;

      out.push({
        title: `Turno Emergencia${s.technician_name ? `: ${s.technician_name}` : ""}`,
        start,
        end,
        allDay: false,
        resource: { kind: "shift", id: s.id },
      });
    }

    // Visitas de emergencia
    for (const v of emergencyVisits) {
      const start = toDate(v.visit_date, v.start_time) ?? toDate(v.visit_date, "00:00");
      const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null; // 1h
      if (!start || !end) continue;

      out.push({
        title: `Emergencia: visita`,
        start,
        end,
        allDay: false,
        resource: { kind: "visit", id: v.id, emergency_id: v.emergency_id },
      });
    }

    // Eventos calendario
    for (const e of calendarEvents) {
      const start = toDate(e.date, e.start_time) ?? toDate(e.date, "00:00");
      const end = toDate(e.date, e.end_time) ?? (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);
      if (!start || !end) continue;

      out.push({
        title: e.title ?? "Evento",
        start,
        end,
        allDay: false,
        resource: { kind: "event", id: e.id, type: e.type },
      });
    }

    return out;
  }, [emergencyShifts, emergencyVisits, calendarEvents]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // 1) Turnos emergencia
      const { data: shiftData, error: shiftError } = await supabase
        .from("emergency_shifts")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      if (shiftError) throw shiftError;
      setEmergencyShifts((shiftData as any[]) || []);

      // 2) Visitas emergencia
      const { data: visitData, error: visitError } = await supabase
        .from("emergency_visits")
        .select("*")
        .gte("visit_date", monthStart)
        .lte("visit_date", monthEnd);

      if (visitError) throw visitError;
      setEmergencyVisits((visitData as any[]) || []);

      // 3) Eventos calendario
      const { data: calData, error: calError } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      if (calError) throw calError;
      setCalendarEvents((calData as any[]) || []);
    } catch (err) {
      console.error("[calendar] loadAll error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, monthEnd]);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Gestión de Calendario</h1>
          <p className="text-sm text-slate-500">
            {loading ? "Cargando..." : "Turnos, visitas y eventos del mes."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => go("emergencies")}
          >
            Programar emergencia
          </button>
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => go("maintenance-checklist")}
          >
            Programar mantenimiento
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
            onClick={() => go("service-requests")}
          >
            Ver solicitudes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border bg-white p-2">
          <Calendar
            localizer={localizer}
            culture="es"
            messages={messagesES as any}
            events={events}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            defaultView={Views.MONTH}
            startAccessor="start"
            endAccessor="end"
            date={selectedDate}
            onNavigate={(d) => setSelectedDate(d)}
            popup
            style={{ height: 720 }}
            onSelectEvent={(ev) => {
              // Si quieres navegar según el tipo de evento:
              const kind = (ev as any)?.resource?.kind;
              if (kind === "shift" || kind === "visit") go("emergencies");
              if (kind === "event") {
                // aquí podrías decidir a dónde ir según type
              }
            }}
          />
        </div>

        <aside className="rounded-lg border bg-white p-3">
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Turnos de emergencia</h3>
              {emergencyShifts.length === 0 ? (
                <p className="text-sm text-slate-500">No hay turnos en este mes.</p>
              ) : (
                <ul className="space-y-2">
                  {emergencyShifts.slice(0, 6).map((s) => (
                    <li
                      key={String(s.id)}
                      className="cursor-pointer rounded-md border p-2 hover:bg-slate-50"
                      onClick={() => go("emergencies")}
                    >
                      <div className="text-sm font-medium">
                        {s.date ?? "—"} {s.start_time ? `• ${s.start_time}` : ""}
                      </div>
                      <div className="text-xs text-slate-500">{s.technician_name ?? "Técnico"}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Emergencias (visitas)</h3>
              {emergencyVisits.length === 0 ? (
                <p className="text-sm text-slate-500">No hay visitas en este mes.</p>
              ) : (
                <ul className="space-y-2">
                  {emergencyVisits.slice(0, 6).map((v) => (
                    <li
                      key={String(v.id)}
                      className="cursor-pointer rounded-md border p-2 hover:bg-slate-50"
                      onClick={() => go("emergencies")}
                    >
                      <div className="text-sm font-medium">Emergencia: {String(v.emergency_id ?? "—")}</div>
                      <div className="text-xs text-slate-500">
                        {v.visit_date ?? "—"} {v.start_time ? `• ${v.start_time}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}