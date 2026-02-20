import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Building, Check, AlertCircle, UserPlus } from 'lucide-react';

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
  days: { date: string; duration: number; is_fixed?: boolean }[]; // duration: número de días (0.5, 1, 2, 3...)
  status: 'ok' | 'conflict' | 'blocked';
  conflictMsg?: string;
}

export function MaintenanceMassPlanner({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
      // Handler para técnicos internos
      const handleInternalTechnicianChange = (buildingId: string, technicianIds: string[]) => {
        setDrafts(drafts => drafts.map(draft =>
          draft.building.id === buildingId
            ? { ...draft, internalTechnicians: technicians.filter(t => technicianIds.includes(t.id)) }
            : draft
        ));
      };

      // Handler para técnicos externos
      const handleExternalTechnicianChange = (buildingId: string, technicianIds: string[]) => {
        setDrafts(drafts => drafts.map(draft =>
          draft.building.id === buildingId
            ? { ...draft, externalTechnicians: externalTechnicians.filter(t => technicianIds.includes(t.id)) }
            : draft
        ));
      };

      // Handler para nombres externos manuales
      const handleExternalNamesChange = (buildingId: string, names: string[]) => {
        setDrafts(drafts => drafts.map(draft =>
          draft.building.id === buildingId
            ? { ...draft, externalNames: names }
            : draft
        ));
      };

      // Handler para cambio de día
      const handleDayChange = (buildingId: string, date: string) => {
        setDrafts(drafts => drafts.map(draft =>
          draft.building.id === buildingId
            ? { ...draft, days: [{ ...draft.days[0], date }] }
            : draft
        ));
      };

      // Handler para cambio de duración
      const handleDurationChange = (buildingId: string, duration: number) => {
        setDrafts(drafts => drafts.map(draft =>
          draft.building.id === buildingId
            ? { ...draft, days: [{ ...draft.days[0], duration }] }
            : draft
        ));
      };

      // Handler para cambio de inamovible
      const handleFixedChange = (buildingId: string, isFixed: boolean) => {
        setDrafts(drafts => drafts.map(draft =>
          draft.building.id === buildingId
            ? { ...draft, days: [{ ...draft.days[0], is_fixed: isFixed }] }
            : draft
        ));
      };

      // Handler para agregar técnico externo
      const handleAddExternalTechnician = () => {
        const name = externalNameInput.trim();
        if (!name) return;
        // Evitar duplicados
        if (externalTechnicians.some(t => t.full_name.toLowerCase() === name.toLowerCase())) {
          setExternalNameInput("");
          return;
        }
        const newTech = { id: Date.now().toString(), full_name: name, is_external: true };
        const updated = [...externalTechnicians, newTech];
        setExternalTechnicians(updated);
        localStorage.setItem('external_technicians', JSON.stringify(updated));
        setExternalNameInput("");
      };
    // Guardar asignaciones masivas
    const handleSave = async () => {
      setError("");
      setSuccess("");
      setLoading(true);
      try {
        // Filtrar solo los drafts válidos para guardar
        const toSave = drafts.filter(d => d.status === "ok");
        if (toSave.length === 0) {
          setError("No hay asignaciones válidas para guardar.");
          setLoading(false);
          return;
        }

        // Construir payloads para cada draft
        const assignments = toSave.flatMap(draft => {
          const day = draft.days[0];
          const base = {
            building_id: draft.building.id,
            scheduled_date: day.date,
            duration: day.duration,
            is_fixed: !!day.is_fixed,
            status: "scheduled",
          };
          // Asignaciones para técnicos internos
          const internals = draft.internalTechnicians.map(t => ({
            ...base,
            assigned_technician_id: t.id,
            is_external: false,
            external_personnel_name: null,
          }));
          // Asignaciones para técnicos externos (de la lista)
          const externals = draft.externalTechnicians.map(t => ({
            ...base,
            assigned_technician_id: t.id,
            is_external: true,
            external_personnel_name: t.full_name,
          }));
          // Asignaciones para nombres externos manuales
          const manualExternals = draft.externalNames
            .filter(name => name.trim() !== "")
            .map(name => ({
              ...base,
              assigned_technician_id: null,
              is_external: true,
              external_personnel_name: name,
            }));
          return [...internals, ...externals, ...manualExternals];
        });

        if (assignments.length === 0) {
          setError("No hay asignaciones para guardar. Selecciona al menos un técnico o nombre externo por edificio.");
          setLoading(false);
          return;
        }

        // Guardar en Supabase
        const { error: insertError } = await supabase
          .from("maintenance_assignments")
          .insert(assignments);
        if (insertError) throw insertError;

        setSuccess("Asignaciones guardadas correctamente.");
        if (onSuccess) onSuccess();
        setTimeout(() => {
          setSuccess("");
          onClose();
        }, 1200);
      } catch (err: any) {
        setError(err.message || "Error al guardar asignaciones.");
      } finally {
        setLoading(false);
      }
    };
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  // const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]); // No se usa
  const [externalNameInput, setExternalNameInput] = useState('');
  const [externalTechnicians, setExternalTechnicians] = useState<Technician[]>([]);
  const [drafts, setDrafts] = useState<AssignmentDraft[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Consulta edificios igual que modal de nuevo evento
    supabase.from('clients').select('id, company_name, address').then(({ data }) => {
      setBuildings((data || []).map(e => ({
        id: e.id,
        name: e.company_name,
        address: e.address
      })));
      // No seleccionar automáticamente si hay más de un edificio
    });
    // Consulta técnicos igual que modal de nuevo evento (sin campos extra ni filtros innecesarios)
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'technician')
      .then(({ data }) => {
        setTechnicians((data || []).map(t => ({
          id: t.id,
          full_name: t.full_name
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
    // Mantener drafts previos si existen, para no perder selección al cambiar edificios
    setDrafts(prevDrafts => {
      return selectedBuildings.map(bid => {
        const building = buildings.find(b => b.id === bid)!;
        // Buscar draft previo
        const prev = prevDrafts.find(d => d.building.id === bid);
        return prev ? {
          ...prev,
          building,
          days: prev.days.length > 0 ? prev.days : [{ date: days[0]?.date || '', duration: 1, is_fixed: false }],
        } : {
          building,
          internalTechnicians: [],
          externalTechnicians: [],
          externalNames: [],
          days: [{ date: days[0]?.date || '', duration: 1, is_fixed: false }],
          status: 'ok',
        };
      });
    });
  }, [selectedBuildings, buildings, month, year]);

  // Validación de conflictos (edificio ya asignado, técnico en vacaciones, etc)
  const validateDrafts = async () => {
    setLoading(true);
    // Calcular último día del mes correctamente
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthStr = String(month + 1).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${lastDay}`;
    const newDrafts: AssignmentDraft[] = await Promise.all(drafts.map(async draft => {
      // 1. Verificar si el edificio ya tiene asignación ese mes
      const { data: existing, error } = await supabase
        .from('maintenance_assignments')
        .select('id, scheduled_date, assigned_technician_id')
        .eq('building_id', draft.building.id)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);
      if (error) return { ...draft, status: 'conflict', conflictMsg: 'Error al consultar asignaciones previas.' };
      if (existing && existing.length > 0) {
        return { ...draft, status: 'blocked', conflictMsg: 'Ya existe mantenimiento asignado este mes.' };
      }
      // 2. Verificar técnicos en vacaciones/permiso (solo internos)
      const techsOnLeave = draft.internalTechnicians.filter((t) => t.is_on_leave);
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
  }, [drafts]);

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
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
                    <select value={draft.days[0].duration} onChange={e => handleDurationChange(draft.building.id, Number(e.target.value))} className="border rounded px-2 py-2 text-base">
                      <option value={0.5}>Medio día</option>
                      <option value={1}>Día completo</option>
                      <option value={2}>2 días</option>
                      <option value={3}>3 días</option>
                      <option value={5}>5 días</option>
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
