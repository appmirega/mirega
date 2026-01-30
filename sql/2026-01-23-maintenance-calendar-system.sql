-- ============================================================
-- SISTEMA DE CALENDARIO DE ASIGNACIÓN DE MANTENIMIENTOS
-- Fecha: 23 de Enero de 2026
-- Objetivo: Gestión completa de planificación, asignación y seguimiento de mantenimientos
-- ============================================================

-- ============================================================
-- 1. TABLA: maintenance_schedules (Configuración de frecuencia)
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación del edificio/cliente
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  building_name TEXT NOT NULL, -- Nombre del edificio o dirección
  building_address TEXT, -- Dirección completa
  elevators_count INTEGER DEFAULT 1 CHECK (elevators_count > 0),
  
  -- Frecuencia de mantenimiento
  maintenance_days_per_month INTEGER NOT NULL DEFAULT 1 CHECK (maintenance_days_per_month BETWEEN 1 AND 30),
  -- 1 = mensual, 2 = quincenal, 4 = semanal, etc.
  
  -- Preferencias de programación
  preferred_weekday INTEGER CHECK (preferred_weekday BETWEEN 0 AND 4), -- 0=lunes, 4=viernes, NULL=cualquiera
  fixed_day_of_month INTEGER CHECK (fixed_day_of_month BETWEEN 1 AND 31), -- NULL=flexible
  estimated_duration_hours DECIMAL(3,1) DEFAULT 2.0, -- Duración estimada en horas
  
  -- Control administrativo
  is_blocked BOOLEAN DEFAULT false, -- Si está bloqueado, no puede cambiar fecha
  is_active BOOLEAN DEFAULT true, -- Si está activo para generar mantenimientos
  
  -- Notas
  notes TEXT,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  CONSTRAINT unique_client_building UNIQUE(client_id, building_name)
);

COMMENT ON TABLE maintenance_schedules IS 'Configuración de frecuencia de mantenimiento por edificio';
COMMENT ON COLUMN maintenance_schedules.maintenance_days_per_month IS 'Cuántas veces al mes: 1=mensual, 2=quincenal, 4=semanal';
COMMENT ON COLUMN maintenance_schedules.preferred_weekday IS 'Día preferido: 0=lunes, 1=martes, 2=miércoles, 3=jueves, 4=viernes';
COMMENT ON COLUMN maintenance_schedules.is_blocked IS 'Si true, no permite cambios de fecha por el sistema';


-- ============================================================
-- 2. TABLA: holidays (Días festivos)
-- ============================================================
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT false, -- Si se repite cada año (ej: Navidad)
  country TEXT DEFAULT 'CL',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

COMMENT ON TABLE holidays IS 'Días festivos donde solo trabaja personal externo';

-- Insertar festivos de Chile 2026
INSERT INTO holidays (holiday_date, holiday_name, is_recurring) VALUES
('2026-01-01', 'Año Nuevo', true),
('2026-04-03', 'Viernes Santo', false),
('2026-04-04', 'Sábado Santo', false),
('2026-05-01', 'Día del Trabajo', true),
('2026-05-21', 'Día de las Glorias Navales', true),
('2026-06-29', 'San Pedro y San Pablo', true),
('2026-07-16', 'Día de la Virgen del Carmen', true),
('2026-08-15', 'Asunción de la Virgen', true),
('2026-09-18', 'Día de la Independencia', true),
('2026-09-19', 'Día de las Glorias del Ejército', true),
('2026-10-12', 'Día del Descubrimiento', true),
('2026-10-31', 'Día de las Iglesias Evangélicas', true),
('2026-11-01', 'Día de Todos los Santos', true),
('2026-12-08', 'Inmaculada Concepción', true),
('2026-12-25', 'Navidad', true)
ON CONFLICT (holiday_date) DO NOTHING;


-- ============================================================
-- 3. TABLA: technician_availability (Disponibilidad y ausencias)
-- ============================================================
CREATE TABLE IF NOT EXISTS technician_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Período de ausencia
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Tipo de ausencia
  absence_type TEXT NOT NULL CHECK (absence_type IN ('vacation', 'sick_leave', 'personal_leave', 'training', 'other')),
  reason TEXT,
  
  -- Aprobación
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

COMMENT ON TABLE technician_availability IS 'Vacaciones, permisos y ausencias de técnicos';
COMMENT ON COLUMN technician_availability.absence_type IS 'vacation, sick_leave, personal_leave, training, other';

CREATE INDEX idx_technician_availability_dates ON technician_availability(technician_id, start_date, end_date);
CREATE INDEX idx_technician_availability_status ON technician_availability(status) WHERE status = 'approved';


