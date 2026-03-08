import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AdminMaintenancesDashboard } from "./components/views/AdminMaintenancesDashboard";
import AdminCalendarDashboard from "./components/views/AdminCalendarDashboard";

import TechnicianCalendarView from "./components/views/TechnicianCalendarView";

import { TechnicianMaintenanceChecklistView } from "./components/views/TechnicianMaintenanceChecklistView";
import { TechnicianDashboard } from "./components/dashboards/TechnicianDashboard";

import Login from "./components/auth/Login";

function App() {
  return (
    <Router>
      <Routes>

        {/* Login */}
        <Route path="/" element={<Login />} />

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

      </Routes>
    </Router>
  );
}

export default App;