-- =====================================================
-- SISTEMA DE PUBLICACIÓN DE CALENDARIOS
-- Fecha: 2026-01-24
-- Descripción: Sistema para crear calendarios en borrador,
--              publicarlos, y coordinar múltiples tareas
-- =====================================================

-- 1. AGREGAR CAMPOS DE PUBLICACIÓN A maintenance_assignments
-- ============================================================

ALTER TABLE maintenance_assignments
ADD COLUMN IF NOT EXISTS calendar_month TEXT, -- '2026-02' formato YYYY-MM
ADD COLUMN IF NOT EXISTS publication_status TEXT DEFAULT 'draft', -- 'draft', 'published', 'archived'
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES profiles(id);

-- 2. AGREGAR CAMPOS DE COORDINACIÓN
-- ==================================

ALTER TABLE maintenance_assignments
ADD COLUMN IF NOT EXISTS requires_additional_technicians BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS additional_technicians_count INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS coordination_notes TEXT;

-- 3. ACTUALIZAR ASSIGNMENTS EXISTENTES
-- =====================================
-- Asignar mes basado en scheduled_date y publicar automáticamente

UPDATE maintenance_assignments
SET 
  calendar_month = TO_CHAR(scheduled_date, 'YYYY-MM'),
  publication_status = 'published'
WHERE calendar_month IS NULL;

-- 3.1 VINCULAR EMERGENCIAS CON MANTENIMIENTOS
-- ============================================
-- Agregar referencia a emergencias previas del edificio

ALTER TABLE maintenance_assignments
ADD COLUMN IF NOT EXISTS related_emergency_visits UUID[], -- Array de IDs de emergency_visits
ADD COLUMN IF NOT EXISTS emergency_context_notes TEXT; -- Notas automáticas de emergencias previas

-- 3.2 TABLA DE ALERTAS PARA ADMINISTRADOR
-- ========================================

CREATE TABLE IF NOT EXISTS calendar_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'new_support_request', 'coordination_needed', 'auto_published'
  calendar_month TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  source_type TEXT, -- 'maintenance', 'work_order', 'service_request'
  source_id UUID,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_for UUID REFERENCES profiles(id) -- Admin específico
);

CREATE INDEX IF NOT EXISTS idx_calendar_alerts_month ON calendar_alerts(calendar_month);
CREATE INDEX IF NOT EXISTS idx_calendar_alerts_unread ON calendar_alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_calendar_alerts_admin ON calendar_alerts(created_for);

-- 4. ÍNDICES PARA OPTIMIZACIÓN
-- =============================

CREATE INDEX IF NOT EXISTS idx_maintenance_assignments_calendar_month 
ON maintenance_assignments(calendar_month);

CREATE INDEX IF NOT EXISTS idx_maintenance_assignments_publication_status 
ON maintenance_assignments(publication_status);

CREATE INDEX IF NOT EXISTS idx_maintenance_assignments_month_status 
ON maintenance_assignments(calendar_month, publication_status);

CREATE INDEX IF NOT EXISTS idx_maintenance_assignments_requires_help 
ON maintenance_assignments(requires_additional_technicians) 
WHERE requires_additional_technicians = TRUE;

-- 5. FUNCIÓN: Obtener calendario por mes y rol
-- =============================================

