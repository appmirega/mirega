import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Calendar as RBCalendar, dateFnsLocalizer, Views, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { supabase } from "../../lib/supabase";

// ✅ helper: lazy para módulos con export nombrado
function lazyNamed<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  exportName: string
) {
  return React.lazy(async () => {
    const mod = await factory();
    return { default: mod[exportName] as T };
  });
}

/** ✅ Carga perezosa de herramientas (no rompen el arranque del dashboard) */
const MaintenanceCalendarView = lazyNamed(
  () => import("../calendar/MaintenanceCalendarView"),
  "MaintenanceCalendarView"
);
const MaintenanceMassPlannerV2 = lazyNamed(
  () => import("../calendar/MaintenanceMassPlannerV2"),
  "MaintenanceMassPlannerV2"
);
const EmergencyShiftScheduler = lazyNamed(
  () => import("../calendar/EmergencyShiftScheduler"),
  "EmergencyShiftScheduler"
);
const EmergencyShiftsMonthlyView = lazyNamed(
  () => import("../calendar/EmergencyShiftsMonthlyView"),
  "EmergencyShiftsMonthlyView"
);
const CoordinationRequestsPanel = lazyNamed(
  () => import("../calendar/CoordinationRequestsPanel"),
  "CoordinationRequestsPanel"
);
const TechnicianAbsenceForm = lazyNamed(
  () => import("../calendar/TechnicianAbsenceForm"),
  "TechnicianAbsenceForm"
);

// wrapper (archivo nuevo) para dar props correctas a TechnicianAvailabilityPanel
const AdminTechnicianAvailabilityTool = lazyNamed(
  () => import("../calendar/AdminTechnicianAvailabilityTool"),
  "AdminTechnicianAvailabilityTool"
);

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

