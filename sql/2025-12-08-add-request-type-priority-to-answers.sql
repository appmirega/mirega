-- Agregar campos de tipo y prioridad de solicitud a las respuestas del checklist
ALTER TABLE mnt_checklist_answers 
ADD COLUMN IF NOT EXISTS request_type TEXT CHECK (request_type IN ('reparacion', 'repuestos', 'soporte', 'inspeccion')),
ADD COLUMN IF NOT EXISTS request_priority TEXT CHECK (request_priority IN ('baja', 'media', 'alta', 'critica'));

-- Comentarios para documentar los campos
COMMENT ON COLUMN mnt_checklist_answers.request_type IS 'Tipo de solicitud de servicio: reparacion, repuestos, soporte, inspeccion';
COMMENT ON COLUMN mnt_checklist_answers.request_priority IS 'Prioridad de la solicitud: baja, media, alta, critica';
