-- Add columns for quotation PDF and foreign parts lead time
-- Safe to run multiple times

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS external_quotation_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS foreign_parts_lead_time TEXT;

-- Index to help search by presence of quotation PDF (optional)
CREATE INDEX IF NOT EXISTS idx_work_orders_has_quotation_pdf
  ON work_orders ((external_quotation_pdf_url IS NOT NULL));

-- Validation
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'work_orders'
  AND column_name IN ('external_quotation_pdf_url', 'foreign_parts_lead_time');

SELECT 'Columns external_quotation_pdf_url and foreign_parts_lead_time ready' AS status;
