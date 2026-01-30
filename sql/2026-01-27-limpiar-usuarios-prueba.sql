-- ============================================================
-- SCRIPT DE LIMPIEZA: Eliminar Usuarios de Prueba
-- ============================================================
-- Fecha: 27 de Enero de 2026
-- 
-- ⚠️ ADVERTENCIA: Este script eliminará TODOS los usuarios clientes
-- y usuarios de prueba (admin, técnicos duplicados).
--
-- CONSERVARÁ:
-- - Usuario Developer principal
-- - Usuarios Admin/Técnicos NO duplicados (si los hay)
--
-- ============================================================

BEGIN;

-- ============================================================
-- PASO 1: VER QUÉ SE VA A ELIMINAR (PRIMERO REVISAR)
-- ============================================================

-- Ver todos los usuarios clientes
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as nombre,
    created_at,
    'CLIENTE' as tipo
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'client'
ORDER BY created_at DESC;

-- Ver usuarios técnicos y admin (revisar duplicados)
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as nombre,
    raw_user_meta_data->>'role' as rol,
    created_at
FROM auth.users
WHERE raw_user_meta_data->>'role' IN ('technician', 'admin')
ORDER BY email, created_at DESC;

-- Ver usuarios developer (NO SE ELIMINARÁN)
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as nombre,
    created_at
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'developer'
ORDER BY created_at DESC;

-- ============================================================
-- ⚠️ SI ESTÁS CONFORME CON LO QUE SE VA A ELIMINAR, 
-- DESCOMENTA LAS SIGUIENTES LÍNEAS
-- ============================================================

