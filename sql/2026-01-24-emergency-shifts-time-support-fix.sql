-- ============================================================
-- FIX: Turnos de emergencia con personal externo y horarios
-- Fecha: 2026-01-24
-- Contexto: Agregar columnas faltantes y recrear vista/funciones
-- ============================================================

-- 1) Agregar columnas de personal externo si no existen
ALTER TABLE emergency_shifts
ADD COLUMN IF NOT EXISTS external_personnel_name TEXT,
ADD COLUMN IF NOT EXISTS external_personnel_phone TEXT;

-- Permitir turnos con personal externo (technician_id opcional)
ALTER TABLE emergency_shifts
ALTER COLUMN technician_id DROP NOT NULL;

COMMENT ON COLUMN emergency_shifts.external_personnel_name IS 'Nombre del personal externo en turno de emergencia';
COMMENT ON COLUMN emergency_shifts.external_personnel_phone IS 'Teléfono del personal externo en turno de emergencia';

-- 2) Asegurar columnas de horario existen (por si el script anterior no corrió completo)
ALTER TABLE emergency_shifts 
ADD COLUMN IF NOT EXISTS shift_start_time TIME DEFAULT '00:00:00',
ADD COLUMN IF NOT EXISTS shift_end_time TIME DEFAULT '23:59:59',
ADD COLUMN IF NOT EXISTS is_24h_shift BOOLEAN DEFAULT true;

COMMENT ON COLUMN emergency_shifts.shift_start_time IS 'Hora de inicio del turno (ej: 08:30:00)';
COMMENT ON COLUMN emergency_shifts.shift_end_time IS 'Hora de fin del turno (ej: 17:59:00)';
COMMENT ON COLUMN emergency_shifts.is_24h_shift IS 'true = turno completo 24h, false = turno con horario específico';

-- 3) Normalizar datos existentes a 24h por defecto
UPDATE emergency_shifts 
SET is_24h_shift = true,
    shift_start_time = '00:00:00',
    shift_end_time = '23:59:59'
WHERE is_24h_shift IS NULL;

-- 4) Índice de horario (idempotente)
CREATE INDEX IF NOT EXISTS idx_emergency_shifts_time 
ON emergency_shifts(shift_start_date, shift_end_date, shift_start_time, shift_end_time);

-- 5) Recrear función get_calendar_by_month (incluye horas y personal externo)
CREATE OR REPLACE FUNCTION get_calendar_by_month(
  target_month TEXT,
  include_drafts BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  building_name TEXT,
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  assigned_to TEXT,
  assigned_technician_id UUID,
  external_personnel_name TEXT,
  status TEXT,
  display_status TEXT,
  is_fixed BOOLEAN,
  is_holiday_date BOOLEAN,
  requires_additional_technicians BOOLEAN,
  additional_technicians_count INT,
  coordination_notes TEXT,
  publication_status TEXT,
  published_at TIMESTAMPTZ,
  emergency_context_notes TEXT,
  emergency_technician_on_duty TEXT,
  emergency_shift_type TEXT,
  emergency_shift_hours TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  IF include_drafts THEN
    RETURN QUERY
    SELECT 
      ma.id,
      ma.client_id,
      ma.building_name,
      ma.scheduled_date,
      ma.scheduled_time_start,
      ma.scheduled_time_end,
      COALESCE(p.full_name, ma.external_personnel_name) AS assigned_to,
      ma.assigned_technician_id,
      ma.external_personnel_name,
      ma.status,
      CASE 
        WHEN ma.status = 'completed' THEN 'completed'
        WHEN ma.scheduled_date = CURRENT_DATE THEN 'today'
        WHEN ma.scheduled_date < CURRENT_DATE AND ma.status != 'completed' THEN 'overdue'
        ELSE 'upcoming'
      END AS display_status,
      ma.is_fixed,
      is_holiday(ma.scheduled_date) AS is_holiday_date,
      ma.requires_additional_technicians,
      ma.additional_technicians_count,
      ma.coordination_notes,
      ma.publication_status,
      ma.published_at,
      ma.emergency_context_notes,
      COALESCE(p_emergency.full_name, es.external_personnel_name) AS emergency_technician_on_duty,
      CASE 
        WHEN es.is_primary THEN 'Principal'
        ELSE 'Respaldo'
      END AS emergency_shift_type,
      CASE 
        WHEN es.is_24h_shift THEN '24h'
        ELSE es.shift_start_time::TEXT || ' - ' || es.shift_end_time::TEXT
      END AS emergency_shift_hours
    FROM maintenance_assignments ma
    LEFT JOIN profiles p ON ma.assigned_technician_id = p.id
    LEFT JOIN emergency_shifts es ON ma.scheduled_date BETWEEN es.shift_start_date AND es.shift_end_date
    LEFT JOIN profiles p_emergency ON es.technician_id = p_emergency.id
    WHERE ma.calendar_month = target_month
    ORDER BY ma.scheduled_date, ma.scheduled_time_start;
  ELSE
    RETURN QUERY
    SELECT 
      ma.id,
      ma.client_id,
      ma.building_name,
      ma.scheduled_date,
      ma.scheduled_time_start,
      ma.scheduled_time_end,
      COALESCE(p.full_name, ma.external_personnel_name) AS assigned_to,
      ma.assigned_technician_id,
      ma.external_personnel_name,
      ma.status,
      CASE 
        WHEN ma.status = 'completed' THEN 'completed'
        WHEN ma.scheduled_date = CURRENT_DATE THEN 'today'
        WHEN ma.scheduled_date < CURRENT_DATE AND ma.status != 'completed' THEN 'overdue'
        ELSE 'upcoming'
      END AS display_status,
      ma.is_fixed,
      is_holiday(ma.scheduled_date) AS is_holiday_date,
      ma.requires_additional_technicians,
      ma.additional_technicians_count,
      ma.coordination_notes,
      ma.publication_status,
      ma.published_at,
      ma.emergency_context_notes,
      COALESCE(p_emergency.full_name, es.external_personnel_name) AS emergency_technician_on_duty,
      CASE 
        WHEN es.is_primary THEN 'Principal'
        ELSE 'Respaldo'
      END AS emergency_shift_type,
      CASE 
        WHEN es.is_24h_shift THEN '24h'
        ELSE es.shift_start_time::TEXT || ' - ' || es.shift_end_time::TEXT
      END AS emergency_shift_hours
    FROM maintenance_assignments ma
    LEFT JOIN profiles p ON ma.assigned_technician_id = p.id
    LEFT JOIN emergency_shifts es ON ma.scheduled_date BETWEEN es.shift_start_date AND es.shift_end_date
    LEFT JOIN profiles p_emergency ON es.technician_id = p_emergency.id
    WHERE ma.calendar_month = target_month
      AND ma.publication_status = 'published'
    ORDER BY ma.scheduled_date, ma.scheduled_time_start;
  END IF;
END;
$$;

-- 6) Recrear función mensual de turnos (incluye externo)
CREATE OR REPLACE FUNCTION get_monthly_emergency_shifts(
  target_month TEXT
)
RETURNS TABLE (
  id UUID,
  technician_name TEXT,
  technician_phone TEXT,
  external_personnel_name TEXT,
  external_personnel_phone TEXT,
  shift_start_date DATE,
  shift_end_date DATE,
  shift_start_time TIME,
  shift_end_time TIME,
  is_24h_shift BOOLEAN,
  is_primary BOOLEAN,
  shift_type TEXT,
  week_number INT
) LANGUAGE plpgsql AS $$
DECLARE
  month_start DATE;
  month_end DATE;
