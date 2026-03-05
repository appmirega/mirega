import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Building = {
  id: string;
  name: string;
  client_name?: string | null;
};

type Technician = {
  id: string;
  full_name: string;
  person_type: "internal" | "external";
  company_name: string | null;
};

type AssignmentDraft = {
  buildingId: string;
  date: string; // YYYY-MM-DD
  technicianId: string | null;
  title?: string | null;
};

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function getMonthDays(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function toISODate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function safeName(s?: string | null) {
  return (s || "").trim();
}

function formatTechnicianLabel(t: Technician) {
  const name = safeName(t.full_name) || t.id;
  if (t.person_type === "external") {
    const company = safeName(t.company_name);
    return company ? `${name} (Externo - ${company})` : `${name} (Externo)`;
  }
  return name;
}

export function MaintenanceMassPlannerV2() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [monthDays, setMonthDays] = useState(() => getMonthDays(now.getFullYear(), now.getMonth()));

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<AssignmentDraft[]>([]);

  // ✅ Descontar edificios ya asignados en el mes seleccionado
  const [assignedBuildingIds, setAssignedBuildingIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  const currentMonthKey = useMemo(() => monthKey(year, month), [year, month]);

  const availableBuildings = useMemo(() => {
    if (!assignedBuildingIds || assignedBuildingIds.size === 0) return buildings;
    return buildings.filter((b) => !assignedBuildingIds.has(b.id));
  }, [buildings, assignedBuildingIds]);

  useEffect(() => {
    setMonthDays(getMonthDays(year, month));
  }, [year, month]);

  const monthDates = useMemo(() => {
    const days = getMonthDays(year, month);
    const arr: string[] = [];
    for (let d = 1; d <= days; d++) {
      arr.push(toISODate(year, month, d));
    }
    return arr;
  }, [year, month]);

  // --- Load base data ---
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ data: buildingsData, error: buildingsErr }, { data: techData, error: techErr }] =
          await Promise.all([
            supabase
              .from("buildings")
              .select("id,name,clients(name)")
              .order("name", { ascending: true }),
            supabase
              .from("profiles")
              .select("id,full_name,person_type,company_name")
              .eq("role", "technician")
              .order("full_name", { ascending: true }),
          ]);

        if (buildingsErr) throw buildingsErr;
        if (techErr) throw techErr;

        const mappedBuildings: Building[] = (buildingsData || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          client_name: b.clients?.name ?? null,
        }));

        setBuildings(mappedBuildings);
        setTechnicians((techData || []) as Technician[]);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Error cargando datos");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Cargar qué edificios YA tienen asignación en el mes seleccionado (para ocultarlos del listado)
  useEffect(() => {
    const loadAssigned = async () => {
      try {
        const { data, error } = await supabase
          .from("maintenance_assignments")
          .select("building_id")
          .eq("calendar_month", currentMonthKey);

        if (error) throw error;

        const ids = new Set<string>(
          (data || [])
            .map((r: any) => r?.building_id)
            .filter(Boolean)
        );

        setAssignedBuildingIds(ids);
        setSelectedBuildings((prev) => prev.filter((id) => !ids.has(id)));
      } catch (e: any) {
        console.warn("[MaintenanceMassPlannerV2] Could not load assigned buildings", e);
        setAssignedBuildingIds(new Set());
      }
    };

    if (buildings.length === 0) {
      setAssignedBuildingIds(new Set());
      return;
    }

    loadAssigned();
  }, [currentMonthKey, buildings.length]);

  // Helpers for drafts
  const ensureDraftForBuilding = (buildingId: string) => {
    // Creates drafts for all dates with empty technician by default
    const existing = drafts.filter((d) => d.buildingId === buildingId);
    if (existing.length > 0) return;

    const newDrafts: AssignmentDraft[] = monthDates.map((date) => ({
      buildingId,
      date,
      technicianId: null,
      title: "Mantención",
    }));

    setDrafts((prev) => [...prev, ...newDrafts]);
  };

  const removeDraftsForBuilding = (buildingId: string) => {
    setDrafts((prev) => prev.filter((d) => d.buildingId !== buildingId));
  };

  const toggleBuilding = (buildingId: string) => {
    setSuccess("");
    setError(null);

    setSelectedBuildings((prev) => {
      const exists = prev.includes(buildingId);
      const next = exists ? prev.filter((id) => id !== buildingId) : [...prev, buildingId];

      // Maintain drafts
      if (!exists) ensureDraftForBuilding(buildingId);
      else removeDraftsForBuilding(buildingId);

      return next;
    });
  };

  const setDraftTechnician = (buildingId: string, date: string, technicianId: string | null) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.buildingId === buildingId && d.date === date ? { ...d, technicianId } : d
      )
    );
  };

  const setDraftTitle = (buildingId: string, title: string) => {
    setDrafts((prev) => prev.map((d) => (d.buildingId === buildingId ? { ...d, title } : d)));
  };

  const selectedBuildingObjects = useMemo(() => {
    const set = new Set(selectedBuildings);
    return buildings.filter((b) => set.has(b.id));
  }, [selectedBuildings, buildings]);

  const draftsByBuilding = useMemo(() => {
    const map = new Map<string, AssignmentDraft[]>();
    for (const d of drafts) {
      const arr = map.get(d.buildingId) || [];
      arr.push(d);
      map.set(d.buildingId, arr);
    }
    // sort by date
    map.forEach((arr) => arr.sort((a, b) => a.date.localeCompare(b.date)));
    return map;
  }, [drafts]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess("");

    try {
      if (selectedBuildings.length === 0) {
        throw new Error("Debes seleccionar al menos un edificio.");
      }

      // Build rows for insertion
      const rows = drafts
        .filter((d) => selectedBuildings.includes(d.buildingId))
        .map((d) => ({
          calendar_month: currentMonthKey,
          building_id: d.buildingId,
          event_date: d.date,
          technician_id: d.technicianId,
          title: d.title || "Mantención",
          source: "mass_planner",
          created_at: new Date().toISOString(),
        }));

      if (rows.length === 0) {
        throw new Error("No hay asignaciones para guardar.");
      }

      const { error: insertError } = await supabase.from("maintenance_assignments").insert(rows);
      if (insertError) throw insertError;

      // ✅ Descuenta inmediatamente los edificios asignados en este mes
      if (selectedBuildings.length > 0) {
        setAssignedBuildingIds((prev) => {
          const next = new Set(prev);
          selectedBuildings.forEach((id) => next.add(id));
          return next;
        });
      }

      // Limpia selección/drafts para evitar re-guardar lo mismo
      setSelectedBuildings([]);
      setDrafts([]);

      setSuccess("Asignaciones guardadas correctamente.");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Error guardando asignaciones");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3">
        <div className="text-base font-semibold">Planificador de mantenciones (masivo)</div>
        <div className="text-sm text-slate-500">
          Selecciona edificios y asigna técnicos por día para el mes completo.
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium">Año</label>
          <input
            type="number"
            className="mt-1 w-28 rounded-md border px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Mes</label>
          <select
            className="mt-1 w-56 rounded-md border px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {[
              "Enero",
              "Febrero",
              "Marzo",
              "Abril",
              "Mayo",
              "Junio",
              "Julio",
              "Agosto",
              "Septiembre",
              "Octubre",
              "Noviembre",
              "Diciembre",
            ].map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-slate-600">
          <div>
            Mes: <span className="font-semibold">{currentMonthKey}</span>
          </div>
          <div>Días: {monthDays}</div>
        </div>
      </div>

      {loading && <div className="mt-4 text-sm text-slate-500">Cargando datos...</div>}

      {!loading && (
        <div className="mt-4 flex flex-col gap-4 lg:flex-row">
          {/* LEFT: Buildings list */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <label className="block font-medium mb-1">Edificios</label>

            <div className="text-xs text-slate-500 mb-2">
              Pendientes este mes:{" "}
              <span className="font-semibold text-slate-700">{availableBuildings.length}</span> /{" "}
              {buildings.length}
              {assignedBuildingIds.size > 0 ? " (se ocultan los ya asignados)" : ""}
            </div>

            {buildings.length === 0 ? (
              <div className="text-red-600 bg-red-50 border border-red-200 rounded p-2 mt-2">
                No hay edificios disponibles en la base de datos.
              </div>
            ) : availableBuildings.length === 0 ? (
              <div className="text-slate-700 bg-slate-50 border border-slate-200 rounded p-2 mt-2">
                No hay edificios pendientes para asignar en{" "}
                <span className="font-semibold">{currentMonthKey}</span>.
              </div>
            ) : (
              <div
                className="border rounded px-2 py-2 bg-white"
                style={{ maxHeight: 260, overflowY: "auto" }}
              >
                <div className="flex items-center justify-between gap-2 mb-2 px-1">
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-700 underline"
                    onClick={() => {
                      const ids = availableBuildings.map((b) => b.id);
                      setSelectedBuildings(ids);
                      // crear drafts para los que falten
                      ids.forEach((id) => ensureDraftForBuilding(id));
                    }}
                  >
                    Seleccionar todos
                  </button>

                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-700 underline"
                    onClick={() => {
                      setSelectedBuildings([]);
                      setDrafts([]);
                    }}
                  >
                    Limpiar
                  </button>
                </div>

                {availableBuildings.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBuildings.includes(b.id)}
                      onChange={() => toggleBuilding(b.id)}
                    />
                    <div className="text-sm">
                      <div className="font-medium">{safeName(b.name) || "Edificio"}</div>
                      {safeName(b.client_name) && (
                        <div className="text-xs text-slate-500">{safeName(b.client_name)}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Drafts editor */}
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">Asignaciones del mes</div>
                <div className="text-sm text-slate-500">
                  Define técnico por día (puedes dejar días en blanco y asignar después).
                </div>
              </div>

              <button
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={saving || selectedBuildings.length === 0}
                onClick={handleSave}
              >
                {saving ? "Guardando..." : "Guardar asignaciones"}
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </div>
            )}

            {selectedBuildingObjects.length === 0 ? (
              <div className="mt-6 text-sm text-slate-500">
                Selecciona uno o más edificios para comenzar.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {selectedBuildingObjects.map((b) => {
                  const list = draftsByBuilding.get(b.id) || [];

                  return (
                    <div key={b.id} className="rounded-lg border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold">{safeName(b.name) || "Edificio"}</div>
                          {safeName(b.client_name) && (
                            <div className="text-xs text-slate-500">{safeName(b.client_name)}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            className="w-64 rounded-md border px-3 py-2 text-sm"
                            placeholder="Título (ej: Mantención)"
                            value={list[0]?.title || "Mantención"}
                            onChange={(e) => setDraftTitle(b.id, e.target.value)}
                          />
                          <button
                            type="button"
                            className="rounded-md border bg-white px-3 py-2 text-sm"
                            onClick={() => {
                              toggleBuilding(b.id);
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[720px] border-collapse text-sm">
                          <thead>
                            <tr className="border-b bg-slate-50 text-left">
                              <th className="px-2 py-2">Fecha</th>
                              <th className="px-2 py-2">Técnico</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((d) => (
                              <tr key={`${d.buildingId}-${d.date}`} className="border-b">
                                <td className="px-2 py-2 whitespace-nowrap">{d.date}</td>
                                <td className="px-2 py-2">
                                  <select
                                    className="w-full rounded-md border px-3 py-2 text-sm"
                                    value={d.technicianId || ""}
                                    onChange={(e) =>
                                      setDraftTechnician(
                                        d.buildingId,
                                        d.date,
                                        e.target.value ? e.target.value : null
                                      )
                                    }
                                  >
                                    <option value="">Sin asignar</option>
                                    {technicians.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {formatTechnicianLabel(t)}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}