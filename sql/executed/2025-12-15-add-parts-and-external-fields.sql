-- Agregar campos para vinculación de repuestos y apoyo externo
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS work_order_number VARCHAR(50), -- Número de OT externa para repuestos
ADD COLUMN IF NOT EXISTS quotation_number VARCHAR(50),  -- Número de cotización externa
ADD COLUMN IF NOT EXISTS quotation_amount DECIMAL(12,2), -- Monto de la cotización
ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255);     -- Nombre del proveedor externo

-- Comentarios
COMMENT ON COLUMN service_requests.work_order_number IS 'Número de orden de trabajo externa vinculada (para repuestos)';
COMMENT ON COLUMN service_requests.quotation_number IS 'Número de cotización externa vinculada';
COMMENT ON COLUMN service_requests.quotation_amount IS 'Monto de la cotización en CLP';
COMMENT ON COLUMN service_requests.provider_name IS 'Nombre del proveedor o especialista externo';
