-- =============================================
-- SISTEMA DE SOLICITUDES DE SERVICIO
-- Fecha: 2025-12-06
-- Descripción: Sistema unificado de solicitudes desde mantenimiento y emergencias
-- =============================================

-- =============================================
-- TABLA CENTRAL: service_requests
-- Todas las solicitudes pasan por aquí (reparaciones, repuestos, apoyo)
-- =============================================
CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tipo y origen
  request_type text NOT NULL CHECK (request_type IN ('repair', 'parts', 'support', 'inspection')),
  source_type text NOT NULL CHECK (source_type IN ('maintenance_checklist', 'emergency_visit', 'manual')),
  source_id uuid, -- ID del checklist o emergencia que generó la solicitud
  
  -- Información del ascensor y cliente
  elevator_id uuid NOT NULL REFERENCES elevators(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Descripción
  title text NOT NULL,
  description text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Estado del flujo
  status text DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Esperando revisión
    'analyzing',         -- Admin está analizando
    'quotation_sent',    -- Cotización enviada al cliente
    'approved',          -- Cliente aprobó
    'in_progress',       -- OT en ejecución
    'completed',         -- Resuelto
    'rejected',          -- Cliente rechazó o no procede
    'on_hold'            -- En espera de información/repuestos
  )),
  
  -- Quién la creó (técnico)
  created_by_technician_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  
  -- Quién la gestiona (admin)
  assigned_to_admin_id uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  
  -- Resultado final
  resolution_type text CHECK (resolution_type IN ('quotation', 'work_order', 'internal_work', 'no_action')),
  resolution_notes text,
  completed_at timestamptz,
  
  -- Metadatos
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- TABLA: repair_requests
-- Detalles específicos de solicitudes de reparación
-- =============================================
CREATE TABLE IF NOT EXISTS repair_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  
  -- Tipo de reparación
  repair_category text CHECK (repair_category IN (
    'motor',
    'doors',
    'electrical',
    'hydraulic',
    'control_panel',
    'cabin',
    'cables',
    'other'
  )),
  
  -- Estimaciones
  estimated_hours integer,
  estimated_cost decimal(10, 2),
  
  -- Requerimientos
  requires_multiple_technicians boolean DEFAULT false,
  number_of_technicians integer DEFAULT 1,
  requires_specialized_technician boolean DEFAULT false,
  specialization_needed text, -- 'electrical', 'programming', 'hydraulic', etc.
  requires_special_tools boolean DEFAULT false,
  tools_needed text,
  
  -- Urgencia
  elevator_operational boolean DEFAULT false,
  can_wait boolean DEFAULT true,
  max_wait_days integer,
  
  -- Fotos adjuntas
  photos jsonb DEFAULT '[]'::jsonb, -- [{url: '', description: '', uploaded_at: ''}]
  
  -- Metadatos
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- TABLA: parts_requests
-- Solicitudes de repuestos
-- =============================================
CREATE TABLE IF NOT EXISTS parts_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  
  -- Información del repuesto
  part_name text NOT NULL,
  part_code text, -- Código si existe en inventario
  brand text,
  model text,
  quantity integer NOT NULL DEFAULT 1,
  zone text, -- 'motor', 'cabin', 'doors', 'control_panel', etc.
  
  -- Urgencia
  urgency text DEFAULT 'normal' CHECK (urgency IN ('immediate', 'this_week', 'this_month', 'normal')),
  reason_for_urgency text,
  
  -- Estado del pedido
  status text DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Pendiente de aprobación
    'approved',     -- Aprobado para compra
    'ordered',      -- Pedido realizado
    'in_transit',   -- En camino
    'arrived',      -- Llegó a bodega
    'installed',    -- Instalado en ascensor
    'cancelled'     -- Cancelado
  )),
  
  -- Fechas
  approved_at timestamptz,
  ordered_at timestamptz,
  estimated_arrival date,
  arrived_at timestamptz,
  installed_at timestamptz,
  
  -- Costos
  unit_price decimal(10, 2),
  total_price decimal(10, 2),
  supplier text,
  
  -- Fotos
  photos jsonb DEFAULT '[]'::jsonb,
  
  -- Metadatos
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- TABLA: support_requests
-- Solicitudes de apoyo técnico adicional
-- =============================================
CREATE TABLE IF NOT EXISTS support_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  
  -- Tipo de apoyo
  support_type text NOT NULL CHECK (support_type IN (
    'second_technician',      -- Necesita otro técnico
    'specialist',             -- Necesita especialista
    'supervisor',             -- Necesita supervisor
    'external_contractor'     -- Necesita contratista externo
  )),
  
  -- Razón y detalles
  reason text NOT NULL,
  skills_needed text, -- 'electrical', 'programming', 'hydraulic', 'welding', etc.
  specific_requirements text,
  
  -- Asignación
  assigned_technician_id uuid REFERENCES profiles(id),
  assigned_at timestamptz,
  
  -- Programación
  scheduled_date date,
  scheduled_time time,
  
  -- Estado
  status text DEFAULT 'pending' CHECK (status IN (
    'pending',
    'assigned',
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
  )),
  
  -- Resultado
  completion_notes text,
  completed_at timestamptz,
  
  -- Metadatos
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- EMERGENCIAS V3: emergency_visits_v3
-- Nueva versión mejorada del sistema de emergencias
-- =============================================
CREATE TABLE IF NOT EXISTS emergency_visits_v3 (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Información del cliente y edificio
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  building_name text NOT NULL,
  building_address text NOT NULL,
  
  -- Ascensores involucrados
  elevators_in_failure uuid[] NOT NULL, -- Array de IDs de ascensores
  total_elevators_in_failure integer NOT NULL,
  same_failure_all boolean DEFAULT false, -- ¿Misma falla en todos?
  
  -- Tipo de emergencia
  failure_type text NOT NULL CHECK (failure_type IN ('terceros', 'tecnico')),
  
  -- Técnico
  technician_id uuid NOT NULL REFERENCES profiles(id),
  
  -- Fechas
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  visit_time time NOT NULL DEFAULT CURRENT_TIME,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  -- Estado general
  status text DEFAULT 'in_progress' CHECK (status IN (
    'in_progress',  -- Técnico trabajando
    'completed',    -- Todos los reportes completados y firmados
    'stopped'       -- Al menos un ascensor quedó detenido
  )),
  
  -- Firma
  signer_name text,
  signature_url text,
  signed_at timestamptz,
  
  -- PDF generado
  pdf_url text,
  pdf_generated_at timestamptz,
  
  -- Auto-guardado
  last_saved_at timestamptz,
  
  -- Metadatos
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- EMERGENCIAS V3: emergency_reports_v3
-- Un reporte por cada ascensor en falla
-- =============================================
CREATE TABLE IF NOT EXISTS emergency_reports_v3 (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relación con la visita
  visit_id uuid NOT NULL REFERENCES emergency_visits_v3(id) ON DELETE CASCADE,
  
  -- Ascensor específico
  elevator_id uuid NOT NULL REFERENCES elevators(id) ON DELETE CASCADE,
  elevator_number integer NOT NULL, -- Número del ascensor (visible en PDF)
  
  -- Estado al llegar
  was_working_on_arrival boolean NOT NULL,
  initial_status_text text NOT NULL,
  initial_photos jsonb DEFAULT '[]'::jsonb, -- [{url: '', description: '', uploaded_at: ''}]
  
  -- Estado al finalizar
  final_status_text text NOT NULL,
  final_photos jsonb DEFAULT '[]'::jsonb,
  
  -- Estado final del ascensor
  final_state text NOT NULL CHECK (final_state IN ('operativo', 'detenido', 'observacion')),
  
  -- Requerimientos
  requires_parts boolean DEFAULT false,
  requires_repair boolean DEFAULT false,
  requires_support boolean DEFAULT false,
  
  -- Observaciones generales
  observations text,
  
  -- Metadatos
  report_number text, -- Número de reporte (auto-generado)
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- EMERGENCIAS V3: emergency_parts_requests_v3
-- Repuestos solicitados en emergencias
-- =============================================
CREATE TABLE IF NOT EXISTS emergency_parts_requests_v3 (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relación con el reporte
  report_id uuid NOT NULL REFERENCES emergency_reports_v3(id) ON DELETE CASCADE,
  
  -- Información del repuesto
  part_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  part_type text, -- 'motor', 'cable', 'sensor', etc.
  zone text NOT NULL, -- Dónde se necesita: 'motor', 'cabina', 'puertas', etc.
  
  -- Urgencia
  is_critical boolean DEFAULT false,
  reason text,
  
  -- Fotos
  photos jsonb DEFAULT '[]'::jsonb,
  
  -- Se vincula automáticamente a parts_requests
  linked_parts_request_id uuid REFERENCES parts_requests(id),
  
  -- Metadatos
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

-- service_requests
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_priority ON service_requests(priority);
CREATE INDEX IF NOT EXISTS idx_service_requests_client ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_elevator ON service_requests(elevator_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_technician ON service_requests(created_by_technician_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_admin ON service_requests(assigned_to_admin_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_created ON service_requests(created_at DESC);

-- repair_requests
CREATE INDEX IF NOT EXISTS idx_repair_requests_service ON repair_requests(service_request_id);
CREATE INDEX IF NOT EXISTS idx_repair_requests_operational ON repair_requests(elevator_operational);

-- parts_requests
CREATE INDEX IF NOT EXISTS idx_parts_requests_service ON parts_requests(service_request_id);
CREATE INDEX IF NOT EXISTS idx_parts_requests_status ON parts_requests(status);
CREATE INDEX IF NOT EXISTS idx_parts_requests_urgency ON parts_requests(urgency);

-- support_requests
CREATE INDEX IF NOT EXISTS idx_support_requests_service ON support_requests(service_request_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_assigned ON support_requests(assigned_technician_id);

-- emergency_visits_v3
CREATE INDEX IF NOT EXISTS idx_emergency_v3_client ON emergency_visits_v3(client_id);
CREATE INDEX IF NOT EXISTS idx_emergency_v3_technician ON emergency_visits_v3(technician_id);
CREATE INDEX IF NOT EXISTS idx_emergency_v3_status ON emergency_visits_v3(status);
CREATE INDEX IF NOT EXISTS idx_emergency_v3_date ON emergency_visits_v3(visit_date DESC);

-- emergency_reports_v3
CREATE INDEX IF NOT EXISTS idx_emergency_reports_v3_visit ON emergency_reports_v3(visit_id);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_v3_elevator ON emergency_reports_v3(elevator_id);
CREATE INDEX IF NOT EXISTS idx_emergency_reports_v3_state ON emergency_reports_v3(final_state);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_visits_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_reports_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_parts_requests_v3 ENABLE ROW LEVEL SECURITY;

-- Políticas para service_requests
CREATE POLICY "Admins y técnicos pueden ver solicitudes"
  ON service_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer', 'technician')
    )
  );

CREATE POLICY "Técnicos pueden crear solicitudes"
  ON service_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin', 'developer')
    )
  );

CREATE POLICY "Admins pueden actualizar solicitudes"
  ON service_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- Políticas similares para otras tablas
CREATE POLICY "Ver repair_requests"
  ON repair_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer', 'technician')
    )
  );

CREATE POLICY "Ver parts_requests"
  ON parts_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer', 'technician')
    )
  );

