-- =====================================================
-- MIGRACIÓN: Eliminación de Cotizaciones y Mejora de Work Orders
-- Fecha: 2026-01-25
-- Objetivo: 
--   1. Eliminar módulo de cotizaciones de la UI (mantener datos históricos)
--   2. Mejorar work_orders con campos de cotización externa
--   3. Agregar folios diferenciados (OT-XXXX-YYYY y OT-INT-XXXX-YYYY)
--   4. Agregar garantías, adelantos, demoras
--   5. Crear tablas de cierre y reportes de inspección
-- =====================================================

-- =====================================================
-- PARTE 1: AGREGAR CAMPOS A WORK_ORDERS
-- =====================================================

-- Campos de folio y tipo
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS folio_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS folio_year INTEGER,
ADD COLUMN IF NOT EXISTS folio_sequence INTEGER,
ADD COLUMN IF NOT EXISTS has_client_cost BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requires_client_approval BOOLEAN DEFAULT FALSE;

-- Campos de cotización externa
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS external_quotation_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS external_quotation_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS quotation_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS quotation_description TEXT,
ADD COLUMN IF NOT EXISTS involves_foreign_parts BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS foreign_parts_supplier VARCHAR(200),
ADD COLUMN IF NOT EXISTS estimated_execution_days INTEGER,

-- Campos de adelanto
ADD COLUMN IF NOT EXISTS requires_advance_payment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS advance_percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS advance_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS advance_paid_at TIMESTAMP,

-- Campos de aprobación cliente
ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS client_approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS client_rejected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS client_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approval_deadline TIMESTAMP,

-- Campos de garantía (trabajos)
ADD COLUMN IF NOT EXISTS work_warranty_months INTEGER,
ADD COLUMN IF NOT EXISTS work_warranty_description TEXT,
ADD COLUMN IF NOT EXISTS work_warranty_start_date DATE,
ADD COLUMN IF NOT EXISTS work_warranty_end_date DATE,

-- Campos de garantía (repuestos)
ADD COLUMN IF NOT EXISTS parts_warranty_months INTEGER,
ADD COLUMN IF NOT EXISTS parts_warranty_description TEXT,
ADD COLUMN IF NOT EXISTS parts_warranty_start_date DATE,
ADD COLUMN IF NOT EXISTS parts_warranty_end_date DATE;

COMMENT ON COLUMN work_orders.folio_number IS 'Folio único: OT-0001-2025 (con costo) o OT-INT-0001-2025 (sin costo)';
COMMENT ON COLUMN work_orders.has_client_cost IS 'TRUE si tiene costo hacia el cliente (requiere facturación)';
COMMENT ON COLUMN work_orders.requires_client_approval IS 'TRUE si requiere aprobación del cliente antes de ejecutar';
COMMENT ON COLUMN work_orders.external_quotation_number IS 'Número de cotización del proveedor/sistema externo';
COMMENT ON COLUMN work_orders.external_quotation_pdf_url IS 'URL del PDF de cotización externa subido';
COMMENT ON COLUMN work_orders.quotation_amount IS 'Monto total de la cotización';
COMMENT ON COLUMN work_orders.involves_foreign_parts IS 'TRUE si involucra compra de repuestos en el extranjero';
COMMENT ON COLUMN work_orders.estimated_execution_days IS 'Días estimados desde aprobación hasta ejecución';
COMMENT ON COLUMN work_orders.requires_advance_payment IS 'TRUE si requiere pago adelantado';
COMMENT ON COLUMN work_orders.advance_percentage IS 'Porcentaje de adelanto (ej: 50.00 = 50%)';
COMMENT ON COLUMN work_orders.work_warranty_months IS 'Meses de garantía del trabajo ejecutado';
COMMENT ON COLUMN work_orders.parts_warranty_months IS 'Meses de garantía de los repuestos instalados';

-- =====================================================
-- PARTE 2: CREAR SECUENCIADORES DE FOLIOS
-- =====================================================

-- Tabla para almacenar secuencias por año y tipo
CREATE TABLE IF NOT EXISTS work_order_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('OT', 'OT-INT')),
  last_sequence INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(year, type)
);

COMMENT ON TABLE work_order_sequences IS 'Secuenciadores de folios por año y tipo (OT, OT-INT)';

-- =====================================================
-- PARTE 3: FUNCIÓN PARA GENERAR FOLIO AUTOMÁTICO
-- =====================================================

CREATE OR REPLACE FUNCTION generate_work_order_folio(
  p_has_client_cost BOOLEAN,
  p_year INTEGER DEFAULT NULL
)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER;
  v_type VARCHAR(10);
  v_sequence INTEGER;
  v_folio VARCHAR(20);
