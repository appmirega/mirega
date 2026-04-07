import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Filter,
  Layers3,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';

type StopPattern = 'all' | 'odd' | 'even';
type ElevatorDriveType = 'electromecanico' | 'hidraulico' | '';
type ElevatorClassification = 'ascensor' | 'montacarga' | 'montaplatos' | 'otro' | '';

interface ElevatorRow {
  id: string;
  client_id: string;
  elevator_number: number | null;
  tower_name: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  serial_number_not_legible: boolean | null;
  installation_date: string | null;
  floors: number | null;
  capacity_kg: number | null;
  capacity_persons: number | null;
  elevator_type: ElevatorDriveType | null;
  classification: ElevatorClassification | null;
  has_machine_room: boolean | null;
  no_machine_room: boolean | null;
  stops_all_floors: boolean | null;
  stops_odd_floors: boolean | null;
  stops_even_floors: boolean | null;
  location_building: string | null;
  location_address: string | null;
  address_asc: string | null;
  status: string | null;
}

interface EditableElevator extends ElevatorRow {
  expanded: boolean;
  isEditing: boolean;
  saving?: boolean;
}

const CLASSIFICATION_OPTIONS: ElevatorClassification[] = [
  'ascensor',
  'montacarga',
  'montaplatos',
  'otro',
  '',
];

const DRIVE_OPTIONS: ElevatorDriveType[] = ['electromecanico', 'hidraulico', ''];

function normalizeString(value: string) {
  return value.trim().toUpperCase();
}

