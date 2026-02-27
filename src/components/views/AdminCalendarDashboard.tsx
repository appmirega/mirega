import { useEffect, useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

import { MaintenanceCalendarView } from '../calendar/MaintenanceCalendarView';
import { EmergencyShiftScheduler } from '../calendar/EmergencyShiftScheduler';
import { EmergencyShiftsMonthlyView } from '../calendar/EmergencyShiftsMonthlyView';
import { CoordinationRequestsPanel } from '../calendar/CoordinationRequestsPanel';
import { MaintenanceMassPlannerV2 } from '../calendar/MaintenanceMassPlannerV2';

import { ProfessionalBreakdown } from './ProfessionalBreakdown';

type BreakdownEvent = {
  id: string | number;
  date: string; // YYYY-MM-DD
  type: string;
  assignee?: string;
  building_name?: string;
  status?: string;
  description?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export default function AdminCalendarDashboard() {
  const { user } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [breakdownEvents, setBreakdownEvents] = useState<BreakdownEvent[]>([]);

  const targetMonth = useMemo(() => `${selectedYear}-${pad2(selectedMonth + 1)}`, [selectedYear, selectedMonth]);

  // Rango del mes para breakdown
  const monthStart = useMemo(() => `${selectedYear}-${pad2(selectedMonth + 1)}-01`, [selectedYear, selectedMonth]);
  const monthEnd = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth + 1, 0);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }, [selectedYear, selectedMonth]);

  // Carga SOLO para el panel derecho (no rompe el calendario aunque falle)
  const loadBreakdown = async () => {
    if (!user) {
      setBreakdownEvents([]);
      return;
    }

    setLoadingBreakdown(true);
    try {
      // ✅ calendar_events usa columna "date" (no scheduled_date)
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, date, type, person, building_name, status, description, title')
        .gte('date', monthStart)
        .lte('date', monthEnd);

      if (error) throw error;

      const mapped: BreakdownEvent[] = (data || []).map((x: any) => ({
        id: x.id,
        date: x.date,
        type: x.type || 'calendar_event',
        assignee: x.person || undefined,
        building_name: x.building_name || undefined,
        status: x.status || undefined,
        description: x.description || x.title || undefined,
      }));

      setBreakdownEvents(mapped);
    } catch (e) {
      console.error('[AdminCalendarDashboard] Breakdown load error:', e);
      setBreakdownEvents([]); // nunca crashear
    } finally {
      setLoadingBreakdown(false);
    }
  };

  useEffect(() => {
    loadBreakdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, monthStart, monthEnd]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold">Calendario (Admin)</h1>
        </div>

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
            onClick={loadBreakdown}
            disabled={loadingBreakdown}
            title="Recargar panel de asignación"
          >
            {loadingBreakdown ? 'Cargando...' : 'Recargar panel'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Columna principal */}
        <div className="xl:col-span-2 space-y-4">
          <div className="border rounded bg-white p-3">
            <MaintenanceCalendarView />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded bg-white p-3">
              <EmergencyShiftScheduler />
            </div>

            <div className="border rounded bg-white p-3">
              {/* ✅ este componente pide targetMonth (YYYY-MM) */}
              <EmergencyShiftsMonthlyView targetMonth={targetMonth} />
            </div>

            <div className="border rounded bg-white p-3 md:col-span-2">
              <CoordinationRequestsPanel />
            </div>
          </div>

          <div className="border rounded bg-white p-3">
            <MaintenanceMassPlannerV2 />
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          <ProfessionalBreakdown
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            events={breakdownEvents}
          />
        </div>
      </div>
    </div>
  );
}