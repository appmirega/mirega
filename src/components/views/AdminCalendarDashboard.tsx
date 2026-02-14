import { useState, useEffect } from 'react';
import { Calendar, Lock, User, Users, Wrench, AlertCircle, Plus, Shield } from 'lucide-react';
import { EmergencyShiftScheduler } from '../calendar/EmergencyShiftScheduler';
import { supabase } from '../../lib/supabase';
export function AdminCalendarDashboard() {
    // Estado para mostrar el modal de turnos de emergencia
    const [showEmergencyShifts, setShowEmergencyShifts] = useState(false);
  // Estado para mes/año actual
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  // Listas de técnicos y edificios
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [edificios, setEdificios] = useState<any[]>([]);
  // Estado para vista de repetición (mensual, semestral, anual)
  const [repeatMode, setRepeatMode] = useState<'mensual'|'semestral'|'anual'>('mensual');
  // Estado para modal de detalle
  const [selectedDay, setSelectedDay] = useState<Date|null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventType, setEventType] = useState('turno');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState<string>('');
  const [eventPerson, setEventPerson] = useState('');

  // Simulación de consulta a Supabase (luego se reemplazará por la real)
  const [feriados, setFeriados] = useState<string[]>([]);
  const [feriadosIrrenunciables, setFeriadosIrrenunciables] = useState<string[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Cargar técnicos y edificios al montar
  useEffect(() => {
    let mounted = true;
    supabase.from('profiles').select('id, full_name').eq('role', 'technician').then(({ data }) => {
      if (mounted) setTecnicos(data || []);
    });
    supabase.from('clients').select('id, company_name, address').then(({ data }) => {
      if (mounted) setEdificios(data || []);
    });
    return () => { mounted = false; };
  }, []);

  // Cargar todos los eventos relevantes desde Supabase
  useEffect(() => {
    setLoading(true);
    setError('');
    const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`;
    // Mantenimientos
    const maintPromise = supabase
      .from('maintenance_schedules')
      .select('id, building_name, building_address, created_at, client_id, created_by')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    // Emergencias
    const emergPromise = supabase
      .from('emergency_visits')
      .select('id, attended_at, status, building_name, assigned_technician_id')
      .gte('attended_at', startDate)
      .lte('attended_at', endDate);
    // Órdenes de trabajo
    const otPromise = supabase
      .from('work_orders')
      .select('id, scheduled_date, status, title as building_name, assigned_technician_id')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate);
    // Permisos/vacaciones
    const leavesPromise = supabase
      .from('technician_leaves')
      .select('id, leave_type, start_date, end_date, status, technician_id')
      .eq('status', 'aprobado')
      .gte('end_date', startDate)
      .lte('start_date', endDate);
    // Eventos externos
    const extPromise = supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', startDate)
      .lte('event_date', endDate);
    Promise.all([maintPromise, emergPromise, otPromise, leavesPromise, extPromise])
      .then(([maint, emerg, ot, leaves, ext]) => {
        let allEvents: any[] = [];
        if (maint.data) allEvents = allEvents.concat(maint.data.map((m: any) => ({
          ...m,
          type: 'mantenimiento',
          date: m.created_at ? m.created_at.slice(0,10) : '',
          building_name: m.building_name,
          building_address: m.building_address
        })));
        if (emerg.data) allEvents = allEvents.concat(emerg.data.map((e: any) => ({...e, type: 'emergencia', date: e.attended_at })));
        if (ot.data) allEvents = allEvents.concat(ot.data.map((o: any) => ({
          id: o.id,
          status: o.status,
          building_name: o["title as building_name"],
          assigned_technician_id: o.assigned_technician_id,
          type: 'ot',
          date: o.scheduled_date
        })));
        if (leaves.data) leaves.data.forEach(lv => {
          // Generar un evento por cada día de permiso/vacaciones
          let d = new Date(lv.start_date);
          const end = new Date(lv.end_date);
          while (d <= end) {
            allEvents.push({
              id: lv.id,
              type: lv.leave_type,
              date: d.toISOString().slice(0,10),
              status: 'aprobado',
              technician_id: lv.technician_id
            });
            d.setDate(d.getDate() + 1);
          }
        });
        if (ext.data) allEvents = allEvents.concat(ext.data.map(ev => ({...ev, type: ev.event_type, date: ev.event_date })));
        setEventos(allEvents);
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar eventos');
        setEventos([]);
        setLoading(false);
      });
  }, [currentMonth, currentYear]);

  useEffect(() => {
    setLoading(true);
    setError('');
    // Simulación: después se reemplazará por consulta real a Supabase
    setTimeout(() => {
      setEventos([]); // Aquí se cargarán los eventos reales
      setFeriados([]); // Aquí se cargarán los feriados reales
      setFeriadosIrrenunciables([]); // Aquí se cargarán los feriados irrenunciables reales
      setLoading(false);
    }, 500);
  }, [currentMonth, currentYear, repeatMode]);

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
          <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2" onClick={() => setShowEventModal(true)}><Plus className="w-4 h-4" /> Nuevo Evento</button>
          <button className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2" onClick={() => setShowEmergencyShifts(true)}><Shield className="w-4 h-4" /> Turnos de Emergencia</button>
        </div>
      </div>
            {/* Modal Turnos de Emergencia */}
            {showEmergencyShifts && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl w-full relative">
                  <button onClick={() => setShowEmergencyShifts(false)} className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-2xl">✕</button>
                  <EmergencyShiftScheduler />
                </div>
              </div>
            )}
      <div className="grid grid-cols-7 gap-1 bg-gray-100 rounded-t">
        {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d => <div key={d} className="text-center font-semibold py-2">{d}</div>)}
      </div>
      {loading ? (
        <div className="text-center py-8 text-blue-600">Cargando eventos...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : weeks.map((week, i) => (
        <div key={i} className="grid grid-cols-7 gap-1">
          {week.map((date, j) => {
            const dateStr = date ? date.toISOString().slice(0,10) : '';
            const isFeriado = feriados.includes(dateStr);
            const isFeriadoIrr = feriadosIrrenunciables.includes(dateStr);
            const dayEvents = eventos.filter((ev: any) => ev.date === dateStr);
            return (
              <div key={j} className={`min-h-[80px] border rounded p-1 relative ${isFeriadoIrr ? 'bg-red-200' : isFeriado ? 'bg-yellow-100' : 'bg-white'}`}
                onClick={() => date && setSelectedDay(date)}>
                <div className="text-xs text-gray-500 text-right">{date?.getDate() || ''}</div>
                {dayEvents.length === 0 && <div className="text-xs text-gray-400 text-center mt-2">Sin eventos</div>}
                {dayEvents.map((ev: any, idx: number) => (
                  <div key={idx} className={`flex items-center gap-1 text-xs mt-1 px-1 py-0.5 rounded 
                    ${ev.type === 'mantenimiento' ? 'bg-blue-100 text-blue-800' :
                      ev.type === 'emergencia' ? 'bg-red-100 text-red-800' :
                      ev.type === 'ot' ? 'bg-green-100 text-green-800' :
                      (ev.type === 'vacaciones' || ev.type === 'permiso') ? 'bg-yellow-200 text-yellow-900 font-bold' :
                      'bg-gray-100 text-gray-800'}`}
                  >
                    {ev.type === 'mantenimiento' && <Wrench className="w-3 h-3" />}
                    {ev.type === 'emergencia' && <AlertCircle className="w-3 h-3" />}
                    {ev.type === 'ot' && <Lock className="w-3 h-3" />}
                    {(ev.type === 'vacaciones' || ev.type === 'permiso') && <User className="w-3 h-3" />}
                    {ev.type === 'externo' && <Users className="w-3 h-3" />}
                    <span>{ev.building_name || ev.person || ''}</span>
                    {ev.status === 'completado' && <Lock className="w-3 h-3 ml-1" />}
                  </div>
                ))}
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
            <div className="mb-2">(Aquí se mostrarán y gestionarán los eventos del día, asignaciones, ausencias, etc)</div>
            <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded" onClick={() => { setShowEventModal(true); setEventDate(selectedDay.toISOString().slice(0,10)); }}>Agregar/Editar Evento</button>
          </div>
        </div>
      )}

      {/* Modal para crear/editar evento admin */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 min-w-[320px]">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">Nuevo Evento de Calendario</h2>
              <button onClick={() => setShowEventModal(false)} className="text-gray-500 hover:text-red-600">✕</button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              setLoading(true);
              const { error } = await supabase.from('calendar_events').insert([
                {
                  event_type: eventType,
                  event_date: eventDate,
                  person: eventPerson,
                  description: eventDesc,
                  created_by: null // Puedes agregar el id del usuario si lo tienes
                }
              ]);
              if (error) setError(error.message);
              else {
                setShowEventModal(false);
                setEventType('turno');
                setEventDate('');
                setEventPerson('');
                setEventDesc('');
                // Refrescar eventos
                const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
                const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`;
                const { data } = await supabase
                  .from('calendar_events')
                  .select('*')
                  .gte('event_date', startDate)
                  .lte('event_date', endDate)
                  .order('event_date', { ascending: true });
                setEventos(data || []);
              }
              setLoading(false);
            }}>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Tipo de evento</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} className="border rounded px-2 py-1 w-full">
                  <option value="turno">Turno Técnico</option>
                  <option value="emergencia">Emergencia</option>
                  <option value="personal">Personal Adicional</option>
                  <option value="vacaciones">Vacaciones</option>
                  <option value="externo">Servicio Externo</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Fecha</label>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="border rounded px-2 py-1 w-full" required />
              </div>
              {/* Selección de técnico */}
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Técnico asignado</label>
                <select value={eventPerson} onChange={e => setEventPerson(e.target.value)} className="border rounded px-2 py-1 w-full" required>
                  <option value="">Selecciona un técnico</option>
                  {tecnicos.map((t: any) => (
                    <option key={t.id} value={t.full_name}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              {/* Selección de edificio */}
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Edificio/Cliente</label>
                <select className="border rounded px-2 py-1 w-full">
                  <option value="">Selecciona un edificio</option>
                  {edificios.map((e: any) => (
                    <option key={e.id} value={e.company_name}>{e.company_name} - {e.address}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Descripción</label>
                <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} className="border rounded px-2 py-1 w-full" rows={3} required />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded mt-2 w-full">Guardar Evento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
