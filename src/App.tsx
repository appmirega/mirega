import { AdminMaintenancesDashboard } from './components/views/AdminMaintenancesDashboard';
import AdminCalendarDashboard from './components/views/AdminCalendarDashboard';
import { TechnicianCalendarView } from './components/views/TechnicianCalendarView';
import { TechnicianMaintenanceChecklistView } from './components/views/TechnicianMaintenanceChecklistView';
import { TechnicianDashboard } from './components/dashboards/TechnicianDashboard';
import { TechnicianEmergencyView } from './components/views/TechnicianEmergencyView';
import { AdminEmergenciesDashboard } from './components/views/AdminEmergenciesDashboard';
import { ServiceRequestsDashboard } from './components/views/ServiceRequestsDashboard';
import { UserProfile } from './components/UserProfile';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { SplashScreen } from './components/SplashScreen';
import { Layout } from './components/Layout';

function App() {
  console.log('[App.tsx] App montando...');
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewKey, setViewKey] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const { user, profile, loading } = useAuth();

  const handleNavigate = (path: string) => {
    // Para admin, el submenú 'Mantenimientos' debe mostrar la vista de mantenimientos admin
    if (profile?.role === 'admin' && path === 'maintenance-checklist') {
      setCurrentView('maintenance-checklist');
    } else {
      setCurrentView(path);
    }
    setViewKey((prev) => prev + 1);
  };

  if (loading || showSplash) {
    console.log('[App.tsx] Mostrando SplashScreen');
    return <SplashScreen onComplete={() => setShowSplash(false)} minDuration={3500} />;
  }
  if (!user) {
    console.log('[App.tsx] Mostrando LoginPage');
    return <LoginPage />;
  }

  let content;
  // Navegación estricta por rol y vista
  switch (currentView) {
    case 'dashboard':
      if (profile?.role === 'admin') {
        content = <AdminDashboard />;
      } else if (profile?.role === 'technician') {
        content = <TechnicianDashboard />;
      } else if (profile?.role === 'client') {
        content = <div className="text-center py-12">La vista de atajos para cliente está en desarrollo.</div>;
      } else {
        content = <div className="text-center py-12"><p className="text-slate-600">Rol no reconocido</p></div>;
      }
      break;
    case 'maintenance-checklist':
      if (profile?.role === 'technician') {
        content = <TechnicianMaintenanceChecklistView />;
      } else if (profile?.role === 'admin') {
        content = <AdminMaintenancesDashboard onNewMaintenance={() => setCurrentView('new-maintenance')} />;
      } else {
        content = <div className="text-center py-12">Vista de mantenimientos no disponible para este rol.</div>;
      }
      break;
    case 'new-maintenance':
      if (profile?.role === 'admin') {
        content = <TechnicianEmergencyView />;
      } else {
        content = <div className="text-center py-12">Vista de nueva mantención no disponible para este rol.</div>;
      }
      break;
    case 'emergencies':
      if (profile?.role === 'admin') {
        content = <AdminEmergenciesDashboard />;
      } else if (profile?.role === 'technician') {
        content = <TechnicianEmergencyView />;
      } else {
        content = <div className="text-center py-12">Vista de emergencias no disponible para este rol.</div>;
      }
      break;
    case 'service-requests':
      if (profile?.role === 'admin' || profile?.role === 'technician') {
        content = <ServiceRequestsDashboard />;
      } else {
        content = <div className="text-center py-12">Vista de solicitudes de servicio no disponible para este rol.</div>;
      }
      break;
    case 'calendar':
      if (profile?.role === 'admin') {
        content = <AdminCalendarDashboard />;
      } else if (profile?.role === 'technician') {
        content = <TechnicianCalendarView />;
      } else {
        content = <div className="text-center py-12">Vista de calendario no disponible para este rol.</div>;
      }
      break;
    case 'profile':
      content = <UserProfile />;
      break;
    default:
      content = <div className="text-center py-12 text-red-600 font-semibold">Esta vista no está implementada. Por favor, selecciona una opción válida del menú.</div>;
      break;
  }

  return (
    <Layout onNavigate={handleNavigate} currentView={currentView}>
      <div key={viewKey}>{content}</div>
    </Layout>
  );
}

export default App;
