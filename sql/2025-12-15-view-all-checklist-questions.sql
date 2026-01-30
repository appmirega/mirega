-- Ver las 50 preguntas del checklist con sus frecuencias
-- Fecha: 2025-12-15

SELECT 
  question_number as "Nº",
  question_text as "Pregunta",
  section as "Sección",
  CASE 
    WHEN frequency = 'M' THEN 'MENSUAL'
    WHEN frequency = 'T' THEN 'TRIMESTRAL'
    WHEN frequency = 'S' THEN 'SEMESTRAL'
    ELSE frequency
  END as "Frecuencia",
  CASE 
    WHEN is_hydraulic_only = true THEN 'Solo Hidráulicos'
    ELSE 'Todos'
  END as "Aplica a"
FROM mnt_checklist_questions
ORDER BY question_number;

-- Resumen por frecuencia
SELECT 
  CASE 
    WHEN frequency = 'M' THEN 'MENSUAL'
    WHEN frequency = 'T' THEN 'TRIMESTRAL'
    WHEN frequency = 'S' THEN 'SEMESTRAL'
    ELSE frequency
  END as "Frecuencia",
  COUNT(*) as "Cantidad de Preguntas"
FROM mnt_checklist_questions
GROUP BY frequency
ORDER BY 
  CASE frequency 
    WHEN 'M' THEN 1
    WHEN 'T' THEN 2
    WHEN 'S' THEN 3
  END;
