-- Añadir columna elevator_number a public.elevators (si no existe)
ALTER TABLE public.elevators
  ADD COLUMN IF NOT EXISTS elevator_number integer;

-- Rellenar elevator_number para ascensores existentes: numerar por cliente_id y por campo de edificio (uso COALESCE de building_name o location_name)
WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, COALESCE(building_name, location_name)
      ORDER BY id
    ) AS rn
  FROM public.elevators
)
UPDATE public.elevators e
SET elevator_number = o.rn
FROM ordered o
WHERE e.id = o.id;

-- Crear función/trigger para asignar elevator_number automáticamente al insertar
CREATE OR REPLACE FUNCTION public.assign_elevator_number()
RETURNS trigger AS $$
DECLARE
  nextnum integer;
BEGIN
  IF NEW.elevator_number IS NULL THEN
    SELECT COALESCE(MAX(elevator_number), 0) + 1
    INTO nextnum
    FROM public.elevators
    WHERE client_id = NEW.client_id
      AND COALESCE(building_name, location_name) = COALESCE(NEW.building_name, NEW.location_name);
    NEW.elevator_number := nextnum;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_elevator_number ON public.elevators;

CREATE TRIGGER trg_assign_elevator_number
BEFORE INSERT ON public.elevators
FOR EACH ROW
EXECUTE FUNCTION public.assign_elevator_number();

-- Opcional: índice único por cliente+edificio+numero para prevenir duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_elevators_client_building_number
  ON public.elevators (client_id, COALESCE(building_name, location_name), elevator_number);
