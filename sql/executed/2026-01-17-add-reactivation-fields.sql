-- =============================================
-- Agregar campos de reactivación a emergency_visits
-- Fecha: 2026-01-17
-- =============================================

-- Agregar campos para seguimiento de reactivación
ALTER TABLE emergency_visits
ADD COLUMN IF NOT EXISTS reactivation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reactivation_notes TEXT,
ADD COLUMN IF NOT EXISTS reactivated_by UUID REFERENCES auth.users(id);

-- Índice para buscar emergencias detenidas activas
CREATE INDEX IF NOT EXISTS idx_emergency_visits_stopped_active 
ON emergency_visits(final_status) 
WHERE final_status = 'stopped' AND reactivation_date IS NULL;

-- Comentarios
COMMENT ON COLUMN emergency_visits.reactivation_date IS 'Fecha cuando el ascensor fue puesto en funcionamiento nuevamente';
COMMENT ON COLUMN emergency_visits.reactivation_notes IS 'Notas sobre qué se realizó para reactivar el ascensor';
COMMENT ON COLUMN emergency_visits.reactivated_by IS 'Usuario que dio de alta el ascensor';
