-- Permitir eliminación de borradores de emergencias
-- Fecha: 16 de Enero 2026

-- Eliminar políticas antiguas de DELETE
DROP POLICY IF EXISTS "emergency_visits_delete" ON emergency_visits;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar sus propias visitas" ON emergency_visits;

-- Crear política de DELETE que permita eliminar borradores propios
CREATE POLICY "emergency_visits_delete_own_drafts"
ON emergency_visits FOR DELETE
TO authenticated
USING (
  auth.uid() = technician_id 
  AND status = 'draft'
);

-- Verificar políticas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'emergency_visits'
ORDER BY cmd, policyname;
