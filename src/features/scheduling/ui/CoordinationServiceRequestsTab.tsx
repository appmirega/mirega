import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type ServiceRequestRow = {
  id: string;
  title: string | null;
  status: string;
  priority: string | null;
  request_type: string;
  created_at: string;

  client_id: string | null;
  building_name: string | null;
};

function labelStatus(s: string) {
  const map: Record<string, string> = {
    pending: "Pendiente",
    analyzing: "En análisis",
    approved: "Aprobada",
    rejected: "Rechazada",
    in_progress: "En progreso",
    completed: "Completada",
    on_hold: "En espera",
    quotation_sent: "Cotización enviada",
  };
  return map[s] ?? s;
}

function labelType(t: string) {
  const map: Record<string, string> = {
    repair: "Reparación",
    parts: "Repuestos",
    support: "Soporte",
    inspection: "Inspección",
    technical_visit: "Visita técnica",
    certification: "Certificación",
    rescue_training: "Inducción / Rescate",
  };
  return map[t] ?? t;
}

function mapToCalendarEventType(t: string) {
  // Asegura que lo que guardamos en calendar_events sea consistente
  const allowed = new Set([
    "repair",
    "parts",
    "support",
    "inspection",
    "technical_visit",
    "certification",
    "rescue_training",
  ]);
  return allowed.has(t) ? t : "support";
}

export function CoordinationServiceRequestsTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [rows, setRows] = useState<ServiceRequestRow[]>([]);

  // modal planificar
  const [planning, setPlanning] = useState<ServiceRequestRow | null>(null);
  const [planDate, setPlanDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [planBuilding, setPlanBuilding] = useState<string>("");
  const [planTitle, setPlanTitle] = useState<string>("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id,title,status,priority,request_type,created_at,client_id,building_name")
        .in("status", ["pending", "analyzing", "approved"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data ?? []) as ServiceRequestRow[]);
    } catch (e: any) {
      setError(e?.message || "Error cargando service_requests");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const out: Record<string, ServiceRequestRow[]> = { pending: [], analyzing: [], approved: [] };
    for (const r of rows) {
      if (r.status === "pending") out.pending.push(r);
      else if (r.status === "analyzing") out.analyzing.push(r);
      else if (r.status === "approved") out.approved.push(r);
    }
    return out;
  }, [rows]);

  async function setStatus(id: string, status: string) {
    try {
      const { error } = await supabase.from("service_requests").update({ status }).eq("id", id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message || "Error actualizando status");
    }
  }

  function openPlan(r: ServiceRequestRow) {
    setPlanning(r);
    setPlanDate(new Date().toISOString().slice(0, 10));
    setPlanBuilding(r.building_name || "");
    setPlanTitle(r.title || `${labelType(r.request_type)} - ${r.building_name || ""}`.trim());
  }

  async function createCalendarEventFromRequest() {
    if (!planning) return;

    try {
      if (!planDate) throw new Error("Selecciona una fecha");
      if (!planning.client_id) throw new Error("Esta solicitud no tiene client_id");
      if (!planTitle.trim()) throw new Error("Escribe un título");

      const event_type = mapToCalendarEventType(planning.request_type);
      const start_at = `${planDate}T00:00:00`;
      const end_at = `${planDate}T23:59:59`;

      // id estable para evitar duplicados por error: <type>:<requestId>
      const id = `${event_type}:${planning.id}`;

      const { error: insErr } = await supabase.from("calendar_events").insert({
        id,
        event_type,
        source_id: planning.id,
        client_id: planning.client_id,
        building_name: planBuilding || null,
        technician_id: null,
        is_external: false,
        external_personnel_name: null,
        status: "scheduled",
        event_date: planDate,
        start_at,
        end_at,
        title: planTitle.trim(),
      });

      if (insErr) throw insErr;

      // solicitud pasa a in_progress cuando ya existe evento real
      const { error: updErr } = await supabase
        .from("service_requests")
        .update({ status: "in_progress" })
        .eq("id", planning.id);

      if (updErr) throw updErr;

      setPlanning(null);
      await load();
      alert("Asignación creada ✅ (calendar_events)");
    } catch (e: any) {
      alert(e?.message || "Error creando calendar_event");
    }
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Coordinación (solicitudes)</div>
          <div className="text-xs text-slate-500">
            Aprueba / rechaza y convierte solicitudes en asignaciones reales del calendario.
          </div>
        </div>

        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(["pending", "analyzing", "approved"] as const).map((status) => (
          <div key={status} className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-semibold">{labelStatus(status)}</div>

            {grouped[status].length === 0 ? (
              <div className="text-xs text-slate-500">Sin solicitudes</div>
            ) : (
              <div className="space-y-2">
                {grouped[status].map((r) => (
                  <div key={r.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{r.title || "(Sin título)"}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          Tipo: <b>{labelType(r.request_type)}</b> · Prioridad: <b>{r.priority || "—"}</b>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Edificio: <b>{r.building_name || "—"}</b>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {(r.status === "pending" || r.status === "analyzing") && (
                          <>
                            <button
                              className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white"
                              onClick={() => setStatus(r.id, "approved")}
                            >
                              Aprobar
                            </button>
                            <button
                              className="rounded-md bg-rose-600 px-2 py-1 text-xs text-white"
                              onClick={() => setStatus(r.id, "rejected")}
                            >
                              Rechazar
                            </button>
                          </>
                        )}

                        {r.status === "approved" && (
                          <button
                            className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white"
                            onClick={() => openPlan(r)}
                          >
                            Planificar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL PLANIFICAR */}
      {planning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow">
            <div className="text-base font-semibold">Planificar solicitud</div>
            <div className="mt-1 text-sm text-slate-600">
              {labelType(planning.request_type)} • {planning.title || "(Sin título)"}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-700">Fecha</div>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700">Edificio / Identificador</div>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={planBuilding}
                  onChange={(e) => setPlanBuilding(e.target.value)}
                  placeholder="Ej: Torre A - Edificio Los Robles"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-700">Título</div>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="Ej: Reparación - Torre A"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className="rounded-md border bg-white px-3 py-2 text-sm"
                  onClick={() => setPlanning(null)}
                >
                  Cancelar
                </button>
                <button
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
                  onClick={createCalendarEventFromRequest}
                >
                  Crear asignación
                </button>
              </div>

              <div className="text-xs text-slate-500">
                Esto crea un evento real en <b>calendar_events</b> y cambia la solicitud a <b>in_progress</b>.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}