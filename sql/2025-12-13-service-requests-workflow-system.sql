-- Sistema Completo de Flujo de Solicitudes con Comentarios, Historial y Notificaciones
-- Permite gestión completa de solicitudes con roles técnico/admin bien definidos

-- =====================================================
-- 1. TABLA DE COMENTARIOS/RESPUESTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS service_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  
  -- Autor del comentario
  user_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Contenido
  comment TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'general', -- general, rejection_response, closure, linked_request
  
  -- Archivos adjuntos (fotos adicionales, documentos)
  attachments JSONB DEFAULT '[]'::jsonb, -- [{url, type, name}]
  
  -- Si es respuesta a un rechazo
  is_rejection_response BOOLEAN DEFAULT false,
  resolves_rejection BOOLEAN DEFAULT false, -- Si esta respuesta resuelve el rechazo
  
  -- Si es cierre técnico
  is_technical_closure BOOLEAN DEFAULT false,
  closure_notes TEXT,
  
  -- Vinculación con otras solicitudes
  linked_request_id UUID REFERENCES service_requests(id),
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_comment_type CHECK (comment_type IN ('general', 'rejection_response', 'closure', 'linked_request', 'status_change'))
);

-- =====================================================
-- 2. TABLA DE HISTORIAL DE CAMBIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS service_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  
  -- Usuario que realizó el cambio
  changed_by UUID NOT NULL REFERENCES profiles(id),
  
  -- Tipo de cambio
  change_type TEXT NOT NULL, -- status_change, assignment, rejection, approval, comment, closure
  
  -- Estado anterior y nuevo (si aplica)
  old_status TEXT,
  new_status TEXT,
  
  -- Detalles del cambio
  change_details JSONB DEFAULT '{}'::jsonb, -- Información adicional del cambio
  change_description TEXT, -- Descripción legible del cambio
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_change_type CHECK (change_type IN ('status_change', 'assignment', 'rejection', 'approval', 'comment', 'closure', 'reopened', 'quotation_created'))
);

