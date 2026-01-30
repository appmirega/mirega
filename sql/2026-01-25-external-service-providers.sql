-- External Service Providers System
-- Tabla para gestionar prestadores de servicios externos
-- Incluye: Empresas, Trabajadores Externos, Especialistas en marcas

-- DROP TABLE IF EXISTS external_service_providers CASCADE;

CREATE TABLE IF NOT EXISTS external_service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información básica
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  
  -- Tipo de prestador
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('company', 'individual', 'specialist')),
  -- 'company': Empresa que factura servicios
  -- 'individual': Trabajador externo esporádico
  -- 'specialist': Especialista en marca específica
  
  -- Categoría de servicio
  service_category VARCHAR(100),
  -- Ej: 'general_maintenance', 'repair', 'installation', 'specialized_work'
  
  -- Especialización (para especialistas en marcas)
  elevator_brand_specialty VARCHAR(100),
  -- Ej: 'KONE', 'Thyssenkrupp', 'Schindler', 'Mitsubishi', etc.
  
  -- Información de contacto
  contact_person VARCHAR(255),
  company_name VARCHAR(255), -- Para empresas
  address TEXT,
  city VARCHAR(100),
  region VARCHAR(100),
  postal_code VARCHAR(20),
  rut_number VARCHAR(20), -- Para empresas chilenas
  
  -- Información financiera
  payment_method VARCHAR(50), -- 'invoice', 'transfer', 'cash'
  payment_terms VARCHAR(100), -- Ej: '30 días neto', 'contra entrega'
  average_hourly_rate DECIMAL(10,2), -- Para individuos
  estimated_cost_range VARCHAR(100), -- Ej: '$500k-$1.5M'
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  
  -- Referencias
  reference_company VARCHAR(255), -- Empresa que lo recomienda
  certifications TEXT[], -- Array de certificaciones
  experience_years INTEGER,
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Notas
  notes TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_external_providers_type 
  ON external_service_providers(provider_type);

CREATE INDEX IF NOT EXISTS idx_external_providers_active 
  ON external_service_providers(is_active);

CREATE INDEX IF NOT EXISTS idx_external_providers_brand 
  ON external_service_providers(elevator_brand_specialty);

CREATE INDEX IF NOT EXISTS idx_external_providers_city 
  ON external_service_providers(city);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION trigger_update_external_providers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_external_providers_updated_at ON external_service_providers;

CREATE TRIGGER trigger_external_providers_updated_at
BEFORE UPDATE ON external_service_providers
FOR EACH ROW
EXECUTE FUNCTION trigger_update_external_providers_timestamp();

-- RPC: Get active providers by type
CREATE OR REPLACE FUNCTION get_active_providers_by_type(p_type VARCHAR)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  provider_type VARCHAR,
  service_category VARCHAR,
  elevator_brand_specialty VARCHAR,
  phone VARCHAR,
  email VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    external_service_providers.id,
    external_service_providers.name,
    external_service_providers.provider_type,
    external_service_providers.service_category,
    external_service_providers.elevator_brand_specialty,
    external_service_providers.phone,
    external_service_providers.email
  FROM external_service_providers
  WHERE external_service_providers.provider_type = p_type
    AND external_service_providers.is_active = true
  ORDER BY external_service_providers.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get specialists by brand
CREATE OR REPLACE FUNCTION get_specialists_by_brand(p_brand VARCHAR)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  company_name VARCHAR,
  contact_person VARCHAR,
  phone VARCHAR,
  email VARCHAR,
  experience_years INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    external_service_providers.id,
    external_service_providers.name,
    external_service_providers.company_name,
    external_service_providers.contact_person,
    external_service_providers.phone,
    external_service_providers.email,
    external_service_providers.experience_years
  FROM external_service_providers
  WHERE external_service_providers.elevator_brand_specialty = p_brand
    AND external_service_providers.is_active = true
  ORDER BY external_service_providers.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Create new provider
CREATE OR REPLACE FUNCTION create_external_provider(
  p_name VARCHAR,
  p_email VARCHAR,
  p_phone VARCHAR,
  p_provider_type VARCHAR,
  p_service_category VARCHAR,
  p_elevator_brand_specialty VARCHAR DEFAULT NULL,
  p_contact_person VARCHAR DEFAULT NULL,
  p_company_name VARCHAR DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city VARCHAR DEFAULT NULL,
  p_region VARCHAR DEFAULT NULL,
  p_payment_method VARCHAR DEFAULT 'invoice',
  p_rut_number VARCHAR DEFAULT NULL,
  p_experience_years INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  -- Validar tipo de prestador
  IF p_provider_type NOT IN ('company', 'individual', 'specialist') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Tipo de prestador inválido'
    );
  END IF;

  -- Crear proveedor
  INSERT INTO external_service_providers (
    name, email, phone, provider_type, service_category,
    elevator_brand_specialty, contact_person, company_name, address,
    city, region, payment_method, rut_number, experience_years,
    notes, created_by
  ) VALUES (
    p_name, p_email, p_phone, p_provider_type, p_service_category,
    p_elevator_brand_specialty, p_contact_person, p_company_name, p_address,
    p_city, p_region, p_payment_method, p_rut_number, p_experience_years,
    p_notes, auth.uid()
  ) RETURNING id INTO v_provider_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Prestador creado exitosamente',
    'provider_id', v_provider_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', 'Error al crear prestador: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed data: Ejemplos iniciales (comentados, descomentar si lo necesitas)
/*
INSERT INTO external_service_providers (
  name, email, phone, provider_type, service_category, 
  elevator_brand_specialty, company_name, contact_person,
  city, region, payment_method, experience_years, is_active, notes
) VALUES
  (
    'Servicios Elevadores KONE',
    'contacto@kone-chile.cl',
    '+56 2 2123 4567',
    'company',
    'specialized_work',
    'KONE',
    'KONE Chile S.A.',
    'Roberto García',
    'Santiago',
    'Metropolitana',
    'invoice',
    15,
    true,
    'Especialistas en mantenimiento KONE con certifications actualizadas'
  ),
  (
    'Juan Pérez - Especialista Thyssenkrupp',
    'juan.perez@email.com',
    '+56 9 8765 4321',
    'specialist',
    'maintenance',
    'Thyssenkrupp',
    NULL,
    'Juan Pérez',
    'Ñuñoa',
    'Metropolitana',
    'transfer',
    8,
    true,
    'Experiencia en reparación de componentes Thyssenkrupp'
  ),
  (
    'Carlos López - Técnico Independiente',
    'carlos.tecnico@email.com',
    '+56 9 1234 5678',
    'individual',
    'general_maintenance',
    NULL,
    NULL,
    'Carlos López',
    'La Florida',
    'Metropolitana',
    'cash',
    5,
    true,
    'Disponible para trabajos puntuales y mantenimiento general'
  );
*/

-- Validación: Asegurar que la tabla existe y tiene datos
SELECT 
  COUNT(*) as total_providers,
  COUNT(CASE WHEN provider_type = 'company' THEN 1 END) as companies,
  COUNT(CASE WHEN provider_type = 'individual' THEN 1 END) as individuals,
  COUNT(CASE WHEN provider_type = 'specialist' THEN 1 END) as specialists
FROM external_service_providers;

-- Mensaje de éxito
SELECT 'External service providers table created successfully' as status;
