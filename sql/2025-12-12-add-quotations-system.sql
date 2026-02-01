-- Sistema de Cotizaciones para Solicitudes de Servicio
-- Permite generar cotizaciones cuando se requieren repuestos

-- Tabla principal de cotizaciones
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  quotation_number TEXT UNIQUE NOT NULL, -- Ej: COT-2025-001
  
  -- Montos
  subtotal DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 19.00, -- IVA 19%
  tax_amount DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  
  -- Estado de la cotización
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, expired
  
  -- Notas
  notes TEXT,
  terms_and_conditions TEXT,
  
  -- Vigencia
  valid_until DATE,
  
  -- Aprobación/Rechazo
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
);

-- Tabla de items de cotización
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  
  -- Detalles del item
  item_number INTEGER NOT NULL, -- Orden del item (1, 2, 3...)
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  
  -- Información adicional
  part_number TEXT, -- Código del repuesto
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_unit_price CHECK (unit_price >= 0)
);

-- Agregar referencia de cotización en service_requests
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_quotations_service_request ON quotations(service_request_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- Función para generar número de cotización automático
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  new_number TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Obtener el último número del año actual
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(quotation_number FROM 'COT-' || year_part || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM quotations
  WHERE quotation_number LIKE 'COT-' || year_part || '-%';
  
  new_number := 'COT-' || year_part || '-' || LPAD(sequence_num::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_quotation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotations_update_timestamp
BEFORE UPDATE ON quotations
FOR EACH ROW
EXECUTE FUNCTION update_quotation_timestamp();

-- Comentarios
COMMENT ON TABLE quotations IS 'Cotizaciones generadas para solicitudes de servicio que requieren repuestos';
COMMENT ON TABLE quotation_items IS 'Items/líneas de cada cotización';
COMMENT ON COLUMN quotations.quotation_number IS 'Número único de cotización (COT-YYYY-NNN)';
COMMENT ON COLUMN quotations.status IS 'Estado: pending (pendiente aprobación), approved (aprobada por cliente), rejected (rechazada), expired (venció)';
COMMENT ON COLUMN quotations.tax_rate IS 'Tasa de impuesto (IVA) en porcentaje';
COMMENT ON COLUMN quotations.valid_until IS 'Fecha de vencimiento de la cotización';
COMMENT ON COLUMN quotation_items.item_number IS 'Número de orden del item en la cotización';
COMMENT ON COLUMN quotation_items.part_number IS 'Código o número de parte del repuesto';
