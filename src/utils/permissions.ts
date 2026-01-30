// Definición de permisos disponibles por perfil

export const ADMIN_PERMISSIONS = [
  { key: 'admin:view_clients', label: 'Ver Clientes', category: 'Vistas' },
  { key: 'admin:create_clients', label: 'Crear Nuevos Clientes', category: 'Vistas' },
  { key: 'admin:view_elevators', label: 'Ver Ascensores', category: 'Vistas' },
  { key: 'admin:view_technicians', label: 'Ver Técnicos', category: 'Vistas' },
  { key: 'admin:view_maintenance', label: 'Ver Mantenimientos', category: 'Vistas' },
  { key: 'admin:view_emergencies', label: 'Ver Emergencias', category: 'Vistas' },
  { key: 'admin:view_quotations', label: 'Ver Cotizaciones', category: 'Vistas' },
  { key: 'admin:view_statistics', label: 'Ver Estadísticas', category: 'Vistas' },
  { key: 'admin:view_qr_codes', label: 'Ver Códigos QR', category: 'Vistas' },
  { key: 'admin:view_manuals', label: 'Ver Manuales', category: 'Vistas' },
  { key: 'admin:manage_permissions', label: 'Gestionar Permisos de Técnicos y Clientes', category: 'Funciones' },
];

export const TECHNICIAN_PERMISSIONS = [
  { key: 'technician:view_assigned_routes', label: 'Ver Rutas Asignadas', category: 'Vistas' },
  { key: 'technician:view_maintenance', label: 'Ver Mantenimientos', category: 'Vistas' },
  { key: 'technician:create_maintenance', label: 'Crear Registros de Mantenimiento', category: 'Funciones' },
  { key: 'technician:view_emergencies', label: 'Ver Emergencias', category: 'Vistas' },
  { key: 'technician:create_emergencies', label: 'Registrar Emergencias', category: 'Funciones' },
  { key: 'technician:view_work_orders', label: 'Ver Órdenes de Trabajo', category: 'Vistas' },
  { key: 'technician:close_work_orders', label: 'Cerrar Órdenes de Trabajo', category: 'Funciones' },
  { key: 'technician:view_elevators', label: 'Ver Ascensores', category: 'Vistas' },
  { key: 'technician:edit_elevator_parts', label: 'Editar Partes y Piezas de Ascensores', category: 'Funciones' },
  { key: 'technician:view_manuals', label: 'Ver Manuales Técnicos', category: 'Vistas' },
  { key: 'technician:scan_qr', label: 'Escanear Códigos QR', category: 'Funciones' },
];

export const CLIENT_PERMISSIONS = [
  { key: 'client:view_elevators', label: 'Ver Mis Ascensores', category: 'Vistas' },
  { key: 'client:view_technical_info', label: 'Ver Información Técnica', category: 'Vistas' },
  { key: 'client:view_maintenance_history', label: 'Ver Historial de Mantenimientos', category: 'Vistas' },
  { key: 'client:view_emergencies', label: 'Ver Emergencias', category: 'Vistas' },
  { key: 'client:request_service', label: 'Solicitar Servicios', category: 'Funciones' },
  { key: 'client:view_quotations', label: 'Ver Cotizaciones', category: 'Vistas' },
  { key: 'client:view_certifications', label: 'Ver Certificaciones', category: 'Vistas' },
  { key: 'client:view_qr_codes', label: 'Ver Códigos QR', category: 'Vistas' },
  { key: 'client:manage_documents', label: 'Gestionar Documentos Legales', category: 'Funciones' },
];

export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: ADMIN_PERMISSIONS.map(p => p.key),
  technician: TECHNICIAN_PERMISSIONS.map(p => p.key),
  client: CLIENT_PERMISSIONS.map(p => p.key),
};

export function groupPermissionsByCategory(permissions: typeof ADMIN_PERMISSIONS) {
  const grouped: Record<string, typeof permissions> = {};
  permissions.forEach(permission => {
    if (!grouped[permission.category]) {
      grouped[permission.category] = [];
    }
    grouped[permission.category].push(permission);
  });
  return grouped;
}
