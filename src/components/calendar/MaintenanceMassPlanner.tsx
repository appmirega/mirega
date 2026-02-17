import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Building, User, Users, Check, AlertCircle } from 'lucide-react';

interface Technician {
  id: string;
  full_name: string;
  is_on_leave?: boolean;
}

interface Building {
  id: string;
  name: string;
  address: string;
}

interface AssignmentDraft {
  building: Building;
  technicians: Technician[];
  days: { date: string; duration: 0.5 | 1 }[];
  status: 'ok' | 'conflict' | 'blocked';
  conflictMsg?: string;
}

export function MaintenanceMassPlanner({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<AssignmentDraft[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.from('buildings').select('id, name, address').then(({ data }) => setBuildings(data || []));
    supabase.from('profiles').select('id, full_name, is_on_leave').eq('role', 'technician').then(({ data }) => setTechnicians(data || []));
  }, []);

  // Genera los días hábiles del mes
  const getWeekdays = () => {
    const days: string[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        days.push(d.toISOString().slice(0, 10));
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  // Crea borradores de asignación para cada edificio seleccionado
  useEffect(() => {
    if (selectedBuildings.length === 0 || selectedTechnicians.length === 0) {
      setDrafts([]);
      return;
    }
    const days = getWeekdays();
    const drafts: AssignmentDraft[] = selectedBuildings.map(bid => {
      const building = buildings.find(b => b.id === bid)!;
      // Por defecto, todos los días hábiles, duración 1 día, ambos técnicos si hay dos
      return {
        building,
        technicians: selectedTechnicians.map(tid => technicians.find(t => t.id === tid)!).filter(Boolean),
        days: days.map(date => ({ date, duration: 1 })),
        status: 'ok',
      };
    });
    setDrafts(drafts);
  }, [selectedBuildings, selectedTechnicians, buildings, technicians, month, year]);

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

  // Maneja la edición de días/duración por edificio
  const handleDayChange = (bid: string, date: string, duration: 0.5 | 1) => {
    setDrafts(ds => ds.map(d => d.building.id === bid ? {
      ...d,
      days: d.days.map(day => day.date === date ? { ...day, duration } : day)
    } : d));
  };

  // Maneja la asignación de técnicos (uno o dos)
  const handleTechnicianChange = (bid: string, tids: string[]) => {
    setDrafts(ds => ds.map(d => d.building.id === bid ? {
      ...d,
      technicians: tids.map(tid => technicians.find(t => t.id === tid)!).filter(Boolean)
    } : d));
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
    // Crea asignaciones para cada día y técnico
    const assignments = toSave.flatMap(draft =>
      draft.days.map(day =>
        draft.technicians.map(tech => ({
          building_id: draft.building.id,
          assigned_technician_id: tech.id,
          scheduled_date: day.date,
          duration: day.duration,
          assignment_type: 'mantenimiento',
          is_external: false,
          status: 'scheduled',
        }))
      ).flat()
    );
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
    <div className="max-w-4xl mx-auto bg-white rounded shadow p-6 mt-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Calendar className="w-6 h-6" /> Planificación Masiva de Mantenimiento</h2>
      <div className="flex gap-4 mb-4">
        <div>
          <label className="block font-medium mb-1">Mes</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded px-2 py-1">
            {[...Array(12)].map((_, i) => <option key={i} value={i}>{i+1}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Año</label>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded px-2 py-1 w-24" />
        </div>
        <div>
          <label className="block font-medium mb-1">Edificios</label>
          <select multiple value={selectedBuildings} onChange={e => setSelectedBuildings(Array.from(e.target.selectedOptions, o => o.value))} className="border rounded px-2 py-1 min-w-[200px] h-24">
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name} - {b.address}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Técnicos (máx 2)</label>
          <select multiple value={selectedTechnicians} onChange={e => setSelectedTechnicians(Array.from(e.target.selectedOptions, o => o.value).slice(0,2))} className="border rounded px-2 py-1 min-w-[180px] h-24">
            {technicians.map(t => <option key={t.id} value={t.id} disabled={t.is_on_leave}>{t.full_name}{t.is_on_leave ? ' (ausente)' : ''}</option>)}
          </select>
        </div>
      </div>
      {drafts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Edificio</th>
                <th className="border px-2 py-1">Técnicos</th>
                <th className="border px-2 py-1">Día</th>
                <th className="border px-2 py-1">Duración</th>
                <th className="border px-2 py-1">Estado</th>
              </tr>
            </thead>
            <tbody>
              {drafts.flatMap(draft =>
                draft.days.map(day =>
                  draft.technicians.map(tech => (
                    <tr key={draft.building.id + '-' + tech.id + '-' + day.date} className={draft.status !== 'ok' ? 'bg-red-50' : ''}>
                      <td className="border px-2 py-1">{draft.building.name}</td>
                      <td className="border px-2 py-1">{tech.full_name}</td>
                      <td className="border px-2 py-1">{day.date}</td>
                      <td className="border px-2 py-1">
                        <select value={day.duration} onChange={e => handleDayChange(draft.building.id, day.date, Number(e.target.value) as 0.5 | 1)} className="border rounded px-1 py-0.5">
                          <option value={1}>Día completo</option>
                          <option value={0.5}>Medio día</option>
                        </select>
                      </td>
                      <td className="border px-2 py-1">
                        {draft.status === 'ok' ? <span className="text-green-700">OK</span> : <span className="text-red-700">{draft.conflictMsg}</span>}
                      </td>
                    </tr>
                  ))
                )
              )}
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
