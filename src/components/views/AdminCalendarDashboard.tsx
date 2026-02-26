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
  const [maintenanceEvents, setMaintenanceEvents] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);

  const [externalTechnicians, setExternalTechnicians] = useState<any[]>([]);

  const monthStart = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, 1);
    return d.toISOString().slice(0, 10);
  }, [selectedYear, selectedMonth]);

  const monthEnd = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth + 1, 0);
    return d.toISOString().slice(0, 10);
  }, [selectedYear, selectedMonth]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);

    try {
      setExternalTechnicians(getExternalTechnicians());

      // 1) Emergency shifts (turnos)
      const { data: shiftData } = await supabase
        .from('emergency_shifts')
        .select('*')
        .gte('shift_date', monthStart)
        .lte('shift_date', monthEnd);

      setEmergencyShifts(shiftData || []);

      // 2) Emergency visits
      const { data: visitData } = await supabase
        .from('emergency_visits')
        .select('*')
        .gte('visit_date', monthStart)
        .lte('visit_date', monthEnd);

      setEmergencyVisits(visitData || []);

      // 3) Calendar events
      const { data: calData } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd);

      setCalendarEvents(calData || []);

      // 4) Maintenance events
      const { data: maintData } = await supabase
        .from('maintenances')
        .select('*')
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd);

      setMaintenanceEvents(maintData || []);

      // 5) Work orders / service requests
      const { data: woData } = await supabase
        .from('service_requests')
        .select('*')
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd);

      setWorkOrders(woData || []);

      // Consolidar para el calendario “principal”
      const merged: CalendarEvent[] = [];

      // maintenances
      (maintData || []).forEach((m: any) => {
        merged.push({
          id: `m-${m.id}`,
          scheduled_date: m.scheduled_date,
          type: 'maintenance',
          title: m.title || 'Mantenimiento',
          description: m.description || null,
          client_id: m.client_id || null,
          building_name: m.building_name || m.client_name || null,
          assigned_name: m.assigned_name || m.technician_name || null,
          status: m.status || null,
        });
      });

      // work orders
      (woData || []).forEach((w: any) => {
        merged.push({
          id: `w-${w.id}`,
          scheduled_date: w.scheduled_date,
          type: 'work_order',
          title: w.title || 'Solicitud',
          description: w.description || null,
          client_id: w.client_id || null,
          building_name: w.building_name || w.client_name || null,
          assigned_name: w.assigned_name || w.technician_name || null,
          status: w.status || null,
        });
      });

      // emergency shifts
      (shiftData || []).forEach((s: any) => {
        merged.push({
          id: `es-${s.id}`,
          scheduled_date: s.shift_date,
          type: 'emergency_shift',
          title: s.title || 'Turno emergencia',
          description: s.notes || s.description || null,
          client_id: null,
          building_name: s.building_name || null,
          assigned_name: s.technician_name || s.person || null,
          status: s.status || null,
        });
      });

      // emergency visits
      (visitData || []).forEach((v: any) => {
        merged.push({
          id: `ev-${v.id}`,
          scheduled_date: v.visit_date,
          type: 'emergency_visit',
          title: v.title || 'Emergencia',
          description: v.notes || v.description || null,
          client_id: v.client_id || null,
          building_name: v.building_name || v.client_name || null,
          assigned_name: v.technician_name || v.person || null,
          status: v.status || null,
        });
      });

      // calendar events table
      (calData || []).forEach((c: any) => {
        merged.push({
          id: `c-${c.id}`,
          scheduled_date: c.date,
          type: 'calendar_event',
          title: c.title || 'Evento',
          description: c.description || null,
          client_id: c.client_id || null,
          building_name: c.building_name || null,
          assigned_name: c.person || null,
          status: c.status || null,
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
  }, [user, monthStart, monthEnd]);

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

          {/* Vista calendario de mantenimientos (visual) */}
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