import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, Users, AlertTriangle, Phone } from 'lucide-react';

interface EmergencyShift {
  id: string;
  technician_name: string;
  technician_phone: string;
  external_personnel_name: string;
  external_personnel_phone: string;
  shift_start_date: string;
  shift_end_date: string;
  shift_start_time: string;
  shift_end_time: string;
  is_24h_shift: boolean;
  is_primary: boolean;
  week_number: number;
}

interface EmergencyShiftsMonthlyViewProps {
  targetMonth: string; // YYYY-MM
}

export function EmergencyShiftsMonthlyView({ targetMonth }: EmergencyShiftsMonthlyViewProps) {
  const [shifts, setShifts] = useState<EmergencyShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShifts();
  }, [targetMonth]);

  const loadShifts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_monthly_emergency_shifts', {
        target_month: targetMonth
      });

      if (error) throw error;

      setShifts(data || []);
    } catch (error) {
      console.error('Error loading monthly shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getShiftHours = (shift: EmergencyShift) => {
    if (shift.is_24h_shift) {
      return '24h completo';
    }
    return `${shift.shift_start_time?.substring(0, 5) || '00:00'} - ${shift.shift_end_time?.substring(0, 5) || '23:59'}`;
  };

  const getAssigneeName = (shift: EmergencyShift) => {
    return shift.technician_name || shift.external_personnel_name || 'Sin asignar';
  };

  const getAssigneeType = (shift: EmergencyShift) => {
    return shift.technician_name ? 'Interno' : 'Externo';
  };

  const getContactPhone = (shift: EmergencyShift) => {
    return shift.technician_phone || shift.external_personnel_phone || 'N/A';
  };

  const groupShiftsByWeek = () => {
    const grouped: { [key: string]: EmergencyShift[] } = {};
    
    shifts.forEach(shift => {
      const startDate = new Date(shift.shift_start_date);
      const endDate = new Date(shift.shift_end_date);
      const weekKey = `${startDate.toLocaleDateString('es-CL')} - ${endDate.toLocaleDateString('es-CL')}`;
      
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(shift);
    });
    
    return grouped;
  };

  const weekGroups = groupShiftsByWeek();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex items-center gap-3 text-orange-800">
          <AlertTriangle className="w-6 h-6" />
          <div>
            <p className="font-semibold">No hay turnos de emergencia programados</p>
            <p className="text-sm">Asigna turnos con el botón "Turnos de Emergencia" del calendario</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="bg-red-50 border-b border-red-200 px-6 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-red-900">
            Turnos de Emergencia - {new Date(targetMonth + '-01').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {Object.entries(weekGroups).map(([weekRange, weekShifts]) => (
          <div key={weekRange} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-slate-600" />
              <h4 className="font-semibold text-slate-900">{weekRange}</h4>
            </div>

            <div className="grid gap-3">
              {weekShifts
                .sort((a, b) => {
                  // Primarios primero
                  if (a.is_primary && !b.is_primary) return -1;
                  if (!a.is_primary && b.is_primary) return 1;
                  // Luego por horario
                  if (a.is_24h_shift && !b.is_24h_shift) return -1;
                  if (!a.is_24h_shift && b.is_24h_shift) return 1;
                  return 0;
                })
                .map(shift => (
                  <div
                    key={shift.id}
                    className={`border-l-4 rounded-lg p-3 ${
                      shift.is_primary
                        ? 'border-red-500 bg-red-50'
                        : 'border-orange-400 bg-orange-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-slate-600" />
                          <span className="font-semibold text-slate-900">
                            {getAssigneeName(shift)}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-semibold bg-slate-200 text-slate-700 rounded">
                            {getAssigneeType(shift)}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              shift.is_primary
                                ? 'bg-red-100 text-red-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {shift.is_primary ? 'Principal' : 'Respaldo'}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="font-medium">{getShiftHours(shift)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{getContactPhone(shift)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border-t border-slate-200 px-6 py-3">
        <div className="flex items-center gap-6 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-l-4 border-red-500 bg-red-50"></div>
            <span>Turno Principal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-l-4 border-orange-400 bg-orange-50"></div>
            <span>Turno Respaldo</span>
          </div>
          <div className="flex-1 text-right">
            <span>Los turnos se muestran ordenados por prioridad y horario</span>
          </div>
        </div>
      </div>
    </div>
  );
}
