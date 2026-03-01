import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { ServiceRequest } from "../../../types/serviceRequests";

type ReqStatus = ServiceRequest["status"];

function statusLabel(s: ReqStatus) {
  const map: Record<string, string> = {
    pending: "Pendiente",
    analyzing: "En análisis",
    approved: "Aprobada",
    rejected: "Rechazada",
    in_progress: "En progreso",
    completed: "Completada",
    quotation_sent: "Cotización enviada",
    on_hold: "En espera",
  };
  return map[s] || String(s);
}

export function CoordinationServiceRequestsTab() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ServiceRequest[]>([]);
  const [error, setError] = useState("");

  const [planning, setPlanning] = useState<ServiceRequest | null>(null);
  const [planDate, setPlanDate] = useState<string>(""); // YYYY-MM-DD
  const [planBuildingName, setPlanBuildingName] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select(`
          *,
          clients:clients(company_name, building_name, address),
          elevators:elevators(elevator_number, location_name, brand, model)
        `)
        .in("status", ["pending", "analyzing", "approved"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data ?? []) as ServiceRequest[]);
    } catch (e: any) {
      setError(e?.message || "Error cargando solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const approve = async (id: string) => {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message || "Error aprobando solicitud");
    }
  };

  const reject = async (id: string) => {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message || "Error rechazando solicitud");
    }
  };

  const openPlan = (r: ServiceRequest) => {
    setPlanning(r);
    setPlanDate("");
    setPlanBuildingName(r.clients?.building_name || r.title || "");
  };

  const createAssignmentFromRequest = async () => {
    if (!planning) return;
    if (!planDate) return alert("Selecciona una fecha");
    if (!planning.client_id) return alert("Solicitud sin client_id");

    try {
      const { error } = await supabase.from("maintenance_assignments").insert({
        client_id: planning.client_id,
        building_name: planBuildingName,
        scheduled_date: planDate,
        status: "scheduled",
        is_fixed: false,
        is_external: false,
        external_personnel_name: null,
        assigned_technician_id: null,
        calendar_month: planDate.slice(0, 7), // YYYY-MM
      });

      if (error) throw error;

      const { error: updErr } = await supabase
        .from("service_requests")
        .update({ status: "in_progress" })
        .eq("id", planning.id);

      if (updErr) throw updErr;

      setPlanning(null);
      await load();
      alert("Asignación creada desde solicitud ✅");
    } catch (e: any) {
      alert(e?.message || "Error creando asignación");
    }
  };

  const grouped = useMemo(() => {
    const by: Record<string, ServiceRequest[]> = { pending: [], analyzing: [], approved: [] };
    rows.forEach((r) => {
      if (r.status === "pending") by.pending.push(r);
      else if (r.status === "analyzing") by.analyzing.push(r);
      else if (r.status === "approved") by.approved.push(r);
    });
    return by;
  }, [rows]);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-base font-semibold">Coordinación (Solicitudes)</div>
          <div className="text-sm text-slate-600">
            Aprobar/rechazar y convertir a asignación formal.
          </div>
        </div>
        <button className="rounded-md border bg-white px-3 py-2 text-sm" onClick={load}>
          Recargar
        </button>
      </div>

      {loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(["pending", "analyzing", "approved"] as const).map((st) => (
          <div key={st} className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-semibold">{statusLabel(st as any)}</div>

            <div className="space-y-2">
              {grouped[st].length === 0 ? (
                <div className="text-xs text-slate-500">Sin items</div>
              ) : (
                grouped[st].map((r) => (
                  <div key={r.id} className="rounded-md border p-2">
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-slate-600">
                      Cliente: {r.clients?.company_name || r.client_id} · Edificio:{" "}
                      {r.clients?.building_name || "—"}
                    </div>
                    <div className="text-xs text-slate-600">
                      Prioridad: {r.priority} · Tipo: {r.request_type}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.status !== "approved" ? (
                        <button
                          className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white"
                          onClick={() => approve(r.id)}
                        >
                          Aprobar
                        </button>
                      ) : null}

                      <button
                        className="rounded-md border bg-white px-2 py-1 text-xs"
                        onClick={() => reject(r.id)}
                      >
                        Rechazar
                      </button>

                      {r.status === "approved" ? (
                        <button
                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white"
                          onClick={() => openPlan(r)}
                        >
                          Planificar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {planning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow">
            <div className="mb-2 text-base font-semibold">Planificar solicitud</div>
            <div className="text-sm text-slate-600">{planning.title}</div>

            <div className="mt-3 space-y-3">
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
                  value={planBuildingName}
                  onChange={(e) => setPlanBuildingName(e.target.value)}
                  placeholder="Ej: Torre A - Edificio Los Robles"
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
                  onClick={createAssignmentFromRequest}
                >
                  Crear asignación
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}