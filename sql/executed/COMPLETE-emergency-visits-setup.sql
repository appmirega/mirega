-- VERIFICAR Y CREAR TABLAS DE EMERGENCIAS
-- Paso 1: Verificar si existen

SELECT 
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN 'EXISTE ✓'
    ELSE 'NO EXISTE ✗'
  END as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('emergency_visits', 'emergency_visit_elevators');

-- Si NO aparecen las tablas, ejecuta lo siguiente:

-- ==================================================
-- CREAR TABLAS DE EMERGENCIAS
-- ==================================================

-- Eliminar si existen (para empezar limpio)
DROP TABLE IF EXISTS emergency_visit_elevators CASCADE;
DROP TABLE IF EXISTS emergency_visits CASCADE;

-- Tabla principal de visitas
CREATE TABLE emergency_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información general
  client_id UUID NOT NULL REFERENCES clients(id),
  technician_id UUID NOT NULL REFERENCES profiles(id),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visit_time TIME NOT NULL DEFAULT CURRENT_TIME,
  
  -- Descripción de la falla
  failure_description TEXT,
  failure_photo_1_url TEXT,
  failure_photo_2_url TEXT,
  
  -- Estado final
  final_status VARCHAR(20) CHECK (final_status IN ('operational', 'observation', 'stopped')),
  
  -- Resolución
  resolution_summary TEXT,
  resolution_photo_1_url TEXT,
  resolution_photo_2_url TEXT,
  failure_cause VARCHAR(50) CHECK (failure_cause IN ('normal_use', 'third_party', 'part_lifespan')),
  
  -- Firma y cierre
  receiver_name VARCHAR(255),
  receiver_signature_url TEXT,
  
  -- Control de observación
  observation_until DATE,
  observation_closed BOOLEAN DEFAULT false,
  
  -- PDF generado
  pdf_url TEXT,
  
  -- Solicitud relacionada
  service_request_id UUID REFERENCES service_requests(id),
  
  -- Estado del documento
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'closed')),
  
  -- Guardado automático
  last_autosave TIMESTAMP DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Tabla de ascensores afectados
CREATE TABLE emergency_visit_elevators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_visit_id UUID NOT NULL REFERENCES emergency_visits(id) ON DELETE CASCADE,
  elevator_id UUID NOT NULL REFERENCES elevators(id),
  
  -- Estados
  initial_status VARCHAR(20) NOT NULL CHECK (initial_status IN ('operational', 'stopped')),
  final_status VARCHAR(20) CHECK (final_status IN ('operational', 'observation', 'stopped')),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(emergency_visit_id, elevator_id)
);

-- Índices
CREATE INDEX idx_emergency_visits_client ON emergency_visits(client_id);
CREATE INDEX idx_emergency_visits_technician ON emergency_visits(technician_id);
CREATE INDEX idx_emergency_visits_date ON emergency_visits(visit_date DESC);
CREATE INDEX idx_emergency_visits_status ON emergency_visits(status);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_emergency_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER emergency_visits_updated_at
  BEFORE UPDATE ON emergency_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_emergency_visits_updated_at();

-- Habilitar RLS
ALTER TABLE emergency_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_visit_elevators ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "emergency_visits_select"
ON emergency_visits FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('developer', 'admin')
  )
  OR technician_id = auth.uid()
);

CREATE POLICY "emergency_visits_insert"
ON emergency_visits FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('developer', 'admin', 'technician')
  )
);

CREATE POLICY "emergency_visits_update"
ON emergency_visits FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('developer', 'admin')
  )
  OR technician_id = auth.uid()
);

CREATE POLICY "emergency_visit_elevators_select"
ON emergency_visit_elevators FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM emergency_visits ev
    WHERE ev.id = emergency_visit_elevators.emergency_visit_id
    AND (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('developer', 'admin')
      )
      OR ev.technician_id = auth.uid()
    )
  )
);

CREATE POLICY "emergency_visit_elevators_insert"
ON emergency_visit_elevators FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('developer', 'admin', 'technician')
  )
);

CREATE POLICY "emergency_visit_elevators_update"
ON emergency_visit_elevators FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM emergency_visits ev
    WHERE ev.id = emergency_visit_elevators.emergency_visit_id
    AND (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('developer', 'admin')
      )
      OR ev.technician_id = auth.uid()
    )
  )
);

SELECT '✅ Tablas y políticas creadas correctamente' as resultado;
