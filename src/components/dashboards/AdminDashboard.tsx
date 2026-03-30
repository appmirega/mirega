import { useEffect, useState } from 'react';
import {
  Plus,
  Settings,
  Eye,
  EyeOff,
  Bell,
} from 'lucide-react';
import { ClientForm } from '../forms/ClientForm';
import TechnicianForm from '../forms/TechnicianForm';
import AdminForm from '../forms/AdminForm';
import { CoordinationRequestsPanel } from '../calendar/CoordinationRequestsPanel';
import { AlertDashboard } from './AlertDashboard';

type ViewMode =
  | 'dashboard'
  | 'add-client'
  | 'add-technician'
  | 'add-admin'
  | 'settings';

interface ViewSettings {
  showStats: boolean;
  showActivity: boolean;
  showPerformance: boolean;
}

interface AdminDashboardProps {
  onNavigate?: (path: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps = {}) {
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showStats: true,
    showActivity: true,
    showPerformance: true,
  });

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleFormSuccess = () => {
    setCurrentView('dashboard');
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
    return (
      <ClientForm
        onSuccess={handleFormSuccess}
        onCancel={() => setCurrentView('dashboard')}
      />
    );
  }

  if (currentView === 'add-technician') {
    return (
      <TechnicianForm
        onSuccess={handleFormSuccess}
        onCancel={() => setCurrentView('dashboard')}
      />
    );
  }

  if (currentView === 'add-admin') {
    return (
      <AdminForm
        onSuccess={handleFormSuccess}
        onCancel={() => setCurrentView('dashboard')}
      />
    );
  }

  if (currentView === 'settings') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-slate-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              Configuración de Vistas
            </h2>
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
                <h3 className="font-semibold text-slate-900">
                  Centro de Alertas
                </h3>
                <p className="text-sm text-slate-600">
                  Alertas, advertencias y estado operacional
                </p>
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
                <h3 className="font-semibold text-slate-900">Coordinación</h3>
                <p className="text-sm text-slate-600">
                  Solicitudes y coordinación administrativa
                </p>
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
                <h3 className="font-semibold text-slate-900">
                  Monitoreo Operacional
                </h3>
                <p className="text-sm text-slate-600">
                  Resúmenes ejecutivos de emergencias, mantenimientos y órdenes de trabajo
                </p>
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
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Atajos Rápidos</h1>
          <p className="text-slate-600 mt-1">
            Acceso rápido a información reciente y tareas prioritarias
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
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
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              Centro de Alertas y Notificaciones
            </h2>
          </div>
          <AlertDashboard onNavigate={onNavigate} />
        </div>
      )}

      {viewSettings.showActivity && (
        <div>
          <CoordinationRequestsPanel />
        </div>
      )}
    </div>
  );
}