import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { AdminMaintenancesDashboard } from "./components/views/AdminMaintenancesDashboard";
import AdminCalendarDashboard from "./components/views/AdminCalendarDashboard";
import TechnicianCalendarView from "./components/views/TechnicianCalendarView";
import { TechnicianMaintenanceChecklistView } from "./components/views/TechnicianMaintenanceChecklistView";
import { TechnicianDashboard } from "./components/dashboards/TechnicianDashboard";

function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta base para evitar pantalla en blanco */}
        <Route path="/" element={<Navigate to="/technician/calendar" replace />} />

        {/* ADMIN */}
        <Route
          path="/admin/maintenances"
          element={<AdminMaintenancesDashboard />}
        />
        <Route
          path="/admin/calendar"
          element={<AdminCalendarDashboard />}
        />

        {/* TECHNICIAN */}
        <Route
          path="/technician/dashboard"
          element={<TechnicianDashboard />}
        />
        <Route
          path="/technician/calendar"
          element={<TechnicianCalendarView />}
        />
        <Route
          path="/technician/checklist"
          element={<TechnicianMaintenanceChecklistView />}
        />

        {/* Fallback para cualquier ruta no encontrada */}
        <Route path="*" element={<Navigate to="/technician/calendar" replace />} />
      </Routes>
    </Router>
  );
}

export default App;