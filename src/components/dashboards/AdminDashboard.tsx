import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Building2,
  Wrench,
  AlertTriangle,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
  Plus,
  Settings,
  Eye,
  EyeOff,
  Shield,
  Bell,
  DollarSign,
} from 'lucide-react';
import { ClientForm } from '../forms/ClientForm';
import TechnicianForm from '../forms/TechnicianForm';
import AdminForm from '../forms/AdminForm';
import { CoordinationRequestsPanel } from '../calendar/CoordinationRequestsPanel';
import { AlertDashboard } from './AlertDashboard';
import {
  EmergenciesPanel,
  MaintenancesPanel,
  ServiceRequestsPanel,
  QuotationsPanel,
  WorkOrdersPanel,
} from './AdminDashboardPanels';

type ViewMode = 'dashboard' | 'add-client' | 'add-technician' | 'add-admin' | 'settings';

interface ViewSettings {
  showStats: boolean;
  showActivity: boolean;
  showPerformance: boolean;
  showQuickActions: boolean;
}

interface AdminDashboardProps {
  onNavigate?: (path: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps = {}) {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalElevators: 0,
    activeTechnicians: 0,
    activeEmergencies: 0,
    scheduledToday: 0,
    pendingQuotations: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showStats: true,
    showActivity: true,
    showPerformance: true,
    showQuickActions: true,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [clients, elevators, technicians, emergencies, scheduled, quotations] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('elevators').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'technician').eq('is_active', true),
        supabase.from('emergency_visits').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('maintenance_schedules').select('id', { count: 'exact', head: true }).eq('scheduled_date', today),
        supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
      ]);

      if (clients.error) console.error('Clients error:', clients.error);
      if (elevators.error) console.error('Elevators error:', elevators.error);
      if (technicians.error) console.error('Technicians error:', technicians.error);
      if (emergencies.error) console.error('Emergencies error:', emergencies.error);
      if (scheduled.error) console.error('Scheduled error:', scheduled.error);
      if (quotations.error) console.error('Quotations error:', quotations.error);

      setStats({
        totalClients: clients.count || 0,
        totalElevators: elevators.count || 0,
        activeTechnicians: technicians.count || 0,
        activeEmergencies: emergencies.count || 0,
        scheduledToday: scheduled.count || 0,
        pendingQuotations: quotations.count || 0,
      });

      // Cargar órdenes de trabajo pendientes de aprobación que llevan más de 3 días
      const threeAgo = new Date();
      threeAgo.setDate(threeAgo.getDate() - 3);
      const threeDaysAgo = threeAgo.toISOString();

      const { data: pendingWO } = await supabase
        .from('work_orders')
        .select(`
          id,
          folio_number,
          description,
          quotation_amount,
          status,
          created_at,
          buildings:building_id (
            name,
            clients:client_id (
              company_name
            )
          )
        `)
        .eq('status', 'pending_approval')
        .lt('created_at', threeDaysAgo)
        .order('created_at', { ascending: true });

      if (pendingWO) {
        const transformedWO = (pendingWO || []).map(item => ({
          ...item,
          buildings: Array.isArray(item.buildings) && item.buildings.length > 0 ? item.buildings[0] : item.buildings,
          daysWaiting: Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
        }));
        setPendingApprovals(transformedWO as any);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setCurrentView('dashboard');
    loadDashboardData();
  };

  const toggleView = (key: keyof ViewSettings) => {
    setViewSettings({ ...viewSettings, [key]: !viewSettings[key] });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (currentView === 'add-client') {
    return <ClientForm onSuccess={handleFormSuccess} onCancel={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'add-technician') {
    return <TechnicianForm onSuccess={handleFormSuccess} onCancel={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'add-admin') {
    return <AdminForm onSuccess={handleFormSuccess} onCancel={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'settings') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-slate-600" />
            <h2 className="text-2xl font-bold text-slate-900">Configuración de Vistas</h2>
          </div>
          <button
            onClick={() => setCurrentView('dashboard')}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
          >
            Volver al Dashboard
          </button>
        </div>

        <p className="text-slate-600 mb-6">
          Activa o desactiva las secciones que deseas ver en tu dashboard
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              {viewSettings.showStats ? (
                <Eye className="w-5 h-5 text-green-600" />
              ) : (
                <EyeOff className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <h3 className="font-semibold text-slate-900">Estadísticas Generales</h3>
                <p className="text-sm text-slate-600">Tarjetas con clientes, ascensores, técnicos, etc.</p>
              </div>
            </div>
            <button
              onClick={() => toggleView('showStats')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewSettings.showStats
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {viewSettings.showStats ? 'Activado' : 'Desactivado'}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              {viewSettings.showActivity ? (
                <Eye className="w-5 h-5 text-green-600" />
              ) : (
                <EyeOff className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <h3 className="font-semibold text-slate-900">Actividad Reciente</h3>
                <p className="text-sm text-slate-600">Últimas acciones y eventos del sistema</p>
              </div>
            </div>
            <button
              onClick={() => toggleView('showActivity')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewSettings.showActivity
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {viewSettings.showActivity ? 'Activado' : 'Desactivado'}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              {viewSettings.showPerformance ? (
                <Eye className="w-5 h-5 text-green-600" />
              ) : (
                <EyeOff className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <h3 className="font-semibold text-slate-900">Rendimiento del Mes</h3>
                <p className="text-sm text-slate-600">Métricas y estadísticas de rendimiento</p>
              </div>
            </div>
            <button
              onClick={() => toggleView('showPerformance')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewSettings.showPerformance
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {viewSettings.showPerformance ? 'Activado' : 'Desactivado'}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              {viewSettings.showQuickActions ? (
                <Eye className="w-5 h-5 text-green-600" />
              ) : (
                <EyeOff className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <h3 className="font-semibold text-slate-900">Acciones Rápidas</h3>
                <p className="text-sm text-slate-600">Botones de acceso rápido a funciones principales</p>
              </div>
            </div>
            <button
              onClick={() => toggleView('showQuickActions')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewSettings.showQuickActions
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {viewSettings.showQuickActions ? 'Activado' : 'Desactivado'}
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Nota:</strong> Los cambios se aplicarán inmediatamente al volver al dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Atajos Rápidos</h1>
          <p className="text-slate-600 mt-1">Acceso rápido a información reciente y tareas prioritarias</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentView('settings')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
          >
            <Settings className="w-4 h-4" />
            Configurar Vistas
          </button>
          <button
            onClick={() => setCurrentView('add-admin')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nuevo Administrador
          </button>
          <button
            onClick={() => setCurrentView('add-client')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
          <button
            onClick={() => setCurrentView('add-technician')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nuevo Técnico
          </button>
        </div>
      </div>

      {viewSettings.showStats && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-red-600" />
            Centro de Alertas y Notificaciones
          </h2>
          <AlertDashboard onNavigate={onNavigate} />
        </div>
      )}

      {/* Paneles Dinámicos */}
      {viewSettings.showPerformance && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Monitoreo Operacional</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EmergenciesPanel />
            <MaintenancesPanel />
            <ServiceRequestsPanel />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <QuotationsPanel />
            <WorkOrdersPanel />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Alertas de Órdenes Pendientes */}
        {pendingApprovals.length > 0 && (
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl shadow-lg border-2 border-red-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-red-100 p-3 rounded-lg">
                <Bell className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-900">⚠️ Órdenes Pendientes de Respuesta</h2>
                <p className="text-sm text-red-700">Han esperado más de 3 días sin aprobación</p>
              </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {pendingApprovals.map((wo) => (
                <div key={wo.id} className="bg-white rounded-lg p-4 border-l-4 border-red-500 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900">{wo.folio_number}</h3>
                      <p className="text-xs text-slate-500 mb-1">{wo.buildings?.name}</p>
                      <p className="text-sm text-slate-600">{wo.description}</p>
                    </div>
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">
                      {wo.daysWaiting} días
                    </span>
                  </div>
                  {wo.quotation_amount && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-green-600 mt-2">
                      <DollarSign className="w-4 h-4" />
                      ${wo.quotation_amount.toLocaleString('es-CL')}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => onNavigate?.('work-orders')}
              className="mt-4 w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition"
            >
              Revisar Órdenes Pendientes
            </button>
          </div>
        )}

        {viewSettings.showActivity && (
          <div>
            <CoordinationRequestsPanel />
          </div>
        )}

        {viewSettings.showActivity && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-slate-900" />
            <h2 className="text-xl font-bold text-slate-900">Actividad Reciente</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="bg-green-100 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Mantenimiento completado</p>
                <p className="text-sm text-slate-600">Edificio Torre Central - Hace 15 min</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Nueva emergencia reportada</p>
                <p className="text-sm text-slate-600">Centro Comercial Plaza - Hace 1 hora</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Nuevo cliente agregado</p>
                <p className="text-sm text-slate-600">Edificio Sky Tower - Hace 2 horas</p>
              </div>
            </div>
          </div>
          </div>
        )}

        {viewSettings.showPerformance && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-slate-900" />
            <h2 className="text-xl font-bold text-slate-900">Rendimiento del Mes</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-900">Mantenimientos Completados</p>
                <span className="text-lg font-bold text-green-600">156</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              <p className="text-xs text-slate-600 mt-1">85% de la meta mensual</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-900">Emergencias Resueltas</p>
                <span className="text-lg font-bold text-blue-600">42</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '92%' }}></div>
              </div>
              <p className="text-xs text-slate-600 mt-1">Tiempo promedio: 2.3 horas</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-900">Satisfacción del Cliente</p>
                <span className="text-lg font-bold text-purple-600">4.8/5</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '96%' }}></div>
              </div>
              <p className="text-xs text-slate-600 mt-1">Basado en 87 evaluaciones</p>
            </div>
          </div>
          </div>
        )}
      </div>

      {viewSettings.showQuickActions && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Acciones Rápidas</h2>
        <p className="text-slate-300 mb-6">
          Gestiona las operaciones diarias de manera eficiente
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setCurrentView('add-admin')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Shield className="w-5 h-5" />
            Nuevo Administrador
          </button>
          <button
            onClick={() => onNavigate?.('work-orders')}
            className="bg-white text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-slate-100 transition"
          >
            Crear Orden de Trabajo
          </button>
          <button
            onClick={() => onNavigate?.('routes')}
            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition border border-slate-700"
          >
            Asignar Ruta a Técnico
          </button>
          <button
            onClick={() => onNavigate?.('maintenance-checklist')}
            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition border border-slate-700"
          >
            Mantenimientos
          </button>
          <button
            onClick={() => onNavigate?.('maintenance-calendar')}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center gap-2"
          >
            <Calendar className="w-5 h-5" />
            📅 Calendario de Mantenimientos
          </button>
          <button
            onClick={() => onNavigate?.('emergencies')}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
          >
            🚨 Emergencias
          </button>
          <button
            onClick={() => onNavigate?.('service-requests')}
            className="bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
          >
            📋 Solicitudes de Servicio
          </button>
          <button
            onClick={() => onNavigate?.('bulk-operations')}
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition"
          >
            Operaciones Masivas
          </button>
          <button
            onClick={() => onNavigate?.('audit-logs')}
            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition border border-slate-700"
          >
            Registro de Auditoría
          </button>
        </div>
        </div>
      )}
    </div>
  );
}
