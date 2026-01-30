// Sistema de permisos basado en vistas

export interface ViewPermission {
  key: string;
  label: string;
  description: string;
  defaultRoles: string[];
}

export const ALL_VIEWS: ViewPermission[] = [
  { key: 'dashboard', label: 'Dashboard', description: 'Panel principal con estadísticas', defaultRoles: ['admin', 'technician', 'client'] },
  { key: 'profile', label: 'Mi Perfil', description: 'Información personal del usuario', defaultRoles: ['admin', 'technician', 'client'] },
  { key: 'users', label: 'Gestión de Usuarios', description: 'Administrar usuarios del sistema', defaultRoles: ['admin'] },
  { key: 'clients', label: 'Gestión de Clientes', description: 'Ver y administrar clientes', defaultRoles: ['admin'] },
  { key: 'elevators', label: 'Gestión de Ascensores', description: 'Gestión completa de ascensores con información técnica, partes y piezas', defaultRoles: ['admin', 'technician', 'client'] },
  { key: 'maintenance-complete', label: 'Gestión de Mantenimientos', description: 'Control completo de mantenimientos', defaultRoles: ['admin'] },
  { key: 'maintenance-checklist', label: 'Checklist Mantenimiento', description: 'Realizar checklist de mantenimiento', defaultRoles: ['admin', 'technician'] },
  { key: 'emergencies', label: 'Emergencias (Técnico)', description: 'Gestión de emergencias para técnicos', defaultRoles: ['technician'] },
  { key: 'client-emergencies', label: 'Mis Emergencias', description: 'Ver emergencias propias', defaultRoles: ['client'] },
  { key: 'emergency-history', label: 'Historial de Emergencias', description: 'Histórico completo de emergencias', defaultRoles: ['admin'] },
  { key: 'work-orders', label: 'Órdenes de Trabajo', description: 'Gestionar órdenes de trabajo', defaultRoles: ['admin', 'technician'] },
  { key: 'routes', label: 'Rutas', description: 'Gestión de rutas de mantenimiento', defaultRoles: ['admin', 'technician'] },
  { key: 'quotations', label: 'Cotizaciones (Admin)', description: 'Gestión de cotizaciones', defaultRoles: ['admin'] },
  { key: 'client-quotations', label: 'Mis Cotizaciones', description: 'Ver cotizaciones propias', defaultRoles: ['client'] },
  { key: 'carpeta-cero', label: 'Carpeta Cero', description: 'Documentación legal y técnica', defaultRoles: ['admin', 'client'] },
  { key: 'rescue-training-admin', label: 'Capacitaciones de Rescate', description: 'Administrar capacitaciones', defaultRoles: ['admin'] },
  { key: 'rescue-training', label: 'Inducción de Rescate', description: 'Ver inducción de rescate', defaultRoles: ['client'] },
  { key: 'parts-inventory', label: 'Inventario de Repuestos', description: 'Control de inventario de repuestos', defaultRoles: ['admin'] },
  { key: 'manuals', label: 'Manuales Técnicos', description: 'Biblioteca de manuales', defaultRoles: ['admin', 'technician'] },
  { key: 'qr-codes-complete', label: 'Códigos QR', description: 'Gestión de códigos QR', defaultRoles: ['admin'] },
  { key: 'certifications', label: 'Certificaciones', description: 'Gestión de certificaciones', defaultRoles: ['admin'] },
  { key: 'statistics', label: 'Estadísticas', description: 'Reportes y estadísticas', defaultRoles: ['admin'] },
  { key: 'activity-history', label: 'Historial de Actividad', description: 'Registro de actividades', defaultRoles: ['admin', 'technician', 'client'] },
  { key: 'notifications', label: 'Notificaciones', description: 'Centro de notificaciones', defaultRoles: ['admin', 'technician', 'client'] },
  { key: 'audit-logs', label: 'Registro de Auditoría', description: 'Logs del sistema', defaultRoles: ['admin'] },
  { key: 'bulk-operations', label: 'Operaciones Masivas', description: 'Operaciones en lote', defaultRoles: ['admin'] },
  { key: 'developer-permissions', label: 'Gestión de Permisos', description: 'Control de permisos para todos los roles', defaultRoles: ['developer'] },
  { key: 'admin-permissions', label: 'Gestión de Permisos', description: 'Control de permisos para técnicos y clientes', defaultRoles: ['admin'] },
];

// Obtener vistas permitidas para un rol específico
export function getViewsForRole(role: 'admin' | 'technician' | 'client' | 'developer'): ViewPermission[] {
  return ALL_VIEWS.filter(view => view.defaultRoles.includes(role));
}

// Obtener vistas que un admin puede gestionar (técnico y cliente)
export function getManageableViews(managerRole: 'admin'): ViewPermission[] {
  if (managerRole === 'admin') {
    return ALL_VIEWS.filter(view =>
      view.defaultRoles.includes('technician') ||
      view.defaultRoles.includes('client')
    );
  }
  return [];
}

// Obtener todas las vistas que un developer puede gestionar (todas excepto developer)
export function getAllManageableViews(): ViewPermission[] {
  return ALL_VIEWS;
}
