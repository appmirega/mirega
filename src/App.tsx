import { AdminMaintenancesDashboard } from './components/views/AdminMaintenancesDashboard';
import { TechnicianMaintenanceChecklistView } from './components/views/TechnicianMaintenanceChecklistView';
import { UserProfile } from './components/UserProfile';
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
    if (profile?.role === 'admin') {
      content = <AdminMaintenancesDashboard />;
    } else if (profile?.role === 'technician') {
      content = <TechnicianMaintenanceChecklistView />;
    } else if (profile?.role === 'client') {
      content = <div className="text-center py-12">La vista de mantenimientos para cliente está en desarrollo.</div>;
    } else {
      content = <div className="text-center py-12"><p className="text-slate-600">Rol no reconocido</p></div>;
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
