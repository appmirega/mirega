import { ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useViewPermissions } from '../hooks/useViewPermissions';
import {
  LayoutDashboard,
  Users,
  FileText,
  AlertTriangle,
  ClipboardList,
  LogOut,
  Menu,
  X,
  BookOpen,
  QrCode,
  BarChart3,
  Building,
  User as UserIcon,
  ShieldCheck,
  TrendingUp,
  Shield,
  CalendarRange,
  Award,
  Folder,
  FileSearch,
  Building2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  onNavigate?: (path: string) => void;
  currentView?: string;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: string[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { label: 'Inicio', icon: LayoutDashboard, path: 'dashboard', roles: ['developer', 'admin', 'technician', 'client'] },
      { label: 'Mi Perfil', icon: UserIcon, path: 'profile', roles: ['developer', 'admin', 'technician', 'client'] },
      { label: 'Mi Calendario', icon: CalendarRange, path: 'calendar', roles: ['technician'] },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Calendario Operativo', icon: CalendarRange, path: 'calendar', roles: ['developer', 'admin'] },
      { label: 'Mantenimientos', icon: ClipboardList, path: 'maintenance-checklist', roles: ['developer', 'admin', 'technician'] },
      { label: 'Solicitudes de Servicio', icon: FileText, path: 'service-requests', roles: ['developer', 'admin', 'technician'] },
      { label: 'Emergencias', icon: AlertTriangle, path: 'emergencies', roles: ['developer', 'admin', 'technician'] },
      { label: 'Órdenes de Trabajo', icon: FileText, path: 'work-orders', roles: ['developer', 'admin', 'technician'] },
      { label: 'Ascensores', icon: Building2, path: 'elevators', roles: ['developer', 'admin', 'technician', 'client'] },
    ],
  },
  {
    label: 'Análisis y Gestión',
    items: [
      { label: 'Resumen Ejecutivo', icon: TrendingUp, path: 'statistics', roles: ['developer', 'admin'] },
      { label: 'Análisis Operativo', icon: ShieldCheck, path: 'risk-backlog', roles: ['developer', 'admin'] },
      { label: 'Análisis Comercial', icon: BarChart3, path: 'value-opportunities', roles: ['developer', 'admin'] },
      { label: 'Costos y Conversión', icon: TrendingUp, path: 'roi-calculator', roles: ['developer', 'admin'] },
      { label: 'Registro de Auditoría', icon: FileSearch, path: 'audit-logs', roles: ['developer', 'admin'] },
    ],
  },
  {
    label: 'Cliente',
    items: [
      { label: 'Mis Mantenimientos', icon: ClipboardList, path: 'client-maintenances', roles: ['client'] },
      { label: 'Mis Solicitudes', icon: FileText, path: 'client-service-requests', roles: ['client'] },
      { label: 'Mis Emergencias', icon: AlertTriangle, path: 'client-emergencies', roles: ['client'] },
      { label: 'Inducción de Rescate', icon: Award, path: 'rescue-training', roles: ['client'] },
      { label: 'Carpeta Cero', icon: Folder, path: 'carpeta-cero', roles: ['client'] },
    ],
  },
  {
    label: 'Configuración y Administración',
    items: [
      { label: 'Usuarios', icon: Users, path: 'users', roles: ['developer', 'admin'] },
      { label: 'Clientes', icon: Building, path: 'clients', roles: ['developer', 'admin'] },
      { label: 'Códigos QR', icon: QrCode, path: 'qr-codes-complete', roles: ['developer', 'admin'] },
      { label: 'Manuales Técnicos', icon: BookOpen, path: 'manuals', roles: ['developer', 'admin', 'technician'] },
      { label: 'Permisos Globales', icon: Shield, path: 'developer-permissions', roles: ['developer'] },
      { label: 'Permisos', icon: Shield, path: 'admin-permissions', roles: ['admin'] },
    ],
  },
];

