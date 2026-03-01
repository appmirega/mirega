import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Calendar as RBCalendar, dateFnsLocalizer, Views, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { supabase } from "../../lib/supabase";

/* =========================
   Lazy loader helper
========================= */
function lazyNamed<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  exportName: string
) {
  return React.lazy(async () => {
    const mod = await factory();
    return { default: mod[exportName] as T };
  });
}

/* =========================
   Lazy tools
========================= */
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

const AdminTechnicianAvailabilityTool = lazyNamed(
  () => import("../calendar/AdminTechnicianAvailabilityTool"),
  "AdminTechnicianAvailabilityTool"
);

/* =========================
   Calendar setup
========================= */
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
  const [y, m, d] = dateStr.split("-").map(Number);
  let hh = 0;
  let mm = 0;
  if (timeStr) {
    const parts = timeStr.split(":");
    hh = Number(parts[0] ?? 0);
    mm = Number(parts[1] ?? 0);
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/* =========================
   Error Boundary
========================= */
class ToolErrorBoundary extends React.Component<
  { onReset: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: any) {
    console.error("[Calendar Tool Error]", err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-800">
            La herramienta presentó un error
          </div>
          <button
            className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => {
              this.setState({ hasError: false });
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

/* =========================
   Component
========================= */
type TabId =
  | "summary"
  | "maintenance_calendar"
  | "mass_planner"
  | "emergency_scheduler"
  | "emergency_monthly"
  | "coordination"
  | "availability"
  | "absence";

export default function AdminCalendarDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const [emergencyShifts, setEmergencyShifts] = useState<any[]>([]);
  const [emergencyVisits, setEmergencyVisits] = useState<any[]>([]);

  const monthStart = useMemo(
    () => format(startOfMonth(selectedDate), "yyyy-MM-dd"),
    [selectedDate]
  );

  const monthEnd = useMemo(
    () => format(endOfMonth(selectedDate), "yyyy-MM-dd"),
    [selectedDate]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: shifts } = await supabase
        .from("emergency_shifts")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      const { data: visits } = await supabase
        .from("emergency_visits")
        .select("*")
        .gte("visit_date", monthStart)
        .lte("visit_date", monthEnd);

      setEmergencyShifts(shifts || []);
      setEmergencyVisits(visits || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "summary") loadAll();
  }, [activeTab, monthStart, monthEnd]);

  const events: Event[] = useMemo(() => {
    const result: Event[] = [];

    emergencyShifts.forEach((s) => {
      const start = toDate(s.date, s.start_time);
      const end = toDate(s.date, s.end_time);
      if (!start || !end) return;

      result.push({
        title: `Turno Emergencia`,
        start,
        end,
      });
    });

    emergencyVisits.forEach((v) => {
      const start = toDate(v.visit_date, v.start_time);
      if (!start) return;

      const end = new Date(start.getTime() + 60 * 60 * 1000);

      result.push({
        title: `Visita Emergencia`,
        start,
        end,
      });
    });

    return result;
  }, [emergencyShifts, emergencyVisits]);

  const TabButton = ({ id, label }: { id: TabId; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`rounded-md px-3 py-2 text-sm ${
        activeTab === id
          ? "bg-slate-900 text-white"
          : "border bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4">
      <div className="mb-3">
        <h1 className="text-xl font-semibold">Gestión de Calendario (Admin)</h1>
        <p className="text-sm text-slate-500">
          {loading ? "Cargando..." : "Resumen mensual de emergencias"}
        </p>
      </div>

      {/* TABS */}
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

      {/* CONTENIDO */}
      {activeTab === "summary" && (
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
            style={{ height: 700 }}
          />
        </div>
      )}

      {activeTab !== "summary" && (
        <ToolErrorBoundary onReset={() => setActiveTab("summary")}>
          <Suspense fallback={<div>Cargando herramienta...</div>}>
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