-- ============================================================
-- 4. TABLA: emergency_shifts (Turnos de emergencia)
-- ============================================================
CREATE TABLE IF NOT EXISTS emergency_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Período del turno
  shift_start_date DATE NOT NULL,
  shift_end_date DATE NOT NULL,
  
  -- Tipo de turno
  shift_type TEXT DEFAULT 'weekday' CHECK (shift_type IN ('weekday', 'weekend', 'holiday', '24x7')),
  is_primary BOOLEAN DEFAULT true, -- Técnico primario o backup
  
  -- Contacto
  emergency_phone TEXT, -- Teléfono de contacto durante turno
  
  notes TEXT,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  CONSTRAINT valid_shift_range CHECK (shift_end_date >= shift_start_date)
);

COMMENT ON TABLE emergency_shifts IS 'Turnos rotativos de emergencia (lunes a domingo)';
COMMENT ON COLUMN emergency_shifts.is_primary IS 'true = técnico primario, false = backup';

CREATE INDEX idx_emergency_shifts_dates ON emergency_shifts(shift_start_date, shift_end_date);
CREATE INDEX idx_emergency_shifts_technician ON emergency_shifts(technician_id);


-- ============================================================
-- 5. TABLA: maintenance_assignments (Asignaciones de mantenimiento)
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relación con configuración
  maintenance_schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  building_name TEXT NOT NULL, -- Denormalizado para histórico
  
  -- Asignación
  assigned_technician_id UUID REFERENCES profiles(id), -- NULL si es personal externo
  external_personnel_name TEXT, -- Nombre del personal externo
  external_personnel_phone TEXT,
  
  -- Programación
  scheduled_date DATE NOT NULL,
  scheduled_time_start TIME DEFAULT '08:00',
  scheduled_time_end TIME DEFAULT '10:00',
  
  -- Estado
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
  
  -- Control
  is_fixed BOOLEAN DEFAULT false, -- No puede moverse de fecha
  is_external BOOLEAN DEFAULT false, -- true = personal externo
  
  -- Completamiento
  completion_type TEXT CHECK (completion_type IN ('signed', 'transferred', 'cancelled')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id), -- Puede ser otro técnico
  signature_url TEXT, -- URL de la firma digital del checklist
  mnt_checklist_id UUID REFERENCES mnt_checklists(id), -- Checklist completado
  
  -- Notas
  notes TEXT,
  cancellation_reason TEXT,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  CONSTRAINT check_technician_or_external CHECK (
    (assigned_technician_id IS NOT NULL AND external_personnel_name IS NULL) OR
    (assigned_technician_id IS NULL AND external_personnel_name IS NOT NULL)
  )
);

COMMENT ON TABLE maintenance_assignments IS 'Asignaciones reales de mantenimientos programados';
COMMENT ON COLUMN maintenance_assignments.is_fixed IS 'Si true, admin bloqueó este mantenimiento y no puede cambiar fecha';
COMMENT ON COLUMN maintenance_assignments.completed_by IS 'Quién completó (puede ser diferente al asignado)';

CREATE INDEX idx_maintenance_assignments_date ON maintenance_assignments(scheduled_date DESC);
CREATE INDEX idx_maintenance_assignments_technician ON maintenance_assignments(assigned_technician_id, scheduled_date);
CREATE INDEX idx_maintenance_assignments_status ON maintenance_assignments(status) WHERE status IN ('scheduled', 'in_progress');
CREATE INDEX idx_maintenance_assignments_client ON maintenance_assignments(client_id, scheduled_date);


-- ============================================================
-- 6. TABLA: maintenance_history (Historial de cambios)
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  maintenance_assignment_id UUID NOT NULL REFERENCES maintenance_assignments(id) ON DELETE CASCADE,
  
  -- Tipo de cambio
  change_type TEXT NOT NULL CHECK (change_type IN (
    'created', 'rescheduled', 'reassigned', 'completed', 'cancelled', 'transferred'
  )),
  
  -- Datos anteriores
  old_date DATE,
  old_technician_id UUID REFERENCES profiles(id),
  old_status TEXT,
  
  -- Datos nuevos
  new_date DATE,
  new_technician_id UUID REFERENCES profiles(id),
  new_status TEXT,
  
  -- Información del cambio
  reason TEXT,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE maintenance_history IS 'Historial completo de cambios en asignaciones';

CREATE INDEX idx_maintenance_history_assignment ON maintenance_history(maintenance_assignment_id, created_at DESC);


-- ============================================================
-- 7. FUNCIONES HELPER
-- ============================================================

