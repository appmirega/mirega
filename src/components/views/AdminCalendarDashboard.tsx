import { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Shield } from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

import { getExternalTechnicians, addExternalTechnician } from '../../lib/external_technicians';

import { MaintenanceMassPlannerV2 } from '../calendar/MaintenanceMassPlannerV2';
import { EmergencyShiftScheduler } from '../calendar/EmergencyShiftScheduler';
import { EmergencyShiftsMonthlyView } from '../calendar/EmergencyShiftsMonthlyView';
import { MaintenanceCalendarView } from '../calendar/MaintenanceCalendarView';
import { CoordinationRequestsPanel } from '../calendar/CoordinationRequestsPanel';
import { ProfessionalBreakdown } from './ProfessionalBreakdown';

type CalendarViewMode = 'monthly' | 'weekly';

type CalendarEvent = {
  id: string;
  scheduled_date: string; // YYYY-MM-DD
  type: 'maintenance' | 'work_order' | 'emergency_visit' | 'emergency_shift' | 'calendar_event';
  title: string;
  description?: string | null;
  client_id?: string | null;
  building_name?: string | null;
  assigned_name?: string | null;
  status?: string | null;
};

export default function AdminCalendarDashboard() {
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<CalendarViewMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [openNewEventModal, setOpenNewEventModal] = useState<boolean>(false);
  const [openMassPlanner, setOpenMassPlanner] = useState<boolean>(false);
  const [openEmergencyScheduler, setOpenEmergencyScheduler] = useState<boolean>(false);

  // Externos recurrentes (solo para el planner)
  const [externalTechnicians, setExternalTechnicians] = useState<{ id: string; full_name: string }[]>([]);
  const [newExternalTechName, setNewExternalTechName] = useState<string>('');

  // -------------------------
  // Helpers fechas
  // -------------------------
  const monthStartISO = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth, 1);
    return start.toISOString().slice(0, 10);
  }, [selectedYear, selectedMonth]);

  const monthEndISO = useMemo(() => {
    const end = new Date(selectedYear, selectedMonth + 1, 0);
    return end.toISOString().slice(0, 10);
  }, [selectedYear, selectedMonth]);

  // -------------------------
  // Fetch principales
  // -------------------------
  const fetchEventos = async () => {
    setLoading(true);
    setError('');

    try {
      const start = monthStartISO;
      const end = monthEndISO;

      // 1) maintenance_schedules (fuente “histórica” que ya usa tu calendario)
      const { data: schedules, error: schErr } = await supabase
        .from('maintenance_schedules')
        .select(
          `
          id,
          scheduled_date,
          client_id,
          building_name,
          status,
          assigned_technician_id,
          profiles:assigned_technician_id(full_name)
        `
        )
        .gte('scheduled_date', start)
        .lte('scheduled_date', end);

      if (schErr) throw schErr;

      // 2) emergency_visits
      const { data: emergencies, error: emErr } = await supabase
        .from('emergency_visits')
        .select('id, created_at, client_id, status, failure_description')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`);

      if (emErr) throw emErr;

      // 3) work_orders
      const { data: workOrders, error: woErr } = await supabase
        .from('work_orders')
        .select('id, created_at, client_id, status, description')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`);

      if (woErr) throw woErr;

      // 4) emergency_shifts
      const { data: shifts, error: shErr } = await supabase
        .from('emergency_shifts')
        .select('id, shift_date, technician_name, status')
        .gte('shift_date', start)
        .lte('shift_date', end);

      if (shErr) throw shErr;

      // 5) calendar_events
      const { data: customEvents, error: ceErr } = await supabase
        .from('calendar_events')
        .select('id, date, title, description, status')
        .gte('date', start)
        .lte('date', end);

      if (ceErr) throw ceErr;

      const merged: CalendarEvent[] = [];

      (schedules || []).forEach((s: any) => {
        merged.push({
          id: s.id,
          scheduled_date: s.scheduled_date,
          type: 'maintenance',
          title: 'Mantenimiento',
          description: null,
          client_id: s.client_id,
          building_name: s.building_name,
          assigned_name: s.profiles?.full_name ?? null,
          status: s.status ?? null,
        });
      });

      (emergencies || []).forEach((e: any) => {
        const date = (e.created_at || '').slice(0, 10);
        merged.push({
          id: e.id,
          scheduled_date: date,
          type: 'emergency_visit',
          title: 'Emergencia',
          description: e.failure_description ?? null,
          client_id: e.client_id ?? null,
          status: e.status ?? null,
        });
      });

      (workOrders || []).forEach((w: any) => {
        const date = (w.created_at || '').slice(0, 10);
        merged.push({
          id: w.id,
          scheduled_date: date,
          type: 'work_order',
          title: 'Solicitud',
          description: w.description ?? null,
          client_id: w.client_id ?? null,
          status: w.status ?? null,
        });
      });

      (shifts || []).forEach((s: any) => {
        merged.push({
          id: s.id,
          scheduled_date: s.shift_date,
          type: 'emergency_shift',
          title: 'Turno emergencia',
          description: null,
          assigned_name: s.technician_name ?? null,
          status: s.status ?? null,
        });
      });

      (customEvents || []).forEach((c: any) => {
        merged.push({
          id: c.id,
          scheduled_date: c.date,
          type: 'calendar_event',
          title: c.title ?? 'Evento',
          description: c.description ?? null,
          status: c.status ?? null,
        });
      });

      setEvents(merged);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar eventos del calendario.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Load inicial
  // -------------------------
  useEffect(() => {
    fetchEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    setExternalTechnicians(getExternalTechnicians());
  }, []);

  // -------------------------
  // UI Externos recurrentes
  // -------------------------
  const handleSaveExternalTech = () => {
    const name = newExternalTechName.trim();
    if (!name) return;

    addExternalTechnician(name);
    setExternalTechnicians(getExternalTechnicians());
    setNewExternalTechName('');
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendario mensual</h1>
            <p className="text-sm text-gray-500">Gestión de eventos, turnos y asignaciones</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as CalendarViewMode)}
            className="border rounded px-3 py-2 bg-white"
          >
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
          </select>

          <button
            type="button"
            onClick={() => setOpenNewEventModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            title="Nuevo evento (sin mantenimiento)"
          >
            <Plus className="w-4 h-4" />
            Nuevo Evento
          </button>

          <button
            type="button"
            onClick={() => setOpenMassPlanner(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            title="Crear mantenimientos del mes"
          >
            <Shield className="w-4 h-4" />
            Calendario de Mantenimiento
          </button>

          <button
            type="button"
            onClick={() => setOpenEmergencyScheduler(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
            title="Gestión turnos"
          >
            Turnos de Emergencia
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 border border-red-200 bg-red-50 text-red-700 rounded px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-gray-600">Cargando calendario...</div>
      ) : (
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8">
            <MaintenanceCalendarView
              month={selectedMonth}
              year={selectedYear}
              events={events}
              onMonthChange={(m: number) => setSelectedMonth(m)}
              onYearChange={(y: number) => setSelectedYear(y)}
              viewMode={viewMode}
            />
          </div>

          <div className="xl:col-span-4 space-y-6">
            <ProfessionalBreakdown month={selectedMonth} year={selectedYear} />
            <EmergencyShiftsMonthlyView month={selectedMonth} year={selectedYear} />
            <CoordinationRequestsPanel month={selectedMonth} year={selectedYear} />

            <div className="border rounded-lg bg-white p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Técnicos externos recurrentes</h3>

              <div className="flex gap-2">
                <input
                  value={newExternalTechName}
                  onChange={(e) => setNewExternalTechName(e.target.value)}
                  className="border rounded px-3 py-2 flex-1"
                  placeholder="Agregar nuevo externo"
                />
                <button
                  type="button"
                  onClick={handleSaveExternalTech}
                  className="px-3 py-2 rounded bg-gray-900 text-white hover:bg-black"
                >
                  Guardar
                </button>
              </div>

              <div className="mt-3 text-sm text-gray-700">
                {externalTechnicians.length === 0 ? (
                  <div className="text-gray-500">No hay externos guardados.</div>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {externalTechnicians.map((t) => (
                      <li key={t.id}>{t.full_name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {openMassPlanner && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="font-semibold">Calendario de Mantenimiento</div>
              <button
                type="button"
                onClick={() => setOpenMassPlanner(false)}
                className="text-gray-500 hover:text-gray-800 px-3 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <MaintenanceMassPlannerV2
                user={user}
                onClose={() => setOpenMassPlanner(false)}
                onSuccess={() => fetchEventos()}
              />
            </div>
          </div>
        </div>
      )}

      {openEmergencyScheduler && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="font-semibold">Turnos de Emergencia</div>
              <button
                type="button"
                onClick={() => setOpenEmergencyScheduler(false)}
                className="text-gray-500 hover:text-gray-800 px-3 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <EmergencyShiftScheduler
                user={user}
                onClose={() => setOpenEmergencyScheduler(false)}
                onSuccess={() => fetchEventos()}
              />
            </div>
          </div>
        </div>
      )}

      {openNewEventModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="font-semibold">Nuevo Evento</div>
              <button
                type="button"
                onClick={() => setOpenNewEventModal(false)}
                className="text-gray-500 hover:text-gray-800 px-3 py-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4 text-sm text-gray-700">
              Falta integrar el modal real de “Nuevo Evento”. Pásame el archivo/componente y lo conecto aquí.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}