-- ============================================================================
-- NOTIFICATIONS SYSTEM - MIGRATION
-- Fecha: 2026-01-25
-- Descripción: Sistema completo de notificaciones para técnicos, admin y clientes
-- ============================================================================

-- 1. CREATE TABLE notifications (si no existe)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'work_order_assigned', 'work_order_approved', 'work_order_rejected', 'work_order_closed', 'approval_requested', 'approval_deadline_approaching'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  service_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  related_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Quién realizó la acción
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url VARCHAR(500), -- Ruta a la que ir cuando se clickea
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE INDEXES para performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_is_read ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_work_order_id ON notifications(work_order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 3. CREATE TRIGGER para updated_at
CREATE OR REPLACE FUNCTION trigger_update_notifications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notifications_updated_at ON notifications;
CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_notifications_timestamp();

-- 4. CREATE FUNCTION para crear notificación genérica
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_type VARCHAR(50),
  p_title VARCHAR(255),
  p_message TEXT,
  p_work_order_id UUID DEFAULT NULL,
  p_service_request_id UUID DEFAULT NULL,
  p_related_user_id UUID DEFAULT NULL,
  p_action_url VARCHAR(500) DEFAULT NULL,
  p_priority VARCHAR(20) DEFAULT 'normal'
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    recipient_id,
    type,
    title,
    message,
    work_order_id,
    service_request_id,
    related_user_id,
    action_url,
    priority
  )
  VALUES (
    p_recipient_id,
    p_type,
    p_title,
    p_message,
    p_work_order_id,
    p_service_request_id,
    p_related_user_id,
    p_action_url,
    p_priority
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CREATE FUNCTION: Notificar cuando se asigna una orden de trabajo (para técnico)
CREATE OR REPLACE FUNCTION notify_work_order_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_technician_name VARCHAR;
  v_folio VARCHAR;
  v_client_name VARCHAR;
BEGIN
  -- Solo notificar si es una nueva orden o si cambió el técnico asignado
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.assigned_technician_id != OLD.assigned_technician_id) THEN
    -- Obtener datos para el mensaje
    SELECT full_name INTO v_technician_name FROM profiles WHERE id = NEW.assigned_technician_id;
    SELECT folio_number INTO v_folio FROM work_orders WHERE id = NEW.id;
    SELECT company_name INTO v_client_name FROM clients WHERE id = NEW.client_id;
    
    -- Crear notificación para el técnico
    INSERT INTO notifications (
      recipient_id,
      type,
      title,
      message,
      work_order_id,
      action_url,
      priority
    )
    VALUES (
      NEW.assigned_technician_id,
      'work_order_assigned',
      'Nueva Orden de Trabajo Asignada',
      format('Te ha sido asignada la orden %s para %s: %s',
        v_folio,
        v_client_name,
        NEW.description
      ),
      NEW.id,
      '/work-orders',
      'high'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_work_order_assigned ON work_orders;
CREATE TRIGGER trigger_notify_work_order_assigned
  AFTER INSERT OR UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_work_order_assigned();

-- 6. CREATE FUNCTION: Notificar cuando hay aprobación pendiente (para cliente)
CREATE OR REPLACE FUNCTION notify_approval_requested()
RETURNS TRIGGER AS $$
DECLARE
  v_client_profile_id UUID;
  v_folio VARCHAR;
BEGIN
  -- Notificar al cliente cuando requires_client_approval = true
  IF NEW.requires_client_approval = TRUE AND 
     (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.requires_client_approval != TRUE)) THEN
    
    -- Obtener profile_id del cliente a través del building
    SELECT c.profile_id INTO v_client_profile_id
    FROM clients c
    WHERE c.id = (SELECT client_id FROM buildings WHERE id = NEW.building_id);
    
    SELECT folio_number INTO v_folio FROM work_orders WHERE id = NEW.id;
    
    IF v_client_profile_id IS NOT NULL THEN
      INSERT INTO notifications (
        recipient_id,
        type,
        title,
        message,
        work_order_id,
        action_url,
        priority
      )
      VALUES (
        v_client_profile_id,
        'approval_requested',
        'Aprobación Requerida',
        format('La orden de trabajo %s requiere tu aprobación. Monto: $%s',
          v_folio,
          COALESCE(NEW.quotation_amount::TEXT, 'Por determinar')
        ),
        NEW.id,
        '/client-service-requests?view=pending_approvals',
        'urgent'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_approval_requested ON work_orders;
CREATE TRIGGER trigger_notify_approval_requested
  AFTER INSERT OR UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_approval_requested();

-- 7. CREATE FUNCTION: Notificar cuando se aprueba (para admin y técnico)
CREATE OR REPLACE FUNCTION notify_work_order_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_technician_id UUID;
  v_folio VARCHAR;
  v_client_name VARCHAR;
BEGIN
  -- Notificar cuando status cambia a 'approved'
  IF NEW.status = 'approved' AND OLD.status = 'pending_approval' THEN
    SELECT assigned_technician_id, folio_number INTO v_technician_id, v_folio FROM work_orders WHERE id = NEW.id;
    SELECT company_name INTO v_client_name FROM clients WHERE id = NEW.client_id;
    
    -- Notificar a técnicos (todos con role='technician')
    INSERT INTO notifications (recipient_id, type, title, message, work_order_id, action_url, priority)
    SELECT
      id,
      'work_order_approved',
      'Orden Aprobada por Cliente',
      format('La orden %s ha sido aprobada por %s. Ya puedes comenzar los trabajos.',
        v_folio,
        v_client_name
      ),
      NEW.id,
      '/work-orders',
      'high'
    FROM profiles
    WHERE role = 'technician' AND id = v_technician_id;
    
    -- Notificar a admins (todos con role='admin')
    INSERT INTO notifications (recipient_id, type, title, message, work_order_id, action_url, priority)
    SELECT
      id,
      'work_order_approved',
      'Orden Aprobada',
      format('La orden %s ha sido aprobada por el cliente %s',
        v_folio,
        v_client_name
      ),
      NEW.id,
      '/work-orders',
      'normal'
    FROM profiles
    WHERE role = 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_work_order_approved ON work_orders;
CREATE TRIGGER trigger_notify_work_order_approved
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_work_order_approved();

-- 8. CREATE FUNCTION: Notificar cuando se rechaza
CREATE OR REPLACE FUNCTION notify_work_order_rejected()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_technician_id UUID;
  v_folio VARCHAR;
  v_client_name VARCHAR;
BEGIN
  -- Notificar cuando status cambia a 'rejected'
  IF NEW.status = 'rejected' AND OLD.status = 'pending_approval' THEN
    SELECT assigned_technician_id, folio_number INTO v_technician_id, v_folio FROM work_orders WHERE id = NEW.id;
    SELECT company_name INTO v_client_name FROM clients WHERE id = NEW.client_id;
    
    -- Notificar a técnico
    INSERT INTO notifications (recipient_id, type, title, message, work_order_id, action_url, priority)
    SELECT
      id,
      'work_order_rejected',
      'Orden Rechazada por Cliente',
      format('La orden %s ha sido rechazada por %s. Razón: %s',
        v_folio,
        v_client_name,
        COALESCE(NEW.client_rejection_reason, 'No especificada')
      ),
      NEW.id,
      '/work-orders',
      'high'
    FROM profiles
    WHERE id = v_technician_id;
    
    -- Notificar a admins
    INSERT INTO notifications (recipient_id, type, title, message, work_order_id, action_url, priority)
    SELECT
      id,
      'work_order_rejected',
      'Orden Rechazada',
      format('La orden %s ha sido rechazada por %s',
        v_folio,
        v_client_name
      ),
      NEW.id,
      '/work-orders',
      'high'
    FROM profiles
    WHERE role = 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_work_order_rejected ON work_orders;
CREATE TRIGGER trigger_notify_work_order_rejected
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_work_order_rejected();

-- 9. CREATE FUNCTION: Notificar cuando se cierra una orden (para cliente y admin)
CREATE OR REPLACE FUNCTION notify_work_order_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_client_profile_id UUID;
  v_admin_id UUID;
  v_folio VARCHAR;
  v_technician_name VARCHAR;
BEGIN
  -- Solo en inserts de work_order_closures
  IF TG_OP = 'INSERT' THEN
    -- Obtener datos
    SELECT folio_number INTO v_folio FROM work_orders WHERE id = NEW.work_order_id;
    SELECT full_name INTO v_technician_name FROM profiles WHERE id = NEW.closed_by;
    SELECT c.profile_id INTO v_client_profile_id 
    FROM clients c
    JOIN buildings b ON c.id = b.client_id
    JOIN work_orders wo ON b.id = wo.building_id
    WHERE wo.id = NEW.work_order_id;
    
    -- Actualizar estado de work_orders a 'completed' (ya lo hace el cierre)
    
    -- Notificar al cliente
    IF v_client_profile_id IS NOT NULL THEN
      INSERT INTO notifications (recipient_id, type, title, message, work_order_id, action_url, priority)
      VALUES (
        v_client_profile_id,
        'work_order_closed',
        'Orden de Trabajo Completada',
        format('La orden %s ha sido completada por %s. Costo total: $%s',
          v_folio,
          v_technician_name,
          COALESCE(NEW.actual_total_cost::TEXT, '0')
        ),
        NEW.work_order_id,
        '/client-service-requests',
        'normal'
      );
    END IF;
    
    -- Notificar a admins
    INSERT INTO notifications (recipient_id, type, title, message, work_order_id, action_url, priority)
    SELECT
      id,
      'work_order_closed',
      'Orden Completada',
      format('Orden %s completada. Costo: $%s (Varianza: %s%%)',
        v_folio,
        COALESCE(NEW.actual_total_cost::TEXT, '0'),
        COALESCE(NEW.cost_variance_percentage::TEXT, '0')
      ),
      NEW.work_order_id,
      '/work-orders',
      'normal'
    FROM profiles
    WHERE role = 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_work_order_closed ON work_order_closures;
CREATE TRIGGER trigger_notify_work_order_closed
  AFTER INSERT ON work_order_closures
  FOR EACH ROW
  EXECUTE FUNCTION notify_work_order_closed();

-- 10. VALIDATION
SELECT 'Notificaciones creadas exitosamente' AS status;

-- Mostrar tabla creada
SELECT 
  tablename,
  (
    SELECT string_agg(attname, ', ')
    FROM pg_attribute
    WHERE attrelid = (
      SELECT oid FROM pg_class WHERE relname = tablename
    ) AND attnum > 0
  ) AS columns
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'notifications';

-- Mostrar triggers creados
SELECT 
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_notify%' OR trigger_name = 'trigger_notifications_updated_at'
ORDER BY event_object_table;

-- Mostrar funciones creadas
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND (routine_name LIKE 'notify_%' OR routine_name = 'create_notification')
ORDER BY routine_name;
