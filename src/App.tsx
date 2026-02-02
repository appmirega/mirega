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
  if (currentView === 'dashboard') {
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
    setCurrentView(path);

    setViewKey(prev => prev + 1);