function parseOptionalNumber(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function getStopPattern(row: ElevatorRow): StopPattern {
  if (row.stops_odd_floors) return 'odd';
  if (row.stops_even_floors) return 'even';
  return 'all';
}

function getMachineRoomValue(row: ElevatorRow) {
  if (row.has_machine_room) return 'yes';
  if (row.no_machine_room) return 'no';
  return 'unknown';
}

function toInputDate(value: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function getBuildingLabel(row: ElevatorRow) {
  return row.location_building || row.location_address || row.address_asc || 'SIN REFERENCIA';
}

function getElevatorLabel(row: ElevatorRow) {
  const number = row.elevator_number ?? '-';
  return row.tower_name ? `${row.tower_name} · Ascensor #${number}` : `Ascensor #${number}`;
}

function cloneRow(row: ElevatorRow, expanded = false): EditableElevator {
  return {
    ...row,
    expanded,
    isEditing: false,
    saving: false,
  };
}

function getComparablePayload(row: ElevatorRow) {
  return JSON.stringify({
    tower_name: row.tower_name || null,
    brand: row.brand || null,
    model: row.model || null,
    serial_number: row.serial_number || null,
    serial_number_not_legible: Boolean(row.serial_number_not_legible),
    installation_date: row.installation_date || null,
    floors: row.floors ?? null,
    capacity_kg: row.capacity_kg ?? null,
    capacity_persons: row.capacity_persons ?? null,
    elevator_type: row.elevator_type || null,
    classification: row.classification || null,
    has_machine_room: Boolean(row.has_machine_room),
    no_machine_room: Boolean(row.no_machine_room),
    stops_all_floors: Boolean(row.stops_all_floors),
    stops_odd_floors: Boolean(row.stops_odd_floors),
    stops_even_floors: Boolean(row.stops_even_floors),
  });
}

export default function TechnicianClientTechnicalView() {
  const [rows, setRows] = useState<EditableElevator[]>([]);
  const [originalRows, setOriginalRows] = useState<Record<string, ElevatorRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const loadElevators = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('elevators')
        .select(`
          id,
          client_id,
          elevator_number,
          tower_name,
          brand,
          model,
          serial_number,
          serial_number_not_legible,
          installation_date,
          floors,
          capacity_kg,
          capacity_persons,
          elevator_type,
          classification,
          has_machine_room,
          no_machine_room,
          stops_all_floors,
          stops_odd_floors,
          stops_even_floors,
          location_building,
          location_address,
          address_asc,
          status
        `)
        .order('location_building', { ascending: true })
        .order('tower_name', { ascending: true })
        .order('elevator_number', { ascending: true });

      if (queryError) throw queryError;

      const loadedRows = (data || []).map((row: ElevatorRow, index: number) =>
        cloneRow(row, index === 0)
      );

      const originals = Object.fromEntries(
        (data || []).map((row: ElevatorRow) => [row.id, { ...row }])
      );

      setRows(loadedRows);
      setOriginalRows(originals);
    } catch (err: any) {
      console.error('Error cargando ascensores técnicos:', err);
      setError(err?.message || 'No fue posible cargar los ascensores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadElevators();
  }, []);

  const buildingOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => getBuildingLabel(row)))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const building = getBuildingLabel(row);
      const text = [
        building,
        row.tower_name || '',
        row.brand || '',
        row.model || '',
        row.serial_number || '',
        row.elevator_number?.toString() || '',
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !term || text.includes(term);
      const matchesBuilding = buildingFilter === 'all' || building === buildingFilter;
      const matchesStatus = statusFilter === 'all' || (row.status || '') === statusFilter;
      const isIncomplete =
        !row.brand ||
        !row.model ||
        (!row.serial_number && !row.serial_number_not_legible) ||
        !row.installation_date ||
        !row.floors ||
        !row.capacity_kg ||
        !row.capacity_persons;

      return matchesSearch && matchesBuilding && matchesStatus && (!onlyIncomplete || isIncomplete);
    });
  }, [rows, search, buildingFilter, statusFilter, onlyIncomplete]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, EditableElevator[]>();

    filteredRows.forEach((row) => {
      const building = getBuildingLabel(row);
      const current = groups.get(building) || [];
      current.push(row);
      groups.set(building, current);
    });

    return Array.from(groups.entries());
  }, [filteredRows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter(
      (row) =>
        row.brand &&
        row.model &&
        (row.serial_number || row.serial_number_not_legible) &&
        row.installation_date &&
        row.floors &&
        row.capacity_kg &&
        row.capacity_persons
    ).length;

    return {
      total,
      completed,
      pending: total - completed,
      buildings: buildingOptions.length,
      editing: rows.filter((row) => row.isEditing).length,
    };
  }, [rows, buildingOptions.length]);

  const updateRow = (id: string, field: keyof EditableElevator, value: any) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const updateStopPattern = (id: string, value: StopPattern) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              stops_all_floors: value === 'all',
              stops_odd_floors: value === 'odd',
              stops_even_floors: value === 'even',
            }
          : row
      )
    );
  };

  const updateMachineRoom = (id: string, value: 'yes' | 'no' | 'unknown') => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              has_machine_room: value === 'yes',
              no_machine_room: value === 'no',
            }
          : row
      )
    );
  };

  const toggleExpanded = (id: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, expanded: !row.expanded } : row))
    );
  };

  const startEditing = (id: string) => {
    setSuccess(null);
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, isEditing: true, expanded: true } : row))
    );
  };

  const cancelEditing = (id: string) => {
    const original = originalRows[id];
    if (!original) return;

    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...cloneRow(original, row.expanded),
              isEditing: false,
            }
          : row
      )
    );
  };

  const buildUpdatePayload = (row: EditableElevator) => ({
    tower_name: row.tower_name?.trim() ? normalizeString(row.tower_name) : null,
    brand: row.brand?.trim() ? normalizeString(row.brand) : null,
    model: row.model?.trim() ? normalizeString(row.model) : null,
    serial_number: row.serial_number_not_legible
      ? null
      : row.serial_number?.trim()
      ? normalizeString(row.serial_number)
      : null,
    serial_number_not_legible: Boolean(row.serial_number_not_legible),
    installation_date: row.installation_date?.trim() ? row.installation_date : null,
    floors:
      typeof row.floors === 'number' ? row.floors : parseOptionalNumber(String(row.floors ?? '')),
    capacity_kg:
      typeof row.capacity_kg === 'number'
        ? row.capacity_kg
        : parseOptionalNumber(String(row.capacity_kg ?? '')),
    capacity_persons:
      typeof row.capacity_persons === 'number'
        ? row.capacity_persons
        : parseOptionalNumber(String(row.capacity_persons ?? '')),
    elevator_type: row.elevator_type || null,
    classification: row.classification || null,
    has_machine_room: Boolean(row.has_machine_room),
    no_machine_room: Boolean(row.no_machine_room),
    stops_all_floors: Boolean(row.stops_all_floors),
    stops_odd_floors: Boolean(row.stops_odd_floors),
    stops_even_floors: Boolean(row.stops_even_floors),
  });

  const saveRow = async (row: EditableElevator) => {
    const { error: updateError } = await supabase
      .from('elevators')
      .update(buildUpdatePayload(row))
      .eq('id', row.id);

    if (updateError) throw updateError;
  };

  const handleSaveOne = async (row: EditableElevator) => {
    setError(null);
    setSuccess(null);
    updateRow(row.id, 'saving', true);

    try {
      await saveRow(row);

      const cleanRow: ElevatorRow = {
        ...row,
      };

      setOriginalRows((prev) => ({
        ...prev,
        [row.id]: cleanRow,
      }));

      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, isEditing: false, saving: false } : item
        )
      );

      setSuccess(`${getElevatorLabel(row)} actualizado correctamente.`);
    } catch (err: any) {
      console.error('Error guardando ascensor:', err);
      setError(err?.message || 'No fue posible guardar este ascensor.');
      updateRow(row.id, 'saving', false);
    }
  };

  const handleSaveAll = async () => {
    const editedRows = filteredRows.filter((row) => row.isEditing);
    if (editedRows.length === 0) {
      setSuccess('No hay tarjetas en modo edición.');
      return;
    }

    setSavingAll(true);
    setError(null);
    setSuccess(null);

    try {
      for (const row of editedRows) {
        await saveRow(row);
      }

      await loadElevators();
      setSuccess('Información técnica actualizada correctamente.');
    } catch (err: any) {
      console.error('Error guardando edición técnica:', err);
      setError(err?.message || 'No fue posible guardar los cambios.');
    } finally {
      setSavingAll(false);
    }
  };

  const handleCancelAll = () => {
    setRows((prev) =>
      prev.map((row) => {
        if (!row.isEditing) return row;
        const original = originalRows[row.id];
        return original ? { ...cloneRow(original, row.expanded), isEditing: false } : row;
      })
    );
    setSuccess('Cambios no guardados descartados.');
    setError(null);
  };

  const isDirty = (row: EditableElevator) => {
    const original = originalRows[row.id];
    if (!original) return false;
    return getComparablePayload(row) !== getComparablePayload(original);
  };

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Loader2 className='h-10 w-10 animate-spin text-slate-700' />
      </div>
    );
  }

  return (
    <div className='space-y-6 p-6'>
      <div className='rounded-2xl border bg-white p-6 shadow-sm'>
        <div className='flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between'>
          <div>
            <div className='flex items-center gap-3'>
              <div className='rounded-xl bg-blue-100 p-3 text-blue-700'>
                <Wrench className='h-6 w-6' />
              </div>
              <div>
                <h1 className='text-3xl font-bold text-slate-900'>Información técnica de ascensores</h1>
                <p className='mt-1 text-sm text-slate-600'>
                  La vista es de solo lectura por defecto. Para modificar un ascensor, primero presiona
                  <span className='font-semibold'> Editar</span>.
                </p>
              </div>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <button
              type='button'
              onClick={handleCancelAll}
              className='inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
            >
              <RotateCcw className='h-4 w-4' />
              Cancelar ediciones
            </button>

            <button
              type='button'
              onClick={handleSaveAll}
              disabled={savingAll}
              className='inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {savingAll ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
              {savingAll ? 'Guardando...' : 'Guardar tarjetas en edición'}
            </button>
          </div>
        </div>

        <div className='mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5'>
          <StatCard icon={Layers3} label='Ascensores' value={String(stats.total)} />
          <StatCard icon={Building2} label='Edificios' value={String(stats.buildings)} />
          <StatCard icon={ShieldCheck} label='Fichas completas' value={String(stats.completed)} />
          <StatCard icon={Settings2} label='Pendientes' value={String(stats.pending)} />
          <StatCard icon={Edit3} label='En edición' value={String(stats.editing)} />
        </div>
      </div>

      {error && (
        <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      {success && (
        <div className='rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700'>
          {success}
        </div>
      )}

      <div className='rounded-2xl border bg-white p-5 shadow-sm'>
        <div className='mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900'>
          <Filter className='h-5 w-5' />
          Filtros de trabajo
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-4'>
          <label className='block'>
            <span className='mb-1 block text-sm font-medium text-slate-700'>Buscar</span>
            <div className='relative'>
              <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Marca, modelo, serie, torre...'
                className='w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none ring-0 transition focus:border-blue-500'
              />
            </div>
          </label>

          <label className='block'>
            <span className='mb-1 block text-sm font-medium text-slate-700'>Edificio</span>
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500'
            >
              <option value='all'>Todos</option>
              {buildingOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className='block'>
            <span className='mb-1 block text-sm font-medium text-slate-700'>Estado</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500'
            >
              <option value='all'>Todos</option>
              <option value='active'>Activos</option>
              <option value='inactive'>Inactivos</option>
              <option value='stopped'>Detenidos</option>
            </select>
          </label>

          <label className='flex items-end gap-3 rounded-xl border border-slate-200 px-4 py-3'>
            <input
              type='checkbox'
              checked={onlyIncomplete}
              onChange={(e) => setOnlyIncomplete(e.target.checked)}
              className='h-4 w-4 rounded border-slate-300'
            />
            <div>
              <p className='text-sm font-medium text-slate-900'>Solo fichas incompletas</p>
              <p className='text-xs text-slate-500'>Útil para completar datos desde terreno</p>
            </div>
          </label>
        </div>
      </div>

      {groupedRows.length === 0 ? (
        <div className='rounded-2xl border bg-white p-10 text-center text-slate-500 shadow-sm'>
          No hay ascensores que coincidan con los filtros.
        </div>
      ) : (
        <div className='space-y-6'>
          {groupedRows.map(([building, buildingRows]) => (
            <section key={building} className='rounded-2xl border bg-white p-5 shadow-sm'>
              <div className='mb-4 flex items-center justify-between gap-4 border-b pb-4'>
                <div>
                  <h2 className='text-xl font-bold text-slate-900'>{building}</h2>
                  <p className='text-sm text-slate-500'>{buildingRows.length} ascensor(es)</p>
                </div>
              </div>

              <div className='space-y-4'>
                {buildingRows.map((row) => {
                  const dirty = isDirty(row);

                  return (
                    <article key={row.id} className='rounded-2xl border border-slate-200 bg-slate-50/60'>
                      <div className='flex flex-col gap-3 border-b bg-white px-5 py-4 lg:flex-row lg:items-start lg:justify-between'>
                        <button
                          type='button'
                          onClick={() => toggleExpanded(row.id)}
                          className='flex flex-1 items-center justify-between gap-4 text-left'
                        >
                          <div>
                            <h3 className='text-lg font-semibold text-slate-900'>{getElevatorLabel(row)}</h3>
                            <p className='mt-1 text-sm text-slate-600'>
                              {row.brand || 'SIN MARCA'} · {row.model || 'SIN MODELO'}
                              {row.serial_number ? ` · Serie ${row.serial_number}` : ''}
                            </p>
                          </div>
                          {row.expanded ? (
                            <ChevronUp className='h-5 w-5 text-slate-500' />
                          ) : (
                            <ChevronDown className='h-5 w-5 text-slate-500' />
                          )}
                        </button>

                        <div className='flex flex-wrap items-center gap-2'>
                          {!row.isEditing ? (
                            <button
                              type='button'
                              onClick={() => startEditing(row.id)}
                              className='inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100'
                            >
                              <Edit3 className='h-4 w-4' />
                              Editar
                            </button>
                          ) : (
                            <>
                              <button
                                type='button'
                                onClick={() => cancelEditing(row.id)}
                                className='inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
                              >
                                <XCircle className='h-4 w-4' />
                                Cancelar
                              </button>

                              <button
                                type='button'
                                onClick={() => void handleSaveOne(row)}
                                disabled={Boolean(row.saving) || !dirty}
                                className='inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
                              >
                                {row.saving ? (
                                  <Loader2 className='h-4 w-4 animate-spin' />
                                ) : (
                                  <Save className='h-4 w-4' />
                                )}
                                Guardar
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {row.expanded && (
                        <div className='bg-white px-5 py-5'>
                          <div className='mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
                            {row.isEditing
                              ? 'Modo edición activo. Puedes cambiar los campos y luego guardar.'
                              : 'Vista protegida. Presiona “Editar” para habilitar cambios.'}
                          </div>

                          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
                            <Field
                              label='Torre / identificador'
                              value={row.tower_name || ''}
                              onChange={(value) => updateRow(row.id, 'tower_name', value)}
                              placeholder='Ej: TORRE A'
                              disabled={!row.isEditing}
                            />

                            <Field
                              label='Marca'
                              value={row.brand || ''}
                              onChange={(value) => updateRow(row.id, 'brand', value)}
                              placeholder='Ej: KONE'
                              disabled={!row.isEditing}
                            />

                            <Field
                              label='Modelo'
                              value={row.model || ''}
                              onChange={(value) => updateRow(row.id, 'model', value)}
                              placeholder='Ej: MONOSPACE'
                              disabled={!row.isEditing}
                            />

                            <Field
                              label='Número de serie'
                              value={row.serial_number || ''}
                              onChange={(value) => updateRow(row.id, 'serial_number', value)}
                              placeholder='Ej: 12345ABC'
                              disabled={!row.isEditing || Boolean(row.serial_number_not_legible)}
                            />

                            <DateField
                              label='Fecha instalación'
                              value={toInputDate(row.installation_date)}
                              onChange={(value) => updateRow(row.id, 'installation_date', value)}
                              disabled={!row.isEditing}
                            />

                            <NumericField
                              label='N° de paradas'
                              value={row.floors}
                              onChange={(value) => updateRow(row.id, 'floors', value)}
                              disabled={!row.isEditing}
                            />

                            <NumericField
                              label='Capacidad KG'
                              value={row.capacity_kg}
                              onChange={(value) => updateRow(row.id, 'capacity_kg', value)}
                              disabled={!row.isEditing}
                            />

                            <NumericField
                              label='Capacidad personas'
                              value={row.capacity_persons}
                              onChange={(value) => updateRow(row.id, 'capacity_persons', value)}
                              disabled={!row.isEditing}
                            />

                            <SelectField
                              label='Tipo de accionamiento'
                              value={row.elevator_type || ''}
                              onChange={(value) => updateRow(row.id, 'elevator_type', value as ElevatorDriveType)}
                              options={DRIVE_OPTIONS.map((option) => ({
                                value: option,
                                label: option === '' ? 'Seleccionar' : option.toUpperCase(),
                              }))}
                              disabled={!row.isEditing}
                            />

                            <SelectField
                              label='Clasificación'
                              value={row.classification || ''}
                              onChange={(value) => updateRow(row.id, 'classification', value as ElevatorClassification)}
                              options={CLASSIFICATION_OPTIONS.map((option) => ({
                                value: option,
                                label: option === '' ? 'Seleccionar' : option.toUpperCase(),
                              }))}
                              disabled={!row.isEditing}
                            />

                            <SelectField
                              label='Sala de máquinas'
                              value={getMachineRoomValue(row)}
                              onChange={(value) => updateMachineRoom(row.id, value as 'yes' | 'no' | 'unknown')}
                              options={[
                                { value: 'unknown', label: 'Sin definir' },
                                { value: 'yes', label: 'Sí tiene' },
                                { value: 'no', label: 'No tiene' },
                              ]}
                              disabled={!row.isEditing}
                            />

                            <SelectField
                              label='Patrón de detención'
                              value={getStopPattern(row)}
                              onChange={(value) => updateStopPattern(row.id, value as StopPattern)}
                              options={[
                                { value: 'all', label: 'Todos los pisos' },
                                { value: 'odd', label: 'Pisos impares' },
                                { value: 'even', label: 'Pisos pares' },
                              ]}
                              disabled={!row.isEditing}
                            />
                          </div>

                          <div className='mt-5'>
                            <label className={`flex items-center gap-3 rounded-xl border px-4 py-4 ${row.isEditing ? 'border-slate-200' : 'border-slate-100 bg-slate-50'}`}>
                              <input
                                type='checkbox'
                                checked={Boolean(row.serial_number_not_legible)}
                                onChange={(e) => {
                                  updateRow(row.id, 'serial_number_not_legible', e.target.checked);
                                  if (e.target.checked) updateRow(row.id, 'serial_number', '');
                                }}
                                disabled={!row.isEditing}
                                className='h-4 w-4 rounded border-slate-300'
                              />
                              <div>
                                <p className='text-sm font-medium text-slate-900'>Serie no legible</p>
                                <p className='text-xs text-slate-500'>
                                  Desactiva la obligación de ingresar número de serie
                                </p>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className='rounded-2xl border border-slate-200 bg-slate-50 p-4'>
      <div className='mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm'>
        <Icon className='h-5 w-5' />
      </div>
      <p className='text-2xl font-bold text-slate-900'>{value}</p>
      <p className='text-sm text-slate-600'>{label}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className='block'>
      <span className='mb-1 block text-sm font-medium text-slate-700'>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={disabled}
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
          disabled
            ? 'border-slate-200 bg-slate-50 text-slate-700'
            : 'border-slate-300 focus:border-blue-500'
        }`}
      />
    </label>
  );
}

function NumericField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className='block'>
      <span className='mb-1 block text-sm font-medium text-slate-700'>{label}</span>
      <input
        type='number'
        value={value ?? ''}
        onChange={(e) => onChange(parseOptionalNumber(e.target.value))}
        disabled={disabled}
        readOnly={disabled}
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
          disabled
            ? 'border-slate-200 bg-slate-50 text-slate-700'
            : 'border-slate-300 focus:border-blue-500'
        }`}
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className='block'>
      <span className='mb-1 block text-sm font-medium text-slate-700'>{label}</span>
      <input
        type='date'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
          disabled
            ? 'border-slate-200 bg-slate-50 text-slate-700'
            : 'border-slate-300 focus:border-blue-500'
        }`}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className='block'>
      <span className='mb-1 block text-sm font-medium text-slate-700'>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
          disabled
            ? 'border-slate-200 bg-slate-50 text-slate-700'
            : 'border-slate-300 focus:border-blue-500'
        }`}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || 'empty'}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
