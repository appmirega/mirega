export default App;
import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { SplashScreen } from './components/SplashScreen';
import { Layout } from './components/Layout';
import DeveloperDashboard from './components/dashboards/DeveloperDashboard';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { TechnicianDashboard } from './components/dashboards/TechnicianDashboard';
import { ClientDashboard } from './components/dashboards/ClientDashboard';
import { UserProfile } from './components/UserProfile';
import { ManualsView } from './components/views/ManualsView';
import { MaintenanceCalendarView } from './components/calendar/MaintenanceCalendarView';
import { EmergencyV2View } from './components/views/EmergencyV2View';
import { WorkOrdersView } from './components/views/WorkOrdersView';
import { RoutesView } from './components/views/RoutesView';
import { QuotationsManagementView } from './components/views/QuotationsManagementView';
import { CertificationsDashboard } from './components/views/CertificationsDashboard';
import { PDFHistoryView } from './components/views/PDFHistoryView';
import { StatisticsView } from './components/views/StatisticsView';
import { AuditLogView } from './components/views/AuditLogView';
import { BulkOperationsView } from './components/views/BulkOperationsView';
import { ClientEmergenciesView } from './components/views/ClientEmergenciesView';
import { ClientQuotationsView } from './components/views/ClientQuotationsView';
import { CarpetaCeroView } from './components/views/CarpetaCeroView';
import { RescueTrainingView } from './components/views/RescueTrainingView';
import { MaintenanceCompleteView } from './components/views/MaintenanceCompleteView';
import { EmergencyHistoryCompleteView } from './components/views/EmergencyHistoryCompleteView';
import { QRCodesCompleteView } from './components/views/QRCodesCompleteView';
import { AdminRescueTrainingView } from './components/views/AdminRescueTrainingView';
import { TechnicianMaintenanceChecklistView } from './components/views/TechnicianMaintenanceChecklistView';

interface DashboardRouterProps {
  onNavigate?: (path: string) => void;
}

function DashboardRouter({ onNavigate }: DashboardRouterProps) {
  const { profile } = useAuth();
  if (!profile) return null;
  switch (profile.role) {
    case 'developer':
      return <DeveloperDashboard />;
    case 'admin':
      return <AdminDashboard onNavigate={onNavigate} />;
    case 'technician':
      return <TechnicianDashboard onNavigate={onNavigate} />;
    case 'client':
      return <ClientDashboard onNavigate={onNavigate} />;
    default:
      return (
        <div className="text-center py-12">
          <p className="text-slate-600">Rol no reconocido</p>
        </div>
      );
  }
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewKey, setViewKey] = useState(0);
  const [showSplash, setShowSplash] = useState(true);

  const handleNavigate = (path: string) => {
    setCurrentView(path);
    setViewKey(prev => prev + 1);
  };

  if (loading || showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} minDuration={3500} />;
  }
  if (!user) {
    return <LoginPage />;
  }
  const renderContent = () => {
    switch (currentView) {
      case 'profile':
        return <UserProfile />;
      case 'manuals':
        return <ManualsView />;
      case 'maintenance-calendar':
        return <MaintenanceCalendarView />;
      case 'maintenance':
        return <div>Mantenimiento: Vista no implementada o importación faltante</div>;
      case 'emergencies':
        return profile?.role === 'technician' ? <TechnicianMaintenanceChecklistView /> : <EmergencyV2View />;
      case 'client-emergencies':
        return <ClientEmergenciesView />;
      case 'work-orders':
        return profile?.role === 'technician' ? <TechnicianMaintenanceChecklistView /> : <WorkOrdersView />;
      case 'routes':
        return profile?.role === 'technician' ? <TechnicianMaintenanceChecklistView /> : <RoutesView />;
      case 'quotations':
        return <QuotationsManagementView />;
      case 'client-quotations':
        return <ClientQuotationsView />;
      case 'carpeta-cero':
        return <CarpetaCeroView />;
      case 'rescue-training':
        return <RescueTrainingView />;
      case 'rescue-training-admin':
        return <AdminRescueTrainingView />;
      case 'maintenance-checklist':
        return <TechnicianMaintenanceChecklistView />;
      case 'maintenance-history':
        return <TechnicianMaintenanceChecklistView initialMode="history" />;
      case 'maintenance-complete':
        return <MaintenanceCompleteView />;
      case 'maintenance-complete-view':
        return <MaintenanceCompleteView />;
      case 'emergency-history':
        return <EmergencyHistoryCompleteView />;
      case 'qr-codes-complete':
        return <QRCodesCompleteView />;
      case 'certifications':
        return <CertificationsDashboard />;
      case 'pdf-history':
        return <PDFHistoryView />;
      case 'statistics':
        return <StatisticsView />;
      case 'audit-logs':
        return <AuditLogView />;
      case 'bulk-operations':
        return <BulkOperationsView />;
      case 'notifications':
        return <BulkOperationsView />;
      case 'service-requests':
        return <BulkOperationsView />;
      case 'users':
        return <BulkOperationsView />;
      case 'clients':
        return <BulkOperationsView />;
      case 'elevators':
        return <BulkOperationsView />;
      case 'client-technical-info':
        return <BulkOperationsView />;
      case 'developer-permissions':
        return <BulkOperationsView />;
      case 'admin-permissions':
        return <BulkOperationsView />;
      case 'dashboard':
      default:
        return <DashboardRouter onNavigate={handleNavigate} />;
    }
  };
  return (
    <Layout onNavigate={handleNavigate} currentView={currentView}>
      <div key={viewKey}>
        {renderContent()}
      </div>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

