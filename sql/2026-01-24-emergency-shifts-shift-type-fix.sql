-- ============================================================
-- FIX: Alinear shift_type con la nueva lógica (primary/backup separados por is_primary)
-- Fecha: 2026-01-24
-- ============================================================

-- 1) Relajar constraint de shift_type para permitir valores actuales
ALTER TABLE emergency_shifts
DROP CONSTRAINT IF EXISTS emergency_shifts_shift_type_check;

ALTER TABLE emergency_shifts
ADD CONSTRAINT emergency_shifts_shift_type_check
CHECK (shift_type IN ('weekday','weekend','holiday','24x7'));

-- Justificación: is_primary ya guarda Principal/Respaldo, por lo que shift_type queda para tipo de cobertura (24x7 o weekday personalizado)

-- 2) Normalizar valores existentes inválidos (por si quedaron 'primary'/'backup')
UPDATE emergency_shifts
SET shift_type = '24x7'
WHERE shift_type NOT IN ('weekday','weekend','holiday','24x7');

SELECT '✅ shift_type check actualizado y datos normalizados' AS status;
