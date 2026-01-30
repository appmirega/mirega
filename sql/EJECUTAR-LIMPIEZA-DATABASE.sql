-- ============================================================
-- LIMPIEZA DE BASE DE DATOS - LISTO PARA EJECUTAR
-- ============================================================
-- Fecha: 27 de Enero de 2026
-- 
-- Este script elimina:
-- ✓ TODOS los usuarios clientes
-- ✓ Todos los admin excepto daniel.retamales@mirega.cl
-- ✓ Todos los técnicos excepto jaurra.mirega@gmail.com
--
-- Conserva:
-- ✓ Usuarios Developer
-- ✓ Admin: Daniel Retamales
-- ✓ Técnico: Jaime Aurra
-- ============================================================

BEGIN;

-- ============================================================
-- PASO 1: ELIMINAR TODOS LOS CLIENTES Y SUS DATOS
-- ============================================================

DO $$
DECLARE
    v_client_record RECORD;
    v_deleted_count INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INICIANDO ELIMINACIÓN DE CLIENTES';
    RAISE NOTICE '========================================';
    
    -- Procesar cada cliente
    FOR v_client_record IN 
        SELECT 
            p.id as profile_id,
            p.email,
            p.full_name,
            c.id as client_id,
            c.company_name
        FROM profiles p
        LEFT JOIN clients c ON c.profile_id = p.id
        WHERE p.role = 'client'
    LOOP
        RAISE NOTICE 'Eliminando cliente: % (%) - Profile: %', 
            v_client_record.full_name, 
            v_client_record.email,
            v_client_record.profile_id;
        
        IF v_client_record.client_id IS NOT NULL THEN
            -- Eliminar ascensores
            DELETE FROM elevators WHERE client_id = v_client_record.client_id;
            
            -- Eliminar solicitudes de servicio
            DELETE FROM service_requests WHERE client_id = v_client_record.client_id;
            
            -- Eliminar emergencias
            DELETE FROM emergency_visits WHERE client_id = v_client_record.client_id;
            
            -- Eliminar asignaciones de mantenimiento
            DELETE FROM maintenance_assignments WHERE client_id = v_client_record.client_id;
            
            -- Eliminar órdenes de trabajo
            DELETE FROM work_orders WHERE client_id = v_client_record.client_id;
            
            -- Eliminar cotizaciones (si existe la tabla)
            DELETE FROM quotations WHERE client_id = v_client_record.client_id;
            
            -- Eliminar el registro de cliente
            DELETE FROM clients WHERE id = v_client_record.client_id;
        END IF;
        
        -- Eliminar notificaciones
        DELETE FROM notifications WHERE user_id = v_client_record.profile_id;
        
        -- Eliminar el perfil
        DELETE FROM profiles WHERE id = v_client_record.profile_id;
        
        -- Eliminar de auth.users
        DELETE FROM auth.users 
        WHERE id = v_client_record.profile_id;
        
        v_deleted_count := v_deleted_count + 1;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CLIENTES ELIMINADOS: %', v_deleted_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- PASO 2: ELIMINAR TÉCNICOS Y ADMIN (EXCEPTO LOS PERMITIDOS)
-- ============================================================

DO $$
DECLARE
    v_tech_record RECORD;
    v_deleted_count INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INICIANDO ELIMINACIÓN DE TÉCNICOS/ADMIN';
    RAISE NOTICE '========================================';
    
    -- Procesar cada técnico/admin (excepto los permitidos)
    FOR v_tech_record IN 
        SELECT 
            id as profile_id,
            email,
            full_name,
            role
        FROM profiles
        WHERE role IN ('technician', 'admin')
        -- CONSERVAR SOLO:
        -- Admin: daniel.retamales@mirega.cl
        -- Técnico: jaurra.mirega@gmail.com
        AND email NOT IN (
            'daniel.retamales@mirega.cl',
            'jaurra.mirega@gmail.com'
        )
    LOOP
        RAISE NOTICE 'Eliminando %: % (%)', 
            v_tech_record.role,
            v_tech_record.full_name, 
            v_tech_record.email;
        
        -- Eliminar asignaciones de mantenimiento
        DELETE FROM maintenance_assignments 
        WHERE assigned_technician_id = v_tech_record.profile_id;
        
        -- Eliminar turnos de emergencia
        DELETE FROM emergency_shifts 
        WHERE technician_id = v_tech_record.profile_id;
        
        -- Eliminar disponibilidad
        DELETE FROM technician_availability 
        WHERE technician_id = v_tech_record.profile_id;
        
        -- Eliminar notificaciones
        DELETE FROM notifications 
        WHERE user_id = v_tech_record.profile_id;
        
        -- Desasignar órdenes de trabajo
        UPDATE work_orders 
        SET assigned_technician_id = NULL 
        WHERE assigned_technician_id = v_tech_record.profile_id;
        
        -- Eliminar el perfil
        DELETE FROM profiles WHERE id = v_tech_record.profile_id;
        
        -- Eliminar de auth.users
        DELETE FROM auth.users 
        WHERE id = v_tech_record.profile_id;
        
        v_deleted_count := v_deleted_count + 1;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TÉCNICOS/ADMIN ELIMINADOS: %', v_deleted_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- PASO 3: LIMPIAR DATOS HUÉRFANOS
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE 'Limpiando datos huérfanos...';
END $$;

-- Eliminar clientes sin profile
DELETE FROM clients WHERE profile_id NOT IN (SELECT id FROM profiles);

-- Eliminar ascensores sin cliente
DELETE FROM elevators WHERE client_id NOT IN (SELECT id FROM clients);

-- Eliminar solicitudes sin cliente
DELETE FROM service_requests WHERE client_id NOT IN (SELECT id FROM clients);

-- Eliminar emergencias sin cliente
DELETE FROM emergency_visits WHERE client_id NOT IN (SELECT id FROM clients);

-- Eliminar asignaciones de mantenimiento sin cliente
DELETE FROM maintenance_assignments WHERE client_id NOT IN (SELECT id FROM clients);

-- ============================================================
-- PASO 4: VERIFICAR RESULTADO FINAL
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN FINAL';
    RAISE NOTICE '========================================';
END $$;

-- Contar usuarios por rol
SELECT 
    COALESCE(role, 'SIN ROL') as rol,
    COUNT(*) as cantidad
FROM profiles
GROUP BY role
ORDER BY cantidad DESC;

-- Ver usuarios restantes
SELECT 
    'USUARIO RESTANTE' as estado,
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles
ORDER BY role, created_at DESC;

-- Contar clientes restantes
SELECT 
    'CLIENTES RESTANTES' as info,
    COUNT(*) as cantidad 
FROM clients;

-- Contar ascensores restantes
SELECT 
    'ASCENSORES RESTANTES' as info,
    COUNT(*) as cantidad 
FROM elevators;

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'LIMPIEZA COMPLETADA EXITOSAMENTE';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- CONFIRMAR CAMBIOS
-- ============================================================

COMMIT;

-- ============================================================
-- RESULTADO ESPERADO:
-- ============================================================
-- Usuarios restantes:
-- - Developers (todos)
-- - Admin: daniel.retamales@mirega.cl
-- - Técnico: jaurra.mirega@gmail.com
-- - Clientes: 0
-- ============================================================
