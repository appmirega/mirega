-- Limpieza de emails duplicados en tabla profiles
-- Ejecutar este script en Supabase SQL Editor para limpiar registros huérfanos

-- 1. Primero, ver qué profiles existen y cuáles son duplicados
-- SELECT email, COUNT(*) as count FROM public.profiles GROUP BY LOWER(email) HAVING COUNT(*) > 1;

-- 2. Eliminar profiles con emails que no son de los usuarios permitidos
-- Usuarios permitidos (dev, daniel, jaime):
DELETE FROM public.profiles 
WHERE LOWER(email) NOT IN (
  LOWER('dev@mirega.local'),
  LOWER('daniel.retamales@mirega.cl'),
  LOWER('jaime.santiago@mirega.cl')
);

-- 3. Verificar que la limpieza fue correcta
SELECT id, email, role, created_at FROM public.profiles ORDER BY created_at;