BEGIN
  month_start := (target_month || '-01')::DATE;
  month_end := (month_start + INTERVAL '1 month - 1 day')::DATE;

  RETURN QUERY
  SELECT 
    es.id,
    p.full_name AS technician_name,
    p.phone AS technician_phone,
    es.external_personnel_name,
    es.external_personnel_phone,
    es.shift_start_date,
    es.shift_end_date,
    es.shift_start_time,
    es.shift_end_time,
    es.is_24h_shift,
    es.is_primary,
    es.shift_type,
    EXTRACT(WEEK FROM es.shift_start_date)::INT AS week_number
  FROM emergency_shifts es
  LEFT JOIN profiles p ON es.technician_id = p.id
  WHERE es.shift_start_date <= month_end
    AND es.shift_end_date >= month_start
  ORDER BY es.shift_start_date, es.shift_start_time, es.is_primary DESC;
END;
$$;

COMMENT ON FUNCTION get_monthly_emergency_shifts IS 'Obtiene turnos de emergencia con horarios y soporte externo para un mes';

-- 7) Recrear vista legible
CREATE OR REPLACE VIEW v_emergency_shifts_calendar AS
SELECT 
  es.id,
  es.shift_start_date,
  es.shift_end_date,
  EXTRACT(WEEK FROM es.shift_start_date) AS week_number,
  TO_CHAR(es.shift_start_date, 'DD/MM') || ' - ' || TO_CHAR(es.shift_end_date, 'DD/MM') AS week_range,
  COALESCE(p.full_name, es.external_personnel_name) AS technician_name,
  CASE 
    WHEN es.technician_id IS NOT NULL THEN 'Interno'
    ELSE 'Externo'
  END AS technician_type,
  CASE 
    WHEN es.is_24h_shift THEN 'Turno completo 24h'
    ELSE TO_CHAR(es.shift_start_time, 'HH24:MI') || ' - ' || TO_CHAR(es.shift_end_time, 'HH24:MI')
  END AS shift_hours,
  CASE 
    WHEN es.is_primary THEN 'Principal'
    ELSE 'Respaldo'
  END AS shift_role,
  COALESCE(p.phone, es.external_personnel_phone) AS contact_phone,
  es.notes
FROM emergency_shifts es
LEFT JOIN profiles p ON es.technician_id = p.id
ORDER BY es.shift_start_date, es.is_primary DESC, es.shift_start_time;

COMMENT ON VIEW v_emergency_shifts_calendar IS 'Vista del calendario de turnos de emergencia con información legible y personal externo';

-- ============================================================
SELECT '✅ Columnas externas agregadas y objetos recreados' AS status;
