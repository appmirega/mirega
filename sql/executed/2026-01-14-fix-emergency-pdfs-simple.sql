-- FIX SIMPLE PARA EMERGENCY-PDFS
-- Fecha: 14 de Enero 2026
-- Hacer que funcione igual que maintenance-pdfs

-- 1. Asegurar que el bucket existe con configuración pública
INSERT INTO storage.buckets (id, name, public)
VALUES ('emergency-pdfs', 'emergency-pdfs', true)
ON CONFLICT (id) 
DO UPDATE SET public = true;

-- 2. ELIMINAR políticas antiguas del bucket emergency-pdfs
DROP POLICY IF EXISTS "emergency_pdfs_public_select" ON storage.objects;
DROP POLICY IF EXISTS "emergency_pdfs_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "emergency_pdfs_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "emergency_pdfs_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "emergency_pdfs_public_read" ON storage.objects;
DROP POLICY IF EXISTS "emergency_pdfs_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "emergency_pdfs_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "emergency_pdfs_auth_delete" ON storage.objects;

-- 3. CREAR políticas súper permisivas (IGUAL QUE MAINTENANCE)
CREATE POLICY "emergency_pdfs_public_all"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'emergency-pdfs')
WITH CHECK (bucket_id = 'emergency-pdfs');

-- 4. Verificar que maintenance-pdfs también esté configurado igual
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-pdfs', 'maintenance-pdfs', true)
ON CONFLICT (id) 
DO UPDATE SET public = true;

-- Políticas para maintenance (por si acaso)
DROP POLICY IF EXISTS "maintenance_pdfs_public_all" ON storage.objects;
CREATE POLICY "maintenance_pdfs_public_all"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'maintenance-pdfs')
WITH CHECK (bucket_id = 'maintenance-pdfs');

-- 5. Verificar configuración
SELECT 
  b.id as bucket_name,
  b.public,
  COUNT(p.policyname) as policy_count
FROM storage.buckets b
LEFT JOIN pg_policies p ON p.tablename = 'objects' 
  AND p.schemaname = 'storage'
  AND p.qual::text LIKE '%' || b.id || '%'
WHERE b.id IN ('emergency-pdfs', 'maintenance-pdfs')
GROUP BY b.id, b.public;
