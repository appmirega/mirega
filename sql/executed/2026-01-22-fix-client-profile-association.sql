-- ============================================
-- FIX: Asociar profile_id con cliente correcto
-- Fecha: 22 Enero 2026
-- Problema: Profile 11977218-7de7-473a-b95d-d9ed81bddfa9 sin cliente
-- ============================================

-- PASO 1: DIAGNÓSTICO
-- Ver el perfil del usuario
SELECT 
    id,
    email,
    full_name,
    role
FROM profiles
WHERE id = '11977218-7de7-473a-b95d-d9ed81bddfa9';

-- Ver todos los clientes sin profile_id asignado
SELECT 
    id,
    company_name,
    building_name,
    internal_alias,
    profile_id,
    address
FROM clients
WHERE profile_id IS NULL
ORDER BY building_name;

-- Ver clientes que podrían coincidir por nombre
-- (Buscar "Loft" o "Violetas")
SELECT 
    id,
    company_name,
    building_name,
    internal_alias,
    profile_id,
    address
FROM clients
WHERE 
    LOWER(company_name) LIKE '%loft%' 
    OR LOWER(building_name) LIKE '%loft%'
    OR LOWER(internal_alias) LIKE '%loft%'
    OR LOWER(company_name) LIKE '%violetas%'
    OR LOWER(building_name) LIKE '%violetas%'
    OR LOWER(internal_alias) LIKE '%violetas%';

-- Ver si el profile tiene email que coincida con algún cliente
SELECT 
    p.id as profile_id,
    p.email,
    p.full_name,
    p.role,
    c.id as client_id,
    c.company_name,
    c.building_name as client_building_name,
    c.internal_alias,
    c.profile_id as current_profile_id
FROM profiles p
LEFT JOIN clients c ON c.profile_id IS NULL
WHERE p.id = '11977218-7de7-473a-b95d-d9ed81bddfa9'
ORDER BY c.building_name;


-- ============================================
-- PASO 2: SOLUCIÓN (EJECUTAR SOLO UNA VEZ IDENTIFICADO EL CLIENT_ID CORRECTO)
-- ============================================

-- OPCIÓN A: Si el cliente existe pero no tiene profile_id
-- Reemplazar 'CLIENT_ID_AQUI' con el ID correcto del cliente
/*
UPDATE clients
SET profile_id = '11977218-7de7-473a-b95d-d9ed81bddfa9'
WHERE id = 'CLIENT_ID_AQUI';
*/

-- OPCIÓN B: Si encontramos el cliente por nombre (Ejemplo: "Edificio Loft")
-- Descomentar y modificar según corresponda:
/*
UPDATE clients
SET profile_id = '11977218-7de7-473a-b95d-d9ed81bddfa9'
WHERE LOWER(building_name) LIKE '%loft%'
RETURNING id, company_name, building_name, profile_id;
*/

/*
UPDATE clients
SET profile_id = '11977218-7de7-473a-b95d-d9ed81bddfa9'
WHERE LOWER(building_name) LIKE '%violetas%'
RETURNING id, company_name, building_name, profile_id;
*/


-- ============================================
-- PASO 3: VERIFICACIÓN
-- ============================================

-- Verificar que el profile ahora tiene cliente
SELECT 
    p.id as profile_id,
    p.email,
    p.full_name,
    p.role,
    c.id as client_id,
    c.company_name,
    c.building_name,
    c.internal_alias
FROM profiles p
LEFT JOIN clients c ON c.profile_id = p.id
WHERE p.id = '11977218-7de7-473a-b95d-d9ed81bddfa9';

-- Verificar que el cliente tiene ascensores
SELECT 
    e.id,
    e.elevator_number,
    e.location_name,
    e.brand,
    e.model,
    e.client_id
FROM elevators e
WHERE e.client_id = (
    SELECT id FROM clients WHERE profile_id = '11977218-7de7-473a-b95d-d9ed81bddfa9'
);

-- Verificar que hay mantenimientos para esos ascensores
SELECT 
    ms.id,
    ms.year,
    ms.month,
    ms.status,
    ms.completion_date,
    ms.pdf_url,
    e.elevator_number,
    e.location_name
FROM maintenance_schedules ms
JOIN elevators e ON e.id = ms.elevator_id
WHERE e.client_id = (
    SELECT id FROM clients WHERE profile_id = '11977218-7de7-473a-b95d-d9ed81bddfa9'
)
ORDER BY ms.year DESC, ms.month DESC
LIMIT 20;

-- Verificar que hay emergencias para esos ascensores
SELECT 
    ev.id,
    ev.visit_date,
    ev.visit_time,
    ev.technician_name,
    ev.failure_category,
    e.elevator_number,
    e.location_name
FROM emergency_visits_v2 ev
JOIN elevators e ON e.id = ev.elevator_id
WHERE e.client_id = (
    SELECT id FROM clients WHERE profile_id = '11977218-7de7-473a-b95d-d9ed81bddfa9'
)
ORDER BY ev.visit_date DESC, ev.visit_time DESC
LIMIT 20;
