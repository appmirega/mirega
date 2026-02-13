import { useState } from 'react';
import { Calendar, Lock, User, Users, Wrench, AlertCircle, Plus } from 'lucide-react';

// Estructura base para el dashboard calendario admin
export function AdminCalendarDashboard() {
  // Estado para mes/año actual
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  // Estado para vista de repetición (mensual, semestral, anual)
  const [repeatMode, setRepeatMode] = useState<'mensual'|'semestral'|'anual'>('mensual');
  // Estado para modal de detalle
  const [selectedDay, setSelectedDay] = useState<Date|null>(null);

  // Placeholder: feriados y feriados irrenunciables de Chile (pueden venir de API)
  const feriados = [
    '2026-01-01', '2026-05-01', '2026-09-18', '2026-09-19', '2026-12-25' // etc
  ];
  const feriadosIrrenunciables = [
    '2026-01-01', '2026-05-01', '2026-09-18', '2026-12-25' // etc
  ];

  // Placeholder: eventos del mes (mantenimientos, turnos, vacaciones, etc)
  const eventos = [
    { date: '2026-02-12', type: 'mantenimiento', tecnico: 'Juan', inamovible: true },
    { date: '2026-02-13', type: 'vacaciones', tecnico: 'Pedro', inamovible: false },
    { date: '2026-02-14', type: 'emergencia', tecnico: 'Ana', inamovible: false },
    { date: '2026-02-15', type: 'externo', tecnico: 'EmpresaX', inamovible: false },
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

  // Render
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6" /> Calendario Técnico - Admin</h1>
        <div className="flex gap-2">
          <select value={repeatMode} onChange={e => setRepeatMode(e.target.value as any)} className="border rounded px-2 py-1">
            <option value="mensual">Mensual</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
          <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Evento</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 bg-gray-100 rounded-t">
        {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d => <div key={d} className="text-center font-semibold py-2">{d}</div>)}
      </div>
      {weeks.map((week, i) => (
        <div key={i} className="grid grid-cols-7 gap-1">
          {week.map((date, j) => {
            const dateStr = date ? date.toISOString().slice(0,10) : '';
            const isFeriado = feriados.includes(dateStr);
            const isFeriadoIrr = feriadosIrrenunciables.includes(dateStr);
            const dayEvents = eventos.filter(ev => ev.date === dateStr);
            return (
              <div key={j} className={`min-h-[80px] border rounded p-1 relative ${isFeriadoIrr ? 'bg-red-200' : isFeriado ? 'bg-yellow-100' : 'bg-white'}`}
                onClick={() => date && setSelectedDay(date)}>
                <div className="text-xs text-gray-500 text-right">{date?.getDate() || ''}</div>
                {dayEvents.map((ev, idx) => (
                  <div key={idx} className={`flex items-center gap-1 text-xs mt-1 px-1 py-0.5 rounded ${ev.inamovible ? 'bg-gray-800 text-white' : 'bg-blue-100 text-blue-800'}`}>
                    {ev.type === 'mantenimiento' && <Wrench className="w-3 h-3" />}
                    {ev.type === 'vacaciones' && <User className="w-3 h-3" />}
                    {ev.type === 'emergencia' && <AlertCircle className="w-3 h-3" />}
                    {ev.type === 'externo' && <Users className="w-3 h-3" />}
                    {ev.tecnico}
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
            <div className="mb-2">(Aquí se mostrarán y gestionarán los eventos del día, asignaciones, ausencias, etc)</div>
            <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">Agregar/Editar Evento</button>
          </div>
        </div>
      )}
    </div>
  );
}