BEGIN
  -- Determinar año (usar actual si no se provee)
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::INTEGER);
  
  -- Determinar tipo de folio
  v_type := CASE 
    WHEN p_has_client_cost THEN 'OT'
    ELSE 'OT-INT'
  END;
  
  -- Bloquear fila para evitar duplicados en concurrencia
  PERFORM pg_advisory_xact_lock(hashtext(v_type || v_year::TEXT));
  
  -- Obtener o crear secuencia
  INSERT INTO work_order_sequences (year, type, last_sequence)
  VALUES (v_year, v_type, 1)
  ON CONFLICT (year, type) 
  DO UPDATE SET 
    last_sequence = work_order_sequences.last_sequence + 1,
    updated_at = NOW()
  RETURNING last_sequence INTO v_sequence;
  
  -- Construir folio
  IF v_type = 'OT' THEN
    v_folio := 'OT-' || LPAD(v_sequence::TEXT, 4, '0') || '-' || v_year::TEXT;
  ELSE
    v_folio := 'OT-INT-' || LPAD(v_sequence::TEXT, 4, '0') || '-' || v_year::TEXT;
  END IF;
  
  RETURN v_folio;
END;
$$;

COMMENT ON FUNCTION generate_work_order_folio IS 'Genera folio único: OT-0001-2025 (con costo) o OT-INT-0001-2025 (sin costo)';

