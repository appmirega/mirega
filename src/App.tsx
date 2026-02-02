import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { SplashScreen } from './components/SplashScreen';
import { Layout } from './components/Layout';
import DeveloperDashboard from './components/dashboards/DeveloperDashboard';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { TechnicianDashboard } from './components/dashboards/TechnicianDashboard';
import { ClientDashboard } from './components/dashboards/ClientDashboard';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewKey, setViewKey] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const { user, profile, loading } = useAuth();

  const handleNavigate = (path) => {
    setCurrentView(path);
    setViewKey((prev) => prev + 1);
  };

  if (loading || showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} minDuration={3500} />;
  }
  if (!user) {
    return <LoginPage />;
  }

  let content;
  switch (currentView) {
    case 'dashboard':
      switch (profile?.role) {
        case 'developer':
          content = <DeveloperDashboard />;
          break;
        case 'admin':
          content = <AdminDashboard onNavigate={handleNavigate} />;
          break;
        case 'technician':
          content = <TechnicianDashboard onNavigate={handleNavigate} />;
          break;
        case 'client':
          content = <ClientDashboard onNavigate={handleNavigate} />;
          break;
        default:
          content = <div className="text-center py-12"><p className="text-slate-600">Rol no reconocido</p></div>;
      }
      break;
    case 'maintenance-calendar':
      content = <MaintenanceCalendarView />;
      break;
    case 'manuals':
      content = <ManualsView />;
      break;
    case 'maintenance-checklist':
      content = <TechnicianMaintenanceChecklistView />;
      break;
    case 'emergencies':
      content = <EmergencyV2View />;
      break;
    case 'work-orders':
      content = <WorkOrdersView />;
      break;
    case 'elevators':
      content = <BulkOperationsView />;
      break;
    case 'statistics':
      content = <StatisticsView />;
      break;
    case 'audit-logs':
      content = <AuditLogView />;
      break;
    case 'client-maintenances':
      content = <BulkOperationsView />;
      break;
    case 'client-service-requests':
      content = <BulkOperationsView />;
      break;
    case 'client-emergencies':
      content = <ClientEmergenciesView />;
      break;
    case 'rescue-training':
      content = <RescueTrainingView />;
      break;
    case 'carpeta-cero':
      content = <CarpetaCeroView />;
      break;
    case 'users':
      content = <BulkOperationsView />;
      break;
    case 'clients':
      content = <BulkOperationsView />;
      break;
    case 'qr-codes-complete':
      content = <QRCodesCompleteView />;
      break;
    case 'developer-permissions':
      content = <BulkOperationsView />;
      break;
    case 'admin-permissions':
      content = <BulkOperationsView />;
      break;
    case 'settings':
      content = <BulkOperationsView />;
      break;
    case 'profile':
      content = <UserProfile />;
      break;
    default:
      content = <div>Vista no implementada o importación faltante</div>;
  }

  return (
    <Layout onNavigate={handleNavigate} currentView={currentView}>
      <div key={viewKey}>{content}</div>
    </Layout>
  );
}

export default function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
