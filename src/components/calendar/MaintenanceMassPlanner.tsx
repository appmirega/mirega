import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Building, User, Users, Check, AlertCircle, UserPlus } from 'lucide-react';

interface Technician {
  id: string;
  full_name: string;
  is_on_leave?: boolean;
  is_external?: boolean;
}

interface Building {
  id: string;
  name: string;
  address: string;
}

interface AssignmentDraft {
  building: Building;
  internalTechnicians: Technician[];
  externalTechnicians: Technician[];
  externalNames: string[];
  days: { date: string; duration: 0.5 | 1; is_fixed?: boolean }[];
  status: 'ok' | 'conflict' | 'blocked';
  conflictMsg?: string;
}

export function MaintenanceMassPlanner({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [externalNameInput, setExternalNameInput] = useState('');
  const [externalTechnicians, setExternalTechnicians] = useState<Technician[]>([]);
  const [drafts, setDrafts] = useState<AssignmentDraft[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.from('buildings').select('id, name, address').then(({ data }) => {
      setBuildings(data || []);
      // Si solo hay un edificio, seleccionarlo automáticamente
      if (data && data.length === 1) setSelectedBuildings([data[0].id]);
    });
    supabase
      .from('profiles')
      .select('id, full_name, is_on_leave, is_active')
      .eq('role', 'technician')
      .eq('is_active', true)
      .then(({ data }) => {
        // Mapear igual que MaintenanceAssignmentModal
        setTechnicians((data || []).map(t => ({
          id: t.id,
          full_name: t.full_name,
          is_on_leave: !!t.is_on_leave,
          is_active: !!t.is_active
        })));
      });
    // Cargar técnicos externos guardados en localStorage
    const ext = localStorage.getItem('external_technicians');
    if (ext) setExternalTechnicians(JSON.parse(ext));
  }, []);

  // Genera los días hábiles del mes
  const getWeekdays = () => {
    const days: { date: string, label: string }[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        const label = d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' });
        days.push({ date: d.toISOString().slice(0, 10), label });
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  // Crea borradores de asignación para cada edificio seleccionado
  useEffect(() => {
    if (selectedBuildings.length === 0) {
      setDrafts([]);
      return;
    }
    const days = getWeekdays();
    const drafts: AssignmentDraft[] = selectedBuildings.map(bid => {
      const building = buildings.find(b => b.id === bid)!;
      return {
        building,
        internalTechnicians: [],
        externalTechnicians: [],
        externalNames: [],
        days: [{ date: days[0]?.date || '', duration: 1, is_fixed: false }],
        status: 'ok',
      };
    });
    setDrafts(drafts);
  }, [selectedBuildings, buildings, month, year]);

  // Validación de conflictos (edificio ya asignado, técnico en vacaciones, etc)
  const validateDrafts = async () => {
    setLoading(true);
    const newDrafts = await Promise.all(drafts.map(async draft => {
      // 1. Verificar si el edificio ya tiene asignación ese mes
      const { data: existing, error } = await supabase
        .from('maintenance_assignments')
        .select('id, scheduled_date, assigned_technician_id')
        .eq('building_id', draft.building.id)
        .gte('scheduled_date', `${year}-${String(month+1).padStart(2,'0')}-01`)
        .lte('scheduled_date', `${year}-${String(month+1).padStart(2,'0')}-31`);
      if (error) return { ...draft, status: 'conflict', conflictMsg: 'Error al consultar asignaciones previas.' };
      if (existing && existing.length > 0) {
        return { ...draft, status: 'blocked', conflictMsg: 'Ya existe mantenimiento asignado este mes.' };
      }
      // 2. Verificar técnicos en vacaciones/permiso
      const techsOnLeave = draft.technicians.filter(t => t.is_on_leave);
      if (techsOnLeave.length > 0) {
        return { ...draft, status: 'blocked', conflictMsg: 'Técnico(s) en vacaciones o permiso.' };
      }
      // 3. OK
      return { ...draft, status: 'ok', conflictMsg: undefined };
    }));
    setDrafts(newDrafts);
    setLoading(false);
  };

  // Llama a validateDrafts cada vez que drafts cambian
  useEffect(() => {
    if (drafts.length > 0) validateDrafts();
    // eslint-disable-next-line
  }, [drafts.length]);

  // Maneja la edición de día, duración, técnicos y bloqueo por edificio
  const handleDayChange = (bid: string, newDate: string) => {
    setDrafts(ds => ds.map(d => d.building.id === bid ? {
      ...d,
      days: [{ ...d.days[0], date: newDate }]
    } : d));
  };
  const handleDurationChange = (bid: string, duration: 0.5 | 1) => {
    setDrafts(ds => ds.map(d => d.building.id === bid ? {
      ...d,
      days: [{ ...d.days[0], duration }]
    } : d));
  };
  const handleFixedChange = (bid: string, is_fixed: boolean) => {
    setDrafts(ds => ds.map(d => d.building.id === bid ? {
      ...d,
      days: [{ ...d.days[0], is_fixed }]
    } : d));
  };
  // Técnicos internos
  const handleInternalTechnicianChange = (bid: string, tids: string[]) => {
    setDrafts(ds => ds.map(d => d.building.id === bid ? {
      ...d,
      internalTechnicians: tids.map(tid => technicians.find(t => t.id === tid)!).filter(Boolean)
    } : d));
  };
  // Técnicos externos (de la lista)
  const handleExternalTechnicianChange = (bid: string, tids: string[]) => {
    setDrafts(ds => ds.map(d => d.building.id === bid ? {
      ...d,
      externalTechnicians: tids.map(tid => externalTechnicians.find(t => t.id === tid)!).filter(Boolean)
    } : d));
  };
  // Nombres externos manuales
  const handleExternalNamesChange = (bid: string, names: string[]) => {
    setDrafts(ds => ds.map(d => d.building.id === bid ? {
      ...d,
      externalNames: names
    } : d));
  };
  // Agregar técnico externo global
  const handleAddExternalTechnician = () => {
    if (!externalNameInput.trim()) return;
    const newTech: Technician = {
      id: 'ext-' + Date.now(),
      full_name: externalNameInput.trim(),
      is_external: true
    };
    const updated = [...externalTechnicians, newTech];
    setExternalTechnicians(updated);
    localStorage.setItem('external_technicians', JSON.stringify(updated));
    setExternalNameInput('');
  };

  // Guardar todas las asignaciones válidas
  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    const toSave = drafts.filter(d => d.status === 'ok');
    if (toSave.length === 0) {
      setError('No hay asignaciones válidas para guardar.');
      setLoading(false);
      return;
    }
    // Crea asignaciones para cada edificio, día y técnico (interno y externo)
    const assignments = toSave.flatMap(draft => [
      ...draft.internalTechnicians.map(tech => ({
        building_id: draft.building.id,
        assigned_technician_id: tech.id,
        scheduled_date: draft.days[0].date,
        duration: draft.days[0].duration,
        assignment_type: 'mantenimiento',
        is_external: false,
        status: 'scheduled',
        is_fixed: draft.days[0].is_fixed || false,
      })),
      ...draft.externalTechnicians.map(tech => ({
        building_id: draft.building.id,
        assigned_technician_id: null,
        scheduled_date: draft.days[0].date,
        duration: draft.days[0].duration,
        assignment_type: 'mantenimiento',
        is_external: true,
        external_personnel_name: tech.full_name,
        status: 'scheduled',
        is_fixed: draft.days[0].is_fixed || false,
      })),
      ...draft.externalNames.filter(n => n.trim()).map(name => ({
        building_id: draft.building.id,
        assigned_technician_id: null,
        scheduled_date: draft.days[0].date,
        duration: draft.days[0].duration,
        assignment_type: 'mantenimiento',
        is_external: true,
        external_personnel_name: name.trim(),
        status: 'scheduled',
        is_fixed: draft.days[0].is_fixed || false,
      })),
    ]);
    const { error: insertError } = await supabase.from('maintenance_assignments').insert(assignments);
    setLoading(false);
    if (insertError) {
      setError('Error al guardar asignaciones: ' + insertError.message);
    } else {
      setSuccess('Asignaciones guardadas correctamente.');
      onSuccess();
      onClose();
    }
  };

  // UI
  return (
    <div className="w-full h-full bg-white rounded-2xl shadow-xl p-8 flex flex-col overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Calendar className="w-6 h-6" /> Planificación Masiva de Mantenimiento</h2>
      <div className="flex gap-10 mb-8 flex-wrap items-end">
        <div>
          <label className="block font-medium mb-1">Año</label>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded px-2 py-1 w-28" />
        </div>
        <div>
          <label className="block font-medium mb-1">Mes</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded px-2 py-1 w-44">
            {[...Array(12)].map((_, i) => <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('es-CL', { month: 'long' })}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[350px]">
          <label className="block font-medium mb-1">Edificios</label>
          {buildings.length === 0 ? (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded p-2 mt-2">No hay edificios disponibles en la base de datos.</div>
          ) : (
            <select multiple value={selectedBuildings} onChange={e => setSelectedBuildings(Array.from(e.target.selectedOptions, o => o.value))} className="border rounded px-2 py-2 w-full min-h-[320px] text-lg">
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name} - {b.address}</option>)}
            </select>
          )}
        </div>
        <div className="min-w-[320px]">
          <label className="block font-medium mb-1">Técnico externo (nuevo)</label>
          <div className="flex gap-2">
            <input type="text" value={externalNameInput} onChange={e => setExternalNameInput(e.target.value)} className="border rounded px-2 py-1 flex-1" placeholder="Nombre técnico externo" />
            <button type="button" onClick={handleAddExternalTechnician} className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-1"><UserPlus className="w-4 h-4" /> Agregar</button>
          </div>
          <div className="text-xs text-gray-500 mt-1">Técnicos externos agregados estarán disponibles en la tabla.</div>
        </div>
      </div>
      {technicians.length === 0 && (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-4">No hay técnicos internos disponibles en la base de datos.</div>
      )}
      {selectedBuildings.length === 0 ? (
        <div className="text-center text-gray-500 text-lg my-10">Selecciona uno o más edificios para planificar mantenimientos.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-base mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2">Edificio</th>
                <th className="border px-4 py-2">Técnicos internos</th>
                <th className="border px-4 py-2">Técnicos externos</th>
                <th className="border px-4 py-2">Nombres externos manuales</th>
                <th className="border px-4 py-2">Día</th>
                <th className="border px-4 py-2">Duración</th>
                <th className="border px-4 py-2">Inamovible</th>
                <th className="border px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {drafts.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8">No hay datos para mostrar.</td></tr>
              ) : drafts.map(draft => (
                <tr key={draft.building.id} className={draft.status !== 'ok' ? 'bg-red-50' : ''}>
                  <td className="border px-4 py-2 font-semibold text-lg">{draft.building.name}</td>
                  <td className="border px-4 py-2">
                    <select multiple value={draft.internalTechnicians.map(t => t.id)} onChange={e => handleInternalTechnicianChange(draft.building.id, Array.from(e.target.selectedOptions, o => o.value))} className="border rounded px-2 py-2 min-w-[180px] min-h-[90px] text-base">
                      {technicians.length === 0 ? <option disabled>No hay técnicos internos</option> : technicians.map(t => <option key={t.id} value={t.id} disabled={t.is_on_leave}>{t.full_name}{t.is_on_leave ? ' (ausente)' : ''}</option>)}
                    </select>
                  </td>
                  <td className="border px-4 py-2">
                    <select multiple value={draft.externalTechnicians.map(t => t.id)} onChange={e => handleExternalTechnicianChange(draft.building.id, Array.from(e.target.selectedOptions, o => o.value))} className="border rounded px-2 py-2 min-w-[180px] min-h-[60px] text-base">
                      {externalTechnicians.length === 0 ? <option disabled>No hay técnicos externos</option> : externalTechnicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  </td>
                  <td className="border px-4 py-2">
                    <input type="text" value={draft.externalNames.join(', ')} onChange={e => handleExternalNamesChange(draft.building.id, e.target.value.split(',').map(s => s.trim()))} className="border rounded px-2 py-2 w-full text-base" placeholder="Nombres separados por coma" />
                  </td>
                  <td className="border px-4 py-2">
                    <select value={draft.days[0].date} onChange={e => handleDayChange(draft.building.id, e.target.value)} className="border rounded px-2 py-2 text-base">
                      {getWeekdays().length === 0 ? <option disabled>No hay días hábiles</option> : getWeekdays().map(d => <option key={d.date} value={d.date}>{d.label}</option>)}
                    </select>
                  </td>
                  <td className="border px-4 py-2">
                    <select value={draft.days[0].duration} onChange={e => handleDurationChange(draft.building.id, Number(e.target.value) as 0.5 | 1)} className="border rounded px-2 py-2 text-base">
                      <option value={1}>Día completo</option>
                      <option value={0.5}>Medio día</option>
                    </select>
                  </td>
                  <td className="border px-4 py-2 text-center">
                    <input type="checkbox" checked={!!draft.days[0].is_fixed} onChange={e => handleFixedChange(draft.building.id, e.target.checked)} className="w-6 h-6" />
                  </td>
                  <td className="border px-4 py-2">
                    {draft.status === 'ok' ? <span className="text-green-700 font-semibold">OK</span> : <span className="text-red-700 font-semibold">{draft.conflictMsg}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <div className="bg-red-100 text-red-700 rounded p-2 flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
      {success && <div className="bg-green-100 text-green-700 rounded p-2 flex items-center gap-2 mb-2"><Check className="w-4 h-4" /> {success}</div>}
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onClose} className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition">Cancelar</button>
        <button type="button" onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50" disabled={loading || drafts.length === 0}>Guardar Asignaciones</button>
      </div>
    </div>
  );
}
