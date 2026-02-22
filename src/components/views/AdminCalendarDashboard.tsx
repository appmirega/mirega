Resumen de funcionamiento general del calendario (con nombres de archivos):

1. Vista principal de calendario para perfil admin

Archivo: AdminCalendarDashboard.tsx
Muestra el calendario mensual con asignaciones, turnos de emergencia y eventos personalizados.
Consulta datos de las tablas maintenance_schedules, emergency_visits, work_orders, emergency_shifts y calendar_events.
Permite crear eventos, planificar mantenimientos masivos (abre MaintenanceMassPlannerV2.tsx), y gestionar turnos de emergencia.
Refresca datos mediante fetchEventos, que actualiza el estado del calendario tras cambios.
2. Vista de calendario para técnico

Archivo: TechnicianCalendarView.tsx
Muestra al técnico sus asignaciones y eventos relevantes.
Consulta principalmente maintenance_schedules para mostrar los trabajos asignados al técnico.
Permite ver detalles de cada asignación y posiblemente interactuar (confirmar, reportar, etc.).
3. Interacción entre ambas vistas

Ambas vistas consultan maintenance_schedules para mostrar asignaciones.
Los cambios realizados por el admin (por ejemplo, nuevas asignaciones) deberían reflejarse en la vista del técnico si se insertan en maintenance_schedules.
Si el admin usa MaintenanceMassPlannerV2.tsx, las asignaciones se guardan en maintenance_assignments, que no se refleja automáticamente en la vista del técnico ni en el dashboard admin, salvo que haya sincronización.
4. Solicitudes de clientes y técnicos dentro del calendario

Los clientes generan solicitudes (work_orders, emergency_visits, etc.) que se almacenan en sus respectivas tablas.
El admin puede ver y gestionar estas solicitudes en el dashboard (AdminCalendarDashboard.tsx), asignarlas a técnicos y planificar eventos.
