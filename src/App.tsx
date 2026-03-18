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
import { StatisticsView } from "./components/views/StatisticsView";
import { UsersView } from "./components/views/UsersView";
import { ClientsView } from "./components/views/ClientsView";
import { ManualsView } from "./components/views/ManualsView";
import { AdminPermissionsPanel } from "./components/views/AdminPermissionsPanel";
import { DeveloperPermissionsPanel } from "./components/views/DeveloperPermissionsPanel";
import { ClientTechnicalInfoView } from "./components/views/ClientTechnicalInfoView";
import { ClientEmergenciesView } from "./components/views/ClientEmergenciesView";
import { RescueTrainingView } from "./components/views/RescueTrainingView";
import { CarpetaCeroView } from "./components/views/CarpetaCeroView";
import { QRCodesCompleteView } from "./components/views/QRCodesCompleteView";

import { StoppedElevators } from "./components/emergency/StoppedElevators";
import { EmergencyHistory } from "./components/emergency/EmergencyHistory";
import { useViewPermissions } from "./hooks/useViewPermissions";
import { isManagedView } from "./utils/viewPermissions";

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
      } else if (canAccessView("profile")) {
        setCurrentView("profile");
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

  const renderAccessDenied = () => (
    <div className="py-12 text-center">
      <h2 className="text-xl font-semibold text-slate-900 mb-2">
        Vista deshabilitada
      </h2>
      <p className="text-slate-600">
        Esta vista no está habilitada para tu perfil.
      </p>
    </div>
  );

  let content: React.ReactNode;

  if (isManagedView(currentView) && !canAccessView(currentView)) {
    content = renderAccessDenied();
  } else {
    switch (currentView) {
      case "dashboard":
        if (profile?.role === "admin" || profile?.role === "developer") {
          content = <AdminDashboard onNavigate={handleNavigate} />;
        } else if (profile?.role === "technician") {
          content = <TechnicianDashboard onNavigate={handleNavigate} />;
        } else if (profile?.role === "client") {
          content = <ClientDashboard onNavigate={handleNavigate} />;
        } else {
          content = (
            <div className="py-12 text-center">
              <p className="text-slate-600">Rol no reconocido.</p>
            </div>
          );
        }
        break;

      case "profile":
        content = <UserProfile />;
        break;

      case "calendar":
        if (profile?.role === "admin" || profile?.role === "developer") {
          content = <AdminCalendarDashboard onNavigate={handleNavigate} />;
        } else if (profile?.role === "technician") {
          content = <TechnicianCalendarView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de calendario no disponible para este rol.
            </div>
          );
        }
        break;

      case "maintenance-checklist":
        if (profile?.role === "technician") {
          content = <TechnicianMaintenanceChecklistView />;
        } else if (profile?.role === "admin" || profile?.role === "developer") {
          content = (
            <AdminMaintenancesDashboard
              onNewMaintenance={() => handleNavigate("new-maintenance")}
            />
          );
        } else if (profile?.role === "client") {
          content = <ClientTechnicalInfoView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de mantenimientos no disponible para este rol.
            </div>
          );
        }
        break;

      case "new-maintenance":
        if (profile?.role === "admin" || profile?.role === "developer") {
          content = <TechnicianMaintenanceChecklistView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista no disponible para este rol.
            </div>
          );
        }
        break;

      case "service-requests":
        if (
          profile?.role === "admin" ||
          profile?.role === "developer" ||
          profile?.role === "technician"
        ) {
          content = <ServiceRequestsDashboard />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de solicitudes no disponible para este rol.
            </div>
          );
        }
        break;

      case "emergencies":
        if (profile?.role === "admin" || profile?.role === "developer") {
          content = <AdminEmergenciesDashboard />;
        } else if (profile?.role === "technician") {
          content = <TechnicianEmergencyView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de emergencias no disponible para este rol.
            </div>
          );
        }
        break;

      case "stopped-elevators":
        if (
          profile?.role === "technician" ||
          profile?.role === "admin" ||
          profile?.role === "developer"
        ) {
          content = (
            <StoppedElevators onBack={() => handleNavigate("emergencies")} />
          );
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de ascensores detenidos no disponible para este rol.
            </div>
          );
        }
        break;

      case "emergency-history":
        if (
          profile?.role === "technician" ||
          profile?.role === "admin" ||
          profile?.role === "developer"
        ) {
          content = (
            <EmergencyHistory onBack={() => handleNavigate("emergencies")} />
          );
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de historial de emergencias no disponible para este rol.
            </div>
          );
        }
        break;

      case "work-orders":
        if (profile?.role === "technician") {
          content = <TechnicianWorkOrdersView />;
        } else if (profile?.role === "admin" || profile?.role === "developer") {
          content = <WorkOrdersView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de órdenes de trabajo no disponible para este rol.
            </div>
          );
        }
        break;

      case "elevators":
        content = <ElevatorsCompleteView onNavigate={handleNavigate} />;
        break;

      case "statistics":
        if (profile?.role === "admin" || profile?.role === "developer") {
          content = <StatisticsView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de estadísticas no disponible para este rol.
            </div>
          );
        }
        break;

      case "users":
        if (profile?.role === "admin" || profile?.role === "developer") {
          content = <UsersView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de usuarios no disponible para este rol.
            </div>
          );
        }
        break;

      case "clients":
        if (profile?.role === "admin" || profile?.role === "developer") {
          content = <ClientsView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de clientes no disponible para este rol.
            </div>
          );
        }
        break;

      case "manuals":
        content = <ManualsView />;
        break;

      case "qr-codes-complete":
        if (profile?.role === "admin" || profile?.role === "developer") {
          content = <QRCodesCompleteView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de códigos QR no disponible para este rol.
            </div>
          );
        }
        break;

      case "admin-permissions":
        if (profile?.role === "admin") {
          content = <AdminPermissionsPanel />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de permisos no disponible para este rol.
            </div>
          );
        }
        break;

      case "developer-permissions":
        if (profile?.role === "developer") {
          content = <DeveloperPermissionsPanel />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista de permisos no disponible para este rol.
            </div>
          );
        }
        break;

      case "client-maintenances":
        if (profile?.role === "client") {
          content = <ClientTechnicalInfoView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista no disponible para este rol.
            </div>
          );
        }
        break;

      case "client-emergencies":
        if (profile?.role === "client") {
          content = <ClientEmergenciesView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista no disponible para este rol.
            </div>
          );
        }
        break;

      case "rescue-training":
        if (profile?.role === "client") {
          content = <RescueTrainingView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista no disponible para este rol.
            </div>
          );
        }
        break;

      case "carpeta-cero":
        if (profile?.role === "client") {
          content = <CarpetaCeroView />;
        } else {
          content = (
            <div className="py-12 text-center">
              Vista no disponible para este rol.
            </div>
          );
        }
        break;

      case "client-service-requests":
      case "risk-backlog":
      case "value-opportunities":
      case "roi-calculator":
      case "audit-logs":
      case "settings":
        content = (
          <div className="py-12 text-center text-slate-600">
            Esta vista aún no está conectada en App.tsx, pero la navegación global
            ya fue restaurada.
          </div>
        );
        break;

      default:
        content = (
          <div className="py-12 text-center text-red-600 font-semibold">
            Esta vista no está implementada. Selecciona una opción válida del menú.
          </div>
        );
        break;
    }
  }

  return (
    <Layout onNavigate={handleNavigate} currentView={currentView}>
      <div key={viewKey}>{content}</div>
    </Layout>
  );
}

export default App;