CREATE OR REPLACE FUNCTION get_calendar_by_month(
  target_month TEXT, -- '2026-02'
  user_role TEXT     -- 'admin', 'technician'
)
RETURNS TABLE (
  id UUID,
  building_id UUID,
  building_name TEXT,
  client_name TEXT,
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  assigned_to TEXT,
  assigned_technician_id UUID,
  is_external BOOLEAN,
  external_personnel_name TEXT,
  status TEXT,
  display_status TEXT,
  is_fixed BOOLEAN,
  is_holiday_date BOOLEAN,
  requires_additional_technicians BOOLEAN,
  additional_technicians_count INT,
  coordination_notes TEXT,
  publication_status TEXT,
  published_at TIMESTAMP,
  emergency_context_notes TEXT,
  emergency_technician_on_duty TEXT,
  emergency_technician_type TEXT
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Admin ve todo (borrador + publicado)
  IF user_role = 'admin' OR user_role = 'developer' THEN
    RETURN QUERY
    SELECT 
      ma.id,
      ma.building_id,
      b.name AS building_name,
      c.company_name AS client_name,
      ma.scheduled_date,
      ma.scheduled_time_start,
      ma.scheduled_time_end,
      COALESCE(p.full_name, ma.external_personnel_name) AS assigned_to,
      ma.assigned_technician_id,
      ma.is_external,
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
      es.shift_type AS emergency_technician_type
    FROM maintenance_assignments ma
    LEFT JOIN buildings b ON ma.building_id = b.id
    LEFT JOIN clients c ON b.client_id = c.id
    LEFT JOIN profiles p ON ma.assigned_technician_id = p.id
    LEFT JOIN emergency_shifts es ON ma.scheduled_date BETWEEN es.shift_start_date AND es.shift_end_date
      AND es.shift_type = 'primary'
    LEFT JOIN profiles p_emergency ON es.technician_id = p_emergency.id
    WHERE ma.calendar_month = target_month
    ORDER BY ma.scheduled_date, ma.scheduled_time_start;
  
  -- Técnico ve TODO lo publicado (propios + compañeros)
  ELSE
    RETURN QUERY
    SELECT 
      ma.id,
      ma.building_id,
      b.name AS building_name,
      c.company_name AS client_name,
      ma.scheduled_date,
      ma.scheduled_time_start,
      ma.scheduled_time_end,
      COALESCE(p.full_name, ma.external_personnel_name) AS assigned_to,
      ma.assigned_technician_id,
      ma.is_external,
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
      es.shift_type AS emergency_technician_type
    FROM maintenance_assignments ma
    LEFT JOIN buildings b ON ma.building_id = b.id
    LEFT JOIN clients c ON b.client_id = c.id
    LEFT JOIN profiles p ON ma.assigned_technician_id = p.id
    LEFT JOIN emergency_shifts es ON ma.scheduled_date BETWEEN es.shift_start_date AND es.shift_end_date
      AND es.shift_type = 'primary'
    LEFT JOIN profiles p_emergency ON es.technician_id = p_emergency.id
    WHERE ma.calendar_month = target_month
      AND ma.publication_status = 'published'
    ORDER BY ma.scheduled_date, ma.scheduled_time_start;
  END IF;
END;
$$;

-- 6. FUNCIÓN: Publicar calendario de un mes
-- ==========================================

CREATE OR REPLACE FUNCTION publish_calendar_month(
  target_month TEXT,  -- '2026-02'
  admin_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  affected_count INT;
  result JSON;
BEGIN
  -- Actualizar todos los assignments del mes a 'published'
  UPDATE maintenance_assignments
  SET 
    publication_status = 'published',
    published_at = NOW(),
    published_by = admin_id
  WHERE calendar_month = target_month
    AND publication_status = 'draft';
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  result := json_build_object(
    'success', TRUE,
    'month', target_month,
    'assignments_published', affected_count,
    'published_at', NOW()
  );
  
  RETURN result;
END;
$$;

-- 7. FUNCIÓN: Obtener solicitudes pendientes para coordinación
-- =============================================================

CREATE OR REPLACE FUNCTION get_pending_coordination_requests(
  target_month TEXT -- '2026-02'
)
RETURNS TABLE (
  source_type TEXT,
  source_id UUID,
  title TEXT,
  building_name TEXT,
  priority TEXT,
  requested_date DATE,
  description TEXT,
  requires_technicians INT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  
  -- Mantenimientos que solicitan apoyo adicional
  SELECT 
    'maintenance'::TEXT AS source_type,
    ma.id AS source_id,
    'Mantenimiento - ' || b.name AS title,
    b.name AS building_name,
    'medium'::TEXT AS priority,
    ma.scheduled_date AS requested_date,
    ma.coordination_notes AS description,
    ma.additional_technicians_count AS requires_technicians
  FROM maintenance_assignments ma
  LEFT JOIN buildings b ON ma.building_id = b.id
  WHERE ma.calendar_month = target_month
    AND ma.requires_additional_technicians = TRUE
    AND ma.publication_status = 'draft'
  
  UNION ALL
  
  -- Órdenes de trabajo sin asignar al calendario
  SELECT 
    'work_order'::TEXT AS source_type,
    wo.id AS source_id,
    'OT-' || wo.id::TEXT || ' - ' || wo.description AS title,
    b.name AS building_name,
    wo.priority AS priority,
    wo.scheduled_date AS requested_date,
    wo.description AS description,
    1 AS requires_technicians
  FROM work_orders wo
  LEFT JOIN buildings b ON wo.building_id = b.id
  WHERE wo.status IN ('pending', 'in_progress')
    AND wo.scheduled_date >= DATE_TRUNC('month', target_month::DATE)
    AND wo.scheduled_date < (DATE_TRUNC('month', target_month::DATE) + INTERVAL '1 month')
    AND NOT EXISTS (
      SELECT 1 FROM maintenance_assignments ma2
      WHERE ma2.calendar_month = target_month
        AND ma2.building_id = wo.building_id
        AND ma2.scheduled_date = wo.scheduled_date
    )
  
  UNION ALL
  
  -- Solicitudes de servicio pendientes
  SELECT 
    'service_request'::TEXT AS source_type,
    sr.id AS source_id,
    'Solicitud - ' || sr.request_type AS title,
    b.name AS building_name,
    sr.priority AS priority,
    sr.preferred_date AS requested_date,
    sr.description AS description,
    1 AS requires_technicians
  FROM service_requests sr
  LEFT JOIN buildings b ON sr.building_id = b.id
  WHERE sr.status IN ('pending', 'assigned')
    AND sr.preferred_date >= DATE_TRUNC('month', target_month::DATE)
    AND sr.preferred_date < (DATE_TRUNC('month', target_month::DATE) + INTERVAL '1 month')
  
  ORDER BY requested_date, priority DESC;
END;
$$;

-- 8. FUNCIÓN: Obtener estadísticas del calendario por mes
-- ========================================================

CREATE OR REPLACE FUNCTION get_calendar_month_stats(
  target_month TEXT
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'month', target_month,
    'total_assignments', COUNT(*),
    'draft_count', COUNT(*) FILTER (WHERE publication_status = 'draft'),
    'published_count', COUNT(*) FILTER (WHERE publication_status = 'published'),
    'requires_coordination', COUNT(*) FILTER (WHERE requires_additional_technicians = TRUE),
    'completed_count', COUNT(*) FILTER (WHERE status = 'completed'),
    'pending_count', COUNT(*) FILTER (WHERE status = 'scheduled'),
    'total_technician_days', SUM(COALESCE(additional_technicians_count, 1))
  ) INTO result
  FROM maintenance_assignments
  WHERE calendar_month = target_month;
  
  RETURN result;
END;
$$;

-- 9. VISTA: Resumen de calendarios por mes
-- =========================================

CREATE OR REPLACE VIEW v_calendar_months_summary AS
SELECT 
  calendar_month,
  publication_status,
  COUNT(*) AS total_assignments,
  COUNT(*) FILTER (WHERE requires_additional_technicians = TRUE) AS requires_coordination,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
  MIN(published_at) AS published_at,
  MAX(scheduled_date) AS last_assignment_date
FROM maintenance_assignments
WHERE calendar_month IS NOT NULL
GROUP BY calendar_month, publication_status
ORDER BY calendar_month DESC;

-- 10. COMENTARIOS EN COLUMNAS
-- ============================

COMMENT ON COLUMN maintenance_assignments.calendar_month IS 'Mes del calendario en formato YYYY-MM (ej: 2026-02)';
COMMENT ON COLUMN maintenance_assignments.publication_status IS 'Estado de publicación: draft, published, archived';
COMMENT ON COLUMN maintenance_assignments.published_at IS 'Fecha y hora de publicación del calendario';
COMMENT ON COLUMN maintenance_assignments.published_by IS 'ID del admin que publicó el calendario';
COMMENT ON COLUMN maintenance_assignments.requires_additional_technicians IS 'Indica si requiere más técnicos para coordinación';
COMMENT ON COLUMN maintenance_assignments.additional_technicians_count IS 'Cantidad total de técnicos necesarios';
COMMENT ON COLUMN maintenance_assignments.coordination_notes IS 'Notas sobre la coordinación de múltiples técnicos';
COMMENT ON COLUMN maintenance_assignments.related_emergency_visits IS 'Array de IDs de emergency_visits relacionadas con este mantenimiento';
COMMENT ON COLUMN maintenance_assignments.emergency_context_notes IS 'Contexto automático de emergencias previas del edificio';

-- 11. FUNCIÓN: Auto-publicar calendarios al inicio del mes
-- =========================================================

CREATE OR REPLACE FUNCTION auto_publish_calendar_on_month_start()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  current_month_str TEXT;
  affected_count INT;
  result JSON;
BEGIN
  -- Obtener mes actual en formato YYYY-MM
  current_month_str := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Publicar automáticamente calendarios en borrador del mes actual
  UPDATE maintenance_assignments
  SET 
    publication_status = 'published',
    published_at = NOW(),
    published_by = NULL -- Sistema automático
  WHERE calendar_month = current_month_str
    AND publication_status = 'draft';
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Crear alerta si se publicó algo automáticamente
  IF affected_count > 0 THEN
    INSERT INTO calendar_alerts (
      alert_type, calendar_month, title, message, priority, is_read
    ) VALUES (
      'auto_published',
      current_month_str,
      'Calendario publicado automáticamente',
      'El calendario de ' || current_month_str || ' fue publicado automáticamente al inicio del mes. ' || affected_count || ' asignaciones publicadas.',
      'medium',
      FALSE
    );
  END IF;
  
  result := json_build_object(
    'success', TRUE,
    'month', current_month_str,
    'assignments_published', affected_count,
    'auto_published_at', NOW()
  );
  
  RETURN result;
END;
$$;

-- 12. FUNCIÓN: Vincular emergencias con próximos mantenimientos
-- ==============================================================

CREATE OR REPLACE FUNCTION link_emergencies_to_maintenance(
  building_id_param UUID,
  maintenance_date DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  emergency_notes TEXT := '';
  emergency_record RECORD;
BEGIN
  -- Buscar emergencias de los últimos 90 días del mismo edificio
  FOR emergency_record IN
    SELECT 
      ev.id,
      ev.created_at,
      ev.failure_description,
      ev.resolution_description,
      ev.parts_replaced,
      p.full_name AS technician_name
    FROM emergency_visits ev
    LEFT JOIN profiles p ON ev.technician_id = p.id
    WHERE ev.building_id = building_id_param
      AND ev.created_at >= (maintenance_date - INTERVAL '90 days')
      AND ev.status = 'resolved'
    ORDER BY ev.created_at DESC
    LIMIT 3
  LOOP
    emergency_notes := emergency_notes || 
      '🚨 EMERGENCIA (' || TO_CHAR(emergency_record.created_at, 'DD/MM/YYYY') || ') - ' ||
      'Técnico: ' || COALESCE(emergency_record.technician_name, 'No asignado') || E'\n' ||
      '   Falla: ' || COALESCE(emergency_record.failure_description, 'Sin descripción') || E'\n' ||
      '   Resolución: ' || COALESCE(emergency_record.resolution_description, 'Sin resolución') || E'\n';
    
    IF emergency_record.parts_replaced IS NOT NULL THEN
      emergency_notes := emergency_notes || '   Repuestos: ' || emergency_record.parts_replaced || E'\n';
    END IF;
    
    emergency_notes := emergency_notes || E'\n';
  END LOOP;
  
  IF emergency_notes = '' THEN
    RETURN NULL;
  ELSE
    RETURN '⚠️ CONTEXTO DE EMERGENCIAS PREVIAS:' || E'\n\n' || emergency_notes;
  END IF;
END;
$$;

-- 13. TRIGGER: Generar contexto de emergencias al crear mantenimiento
-- ====================================================================

CREATE OR REPLACE FUNCTION trg_generate_emergency_context()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo generar contexto si no existe
  IF NEW.emergency_context_notes IS NULL THEN
    NEW.emergency_context_notes := link_emergencies_to_maintenance(
      NEW.building_id,
      NEW.scheduled_date
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_emergency_context ON maintenance_assignments;

CREATE TRIGGER trg_maintenance_emergency_context
BEFORE INSERT OR UPDATE OF building_id, scheduled_date
ON maintenance_assignments
FOR EACH ROW
EXECUTE FUNCTION trg_generate_emergency_context();

-- 14. TRIGGER: Alertar admin cuando técnico solicita apoyo en mes futuro
-- =======================================================================

CREATE OR REPLACE FUNCTION trg_alert_coordination_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  admin_ids UUID[];
  admin_id UUID;
  future_month TEXT;
BEGIN
  -- Solo alertar si se marca requires_additional_technicians en TRUE
  IF NEW.requires_additional_technicians = TRUE 
     AND (OLD IS NULL OR OLD.requires_additional_technicians = FALSE) THEN
    
    -- Verificar si es un mes futuro (calendario ya puede estar hecho)
    future_month := NEW.calendar_month;
    
    -- Obtener todos los admins
    SELECT ARRAY_AGG(id) INTO admin_ids
    FROM profiles
    WHERE role IN ('admin', 'developer');
    
    -- Crear alerta para cada admin
    FOREACH admin_id IN ARRAY admin_ids
    LOOP
      INSERT INTO calendar_alerts (
        alert_type,
        calendar_month,
        title,
        message,
        source_type,
        source_id,
        priority,
        is_read,
        created_for
      ) VALUES (
        'new_support_request',
        future_month,
        'Solicitud de apoyo adicional',
        'Se requieren ' || NEW.additional_technicians_count || ' técnicos para mantenimiento en ' || 
        (SELECT name FROM buildings WHERE id = NEW.building_id) || 
        ' el ' || TO_CHAR(NEW.scheduled_date, 'DD/MM/YYYY') || '. ' ||
        COALESCE(NEW.coordination_notes, 'Sin notas adicionales.'),
        'maintenance',
        NEW.id,
        'high',
        FALSE,
        admin_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_coordination_alert ON maintenance_assignments;

CREATE TRIGGER trg_maintenance_coordination_alert
AFTER INSERT OR UPDATE OF requires_additional_technicians
ON maintenance_assignments
FOR EACH ROW
EXECUTE FUNCTION trg_alert_coordination_request();

-- 15. FUNCIÓN: Obtener alertas no leídas del admin
-- =================================================

CREATE OR REPLACE FUNCTION get_admin_unread_alerts(admin_id UUID)
RETURNS TABLE (
  id UUID,
  alert_type TEXT,
  calendar_month TEXT,
  title TEXT,
  message TEXT,
  source_type TEXT,
  source_id UUID,
  priority TEXT,
  created_at TIMESTAMP
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.id,
    ca.alert_type,
    ca.calendar_month,
    ca.title,
    ca.message,
    ca.source_type,
    ca.source_id,
    ca.priority,
    ca.created_at
  FROM calendar_alerts ca
  WHERE ca.created_for = admin_id
    AND ca.is_read = FALSE
  ORDER BY 
    CASE ca.priority
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
    END,
    ca.created_at DESC;
END;
$$;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

-- VERIFICACIÓN
SELECT 'Script ejecutado exitosamente' AS status,
       COUNT(*) AS total_assignments,
       COUNT(DISTINCT calendar_month) AS total_months
FROM maintenance_assignments;
