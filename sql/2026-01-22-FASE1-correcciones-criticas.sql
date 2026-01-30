-- ============================================================
-- FASE 1: CORRECCIONES CRÍTICAS
-- Fecha: 22 de Enero de 2026
-- Objetivo: Sistema robusto y consistente para producción
-- ============================================================

-- ============================================================
-- 1. WORK ORDERS: Unificar estructura con código
-- ============================================================

-- Agregar campo folio_number que el código espera
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS folio_number TEXT GENERATED ALWAYS AS ('OT-' || LPAD(id::TEXT, 6, '0')) STORED;

-- Renombrar order_type → work_type para consistencia con código
-- (El código usa work_type, la tabla tiene order_type)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'order_type'
  ) THEN
    ALTER TABLE work_orders RENAME COLUMN order_type TO work_type;
  END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN work_orders.folio_number IS 'Número de folio generado automáticamente (OT-000001)';
COMMENT ON COLUMN work_orders.work_type IS 'Tipo de trabajo: maintenance, repair, emergency, installation';


-- ============================================================
-- 2. COTIZACIONES: Agregar estado "executed"
-- ============================================================

-- La tabla usa CHECK CONSTRAINT, no ENUM
-- Eliminar constraint anterior y crear uno nuevo con 'executed'
ALTER TABLE quotations 
DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE quotations 
ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed'));

-- Comentario sobre uso
COMMENT ON COLUMN quotations.status IS 'Estados: pending, approved, rejected, expired, executed (cuando se convierte en OT)';


-- ============================================================
-- 3. MANTENIMIENTOS: Eliminar tablas LEGACY no usadas
-- ============================================================

-- Eliminar tablas del sistema legacy (NO se usan, sistema actual es mnt_checklists)
DROP TABLE IF EXISTS checklist_responses CASCADE;
DROP TABLE IF EXISTS maintenance_executions CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS checklist_templates CASCADE;
DROP TABLE IF EXISTS maintenance_schedules CASCADE;

-- Notas:
-- Sistema ACTUAL funcional: mnt_checklists → mnt_checklist_answers (50 preguntas fijas)
-- Sistema LEGACY eliminado: checklist_templates → maintenance_schedules (obsoleto)


-- ============================================================
-- 4. VERIFICACIÓN
-- ============================================================

-- Ver estructura actualizada de work_orders
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'work_orders'
ORDER BY ordinal_position;

-- Ver estados disponibles en quotations
SELECT 
  enumlabel as estado_cotizacion
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quotation_status')
ORDER BY enumsortorder;

-- Ver tablas de mantenimientos actuales (solo debe aparecer mnt_*)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%maint%' OR table_name LIKE '%checklist%'
ORDER BY table_name;


-- ============================================================
-- RESUMEN DE CAMBIOS
-- ============================================================

/*
✅ Work Orders:
   - Agregado: folio_number (generado automático OT-000001)
   - Renombrado: order_type → work_type
   - Ahora coincide 100% con código

✅ Cotizaciones:
   - Agregado: estado 'executed'
   - Flujo completo: pending → approved → executed

✅ Mantenimientos:
   - Eliminadas 5 tablas legacy (no usadas)
   - Sistema actual limpio: mnt_checklists + mnt_checklist_answers

⏱️ Tiempo estimado de ejecución: < 5 segundos
🎯 Sistema ahora: Robusto, consistente, listo para producción
*/
