import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Plus, Send, AlertCircle, AlertTriangle } from 'lucide-react';
import { CalendarDayCell } from './CalendarDayCell';
import { MaintenanceAssignmentModal } from './MaintenanceAssignmentModal';
import { TechnicianAvailabilityPanel } from './TechnicianAvailabilityPanel';
import { EmergencyShiftsMonthlyView } from './EmergencyShiftsMonthlyView';
import { useAuth } from '../../contexts/AuthContext';

interface MaintenanceAssignment {
  id: string;
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end: string;
  building_name: string;
  client_name: string;
  assigned_to: string;
  is_external: boolean;
  status: string;
  is_fixed: boolean;
  is_holiday_date: boolean;
  display_status: string;
  estimated_duration_hours: number;
  assigned_technician_id?: string;
  publication_status?: string;
  emergency_context_notes?: string;
}

interface Technician {
  technician_id: string;
  full_name: string;
  phone: string;
  email: string;
  is_on_leave: boolean;
  assignments_today: number;
  emergency_shift_type?: string;
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  assignments: MaintenanceAssignment[];
  absences: TechnicianAbsenceDayInfo[];
  emergencyShifts: EmergencyShiftDayInfo[];
}

interface TechnicianAbsenceDayInfo {
  technicianId: string;
  technicianName: string;
  reasons: string[];
}

interface EmergencyShiftDayInfo {
  shiftId: string;
  assigneeName: string;
  isPrimary: boolean;
}

interface MaintenanceCalendarViewProps {
  onNavigate?: (path: string) => void;
}

