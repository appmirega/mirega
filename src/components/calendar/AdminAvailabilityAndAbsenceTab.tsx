import { useEffect, useMemo, useState } from "react";
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
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function sourceLabel(source: "availability" | "leave") {
  return source === "availability"
    ? "Disponibilidad / ausencia"
    : "Solicitud de ausencia";
}

export function AdminAvailabilityAndAbsenceTab() {
  const [currentDate, setCurrentDate] = useState<string>(todayYmd());
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [rows, setRows] = useState<AvailabilityAbsenceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const techniciansById = useMemo(() => {
    const map = new Map<string, Technician>();
    technicians.forEach((tech) => map.set(tech.id, tech));
    return map;
  }, [technicians]);

  const activeAbsencesForDate = useMemo(() => {
    return rows.filter((row) => {
      const activeStatus =
        row.status === "approved" || row.source === "availability";
      return activeStatus && row.start_date <= currentDate && row.end_date >= currentDate;
    });
  }, [rows, currentDate]);

  const absentTechnicianIds = useMemo(
    () => new Set(activeAbsencesForDate.map((row) => row.technician_id)),
    [activeAbsencesForDate]
  );

  const availableTechnicians = useMemo(() => {
    return technicians.filter((tech) => !absentTechnicianIds.has(tech.id));
  }, [technicians, absentTechnicianIds]);

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

      const normalizedAvailability: AvailabilityAbsenceRow[] = (availabilityData ?? []).map(
        (item: any) => ({
          ...item,
          source: "availability",
        })
      );

      const normalizedLeaves: AvailabilityAbsenceRow[] = (leaveData ?? []).map(
        (item: any) => ({
          ...item,
          source: "leave",
        })
      );

      setTechnicians((techData ?? []) as Technician[]);
      setRows([...normalizedAvailability, ...normalizedLeaves]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible cargar disponibilidad y ausencias.");
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Disponibilidad y ausencias</div>
            <div className="text-sm text-slate-500">
              Vista consolidada usando disponibilidad declarada y ausencias formales.
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
              <div className="text-xs text-slate-500">Técnicos no disponibles</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {activeAbsencesForDate.length}
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Registros totales</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {rows.length}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 font-medium text-slate-900">
            Técnicos disponibles para {currentDate}
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
                    {safeText(tech.person_type) || "internal"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 font-medium text-slate-900">
            Técnicos no disponibles para {currentDate}
          </div>

          <div className="space-y-2">
            {activeAbsencesForDate.length === 0 ? (
              <div className="rounded-md border p-3 text-sm text-slate-500">
                No hay ausencias activas para esta fecha.
              </div>
            ) : (
              activeAbsencesForDate.map((row) => {
                const technician = techniciansById.get(row.technician_id);
                const type =
                  safeText(row.leave_type) ||
                  safeText(row.absence_type) ||
                  "Sin tipo";

                return (
                  <div key={`${row.source}-${row.id}`} className="rounded-md border p-3">
                    <div className="font-medium text-slate-900">
                      {safeText(technician?.full_name) || "Técnico"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.start_date} → {row.end_date}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {type} · {safeText(row.reason) || "Sin motivo"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Origen: {sourceLabel(row.source)}
                    </div>
                    <div className="mt-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${statusBadge(row.status)}`}>
                        {row.status || "sin estado"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}