-- =====================================================
-- PARTE 4: TABLA DE CIERRES DE ÓRDENES DE TRABAJO
-- =====================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS work_order_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  completion_date TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agregar columnas una por una (IF NOT EXISTS requiere PostgreSQL 9.6+)
DO $$
BEGIN
  -- completion_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'completion_date'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN completion_date TIMESTAMP NOT NULL DEFAULT NOW();
  END IF;

  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;

  -- closed_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN closed_by UUID NOT NULL REFERENCES profiles(id);
  END IF;
  
  -- photos_urls
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'photos_urls'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN photos_urls TEXT[];
  END IF;
  
  -- signature_data
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'signature_data'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN signature_data TEXT;
  END IF;
  
  -- technician_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'technician_notes'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN technician_notes TEXT;
  END IF;
  
  -- actual_labor_cost
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'actual_labor_cost'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN actual_labor_cost DECIMAL(12,2);
  END IF;
  
  -- actual_parts_cost
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'actual_parts_cost'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN actual_parts_cost DECIMAL(12,2);
  END IF;
  
  -- actual_total_cost
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'actual_total_cost'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN actual_total_cost DECIMAL(12,2);
  END IF;
  
  -- cost_variance_percentage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'cost_variance_percentage'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN cost_variance_percentage DECIMAL(5,2);
  END IF;
  
  -- closure_pdf_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'closure_pdf_url'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN closure_pdf_url TEXT;
  END IF;
  
  -- closure_pdf_generated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'closure_pdf_generated_at'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN closure_pdf_generated_at TIMESTAMP;
  END IF;
  
  -- work_warranty_activated
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'work_warranty_activated'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN work_warranty_activated BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- parts_warranty_activated
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'parts_warranty_activated'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN parts_warranty_activated BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- client_rating
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'client_rating'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN client_rating INTEGER CHECK (client_rating BETWEEN 1 AND 5);
  END IF;
  
  -- client_feedback
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_order_closures' AND column_name = 'client_feedback'
  ) THEN
    ALTER TABLE work_order_closures ADD COLUMN client_feedback TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_order_closures_work_order ON work_order_closures(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_closures_closed_by ON work_order_closures(closed_by);
CREATE INDEX IF NOT EXISTS idx_work_order_closures_completion_date ON work_order_closures(completion_date DESC);

COMMENT ON TABLE work_order_closures IS 'Cierres formales de órdenes de trabajo con fotos, firmas y documentos';

-- =====================================================
-- PARTE 5: TABLA DE REPORTES DE INSPECCIÓN
-- =====================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS inspection_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agregar columnas una por una
DO $$
BEGIN
  -- inspector_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'inspector_id'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN inspector_id UUID NOT NULL REFERENCES profiles(id);
  END IF;
  
  -- inspection_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'inspection_date'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN inspection_date DATE NOT NULL;
  END IF;
  
  -- inspection_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'inspection_type'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN inspection_type VARCHAR(50);
  END IF;
  
  -- equipment_condition
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'equipment_condition'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN equipment_condition VARCHAR(20) CHECK (equipment_condition IN ('excellent', 'good', 'fair', 'poor', 'critical'));
  END IF;
  
  -- findings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'findings'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN findings TEXT;
  END IF;
  
  -- photos_urls
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'photos_urls'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN photos_urls TEXT[];
  END IF;
  
  -- recommendations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'recommendations'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN recommendations TEXT;
  END IF;
  
  -- urgency_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'urgency_level'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN urgency_level VARCHAR(20) CHECK (urgency_level IN ('low', 'medium', 'high', 'critical'));
  END IF;
  
  -- requires_immediate_action
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'requires_immediate_action'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN requires_immediate_action BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- next_recommended_inspection
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'next_recommended_inspection'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN next_recommended_inspection DATE;
  END IF;
  
  -- follow_up_service_request_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'follow_up_service_request_id'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN follow_up_service_request_id UUID REFERENCES service_requests(id);
  END IF;
  
  -- report_pdf_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'report_pdf_url'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN report_pdf_url TEXT;
  END IF;
  
  -- report_pdf_generated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'report_pdf_generated_at'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN report_pdf_generated_at TIMESTAMP;
  END IF;
  
  -- sent_to_client
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'sent_to_client'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN sent_to_client BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- sent_to_client_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'sent_to_client_at'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN sent_to_client_at TIMESTAMP;
  END IF;
  
  -- client_viewed_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inspection_reports' AND column_name = 'client_viewed_at'
  ) THEN
    ALTER TABLE inspection_reports ADD COLUMN client_viewed_at TIMESTAMP;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inspection_reports_service_request ON inspection_reports(service_request_id);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_inspector ON inspection_reports(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_inspection_date ON inspection_reports(inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_urgency ON inspection_reports(urgency_level) WHERE requires_immediate_action = TRUE;

COMMENT ON TABLE inspection_reports IS 'Reportes profesionales de inspección con hallazgos y recomendaciones';

-- =====================================================
-- PARTE 6: TRIGGER PARA AUTO-GENERAR FOLIO AL CREAR WO
-- =====================================================

CREATE OR REPLACE FUNCTION auto_generate_work_order_folio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo generar folio si no existe
  IF NEW.folio_number IS NULL THEN
    NEW.folio_number := generate_work_order_folio(
      COALESCE(NEW.has_client_cost, FALSE),
      EXTRACT(YEAR FROM NOW())::INTEGER
    );
    NEW.folio_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_auto_generate_folio ON work_orders;

-- Crear trigger
CREATE TRIGGER trigger_auto_generate_folio
  BEFORE INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_work_order_folio();

COMMENT ON TRIGGER trigger_auto_generate_folio ON work_orders IS 'Auto-genera folio único al crear work order';

-- =====================================================
-- PARTE 7: FUNCIÓN PARA CALCULAR GARANTÍAS AUTOMÁTICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_warranty_dates(
  p_start_date DATE,
  p_months INTEGER
)
RETURNS DATE
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si no hay meses de garantía, retornar NULL
  IF p_months IS NULL OR p_months = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Calcular fecha de fin sumando meses
  RETURN p_start_date + (p_months || ' months')::INTERVAL;
END;
$$;

COMMENT ON FUNCTION calculate_warranty_dates IS 'Calcula fecha de fin de garantía basado en meses';

-- =====================================================
-- PARTE 8: RPC PARA APROBAR ORDEN DE TRABAJO (CLIENTE)
-- =====================================================

CREATE OR REPLACE FUNCTION approve_work_order(
  p_work_order_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_folio VARCHAR(20);
BEGIN
  -- Validar que el usuario sea cliente del trabajo
  IF NOT EXISTS (
    SELECT 1 FROM work_orders wo
    JOIN buildings b ON b.id = wo.building_id
    JOIN clients c ON c.id = b.client_id
    JOIN profiles p ON p.id = p_user_id
    WHERE wo.id = p_work_order_id
    AND c.id = p.client_id
    AND p.role = 'client'
  ) THEN
    RAISE EXCEPTION 'Usuario no autorizado para aprobar esta orden de trabajo';
  END IF;
  
  -- Actualizar orden de trabajo
  UPDATE work_orders
  SET 
    client_approved_at = NOW(),
    client_approved_by = p_user_id,
    status = 'approved',
    updated_at = NOW()
  WHERE id = p_work_order_id
  RETURNING folio_number INTO v_folio;
  
  -- Retornar resultado
  v_result := json_build_object(
    'success', TRUE,
    'message', 'Orden de trabajo aprobada exitosamente',
    'folio', v_folio,
    'approved_at', NOW()
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION approve_work_order IS 'Cliente aprueba orden de trabajo (cotización)';

-- =====================================================
-- PARTE 9: RPC PARA RECHAZAR ORDEN DE TRABAJO (CLIENTE)
-- =====================================================

CREATE OR REPLACE FUNCTION reject_work_order(
  p_work_order_id UUID,
  p_user_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_folio VARCHAR(20);
BEGIN
  -- Validar que el usuario sea cliente del trabajo
  IF NOT EXISTS (
    SELECT 1 FROM work_orders wo
    JOIN buildings b ON b.id = wo.building_id
    JOIN clients c ON c.id = b.client_id
    JOIN profiles p ON p.id = p_user_id
    WHERE wo.id = p_work_order_id
    AND c.id = p.client_id
    AND p.role = 'client'
  ) THEN
    RAISE EXCEPTION 'Usuario no autorizado para rechazar esta orden de trabajo';
  END IF;
  
  -- Actualizar orden de trabajo
  UPDATE work_orders
  SET 
    client_rejected_at = NOW(),
    client_rejection_reason = p_rejection_reason,
    status = 'rejected',
    updated_at = NOW()
  WHERE id = p_work_order_id
  RETURNING folio_number INTO v_folio;
  
  -- Retornar resultado
  v_result := json_build_object(
    'success', TRUE,
    'message', 'Orden de trabajo rechazada',
    'folio', v_folio,
    'rejected_at', NOW()
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION reject_work_order IS 'Cliente rechaza orden de trabajo (cotización)';

-- =====================================================
-- PARTE 10: VISTA PARA ÓRDENES PENDIENTES DE APROBACIÓN
-- =====================================================

CREATE OR REPLACE VIEW v_work_orders_pending_approval AS
SELECT 
  wo.id,
  wo.folio_number,
  wo.work_type,
  wo.description,
  wo.quotation_amount,
  wo.external_quotation_pdf_url,
  wo.requires_advance_payment,
  wo.advance_percentage,
  wo.advance_amount,
  wo.estimated_execution_days,
  wo.approval_deadline,
  wo.work_warranty_months,
  wo.parts_warranty_months,
  wo.created_at,
  
  -- Cliente
  c.id AS client_id,
  c.business_name AS client_name,
  
  -- Edificio
  b.id AS building_id,
  b.name AS building_name,
  
  -- Solicitud origen
  sr.id AS service_request_id,
  sr.request_type,
  sr.priority,
  
  -- Días pendientes
  CASE 
    WHEN wo.approval_deadline IS NOT NULL 
    THEN EXTRACT(DAY FROM wo.approval_deadline - NOW())::INTEGER
    ELSE NULL
  END AS days_until_deadline
  
FROM work_orders wo
JOIN buildings b ON b.id = wo.building_id
JOIN clients c ON c.id = b.client_id
LEFT JOIN service_requests sr ON sr.id = wo.service_request_id
WHERE wo.requires_client_approval = TRUE
  AND wo.client_approved_at IS NULL
  AND wo.client_rejected_at IS NULL
  AND wo.status = 'pending_approval'
ORDER BY wo.approval_deadline ASC NULLS LAST, wo.created_at DESC;

COMMENT ON VIEW v_work_orders_pending_approval IS 'Órdenes de trabajo pendientes de aprobación del cliente';

-- =====================================================
-- PARTE 11: ACTUALIZAR ESTADOS EXISTENTES
-- =====================================================

-- Agregar nuevos estados si no existen
DO $$
BEGIN
  -- Agregar estado 'pending_approval' si no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pending_approval' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'work_order_status')
  ) THEN
    ALTER TYPE work_order_status ADD VALUE 'pending_approval';
  END IF;
  
  -- Agregar estado 'approved' si no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'approved' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'work_order_status')
  ) THEN
    ALTER TYPE work_order_status ADD VALUE 'approved';
  END IF;
  
  -- Agregar estado 'rejected' si no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'rejected' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'work_order_status')
  ) THEN
    ALTER TYPE work_order_status ADD VALUE 'rejected';
  END IF;
END $$;

-- =====================================================
-- VALIDACIÓN FINAL
-- =====================================================

SELECT 'MIGRACIÓN COMPLETADA EXITOSAMENTE' AS status;

-- Verificar campos agregados a work_orders
SELECT 
  column_name, 
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'work_orders'
  AND column_name IN (
    'folio_number', 'has_client_cost', 'requires_client_approval',
    'external_quotation_number', 'quotation_amount',
    'work_warranty_months', 'parts_warranty_months',
    'advance_percentage'
  )
ORDER BY column_name;

-- Verificar tablas creadas
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_name IN ('work_order_sequences', 'work_order_closures', 'inspection_reports')
ORDER BY table_name;

-- Verificar funciones creadas
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'generate_work_order_folio',
  'approve_work_order',
  'reject_work_order',
  'calculate_warranty_dates'
)
ORDER BY routine_name;
