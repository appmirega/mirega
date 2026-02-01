-- Primero, eliminar las columnas si existen (para recrearlas con el tipo correcto)
ALTER TABLE mnt_checklists 
DROP COLUMN IF EXISTS last_certification_date,
DROP COLUMN IF EXISTS next_certification_date,
DROP COLUMN IF EXISTS certification_dates_readable,
DROP COLUMN IF EXISTS certification_status;

-- Agregar campos de certificación con tipo TEXT (no DATE)
ALTER TABLE mnt_checklists 
ADD COLUMN last_certification_date TEXT,
ADD COLUMN next_certification_date TEXT,
ADD COLUMN certification_dates_readable BOOLEAN DEFAULT true,
ADD COLUMN certification_status TEXT CHECK (certification_status IN ('vigente', 'vencida'));

-- Comentarios para documentar los campos
COMMENT ON COLUMN mnt_checklists.last_certification_date IS 'Última fecha de certificación en formato dd/mm/aaaa (texto)';
COMMENT ON COLUMN mnt_checklists.next_certification_date IS 'Próxima fecha de certificación en formato mm/aaaa (texto)';
COMMENT ON COLUMN mnt_checklists.certification_dates_readable IS 'Indica si las fechas de certificación son legibles';
COMMENT ON COLUMN mnt_checklists.certification_status IS 'Estado de la certificación: vigente o vencida';