/*

-- ============================================================
-- PASO 2: ELIMINAR DATOS RELACIONADOS
-- ============================================================

-- 2.1 Eliminar todos los clientes y sus datos relacionados
DO $$
DECLARE
    client_profile_id UUID;
BEGIN
    -- Obtener todos los profile_id de clientes
    FOR client_profile_id IN 
        SELECT id FROM profiles WHERE role = 'client'
    LOOP
        -- Eliminar ascensores del cliente
        DELETE FROM elevators WHERE client_id IN (
            SELECT id FROM clients WHERE profile_id = client_profile_id
        );
        
        -- Eliminar solicitudes de servicio
        DELETE FROM service_requests WHERE client_id IN (
            SELECT id FROM clients WHERE profile_id = client_profile_id
        );
        
        -- Eliminar emergencias
        DELETE FROM emergency_visits WHERE client_id IN (
            SELECT id FROM clients WHERE profile_id = client_profile_id
        );
        
        -- Eliminar mantenimientos
        DELETE FROM maintenance_checklists WHERE client_id IN (
            SELECT id FROM clients WHERE profile_id = client_profile_id
        );
        
        -- Eliminar órdenes de trabajo
        DELETE FROM work_orders WHERE client_id IN (
            SELECT id FROM clients WHERE profile_id = client_profile_id
        );
        
        -- Eliminar notificaciones
        DELETE FROM notifications WHERE user_id = client_profile_id;
        
        -- Eliminar el cliente
        DELETE FROM clients WHERE profile_id = client_profile_id;
        
        -- Eliminar el perfil
        DELETE FROM profiles WHERE id = client_profile_id;
        
        RAISE NOTICE 'Cliente eliminado: %', client_profile_id;
    END LOOP;
END $$;

-- 2.2 Eliminar técnicos y admin duplicados o de prueba
-- NOTA: Modifica el WHERE para especificar qué usuarios eliminar
DO $$
DECLARE
    tech_profile_id UUID;
    tech_email TEXT;
BEGIN
    -- Eliminar técnicos/admin de prueba (ajusta el criterio según necesites)
    FOR tech_profile_id, tech_email IN 
        SELECT p.id, p.email 
        FROM profiles p
        WHERE p.role IN ('technician', 'admin')
        -- Criterios de usuarios de prueba (AJUSTAR SEGÚN NECESIDAD):
        AND (
            p.email LIKE '%@test.com' OR
            p.email LIKE '%prueba%' OR
            p.email LIKE '%test%' OR
            p.full_name LIKE '%Test%' OR
            p.full_name LIKE '%Prueba%' OR
            -- Agrega más criterios aquí si es necesario
            p.created_at < '2026-01-20'::timestamp  -- Usuarios creados antes de esta fecha
        )
    LOOP
        -- Eliminar asignaciones de mantenimiento
        DELETE FROM maintenance_assignments WHERE technician_id = tech_profile_id;
        
        -- Eliminar turnos de emergencia
        DELETE FROM emergency_shifts WHERE technician_id = tech_profile_id;
        
        -- Eliminar ausencias
        DELETE FROM technician_absences WHERE technician_id = tech_profile_id;
        
        -- Eliminar notificaciones
        DELETE FROM notifications WHERE user_id = tech_profile_id;
        
        -- Eliminar órdenes de trabajo asignadas
        UPDATE work_orders SET assigned_technician_id = NULL WHERE assigned_technician_id = tech_profile_id;
        
        -- Eliminar el perfil
        DELETE FROM profiles WHERE id = tech_profile_id;
        
        RAISE NOTICE 'Técnico/Admin eliminado: % (%)', tech_email, tech_profile_id;
    END LOOP;
END $$;

-- ============================================================
-- PASO 3: ELIMINAR USUARIOS DE AUTH.USERS
-- ============================================================

-- 3.1 Eliminar usuarios clientes de auth.users
DELETE FROM auth.users
WHERE raw_user_meta_data->>'role' = 'client';

-- 3.2 Eliminar técnicos/admin de prueba de auth.users
-- NOTA: Ajusta el WHERE según los criterios usados arriba
DELETE FROM auth.users
WHERE raw_user_meta_data->>'role' IN ('technician', 'admin')
AND (
    email LIKE '%@test.com' OR
    email LIKE '%prueba%' OR
    email LIKE '%test%' OR
    raw_user_meta_data->>'full_name' LIKE '%Test%' OR
    raw_user_meta_data->>'full_name' LIKE '%Prueba%' OR
    created_at < '2026-01-20'::timestamp
);

-- ============================================================
-- PASO 4: LIMPIAR TABLAS HUÉRFANAS
-- ============================================================

-- Eliminar clientes sin profile
DELETE FROM clients WHERE profile_id NOT IN (SELECT id FROM profiles);

-- Eliminar ascensores sin cliente
DELETE FROM elevators WHERE client_id NOT IN (SELECT id FROM clients);

-- Eliminar solicitudes sin cliente
DELETE FROM service_requests WHERE client_id NOT IN (SELECT id FROM clients);

-- ============================================================
-- PASO 5: RESETEAR SECUENCIAS (OPCIONAL)
-- ============================================================

-- Resetear contador de códigos de cliente
-- (No es necesario si usas códigos basados en timestamp)

-- ============================================================
-- PASO 6: VERIFICAR RESULTADO
-- ============================================================

-- Ver cuántos usuarios quedan por rol
SELECT 
    raw_user_meta_data->>'role' as rol,
    COUNT(*) as cantidad
FROM auth.users
GROUP BY raw_user_meta_data->>'role'
ORDER BY cantidad DESC;

-- Ver perfiles que quedan
SELECT 
    role,
    COUNT(*) as cantidad
FROM profiles
GROUP BY role
ORDER BY cantidad DESC;

-- Ver clientes que quedan
SELECT COUNT(*) as clientes_restantes FROM clients;

-- ============================================================
-- CONFIRMAR CAMBIOS
-- ============================================================

COMMIT;  -- Descomenta esto para confirmar los cambios

-- Si quieres revertir, usa: ROLLBACK;

*/

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================

-- INSTRUCCIONES:
-- 1. Primero ejecuta el script SIN descomentar el bloque de eliminación
-- 2. Revisa los resultados de las consultas SELECT
-- 3. Si estás conforme, descomenta el bloque /* ... */ y ejecuta nuevamente
-- 4. Verifica los resultados finales

ROLLBACK;  -- Por seguridad, usar ROLLBACK hasta descomentar el bloque de eliminación
