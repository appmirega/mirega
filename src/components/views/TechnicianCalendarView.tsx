import { useState } from 'react';
import { Calendar, Wrench, AlertCircle, User, Lock } from 'lucide-react';

// Vista simplificada para técnicos: solo sus asignaciones y solicitudes
export function TechnicianCalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<Date|null>(null);

  // Placeholder: asignaciones y solicitudes del técnico
  const misEventos = [
    { date: '2026-02-12', type: 'mantenimiento', inamovible: true },
    { date: '2026-02-13', type: 'vacaciones', inamovible: false },
    { date: '2026-02-14', type: 'emergencia', inamovible: false },
  ];

  // Generar matriz de días del mes
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const weeks: (Date|null)[][] = [];
  let week: (Date|null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(currentYear, currentMonth, d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) weeks.push([...week, ...Array(7 - week.length).fill(null)]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6" /> Mi Calendario Técnico</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">Solicitar Permiso/Vacaciones</button>
      </div>
      <div className="grid grid-cols-7 gap-1 bg-gray-100 rounded-t">
        {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d => <div key={d} className="text-center font-semibold py-2">{d}</div>)}
      </div>
      {weeks.map((week, i) => (
        <div key={i} className="grid grid-cols-7 gap-1">
          {week.map((date, j) => {
            const dateStr = date ? date.toISOString().slice(0,10) : '';
            const dayEvents = misEventos.filter(ev => ev.date === dateStr);
            return (
              <div key={j} className={`min-h-[80px] border rounded p-1 relative bg-white`}
                onClick={() => date && setSelectedDay(date)}>
                <div className="text-xs text-gray-500 text-right">{date?.getDate() || ''}</div>
                {dayEvents.map((ev, idx) => (
                  <div key={idx} className={`flex items-center gap-1 text-xs mt-1 px-1 py-0.5 rounded ${ev.inamovible ? 'bg-gray-800 text-white' : 'bg-blue-100 text-blue-800'}`}>
                    {ev.type === 'mantenimiento' && <Wrench className="w-3 h-3" />}
                    {ev.type === 'vacaciones' && <User className="w-3 h-3" />}
                    {ev.type === 'emergencia' && <AlertCircle className="w-3 h-3" />}
                    {ev.inamovible && <Lock className="w-3 h-3 ml-1" title="Inamovible" />}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
      {/* Modal de detalle por día (placeholder) */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 min-w-[320px]">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">Detalle {selectedDay.toLocaleDateString()}</h2>
              <button onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-red-600">✕</button>
            </div>
            <div className="mb-2">(Aquí se mostrarán tus asignaciones, solicitudes y podrás pedir cambios o permisos)</div>
            <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">Solicitar Cambio/Aplazamiento</button>
          </div>
        </div>
      )}
    </div>
  );
}
