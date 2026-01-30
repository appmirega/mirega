-- 50 Preguntas del Checklist de Mantenimiento MIREGA
-- Basado en el formato oficial del PDF
-- M = Mensual, T = Trimestral, S = Semestral

-- Limpiar preguntas existentes
TRUNCATE TABLE mnt_checklist_questions CASCADE;

-- Insertar las 50 preguntas exactas del formato oficial
INSERT INTO mnt_checklist_questions (question_number, section, question_text, frequency, is_hydraulic_only) VALUES

-- CUARTO DE MÁQUINAS (1-6)
(1, 'CUARTO DE MÁQUINAS', 'Estado de cuartos de máquinas y limpieza', 'M', false),
(2, 'CUARTO DE MÁQUINAS', 'Iluminación permanente y emergencia', 'M', false),
(3, 'CUARTO DE MÁQUINAS', 'Protecciones térmicas y diferenciales', 'M', false),
(4, 'CUARTO DE MÁQUINAS', 'Carteles instructivos', 'M', false),
(5, 'CUARTO DE MÁQUINAS', 'Estado general del cuadro de control', 'M', false),
(6, 'CUARTO DE MÁQUINAS', 'Estado de Seguridades', 'M', false),

-- GRUPO TRACTOR (7-13)
(7, 'GRUPO TRACTOR', 'Estado de niveles de aceite', 'M', false),
(8, 'GRUPO TRACTOR', 'Estado de máquina y/o motor', 'M', false),
(9, 'GRUPO TRACTOR', 'Frenos principal, balatas, tambor/disco', 'M', false),
(10, 'GRUPO TRACTOR', 'Estado variador de frecuencia', 'T', false),
(11, 'GRUPO TRACTOR', 'Paso de cables por poleas y estado poleas', 'T', false),
(12, 'GRUPO TRACTOR', 'Dispositivos de rescate, señales de nivel', 'T', false),
(13, 'GRUPO TRACTOR', 'Estado ventilación forzada', 'S', false),

-- LIMITADOR DE VELOCIDAD (14-17)
(14, 'LIMITADOR DE VELOCIDAD', 'Estado de polea superior y del cable', 'M', false),
(15, 'LIMITADOR DE VELOCIDAD', 'Estado de precintos y funcionamiento', 'T', false),
(16, 'LIMITADOR DE VELOCIDAD', 'Contacto eléctrico', 'T', false),
(17, 'LIMITADOR DE VELOCIDAD', 'Funcionamiento libre de para-caídas', 'S', false),

-- GRUPO HIDRÁULICO, CILINDRO Y VÁLVULAS (18-20)
(18, 'GRUPO HIDRÁULICO, CILINDRO Y VÁLVULAS', 'Estado de pistón, válvulas y central', 'M', true),
(19, 'GRUPO HIDRÁULICO, CILINDRO Y VÁLVULAS', 'Verificar nivel aceite', 'M', true),
(20, 'GRUPO HIDRÁULICO, CILINDRO Y VÁLVULAS', 'Estado unidad enfriadora', 'T', true),

-- CABINA (21-30) - Primera parte
(21, 'CABINA', 'Placa de capacidad y placa de datos empresa', 'M', false),
(22, 'CABINA', 'Suelo, espejo de cabina e iluminación', 'M', false),
(23, 'CABINA', 'Comprobar citofonía y alarma', 'M', false),
(24, 'CABINA', 'Pulsadores, display e indicadores', 'M', false),
(25, 'CABINA', 'Luz de emergencia', 'M', false),
(26, 'CABINA', 'Malla infrarroja, limitador de fuerza', 'M', false),
(27, 'CABINA', 'Limpieza y estado de operador de puerta', 'M', false),
(28, 'CABINA', 'Niveles de paradas en pisos', 'M', false),
(29, 'CABINA', 'Limpieza general', 'M', false),
(30, 'CABINA', 'Estado de comando mantenimiento', 'T', false),

-- CABLES DE SUSPENSIÓN Y AMARRAS (31-33)
(31, 'CABLES DE SUSPENSIÓN Y AMARRAS', 'Comprobar cables de suspensión', 'M', false),
(32, 'CABLES DE SUSPENSIÓN Y AMARRAS', 'Tensión de cables y diámetro', 'T', false),
(33, 'CABLES DE SUSPENSIÓN Y AMARRAS', 'Amarres, tuercas, pasadores y precintos', 'S', false),

-- PUERTAS DE ACCESO Y PISO (34-39)
(34, 'PUERTAS DE ACCESO Y PISO', 'Comprobar los contactos y enclavamientos', 'M', false),
(35, 'PUERTAS DE ACCESO Y PISO', 'Botoneras de pisos, pulsadores e indicadores', 'M', false),
(36, 'PUERTAS DE ACCESO Y PISO', 'Estado de suspensión y amortiguadores', 'M', false),
(37, 'PUERTAS DE ACCESO Y PISO', 'Apertura y cierre correcto de puertas', 'M', false),
(38, 'PUERTAS DE ACCESO Y PISO', 'Comprobar patines y limpiar correderas', 'T', false),
(39, 'PUERTAS DE ACCESO Y PISO', 'Holgura entre puerta y marco (5mm)', 'S', false),

-- ZAPATAS GUÍAS DE CABINA Y CONTRAPESO (40-43)
(40, 'ZAPATAS GUÍAS DE CABINA Y CONTRAPESO', 'Guías de cables y cuñas', 'M', false),
(41, 'ZAPATAS GUÍAS DE CABINA Y CONTRAPESO', 'Guías de contrapeso', 'T', false),
(42, 'ZAPATAS GUÍAS DE CABINA Y CONTRAPESO', 'Anclajes de rieles', 'T', false),
(43, 'ZAPATAS GUÍAS DE CABINA Y CONTRAPESO', 'Sistemas de lubricación automática', 'S', false),

-- DUCTO (44-50)
(44, 'DUCTO', 'Estado de información magnética y/o mecánica', 'M', false),
(45, 'DUCTO', 'Estado iluminación escotilla', 'M', false),
(46, 'DUCTO', 'Funcionamiento de limites recorrido y seguridades', 'M', false),
(47, 'DUCTO', 'Estado de polea inferior limitador de velocidad', 'T', false),
(48, 'DUCTO', 'Medios de compensación, cables viajantes', 'T', false),
(49, 'DUCTO', 'Estado de paragolpes', 'T', false),
(50, 'DUCTO', 'Limpieza de pozo, escalera de acceso', 'S', false);

-- Verificar que se insertaron las 50 preguntas
SELECT COUNT(*) as total_preguntas FROM mnt_checklist_questions;