export function Layout({ children, onNavigate, currentView }: LayoutProps) {
  const {
    profile,
    signOut,
    availableClients,
    selectedClientId,
    selectedClient,
    setSelectedClientId,
  } = useAuth();
  const { canAccessView } = useViewPermissions();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Principal: true,
    Operaciones: false,
    'Análisis y Gestión': false,
    Cliente: false,
    'Configuración y Administración': false,
  });

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({
      Principal: label === 'Principal' ? !prev.Principal : false,
      Operaciones: label === 'Operaciones' ? !prev.Operaciones : false,
      'Análisis y Gestión': label === 'Análisis y Gestión' ? !prev['Análisis y Gestión'] : false,
      Cliente: label === 'Cliente' ? !prev.Cliente : false,
      'Configuración y Administración':
        label === 'Configuración y Administración'
          ? !prev['Configuración y Administración']
          : false,
    }));
  };

  const filteredSections = navSections
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) => {
        if (!profile) return false;
        if (!item.roles.includes(profile.role)) return false;
        return canAccessView(item.path);
      }),
    }))
    .filter((section) => section.items.length > 0);
  };

  const handleNavigation = (path: string) => {
    setSidebarOpen(false);
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const currentClientAlias =
    selectedClient?.internal_alias ||
    selectedClient?.building_name ||
    selectedClient?.company_name ||
    profile?.building_name ||
    null;

  const currentClientDetail =
    selectedClient?.company_name ||
    selectedClient?.building_name ||
    null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-circular (2).png"
              alt="MIREGA"
              className="h-8 w-auto"
            />
            <div>
              <h1 className="text-lg font-bold text-gray-900">MIREGA</h1>
              <p className="text-xs text-gray-600">Ascensores</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 bg-white border-r border-gray-200 transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200 hidden lg:block">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo-circular (2).png"
                  alt="MIREGA Ascensores"
                  className="h-12 w-auto"
                />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">MIREGA</h1>
                  <p className="text-sm text-gray-600">Ascensores</p>
                </div>
              </div>            </div>
          </div>

          <div className="p-4 border-b border-gray-200 lg:mt-0 mt-16 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {profile?.full_name}
                </p>
                {profile?.role === 'client' && currentClientAlias && (
                  <p className="text-xs text-gray-600 truncate">
                    {currentClientAlias}
                  </p>
                )}
              </div>
            </div>

            {profile?.role === 'client' && availableClients.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Edificio activo
                </label>
                <select
                  value={selectedClientId || ''}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  {availableClients.map((client) => (
                    <option key={client.client_id} value={client.client_id}>
                      {client.internal_alias ||
                        client.building_name ||
                        client.company_name ||
                        'Edificio'}
                    </option>
                  ))}
                </select>

                {selectedClient && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                      Seleccionado
                    </p>
                    <p className="text-sm font-bold text-blue-900">
                      {currentClientAlias}
                    </p>
                    {currentClientDetail && currentClientDetail !== currentClientAlias && (
                      <p className="text-xs text-blue-700 mt-0.5">
                        {currentClientDetail}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredSections.map((section) => (
              <div key={section.label} className="space-y-1">
                <button
                  onClick={() => toggleSection(section.label)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition text-left"
                >
                  <span className="uppercase tracking-wide text-left flex-1">
                    {section.label}
                  </span>
                  {expandedSections[section.label] ? (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  )}
                </button>

                {expandedSections[section.label] && (
                  <div className="space-y-1 pl-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.path;

                      return (
                        <button
                          key={item.path}
                          onClick={() => handleNavigation(item.path)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition text-sm text-left ${
                            isActive
                              ? 'bg-red-600 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
            >
              <LogOut className="w-5 h-5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="lg:ml-64 min-h-screen">
        <div className="pt-16 lg:pt-0 p-6">{children}</div>
      </main>
    </div>
  );
}

export default Layout;