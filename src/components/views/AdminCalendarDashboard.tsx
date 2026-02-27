import { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Shield } from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

import { getExternalTechnicians, addExternalTechnician } from '../../lib/external_technicians';

import { MaintenanceMassPlannerV2 } from '../calendar/MaintenanceMassPlannerV2';
import { EmergencyShiftScheduler } from '../calendar/EmergencyShiftScheduler';
import { EmergencyShiftsMonthlyView } from '../calendar/EmergencyShiftsMonthlyView';
import { CoordinationRequestsPanel } from '../calendar/CoordinationRequestsPanel';
import { MaintenanceCalendarView } from '../calendar/MaintenanceCalendarView';

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
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [emergencyShifts, setEmergencyShifts] = useState<any[]>([]);
  const [emergencyVisits, setEmergencyVisits] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);

  const [externalTechnicians, setExternalTechnicians] = useState<any[]>([]);

  const monthStartISO = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, 1);
    return d.toISOString().slice(0, 10);
  }, [selectedYear, selectedMonth]);

  const monthEndISO = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth + 1, 0);
    return d.toISOString().slice(0, 10);
  }, [selectedYear, selectedMonth]);

  const loadAll = async () => {
    if (!user) return;

    setLoading(true);
    try {
      setExternalTechnicians(getExternalTechnicians());

      const start = monthStartISO;
      const end = monthEndISO;

      // 1) maintenance_schedules
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
      const { data: wo, error: woErr } = await supabase
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

      // 5) calendar_events  ✅ (aquí estaba quedando cortado en tus builds)
      const { data: customEvents, error: ceErr } = await supabase
        .from('calendar_events')
        .select('id, date, title, description, status, building_name, person, type')
        .gte('date', start)
        .lte('date', end);

      if (ceErr) throw ceErr;

      setMaintenanceSchedules(schedules || []);
      setEmergencyVisits(emergencies || []);
      setWorkOrders(wo || []);
      setEmergencyShifts(shifts || []);
      setCalendarEvents(customEvents || []);

      // Consolidado para la vista principal
      const merged: CalendarEvent[] = [];

      (schedules || []).forEach((s: any) => {
        merged.push({
          id: `m-${s.id}`,
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
          id: `ev-${e.id}`,
          scheduled_date: date,
          type: 'emergency_visit',
          title: 'Emergencia',
          description: e.failure_description ?? null,
          client_id: e.client_id ?? null,
          building_name: null,
          assigned_name: null,
          status: e.status ?? null,
        });
      });

      (wo || []).forEach((w: any) => {
        const date = (w.created_at || '').slice(0, 10);
        merged.push({
          id: `w-${w.id}`,
          scheduled_date: date,
          type: 'work_order',
          title: 'Orden de trabajo',
          description: w.description ?? null,
          client_id: w.client_id ?? null,
          building_name: null,
          assigned_name: null,
          status: w.status ?? null,
        });
      });

      (shifts || []).forEach((s: any) => {
        merged.push({
          id: `es-${s.id}`,
          scheduled_date: s.shift_date,
          type: 'emergency_shift',
          title: 'Turno emergencia',
          description: null,
          client_id: null,
          building_name: null,
          assigned_name: s.technician_name ?? null,
          status: s.status ?? null,
        });
      });

      (customEvents || []).forEach((c: any) => {
        merged.push({
          id: `c-${c.id}`,
          scheduled_date: c.date,
          type: 'calendar_event',
          title: c.title || 'Evento',
          description: c.description ?? null,
          client_id: c.client_id ?? null,
          building_name: c.building_name ?? null,
          assigned_name: c.person ?? null,
          status: c.status ?? null,
        });
      });

      setEvents(merged);
    } catch (e) {
      console.error('[AdminCalendarDashboard] Error cargando calendario:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const onRefresh = () => loadAll();
    window.addEventListener('asignacion-eliminada', onRefresh);
    return () => window.removeEventListener('asignacion-eliminada', onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, monthStartISO, monthEndISO]);

  const handleAddExternalTech = () => {
    const name = window.prompt('Nombre del técnico externo:');
    if (!name) return;
    const phone = window.prompt('Teléfono (opcional):') || '';
    addExternalTechnician({ name, phone });
    setExternalTechnicians(getExternalTechnicians());
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold">Calendario (Admin)</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 text-sm"
            onClick={() => setViewMode((v) => (v === 'monthly' ? 'weekly' : 'monthly'))}
          >
            Vista: {viewMode === 'monthly' ? 'Mensual' : 'Semanal'}
          </button>

          <button
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
            onClick={handleAddExternalTech}
            title="Agregar técnico externo"
          >
            <Plus className="w-4 h-4" /> Externo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Columna principal */}
        <div className="xl:col-span-2 space-y-4">
          {/* Navegación mes/año */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-semibold">Mes:</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i}>
                  {new Date(2000, i, 1).toLocaleString('es-CL', { month: 'long' })}
                </option>
              ))}
            </select>

            <label className="text-sm font-semibold">Año:</label>
            <input
              type="number"
              className="border rounded px-2 py-1 text-sm w-24"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            />

            <button
              className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-sm"
              onClick={loadAll}
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Recargar'}
            </button>
          </div>

          {/* Vista calendario */}
          <div className="border rounded bg-white p-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-700">
              <Shield className="w-4 h-4" /> Vista de calendario
            </div>

            <MaintenanceCalendarView
              events={events}
              month={selectedMonth}
              year={selectedYear}
              viewMode={viewMode}
              externalTechnicians={externalTechnicians}
            />
          </div>

          {/* Paneles adicionales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded bg-white p-3">
              <EmergencyShiftScheduler month={selectedMonth} year={selectedYear} />
            </div>

            <div className="border rounded bg-white p-3">
              <EmergencyShiftsMonthlyView month={selectedMonth} year={selectedYear} />
            </div>

            <div className="border rounded bg-white p-3 md:col-span-2">
              <CoordinationRequestsPanel month={selectedMonth} year={selectedYear} />
            </div>
          </div>

          <div className="border rounded bg-white p-3">
            <MaintenanceMassPlannerV2 month={selectedMonth} year={selectedYear} />
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          <ProfessionalBreakdown
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            events={events.map((e) => ({
              id: e.id,
              date: e.scheduled_date,
              type: e.type,
              assignee: e.assigned_name || undefined,
              building_name: e.building_name || undefined,
              status: e.status || undefined,
              description: e.description || undefined,
            }))}
          />
        </div>
      </div>
    </div>
  );
}