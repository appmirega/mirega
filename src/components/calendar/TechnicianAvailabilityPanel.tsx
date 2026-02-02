import { useState } from 'react';
import { Users, UserCheck, UserX, AlertCircle, Calendar, Phone, Mail, Shield } from 'lucide-react';

interface Technician {
  technician_id: string;
  full_name: string;
  phone: string;
  email: string;
  is_on_leave: boolean;
  assignments_today: number;
  emergency_shift_type?: string;
}

interface TechnicianAvailabilityPanelProps {
  technicians: Technician[];
  currentDate: Date;
  onRefresh: () => void;
  absences?: Map<string, Map<string, string[]>>;
}

export function TechnicianAvailabilityPanel({
  technicians,
  currentDate,
  onRefresh,
  absences
}: TechnicianAvailabilityPanelProps) {
  const [expandedTech, setExpandedTech] = useState<string | null>(null);

  const todayStr = currentDate.toISOString().split('T')[0];
  const todayAbsences = absences?.get(todayStr) || new Map<string, string[]>();

  const availableTechnicians = technicians.filter(t => !t.is_on_leave);
  const unavailableTechnicians = technicians.filter(t => t.is_on_leave);
  const onEmergencyShift = technicians.filter(t => t.emergency_shift_type);

  const getTechnicianStatusColor = (tech: Technician) => {
    if (tech.is_on_leave) return 'text-red-600 bg-red-50';
    if (tech.emergency_shift_type === 'primary') return 'text-blue-600 bg-blue-50';
    if (tech.emergency_shift_type === 'backup') return 'text-cyan-600 bg-cyan-50';
    if (tech.assignments_today === 0) return 'text-green-600 bg-green-50';
    if (tech.assignments_today >= 3) return 'text-orange-600 bg-orange-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  const getTechnicianStatusText = (tech: Technician) => {
    if (tech.is_on_leave) return 'De permiso';
    if (tech.assignments_today === 0) return 'Disponible';
    return `${tech.assignments_today} asignación${tech.assignments_today > 1 ? 'es' : ''}`;
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Técnicos
          </h3>
          <button
            onClick={onRefresh}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Actualizar
          </button>
        </div>
        <p className="text-xs text-slate-600">
          {currentDate.toLocaleDateString('es-CL', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Estadísticas rápidas */}
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-green-600" />
              <span className="text-xs text-slate-600">Disponibles</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{availableTechnicians.length}</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <UserX className="w-4 h-4 text-red-600" />
              <span className="text-xs text-slate-600">De permiso</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{unavailableTechnicians.length}</p>
          </div>
        </div>
      </div>

      {/* Turno de emergencia */}
      {onEmergencyShift.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">Turno de Emergencia</h4>
          </div>
          <div className="space-y-2">
            {onEmergencyShift.map(tech => (
              <div key={tech.technician_id} className="bg-white p-2 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{tech.full_name}</p>
                    <p className="text-xs text-slate-600">
                      {tech.emergency_shift_type === 'primary' ? '🔵 Principal' : '🔹 Respaldo'}
                    </p>
                  </div>
                  {tech.emergency_shift_type === 'primary' && (
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de técnicos disponibles */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Técnicos Disponibles ({availableTechnicians.length})
          </h4>
          <div className="space-y-2">
            {availableTechnicians.map(tech => (
              <div
                key={tech.technician_id}
                className="border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setExpandedTech(
                    expandedTech === tech.technician_id ? null : tech.technician_id
                  )}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 text-sm">{tech.full_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getTechnicianStatusColor(tech)}`}>
                          {getTechnicianStatusText(tech)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-600">
                        Hoy
                      </div>
                      <div className="text-lg font-bold text-slate-900">
                        {tech.assignments_today}
                      </div>
                    </div>
                  </div>
                </button>

                {expandedTech === tech.technician_id && (
                  <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-2">
                    {todayAbsences.has(tech.technician_id) && (
                      <div className="bg-orange-50 border border-orange-200 rounded p-2">
                        <p className="text-xs font-semibold text-orange-800 mb-1">🚫 En licencia hoy:</p>
                        <p className="text-xs text-orange-700">
                          {todayAbsences.get(tech.technician_id)?.join(', ')}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Phone className="w-3 h-3" />
                      <a href={`tel:${tech.phone}`} className="hover:text-blue-600">
                        {tech.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Mail className="w-3 h-3" />
                      <a href={`mailto:${tech.email}`} className="hover:text-blue-600 truncate">
                        {tech.email}
                      </a>
                    </div>
                    {tech.emergency_shift_type && (
                      <div className="flex items-center gap-2 text-xs">
                        <Shield className="w-3 h-3 text-blue-600" />
                        <span className="text-blue-600 font-medium">
                          En turno de emergencia ({tech.emergency_shift_type})
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {availableTechnicians.length === 0 && (
              <div className="text-center py-6 text-slate-500">
                <UserX className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm">No hay técnicos disponibles</p>
              </div>
            )}
          </div>
        </div>

        {/* Lista de técnicos no disponibles */}
        {unavailableTechnicians.length > 0 && (
          <div className="p-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <UserX className="w-4 h-4" />
              De Permiso / Vacaciones ({unavailableTechnicians.length})
            </h4>
            <div className="space-y-2">
              {unavailableTechnicians.map(tech => (
                <div
                  key={tech.technician_id}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <p className="font-medium text-slate-900 text-sm">{tech.full_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-3 h-3 text-red-600" />
                    <span className="text-xs text-red-600">No disponible hoy</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer con leyenda */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <p className="text-xs text-slate-600 mb-2 font-medium">Leyenda:</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-600">Sin asignaciones</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-slate-600">1-2 asignaciones</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-slate-600">3+ asignaciones (alta carga)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-slate-600">Turno emergencia principal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
            <span className="text-slate-600">Turno emergencia respaldo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
