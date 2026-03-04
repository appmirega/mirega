import { useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";

import { SummaryMonthView } from "../../features/scheduling/ui/SummaryMonthView";
import { CoordinationServiceRequestsTab } from "../../features/scheduling/ui/CoordinationServiceRequestsTab";
import OtherAssignmentsPlannerTab from "../../features/scheduling/ui/OtherAssignmentsPlannerTab";

export default function AdminCalendarDashboard() {
  const [activeTab, setActiveTab] = useState<"summary" | "coordination" | "other_assignments">("summary");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const monthStart = format(startOfMonth(selectedDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedDate), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Calendario Operativo</h1>
        <p className="text-sm text-slate-500">
          Gestión de planificación mensual, coordinación y asignaciones.
        </p>
      </div>

      <div className="flex gap-2 border-b pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-3 py-2 text-sm rounded-lg ${
            activeTab === "summary" ? "bg-slate-900 text-white" : "bg-slate-100"
          }`}
        >
          Resumen mensual
        </button>

        <button
          onClick={() => setActiveTab("coordination")}
          className={`px-3 py-2 text-sm rounded-lg ${
            activeTab === "coordination" ? "bg-slate-900 text-white" : "bg-slate-100"
          }`}
        >
          Coordinación
        </button>

        <button
          onClick={() => setActiveTab("other_assignments")}
          className={`px-3 py-2 text-sm rounded-lg ${
            activeTab === "other_assignments" ? "bg-slate-900 text-white" : "bg-slate-100"
          }`}
        >
          Otras asignaciones
        </button>
      </div>

      {activeTab === "summary" && (
        <SummaryMonthView
          selectedDate={selectedDate}
          monthStart={monthStart}
          monthEnd={monthEnd}
          onNavigate={setSelectedDate}
        />
      )}

      {activeTab === "coordination" && <CoordinationServiceRequestsTab />}

      {activeTab === "other_assignments" && <OtherAssignmentsPlannerTab />}
    </div>
  );
}