-- ============================================
-- RESET COMPLETO: Borrar todos los clientes y datos relacionados
-- Fecha: 22 Enero 2026 - 20:55
-- Propósito: Limpiar datos de prueba y errores para partir desde cero
-- ============================================

-- ⚠️ ADVERTENCIA: Este script borra PERMANENTEMENTE todos los datos de clientes
-- Asegúrate de tener un backup antes de ejecutar

-- ============================================
-- PASO 1: BACKUP VISUAL (Revisar antes de borrar)
-- ============================================

-- Ver cuántos registros se borrarán
SELECT 'profiles de clientes' as tabla, COUNT(*) as registros FROM profiles WHERE role = 'client'
UNION ALL
SELECT 'clients' as tabla, COUNT(*) FROM clients
UNION ALL
SELECT 'elevators' as tabla, COUNT(*) FROM elevators
UNION ALL
SELECT 'maintenance_schedules' as tabla, COUNT(*) FROM maintenance_schedules
UNION ALL
SELECT 'emergency_visits_v2' as tabla, COUNT(*) FROM emergency_visits_v2
UNION ALL
SELECT 'service_requests' as tabla, COUNT(*) FROM service_requests
UNION ALL
SELECT 'quotations_v2' as tabla, COUNT(*) FROM quotations_v2;


-- ============================================
-- PASO 2: BORRADO EN ORDEN (Respetando Foreign Keys)
-- ============================================

-- IMPORTANTE: Ejecutar UNO POR UNO y verificar cada paso

-- 1. Borrar quotation_items (detalles de cotizaciones)
DELETE FROM quotation_items
WHERE quotation_id IN (
    SELECT q.id FROM quotations_v2 q
    JOIN elevators e ON e.id = q.elevator_id
    JOIN clients c ON c.id = e.client_id
);

-- 2. Borrar quotation_approvals (aprobaciones)
DELETE FROM quotation_approvals
WHERE quotation_id IN (
    SELECT q.id FROM quotations_v2 q
    JOIN elevators e ON e.id = q.elevator_id
    JOIN clients c ON c.id = e.client_id
);

-- 3. Borrar quotations_v2
DELETE FROM quotations_v2
WHERE elevator_id IN (
    SELECT e.id FROM elevators e
    JOIN clients c ON c.id = e.client_id
);

-- 4. Borrar service_requests (solicitudes de servicio)
DELETE FROM service_requests
WHERE client_id IN (SELECT id FROM clients);

-- 5. Borrar emergency_visits_v2 (emergencias)
DELETE FROM emergency_visits_v2
WHERE elevator_id IN (
    SELECT e.id FROM elevators e
    JOIN clients c ON c.id = e.client_id
);

-- 6. Borrar maintenance_checklist_answers (respuestas de checklist)
DELETE FROM maintenance_checklist_answers
WHERE schedule_id IN (
    SELECT ms.id FROM maintenance_schedules ms
    JOIN elevators e ON e.id = ms.elevator_id
    JOIN clients c ON c.id = e.client_id
);

-- 7. Borrar maintenance_schedules (programación de mantenimientos)
DELETE FROM maintenance_schedules
WHERE elevator_id IN (
    SELECT e.id FROM elevators e
    JOIN clients c ON c.id = e.client_id
);

-- 8. Borrar elevators (ascensores)
DELETE FROM elevators
WHERE client_id IN (SELECT id FROM clients);

-- 9. Borrar clients (clientes)
DELETE FROM clients;

-- 10. Borrar profiles de tipo 'client' (usuarios)
-- NOTA: Solo borra los profiles que NO están vinculados a nada más
DELETE FROM profiles
WHERE role = 'client';


-- ============================================
-- PASO 3: VERIFICACIÓN POST-BORRADO
-- ============================================

-- Verificar que todo está limpio
SELECT 'profiles de clientes' as tabla, COUNT(*) as registros FROM profiles WHERE role = 'client'
UNION ALL
SELECT 'clients' as tabla, COUNT(*) FROM clients
UNION ALL
SELECT 'elevators' as tabla, COUNT(*) FROM elevators
UNION ALL
SELECT 'maintenance_schedules' as tabla, COUNT(*) FROM maintenance_schedules
UNION ALL
SELECT 'emergency_visits_v2' as tabla, COUNT(*) FROM emergency_visits_v2
UNION ALL
SELECT 'service_requests' as tabla, COUNT(*) FROM service_requests
UNION ALL
SELECT 'quotations_v2' as tabla, COUNT(*) FROM quotations_v2;

-- Verificar que los usuarios admin/tech/dev están intactos
SELECT 
    role,
    COUNT(*) as cantidad
FROM profiles
GROUP BY role
ORDER BY role;


-- ============================================
-- PASO 4: RESET DE SECUENCIAS (Opcional)
-- ============================================

-- Si quieres que los IDs vuelvan a empezar desde 1, ejecuta esto:
-- (Solo si usas secuencias numéricas, no UUID)

/*
ALTER SEQUENCE clients_id_seq RESTART WITH 1;
ALTER SEQUENCE elevators_id_seq RESTART WITH 1;
ALTER SEQUENCE maintenance_schedules_id_seq RESTART WITH 1;
*/


-- ============================================
-- RESULTADO ESPERADO
-- ============================================

-- Después de ejecutar este script:
-- ✅ 0 clientes
-- ✅ 0 ascensores
-- ✅ 0 mantenimientos
-- ✅ 0 emergencias
-- ✅ 0 solicitudes
-- ✅ 0 cotizaciones
-- ✅ 0 profiles de tipo 'client'
-- ✅ Usuarios admin/technician/developer INTACTOS
