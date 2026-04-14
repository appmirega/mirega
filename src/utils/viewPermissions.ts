import type { UserRole } from '../lib/database.types';

export interface ViewPermission {
  key: string;
  label: string;
  description: string;
  defaultRoles: UserRole[];
}

export const ALL_VIEWS: ViewPermission[] = [
  {
    key: 'dashboard',
    label: 'Inicio',
    description: 'Panel principal del sistema',
    defaultRoles: ['admin', 'developer', 'technician', 'client'],
  },
  {
    key: 'profile',
    label: 'Mi Perfil',
    description: 'Información personal del usuario',
    defaultRoles: ['admin', 'developer', 'technician', 'client'],
  },
  {
    key: 'calendar',
    label: 'Calendario',
    description: 'Vista de calendario operativo',
    defaultRoles: ['admin', 'developer', 'technician'],
  },
  {
    key: 'users',
    label: 'Usuarios',
    description: 'Administrar usuarios del sistema',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'clients',
    label: 'Clientes',
    description: 'Ver y administrar clientes',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'elevators',
    label: 'Ascensores',
    description: 'Gestión de ascensores e información técnica',
    defaultRoles: ['admin', 'developer', 'technician', 'client'],
  },
  {
    key: 'maintenance-complete',
    label: 'Gestión de Mantenimientos',
    description: 'Control administrativo de mantenimientos',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'maintenance-checklist',
    label: 'Mantenimientos',
    description: 'Checklist y gestión operativa de mantenimientos',
    defaultRoles: ['admin', 'developer', 'technician', 'client'],
  },
  {
    key: 'technical-tests-cables',
    label: 'Prueba de Cables',
    description: 'Acceso directo a la vista de prueba de cables',
    defaultRoles: ['admin', 'developer', 'technician'],
  },
  {
    key: 'technical-tests-brakes',
    label: 'Prueba de Frenos',
    description: 'Acceso directo a la vista de prueba de frenos',
    defaultRoles: ['admin', 'developer', 'technician'],
  },
  {
    key: 'technical-tests-limiter',
    label: 'Prueba de Limitador',
    description: 'Acceso directo a la vista de prueba de limitador',
    defaultRoles: ['admin', 'developer', 'technician'],
  },
  {
    key: 'service-requests',
    label: 'Solicitudes de Servicio',
    description: 'Gestión de solicitudes de servicio',
    defaultRoles: ['admin', 'developer', 'technician'],
  },
  {
    key: 'emergencies',
    label: 'Emergencias',
    description: 'Gestión de emergencias',
    defaultRoles: ['admin', 'developer', 'technician'],
  },
  {
    key: 'client-emergencies',
    label: 'Mis Emergencias',
    description: 'Ver emergencias propias',
    defaultRoles: ['client'],
  },
  {
    key: 'emergency-history',
    label: 'Historial de Emergencias',
    description: 'Histórico completo de emergencias',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'work-orders',
    label: 'Órdenes de Trabajo',
    description: 'Gestionar órdenes de trabajo',
    defaultRoles: ['admin', 'developer', 'technician'],
  },
  {
    key: 'routes',
    label: 'Rutas',
    description: 'Gestión de rutas de mantenimiento',
    defaultRoles: ['admin', 'developer', 'technician'],
  },
  {
    key: 'quotations',
    label: 'Cotizaciones',
    description: 'Gestión de cotizaciones',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'client-quotations',
    label: 'Mis Cotizaciones',
    description: 'Ver cotizaciones propias',
    defaultRoles: ['client'],
  },
  {
    key: 'carpeta-cero',
    label: 'Carpeta Cero',
    description: 'Documentación legal y técnica',
    defaultRoles: ['admin', 'developer', 'client'],
  },
  {
    key: 'rescue-training-admin',
    label: 'Capacitaciones de Rescate',
    description: 'Administrar capacitaciones de rescate',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'rescue-training',
    label: 'Inducción de Rescate',
    description: 'Contenido de inducción de rescate',
    defaultRoles: ['client'],
  },
  {
    key: 'parts-inventory',
    label: 'Inventario de Repuestos',
    description: 'Control de inventario de repuestos',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'manuals',
    label: 'Manuales Técnicos',
    description: 'Biblioteca de manuales técnicos',
    defaultRoles: ['admin', 'developer', 'technician'],
  },
  {
    key: 'qr-codes-complete',
    label: 'Códigos QR',
    description: 'Gestión de códigos QR',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'certifications',
    label: 'Certificaciones',
    description: 'Gestión de certificaciones',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'statistics',
    label: 'Resumen Ejecutivo',
    description: 'Indicadores generales del negocio',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'risk-backlog',
    label: 'Análisis Operativo',
    description: 'Análisis de emergencias, carga y comportamiento operativo',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'value-opportunities',
    label: 'Análisis Comercial',
    description: 'Cotizaciones, aprobación y comportamiento comercial',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'roi-calculator',
    label: 'Costos y Conversión',
    description: 'Montos, conversión y consolidado económico disponible',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'activity-history',
    label: 'Historial de Actividad',
    description: 'Registro de actividades del sistema',
    defaultRoles: ['admin', 'developer', 'technician', 'client'],
  },
  {
    key: 'notifications',
    label: 'Notificaciones',
    description: 'Centro de notificaciones',
    defaultRoles: ['admin', 'developer', 'technician', 'client'],
  },
  {
    key: 'audit-logs',
    label: 'Registro de Auditoría',
    description: 'Logs y trazabilidad del sistema',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'bulk-operations',
    label: 'Operaciones Masivas',
    description: 'Operaciones administrativas en lote',
    defaultRoles: ['admin', 'developer'],
  },
  {
    key: 'developer-permissions',
    label: 'Permisos Globales',
    description: 'Gestión global de permisos del sistema',
    defaultRoles: ['developer'],
  },
  {
    key: 'admin-permissions',
    label: 'Permisos',
    description: 'Gestión de permisos para técnicos y clientes',
    defaultRoles: ['admin'],
  },
];

export const ALL_VIEW_KEYS = new Set(ALL_VIEWS.map((view) => view.key));

export function isManagedView(viewKey: string): boolean {
  return ALL_VIEW_KEYS.has(viewKey);
}

export function getViewsForRole(role: UserRole): ViewPermission[] {
  return ALL_VIEWS.filter((view) => view.defaultRoles.includes(role));
}

export function getDefaultEnabledViewKeys(role: UserRole): Set<string> {
  return new Set(getViewsForRole(role).map((view) => view.key));
}

export function getManageableViews(managerRole: 'admin'): ViewPermission[] {
  if (managerRole === 'admin') {
    return ALL_VIEWS.filter(
      (view) =>
        view.defaultRoles.includes('technician') ||
        view.defaultRoles.includes('client')
    );
  }

  return [];
}

export function getAllManageableViews(): ViewPermission[] {
  return ALL_VIEWS;
}