import { ReactNode, useMemo, useState } from 'react';
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
  Wrench,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  onNavigate?: (path: string) => void;
  currentView?: string;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  roles: string[];
  children?: NavItem[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Principal',
    items: [
      {
        label: 'Inicio',
        icon: LayoutDashboard,
        path: 'dashboard',
        roles: ['developer', 'admin', 'technician', 'client'],
      },
      {
        label: 'Mi Perfil',
        icon: UserIcon,
        path: 'profile',
        roles: ['developer', 'admin', 'technician', 'client'],
      },
      {
        label: 'Mi Calendario',
        icon: CalendarRange,
        path: 'calendar',
        roles: ['technician'],
      },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      {
        label: 'Calendario Operativo',
        icon: CalendarRange,
        path: 'calendar',
        roles: ['developer', 'admin'],
      },
      {
        label: 'Mantenimientos',
        icon: ClipboardList,
        path: 'maintenance-checklist',
        roles: ['developer', 'admin', 'technician'],
      },
      {
        label: 'Pruebas Técnicas',
        icon: Wrench,
        roles: ['developer', 'admin', 'technician'],
        children: [
          {
            label: 'Prueba de Cables',
            icon: FileText,
            path: 'technical-tests-cables',
            roles: ['developer', 'admin', 'technician'],
          },
          {
            label: 'Prueba de Frenos',
            icon: FileText,
            path: 'technical-tests-brakes',
            roles: ['developer', 'admin', 'technician'],
          },
          {
            label: 'Prueba de Limitador',
            icon: FileText,
            path: 'technical-tests-limiter',
            roles: ['developer', 'admin', 'technician'],
          },
        ],
      },
      {
        label: 'Solicitudes de Servicio',
        icon: FileText,
        path: 'service-requests',
        roles: ['developer', 'admin', 'technician'],
      },
      {
        label: 'Emergencias',
        icon: AlertTriangle,
        path: 'emergencies',
        roles: ['developer', 'admin', 'technician'],
      },
      {
        label: 'Órdenes de Trabajo',
        icon: FileText,
        path: 'work-orders',
        roles: ['developer', 'admin', 'technician'],
      },
      {
        label: 'Ascensores',
        icon: Building2,
        path: 'elevators',
        roles: ['developer', 'admin', 'technician', 'client'],
      },
    ],
  },
  {
    label: 'Análisis y Gestión',
    items: [
      {
        label: 'Resumen Ejecutivo',
        icon: TrendingUp,
        path: 'statistics',
        roles: ['developer', 'admin'],
      },
      {
        label: 'Análisis Operativo',
        icon: ShieldCheck,
        path: 'risk-backlog',
        roles: ['developer', 'admin'],
      },
      {
        label: 'Análisis Comercial',
        icon: BarChart3,
        path: 'value-opportunities',
        roles: ['developer', 'admin'],
      },
      {
        label: 'Costos y Conversión',
        icon: TrendingUp,
        path: 'roi-calculator',
        roles: ['developer', 'admin'],
      },
      {
        label: 'Registro de Auditoría',
        icon: FileSearch,
        path: 'audit-logs',
        roles: ['developer', 'admin'],
      },
    ],
  },
  {
    label: 'Cliente',
    items: [
      {
        label: 'Mis Mantenimientos',
        icon: ClipboardList,
        path: 'client-maintenances',
        roles: ['client'],
      },
      {
        label: 'Mis Solicitudes',
        icon: FileText,
        path: 'client-service-requests',
        roles: ['client'],
      },
      {
        label: 'Mis Emergencias',
        icon: AlertTriangle,
        path: 'client-emergencies',
        roles: ['client'],
      },
      {
        label: 'Inducción de Rescate',
        icon: Award,
        path: 'rescue-training',
        roles: ['client'],
      },
      {
        label: 'Carpeta Cero',
        icon: Folder,
        path: 'carpeta-cero',
        roles: ['client'],
      },
    ],
  },
  {
    label: 'Configuración y Administración',
    items: [
      {
        label: 'Usuarios',
        icon: Users,
        path: 'users',
        roles: ['developer', 'admin'],
      },
      {
        label: 'Clientes',
        icon: Building,
        path: 'clients',
        roles: ['developer', 'admin'],
      },
      {
        label: 'Códigos QR',
        icon: QrCode,
        path: 'qr-codes-complete',
        roles: ['developer', 'admin'],
      },
      {
        label: 'Manuales Técnicos',
        icon: BookOpen,
        path: 'manuals',
        roles: ['developer', 'admin', 'technician'],
      },
      {
        label: 'Permisos Globales',
        icon: Shield,
        path: 'developer-permissions',
        roles: ['developer'],
      },
      {
        label: 'Permisos',
        icon: Shield,
        path: 'admin-permissions',
        roles: ['admin'],
      },
    ],
  },
];

