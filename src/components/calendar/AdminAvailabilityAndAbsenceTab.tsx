import { useEffect, useMemo, useState } from "react";
import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "../../lib/supabase";

type Technician = {
  id: string;
  full_name: string | null;
  person_type?: "internal" | "external" | null;
  company_name?: string | null;
};

type AvailabilityAbsenceRow = {
  id: string;
  technician_id: string;
  start_date: string;
  end_date: string;
  absence_type?: string | null;
  leave_type?: string | null;
  reason?: string | null;
  status?: string | null;
  source: "availability" | "leave";
};

function safeText(value?: string | null) {
  return (value ?? "").trim();
}

function normalizeDateString(value?: string | null) {
  return safeText(value).slice(0, 10);
}

function overlapsMonth(
  startDate: string,
  endDate: string,
  monthStart: string,
  monthEnd: string
) {
  return startDate <= monthEnd && endDate >= monthStart;
}

function statusBadge(status?: string | null) {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-rose-100 text-rose-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function sourceLabel(source: "availability" | "leave") {
  return source === "availability"
    ? "Disponibilidad / ausencia"
    : "Solicitud de ausencia";
}

function absenceTypeLabel(row: AvailabilityAbsenceRow) {
  return (
    safeText(row.leave_type) ||
    safeText(row.absence_type) ||
    "Sin tipo"
  );
}

export function AdminAvailabilityAndAbsenceTab() {
  const today = new Date();

  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(today, "yyyy-MM")
  );
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("");

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [rows, setRows] = useState<AvailabilityAbsenceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const monthStart = useMemo(() => {
    const date = parseISO(`${selectedMonth}-01T00:00:00`);
    return format(startOfMonth(date), "yyyy-MM-dd");
  }, [selectedMonth]);

  const monthEnd = useMemo(() => {
    const date = parseISO(`${selectedMonth}-01T00:00:00`);
    return format(endOfMonth(date), "yyyy-MM-dd");
  }, [selectedMonth]);

  const monthLabel = useMemo(() => {
    const date = parseISO(`${selectedMonth}-01T00:00:00`);
    return format(date, "MMMM yyyy", { locale: es });
  }, [selectedMonth]);

  const techniciansById = useMemo(() => {
    const map = new Map<string, Technician>();
    technicians.forEach((tech) => map.set(tech.id, tech));
    return map;
  }, [technicians]);

  const monthlyRows = useMemo(() => {
    return rows.filter((row) =>
      overlapsMonth(
        normalizeDateString(row.start_date),
        normalizeDateString(row.end_date),
        monthStart,
        monthEnd
      )
    );
  }, [rows, monthStart, monthEnd]);

  const approvedMonthlyRows = useMemo(() => {
    return monthlyRows.filter((row) => row.status === "approved");
  }, [monthlyRows]);

  const techniciansWithApprovedAbsence = useMemo(() => {
    return new Set(approvedMonthlyRows.map((row) => row.technician_id));
  }, [approvedMonthlyRows]);

  const fullyOperationalTechs = useMemo(() => {
    return technicians.filter(
      (tech) => !techniciansWithApprovedAbsence.has(tech.id)
    );
  }, [technicians, techniciansWithApprovedAbsence]);

  const affectedTechs = useMemo(() => {
    return technicians.filter((tech) =>
      techniciansWithApprovedAbsence.has(tech.id)
    );
  }, [technicians, techniciansWithApprovedAbsence]);

  const rowsByTechnician = useMemo(() => {
    const map = new Map<string, AvailabilityAbsenceRow[]>();

    monthlyRows.forEach((row) => {
      const current = map.get(row.technician_id) ?? [];
      current.push(row);
      map.set(row.technician_id, current);
    });

    return map;
  }, [monthlyRows]);

  const visibleTechnicians = useMemo(() => {
    if (selectedTechnicianId) {
      const selected = techniciansById.get(selectedTechnicianId);
      return selected ? [selected] : [];
    }

    return technicians;
  }, [selectedTechnicianId, technicians, techniciansById]);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [
        { data: techData, error: techError },
        { data: availabilityData, error: availabilityError },
        { data: leaveData, error: leaveError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role, person_type, company_name")
          .eq("role", "technician")
          .order("full_name", { ascending: true }),
        supabase
          .from("technician_availability")
          .select("id, technician_id, start_date, end_date, absence_type, reason, status")
          .order("start_date", { ascending: false }),
        supabase
          .from("technician_leaves")
          .select("id, technician_id, leave_type, start_date, end_date, status, reason")
          .order("start_date", { ascending: false }),
      ]);

      if (techError) throw techError;
      if (availabilityError) throw availabilityError;
      if (leaveError) throw leaveError;

      const normalizedAvailability: AvailabilityAbsenceRow[] = (
        availabilityData ?? []
      ).map((item: any) => ({
        ...item,
        source: "availability",
      }));

      const normalizedLeaves: AvailabilityAbsenceRow[] = (
        leaveData ?? []
      ).map((item: any) => ({
        ...item,
        source: "leave",
      }));

      setTechnicians((techData ?? []) as Technician[]);
      setRows([...normalizedAvailability, ...normalizedLeaves]);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || "No fue posible cargar disponibilidad y ausencias."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-base font-semibold">
              Disponibilidad y ausencias
            </div>
            <div className="text-sm text-slate-500">
              Vista mensual/global con resumen operativo y detalle por técnico.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="month"
              className="rounded-md border px-3 py-2 text-sm"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />

            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={selectedTechnicianId}
              onChange={(e) => setSelectedTechnicianId(e.target.value)}
            >
              <option value="">Todos los técnicos</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {safeText(tech.full_name) || tech.id}
                </option>
              ))}
            </select>

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
          <>
            <div className="mb-4 text-lg font-semibold capitalize text-slate-900">
              {monthLabel}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Total técnicos</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {technicians.length}
                </div>
              </div>

              <div className="rounded-xl border bg-emerald-50 p-4">
                <div className="text-xs text-emerald-700">
                  100% operativos en el mes
                </div>
                <div className="mt-1 text-2xl font-bold text-emerald-900">
                  {fullyOperationalTechs.length}
                </div>
              </div>

              <div className="rounded-xl border bg-amber-50 p-4">
                <div className="text-xs text-amber-700">
                  Con ausencias en el mes
                </div>
                <div className="mt-1 text-2xl font-bold text-amber-900">
                  {affectedTechs.length}
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-500">
                  Registros del mes
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {monthlyRows.length}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {!loading && (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 font-medium text-slate-900">
              Resumen global del mes
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border bg-emerald-50 p-4">
                <div className="font-medium text-emerald-900">
                  Técnicos totalmente operativos
                </div>
                {fullyOperationalTechs.length === 0 ? (
                  <div className="mt-2 text-sm text-emerald-700">
                    Ninguno.
                  </div>
                ) : (
                  <div className="mt-2 space-y-1 text-sm text-emerald-800">
                    {fullyOperationalTechs.map((tech) => (
                      <div key={tech.id}>
                        • {safeText(tech.full_name) || tech.id}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-amber-50 p-4">
                <div className="font-medium text-amber-900">
                  Técnicos con ausencias en el mes
                </div>
                {affectedTechs.length === 0 ? (
                  <div className="mt-2 text-sm text-amber-700">
                    Ninguno.
                  </div>
                ) : (
                  <div className="mt-2 space-y-2 text-sm text-amber-900">
                    {affectedTechs.map((tech) => {
                      const techRows = rowsByTechnician.get(tech.id) ?? [];

                      return (
                        <div key={tech.id} className="rounded-md border bg-white p-3">
                          <div className="font-medium text-slate-900">
                            {safeText(tech.full_name) || tech.id}
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                            {techRows.map((row) => (
                              <div key={`${row.source}-${row.id}`}>
                                • {absenceTypeLabel(row)} del{" "}
                                <b>{normalizeDateString(row.start_date)}</b> al{" "}
                                <b>{normalizeDateString(row.end_date)}</b>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 font-medium text-slate-900">
              Vista individual por técnico
            </div>

            <div className="space-y-3">
              {visibleTechnicians.length === 0 ? (
                <div className="rounded-md border p-3 text-sm text-slate-500">
                  No hay técnicos para mostrar.
                </div>
              ) : (
                visibleTechnicians.map((tech) => {
                  const techRows = rowsByTechnician.get(tech.id) ?? [];
                  const hasMonthlyAbsence = techRows.length > 0;

                  return (
                    <div key={tech.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-900">
                            {safeText(tech.full_name) || tech.id}
                          </div>
                          <div className="text-xs text-slate-500">
                            {hasMonthlyAbsence
                              ? "Tiene ausencias registradas en el mes"
                              : "100% operativo durante el mes"}
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            hasMonthlyAbsence
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {hasMonthlyAbsence ? "Con rangos" : "Operativo"}
                        </span>
                      </div>

                      {techRows.length === 0 ? (
                        <div className="mt-3 rounded-md border bg-emerald-50 p-3 text-sm text-emerald-800">
                          Sin ausencias ni bloqueos en {monthLabel}.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {techRows.map((row) => (
                            <div
                              key={`${row.source}-${row.id}`}
                              className="rounded-md border bg-slate-50 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-medium text-slate-900">
                                  {absenceTypeLabel(row)}
                                </div>
                                <span
                                  className={`rounded-full px-2 py-1 text-xs ${statusBadge(
                                    row.status
                                  )}`}
                                >
                                  {row.status || "sin estado"}
                                </span>
                              </div>

                              <div className="mt-1 text-sm text-slate-600">
                                Del <b>{normalizeDateString(row.start_date)}</b> al{" "}
                                <b>{normalizeDateString(row.end_date)}</b>
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                Origen: {sourceLabel(row.source)}
                              </div>

                              {safeText(row.reason) && (
                                <div className="mt-2 text-sm text-slate-600">
                                  {safeText(row.reason)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}