import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

// ✅ Español FullCalendar
import esLocale from "@fullcalendar/core/locales/es";

type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end?: string; // ISO
  allDay?: boolean;
};

type ServiceRequest = {
  id: string | number;
  title?: string | null;
  status?: string | null;
  created_at?: string | null;
  client_id?: string | null;
  technician_id?: string | null;
};

type EmergencyVisit = {
  id: string | number;
  emergency_id?: string | number | null;
  visit_date?: string | null; // YYYY-MM-DD
  start_time?: string | null; // HH:mm
  end_time?: string | null;   // HH:mm
};

function startOfMonthISO(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x.toISOString().slice(0, 10); // YYYY-MM-DD
}
function endOfMonthISO(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return x.toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function AdminCalendarDashboard() {
  const [monthCursor, setMonthCursor] = useState(() => new Date());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Panel lateral (datos base)
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [emergencyVisits, setEmergencyVisits] = useState<EmergencyVisit[]>([]);

  // Esto queda como “placeholder” para cuando conectemos turnos y mantenimientos reales
  const [maintenanceCount] = useState<number>(0);

  const monthStart = useMemo(() => startOfMonthISO(monthCursor), [monthCursor]);
  const monthEnd = useMemo(() => endOfMonthISO(monthCursor), [monthCursor]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1) calendar_events (si existe en tu DB). Si no existe o falla RLS, no rompe la vista.
        const { data: calData, error: calError } = await supabase
          .from("calendar_events")
          .select("*")
          .gte("date", monthStart)
          .lte("date", monthEnd);

        if (calError) {
          console.error("[Calendar] calendar_events error:", calError);
        }

        // 2) service_requests (evitamos scheduled_date porque en tu caso NO existe y provoca 400)
        const { data: srData, error: srError } = await supabase
          .from("service_requests")
          .select("*")
          .gte("created_at", `${monthStart}T00:00:00.000Z`)
          .lte("created_at", `${monthEnd}T23:59:59.999Z`);

        if (srError) {
          console.error("[Calendar] service_requests error:", srError);
        }

        // 3) emergency_visits (según lo que vimos: visit_date + start_time/end_time)
        const { data: evData, error: evError } = await supabase
          .from("emergency_visits")
          .select("*")
          .gte("visit_date", monthStart)
          .lte("visit_date", monthEnd);

        if (evError) {
          console.error("[Calendar] emergency_visits error:", evError);
        }

        // ---- Map a FullCalendar events (defensivo, para que nunca “reviente”) ----
        const mapped: CalendarEvent[] = [];

        // calendar_events -> asumimos { id, title, date, start_time?, end_time? }
        (calData ?? []).forEach((e: any) => {
          const date = e?.date; // YYYY-MM-DD
          if (!date) return;

          const startTime = e?.start_time ?? null;
          const endTime = e?.end_time ?? null;

          mapped.push({
            id: `cal-${e?.id ?? crypto.randomUUID()}`,
            title: e?.title ?? "Evento",
            start: startTime ? `${date}T${startTime}:00` : `${date}T00:00:00`,
            end: endTime ? `${date}T${endTime}:00` : undefined,
            allDay: !startTime,
          });
        });

        // service_requests -> lo mostramos como evento informativo por fecha creación
        const srList = (srData ?? []) as any[];
        srList.forEach((r) => {
          const createdAt = r?.created_at;
          if (!createdAt) return;

          mapped.push({
            id: `sr-${r?.id ?? crypto.randomUUID()}`,
            title: `Solicitud: ${r?.title ?? "sin título"}`,
            start: createdAt,
            allDay: false,
          });
        });

        // emergency_visits -> evento por visit_date/start_time
        const evList = (evData ?? []) as any[];
        evList.forEach((v) => {
          const date = v?.visit_date;
          if (!date) return;

          const st = v?.start_time ?? "09:00";
          const et = v?.end_time ?? null;

          mapped.push({
            id: `ev-${v?.id ?? crypto.randomUUID()}`,
            title: `Emergencia: ${v?.emergency_id ?? "visita"}`,
            start: `${date}T${st}:00`,
            end: et ? `${date}T${et}:00` : undefined,
            allDay: false,
          });
        });

        if (!cancelled) {
          setEvents(mapped);

          // Panel lateral
          setServiceRequests(srList.map((x) => x as ServiceRequest));
          setEmergencyVisits(evList.map((x) => x as EmergencyVisit));
        }
      } catch (err: any) {
        console.error("[Calendar] loadAll fatal:", err);
        if (!cancelled) {
          setErrorMsg(err?.message ?? "Error desconocido cargando el calendario");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [monthStart, monthEnd]);

  // ---- UI helpers ----
  const pendingRequests = useMemo(() => {
    // si tienes status “pending”, “open”, etc, aquí luego se ajusta
    return serviceRequests.slice(0, 8);
  }, [serviceRequests]);

  const nextEmergencies = useMemo(() => {
    return emergencyVisits.slice(0, 8);
  }, [emergencyVisits]);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gestión de Calendario</h1>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-sm text-slate-500">Cargando…</span>
          ) : (
            <span className="text-sm text-slate-500">
              {events.length} evento(s)
            </span>
          )}
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* CALENDARIO */}
        <div className="rounded-lg border bg-white p-2">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="auto"

            // ✅ Español completo
            locale={esLocale}
            buttonText={{
              today: "hoy",
              month: "mes",
              week: "semana",
              day: "día",
              list: "lista",
            }}
            allDayText="Todo el día"
            noEventsText="No hay eventos para mostrar"

            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={events}
            datesSet={(arg) => {
              // Cambia el cursor al rango visible (así recarga el mes correcto)
              setMonthCursor(arg.start);
            }}
          />
          <p className="mt-2 text-xs text-slate-500">
            Nota: el 404 de <b>/favicon.png</b> es normal si no lo tienes en /public. No afecta.
          </p>
        </div>

        {/* PANEL LATERAL (Dashboard) */}
        <aside className="rounded-lg border bg-white p-3">
          <h2 className="mb-3 text-base font-semibold">Acciones rápidas</h2>

          <div className="grid grid-cols-1 gap-2">
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              onClick={() => alert("Próximo paso: modal para programar mantenimiento (lo conectamos a tu tabla real).")}
            >
              + Programar mantenimiento
            </button>

            <button
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              onClick={() => alert("Próximo paso: modal para crear turno de emergencia (lo conectamos a emergency_shifts).")}
            >
              + Programar turno de emergencia
            </button>

            <button
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
              onClick={() => alert("Próximo paso: asignar solicitud a técnico y fecha/hora.")}
            >
              Asignar / agendar solicitud
            </button>
          </div>

          <hr className="my-4" />

          <h3 className="mb-2 text-sm font-semibold">Solicitudes (clientes / técnicos)</h3>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-slate-500">No hay solicitudes en este mes.</p>
          ) : (
            <ul className="space-y-2">
              {pendingRequests.map((r) => (
                <li key={String(r.id)} className="rounded-md border p-2">
                  <div className="text-sm font-medium">
                    {r.title ?? "Solicitud sin título"}
                  </div>
                  <div className="text-xs text-slate-500">
                    Estado: {r.status ?? "—"} • {r.created_at ? new Date(r.created_at).toLocaleString("es-CL") : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <hr className="my-4" />

          <h3 className="mb-2 text-sm font-semibold">Emergencias (visitas)</h3>
          {nextEmergencies.length === 0 ? (
            <p className="text-sm text-slate-500">No hay visitas de emergencia en este mes.</p>
          ) : (
            <ul className="space-y-2">
              {nextEmergencies.map((v) => (
                <li key={String(v.id)} className="rounded-md border p-2">
                  <div className="text-sm font-medium">
                    Emergencia: {String(v.emergency_id ?? "—")}
                  </div>
                  <div className="text-xs text-slate-500">
                    {v.visit_date ?? "—"} {v.start_time ? `• ${v.start_time}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <hr className="my-4" />

          <h3 className="mb-2 text-sm font-semibold">Mantenimientos</h3>
          <p className="text-sm text-slate-500">
            Programados este mes: <b>{maintenanceCount}</b> (pendiente de conectar a tu tabla real)
          </p>
        </aside>
      </div>
    </div>
  );
}