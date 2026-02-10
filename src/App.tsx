import { AdminMaintenancesDashboard } from './components/views/AdminMaintenancesDashboard';
import { TechnicianMaintenanceChecklistView } from './components/views/TechnicianMaintenanceChecklistView';
import { TechnicianDashboard } from './components/dashboards/TechnicianDashboard';
import { TechnicianEmergencyView } from './components/views/TechnicianEmergencyView';
import { ServiceRequestsDashboard } from './components/views/ServiceRequestsDashboard';
import { UserProfile } from './components/UserProfile';
import { MaintenanceCalendarView } from './components/calendar/MaintenanceCalendarView';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
    // Si el usuario es admin y navega a 'maintenance-checklist', mostrar el dashboard de gestión
    if (profile?.role === 'admin' && path === 'maintenance-checklist') {
      setCurrentView('admin-maintenance-dashboard');
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
  if (currentView === 'dashboard') {
    // Atajos rápidos
    if (profile?.role === 'admin') {
      content = <AdminDashboard />;
    } else if (profile?.role === 'technician') {
      content = <TechnicianDashboard />;
    } else if (profile?.role === 'client') {
      content = <div className="text-center py-12">La vista de atajos para cliente está en desarrollo.</div>;
    } else {
      content = <div className="text-center py-12"><p className="text-slate-600">Rol no reconocido</p></div>;
    }
  } else if (currentView === 'calendar') {
    // Calendario integral
    if (profile?.role === 'admin') {
      content = <MaintenanceCalendarView />;
    } else {
      content = <div className="text-center py-12">Vista de calendario no disponible para este rol.</div>;
    }
  } else if (currentView === 'maintenance-checklist') {
    // Mantenimientos
    if (profile?.role === 'technician') {
      content = <TechnicianMaintenanceChecklistView />;
    } else if (profile?.role === 'admin') {
      content = <AdminMaintenancesDashboard />;
    } else {
      content = <div className="text-center py-12">Vista de mantenimientos no disponible para este rol.</div>;
    }
  } else if (currentView === 'emergencies') {
    // Emergencias
    if (profile?.role === 'technician') {
      content = <TechnicianEmergencyView />;
    } else {
      content = <div className="text-center py-12">Vista de emergencias no disponible para este rol.</div>;
    }
  } else if (currentView === 'service-requests') {
    // Solicitudes de servicio
    if (profile?.role === 'technician') {
      content = <ServiceRequestsDashboard />;
    } else {
      content = <div className="text-center py-12">Vista de solicitudes de servicio no disponible para este rol.</div>;
    }
  } else if (currentView === 'profile') {
    content = <UserProfile />;
  } else {
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
