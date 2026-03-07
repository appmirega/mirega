import React, { Suspense, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";

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

const EmergencyShiftsMonthlyView = lazyNamed(
  () => import("../calendar/EmergencyShiftsMonthlyView"),
  "EmergencyShiftsMonthlyView"
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
  constructor(props: { onReset: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[Calendar Tool Error]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-800">
            La herramienta presentó un error.
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
  | "emergency_monthly"
  | "coordination"
  | "availability"
  | "absence";

export default function AdminCalendarDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const monthStart = useMemo(
    () => format(startOfMonth(selectedDate), "yyyy-MM-dd"),
    [selectedDate]
  );

  const monthEnd = useMemo(
    () => format(endOfMonth(selectedDate), "yyyy-MM-dd"),
    [selectedDate]
  );

  const targetMonth = useMemo(
    () => format(startOfMonth(selectedDate), "yyyy-MM"),
    [selectedDate]
  );

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
          Centro de control operativo: resumen maestro + herramientas de gestión.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton id="summary" label="Resumen (maestro)" />
        <TabButton id="mass_planner" label="Planificador de mantenciones" />
        <TabButton id="emergency_scheduler" label="Turnos emergencia" />
        <TabButton id="emergency_monthly" label="Emergencias mensual" />
        <TabButton id="coordination" label="Coordinación (solicitudes)" />
        <TabButton id="availability" label="Disponibilidad técnicos" />
        <TabButton id="absence" label="Ausencias" />
      </div>

      {activeTab === "summary" && (
        <SummaryMonthView
          selectedDate={selectedDate}
          monthStart={monthStart}
          monthEnd={monthEnd}
          onNavigate={setSelectedDate}
        />
      )}

      {activeTab !== "summary" && (
        <ToolErrorBoundary onReset={() => setActiveTab("summary")}>
          <Suspense
            fallback={<div className="text-sm text-slate-500">Cargando...</div>}
          >
            {activeTab === "mass_planner" && <MaintenanceMassPlannerV2 />}
            {activeTab === "emergency_scheduler" && <EmergencyShiftScheduler />}
            {activeTab === "emergency_monthly" && (
              <EmergencyShiftsMonthlyView targetMonth={targetMonth} />
            )}
            {activeTab === "coordination" && <CoordinationServiceRequestsTab />}
            {activeTab === "availability" && <AdminTechnicianAvailabilityTool />}
            {activeTab === "absence" && <TechnicianAbsenceForm />}
          </Suspense>
        </ToolErrorBoundary>
      )}
    </div>
  );
}