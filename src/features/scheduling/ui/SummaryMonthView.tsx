import React, { useEffect, useMemo, useState } from "react";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

import { supabase } from "../../../lib/supabase";
import type { CalendarEventRow } from "../domain/calendarEvent";
import { useMonthCalendarEvents } from "../hooks/useMonthCalendarEvents";

type SummaryMonthViewProps = {
  selectedDate: Date;
  monthStart: string;
  monthEnd: string;
  onNavigate: (date: Date) => void;
};

type AbsenceRow = {
  technician_id: string;
  start_date: string;
  end_date: string;
  source: "availability" | "leave";
};

type DayBucket = {
  dateKey: string;
  date: Date;
  events: CalendarEventRow[];
};

type EventGroupConfig = {
  key: string;
  label: string;
  shortLabel: string;
  colorClass: string;
  chipClass: string;
  eventTypes: string[];
};

const EVENT_GROUPS: EventGroupConfig[] = [
  {
    key: "maintenance",
    label: "Mantenciones",
    shortLabel: "M",
    colorClass: "bg-blue-500",
    chipClass: "bg-blue-100 text-blue-800 border-blue-200",
    eventTypes: ["maintenance"],
  },
  {
    key: "emergency_shift",
    label: "Turnos emergencia",
    shortLabel: "TE",
    colorClass: "bg-red-500",
    chipClass: "bg-red-100 text-red-800 border-red-200",
    eventTypes: ["emergency_shift"],
  },
  {
    key: "emergency_visit",
    label: "Emergencias",
    shortLabel: "E",
    colorClass: "bg-orange-500",
    chipClass: "bg-orange-100 text-orange-800 border-orange-200",
    eventTypes: ["emergency", "emergency_visit"],
  },
  {
    key: "visit",
    label: "Visitas",
    shortLabel: "V",
    colorClass: "bg-amber-500",
    chipClass: "bg-amber-100 text-amber-800 border-amber-200",
    eventTypes: ["visit", "technical_visit"],
  },
  {
    key: "inspection",
    label: "Certificaciones / inspecciones",
    shortLabel: "I",
    colorClass: "bg-violet-500",
    chipClass: "bg-violet-100 text-violet-800 border-violet-200",
    eventTypes: ["inspection", "certification"],
  },
  {
    key: "training",
    label: "Capacitaciones",
    shortLabel: "C",
    colorClass: "bg-green-500",
    chipClass: "bg-green-100 text-green-800 border-green-200",
    eventTypes: ["training", "rescue_training"],
  },
  {
    key: "other",
    label: "Otros",
    shortLabel: "O",
    colorClass: "bg-slate-500",
    chipClass: "bg-slate-100 text-slate-800 border-slate-200",
    eventTypes: ["other", "calendar_event", "work_order"],
  },
];

function safeText(value?: string | null) {
  return (value ?? "").trim();
}

