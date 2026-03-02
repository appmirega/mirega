import React, { Suspense, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";

import { SummaryMonthView } from "../../features/scheduling/ui/SummaryMonthView";
import { CoordinationServiceRequestsTab } from "../../features/scheduling/ui/CoordinationServiceRequestsTab";

function lazyNamed<T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  exportName: string
) {
  return React.lazy(async () => {
    const mod = await factory();
    return { default: mod[exportName] as T };
  });
}

const MaintenanceMassPlannerV2 = lazyNamed(
  () => import("../calendar/MaintenanceMassPlannerV2"),
  "MaintenanceMassPlannerV2"
);

const EmergencyShiftScheduler = lazyNamed(
  () => import("../calendar/EmergencyShiftScheduler"),
  "EmergencyShiftScheduler"
);

const TechnicianAbsenceForm = lazyNamed(
  () => import("../calendar/TechnicianAbsenceForm"),
  "TechnicianAbsenceForm"
);

const AdminTechnicianAvailabilityTool = lazyNamed(
  () => import("../calendar/AdminTechnicianAvailabilityTool"),
  "AdminTechnicianAvailabilityTool"
);

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

type TabId =
  | "summary"
  | "mass_planner"
  | "emergency_scheduler"
  | "coordination"
  | "availability"
  | "absence";

export default function AdminCalendarDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("summary");

  // Producción:
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Si quieres probar con un mes específico (ej: marzo 2026), descomenta:
  // const [selectedDate, setSelectedDate] = useState(new Date("2026-03-01"));

  const monthStart = useMemo(
    () => format(startOfMonth(selectedDate), "yyyy-MM-dd"),
    [selectedDate]
  );

  const monthEnd = useMemo(
    () => format(endOfMonth(selectedDate), "yyyy-MM-dd"),
    [selectedDate]
  );

  const TabButton = ({ id, label }: { id: TabId; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`rounded-md px-3 py-2 text-sm ${
        activeTab === id ? "bg-slate-900 text-white" : "border bg-white text-slate-700"
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
          Resumen maestro (read-only) + herramientas de gestión.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton id="summary" label="Resumen (maestro)" />
        <TabButton id="mass_planner" label="Planner masivo" />
        <TabButton id="emergency_scheduler" label="Turnos emergencia" />
        <TabButton id="coordination" label="Coordinación (solicitudes)" />
        <TabButton id="availability" label="Disponibilidad técnicos" />
        <TabButton id="absence" label="Ausencias" />
      </div>

      {activeTab === "summary" && (
        <SummaryMonthView
          selectedDate={selectedDate}
          monthStart={monthStart}
          monthEnd={monthEnd}
          onNavigate={(d) => setSelectedDate(d)}
        />
      )}

      {activeTab !== "summary" && (
        <ToolErrorBoundary onReset={() => setActiveTab("summary")}>
          <Suspense fallback={<div className="text-sm text-slate-500">Cargando...</div>}>
            {activeTab === "mass_planner" && <MaintenanceMassPlannerV2 />}
            {activeTab === "emergency_scheduler" && <EmergencyShiftScheduler />}
            {activeTab === "coordination" && <CoordinationServiceRequestsTab />}
            {activeTab === "availability" && <AdminTechnicianAvailabilityTool />}
            {activeTab === "absence" && <TechnicianAbsenceForm />}
          </Suspense>
        </ToolErrorBoundary>
      )}
    </div>
  );
}