CREATE POLICY "Ver support_requests"
  ON support_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer', 'technician')
    )
  );

-- Políticas para emergency_visits_v3
CREATE POLICY "Ver emergencias v3"
  ON emergency_visits_v3 FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer', 'technician')
    )
  );

CREATE POLICY "Crear emergencias v3"
  ON emergency_visits_v3 FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin', 'developer')
    )
  );

CREATE POLICY "Actualizar emergencias v3"
  ON emergency_visits_v3 FOR UPDATE
  USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- =============================================
-- FUNCIONES AUXILIARES
-- =============================================

-- Función para auto-generar título de solicitud
CREATE OR REPLACE FUNCTION generate_service_request_title(
  p_request_type text,
  p_elevator_id uuid,
  p_description text
)
RETURNS text AS $$
DECLARE
  elevator_info text;
  client_name text;
BEGIN
  SELECT 
    CONCAT(
      COALESCE(c.company_name, c.building_name, 'Cliente'),
      ' - Ascensor #',
      e.elevator_number
    )
  INTO elevator_info
  FROM elevators e
  JOIN clients c ON c.id = e.client_id
  WHERE e.id = p_elevator_id;
  
  RETURN CASE p_request_type
    WHEN 'repair' THEN CONCAT('Reparación - ', elevator_info)
    WHEN 'parts' THEN CONCAT('Repuestos - ', elevator_info)
    WHEN 'support' THEN CONCAT('Apoyo Técnico - ', elevator_info)
    ELSE CONCAT('Solicitud - ', elevator_info)
  END;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_service_requests_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parts_requests_updated_at
  BEFORE UPDATE ON parts_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_visits_v3_updated_at
  BEFORE UPDATE ON emergency_visits_v3
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMENTARIOS EN TABLAS
-- =============================================

COMMENT ON TABLE service_requests IS 'Tabla central de solicitudes de servicio desde mantenimiento y emergencias';
COMMENT ON TABLE repair_requests IS 'Detalles de solicitudes de reparación';
COMMENT ON TABLE parts_requests IS 'Solicitudes de repuestos con seguimiento completo';
COMMENT ON TABLE support_requests IS 'Solicitudes de apoyo técnico adicional';
COMMENT ON TABLE emergency_visits_v3 IS 'Visitas de emergencia versión 3 con soporte multi-ascensor';
COMMENT ON TABLE emergency_reports_v3 IS 'Reportes individuales por ascensor en emergencias';
COMMENT ON TABLE emergency_parts_requests_v3 IS 'Repuestos solicitados durante emergencias';