/** ✅ ErrorBoundary local (así no creas otro archivo extra) */
class ToolErrorBoundary extends React.Component<
  { onReset: () => void; children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }

  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: err?.message || "Error en herramienta" };
  }

  componentDidCatch(err: any) {
    console.error("[AdminCalendarDashboard] Tool crashed:", err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-800">La herramienta falló</div>
          <div className="mt-1 text-sm text-red-700">{this.state.message}</div>
          <button
            className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => {
              this.setState({ hasError: false, message: undefined });
              this.props.onReset();
            }}
          >
            Volver al resumen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type TabId =
  | "summary"
  | "maintenance_calendar"
  | "mass_planner"
  | "emergency_scheduler"
  | "emergency_monthly"
  | "coordination"
  | "availability"
  | "absence";

export default function AdminCalendarDashboard({ onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = window.localStorage.getItem("mirega_admin_calendar_tab") as TabId | null;
    return saved ?? "summary";
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  const [emergencyShifts, setEmergencyShifts] = useState<EmergencyShift[]>([]);
  const [emergencyVisits, setEmergencyVisits] = useState<EmergencyVisit[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRow[]>([]);

  const monthStart = useMemo(
    () => format(startOfMonth(selectedDate), "yyyy-MM-dd"),
    [selectedDate]
  );
  const monthEnd = useMemo(() => format(endOfMonth(selectedDate), "yyyy-MM-dd"), [selectedDate]);

  const go = (path: string) => {
    if (onNavigate) onNavigate(path);
  };

  useEffect(() => {
    window.localStorage.setItem("mirega_admin_calendar_tab", activeTab);
  }, [activeTab]);

  const events: Event[] = useMemo(() => {
    const out: Event[] = [];

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

    for (const v of emergencyVisits) {
      const start = toDate(v.visit_date, v.start_time) ?? toDate(v.visit_date, "00:00");
      const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
      if (!start || !end) continue;

      out.push({
        title: `Emergencia: visita`,
        start,
        end,
        allDay: false,
        resource: { kind: "visit", id: v.id, emergency_id: v.emergency_id },
      });
    }

    for (const e of calendarEvents) {
      const start = toDate(e.date, e.start_time) ?? toDate(e.date, "00:00");
      const end =
        toDate(e.date, e.end_time) ?? (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);
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
      const { data: shiftData, error: shiftError } = await supabase
        .from("emergency_shifts")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      if (shiftError) throw shiftError;
      setEmergencyShifts((shiftData as any[]) || []);

      const { data: visitData, error: visitError } = await supabase
        .from("emergency_visits")
        .select("*")
        .gte("visit_date", monthStart)
        .lte("visit_date", monthEnd);

      if (visitError) throw visitError;
      setEmergencyVisits((visitData as any[]) || []);

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
    // solo cargar resumen cuando estás en tab resumen
    if (activeTab === "summary") loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, monthStart, monthEnd]);

  const TabButton = ({
    id,
    label,
  }: {
    id: TabId;
    label: string;
  }) => (
    <button
      className={`rounded-md px-3 py-2 text-sm font-medium ${
        activeTab === id
          ? "bg-slate-900 text-white"
          : "border bg-white text-slate-700 hover:bg-slate-50"
      }`}
      onClick={() => setActiveTab(id)}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Gestión de Calendario (Admin)</h1>
          <p className="text-sm text-slate-500">
            {activeTab === "summary"
              ? loading
                ? "Cargando..."
                : "Resumen mensual de turnos, visitas y eventos."
              : "Herramientas de planificación y coordinación."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => go("emergencies")}
            type="button"
          >
            Programar emergencia
          </button>
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => go("maintenance-checklist")}
            type="button"
          >
            Programar mantenimiento
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
            onClick={() => go("service-requests")}
            type="button"
          >
            Ver solicitudes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton id="summary" label="Resumen" />
        <TabButton id="maintenance_calendar" label="Mantenimiento" />
        <TabButton id="mass_planner" label="Planner masivo" />
        <TabButton id="emergency_scheduler" label="Turnos emergencia" />
        <TabButton id="emergency_monthly" label="Emergencias mensual" />
        <TabButton id="coordination" label="Coordinación" />
        <TabButton id="availability" label="Disponibilidad técnicos" />
        <TabButton id="absence" label="Ausencias" />
      </div>

      {/* Content */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border bg-white p-2">
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
              onNavigate={(d) => setSelectedDate(d)}
              popup
              style={{ height: 720 }}
              onSelectEvent={(ev) => {
                const kind = (ev as any)?.resource?.kind;
                if (kind === "shift" || kind === "visit") go("emergencies");
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
                          {s.date} {s.start_time}-{s.end_time}
                        </div>
                        <div className="text-sm text-slate-600">
                          {s.technician_name || "Técnico sin nombre"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Visitas de emergencia</h3>
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
                        <div className="text-sm font-medium">
                          {v.visit_date} {v.start_time}
                        </div>
                        <div className="text-sm text-slate-600">Emergencia #{String(v.emergency_id ?? "")}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {activeTab !== "summary" && (
        <ToolErrorBoundary onReset={() => setActiveTab("summary")}>
          <Suspense
            fallback={
              <div className="rounded-lg border bg-white p-4 text-sm text-slate-600">
                Cargando herramienta...
              </div>
            }
          >
            <div className="rounded-lg border bg-white p-3">
              {activeTab === "maintenance_calendar" && <MaintenanceCalendarView />}
              {activeTab === "mass_planner" && <MaintenanceMassPlannerV2 />}
              {activeTab === "emergency_scheduler" && <EmergencyShiftScheduler />}
              {activeTab === "emergency_monthly" && <EmergencyShiftsMonthlyView />}
              {activeTab === "coordination" && <CoordinationRequestsPanel />}
              {activeTab === "availability" && <AdminTechnicianAvailabilityTool />}
              {activeTab === "absence" && <TechnicianAbsenceForm />}
            </div>
          </Suspense>
        </ToolErrorBoundary>
      )}
    </div>
  );
}