// Commit de prueba para forzar build limpio en Vercel
import { useState, useEffect } from 'react';
import { getExternalTechnicians, addExternalTechnician } from '../../lib/external_technicians';
import { Calendar, Plus, Shield } from 'lucide-react';
import { MaintenanceMassPlannerV2 } from '../calendar/MaintenanceMassPlannerV2';
import { EmergencyShiftScheduler } from '../calendar/EmergencyShiftScheduler';
import { ProfessionalBreakdown } from './ProfessionalBreakdown';
import { EmergencyShiftsMonthlyView } from '../calendar/EmergencyShiftsMonthlyView';
import { MaintenanceCalendarView } from '../calendar/MaintenanceCalendarView';
import { CoordinationRequestsPanel } from '../calendar/CoordinationRequestsPanel';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [openNewEventModal, setOpenNewEventModal] = useState(false);
  const [openMassPlanner, setOpenMassPlanner] = useState(false);
  const [openEmergencyScheduler, setOpenEmergencyScheduler] = useState(false);

  const [externalTechnicians, setExternalTechnicians] = useState<{ id: string; full_name: string }[]>([]);
  const [newExternalTechName, setNewExternalTechName] = useState('');

  // =========================
  // Helpers
  // =========================
  const monthStartISO = () => {
    const start = new Date(selectedYear, selectedMonth, 1);
    return start.toISOString().slice(0, 10);
  };

  const monthEndISO = () => {
    const end = new Date(selectedYear, selectedMonth + 1, 0);
    return end.toISOString().slice(0, 10);
  };

  // =========================
  // Fetch principales
  // =========================
  const fetchEventos = async () => {
    setLoading(true);
    setError('');
    try {
      const start = monthStartISO();
      const end = monthEndISO();

      // 1) maintenance_schedules (lo “antiguo” del calendario)
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

  // =========================
  // Load inicial
  // =========================
  useEffect(() => {
    fetchEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const ext = getExternalTechnicians();
    setExternalTechnicians(ext);
  }, []);

  // =========================
  // UI External technicians (solo para el planner)
  // =========================
  const handleSaveExternalTech = () => {
    const name = newExternalTechName.trim();
    if (!name) return;
    addExternalTechnician(name);
    setExternalTechnicians(getExternalTechnicians());
    setNewExternalTechName('');
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-7 h-7" />
            Calendario mensual
          </h1>
          <div className="text-sm text-gray-500 mt-1">Gestión de eventos, turnos y asignaciones</div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as CalendarViewMode)}
            className="border rounded px-3 py-2 bg-white"
          >
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
          </select>

          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
            onClick={() => setOpenNewEventModal(true)}
            type="button"
          >
            <Plus className="w-4 h-4" />
            Nuevo Evento
          </button>

          <button
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
            onClick={() => setOpenMassPlanner(true)}
            type="button"
          >
            <Calendar className="w-4 h-4" />
            Planificación Masiva
          </button>

          <button
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2"
            onClick={() => setOpenEmergencyScheduler(true)}
            type="button"
          >
            <Shield className="w-4 h-4" />
            Turnos de Emergencia
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500">Cargando calendario...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <MaintenanceCalendarView
              month={selectedMonth}
              year={selectedYear}
              viewMode={viewMode}
              events={events}
              onMonthChange={setSelectedMonth}
              onYearChange={setSelectedYear}
              onRefresh={fetchEventos}
            />
          </div>

          <div className="space-y-6">
            <ProfessionalBreakdown />

            <EmergencyShiftsMonthlyView month={selectedMonth} year={selectedYear} onRefresh={fetchEventos} />

            <CoordinationRequestsPanel month={selectedMonth} year={selectedYear} onRefresh={fetchEventos} />

            <div className="rounded border bg-white p-4">
              <div className="font-semibold mb-2">Técnicos externos recurrentes</div>
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
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Guardar
                </button>
              </div>

              <div className="mt-3 text-sm text-gray-600">
                {externalTechnicians.length === 0 ? (
                  <div>No hay externos guardados.</div>
                ) : (
                  <ul className="list-disc pl-5">
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

      {/* MODALES */}
      {openMassPlanner && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setOpenMassPlanner(false)}
                className="text-gray-500 hover:text-gray-800 px-3 py-1"
              >
                ✕
              </button>
            </div>

            <MaintenanceMassPlannerV2
              onClose={() => setOpenMassPlanner(false)}
              onSuccess={() => {
                fetchEventos();
              }}
            />
          </div>
        </div>
      )}

      {openEmergencyScheduler && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setOpenEmergencyScheduler(false)}
                className="text-gray-500 hover:text-gray-800 px-3 py-1"
              >
                ✕
              </button>
            </div>

            <EmergencyShiftScheduler
              onClose={() => setOpenEmergencyScheduler(false)}
              onSuccess={() => {
                fetchEventos();
              }}
            />
          </div>
        </div>
      )}

      {/* IMPORTANTE:
          El modal de "Nuevo Evento" no está incluido aquí porque depende del componente específico que uses.
          Si quieres, súbeme ese archivo (el que renderiza "Nuevo Evento") y lo dejo listo para:
          - quitar "mantenimiento" de ahí
          - mantener solo reparación/certificación/capacitación/etc.
      */}
    </div>
  );
}
