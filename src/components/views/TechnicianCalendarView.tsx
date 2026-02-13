import { useState } from 'react';
import { Calendar, Wrench, AlertCircle, User, Lock } from 'lucide-react';

// Vista simplificada para técnicos: solo sus asignaciones y solicitudes
export function TechnicianCalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<Date|null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventType, setEventType] = useState('permiso');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState<string>('');

  // Aquí se consultarán los eventos reales desde Supabase
  const misEventos = [];

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
        <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2" onClick={() => setShowEventModal(true)}>Solicitar Permiso/Vacaciones</button>
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
                {dayEvents.length === 0 && <div className="text-xs text-gray-400 text-center mt-2">Sin eventos</div>}
                {/* Aquí se mostrarán los eventos reales */}
              </div>
            );
          })}
        </div>
      ))}
      {/* Modal de detalle por día */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 min-w-[320px]">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">Detalle {selectedDay.toLocaleDateString()}</h2>
              <button onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-red-600">✕</button>
            </div>
            <div className="mb-2">(Aquí se mostrarán tus asignaciones, solicitudes y podrás pedir cambios o permisos)</div>
            <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded" onClick={() => { setShowEventModal(true); setEventDate(selectedDay.toISOString().slice(0,10)); }}>Solicitar Cambio/Aplazamiento</button>
          </div>
        </div>
      )}

      {/* Modal para crear evento */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 min-w-[320px]">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">Solicitar Permiso/Vacaciones</h2>
              <button onClick={() => setShowEventModal(false)} className="text-gray-500 hover:text-red-600">✕</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); /* Aquí se implementará la lógica para guardar el evento en Supabase */ setShowEventModal(false); }}>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Tipo de evento</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} className="border rounded px-2 py-1 w-full">
                  <option value="permiso">Permiso</option>
                  <option value="vacaciones">Vacaciones</option>
                  <option value="cambio">Cambio/Aplazamiento</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Fecha</label>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="border rounded px-2 py-1 w-full" required />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Descripción</label>
                <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} className="border rounded px-2 py-1 w-full" rows={3} required />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded mt-2 w-full">Enviar Solicitud</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
