-- Corregir frecuencias del checklist de mantenimiento
-- Fecha: 2025-12-15
-- M = MENSUAL, T = TRIMESTRAL, S = SEMESTRAL

-- CUARTO DE MÁQUINAS
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 1;  -- Estado de cuartos de máquinas
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 2;  -- Iluminación
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 3;  -- Protecciones térmicas
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 4;  -- Carteles instructivos
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 5;  -- Estado cuadro control
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 6;  -- Estado Seguridades

-- GRUPO TRACTOR
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 7;  -- Niveles aceite
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 8;  -- Estado máquina/motor
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 9;  -- Frenos
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 10; -- Variador frecuencia
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 11; -- Cables por poleas
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 12; -- Dispositivos rescate
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 13; -- Ventilación

-- LIMITADOR DE VELOCIDAD
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 14; -- Polea superior
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 15; -- Precintos
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 16; -- Contacto eléctrico
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 17; -- Para-caídas

-- GRUPO HIDRÁULICO (solo hidráulicos)
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 18; -- Pistón, válvulas
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 19; -- Nivel aceite
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 20; -- Unidad enfriadora

-- CABINA
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 21; -- Placas
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 22; -- Suelo, espejo
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 23; -- Citofonía
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 24; -- Pulsadores
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 25; -- Luz emergencia
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 26; -- Malla infrarroja
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 27; -- Operador puerta
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 28; -- Niveles paradas
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 29; -- Limpieza
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 30; -- Comando mantenimiento

-- CABLES DE SUSPENSIÓN
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 31; -- Cables suspensión
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 32; -- Tensión cables
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 33; -- Amarres

-- PUERTAS DE ACCESO
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 34; -- Contactos
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 35; -- Botoneras
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 36; -- Suspensión
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 37; -- Apertura/cierre
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 38; -- Patines
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 39; -- Holgura

-- ZAPATAS GUÍAS
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 40; -- Guías cables
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 41; -- Guías contrapeso
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 42; -- Anclajes rieles
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 43; -- Lubricación

-- DUCTO
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 44; -- Información magnética
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 45; -- Iluminación escotilla
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 46; -- Límites recorrido
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 47; -- Polea inferior
UPDATE mnt_checklist_questions SET frequency = 'S' WHERE question_number = 48; -- Cables viajantes
UPDATE mnt_checklist_questions SET frequency = 'T' WHERE question_number = 49; -- Paragolpes
UPDATE mnt_checklist_questions SET frequency = 'M' WHERE question_number = 50; -- Limpieza pozo

-- Verificar cambios
SELECT 
  question_number as "Nº",
  CASE 
    WHEN frequency = 'M' THEN 'MENSUAL'
    WHEN frequency = 'T' THEN 'TRIMESTRAL'
    WHEN frequency = 'S' THEN 'SEMESTRAL'
  END as "Frecuencia",
  question_text as "Pregunta"
FROM mnt_checklist_questions
ORDER BY question_number;

-- Resumen por frecuencia
SELECT 
  CASE 
    WHEN frequency = 'M' THEN 'MENSUAL'
    WHEN frequency = 'T' THEN 'TRIMESTRAL'
    WHEN frequency = 'S' THEN 'SEMESTRAL'
  END as "Frecuencia",
  COUNT(*) as "Total"
FROM mnt_checklist_questions
GROUP BY frequency
ORDER BY 
  CASE frequency 
    WHEN 'M' THEN 1
    WHEN 'T' THEN 2
    WHEN 'S' THEN 3
  END;
