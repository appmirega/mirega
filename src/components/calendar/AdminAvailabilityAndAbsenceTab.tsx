import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Technician = {
  id: string;
  full_name: string | null;
  phone?: string | null;
  email?: string | null;
  person_type?: "internal" | "external" | null;
  company_name?: string | null;
};

type AbsenceRow = {
  id: string;
  technician_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string | null;
  absence_type?: string | null;
};

type ServiceRequestRow = {
  id: string;
  title: string | null;
  request_type: string | null;
  status: string;
  priority: string | null;
  source_type?: string | null;
  created_at: string;
  client_id?: string | null;
  created_by_technician_id?: string | null;
};

function safeText(value?: string | null) {
  return (value ?? "").trim();
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function statusBadge(status?: string | null) {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-rose-100 text-rose-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "analyzing":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function AdminAvailabilityAndAbsenceTab() {
  const [currentDate, setCurrentDate] = useState<string>(todayYmd());

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [savingAbsence, setSavingAbsence] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [formData, setFormData] = useState({
    technician_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    absence_type: "vacation",
  });

  const techniciansById = useMemo(() => {
    const map = new Map<string, Technician>();
    technicians.forEach((tech) => map.set(tech.id, tech));
    return map;
  }, [technicians]);

  const activeAbsencesForDate = useMemo(() => {
    return absences.filter((row) => {
      return (
        row.status === "approved" &&
        row.start_date <= currentDate &&
        row.end_date >= currentDate
      );
    });
  }, [absences, currentDate]);

  const absentTechnicianIds = useMemo(
    () => new Set(activeAbsencesForDate.map((row) => row.technician_id)),
    [activeAbsencesForDate]
  );

  const availableTechnicians = useMemo(() => {
    return technicians.filter((tech) => !absentTechnicianIds.has(tech.id));
  }, [technicians, absentTechnicianIds]);

  const pendingRequests = useMemo(() => {
    return requests.filter((row) =>
      ["pending", "analyzing", "approved"].includes(row.status)
    );
  }, [requests]);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [
        { data: techData, error: techError },
        { data: absData, error: absError },
        { data: reqData, error: reqError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, phone, email, role, person_type, company_name")
          .in("role", ["technician", "Technician", "tecnico", "técnico"])
          .order("full_name", { ascending: true }),
        supabase
          .from("technician_availability")
          .select("id, technician_id, start_date, end_date, reason, status, absence_type")
          .order("start_date", { ascending: false }),
        supabase
          .from("service_requests")
          .select("id, title, request_type, status, priority, source_type, created_at, client_id, created_by_technician_id")
          .in("status", ["pending", "analyzing", "approved"])
          .order("created_at", { ascending: false }),
      ]);

      if (techError) throw techError;
      if (absError) throw absError;
      if (reqError) throw reqError;

      setTechnicians((techData ?? []) as Technician[]);
      setAbsences((absData ?? []) as AbsenceRow[]);
      setRequests((reqData ?? []) as ServiceRequestRow[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible cargar disponibilidad, ausencias y solicitudes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function createAbsence(e: React.FormEvent) {
    e.preventDefault();
    setSavingAbsence(true);
    setError("");

    try {
      if (!formData.technician_id) throw new Error("Selecciona un técnico.");
      if (!formData.start_date) throw new Error("Selecciona fecha de inicio.");
      if (!formData.end_date) throw new Error("Selecciona fecha de fin.");
      if (formData.start_date > formData.end_date) {
        throw new Error("La fecha de fin no puede ser anterior al inicio.");
      }

      const payload = {
        technician_id: formData.technician_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason || formData.absence_type,
        absence_type: formData.absence_type,
        status: "approved",
      };

      const { error } = await supabase.from("technician_availability").insert(payload);
      if (error) throw error;

      setFormData({
        technician_id: "",
        start_date: "",
        end_date: "",
        reason: "",
        absence_type: "vacation",
      });

      await loadAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible registrar la ausencia.");
    } finally {
      setSavingAbsence(false);
    }
  }

  async function updateAbsenceStatus(id: string, status: "approved" | "rejected") {
    try {
      const { error } = await supabase
        .from("technician_availability")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      await loadAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible actualizar la ausencia.");
    }
  }

  async function deleteAbsence(id: string) {
    const ok = window.confirm("¿Eliminar este registro de ausencia?");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("technician_availability")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await loadAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible eliminar la ausencia.");
    }
  }

  async function updateRequestStatus(id: string, status: "approved" | "rejected" | "analyzing") {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      await loadAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible actualizar la solicitud.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Disponibilidad y ausencias</div>
            <div className="text-sm text-slate-500">
              Vista unificada para disponibilidad diaria, ausencias y revisión administrativa.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              className="rounded-md border px-3 py-2 text-sm"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
            />
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={loadAll}
              type="button"
            >
              Refrescar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-500">Cargando información...</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Técnicos disponibles</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {availableTechnicians.length}
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Técnicos ausentes</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {activeAbsencesForDate.length}
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Solicitudes por revisar</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {pendingRequests.length}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 font-medium text-slate-900">
              Estado de técnicos para {currentDate}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-semibold text-emerald-700">
                  Disponibles ({availableTechnicians.length})
                </div>
                <div className="space-y-2">
                  {availableTechnicians.length === 0 ? (
                    <div className="rounded-md border p-3 text-sm text-slate-500">
                      No hay técnicos disponibles.
                    </div>
                  ) : (
                    availableTechnicians.map((tech) => (
                      <div key={tech.id} className="rounded-md border p-3">
                        <div className="font-medium text-slate-900">
                          {safeText(tech.full_name) || "Técnico"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {safeText(tech.email) || "Sin email"}{" "}
                          {safeText(tech.phone) ? `· ${safeText(tech.phone)}` : ""}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-rose-700">
                  Ausentes ({activeAbsencesForDate.length})
                </div>
                <div className="space-y-2">
                  {activeAbsencesForDate.length === 0 ? (
                    <div className="rounded-md border p-3 text-sm text-slate-500">
                      No hay ausencias aprobadas para esta fecha.
                    </div>
                  ) : (
                    activeAbsencesForDate.map((absence) => {
                      const technician = techniciansById.get(absence.technician_id);

                      return (
                        <div key={absence.id} className="rounded-md border border-rose-200 bg-rose-50 p-3">
                          <div className="font-medium text-slate-900">
                            {safeText(technician?.full_name) || "Técnico"}
                          </div>
                          <div className="text-xs text-rose-700">
                            {absence.start_date} → {absence.end_date}
                          </div>
                          <div className="mt-1 text-sm text-rose-800">
                            {safeText(absence.reason) || safeText(absence.absence_type) || "Sin motivo"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 font-medium text-slate-900">
              Solicitudes relacionadas (clientes y técnicos)
            </div>

            <div className="space-y-2">
              {pendingRequests.length === 0 ? (
                <div className="rounded-md border p-3 text-sm text-slate-500">
                  No hay solicitudes pendientes, en análisis o aprobadas.
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <div key={request.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">
                          {safeText(request.title) || "(Sin título)"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Tipo: <b>{safeText(request.request_type) || "—"}</b> · Fuente:{" "}
                          <b>{safeText(request.source_type) || "—"}</b> · Prioridad:{" "}
                          <b>{safeText(request.priority) || "—"}</b>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Estado:{" "}
                          <span className={`rounded-full px-2 py-1 ${statusBadge(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {request.status !== "approved" && (
                          <button
                            className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white"
                            onClick={() => updateRequestStatus(request.id, "approved")}
                          >
                            Aprobar
                          </button>
                        )}

                        {request.status !== "rejected" && (
                          <button
                            className="rounded-md bg-rose-600 px-3 py-2 text-xs text-white"
                            onClick={() => updateRequestStatus(request.id, "rejected")}
                          >
                            Rechazar
                          </button>
                        )}

                        {request.status !== "analyzing" && (
                          <button
                            className="rounded-md border bg-white px-3 py-2 text-xs"
                            onClick={() => updateRequestStatus(request.id, "analyzing")}
                          >
                            En análisis
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 font-medium text-slate-900">Registrar ausencia</div>

            <form onSubmit={createAbsence} className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Técnico</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={formData.technician_id}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, technician_id: e.target.value }))
                  }
                >
                  <option value="">Seleccionar técnico</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {safeText(tech.full_name) || tech.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Inicio</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Fin</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Tipo</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={formData.absence_type}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, absence_type: e.target.value }))
                  }
                >
                  <option value="vacation">Vacaciones</option>
                  <option value="personal_leave">Permiso</option>
                  <option value="sick_leave">Licencia médica</option>
                  <option value="training">Capacitación</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Motivo / nota</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Ej: Vacaciones, permiso personal, licencia..."
                />
              </div>

              <button
                type="submit"
                disabled={savingAbsence}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
              >
                {savingAbsence ? "Guardando..." : "Registrar ausencia"}
              </button>
            </form>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 font-medium text-slate-900">Historial de ausencias</div>

            <div className="space-y-2">
              {absences.length === 0 ? (
                <div className="rounded-md border p-3 text-sm text-slate-500">
                  No hay ausencias registradas.
                </div>
              ) : (
                absences.map((absence) => {
                  const technician = techniciansById.get(absence.technician_id);

                  return (
                    <div key={absence.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-900">
                            {safeText(technician?.full_name) || "Técnico"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {absence.start_date} → {absence.end_date}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {safeText(absence.reason) || safeText(absence.absence_type) || "—"}
                          </div>
                          <div className="mt-1">
                            <span className={`rounded-full px-2 py-1 text-xs ${statusBadge(absence.status)}`}>
                              {absence.status || "sin estado"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {absence.status !== "approved" && (
                            <button
                              className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white"
                              onClick={() => updateAbsenceStatus(absence.id, "approved")}
                            >
                              Aprobar
                            </button>
                          )}

                          {absence.status !== "rejected" && (
                            <button
                              className="rounded-md bg-rose-600 px-3 py-2 text-xs text-white"
                              onClick={() => updateAbsenceStatus(absence.id, "rejected")}
                            >
                              Rechazar
                            </button>
                          )}

                          <button
                            className="rounded-md border bg-white px-3 py-2 text-xs"
                            onClick={() => deleteAbsence(absence.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}