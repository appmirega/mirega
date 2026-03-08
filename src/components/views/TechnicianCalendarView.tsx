import React, { useEffect, useMemo, useState } from "react";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "lucide-react";
import { supabase } from "../../lib/supabase";

type CalendarRow = {
  id: string;
  event_type: string;
  status?: string | null;
  source_id?: string | null;
  client_id?: string | null;
  building_name?: string | null;
  technician_id?: string | null;
  external_person?: string | null;
  is_external?: boolean | null;
  event_date: string;
  start_at?: string | null;
  end_at?: string | null;
  title?: string | null;
  description?: string | null;
};

type LeaveRow = {
  id: string;
  source: "availability" | "leave";
  technician_id: string;
  start_date: string;
  end_date: string;
  status?: string | null;
  absence_type?: string | null;
  leave_type?: string | null;
  reason?: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type DayBucket = {
  dateKey: string;
  date: Date;
  assignments: CalendarRow[];
  leaveRows: LeaveRow[];
};

type RequestType = "permission" | "vacation";

function safeText(value?: string | null) {
  return (value ?? "").trim();
}

function normalizeDateString(value?: string | null) {
  return safeText(value).slice(0, 10);
}

function eventTypeLabel(eventType?: string | null) {
  const value = safeText(eventType).toLowerCase();

  if (value === "maintenance") return "Mantención";
  if (value === "emergency_shift") return "Turno emergencia";
  if (value === "emergency" || value === "emergency_visit") return "Emergencia";
  if (value === "technical_visit" || value === "visit") return "Visita";
  if (value === "inspection") return "Inspección";
  if (value === "certification") return "Certificación";
  if (value === "training" || value === "rescue_training") return "Capacitación";
  return "Asignación";
}

function eventBadgeClass(eventType?: string | null) {
  const value = safeText(eventType).toLowerCase();

  if (value === "maintenance") return "bg-blue-100 text-blue-800 border-blue-200";
  if (value === "emergency_shift") return "bg-red-100 text-red-800 border-red-200";
  if (value === "emergency" || value === "emergency_visit") {
    return "bg-orange-100 text-orange-800 border-orange-200";
  }
  if (value === "technical_visit" || value === "visit") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (value === "inspection" || value === "certification") {
    return "bg-violet-100 text-violet-800 border-violet-200";
  }
  if (value === "training" || value === "rescue_training") {
    return "bg-green-100 text-green-800 border-green-200";
  }

  return "bg-slate-100 text-slate-800 border-slate-200";
}

function leaveBadgeClass(status?: string | null) {
  switch (safeText(status).toLowerCase()) {
    case "approved":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "rejected":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "pending":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function leaveTypeLabel(row: LeaveRow) {
  const leaveType = safeText(row.leave_type);
  const absenceType = safeText(row.absence_type);

  if (leaveType) return leaveType;
  if (absenceType === "personal_leave") return "Permiso";
  if (absenceType) return absenceType;
  return "Ausencia";
}

function DetailModal({
  bucket,
  onClose,
}: {
  bucket: DayBucket;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {format(bucket.date, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </div>
            <div className="text-sm text-slate-500">
              Resumen de asignaciones y solicitudes
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="mb-3 font-medium text-slate-900">Asignaciones del día</div>

            {bucket.assignments.length === 0 ? (
              <div className="rounded-lg border bg-white p-3 text-sm text-slate-500">
                Sin asignaciones.
              </div>
            ) : (
              <div className="space-y-2">
                {bucket.assignments.map((event) => (
                  <div key={event.id} className="rounded-lg border bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${eventBadgeClass(
                          event.event_type
                        )}`}
                      >
                        {eventTypeLabel(event.event_type)}
                      </span>
                      <span className="font-medium text-slate-900">
                        {safeText(event.title) ||
                          safeText(event.building_name) ||
                          "Asignación"}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-slate-600">
                      Edificio: <b>{safeText(event.building_name) || "—"}</b>
                    </div>

                    {safeText(event.description) && (
                      <div className="mt-1 text-sm text-slate-600">
                        {safeText(event.description)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="mb-3 font-medium text-slate-900">
              Solicitudes / ausencias del día
            </div>

            {bucket.leaveRows.length === 0 ? (
              <div className="rounded-lg border bg-white p-3 text-sm text-slate-500">
                Sin solicitudes o ausencias para este día.
              </div>
            ) : (
              <div className="space-y-2">
                {bucket.leaveRows.map((row) => (
                  <div key={`${row.source}-${row.id}`} className="rounded-lg border bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${leaveBadgeClass(
                          row.status
                        )}`}
                      >
                        {leaveTypeLabel(row)}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        Estado: {safeText(row.status) || "—"}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-slate-600">
                      Desde <b>{normalizeDateString(row.start_date)}</b> hasta{" "}
                      <b>{normalizeDateString(row.end_date)}</b>
                    </div>

                    {safeText(row.reason) && (
                      <div className="mt-1 text-sm text-slate-600">
                        {safeText(row.reason)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TechnicianCalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [technicianId, setTechnicianId] = useState<string>("");
  const [technicianName, setTechnicianName] = useState<string>("");

  const [calendarRows, setCalendarRows] = useState<CalendarRow[]>([]);
  const [leaveRows, setLeaveRows] = useState<LeaveRow[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [selectedDay, setSelectedDay] = useState<DayBucket | null>(null);
  const [showEventModal, setShowEventModal] = useState<boolean>(false);

  const [requestType, setRequestType] = useState<RequestType>("permission");
  const [singleDate, setSingleDate] = useState<string>("");
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const [savingRequest, setSavingRequest] = useState<boolean>(false);
  const [requestError, setRequestError] = useState<string>("");
  const [requestSuccess, setRequestSuccess] = useState<string>("");

  const monthStart = useMemo(
    () => format(startOfMonth(selectedDate), "yyyy-MM-dd"),
    [selectedDate]
  );

  const monthEnd = useMemo(
    () => format(endOfMonth(selectedDate), "yyyy-MM-dd"),
    [selectedDate]
  );

  const monthLabel = useMemo(
    () => format(selectedDate, "MMMM yyyy", { locale: es }),
    [selectedDate]
  );

  const canSubmitRequest = useMemo(() => {
    if (requestType === "permission") return Boolean(singleDate);
    return Boolean(rangeStart) && Boolean(rangeEnd);
  }, [requestType, singleDate, rangeStart, rangeEnd]);

  const resetRequestForm = () => {
    setRequestType("permission");
    setSingleDate("");
    setRangeStart("");
    setRangeEnd("");
    setReason("");
    setRequestError("");
    setRequestSuccess("");
  };

  const loadTechnicianAndCalendar = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("No hay sesión activa.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const typedProfile = profile as ProfileRow;
      setTechnicianId(typedProfile.id);
      setTechnicianName(safeText(typedProfile.full_name));

      const [calendarResult, availabilityResult, leaveResult] = await Promise.all([
        supabase
          .from("v_calendar_events_month")
          .select("*")
          .eq("technician_id", typedProfile.id)
          .gte("event_date", monthStart)
          .lte("event_date", monthEnd)
          .order("event_date", { ascending: true }),
        supabase
          .from("technician_availability")
          .select("id, technician_id, start_date, end_date, status, absence_type, reason")
          .eq("technician_id", typedProfile.id)
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart)
          .order("start_date", { ascending: true }),
        supabase
          .from("technician_leaves")
          .select("id, technician_id, start_date, end_date, status, leave_type, reason")
          .eq("technician_id", typedProfile.id)
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart)
          .order("start_date", { ascending: true }),
      ]);

      if (calendarResult.error) throw calendarResult.error;
      if (availabilityResult.error) throw availabilityResult.error;
      if (leaveResult.error) throw leaveResult.error;

      setCalendarRows((calendarResult.data ?? []) as CalendarRow[]);

      const availabilityRows: LeaveRow[] = (availabilityResult.data ?? []).map(
        (row: any) => ({
          ...row,
          source: "availability",
        })
      );

      const leaveRowsMapped: LeaveRow[] = (leaveResult.data ?? []).map(
        (row: any) => ({
          ...row,
          source: "leave",
        })
      );

      setLeaveRows([...availabilityRows, ...leaveRowsMapped]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible cargar el calendario técnico.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTechnicianAndCalendar();
  }, [monthEnd, monthStart]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarRow[]>();

    calendarRows.forEach((row) => {
      const key = normalizeDateString(row.event_date);
      const current = map.get(key) ?? [];
      current.push(row);
      map.set(key, current);
    });

    return map;
  }, [calendarRows]);

  const leaveByDate = useMemo(() => {
    const map = new Map<string, LeaveRow[]>();

    leaveRows.forEach((row) => {
      let currentDate = parseISO(`${normalizeDateString(row.start_date)}T00:00:00`);
      const endDate = parseISO(`${normalizeDateString(row.end_date)}T00:00:00`);

      while (currentDate <= endDate) {
        const key = format(currentDate, "yyyy-MM-dd");
        const current = map.get(key) ?? [];
        current.push(row);
        map.set(key, current);
        currentDate = addDays(currentDate, 1);
      }
    });

    return map;
  }, [leaveRows]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 });

    const rows: DayBucket[] = [];
    let cursor = start;

    while (cursor <= end) {
      const key = format(cursor, "yyyy-MM-dd");
      rows.push({
        dateKey: key,
        date: cursor,
        assignments: eventsByDate.get(key) ?? [],
        leaveRows: leaveByDate.get(key) ?? [],
      });
      cursor = addDays(cursor, 1);
    }

    return rows;
  }, [selectedDate, eventsByDate, leaveByDate]);

  const weekRows = useMemo(() => {
    const rows: DayBucket[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7));
    }
    return rows;
  }, [calendarDays]);

  const submitRequest = async () => {
    setRequestError("");
    setRequestSuccess("");

    if (!canSubmitRequest) {
      setRequestError("Completa los campos requeridos.");
      return;
    }

    if (requestType === "vacation" && rangeStart > rangeEnd) {
      setRequestError("La fecha de inicio no puede ser mayor que la fecha final.");
      return;
    }

    setSavingRequest(true);

    try {
      if (requestType === "permission") {
        const payload = {
          technician_id: technicianId,
          start_date: singleDate,
          end_date: singleDate,
          absence_type: "personal_leave",
          reason: safeText(reason) || "Permiso",
          status: "pending",
        };

        const { error } = await supabase
          .from("technician_availability")
          .insert(payload);

        if (error) throw error;
      } else {
        const payload = {
          technician_id: technicianId,
          leave_type: "vacaciones",
          start_date: rangeStart,
          end_date: rangeEnd,
          reason: safeText(reason) || "Vacaciones",
          status: "pending",
        };

        const { error } = await supabase.from("technician_leaves").insert(payload);

        if (error) throw error;
      }

      setRequestSuccess("Solicitud enviada correctamente.");
      await loadTechnicianAndCalendar();

      setTimeout(() => {
        setShowEventModal(false);
        resetRequestForm();
      }, 700);
    } catch (err: any) {
      console.error(err);
      setRequestError(err?.message || "No fue posible enviar la solicitud.");
    } finally {
      setSavingRequest(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Calendar className="h-6 w-6" /> Mi Calendario Técnico
          </h1>
          <p className="text-sm text-slate-500">
            Visualiza solo tus asignaciones, permisos y vacaciones.
          </p>
          {technicianName && (
            <p className="mt-1 text-sm text-slate-700">
              Técnico: <b>{technicianName}</b>
            </p>
          )}
        </div>

        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() => {
            resetRequestForm();
            setShowEventModal(true);
          }}
        >
          Solicitar Permiso/Vacaciones
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          className="rounded-md border bg-white px-3 py-2 text-sm"
          onClick={() =>
            setSelectedDate(
              new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
            )
          }
        >
          Mes anterior
        </button>

        <button
          className="rounded-md border bg-white px-3 py-2 text-sm"
          onClick={() => setSelectedDate(new Date())}
        >
          Hoy
        </button>

        <button
          className="rounded-md border bg-white px-3 py-2 text-sm"
          onClick={() =>
            setSelectedDate(
              new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)
            )
          }
        >
          Mes siguiente
        </button>
      </div>

      <div className="mb-3 text-xl font-semibold capitalize text-slate-900">
        {monthLabel}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-500">
          Cargando calendario...
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <div className="grid grid-cols-7 bg-slate-50">
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
              <div
                key={day}
                className="border-b border-r px-3 py-3 text-center text-sm font-semibold text-slate-700 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {weekRows.map((week, index) => (
            <div key={index} className="grid grid-cols-7">
              {week.map((day) => {
                const currentMonth = isSameMonth(day.date, selectedDate);

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[120px] border-r border-b p-2 text-left hover:bg-slate-50 ${
                      currentMonth ? "bg-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <div className="mb-2 text-right text-sm font-medium">
                      {format(day.date, "d")}
                    </div>

                    <div className="space-y-1">
                      {day.assignments.length === 0 && day.leaveRows.length === 0 ? (
                        <div className="text-xs text-slate-400">Sin asignaciones</div>
                      ) : (
                        <>
                          {day.assignments.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={`rounded-md border px-2 py-1 text-xs ${eventBadgeClass(
                                event.event_type
                              )}`}
                            >
                              {eventTypeLabel(event.event_type)}
                            </div>
                          ))}

                          {day.leaveRows.slice(0, 2).map((row) => (
                            <div
                              key={`${row.source}-${row.id}`}
                              className={`rounded-md border px-2 py-1 text-xs ${leaveBadgeClass(
                                row.status
                              )}`}
                            >
                              {leaveTypeLabel(row)}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {selectedDay && (
        <DetailModal bucket={selectedDay} onClose={() => setSelectedDay(null)} />
      )}

      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Solicitar Permiso/Vacaciones</h2>
              <button
                onClick={() => {
                  setShowEventModal(false);
                  resetRequestForm();
                }}
                className="text-xl text-slate-500"
              >
                ×
              </button>
            </div>

            {requestError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {requestError}
              </div>
            )}

            {requestSuccess && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {requestSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Tipo de evento</label>
                <select
                  className="w-full rounded border px-3 py-2"
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as RequestType)}
                >
                  <option value="permission">Permiso</option>
                  <option value="vacation">Vacaciones</option>
                </select>
              </div>

              {requestType === "permission" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Fecha</label>
                  <input
                    type="date"
                    className="w-full rounded border px-3 py-2"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Desde</label>
                    <input
                      type="date"
                      className="w-full rounded border px-3 py-2"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Hasta</label>
                    <input
                      type="date"
                      className="w-full rounded border px-3 py-2"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Descripción</label>
                <textarea
                  className="w-full rounded border px-3 py-2"
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo de la solicitud"
                />
              </div>

              <button
                type="button"
                onClick={submitRequest}
                disabled={savingRequest || !canSubmitRequest}
                className={`mt-2 w-full rounded px-4 py-2 text-white ${
                  savingRequest || !canSubmitRequest
                    ? "bg-slate-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {savingRequest ? "Enviando..." : "Enviar Solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}