import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end?: string;  // ISO
  allDay?: boolean;
};

function startOfMonthISO(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  // YYYY-MM-DD
  return x.toISOString().slice(0, 10);
}
function endOfMonthISO(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return x.toISOString().slice(0, 10);
}

export default function AdminCalendarDashboard() {
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const monthStart = useMemo(() => startOfMonthISO(monthCursor), [monthCursor]);
  const monthEnd = useMemo(() => endOfMonthISO(monthCursor), [monthCursor]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1) calendar_events (si existe en tu DB)
        const { data: calData, error: calError } = await supabase
          .from("calendar_events")
          .select("*")
          .gte("date", monthStart)
          .lte("date", monthEnd);

        if (calError) {
          // NO matamos la vista: lo mostramos en pantalla
          console.error("[Calendar] calendar_events error:", calError);
        }

        // 2) service_requests (tu tabla NO tiene scheduled_date, usamos created_at)
        const { data: srData, error: srError } = await supabase
          .from("service_requests")
          .select("*")
          .gte("created_at", `${monthStart}T00:00:00.000Z`)
          .lte("created_at", `${monthEnd}T23:59:59.999Z`);

        if (srError) {
          console.error("[Calendar] service_requests error:", srError);
        }

        // 3) emergency_visits (según tu SQL: visit_date + start_time/end_time)
        const { data: evData, error: evError } = await supabase
          .from("emergency_visits")
          .select("*")
          .gte("visit_date", monthStart)
          .lte("visit_date", monthEnd);

        if (evError) {
          console.error("[Calendar] emergency_visits error:", evError);
        }

        // Map a FullCalendar events (con defensas)
        const mapped: CalendarEvent[] = [];

        // calendar_events -> asumimos { id, title, date, start_time?, end_time? }
        (calData ?? []).forEach((e: any) => {
          const date = e?.date; // YYYY-MM-DD
          if (!date) return;

          const startTime = e?.start_time ?? "09:00";
          const endTime = e?.end_time ?? undefined;

          mapped.push({
            id: `cal-${e?.id ?? crypto.randomUUID()}`,
            title: e?.title ?? "Evento",
            start: `${date}T${startTime}:00`,
            end: endTime ? `${date}T${endTime}:00` : undefined,
            allDay: !e?.start_time,
          });
        });

        // service_requests -> usamos created_at como fecha (para que NO haga 400)
        (srData ?? []).forEach((r: any) => {
          const createdAt = r?.created_at;
          if (!createdAt) return;
          mapped.push({
            id: `sr-${r?.id ?? crypto.randomUUID()}`,
            title: `Solicitud: ${r?.title ?? "sin título"}`,
            start: createdAt,
            allDay: false,
          });
        });

        // emergency_visits -> { visit_date, start_time }
        (evData ?? []).forEach((v: any) => {
          const date = v?.visit_date; // YYYY-MM-DD
          if (!date) return;
          const st = v?.start_time ?? "09:00";
          const et = v?.end_time ?? undefined;

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

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Calendario (Admin)</h1>
        {loading ? (
          <span className="text-sm text-slate-500">Cargando…</span>
        ) : (
          <span className="text-sm text-slate-500">
            {events.length} evento(s)
          </span>
        )}
      </div>

      {errorMsg ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          height="auto"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          events={events}
          datesSet={(arg) => {
            // Actualiza el cursor al mes visible
            setMonthCursor(arg.start);
          }}
        />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Nota: el 404 de /favicon.png es normal si no lo tienes en /public. No afecta.
      </p>
    </div>
  );
}