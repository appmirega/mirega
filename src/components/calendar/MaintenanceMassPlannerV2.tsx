import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Check, AlertCircle, UserPlus } from 'lucide-react';

interface Technician {
  id: string;
  full_name: string;
  is_on_leave?: boolean;
  is_external?: boolean;
}

interface Building {
  id: string;
  name: string;
}

interface AssignmentDraft {
  building: Building;
  internalTechnicians: Technician[];
  externalTechnicians: Technician[];
  externalNames: string[];
  day: string;
  duration: number;
  is_fixed: boolean;
  status: 'ok' | 'conflict' | 'blocked';
  conflictMsg?: string;
}

export function MaintenanceMassPlannerV2({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [externalTechnicians, setExternalTechnicians] = useState<Technician[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [externalNameInput, setExternalNameInput] = useState('');
  const [drafts, setDrafts] = useState<AssignmentDraft[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.from('clients').select('id, internal_alias').then(({ data }) => {
      setBuildings((data || [])
        .filter(e => e.internal_alias && e.internal_alias.trim() !== '')
        .map(e => ({
          id: e.id,
          name: e.internal_alias,
        })));
    });
    supabase.from('profiles').select('id, full_name').eq('role', 'technician').then(({ data }) => {
      setTechnicians((data || []).map(t => ({ id: t.id, full_name: t.full_name })));
    });
    const ext = localStorage.getItem('external_technicians');
    if (ext) setExternalTechnicians(JSON.parse(ext));
  }, []);

  // Genera días hábiles del mes
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

  // Inicializa drafts al seleccionar edificios
  useEffect(() => {
    if (selectedBuildings.length === 0) {
      setDrafts([]);
      return;
    }
    const days = getWeekdays();
    setDrafts(selectedBuildings.map(bid => {
      const building = buildings.find(b => b.id === bid)!;
      return {
        building,
        internalTechnicians: [],
        externalTechnicians: [],
        externalNames: [],
        day: days[0]?.date || '',
        duration: 1,
        is_fixed: false,
        status: 'ok',
      };
    }));
  }, [selectedBuildings, buildings, month, year]);

  // Handlers
  const handleInternalTechnicianChange = (buildingId: string, technicianIds: string[]) => {
    setDrafts(drafts => drafts.map(draft =>
      draft.building.id === buildingId
        ? { ...draft, internalTechnicians: technicians.filter(t => technicianIds.includes(t.id)) }
        : draft
    ));
  };
  const handleExternalTechnicianChange = (buildingId: string, technicianIds: string[]) => {
    setDrafts(drafts => drafts.map(draft =>
      draft.building.id === buildingId
        ? { ...draft, externalTechnicians: externalTechnicians.filter(t => technicianIds.includes(t.id)) }
        : draft
    ));
  };
  const handleExternalNamesChange = (buildingId: string, names: string[]) => {
    setDrafts(drafts => drafts.map(draft =>
      draft.building.id === buildingId
        ? { ...draft, externalNames: names }
        : draft
    ));
  };
  const handleDayChange = (buildingId: string, date: string) => {
    setDrafts(drafts => drafts.map(draft =>
      draft.building.id === buildingId
        ? { ...draft, day: date }
        : draft
    ));
  };
  const handleDurationChange = (buildingId: string, duration: number) => {
    setDrafts(drafts => drafts.map(draft =>
      draft.building.id === buildingId
        ? { ...draft, duration }
        : draft
    ));
  };
  const handleFixedChange = (buildingId: string, isFixed: boolean) => {
    setDrafts(drafts => drafts.map(draft =>
      draft.building.id === buildingId
        ? { ...draft, is_fixed: isFixed }
        : draft
    ));
  };
  const handleAddExternalTechnician = () => {
    const name = externalNameInput.trim();
    if (!name) return;
    if (externalTechnicians.some(t => t.full_name.toLowerCase() === name.toLowerCase())) {
      setExternalNameInput('');
      return;
    }
    const newTech = { id: Date.now().toString(), full_name: name, is_external: true };
    const updated = [...externalTechnicians, newTech];
    setExternalTechnicians(updated);
    localStorage.setItem('external_technicians', JSON.stringify(updated));
    setExternalNameInput('');
  };

  // Guardar asignaciones masivas
  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const toSave = drafts.filter(d => d.status === 'ok');
      if (toSave.length === 0) {
        setError('No hay asignaciones válidas para guardar.');
        setLoading(false);
        return;
      }
      const assignments = toSave.flatMap(draft => {
        const base = {
          building_id: draft.building.id,
          scheduled_date: draft.day,
          duration: draft.duration,
          is_fixed: draft.is_fixed,
          status: 'scheduled',
        };
        const internals = draft.internalTechnicians.map(t => ({ ...base, assigned_technician_id: t.id, is_external: false, external_personnel_name: null }));
        const externals = draft.externalTechnicians.map(t => ({ ...base, assigned_technician_id: t.id, is_external: true, external_personnel_name: t.full_name }));
        const manualExternals = draft.externalNames.filter(name => name.trim() !== '').map(name => ({ ...base, assigned_technician_id: null, is_external: true, external_personnel_name: name }));
        return [...internals, ...externals, ...manualExternals];
      });
      if (assignments.length === 0) {
        setError('No hay asignaciones para guardar. Selecciona al menos un técnico o nombre externo por edificio.');
        setLoading(false);
        return;
      }
      const { error: insertError } = await supabase.from('maintenance_assignments').insert(assignments);
      if (insertError) throw insertError;
      setSuccess('Asignaciones guardadas correctamente.');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Error al guardar asignaciones.');
    } finally {
      setLoading(false);
    }
  };

  // UI
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-6"><Calendar className="w-7 h-7" /> Planificación Masiva de Mantenimiento</h2>
      <div className="flex gap-6">
              {/* Columna izquierda: Edificios y técnico externo */}
              <div className="w-64 flex-shrink-0">
                <label className="block font-medium mb-1">Edificios</label>
                {buildings.length === 0 ? (
                  <div className="text-red-600 bg-red-50 border border-red-200 rounded p-2 mt-2">No hay edificios disponibles en la base de datos.</div>
                ) : (
                  <div className="border rounded px-2 py-2 bg-white" style={{maxHeight: 220, overflowY: 'auto'}}>
                    {buildings.map(b => (
                      <label key={b.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={selectedBuildings.includes(b.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedBuildings([...selectedBuildings, b.id]);
                            } else {
                              setSelectedBuildings(selectedBuildings.filter(id => id !== b.id));
                            }
                          }}
                        />
                        <span className="font-semibold">{b.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="mt-6">
                  <label className="block font-medium mb-1">Técnico externo (nuevo)</label>
                  <div className="flex gap-2">
                    <input type="text" value={externalNameInput} onChange={e => setExternalNameInput(e.target.value)} className="border rounded px-2 py-1 flex-1" placeholder="Nombre técnico externo" />
                    <button type="button" onClick={handleAddExternalTechnician} className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-1"><UserPlus className="w-4 h-4" /> Agregar</button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Técnicos externos agregados estarán disponibles en la tabla.</div>
                </div>
              </div>
              {/* Columna derecha: Tabla editable y controles */}
              <div className="flex-1 min-w-0">
                <div className="flex gap-4 mb-4">
                  <div>
                    <label className="block font-medium mb-1">Año</label>
                    <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded px-2 py-1 w-24" />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Mes</label>
                    <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded px-2 py-1 w-32">
                      {Array.from({length: 12}).map((_, i) => <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('es-CL', { month: 'long' })}</option>)}
                    </select>
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
                                {technicians.length === 0 ? <option disabled>No hay técnicos internos</option> : technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
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
                              <select value={draft.day} onChange={e => handleDayChange(draft.building.id, e.target.value)} className="border rounded px-2 py-2 text-base">
                                {getWeekdays().length === 0 ? <option disabled>No hay días hábiles</option> : getWeekdays().map(d => <option key={d.date} value={d.date}>{d.label}</option>)}
                              </select>
                            </td>
                            <td className="border px-4 py-2">
                              <select value={draft.duration} onChange={e => handleDurationChange(draft.building.id, Number(e.target.value))} className="border rounded px-2 py-2 text-base">
                                <option value={0.5}>Medio día</option>
                                <option value={1}>Día completo</option>
                                <option value={2}>2 días</option>
                                <option value={3}>3 días</option>
                                <option value={5}>5 días</option>
                              </select>
                            </td>
                            <td className="border px-4 py-2 text-center">
                              <input type="checkbox" checked={!!draft.is_fixed} onChange={e => handleFixedChange(draft.building.id, e.target.checked)} className="w-6 h-6" />
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
                <div className="flex justify-end gap-4 mt-8">
                  <button type="button" onClick={onClose} className="px-6 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50">Cancelar</button>
                  <button type="button" onClick={handleSave} className="px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700">Guardar Asignaciones</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
                {error && <div className="bg-red-100 text-red-700 rounded p-2 flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
                {success && <div className="bg-green-100 text-green-700 rounded p-2 flex items-center gap-2 mb-2"><Check className="w-4 h-4" /> {success}</div>}
