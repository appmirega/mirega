-- Políticas RLS CORREGIDAS para Emergency Visits
-- Sin referencias a client_id en profiles

-- Habilitar RLS
ALTER TABLE emergency_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_visit_elevators ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores
DROP POLICY IF EXISTS "emergency_visits_select" ON emergency_visits;
DROP POLICY IF EXISTS "emergency_visits_insert" ON emergency_visits;
DROP POLICY IF EXISTS "emergency_visits_update" ON emergency_visits;
DROP POLICY IF EXISTS "emergency_visit_elevators_select" ON emergency_visit_elevators;
DROP POLICY IF EXISTS "emergency_visit_elevators_insert" ON emergency_visit_elevators;
DROP POLICY IF EXISTS "emergency_visit_elevators_update" ON emergency_visit_elevators;

-- ============================================
-- POLÍTICAS PARA emergency_visits
-- ============================================

-- SELECT: Developers, admins ven todo, técnicos solo lo suyo
CREATE POLICY "emergency_visits_select"
ON emergency_visits FOR SELECT
TO authenticated
USING (
  -- Developers y admins ven todo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('developer', 'admin')
  )
  OR
  -- Técnicos ven solo sus propias emergencias
  technician_id = auth.uid()
);

-- INSERT: Técnicos, admins y developers pueden crear
CREATE POLICY "emergency_visits_insert"
ON emergency_visits FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('developer', 'admin', 'technician')
  )
);

-- UPDATE: Técnicos sus propias, admins y developers todo
CREATE POLICY "emergency_visits_update"
ON emergency_visits FOR UPDATE
TO authenticated
USING (
  -- Developers y admins pueden actualizar todo
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('developer', 'admin')
  )
  OR
  -- Técnicos solo sus propias emergencias
  technician_id = auth.uid()
);

-- ============================================
-- POLÍTICAS PARA emergency_visit_elevators
-- ============================================

-- SELECT: Basado en el acceso a la emergencia principal
CREATE POLICY "emergency_visit_elevators_select"
ON emergency_visit_elevators FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM emergency_visits ev
    WHERE ev.id = emergency_visit_elevators.emergency_visit_id
    AND (
      -- Developers y admins ven todo
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('developer', 'admin')
      )
      OR
      -- Técnicos ven sus propias emergencias
      ev.technician_id = auth.uid()
    )
  )
);

-- INSERT: Técnicos, admins y developers pueden insertar
CREATE POLICY "emergency_visit_elevators_insert"
ON emergency_visit_elevators FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('developer', 'admin', 'technician')
  )
);

-- UPDATE: Mismo criterio que emergency_visits
CREATE POLICY "emergency_visit_elevators_update"
ON emergency_visit_elevators FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM emergency_visits ev
    WHERE ev.id = emergency_visit_elevators.emergency_visit_id
    AND (
      -- Developers y admins pueden actualizar todo
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('developer', 'admin')
      )
      OR
      -- Técnicos solo sus propias emergencias
      ev.technician_id = auth.uid()
    )
  )
);

SELECT 'Políticas RLS aplicadas correctamente' as status;
