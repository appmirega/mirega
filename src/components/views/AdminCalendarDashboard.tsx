// Commit de prueba para forzar build limpio en Vercel
import { useState, useEffect } from 'react';
import { getExternalTechnicians, addExternalTechnician } from '../../lib/external_technicians';
import { Calendar, Plus, Shield } from 'lucide-react';
import { EmergencyShiftScheduler } from '../calendar/EmergencyShiftScheduler';
import { ProfessionalBreakdown } from './ProfessionalBreakdown';
import { EmergencyShiftsTable } from './EmergencyShiftsTable';
import { supabase } from '../../lib/supabase';
export function AdminCalendarDashboard() {
    // Función para mapear el tipo de asignación
    const getTypeLabel = (type: string) => {
      const labels: Record<string, string> = {
        preventive: 'Preventivo',
        corrective: 'Correctivo',
        emergency: 'Emergencia',
        mantenimiento: 'Mantenimiento',
        reparaciones: 'Reparaciones',
        induccion_rescate: 'Inducción de rescate',
        vista_certificacion: 'Vista certificación',
        otros: 'Otros',
      };
      return labels[type] || type;
    };

    // Refrescar eventos manualmente
    const fetchEventos = () => {
      setLoading(true);
      setError('');
      const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`;
      const maintPromise = supabase
        .from('maintenance_schedules')
        .select('id, elevator_id, assigned_technician_id, maintenance_type, scheduled_date, status, created_at')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);
      const emergPromise = supabase
        .from('emergency_visits')
        .select('id, attended_at, status, elevator_id, assigned_technician_id, client_id')
        .gte('attended_at', startDate)
        .lte('attended_at', endDate);
      const otPromise = supabase
        .from('work_orders')
        .select('id, order_number, elevator_id, client_id, order_type, title, assigned_technician_id, scheduled_date, status')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);
      const emergencyPromise = supabase
        .from('emergency_shifts')
        .select('*')
        .gte('shift_start_date', startDate)
        .lte('shift_end_date', endDate);
      // Consulta eventos de calendario personalizados
      const calendarPromise = supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', startDate)
        .lte('event_date', endDate);

      Promise.all([maintPromise, emergPromise, otPromise, emergencyPromise, calendarPromise])
        .then(([maint, emerg, ot, emergency, calendar]) => {
          let allEvents: any[] = [];
          const getTechnicianName = (id: string) => {
            const tech = tecnicos.find(t => t.id === id);
            return tech ? tech.full_name : id;
          };
          if (maint.data) allEvents = allEvents.concat(maint.data.map((m: any) => ({
            ...m,
            type: getTypeLabel(m.maintenance_type),
            date: m.scheduled_date,
            assignee: getTechnicianName(m.assigned_technician_id)
          })));
          if (emerg.data) allEvents = allEvents.concat(emerg.data.map((e: any) => ({
            ...e,
            type: 'emergencia',
            date: e.attended_at,
            assignee: getTechnicianName(e.assigned_technician_id)
          })));
          if (ot.data) allEvents = allEvents.concat(ot.data.map((o: any) => ({
            id: o.id,
            status: o.status,
            order_type: o.order_type,
            title: o.title,
            date: o.scheduled_date,
            assignee: getTechnicianName(o.assigned_technician_id)
          })));
          // Mapear turnos de emergencia: un evento por cada día del rango
          if (emergency.data) {
            emergency.data.forEach((shift: any) => {
              // Manejo local de fechas para evitar desfase por zona horaria
              let [sy, sm, sd] = shift.shift_start_date.split('-').map(Number);
              let [ey, em, ed] = shift.shift_end_date.split('-').map(Number);
              let d = new Date(sy, sm - 1, sd);
              const end = new Date(ey, em - 1, ed);
              while (d <= end) {
                allEvents.push({
                  id: shift.id,
                  type: 'turno_emergencia',
                  date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                  shift,
                  assignee: shift.external_personnel_name ? shift.external_personnel_name : getTechnicianName(shift.technician_id),
                  is_primary: shift.is_primary,
                  shift_hours: shift.is_24h_shift ? '24h' : `${shift.shift_start_time?.slice(0,5)}-${shift.shift_end_time?.slice(0,5)}`
                });
                d.setDate(d.getDate() + 1);
              }
            });
          }
          // Mapear eventos de calendar_events
          if (calendar.data) allEvents = allEvents.concat(calendar.data.map((ev: any) => ({
            ...ev,
            type: ev.event_type || 'evento',
            date: ev.event_date,
            assignee: ev.person,
            building_name: ev.building_name,
            description: ev.description
          })));
          setEventos(allEvents);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error real al cargar eventos:', err);
          setError('Error al cargar eventos');
          setEventos([]);
          setLoading(false);
        });
    };
  const [externalTechnicians, setExternalTechnicians] = useState<any[]>([]);
  const [newExternalName, setNewExternalName] = useState('');
  const [showExternalInput, setShowExternalInput] = useState(false);
  // Estado para mostrar el modal de turnos de emergencia
  const [showEmergencyShifts, setShowEmergencyShifts] = useState(false);
  // Estado para mes/año actual
  const [currentMonth] = useState<number>(new Date().getMonth());
  const [currentYear] = useState<number>(new Date().getFullYear());
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
  const [eventBuilding, setEventBuilding] = useState('');

  // Simulación de consulta a Supabase (luego se reemplazará por la real)
  const [feriados, setFeriados] = useState<string[]>([]);
  const [feriadosIrrenunciables, setFeriadosIrrenunciables] = useState<string[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Cargar técnicos, externos y edificios al montar
  useEffect(() => {
    let mounted = true;
    supabase.from('profiles').select('id, full_name').eq('role', 'technician').then(({ data }) => {
              // Los errores se muestran dentro del .then, no fuera de la cadena de promesas
      if (mounted) setTecnicos(data || []);
    });
    supabase.from('clients').select('id, company_name, address').then(({ data }) => {
      if (mounted) setEdificios(data || []);
    });
    if (mounted) setExternalTechnicians(getExternalTechnicians());
    return () => { mounted = false; };
  }, []);

  // Cargar todos los eventos relevantes desde Supabase SOLO cuando los técnicos estén listos
  useEffect(() => {
    if (tecnicos.length > 0) {
      fetchEventos();
    }
  }, [tecnicos, currentMonth, currentYear]);

  // Escuchar eventos personalizados para refrescar (asignaciones y turnos de emergencia)
  useEffect(() => {
    const handler = () => fetchEventos();
    window.addEventListener('asignacion-eliminada', handler);
    window.addEventListener('turno-emergencia-actualizado', handler);
    return () => {
      window.removeEventListener('asignacion-eliminada', handler);
      window.removeEventListener('turno-emergencia-actualizado', handler);
    };
  }, []);



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
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6" /> Calendario mensual</h1>
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
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-auto">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl w-full relative max-h-[90vh] overflow-y-auto">
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
            const dateStr = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
            const isFeriado = feriados.includes(dateStr);
            const isFeriadoIrr = feriadosIrrenunciables.includes(dateStr);
            const dayEvents = eventos.filter((ev: any) => ev.date === dateStr);
            // Colorear turno de emergencia: rojo interno, naranjo externo
            let bgColor = isFeriadoIrr ? 'bg-red-200' : isFeriado ? 'bg-yellow-100' : 'bg-white';
            const hasEmergInt = dayEvents.some(ev => ev.type === 'turno_emergencia' && !ev.shift?.is_external);
            const hasEmergExt = dayEvents.some(ev => ev.type === 'turno_emergencia' && ev.shift?.is_external);
            if (hasEmergInt) bgColor = 'bg-red-300';
            else if (hasEmergExt) bgColor = 'bg-orange-200';
            return (
              <div key={j} className={`min-h-[80px] border rounded p-1 relative ${bgColor}`}
                onClick={() => date && setSelectedDay(date)}>
                <div className="text-xs text-gray-500 text-right">{date?.getDate() || ''}</div>
                {dayEvents.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center mt-2">Sin asignaciones</div>
                ) : (
                  <div className="flex flex-col items-center justify-center mt-2">
                    <span className="text-xs font-semibold text-blue-700">{dayEvents.length} asignación{dayEvents.length > 1 ? 'es' : ''}</span>
                  </div>
                )}
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
              <h2 className="text-lg font-bold">Detalle {selectedDay ? `${selectedDay.getDate()}/${selectedDay.getMonth()+1}/${selectedDay.getFullYear()}` : ''}</h2>
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
                  building_name: eventBuilding,
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
                setEventBuilding('');
                fetchEventos();
              }
              setLoading(false);
            }}>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Tipo de asignación</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} className="border rounded px-2 py-1 w-full">
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="reparaciones">Reparaciones</option>
                  <option value="induccion_rescate">Inducción de rescate</option>
                  <option value="vista_certificacion">Vista certificación</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Fecha</label>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="border rounded px-2 py-1 w-full" required />
              </div>
              {/* Selección de técnico interno o externo/empresa */}
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Asignar a</label>
                <select value={eventPerson} onChange={e => {
                  if (e.target.value === '__nuevo_externo__') {
                    setShowExternalInput(true);
                    setEventPerson('');
                  } else {
                    setShowExternalInput(false);
                    setEventPerson(e.target.value);
                  }
                }} className="border rounded px-2 py-1 w-full" required>
                  <option value="">Selecciona técnico interno o empresa externa</option>
                  {tecnicos.map((t: any) => (
                    <option key={t.id} value={t.full_name}>{t.full_name} (Interno)</option>
                  ))}
                  {externalTechnicians.length > 0 && <option disabled>──────────</option>}
                  {externalTechnicians.map((ext: any) => (
                    <option key={ext.id} value={ext.name}>{ext.name} (Externo)</option>
                  ))}
                  <option disabled>──────────</option>
                  <option value="__nuevo_externo__">Agregar nuevo externo/empresa…</option>
                </select>
                {showExternalInput && (
                  <div className="flex gap-2 mt-2">
                    <input type="text" className="border rounded px-2 py-1 w-full" placeholder="Nombre externo/empresa" value={newExternalName} onChange={e => setNewExternalName(e.target.value)} />
                    <button type="button" className="bg-green-600 text-white px-3 py-1 rounded" onClick={() => {
                      if (newExternalName.trim()) {
                        const ext = addExternalTechnician({ name: newExternalName.trim() });
                        setExternalTechnicians(getExternalTechnicians());
                        setEventPerson(ext.name);
                        setShowExternalInput(false);
                        setNewExternalName('');
                      }
                    }}>Guardar</button>
                  </div>
                )}
              </div>
              {/* Selección de edificio */}
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Edificio</label>
                <select className="border rounded px-2 py-1 w-full" required value={eventBuilding} onChange={e => setEventBuilding(e.target.value)}>
                  <option value="">Selecciona un edificio</option>
                  {edificios.map((e: any) => (
                    <option key={e.id} value={e.company_name}>{e.company_name} - {e.address}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Detalle</label>
                <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} className="border rounded px-2 py-1 w-full" rows={3} required />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded mt-2 w-full">Guardar Evento</button>
            </form>
          </div>
        </div>
      )}
      {/* Desglose profesional debajo del calendario */}
      <div className="mt-8">
        <ProfessionalBreakdown
          events={eventos.filter(ev => ev.type !== 'turno_emergencia')}
          selectedMonth={currentMonth}
          selectedYear={currentYear}
        />
        <EmergencyShiftsTable
          shifts={eventos.filter(ev => ev.type === 'turno_emergencia').map(ev => ev.shift || ev)}
          tecnicos={tecnicos}
        />
      </div>
      {/* Zona para validar solicitudes */}
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4">Validación de Solicitudes</h2>
        <div className="bg-white border rounded shadow p-4">
          <p className="mb-2 text-gray-700">Aquí aparecerán las solicitudes pendientes para validar, aprobar o rechazar.</p>
          {/* Aquí puedes mapear solicitudes reales si existen */}
          <div className="text-gray-400">(Funcionalidad en desarrollo)</div>
        </div>
      </div>
    </div>
  );
}