function normalizeDateString(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getGroupForEventType(eventType?: string | null): EventGroupConfig {
  const normalized = safeText(eventType).toLowerCase();

  const found = EVENT_GROUPS.find((group) =>
    group.eventTypes.includes(normalized)
  );

  return found ?? EVENT_GROUPS[EVENT_GROUPS.length - 1];
}

function formatEventLine(event: CalendarEventRow) {
  const title = safeText(event.title);
  const building = safeText(event.building_name);
  const description = safeText(event.description);

  if (title) return title;
  if (building) return building;
  if (description) return description;

  return "Sin detalle";
}

function DayDetailModal({
  date,
  events,
  onClose,
}: {
  date: Date;
  events: CalendarEventRow[];
  onClose: () => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, { config: EventGroupConfig; items: CalendarEventRow[] }>();

    EVENT_GROUPS.forEach((group) => {
      map.set(group.key, { config: group, items: [] });
    });

    events.forEach((event) => {
      const group = getGroupForEventType(event.event_type);
      map.get(group.key)?.items.push(event);
    });

    return Array.from(map.values()).filter((group) => group.items.length > 0);
  }, [events]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </div>
            <div className="text-sm text-slate-500">
              Resumen operativo del día
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {grouped.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
              No hay asignaciones para este día.
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map((group) => (
                <div key={group.config.key} className="rounded-xl border bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${group.config.colorClass}`} />
                    <div className="font-medium text-slate-900">
                      {group.config.label}
                    </div>
                    <div className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
                      {group.items.length}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg border bg-white px-3 py-3"
                      >
                        <div className="font-medium text-slate-900">
                          {formatEventLine(event)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Edificio: <b>{safeText(event.building_name) || "—"}</b>
                          {" · "}
                          Técnico: <b>{safeText(event.technician_id) || "—"}</b>
                          {" · "}
                          Estado: <b>{safeText(event.status) || "—"}</b>
                        </div>
                        {safeText(event.description) && (
                          <div className="mt-2 text-sm text-slate-600">
                            {safeText(event.description)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SummaryMonthView({
  selectedDate,
  monthStart,
  monthEnd,
  onNavigate,
}: SummaryMonthViewProps) {
  const { data, error, loading, reload } = useMonthCalendarEvents({
    monthStart,
    monthEnd,
  });

  const [approvedAbsences, setApprovedAbsences] = useState<AbsenceRow[]>([]);
  const [absError, setAbsError] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<DayBucket | null>(null);

  useEffect(() => {
    const loadApprovedAbsences = async () => {
      setAbsError("");

      try {
        const [availabilityResult, leavesResult] = await Promise.all([
          supabase
            .from("technician_availability")
            .select("technician_id, start_date, end_date, status")
            .eq("status", "approved")
            .lte("start_date", monthEnd)
            .gte("end_date", monthStart),
          supabase
            .from("technician_leaves")
            .select("technician_id, start_date, end_date, status")
            .eq("status", "approved")
            .lte("start_date", monthEnd)
            .gte("end_date", monthStart),
        ]);

        if (availabilityResult.error) throw availabilityResult.error;
        if (leavesResult.error) throw leavesResult.error;

        const availabilityRows =
          (availabilityResult.data ?? []).map((row: any) => ({
            technician_id: row.technician_id,
            start_date: row.start_date,
            end_date: row.end_date,
            source: "availability" as const,
          })) ?? [];

        const leaveRows =
          (leavesResult.data ?? []).map((row: any) => ({
            technician_id: row.technician_id,
            start_date: row.start_date,
            end_date: row.end_date,
            source: "leave" as const,
          })) ?? [];

        setApprovedAbsences([...availabilityRows, ...leaveRows]);
      } catch (err: any) {
        console.error(err);
        setAbsError(
          err?.message || "No fue posible cargar las ausencias aprobadas."
        );
        setApprovedAbsences([]);
      }
    };

    void loadApprovedAbsences();
  }, [monthEnd, monthStart]);

  const blockedDays = useMemo(() => {
    const output = new Set<string>();

    approvedAbsences.forEach((absence) => {
      let current = parseISO(`${normalizeDateString(absence.start_date)}T00:00:00`);
      const end = parseISO(`${normalizeDateString(absence.end_date)}T00:00:00`);

      while (current <= end) {
        output.add(format(current, "yyyy-MM-dd"));
        current = addDays(current, 1);
      }
    });

    return output;
  }, [approvedAbsences]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();

    (data ?? []).forEach((event) => {
      const key = normalizeDateString(event.event_date);
      if (!key) return;

      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    });

    return map;
  }, [data]);

  const calendarDays = useMemo(() => {
    const monthStartDate = startOfMonth(selectedDate);
    const monthEndDate = endOfMonth(selectedDate);
    const gridStart = startOfWeek(monthStartDate, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEndDate, { weekStartsOn: 1 });

    const days: DayBucket[] = [];
    let cursor = gridStart;

    while (cursor <= gridEnd) {
      const key = format(cursor, "yyyy-MM-dd");
      days.push({
        dateKey: key,
        date: cursor,
        events: eventsByDate.get(key) ?? [],
      });
      cursor = addDays(cursor, 1);
    }

    return days;
  }, [selectedDate, eventsByDate]);

  const weekRows = useMemo(() => {
    const rows: DayBucket[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7));
    }
    return rows;
  }, [calendarDays]);

  const legendItems = EVENT_GROUPS;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-2xl font-semibold text-slate-900">
            Resumen mensual (maestro)
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Vista global de carga operativa. Cada día muestra cantidad por tipo de asignación.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() =>
              onNavigate(
                new Date(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth() - 1,
                  1
                )
              )
            }
          >
            ◀ Mes anterior
          </button>

          <button
            className="rounded-lg border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => onNavigate(new Date())}
          >
            Hoy
          </button>

          <button
            className="rounded-lg border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() =>
              onNavigate(
                new Date(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth() + 1,
                  1
                )
              )
            }
          >
            Mes siguiente ▶
          </button>

          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
            onClick={reload}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {legendItems.map((item) => (
          <div
            key={item.key}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${item.chipClass}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${item.colorClass}`} />
            <span>{item.shortLabel}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {absError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {absError}
        </div>
      )}

      <div className="mb-3 text-center">
        <div className="text-2xl font-semibold text-slate-900">
          {format(selectedDate, "MMMM yyyy", { locale: es })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border">
        <div className="grid grid-cols-7 bg-slate-50">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
            <div
              key={day}
              className="border-b border-r px-3 py-3 text-center text-sm font-semibold text-slate-700 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div>
          {weekRows.map((week, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-7">
              {week.map((day) => {
                const inCurrentMonth = isSameMonth(day.date, selectedDate);
                const isToday = isSameDay(day.date, new Date());
                const hasAbsence = blockedDays.has(day.dateKey);

                const counts = EVENT_GROUPS.map((group) => {
                  const count = day.events.filter((event) =>
                    group.eventTypes.includes(
                      safeText(event.event_type).toLowerCase()
                    )
                  ).length;

                  return {
                    group,
                    count,
                  };
                }).filter((item) => item.count > 0);

                const totalEvents = day.events.length;

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`relative min-h-[130px] border-r border-b p-2 text-left transition hover:bg-slate-50 ${
                      !inCurrentMonth ? "bg-slate-100 text-slate-400" : "bg-white"
                    } ${hasAbsence ? "ring-1 ring-red-200 bg-red-50/40" : ""}`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday
                            ? "bg-slate-900 text-white"
                            : inCurrentMonth
                            ? "text-slate-800"
                            : "text-slate-400"
                        }`}
                      >
                        {format(day.date, "d")}
                      </div>

                      {totalEvents > 0 && (
                        <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {totalEvents} total
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      {counts.length === 0 ? (
                        <div className="text-[11px] text-slate-300">Sin carga</div>
                      ) : (
                        counts.map(({ group, count }) => (
                          <div
                            key={group.key}
                            className={`flex items-center justify-between rounded-md border px-2 py-1 text-[11px] ${group.chipClass}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2.5 w-2.5 rounded-full ${group.colorClass}`} />
                              <span className="font-semibold">{group.shortLabel}</span>
                            </div>
                            <span className="font-bold">{count}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {hasAbsence && (
                      <div className="mt-2 text-[10px] font-medium text-red-700">
                        Con ausencias
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Haz click en un día para ver el detalle completo de asignaciones.
      </div>

      {selectedDay && (
        <DayDetailModal
          date={selectedDay.date}
          events={selectedDay.events}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}