export function MaintenanceCalendarView({ onNavigate }: MaintenanceCalendarViewProps) {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [assignments, setAssignments] = useState<MaintenanceAssignment[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [technicianNameMap, setTechnicianNameMap] = useState<Map<string, string>>(new Map());
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [technicianAbsences, setTechnicianAbsences] = useState<Map<string, Map<string, string[]>>>(new Map()); // { date: { technicianId: [reasons] } }
  const [emergencyShiftsByDate, setEmergencyShiftsByDate] = useState<Map<string, EmergencyShiftDayInfo[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<MaintenanceAssignment | null>(null);
  const [calendarStats, setCalendarStats] = useState<any>(null);

  useEffect(() => {
    loadCalendarData();
    loadCalendarStats();
  }, [currentDate, selectedMonth]);

  useEffect(() => {
    generateCalendarDays();
  }, [assignments, holidays, technicianAbsences, technicianNameMap, emergencyShiftsByDate, currentDate]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAssignments(),
        loadTechnicians(),
        loadHolidays(),
        loadTechnicianAbsences(),
        loadEmergencyShifts()
      ]);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from('v_monthly_maintenance_calendar')
      .select('*')
      .gte('scheduled_date', startOfMonth.toISOString().split('T')[0])
      .lte('scheduled_date', endOfMonth.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time_start', { ascending: true });

    if (error) {
      console.error('Error loading assignments:', error);
      return;
    }

    setAssignments(data || []);
  };

  const loadTechnicians = async () => {
    const { data, error } = await supabase
      .from('v_technician_availability_today')
      .select('*');

    if (error) {
      console.error('Error loading technicians:', error);
      return;
    }

    const techniciansData = data || [];
    setTechnicians(techniciansData);
    const nameMap = new Map<string, string>();
    techniciansData.forEach((tech) => {
      if (tech.technician_id) {
        nameMap.set(tech.technician_id, tech.full_name);
      }
    });
    setTechnicianNameMap(nameMap);
  };

  const loadTechnicianAbsences = async () => {
    try {
      const { data, error } = await supabase
        .from('technician_availability')
        .select('technician_id, start_date, end_date, reason')
        .eq('status', 'approved');

      if (error) throw error;

      const absenceMap = new Map<string, Map<string, string[]>>();

      (data || []).forEach(absence => {
        const [sy, sm, sd] = absence.start_date.split('-').map(Number);
        const [ey, em, ed] = absence.end_date.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        const end = new Date(ey, em - 1, ed);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!absenceMap.has(dateStr)) {
            absenceMap.set(dateStr, new Map<string, string[]>());
          }
          if (!absenceMap.get(dateStr)!.has(absence.technician_id)) {
            absenceMap.get(dateStr)!.set(absence.technician_id, []);
          }
          absenceMap.get(dateStr)!.get(absence.technician_id)!.push(absence.reason);
        }
      });

      setTechnicianAbsences(absenceMap);
    } catch (error) {
      console.error('Error loading technician absences:', error);
    }
  };

  const loadEmergencyShifts = async () => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_emergency_shifts', {
        target_month: selectedMonth
      });

      if (error) throw error;

      const shiftMap = new Map<string, EmergencyShiftDayInfo[]>();

      (data || []).forEach((shift: any) => {
        const assigneeName = shift.technician_name || shift.external_personnel_name || 'Sin asignar';
        const start = new Date(shift.shift_start_date);
        const end = new Date(shift.shift_end_date);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!shiftMap.has(dateStr)) {
            shiftMap.set(dateStr, []);
          }
          shiftMap.get(dateStr)!.push({
            shiftId: shift.id,
            assigneeName,
            isPrimary: !!shift.is_primary,
          });
        }
      });

      setEmergencyShiftsByDate(shiftMap);
    } catch (error) {
      console.error('Error loading emergency shifts:', error);
      setEmergencyShiftsByDate(new Map());
    }
  };

  const loadHolidays = async () => {
    const year = currentDate.getFullYear();
    const { data, error } = await supabase
      .from('holidays')
      .select('holiday_date')
      .gte('holiday_date', `${year}-01-01`)
      .lte('holiday_date', `${year}-12-31`);

    if (error) {
      console.error('Error loading holidays:', error);
      return;
    }

    const holidaySet = new Set(data?.map(h => h.holiday_date) || []);
    setHolidays(holidaySet);
  };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Primer día del mes
    const firstDay = new Date(year, month, 1);
    // Último día del mes
    const lastDay = new Date(year, month + 1, 0);
    
    // Día de la semana del primer día (0=domingo, 1=lunes, etc.)
    const startDayOfWeek = firstDay.getDay();
    // Ajustar para que lunes sea el primer día (0=lunes, 6=domingo)
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Días del mes anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = adjustedStartDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push(createCalendarDay(date, false, today));
    }

    // Días del mes actual
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push(createCalendarDay(date, true, today));
    }

    // Días del mes siguiente para completar la grilla (6 filas x 7 días = 42)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push(createCalendarDay(date, false, today));
    }

    setCalendarDays(days);
  };

  const createCalendarDay = (date: Date, isCurrentMonth: boolean, today: Date): CalendarDay => {
    const dateStr = date.toISOString().split('T')[0];
    // getDay(): 0=domingo, 1=lunes, ..., 6=sábado
    // Fin de semana: 0 (domingo) y 6 (sábado)
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const absencesForDay: TechnicianAbsenceDayInfo[] = [];
    const absencesByTechnician = technicianAbsences.get(dateStr);
    if (absencesByTechnician) {
      absencesByTechnician.forEach((reasons, technicianId) => {
        absencesForDay.push({
          technicianId,
          technicianName: technicianNameMap.get(technicianId) || 'Técnico',
          reasons,
        });
      });
    }

    const emergencyForDay = emergencyShiftsByDate.get(dateStr) || [];
    
    return {
      date,
      day: date.getDate(),
      isCurrentMonth,
      isToday: date.getTime() === today.getTime(),
      isWeekend,
      isHoliday: holidays.has(dateStr),
      assignments: assignments.filter(a => a.scheduled_date === dateStr),
      absences: absencesForDay,
      emergencyShifts: emergencyForDay,
    };
  };

  // Eliminadas funciones de mes anterior/siguiente no usadas

  const handleDayClick = (day: CalendarDay) => {
    if (!day.isCurrentMonth) return;
    setSelectedDate(day.date);
    setSelectedAssignment(null);
    setShowAssignmentModal(true);
  };

  const handleAssignmentClick = (assignment: MaintenanceAssignment, day: CalendarDay) => {
    setSelectedDate(day.date);
    setSelectedAssignment(assignment);
    setShowAssignmentModal(true);
  };

  const handleAssignmentCreated = () => {
    loadCalendarData();
    setShowAssignmentModal(false);
  };

  const handlePublishCalendar = async () => {
    setPublishing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuario no autenticado');

      const { data, error } = await supabase.rpc('publish_calendar_month', {
        target_month: selectedMonth,
        admin_id: userData.user.id
      });

      if (error) throw error;

      loadCalendarData();
      alert(`✅ Calendario publicado exitosamente. ${data?.assignments_published || 0} asignaciones publicadas.`);
    } catch (error) {
      console.error('Error publishing calendar:', error);
      alert('❌ Error al publicar el calendario');
    } finally {
      setPublishing(false);
    }
  };

  const loadCalendarStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_calendar_month_stats', {
        target_month: selectedMonth
      });

      if (!error && data) {
        setCalendarStats(data);
      }
    } catch (error) {
      console.error('Error loading calendar stats:', error);
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando calendario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Calendar className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Calendario Operativo</h1>
              <p className="text-sm text-slate-600">Gestión de mantenimientos, vacaciones, turnos y cobertura de emergencias</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                const [year, month] = e.target.value.split('-');
                setCurrentDate(new Date(parseInt(year), parseInt(month) - 1, 1));
              }}
              className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() + i);
                const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                return (
                  <option key={monthStr} value={monthStr}>
                    {monthNames[date.getMonth()]} {date.getFullYear()}
                  </option>
                );
              })}
            </select>

            {(profile?.role === 'developer' || profile?.role === 'admin') && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onNavigate && onNavigate('technician-absences')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                >
                  <Calendar className="w-4 h-4" />
                  Vacaciones y Permisos
                </button>
                <button
                  onClick={() => onNavigate && onNavigate('emergency-shifts')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Turnos de Emergencia
                </button>
              </div>
            )}

            {calendarStats?.draft_count > 0 && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                BORRADOR
              </span>
            )}

            {calendarStats?.draft_count > 0 && (
              <button
                onClick={handlePublishCalendar}
                disabled={publishing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                {publishing ? 'Publicando...' : 'Publicar'}
              </button>
            )}

            <button
              onClick={() => {
                setSelectedDate(new Date());
                setSelectedAssignment(null);
                setShowAssignmentModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Asignar Mantenimiento
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Calendario Principal */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Leyenda */}
          <div className="mb-4 flex items-center gap-6 bg-white p-4 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-slate-600">Completado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-slate-600">Programado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-slate-600">Hoy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm text-slate-600">Atrasado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-sm text-slate-600">Vacaciones / Permisos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <span className="text-sm text-slate-600">Turno de Emergencia</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-sm text-slate-600">Día festivo</span>
            </div>
          </div>

          {/* Grid del Calendario */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Días de la semana */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {weekDays.map(day => (
                <div
                  key={day}
                  className="py-3 text-center text-sm font-semibold text-slate-700"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Días del mes */}
            <div className="grid grid-cols-7 auto-rows-fr">
              {calendarDays.map((day, index) => (
                <CalendarDayCell
                  key={index}
                  day={day}
                  onDayClick={handleDayClick}
                  onAssignmentClick={handleAssignmentClick}
                />
              ))}
            </div>
          </div>

          {/* Vista de Turnos de Emergencia */}
          <div className="mt-6">
            <EmergencyShiftsMonthlyView targetMonth={selectedMonth} />
          </div>
        </div>

        {/* Panel Lateral de Técnicos */}
        <TechnicianAvailabilityPanel
          technicians={technicians}
          currentDate={currentDate}
          onRefresh={loadTechnicians}
          absences={technicianAbsences}
        />
      </div>

      {/* Modal de Asignación */}
      {showAssignmentModal && (
        <MaintenanceAssignmentModal
          selectedDate={selectedDate}
          assignment={selectedAssignment}
          technicians={technicians}
          technicianAbsences={technicianAbsences}
          onClose={() => setShowAssignmentModal(false)}
          onSuccess={handleAssignmentCreated}
        />
      )}
    </div>
  );
}
