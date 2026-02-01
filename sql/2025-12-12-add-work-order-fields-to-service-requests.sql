-- Agregar campos para órdenes de trabajo interno
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS assigned_technicians TEXT[], -- Array de IDs de técnicos asignados
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS scheduled_time TIME,
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Comentarios
COMMENT ON COLUMN service_requests.assigned_technicians IS 'Array de IDs de técnicos asignados para trabajo interno';
COMMENT ON COLUMN service_requests.scheduled_date IS 'Fecha programada para la visita';
COMMENT ON COLUMN service_requests.scheduled_time IS 'Hora programada para la visita';
COMMENT ON COLUMN service_requests.estimated_hours IS 'Horas estimadas de trabajo';
COMMENT ON COLUMN service_requests.admin_notes IS 'Notas del administrador sobre la solicitud';
