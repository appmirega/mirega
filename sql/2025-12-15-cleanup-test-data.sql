-- Limpieza de datos de prueba: Solicitudes y Checklists
-- Fecha: 2025-12-15
-- ADVERTENCIA: Este script borra TODOS los registros de prueba

-- Contar registros antes de borrar
SELECT 
  'ANTES DE BORRAR' as momento,
  (SELECT COUNT(*) FROM service_requests) as solicitudes,
  (SELECT COUNT(*) FROM service_request_comments) as comentarios,
  (SELECT COUNT(*) FROM service_request_history) as historial,
  (SELECT COUNT(*) FROM service_request_notifications) as notificaciones,
  (SELECT COUNT(*) FROM mnt_checklists) as checklists,
  (SELECT COUNT(*) FROM mnt_checklist_answers) as respuestas_checklist;

-- PASO 1: Borrar notificaciones de solicitudes
DELETE FROM service_request_notifications;

-- PASO 2: Borrar historial de solicitudes
DELETE FROM service_request_history;

-- PASO 3: Borrar comentarios de solicitudes
DELETE FROM service_request_comments;

-- PASO 4: Borrar solicitudes de servicio
DELETE FROM service_requests;

-- PASO 5: Borrar respuestas de checklists
DELETE FROM mnt_checklist_answers;

-- PASO 6: Borrar checklists
DELETE FROM mnt_checklists;

-- Contar registros después de borrar
SELECT 
  'DESPUÉS DE BORRAR' as momento,
  (SELECT COUNT(*) FROM service_requests) as solicitudes,
  (SELECT COUNT(*) FROM service_request_comments) as comentarios,
  (SELECT COUNT(*) FROM service_request_history) as historial,
  (SELECT COUNT(*) FROM service_request_notifications) as notificaciones,
  (SELECT COUNT(*) FROM mnt_checklists) as checklists,
  (SELECT COUNT(*) FROM mnt_checklist_answers) as respuestas_checklist;

-- Mensaje de confirmación
SELECT '✅ Limpieza completada. Todos los datos de prueba han sido eliminados.' as resultado;
