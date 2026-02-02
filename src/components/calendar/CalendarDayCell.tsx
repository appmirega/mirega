import { Clock, User, Users, MapPin } from 'lucide-react';

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
}

interface DayAbsence {
  technicianId: string;
  technicianName: string;
  reasons: string[];
}

interface DayEmergencyShift {
  shiftId: string;
  assigneeName: string;
  isPrimary: boolean;
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  assignments: MaintenanceAssignment[];
  absences: DayAbsence[];
  emergencyShifts: DayEmergencyShift[];
}

interface CalendarDayCellProps {
  day: CalendarDay;
  onDayClick: (day: CalendarDay) => void;
  onAssignmentClick: (assignment: MaintenanceAssignment, day: CalendarDay) => void;
}

export function CalendarDayCell({ day, onDayClick, onAssignmentClick }: CalendarDayCellProps) {
  const getStatusColor = (assignment: MaintenanceAssignment) => {
    switch (assignment.display_status) {
      case 'completed':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'today':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'overdue':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'upcoming':
      default:
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    }
  };

  const hasEmergencyShift = day.emergencyShifts.length > 0;

  const handleDayClick = (e: React.MouseEvent) => {
    // Solo hacer clic si no es en un assignment
    if ((e.target as HTMLElement).closest('.assignment-card')) {
      return;
    }
    onDayClick(day);
  };

  const handleAssignmentClick = (assignment: MaintenanceAssignment, e: React.MouseEvent) => {
    e.stopPropagation();
    onAssignmentClick(assignment, day);
  };

  return (
    <div
      onClick={handleDayClick}
      className={`
        min-h-[120px] border-b border-r border-slate-200 p-2 cursor-pointer transition-colors
        ${!day.isCurrentMonth ? 'bg-slate-50 text-slate-400' : 'bg-white hover:bg-slate-50'}
        ${day.isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}
        ${day.isHoliday ? 'bg-purple-50' : ''}
        ${day.isWeekend && day.isCurrentMonth ? 'bg-slate-50' : ''}
        ${hasEmergencyShift && day.isCurrentMonth ? 'bg-red-50 border-red-200' : ''}
      `}
    >
      {/* Encabezado del día */}
      <div className="flex items-start justify-between mb-2">
        <span
          className={`
            text-sm font-semibold flex items-center gap-1
            ${day.isToday ? 'bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center' : ''}
            ${!day.isCurrentMonth ? 'text-slate-400' : 'text-slate-700'}
          `}
        >
          {day.day}
        </span>
        
        <div className="flex gap-1">
          {day.isHoliday && (
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
              Festivo
            </span>
          )}
          {day.isWeekend && !day.isHoliday && day.isCurrentMonth && (
            <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
              Fin de semana
            </span>
          )}
        </div>
      </div>

      {/* Lista de mantenimientos */}
      <div className="space-y-1 overflow-y-auto max-h-[90px]">
        {day.assignments.slice(0, 3).map((assignment) => (
          <div
            key={assignment.id}
            onClick={(e) => handleAssignmentClick(assignment, e)}
            className={`
              assignment-card text-xs p-1.5 rounded border cursor-pointer transition-all
              hover:shadow-md hover:scale-105
              ${getStatusColor(assignment)}
              ${assignment.is_fixed ? 'ring-1 ring-slate-400' : ''}
            `}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <Clock className="w-3 h-3" />
              <span className="font-medium truncate">
                {assignment.scheduled_time_start.slice(0, 5)}
              </span>
              {assignment.is_external ? (
                <div title="Personal externo">
                  <Users className="w-3 h-3 ml-auto" />
                </div>
              ) : (
                <div title="Técnico interno">
                  <User className="w-3 h-3 ml-auto" />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{assignment.building_name}</span>
            </div>
            
            <div className="text-[10px] truncate mt-0.5 opacity-80">
              {assignment.assigned_to}
            </div>

            {assignment.is_fixed && (
              <div className="text-[10px] font-medium mt-0.5 flex items-center gap-1">
                🔒 Bloqueado
              </div>
            )}
          </div>
        ))}

        {day.assignments.length > 3 && (
          <div className="text-xs text-center text-slate-600 bg-slate-100 rounded py-1">
            +{day.assignments.length - 3} más
          </div>
        )}
      </div>

      {day.absences.length > 0 && (
        <div className="mt-2 space-y-1">
          {day.absences.slice(0, 2).map((absence) => (
            <div
              key={absence.technicianId}
              className="text-[11px] px-2 py-1 rounded border bg-amber-50 border-amber-200 text-amber-800"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold truncate">{absence.technicianName}</span>
                <span className="text-[10px] font-semibold">Ausente</span>
              </div>
              <div className="text-[10px] truncate opacity-80">
                {absence.reasons.join(', ')}
              </div>
            </div>
          ))}
          {day.absences.length > 2 && (
            <div className="text-[10px] text-amber-700">
              +{day.absences.length - 2} ausencias
            </div>
          )}
        </div>
      )}

      {day.emergencyShifts.length > 0 && (
        <div className="mt-2 space-y-1">
          {day.emergencyShifts.slice(0, 2).map((shift) => (
            <div
              key={shift.shiftId}
              className={`text-[11px] px-2 py-1 rounded border ${
                shift.isPrimary
                  ? 'bg-red-100 border-red-300 text-red-800'
                  : 'bg-orange-100 border-orange-300 text-orange-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold truncate">{shift.assigneeName}</span>
                <span className="text-[10px] font-semibold">
                  {shift.isPrimary ? 'Emergencia' : 'Respaldo'}
                </span>
              </div>
            </div>
          ))}
          {day.emergencyShifts.length > 2 && (
            <div className="text-[10px] text-red-700">
              +{day.emergencyShifts.length - 2} turnos
            </div>
          )}
        </div>
      )}

      {/* Indicador de sin mantenimientos */}
      {day.assignments.length === 0 && day.isCurrentMonth && !day.isWeekend && !day.isHoliday && (
        <div className="text-xs text-slate-400 text-center mt-2">
          Sin mantenimientos
        </div>
      )}
    </div>
  );
}