-- =====================================================
-- 3. TABLA DE NOTIFICACIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS service_request_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  
  -- Usuario destinatario
  user_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Tipo de notificación
  notification_type TEXT NOT NULL, -- rejection_pending, request_pending, request_assigned, quotation_ready, work_completed
  
  -- Contenido
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Estado
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Prioridad
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Para notificaciones que vencen
  
  CONSTRAINT valid_notification_type CHECK (notification_type IN ('rejection_pending', 'request_pending', 'request_assigned', 'quotation_ready', 'work_completed', 'request_reopened', 'daily_reminder')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- =====================================================
-- 4. AGREGAR CAMPOS A service_requests
-- =====================================================
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_rejection_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS requires_technical_closure BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS technical_closure_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS technical_closure_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS technical_closure_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS parent_request_id UUID REFERENCES service_requests(id), -- Para solicitudes vinculadas
ADD COLUMN IF NOT EXISTS is_follow_up BOOLEAN DEFAULT false, -- Si es seguimiento de otra solicitud
ADD COLUMN IF NOT EXISTS last_admin_action_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_technician_action_at TIMESTAMPTZ;

-- =====================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_comments_service_request ON service_request_comments(service_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user ON service_request_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_rejection_response ON service_request_comments(is_rejection_response, resolves_rejection);

CREATE INDEX IF NOT EXISTS idx_history_service_request ON service_request_history(service_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_type ON service_request_history(change_type);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON service_request_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON service_request_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON service_request_notifications(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_rejection ON service_requests(status, last_rejection_at) WHERE status = 'rejected';
CREATE INDEX IF NOT EXISTS idx_requests_parent ON service_requests(parent_request_id) WHERE parent_request_id IS NOT NULL;

-- =====================================================
-- 6. FUNCIÓN PARA REGISTRAR CAMBIOS EN HISTORIAL
-- =====================================================
CREATE OR REPLACE FUNCTION log_service_request_change()
RETURNS TRIGGER AS $$
DECLARE
  change_desc TEXT;
  change_details JSONB;
BEGIN
  -- Solo registrar si hay cambio de estado
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Crear descripción del cambio
    change_desc := 'Estado cambiado de ' || OLD.status || ' a ' || NEW.status;
    
    -- Detalles adicionales
    change_details := jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'changed_at', NOW()
    );
    
    -- Si es rechazo, incluir razón
    IF NEW.status = 'rejected' THEN
      change_details := change_details || jsonb_build_object('rejection_reason', NEW.admin_notes);
      NEW.rejection_count := COALESCE(OLD.rejection_count, 0) + 1;
      NEW.last_rejection_at := NOW();
    END IF;
    
    -- Si pasa a in_progress, registrar asignación
    IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
      change_details := change_details || jsonb_build_object(
        'assigned_technicians', NEW.assigned_technicians,
        'scheduled_date', NEW.scheduled_date
      );
    END IF;
    
    -- Insertar en historial
    INSERT INTO service_request_history (
      service_request_id,
      changed_by,
      change_type,
      old_status,
      new_status,
      change_details,
      change_description
    ) VALUES (
      NEW.id,
      COALESCE(NEW.assigned_to_admin_id, NEW.created_by_technician_id),
      'status_change',
      OLD.status,
      NEW.status,
      change_details,
      change_desc
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para historial automático
DROP TRIGGER IF EXISTS service_request_change_trigger ON service_requests;
CREATE TRIGGER service_request_change_trigger
AFTER UPDATE ON service_requests
FOR EACH ROW
EXECUTE FUNCTION log_service_request_change();

-- =====================================================
-- 7. FUNCIÓN PARA CREAR NOTIFICACIONES
-- =====================================================
CREATE OR REPLACE FUNCTION create_service_request_notification(
  p_request_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO service_request_notifications (
    service_request_id,
    user_id,
    notification_type,
    title,
    message,
    priority
  ) VALUES (
    p_request_id,
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_priority
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. FUNCIÓN PARA NOTIFICACIONES AUTOMÁTICAS AL RECHAZAR
-- =====================================================
CREATE OR REPLACE FUNCTION notify_rejection()
RETURNS TRIGGER AS $$
BEGIN
  -- Si pasa a rejected, notificar al técnico
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    PERFORM create_service_request_notification(
      NEW.id,
      NEW.created_by_technician_id,
      'rejection_pending',
      'Solicitud Rechazada',
      'Tu solicitud "' || NEW.title || '" fue rechazada. Requiere información adicional.',
      'high'
    );
  END IF;
  
  -- Si pasa de rejected a pending (técnico respondió), notificar admin
  IF OLD.status = 'rejected' AND NEW.status = 'pending' THEN
    PERFORM create_service_request_notification(
      NEW.id,
      NEW.assigned_to_admin_id,
      'request_reopened',
      'Solicitud Reabierta',
      'El técnico respondió la solicitud rechazada "' || NEW.title || '"',
      'normal'
    );
    
    NEW.last_response_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_rejection_trigger ON service_requests;
CREATE TRIGGER notify_rejection_trigger
AFTER UPDATE ON service_requests
FOR EACH ROW
EXECUTE FUNCTION notify_rejection();

-- =====================================================
-- 9. VISTA PARA SOLICITUDES CON CONTEXTO COMPLETO
-- =====================================================
CREATE OR REPLACE VIEW service_requests_full_context AS
SELECT 
  sr.*,
  
  -- Conteo de comentarios
  (SELECT COUNT(*) FROM service_request_comments WHERE service_request_id = sr.id) as comments_count,
  
  -- Conteo de respuestas a rechazo
  (SELECT COUNT(*) FROM service_request_comments 
   WHERE service_request_id = sr.id AND is_rejection_response = true) as rejection_responses_count,
  
  -- Última respuesta a rechazo
  (SELECT created_at FROM service_request_comments 
   WHERE service_request_id = sr.id AND is_rejection_response = true 
   ORDER BY created_at DESC LIMIT 1) as last_rejection_response_at,
  
  -- Conteo de notificaciones no leídas
  (SELECT COUNT(*) FROM service_request_notifications 
   WHERE service_request_id = sr.id AND is_read = false) as unread_notifications_count,
  
  -- Días desde última acción
  EXTRACT(DAY FROM NOW() - GREATEST(
    COALESCE(sr.last_admin_action_at, sr.created_at),
    COALESCE(sr.last_technician_action_at, sr.created_at)
  )) as days_since_last_action
  
FROM service_requests sr;

-- =====================================================
-- 10. COMENTARIOS EN TABLAS
-- =====================================================
COMMENT ON TABLE service_request_comments IS 'Comentarios y respuestas en solicitudes de servicio';
COMMENT ON TABLE service_request_history IS 'Historial completo de cambios en solicitudes';
COMMENT ON TABLE service_request_notifications IS 'Notificaciones para técnicos y administradores';

COMMENT ON COLUMN service_requests.rejection_count IS 'Número de veces que ha sido rechazada esta solicitud';
COMMENT ON COLUMN service_requests.requires_technical_closure IS 'Si requiere cierre técnico por parte del técnico';
COMMENT ON COLUMN service_requests.parent_request_id IS 'ID de solicitud padre si esta es un seguimiento';
COMMENT ON COLUMN service_requests.is_follow_up IS 'Si es una solicitud de seguimiento vinculada a otra';
