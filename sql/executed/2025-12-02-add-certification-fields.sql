-- Agregar campos de certificación a la tabla mnt_checklists
ALTER TABLE mnt_checklists 
ADD COLUMN IF NOT EXISTS last_certification_date TEXT,
ADD COLUMN IF NOT EXISTS next_certification_date TEXT,
ADD COLUMN IF NOT EXISTS certification_dates_readable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS certification_status TEXT CHECK (certification_status IN ('vigente', 'vencida'));

-- Comentarios para documentar los campos
COMMENT ON COLUMN mnt_checklists.last_certification_date IS 'Última fecha de certificación en formato dd/mm/aaaa';
COMMENT ON COLUMN mnt_checklists.next_certification_date IS 'Próxima fecha de certificación en formato mm/aaaa';
COMMENT ON COLUMN mnt_checklists.certification_dates_readable IS 'Indica si las fechas de certificación son legibles';
COMMENT ON COLUMN mnt_checklists.certification_status IS 'Estado de la certificación: vigente o vencida';