-- Función: Verificar si un día es festivo
CREATE OR REPLACE FUNCTION is_holiday(check_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM holidays 
    WHERE holiday_date = check_date
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: Verificar si técnico está disponible en una fecha
CREATE OR REPLACE FUNCTION is_technician_available(
  tech_id UUID,
  check_date DATE
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar ausencias aprobadas
  RETURN NOT EXISTS (
    SELECT 1 FROM technician_availability
    WHERE technician_id = tech_id
      AND status = 'approved'
      AND check_date BETWEEN start_date AND end_date
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: Obtener técnico con turno de emergencia activo
CREATE OR REPLACE FUNCTION get_emergency_technician_on_duty(check_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  technician_id UUID,
  technician_name TEXT,
  phone TEXT,
  shift_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    es.technician_id,
    p.full_name,
    COALESCE(es.emergency_phone, p.phone) AS phone,
    es.shift_type
  FROM emergency_shifts es
  JOIN profiles p ON p.id = es.technician_id
  WHERE check_date BETWEEN es.shift_start_date AND es.shift_end_date
    AND es.is_primary = true
  ORDER BY es.shift_type
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: Generar asignaciones automáticas del mes
CREATE OR REPLACE FUNCTION generate_monthly_maintenance_assignments(
  target_month DATE DEFAULT DATE_TRUNC('month', NOW())
)
RETURNS INTEGER AS $$
DECLARE
  schedule_record RECORD;
  assignment_date DATE;
  assignments_created INTEGER := 0;
  days_interval INTEGER;
  occurrence INTEGER;
BEGIN
  -- Iterar sobre configuraciones activas
  FOR schedule_record IN 
    SELECT * FROM maintenance_schedules 
    WHERE is_active = true
  LOOP
    -- Calcular intervalo entre mantenimientos
    days_interval := 30 / schedule_record.maintenance_days_per_month;
    
    -- Generar asignaciones del mes
    FOR occurrence IN 1..schedule_record.maintenance_days_per_month LOOP
      -- Calcular fecha propuesta
      assignment_date := target_month + (days_interval * (occurrence - 1)) * INTERVAL '1 day';
      
      -- Ajustar si cae en fin de semana o festivo
      WHILE EXTRACT(DOW FROM assignment_date) IN (0, 6) OR is_holiday(assignment_date) LOOP
        assignment_date := assignment_date + INTERVAL '1 day';
      END LOOP;
      
      -- Verificar que no exista ya
      IF NOT EXISTS (
        SELECT 1 FROM maintenance_assignments
        WHERE maintenance_schedule_id = schedule_record.id
          AND scheduled_date = assignment_date
      ) THEN
        -- Crear asignación
        INSERT INTO maintenance_assignments (
          maintenance_schedule_id,
          client_id,
          building_name,
          scheduled_date,
          status,
          is_fixed,
          created_by
        ) VALUES (
          schedule_record.id,
          schedule_record.client_id,
          schedule_record.building_name,
          assignment_date,
          'scheduled',
          schedule_record.is_blocked,
          schedule_record.created_by
        );
        
        assignments_created := assignments_created + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN assignments_created;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 8. TRIGGERS
-- ============================================================

-- Trigger: Registrar cambios en historial
CREATE OR REPLACE FUNCTION log_maintenance_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar cambio de fecha
  IF OLD.scheduled_date != NEW.scheduled_date THEN
    INSERT INTO maintenance_history (
      maintenance_assignment_id,
      change_type,
      old_date,
      new_date,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      'rescheduled',
      OLD.scheduled_date,
      NEW.scheduled_date,
      NEW.created_by,
      'Fecha reprogramada'
    );
  END IF;
  
  -- Registrar cambio de técnico
  IF OLD.assigned_technician_id IS DISTINCT FROM NEW.assigned_technician_id THEN
    INSERT INTO maintenance_history (
      maintenance_assignment_id,
      change_type,
      old_technician_id,
      new_technician_id,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      'reassigned',
      OLD.assigned_technician_id,
      NEW.assigned_technician_id,
      NEW.created_by,
      'Técnico reasignado'
    );
  END IF;
  
  -- Registrar completamiento
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    INSERT INTO maintenance_history (
      maintenance_assignment_id,
      change_type,
      old_status,
      new_status,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      'completed',
      OLD.status,
      NEW.status,
      NEW.completed_by,
      'Mantenimiento completado'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maintenance_assignment_history
AFTER UPDATE ON maintenance_assignments
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION log_maintenance_assignment_change();


-- ============================================================
-- 9. VISTAS ÚTILES
-- ============================================================

-- Vista: Calendario mensual con técnicos
CREATE OR REPLACE VIEW v_monthly_maintenance_calendar AS
SELECT
  ma.id,
  ma.scheduled_date,
  EXTRACT(DOW FROM ma.scheduled_date) AS day_of_week, -- 0=domingo, 6=sábado
  ma.building_name,
  c.company_name AS client_name,
  COALESCE(p.full_name, ma.external_personnel_name) AS assigned_to,
  ma.is_external,
  ma.status,
  ma.is_fixed,
  is_holiday(ma.scheduled_date) AS is_holiday_date,
  ma.scheduled_time_start,
  ma.scheduled_time_end,
  ms.estimated_duration_hours,
  ma.completed_at,
  CASE 
    WHEN ma.status = 'completed' THEN 'completed'
    WHEN ma.scheduled_date < CURRENT_DATE AND ma.status != 'completed' THEN 'overdue'
    WHEN ma.scheduled_date = CURRENT_DATE THEN 'today'
    ELSE 'upcoming'
  END AS display_status
FROM maintenance_assignments ma
JOIN clients c ON c.id = ma.client_id
LEFT JOIN profiles p ON p.id = ma.assigned_technician_id
LEFT JOIN maintenance_schedules ms ON ms.id = ma.maintenance_schedule_id
WHERE DATE_TRUNC('month', ma.scheduled_date) = DATE_TRUNC('month', CURRENT_DATE)
ORDER BY ma.scheduled_date, ma.scheduled_time_start;


-- Vista: Técnicos con disponibilidad actual
CREATE OR REPLACE VIEW v_technician_availability_today AS
SELECT
  p.id AS technician_id,
  p.full_name,
  p.phone,
  p.email,
  EXISTS (
    SELECT 1 FROM technician_availability ta
    WHERE ta.technician_id = p.id
      AND ta.status = 'approved'
      AND CURRENT_DATE BETWEEN ta.start_date AND ta.end_date
  ) AS is_on_leave,
  (
    SELECT COUNT(*) FROM maintenance_assignments ma
    WHERE ma.assigned_technician_id = p.id
      AND ma.scheduled_date = CURRENT_DATE
      AND ma.status IN ('scheduled', 'in_progress')
  ) AS assignments_today,
  (
    SELECT es.shift_type FROM emergency_shifts es
    WHERE es.technician_id = p.id
      AND es.is_primary = true
      AND CURRENT_DATE BETWEEN es.shift_start_date AND es.shift_end_date
    LIMIT 1
  ) AS emergency_shift_type
FROM profiles p
WHERE p.role = 'technician'
  AND p.is_active = true
ORDER BY p.full_name;


-- ============================================================
-- 10. POLÍTICAS RLS (Row Level Security)
-- ============================================================

ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY admin_all_maintenance_schedules ON maintenance_schedules FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY admin_all_holidays ON holidays FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY admin_all_availability ON technician_availability FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY admin_all_shifts ON emergency_shifts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY admin_all_assignments ON maintenance_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Técnico: ver sus asignaciones
CREATE POLICY technician_view_own_assignments ON maintenance_assignments FOR SELECT USING (
  assigned_technician_id = auth.uid()
);

-- Técnico: ver su disponibilidad
CREATE POLICY technician_view_own_availability ON technician_availability FOR SELECT USING (
  technician_id = auth.uid()
);

-- Técnico: crear solicitudes de ausencia
CREATE POLICY technician_create_availability ON technician_availability FOR INSERT WITH CHECK (
  technician_id = auth.uid()
);


-- ============================================================
-- RESUMEN DE CAMBIOS
-- ============================================================

/*
✅ TABLAS CREADAS:
   1. maintenance_schedules - Configuración de frecuencia por edificio
   2. holidays - Días festivos configurables
   3. technician_availability - Vacaciones y ausencias
   4. emergency_shifts - Turnos rotativos de emergencia
   5. maintenance_assignments - Asignaciones reales de mantenimientos
   6. maintenance_history - Historial de cambios

✅ FUNCIONES HELPER:
   1. is_holiday(date) - Verificar si es festivo
   2. is_technician_available(id, date) - Verificar disponibilidad
   3. get_emergency_technician_on_duty(date) - Técnico de turno
   4. generate_monthly_maintenance_assignments(month) - Generar asignaciones automáticas

✅ TRIGGERS:
   1. trg_maintenance_assignment_history - Registrar cambios automáticamente

✅ VISTAS:
   1. v_monthly_maintenance_calendar - Calendario del mes con estado visual
   2. v_technician_availability_today - Técnicos disponibles hoy

✅ POLÍTICAS RLS:
   - Admin: acceso total
   - Técnico: ver sus asignaciones y gestionar su disponibilidad

📊 SISTEMA COMPLETO LISTO PARA:
   - Asignación de mantenimientos con drag & drop
   - Gestión de turnos de emergencia
   - Control de ausencias y vacaciones
   - Proyección automática según frecuencia
   - Historial de cambios completo
   - Validaciones de días hábiles y festivos

⏱️ Tiempo estimado de ejecución: 30-45 segundos
*/
