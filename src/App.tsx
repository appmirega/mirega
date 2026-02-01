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

import React from 'react';
function App() {
  return (
    <div>
      <h1>App funcionando</h1>
    </div>
  );
}

export default App;
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );

}
export default App;
