-- Permitir que administradores también puedan crear solicitudes de servicio
-- Fecha: 2025-12-15

-- Eliminar política restrictiva actual si existe
DROP POLICY IF EXISTS "Technicians can create service requests" ON service_requests;

-- Crear nueva política que permita tanto técnicos como administradores crear solicitudes
CREATE POLICY "Technicians and admins can create service requests"
ON service_requests
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('technician', 'admin', 'super_admin')
  )
);

-- Verificar que la política se creó correctamente
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'service_requests'
AND cmd = 'INSERT';