function hasActiveChild(item: NavItem, currentView?: string): boolean {
  if (!item.children?.length) return false;
  return item.children.some(
    (child) => child.path === currentView || hasActiveChild(child, currentView)
  );
}

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
    Operaciones: true,
    'Análisis y Gestión': false,
    Cliente: false,
    'Configuración y Administración': false,
  });

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const toggleItem = (label: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [label]: !(prev[label] ?? false),
    }));
  };

  const filterItems = (items: NavItem[]): NavItem[] => {
    return items
      .map((item) => {
        if (!profile) return null;

        const roleAllowed = item.roles.includes(profile.role);
        if (!roleAllowed) return null;

        const filteredChildren = item.children ? filterItems(item.children) : undefined;
        const hasChildren = !!filteredChildren?.length;
        const canAccessSelf = item.path ? canAccessView(item.path) : false;

        if (!hasChildren && item.path && !canAccessSelf) return null;
        if (!hasChildren && !item.path) return null;

        return {
          ...item,
          children: filteredChildren,
        };
      })
      .filter(Boolean) as NavItem[];
  };

  const filteredSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          label: section.label,
          items: filterItems(section.items),
        }))
        .filter((section) => section.items.length > 0),
    [profile, canAccessView]
  );

  const handleNavigation = (path: string) => {
    setSidebarOpen(false);
    if (onNavigate) onNavigate(path);
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

  const renderNavItem = (item: NavItem, depth = 0) => {
    const Icon = item.icon;
    const isActive = !!item.path && currentView === item.path;
    const isGroup = !!item.children?.length;
    const groupHasActiveChild = hasActiveChild(item, currentView);
    const isGroupExpanded = expandedItems[item.label] ?? groupHasActiveChild;

    if (isGroup) {
      return (
        <div key={`${item.label}-${depth}`} className="space-y-1">
          <button
            onClick={() => toggleItem(item.label)}
            className={`w-full flex items-center justify-between rounded-lg px-4 py-2.5 text-sm text-left transition ${
              groupHasActiveChild ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{item.label}</span>
            </div>
            {isGroupExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            )}
          </button>

          {isGroupExpanded && (
            <div className="space-y-1 pl-4">
              {item.children!.map((child) => renderNavItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={`${item.path}-${depth}`}
        onClick={() => handleNavigation(item.path!)}
        className={`w-full flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-left transition ${
          isActive ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-gray-100'
        } ${depth > 0 ? 'ml-2' : ''}`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 z-30 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-circular (2).png" alt="MIREGA" className="h-8 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">MIREGA</h1>
              <p className="text-xs text-gray-600">Ascensores</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 transition hover:bg-gray-100"
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 border-r border-gray-200 bg-white transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="hidden border-b border-gray-200 p-6 lg:block">
            <div className="mb-4 flex items-center justify-between gap-3">
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
              </div>
            </div>
          </div>

          <div className="space-y-3 border-b border-gray-200 p-4 lg:mt-0 mt-16">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-red-600 to-green-600 font-semibold text-white">
                {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900">{profile?.full_name}</p>
                {profile?.role === 'client' && currentClientAlias && (
                  <p className="truncate text-xs text-gray-600">{currentClientAlias}</p>
                )}
              </div>
            </div>

            {profile?.role === 'client' && availableClients.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Edificio activo
                </label>
                <select
                  value={selectedClientId || ''}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
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
                    <p className="text-sm font-bold text-blue-900">{currentClientAlias}</p>
                    {currentClientDetail && currentClientDetail !== currentClientAlias && (
                      <p className="mt-0.5 text-xs text-blue-700">{currentClientDetail}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto p-4">
            {filteredSections.map((section) => (
              <div key={section.label} className="space-y-1">
                <button
                  onClick={() => toggleSection(section.label)}
                  className="w-full rounded-lg px-4 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex-1 uppercase tracking-wide">{section.label}</span>
                    {expandedSections[section.label] ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                  </div>
                </button>

                {expandedSections[section.label] && (
                  <div className="space-y-1 pl-2">
                    {section.items.map((item) => renderNavItem(item))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="border-t border-gray-200 p-4">
            <button
              onClick={signOut}
              className="w-full rounded-lg px-4 py-3 font-medium text-red-600 transition hover:bg-red-50"
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-5 w-5" />
                <span>Cerrar Sesión</span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="min-h-screen lg:ml-64">
        <div className="p-6 pt-16 lg:pt-0">{children}</div>
      </main>
    </div>
  );
}

export default Layout;