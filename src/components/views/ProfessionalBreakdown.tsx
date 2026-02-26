import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getExternalTechnicians } from '../../lib/external_technicians';

interface BreakdownEvent {
  id: string | number;
  date: string;
  type: string;
  assignee?: string;
  building_name?: string;
  shift_hours?: string;
  status?: string;
  description?: string;
  is_external?: boolean;
  is_primary?: boolean;
}

interface ProfessionalBreakdownProps {
  events?: BreakdownEvent[];
  selectedMonth: number;
  selectedYear: number;
}

const eventTypeLabels: Record<string, string> = {
  preventive: 'Preventivo',
  corrective: 'Correctivo',
  emergency: 'Emergencia',
  mantenimiento: 'Mantenimiento',
  reparaciones: 'Reparaciones',
  induccion_rescate: 'Inducción de rescate',
  vista_certificacion: 'Vista certificación',
  otros: 'Otros',
  turno_emergencia: 'Turno Emergencia',
  turno: 'Turno',

  // tipos que vienen de tu CalendarEvent
  maintenance: 'Mantenimiento',
  work_order: 'Solicitud',
  emergency_visit: 'Emergencia',
  emergency_shift: 'Turno emergencia',
  calendar_event: 'Evento',
};

export const ProfessionalBreakdown = ({ events = [], selectedMonth, selectedYear }: ProfessionalBreakdownProps) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Estado para edición
  const [editEvent, setEditEvent] = useState<BreakdownEvent | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editBuilding, setEditBuilding] = useState('');
  const [editPerson, setEditPerson] = useState('');
  const [editDate, setEditDate] = useState('');
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [externalTechnicians, setExternalTechnicians] = useState<any[]>([]);
  const [edificios, setEdificios] = useState<any[]>([]);

  const grouped = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const g: Record<string, BreakdownEvent[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      g[dateStr] = [];
    }
    for (const ev of events) {
      if (g[ev.date]) g[ev.date].push(ev);
    }
    return g;
  }, [events, selectedMonth, selectedYear]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'technician')
      .then(({ data }) => setTecnicos(data || []));

    supabase
      .from('clients')
      .select('id, company_name, address')
      .then(({ data }) => setEdificios(data || []));

    setExternalTechnicians(getExternalTechnicians());
  }, []);

  const handleDelete = async (ev: BreakdownEvent) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta asignación?')) return;

    const { error } = await supabase.from('calendar_events').delete().eq('id', ev.id);
    if (error) alert('Error al eliminar: ' + error.message);
    else window.dispatchEvent(new Event('asignacion-eliminada'));
  };

  const handleEdit = (ev: BreakdownEvent) => {
    setEditEvent(ev);
    setEditDesc(ev.description || '');
    setEditBuilding(ev.building_name || '');
    setEditPerson(ev.assignee || '');
    setEditDate(ev.date || '');
  };

  const handleEditSave = async () => {
    if (!editEvent) return;

    const { error } = await supabase
      .from('calendar_events')
      .update({
        description: editDesc,
        building_name: editBuilding,
        person: editPerson,
        date: editDate, // ✅ era event_date (eso te puede dar 400)
      })
      .eq('id', editEvent.id);

    if (error) alert('Error al editar: ' + error.message);
    else {
      setEditEvent(null);
      window.dispatchEvent(new Event('asignacion-eliminada'));
    }
  };

  return (
    <div className="border rounded-lg bg-white p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Asignación del mes</h3>

      <div className="overflow-x-auto max-h-[400px]">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Fecha</th>
              <th className="border px-2 py-1">Tipo</th>
              <th className="border px-2 py-1">Asignado</th>
              <th className="border px-2 py-1">Edificio</th>
              <th className="border px-2 py-1">Descripción</th>
              <th className="border px-2 py-1">Listo</th>
              <th className="border px-2 py-1">Editar</th>
              <th className="border px-2 py-1">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).flatMap(([date, dayEvents]) =>
              dayEvents.map((ev, idx) => {
                const key = `${ev.id}-${idx}`;
                const [yy, mm, dd] = (date || '').split('-');
                const dateLabel = yy && mm && dd ? `${dd}-${mm}-${yy}` : date;

                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="border px-2 py-1">{dateLabel}</td>
                    <td className="border px-2 py-1">{eventTypeLabels[ev.type] || ev.type}</td>
                    <td className="border px-2 py-1">{ev.assignee || '-'}</td>
                    <td className="border px-2 py-1">{ev.building_name || '-'}</td>
                    <td className="border px-2 py-1">{ev.description || '-'}</td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={!!checked[key]}
                        onChange={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button className="text-blue-600 hover:underline" onClick={() => handleEdit(ev)}>
                        ✏️
                      </button>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button className="text-red-600 hover:underline" onClick={() => handleDelete(ev)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editEvent && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold">Editar Asignación</h2>
              <button onClick={() => setEditEvent(null)} className="text-gray-500 hover:text-red-600">
                ✕
              </button>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-semibold mb-1">Fecha</label>
              <input
                type="date"
                className="border rounded px-2 py-1 w-full"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>

            <div className="mb-2">
              <label className="block text-sm font-semibold mb-1">Técnico/Empresa</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={editPerson}
                onChange={(e) => setEditPerson(e.target.value)}
              >
                <option value="">Selecciona técnico interno o empresa externa</option>
                {tecnicos.map((t: any) => (
                  <option key={t.id} value={t.full_name}>
                    {t.full_name} (Interno)
                  </option>
                ))}
                {externalTechnicians.length > 0 && <option disabled>──────────</option>}
                {externalTechnicians.map((ext: any) => (
                  <option key={ext.id} value={ext.name}>
                    {ext.name} (Externo)
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-semibold mb-1">Edificio</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={editBuilding}
                onChange={(e) => setEditBuilding(e.target.value)}
              >
                <option value="">Selecciona un edificio</option>
                {edificios.map((e: any) => (
                  <option key={e.id} value={e.company_name}>
                    {e.company_name} - {e.address}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-semibold mb-1">Descripción</label>
              <textarea
                className="border rounded px-2 py-1 w-full"
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>

            <button className="bg-blue-600 text-white px-4 py-2 rounded mt-2 w-full" onClick={handleEditSave}>
              Guardar Cambios
            </button>
          </div>
        </div>
      )}
    </div>
  );
};