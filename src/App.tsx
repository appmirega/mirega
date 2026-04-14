import { useEffect, useState } from "react";
import { useAuth } from "./contexts/AuthContext";
import { LoginPage } from "./components/LoginPage";
import { SplashScreen } from "./components/SplashScreen";
import { Layout } from "./components/Layout";

import { UserProfile } from "./components/UserProfile";

import { AdminDashboard } from "./components/dashboards/AdminDashboard";
import { TechnicianDashboard } from "./components/dashboards/TechnicianDashboard";
import { ClientDashboard } from "./components/dashboards/ClientDashboard";

import { AdminMaintenancesDashboard } from "./components/views/AdminMaintenancesDashboard";
import AdminCalendarDashboard from "./components/views/AdminCalendarDashboard";
import TechnicianCalendarView from "./components/views/TechnicianCalendarView";
import { TechnicianMaintenanceChecklistView } from "./components/views/TechnicianMaintenanceChecklistView";
import { TechnicianEmergencyView } from "./components/views/TechnicianEmergencyView";
import { AdminEmergenciesDashboard } from "./components/views/AdminEmergenciesDashboard";
import { ServiceRequestsDashboard } from "./components/views/ServiceRequestsDashboard";
import { WorkOrdersView } from "./components/views/WorkOrdersView";
import { TechnicianWorkOrdersView } from "./components/views/TechnicianWorkOrdersView";
import { ElevatorsCompleteView } from "./components/views/ElevatorsCompleteView";

import { ExecutiveSummaryView } from "./components/views/ExecutiveSummaryView";
import { CommercialAnalysisView } from "./components/views/CommercialAnalysisView";
import { OperationalAnalysisView } from "./components/views/OperationalAnalysisView";
import { CostAnalysisView } from "./components/views/CostAnalysisView";
import { AuditLogView } from "./components/views/AuditLogView";
import { UsersView } from "./components/views/UsersView";
import { ClientsView } from "./components/views/ClientsView";
import { ManualsView } from "./components/views/ManualsView";
import { AdminPermissionsPanel } from "./components/views/AdminPermissionsPanel";
import { DeveloperPermissionsPanel } from "./components/views/DeveloperPermissionsPanel";
import { ClientTechnicalInfoView } from "./components/views/ClientTechnicalInfoView";

import { useViewPermissions } from "./hooks/useViewPermissions";
import { isManagedView } from "./utils/viewPermissions";

import TechnicianClientTechnicalView from "./components/views/TechnicianClientTechnicalView";
import { TestsBrakesView } from "./components/tests/TestsBrakesView";
import { TestsLimiterView } from "./components/tests/TestsLimiterView";
import { TestsCablesView } from "./components/tests/TestsCablesView";

function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [viewKey, setViewKey] = useState(0);
  const [showSplash, setShowSplash] = useState(true);

  const { user, profile, loading } = useAuth();
  const {
    canAccessView,
    loading: permissionsLoading,
  } = useViewPermissions();

  const handleNavigate = (path: string) => {
    setCurrentView(path);
    setViewKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (!profile || permissionsLoading) return;

    if (isManagedView(currentView) && !canAccessView(currentView)) {
      if (canAccessView("dashboard")) {
        setCurrentView("dashboard");
      }
    }
  }, [profile, permissionsLoading, currentView, canAccessView]);

  if (loading || showSplash || permissionsLoading) {
    return (
      <SplashScreen
        onComplete={() => setShowSplash(false)}
        minDuration={3500}
      />
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  let content: React.ReactNode;

  switch (currentView) {
    case "dashboard":
      if (profile?.role === "admin") {
        content = <AdminDashboard onNavigate={handleNavigate} />;
      } else if (profile?.role === "technician") {
        content = <TechnicianDashboard onNavigate={handleNavigate} />;
      } else {
        content = <ClientDashboard onNavigate={handleNavigate} />;
      }
      break;

    case "profile":
      content = <UserProfile />;
      break;

    case "calendar":
      if (profile?.role === "admin") {
        content = <AdminCalendarDashboard onNavigate={handleNavigate} />;
      } else {
        content = <TechnicianCalendarView />;
      }
      break;

    case "maintenance-checklist":
      content =
        profile?.role === "technician" ? (
          <TechnicianMaintenanceChecklistView />
        ) : (
          <AdminMaintenancesDashboard />
        );
      break;

    case "technical-tests-cables":
      content = (
        <TestsCablesView
          title="Prueba de Cables"
          onBack={() => handleNavigate("maintenance-checklist")}
        />
      );
      break;

    case "technical-tests-brakes":
      content = (
        <TestsBrakesView
          title="Prueba de Frenos"
          onBack={() => handleNavigate("maintenance-checklist")}
        />
      );
      break;

    case "technical-tests-limiter":
      content = (
        <TestsLimiterView
          title="Prueba de Limitador"
          onBack={() => handleNavigate("maintenance-checklist")}
        />
      );
      break;

    case "service-requests":
    case "solicitudes-servicio":
    case "serviceRequests":
      content = <ServiceRequestsDashboard />;
      break;

    case "emergencies":
      content =
        profile?.role === "technician" ? (
          <TechnicianEmergencyView />
        ) : (
          <AdminEmergenciesDashboard />
        );
      break;

    case "work-orders":
      content =
        profile?.role === "technician" ? (
          <TechnicianWorkOrdersView />
        ) : (
          <WorkOrdersView />
        );
      break;

    case "elevators":
      if (profile?.role === "technician") {
        content = <TechnicianClientTechnicalView />;
      } else {
        content = <ElevatorsCompleteView onNavigate={handleNavigate} />;
      }
      break;

    case "statistics":
      content = <ExecutiveSummaryView />;
      break;

    case "risk-backlog":
      content = <OperationalAnalysisView />;
      break;

    case "value-opportunities":
      content = <CommercialAnalysisView />;
      break;

    case "roi-calculator":
      content = <CostAnalysisView />;
      break;

    case "audit-logs":
      content = <AuditLogView />;
      break;

    case "users":
      content = <UsersView />;
      break;

    case "clients":
      content = <ClientsView />;
      break;

    case "manuals":
      content = <ManualsView />;
      break;

    case "developer-permissions":
      content = <DeveloperPermissionsPanel />;
      break;

    case "admin-permissions":
      content = <AdminPermissionsPanel />;
      break;

    case "client-technical-info":
      content = <ClientTechnicalInfoView />;
      break;

    default:
      content = <div className="p-6">Vista no encontrada</div>;
  }

  return (
    <Layout onNavigate={handleNavigate} currentView={currentView}>
      <div key={viewKey}>{content}</div>
    </Layout>
  );
}

export default App;