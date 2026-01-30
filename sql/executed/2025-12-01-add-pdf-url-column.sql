-- Agregar columna pdf_url a la tabla mnt_checklists
ALTER TABLE mnt_checklists
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Comentario explicativo
COMMENT ON COLUMN mnt_checklists.pdf_url IS 'URL pública del PDF generado del checklist de mantenimiento';

-- Crear bucket de almacenamiento para PDFs de mantenimiento (si no existe)
-- Ejecutar esto en el dashboard de Supabase Storage o via SQL:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('maintenance-pdfs', 'maintenance-pdfs', true)
-- ON CONFLICT (id) DO NOTHING;

-- Política de acceso público para lectura de PDFs
-- CREATE POLICY "PDFs públicos para lectura"
-- ON storage.objects FOR SELECT
-- TO public
-- USING (bucket_id = 'maintenance-pdfs');

-- Política para que técnicos puedan subir PDFs
-- CREATE POLICY "Técnicos pueden subir PDFs"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'maintenance-pdfs');
