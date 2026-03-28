import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationCenter } from './NotificationCenter';
import { supabase } from '../lib/supabase';
import { useViewPermissions } from '../hooks/useViewPermissions';
import {
  LayoutDashboard,
  Users,
  FileText,
  AlertTriangle,
  ClipboardList,
  Settings,
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
    label: 'Cliente',
    items: [
      { label: 'Mis Mantenimientos', icon: ClipboardList, path: 'client-maintenances', roles: ['client'] },
      { label: 'Mis Solicitudes', icon: FileText, path: 'client-service-requests', roles: ['client'] },
      { label: 'Mis Emergencias', icon: AlertTriangle, path: 'client-emergencies', roles: ['client'] },
      { label: 'Inducción de Rescate', icon: Award, path: 'rescue-training', roles: ['client'] },
      { label: 'Carpeta Cero', icon: Folder, path: 'carpeta-cero', roles: ['client'] },
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
  const [notificationCount, setNotificationCount] = useState(0);

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

  useEffect(() => {
    if (!profile?.id) return;
    loadUnreadNotifications();
  }, [profile?.id]);

  const loadUnreadNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, is_read')
      .eq('user_id', profile.id);

    const unread = (data ?? []).filter((n: any) => !n.is_read).length;
    setNotificationCount(unread);
  };

  const currentClientLabel =
    selectedClient?.internal_alias ||
    selectedClient?.building_name ||
    selectedClient?.company_name ||
    null;

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 p-4">
        
        {/* PERFIL */}
        <div className="mb-6">
          <p className="font-bold">{profile?.full_name}</p>

          {/* 🔥 EDIFICIO ACTIVO */}
          {profile?.role === 'client' && currentClientLabel && (
            <p className="text-sm text-gray-600">
              {currentClientLabel}
            </p>
          )}

          {/* 🔥 SELECTOR MEJORADO */}
          {profile?.role === 'client' && availableClients.length > 1 && (
            <select
              value={selectedClientId || ''}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="mt-2 w-full border rounded p-2 text-sm"
            >
              {availableClients.map((client) => (
                <option key={client.client_id} value={client.client_id}>
                  {client.internal_alias || client.building_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* NAV */}
        {filteredSections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="text-xs text-gray-500 uppercase">{section.label}</p>

            {section.items.map((item) => (
              <button
                key={item.path}
                onClick={() => onNavigate?.(item.path)}
                className="block w-full text-left py-2 text-sm hover:bg-gray-100 rounded"
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}

        <button
          onClick={signOut}
          className="mt-6 text-red-600 text-sm"
        >
          Cerrar sesión
        </button>
      </aside>

      <main className="ml-64 p-6">{children}</main>
    </div>
  );
}