-- Sistema de Visitas de Emergencia
-- Fecha: 16 Diciembre 2025

-- Tabla principal de visitas de emergencia
CREATE TABLE IF NOT EXISTS emergency_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información general
  client_id UUID NOT NULL REFERENCES clients(id),
  technician_id UUID NOT NULL REFERENCES profiles(id),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visit_time TIME NOT NULL DEFAULT CURRENT_TIME,
  
  -- Descripción de la falla (Paso 3)
  failure_description TEXT,
  failure_photo_1_url TEXT,
  failure_photo_2_url TEXT,
  
  -- Estado final (Paso 5)
  final_status VARCHAR(20) CHECK (final_status IN ('operational', 'observation', 'stopped')),
  
  -- Resolución (Paso 7)
  resolution_summary TEXT,
  resolution_photo_1_url TEXT,
  resolution_photo_2_url TEXT,
  failure_cause VARCHAR(50) CHECK (failure_cause IN ('normal_use', 'third_party', 'part_lifespan')),
  
  -- Firma y cierre (Paso 8)
  receiver_name VARCHAR(255),
  receiver_signature_url TEXT,
  
  -- Control de estado de observación
  observation_until DATE, -- Fecha límite de observación (15 días desde visit_date)
  observation_closed BOOLEAN DEFAULT false,
  
  -- PDF generado
  pdf_url TEXT,
  
  -- Solicitud relacionada (si se creó)
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

-- Tabla de ascensores afectados en cada visita
CREATE TABLE IF NOT EXISTS emergency_visit_elevators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_visit_id UUID NOT NULL REFERENCES emergency_visits(id) ON DELETE CASCADE,
  elevator_id UUID NOT NULL REFERENCES elevators(id),
  
  -- Estado inicial del ascensor (Paso 2)
  initial_status VARCHAR(20) NOT NULL CHECK (initial_status IN ('operational', 'stopped')),
  
  -- Estado final del ascensor (Paso 5)
  final_status VARCHAR(20) CHECK (final_status IN ('operational', 'observation', 'stopped')),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(emergency_visit_id, elevator_id)
);

-- Índices para optimizar consultas
CREATE INDEX idx_emergency_visits_client ON emergency_visits(client_id);
CREATE INDEX idx_emergency_visits_technician ON emergency_visits(technician_id);
CREATE INDEX idx_emergency_visits_date ON emergency_visits(visit_date DESC);
CREATE INDEX idx_emergency_visits_status ON emergency_visits(status);
CREATE INDEX idx_emergency_visits_observation ON emergency_visits(observation_until) WHERE observation_until IS NOT NULL AND observation_closed = false;
CREATE INDEX idx_emergency_visit_elevators_elevator ON emergency_visit_elevators(elevator_id);

-- Función para actualizar timestamp
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

-- Función para cerrar automáticamente las observaciones después de 15 días
CREATE OR REPLACE FUNCTION auto_close_expired_observations()
RETURNS void AS $$
BEGIN
  UPDATE emergency_visits
  SET 
    observation_closed = true,
    final_status = 'operational',
    status = 'closed',
    updated_at = NOW()
  WHERE 
    final_status = 'observation' 
    AND observation_until < CURRENT_DATE 
    AND observation_closed = false;
END;
$$ LANGUAGE plpgsql;

-- Vista para obtener última emergencia por ascensor
CREATE OR REPLACE VIEW last_emergency_by_elevator AS
SELECT DISTINCT ON (eve.elevator_id)
  eve.elevator_id,
  ev.id as visit_id,
  ev.visit_date,
  ev.visit_time,
  ev.failure_description,
  ev.final_status,
  ev.observation_until,
  ev.observation_closed,
  EXTRACT(DAY FROM (CURRENT_DATE - ev.visit_date)) as days_since_last_emergency
FROM emergency_visits ev
JOIN emergency_visit_elevators eve ON eve.emergency_visit_id = ev.id
WHERE ev.status IN ('completed', 'closed')
ORDER BY eve.elevator_id, ev.visit_date DESC, ev.visit_time DESC;

-- Comentarios
COMMENT ON TABLE emergency_visits IS 'Registro de visitas de emergencia con toda la información del formulario';
COMMENT ON TABLE emergency_visit_elevators IS 'Ascensores afectados en cada visita de emergencia';
COMMENT ON COLUMN emergency_visits.observation_until IS 'Fecha límite para observación (15 días desde la visita)';
COMMENT ON COLUMN emergency_visits.observation_closed IS 'Si la observación fue cerrada automáticamente';
COMMENT ON COLUMN emergency_visits.final_status IS 'operational=resuelta, observation=sin causa identificada, stopped=requiere reparación';
COMMENT ON COLUMN emergency_visits.failure_cause IS 'normal_use=uso normal, third_party=terceros, part_lifespan=vida útil repuesto';
