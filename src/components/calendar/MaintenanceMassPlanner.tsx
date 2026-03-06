import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Check, AlertCircle } from 'lucide-react';

interface Technician {
  id: string;
  full_name: string;
  is_on_leave?: boolean;
  person_type: 'internal' | 'external';
  company_name?: string | null;
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
  days: { date: string; duration: number; is_fixed?: boolean }[]; // duration: 0.5, 1, 2, 3...
  status: 'ok' | 'conflict' | 'blocked';
  conflictMsg?: string;
}

export function MaintenanceMassPlanner({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<AssignmentDraft[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handlers
  const handleInternalTechnicianChange = (buildingId: string, technicianIds: string[]) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.building.id === buildingId
          ? { ...draft, internalTechnicians: technicians.filter((t) => t.person_type === 'internal' && technicianIds.includes(t.id)) }
          : draft
      )
    );
  };

  const handleExternalTechnicianChange = (buildingId: string, technicianIds: string[]) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.building.id === buildingId
          ? { ...draft, externalTechnicians: technicians.filter((t) => t.person_type === 'external' && technicianIds.includes(t.id)) }
          : draft
      )
    );
  };

  const handleDayChange = (buildingId: string, date: string) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.building.id === buildingId ? { ...draft, days: [{ ...draft.days[0], date }] } : draft
      )
    );
  };

  const handleDurationChange = (buildingId: string, duration: number) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.building.id === buildingId ? { ...draft, days: [{ ...draft.days[0], duration }] } : draft
      )
    );
  };

  const handleFixedChange = (buildingId: string, isFixed: boolean) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.building.id === buildingId ? { ...draft, days: [{ ...draft.days[0], is_fixed: isFixed }] } : draft
      )
    );
  };

  // Guardar asignaciones masivas
  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const toSave = drafts.filter((d) => d.status === 'ok');
      if (toSave.length === 0) {
        setError('No hay asignaciones válidas para guardar.');
        setLoading(false);
        return;
      }

      const assignments = toSave.flatMap((draft) => {
        const day = draft.days[0];
        const base = {
          building_id: draft.building.id,
          scheduled_date: day.date,
          duration: day.duration,
          is_fixed: !!day.is_fixed,
          status: 'scheduled',
        };

        const internals = draft.internalTechnicians.map((t) => ({
          ...base,
          assigned_technician_id: t.id,
          is_external: false,
          external_personnel_name: null,
        }));

        const externals = draft.externalTechnicians.map((t) => ({
          ...base,
          assigned_technician_id: t.id,
          is_external: true,
          external_personnel_name: t.full_name,
        }));

        return [...internals, ...externals];
      });

      if (assignments.length === 0) {
        setError('No hay asignaciones para guardar. Selecciona al menos un técnico por edificio.');
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

  useEffect(() => {
    // Edificios
    supabase.from('clients').select('id, company_name, address').then(({ data }) => {
      setBuildings(
        (data || []).map((e: any) => ({
          id: e.id,
          name: e.company_name,
          address: e.address,
        }))
      );
    });

    // Técnicos (internos + externos) desde profiles
    supabase
      .from('profiles')
      .select('id, full_name, person_type, company_name')
      .eq('role', 'technician')
      .order('full_name')
      .then(({ data }) => {
        setTechnicians(
          (data || []).map((t: any) => ({
            id: t.id,
            full_name: t.full_name,
            person_type: (t.person_type || 'internal') as 'internal' | 'external',
            company_name: t.company_name ?? null,
          }))
        );
      });
  }, []);

  // Días hábiles del mes
  const getWeekdays = () => {
    const days: { date: string; label: string }[] = [];
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

  // Crear drafts por edificio seleccionado
  useEffect(() => {
    if (selectedBuildings.length === 0) {
      setDrafts([]);
      return;
    }

    const weekdays = getWeekdays();

    setDrafts((prevDrafts) => {
      return selectedBuildings
        .map((bid) => {
          const building = buildings.find((b) => b.id === bid);
          if (!building) return null;

          const prev = prevDrafts.find((d) => d.building.id === bid);

          if (prev) {
            const updatedInternals = prev.internalTechnicians.filter((t) => technicians.some((tech) => tech.id === t.id && tech.person_type === 'internal'));
            const updatedExternals = prev.externalTechnicians.filter((t) => technicians.some((tech) => tech.id === t.id && tech.person_type === 'external'));

            return {
              ...prev,
              building,
              internalTechnicians: updatedInternals,
              externalTechnicians: updatedExternals,
              days: prev.days.length > 0 ? prev.days : [{ date: weekdays[0]?.date || '', duration: 1, is_fixed: false }],
            } as AssignmentDraft;
          }

          return {
            building,
            internalTechnicians: [],
            externalTechnicians: [],
            days: [{ date: weekdays[0]?.date || '', duration: 1, is_fixed: false }],
            status: 'ok',
          } as AssignmentDraft;
        })
        .filter(Boolean) as AssignmentDraft[];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildings, buildings, technicians, month, year]);

  // Validación conflictos (edificio ya asignado en el mes)
  const validateDrafts = async () => {
    setLoading(true);

    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthStr = String(month + 1).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${lastDay}`;

    const newDrafts: AssignmentDraft[] = await Promise.all(
      drafts.map(async (draft) => {
        const { data: existing, error: qErr } = await supabase
          .from('maintenance_assignments')
          .select('id, scheduled_date, assigned_technician_id')
          .eq('building_id', draft.building.id)
          .gte('scheduled_date', startDate)
          .lte('scheduled_date', endDate);

        if (qErr) return { ...draft, status: 'conflict', conflictMsg: 'Error al consultar asignaciones previas.' };

        if (existing && existing.length > 0) {
          return { ...draft, status: 'blocked', conflictMsg: 'Ya existe mantenimiento asignado este mes.' };
        }

        const techsOnLeave = draft.internalTechnicians.filter((t) => t.is_on_leave);
        if (techsOnLeave.length > 0) {
          return { ...draft, status: 'blocked', conflictMsg: 'Técnico(s) en vacaciones o permiso.' };
        }

        return { ...draft, status: 'ok', conflictMsg: undefined };
      })
    );

    setDrafts(newDrafts);
    setLoading(false);
  };

  useEffect(() => {
    if (drafts.length > 0) validateDrafts();
    // eslint-disable-next-line
  }, [drafts]);

  const internalTechs = technicians.filter((t) => t.person_type === 'internal');
  const externalTechs = technicians.filter((t) => t.person_type === 'external');

  return (
    <div className="w-full h-full bg-white rounded-2xl shadow-xl p-8 flex flex-col overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Calendar className="w-6 h-6" /> Planificación Masiva de Mantenimiento
      </h2>

      <div className="flex gap-10 mb-8 flex-wrap items-end">
        <div>
          <label className="block font-medium mb-1">Año</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded px-2 py-1 w-28" />
        </div>

        <div>
          <label className="block font-medium mb-1">Mes</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded px-2 py-1 w-44">
            {[...Array(12)].map((_, i) => (
              <option key={i} value={i}>
                {new Date(2000, i, 1).toLocaleString('es-CL', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[350px]">
          <label className="block font-medium mb-1">Edificios</label>
          {buildings.length === 0 ? (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded p-2 mt-2">
              No hay edificios disponibles en la base de datos.
            </div>
          ) : (
            <select
              multiple
              value={selectedBuildings}
              onChange={(e) => setSelectedBuildings(Array.from(e.target.selectedOptions, (o) => o.value))}
              className="border rounded px-2 py-2 w-full min-h-[320px] text-lg"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {internalTechs.length === 0 && (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-4">
          No hay técnicos internos disponibles en la base de datos.
        </div>
      )}

      {selectedBuildings.length === 0 ? (
        <div className="text-center text-gray-500 text-lg my-10">
          Selecciona uno o más edificios para planificar mantenimientos.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-base mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2">Edificio</th>
                <th className="border px-4 py-2">Técnicos internos</th>
                <th className="border px-4 py-2">Técnicos externos</th>
                <th className="border px-4 py-2">Día</th>
                <th className="border px-4 py-2">Duración</th>
                <th className="border px-4 py-2">Inamovible</th>
                <th className="border px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {drafts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8">
                    No hay datos para mostrar.
                  </td>
                </tr>
              ) : (
                drafts.map((draft) => (
                  <tr key={draft.building.id} className={draft.status !== 'ok' ? 'bg-red-50' : ''}>
                    <td className="border px-4 py-2 font-semibold text-lg">{draft.building.name}</td>

                    <td className="border px-4 py-2">
                      <select
                        multiple
                        value={draft.internalTechnicians.map((t) => t.id)}
                        onChange={(e) =>
                          handleInternalTechnicianChange(draft.building.id, Array.from(e.target.selectedOptions, (o) => o.value))
                        }
                        className="border rounded px-2 py-2 min-w-[220px] min-h-[90px] text-base"
                      >
                        {internalTechs.length === 0 ? (
                          <option disabled>No hay técnicos internos</option>
                        ) : (
                          internalTechs.map((t) => (
                            <option key={t.id} value={t.id} disabled={t.is_on_leave}>
                              {t.full_name}
                              {t.is_on_leave ? ' (ausente)' : ''}
                            </option>
                          ))
                        )}
                      </select>
                    </td>

                    <td className="border px-4 py-2">
                      <select
                        multiple
                        value={draft.externalTechnicians.map((t) => t.id)}
                        onChange={(e) =>
                          handleExternalTechnicianChange(draft.building.id, Array.from(e.target.selectedOptions, (o) => o.value))
                        }
                        className="border rounded px-2 py-2 min-w-[260px] min-h-[60px] text-base"
                      >
                        {externalTechs.length === 0 ? (
                          <option disabled>No hay técnicos externos</option>
                        ) : (
                          externalTechs.map((t) => {
                            const label = `${t.full_name}${t.company_name ? ` - ${t.company_name}` : ''}`;
                            return (
                              <option key={t.id} value={t.id}>
                                {label}
                              </option>
                            );
                          })
                        )}
                      </select>
                    </td>

                    <td className="border px-4 py-2">
                      <select
                        value={draft.days[0].date}
                        onChange={(e) => handleDayChange(draft.building.id, e.target.value)}
                        className="border rounded px-2 py-2 text-base"
                      >
                        {getWeekdays().length === 0 ? (
                          <option disabled>No hay días hábiles</option>
                        ) : (
                          getWeekdays().map((d) => (
                            <option key={d.date} value={d.date}>
                              {d.label}
                            </option>
                          ))
                        )}
                      </select>
                    </td>

                    <td className="border px-4 py-2">
                      <select
                        value={draft.days[0].duration}
                        onChange={(e) => handleDurationChange(draft.building.id, Number(e.target.value))}
                        className="border rounded px-2 py-2 text-base"
                      >
                        <option value={0.5}>Medio día</option>
                        <option value={1}>Día completo</option>
                        <option value={2}>2 días</option>
                        <option value={3}>3 días</option>
                        <option value={5}>5 días</option>
                      </select>
                    </td>

                    <td className="border px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!draft.days[0].is_fixed}
                        onChange={(e) => handleFixedChange(draft.building.id, e.target.checked)}
                        className="w-6 h-6"
                      />
                    </td>

                    <td className="border px-4 py-2">
                      {draft.status === 'ok' ? (
                        <span className="text-green-700 font-semibold">OK</span>
                      ) : (
                        <span className="text-red-700 font-semibold">{draft.conflictMsg}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 rounded p-2 flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 text-green-700 rounded p-2 flex items-center gap-2 mb-2">
          <Check className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={loading || drafts.length === 0}
        >
          Guardar Asignaciones
        </button>
      </div>
    </div>
  );
}