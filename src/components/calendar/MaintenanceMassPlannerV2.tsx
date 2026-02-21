import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Calendar, UserPlus, X, Trash2 } from "lucide-react";

interface Technician {
  id: string;
  full_name: string;
}

interface ExternalTech {
  id: string;
  name: string;
}

interface Building {
  id: string;
  name: string;
}

interface AssignmentDraft {
  building: Building;
  internalTechnicians: Technician[];
  externalTechnicians: ExternalTech[];
  day: string;
  duration: number; // UI solamente (tu BD no tiene duration)
  is_fixed: boolean;
  status: "ok" | "conflict" | "blocked";
  conflictMsg?: string;
}

export function MaintenanceMassPlannerV2({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [externalCatalog, setExternalCatalog] = useState<ExternalTech[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<AssignmentDraft[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  // UX state
  const [leftExternalSearch, setLeftExternalSearch] = useState("");
  const [newExternalName, setNewExternalName] = useState("");

  // per-row search inputs & dropdown visibility
  const [internalSearchByBuilding, setInternalSearchByBuilding] = useState<Record<string, string>>({});
  const [externalSearchByBuilding, setExternalSearchByBuilding] = useState<Record<string, string>>({});
  const [showInternalDrop, setShowInternalDrop] = useState<Record<string, boolean>>({});
  const [showExternalDrop, setShowExternalDrop] = useState<Record<string, boolean>>({});

  // duration UI (select: preset/custom) + custom value
  const [durationModeByBuilding, setDurationModeByBuilding] = useState<Record<string, "preset" | "custom">>({});
  const [customDurationByBuilding, setCustomDurationByBuilding] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---------- Helpers ----------
  const normalize = (s: string) => s.trim().toLowerCase();

  const getWeekdays = () => {
    const days: { date: string; label: string }[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        const label = d.toLocaleDateString("es-CL", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        });
        days.push({ date: d.toISOString().slice(0, 10), label });
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  const weekdays = useMemo(() => getWeekdays(), [month, year]);

  const refreshExternalCatalog = async () => {
    const { data, error } = await supabase
      .from("external_technicians")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("external_technicians load error:", error);
      setError(error.message || "No se pudo cargar catálogo de técnicos externos.");
      return;
    }
    setExternalCatalog((data || []).map((r: any) => ({ id: r.id, name: r.name })));
  };

  // ---------- Initial load ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      try {
        const [clientsRes, techsRes] = await Promise.all([
          supabase.from("clients").select("id, internal_alias"),
          supabase
            .from("profiles")
            .select("id, full_name")
            .eq("role", "technician")
            .order("full_name", { ascending: true }),
        ]);

        if (clientsRes.error) throw clientsRes.error;
        if (techsRes.error) throw techsRes.error;

        const clients = clientsRes.data || [];
        const techs = techsRes.data || [];

        setBuildings(
          clients
            .filter((e: any) => e.internal_alias && e.internal_alias.trim() !== "")
            .map((e: any) => ({ id: e.id, name: e.internal_alias }))
        );

        setTechnicians(techs.map((t: any) => ({ id: t.id, full_name: t.full_name })));

        await refreshExternalCatalog();
      } catch (e: any) {
        console.error("initial load error:", e);
        setError(e?.message || "Error cargando datos.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- Draft init ----------
  useEffect(() => {
    if (selectedBuildings.length === 0) {
      setDrafts([]);
      return;
    }

    setDrafts(
      selectedBuildings
        .map((bid) => buildings.find((b) => b.id === bid))
        .filter(Boolean)
        .map((building) => ({
          building: building!,
          internalTechnicians: [],
          externalTechnicians: [],
          day: weekdays[0]?.date || "",
          duration: 1,
          is_fixed: false,
          status: "ok",
        }))
    );

    const initModes: Record<string, "preset" | "custom"> = {};
    const initCustom: Record<string, string> = {};
    selectedBuildings.forEach((bid) => {
      initModes[bid] = "preset";
      initCustom[bid] = "";
    });
    setDurationModeByBuilding(initModes);
    setCustomDurationByBuilding(initCustom);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildings, buildings, month, year]);

  // ---------- Draft operations ----------
  const addInternal = (buildingId: string, tech: Technician) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.building.id !== buildingId) return d;
        if (d.internalTechnicians.some((t) => t.id === tech.id)) return d;
        return { ...d, internalTechnicians: [...d.internalTechnicians, tech] };
      })
    );
  };

  const removeInternal = (buildingId: string, techId: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.building.id === buildingId
          ? { ...d, internalTechnicians: d.internalTechnicians.filter((t) => t.id !== techId) }
          : d
      )
    );
  };

  const addExternalRecurrent = (buildingId: string, ext: ExternalTech) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.building.id !== buildingId) return d;
        if (d.externalTechnicians.some((t) => t.id === ext.id)) return d;
        return { ...d, externalTechnicians: [...d.externalTechnicians, ext] };
      })
    );
  };

  const removeExternalRecurrent = (buildingId: string, extId: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.building.id === buildingId
          ? { ...d, externalTechnicians: d.externalTechnicians.filter((t) => t.id !== extId) }
          : d
      )
    );
  };

  const handleDayChange = (buildingId: string, date: string) => {
    setDrafts((prev) => prev.map((d) => (d.building.id === buildingId ? { ...d, day: date } : d)));
  };

  const handleFixedChange = (buildingId: string, isFixed: boolean) => {
    setDrafts((prev) => prev.map((d) => (d.building.id === buildingId ? { ...d, is_fixed: isFixed } : d)));
  };

  const setDuration = (buildingId: string, duration: number) => {
    setDrafts((prev) => prev.map((d) => (d.building.id === buildingId ? { ...d, duration } : d)));
  };

  // ---------- External catalog actions ----------
  const handleCreateExternal = async () => {
    const name = newExternalName.trim();
    if (!name) return;

    setError("");
    try {
      if (externalCatalog.some((x) => normalize(x.name) === normalize(name))) {
        setNewExternalName("");
        return;
      }

      const { error } = await supabase.from("external_technicians").insert({ name });
      if (error) throw error;

      setNewExternalName("");
      await refreshExternalCatalog();
    } catch (e: any) {
      setError(e.message || "No se pudo guardar técnico externo.");
    }
  };

  const handleDeleteExternal = async (id: string) => {
    setError("");
    try {
      const { error } = await supabase.from("external_technicians").delete().eq("id", id);
      if (error) throw error;

      setDrafts((prev) =>
        prev.map((d) => ({
          ...d,
          externalTechnicians: d.externalTechnicians.filter((t) => t.id !== id),
        }))
      );

      await refreshExternalCatalog();
    } catch (e: any) {
      setError(e.message || "No se pudo eliminar técnico externo.");
    }
  };

  const filteredExternalCatalog = useMemo(() => {
    const q = normalize(leftExternalSearch);
    if (!q) return externalCatalog;
    return externalCatalog.filter((e) => normalize(e.name).includes(q));
  }, [externalCatalog, leftExternalSearch]);

  // ✅✅✅ SAVE CORREGIDO PARA TU ESQUEMA REAL ✅✅✅
  const handleSave = async () => {
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const toSave = drafts.filter((d) => d.status === "ok");

      if (toSave.length === 0) {
        setError("No hay asignaciones válidas para guardar.");
        setSaving(false);
        return;
      }

      const hasAny = toSave.every(
        (d) => d.internalTechnicians.length > 0 || d.externalTechnicians.length > 0
      );

      if (!hasAny) {
        setError("Cada edificio debe tener al menos 1 técnico interno o externo.");
        setSaving(false);
        return;
      }

      const assignments = toSave.flatMap((draft) => {
        const base = {
          client_id: draft.building.id,         // ✅ columna real
          building_name: draft.building.name,   // ✅ NOT NULL en tu tabla
          scheduled_date: draft.day,            // ✅ columna real
          status: "scheduled",
          is_fixed: draft.is_fixed,
          // opcional (tu tabla lo tiene): "2026-2" etc
          calendar_month: `${year}-${String(month + 1).padStart(2, "0")}`,
        };

        const internals = draft.internalTechnicians.map((t) => ({
          ...base,
          assigned_technician_id: t.id,     // ✅ columna real
          is_external: false,
          external_personnel_name: null,
        }));

        const externals = draft.externalTechnicians.map((t) => ({
          ...base,
          assigned_technician_id: null,
          is_external: true,
          external_personnel_name: t.name,  // ✅ columna real
        }));

        return [...internals, ...externals];
      });

      const { error: insertError } = await supabase
        .from("maintenance_assignments")
        .insert(assignments);

      if (insertError) throw insertError;

      setSuccess("Asignaciones guardadas correctamente.");
      onSuccess?.();

      setTimeout(() => {
        setSuccess("");
        onClose();
      }, 1200);
    } catch (e: any) {
      setError(e.message || "Error al guardar asignaciones.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Calendar className="w-7 h-7" /> Planificación Masiva de Mantenimiento
      </h2>

      {(loading || saving) && <div className="mb-3 text-sm text-gray-600">{loading ? "Cargando..." : "Guardando..."}</div>}

      {error && <div className="mb-4 text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
      {success && <div className="mb-4 text-green-700 bg-green-50 border border-green-200 rounded p-2">{success}</div>}

      <div className="flex gap-6">
        {/* LEFT */}
        <div className="w-72 flex-shrink-0">
          <label className="block font-medium mb-1">Edificios</label>
          {buildings.length === 0 ? (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded p-2 mt-2">No hay edificios disponibles.</div>
          ) : (
            <div className="border rounded px-2 py-2 bg-white" style={{ maxHeight: 220, overflowY: "auto" }}>
              {buildings.map((b) => (
                <label key={b.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedBuildings.includes(b.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedBuildings([...selectedBuildings, b.id]);
                      else setSelectedBuildings(selectedBuildings.filter((id) => id !== b.id));
                    }}
                  />
                  <span className="font-semibold">{b.name}</span>
                </label>
              ))}
            </div>
          )}

          {/* External catalog */}
          <div className="mt-6">
            <label className="block font-medium mb-1">Técnicos externos recurrentes</label>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newExternalName}
                onChange={(e) => setNewExternalName(e.target.value)}
                className="border rounded px-2 py-2 flex-1 min-w-[200px]"
                placeholder="Agregar nuevo externo"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateExternal();
                }}
              />
              <button
                type="button"
                onClick={handleCreateExternal}
                className="bg-green-600 text-white px-3 py-2 rounded flex items-center justify-center gap-1 w-full sm:w-auto"
              >
                <UserPlus className="w-4 h-4" /> Guardar
              </button>
            </div>

            <input
              type="text"
              value={leftExternalSearch}
              onChange={(e) => setLeftExternalSearch(e.target.value)}
              className="border rounded px-2 py-2 w-full mt-3"
              placeholder="Buscar externo..."
            />

            <div className="border rounded px-2 py-2 bg-white mt-2" style={{ maxHeight: 220, overflowY: "auto" }}>
              {filteredExternalCatalog.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">No hay externos recurrentes.</div>
              ) : (
                filteredExternalCatalog.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-sm">{e.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteExternal(e.id)}
                      className="text-red-600 hover:bg-red-50 rounded p-1"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="text-xs text-gray-500 mt-1">Estos externos quedan guardados para futuras asignaciones.</div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex-1 min-w-0">
          <div className="flex gap-4 mb-4">
            <div>
              <label className="block font-medium mb-1">Año</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded px-2 py-1 w-24" />
            </div>
            <div>
              <label className="block font-medium mb-1">Mes</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded px-2 py-1 w-32">
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>
                    {new Date(2000, i, 1).toLocaleString("es-CL", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {technicians.length === 0 && (
            <div className="mb-4 text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              No se encontraron técnicos internos. Revisa que en <b>profiles</b> exista <b>role = "technician"</b>.
            </div>
          )}

          {selectedBuildings.length === 0 ? (
            <div className="text-center text-gray-500 text-lg my-10">Selecciona uno o más edificios para planificar mantenimientos.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-base mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-4 py-2">Edificio</th>
                    <th className="border px-4 py-2">Internos</th>
                    <th className="border px-4 py-2">Externos recurrentes</th>
                    <th className="border px-4 py-2">Día</th>
                    <th className="border px-4 py-2">Duración</th>
                    <th className="border px-4 py-2">Inamovible</th>
                  </tr>
                </thead>

                <tbody>
                  {drafts.map((draft) => {
                    const buildingId = draft.building.id;

                    const internalQuery = internalSearchByBuilding[buildingId] || "";
                    const externalQuery = externalSearchByBuilding[buildingId] || "";

                    const internalSuggestions = technicians
                      .filter((t) => normalize(t.full_name).includes(normalize(internalQuery)))
                      .slice(0, 10);

                    const externalSuggestions = externalCatalog
                      .filter((t) => normalize(t.name).includes(normalize(externalQuery)))
                      .slice(0, 10);

                    const durationMode = durationModeByBuilding[buildingId] || "preset";
                    const customDurStr = customDurationByBuilding[buildingId] || "";

                    return (
                      <tr key={buildingId}>
                        <td className="border px-4 py-2 font-semibold text-lg">{draft.building.name}</td>

                        {/* Internos */}
                        <td className="border px-4 py-2 align-top">
                          <div className="flex flex-wrap gap-2 mb-2">
                            {draft.internalTechnicians.map((t) => (
                              <span key={t.id} className="inline-flex items-center gap-1 bg-gray-100 border rounded-full px-2 py-1 text-sm">
                                {t.full_name}
                                <button type="button" onClick={() => removeInternal(buildingId, t.id)} className="hover:bg-gray-200 rounded-full p-0.5" title="Quitar">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>

                          <input
                            value={internalQuery}
                            onChange={(e) => setInternalSearchByBuilding((p) => ({ ...p, [buildingId]: e.target.value }))}
                            onFocus={() => setShowInternalDrop((p) => ({ ...p, [buildingId]: true }))}
                            onBlur={() => setTimeout(() => setShowInternalDrop((p) => ({ ...p, [buildingId]: false })), 150)}
                            className="border rounded px-2 py-2 w-full"
                            placeholder="Buscar técnico interno..."
                          />

                          {showInternalDrop[buildingId] && (
                            <div className="mt-2 border rounded bg-white max-h-44 overflow-auto">
                              {internalSuggestions.length === 0 ? (
                                <div className="text-sm text-gray-500 p-2">Sin resultados</div>
                              ) : (
                                internalSuggestions.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      addInternal(buildingId, t);
                                      setInternalSearchByBuilding((p) => ({ ...p, [buildingId]: "" }));
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                                  >
                                    {t.full_name}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </td>

                        {/* Externos recurrentes */}
                        <td className="border px-4 py-2 align-top">
                          <div className="flex flex-wrap gap-2 mb-2">
                            {draft.externalTechnicians.map((t) => (
                              <span key={t.id} className="inline-flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2 py-1 text-sm">
                                {t.name}
                                <button type="button" onClick={() => removeExternalRecurrent(buildingId, t.id)} className="hover:bg-green-100 rounded-full p-0.5" title="Quitar">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>

                          <input
                            value={externalQuery}
                            onChange={(e) => setExternalSearchByBuilding((p) => ({ ...p, [buildingId]: e.target.value }))}
                            onFocus={() => setShowExternalDrop((p) => ({ ...p, [buildingId]: true }))}
                            onBlur={() => setTimeout(() => setShowExternalDrop((p) => ({ ...p, [buildingId]: false })), 150)}
                            className="border rounded px-2 py-2 w-full"
                            placeholder="Buscar externo recurrente..."
                          />

                          {showExternalDrop[buildingId] && (
                            <div className="mt-2 border rounded bg-white max-h-44 overflow-auto">
                              {externalSuggestions.length === 0 ? (
                                <div className="text-sm text-gray-500 p-2">Sin resultados</div>
                              ) : (
                                externalSuggestions.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      addExternalRecurrent(buildingId, t);
                                      setExternalSearchByBuilding((p) => ({ ...p, [buildingId]: "" }));
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                                  >
                                    {t.name}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </td>

                        {/* Día */}
                        <td className="border px-4 py-2 align-top">
                          <select value={draft.day} onChange={(e) => handleDayChange(buildingId, e.target.value)} className="border rounded px-2 py-2 text-base w-full">
                            {weekdays.length === 0 ? (
                              <option disabled>No hay días hábiles</option>
                            ) : (
                              weekdays.map((d) => (
                                <option key={d.date} value={d.date}>
                                  {d.label}
                                </option>
                              ))
                            )}
                          </select>
                        </td>

                        {/* Duración (solo UI) */}
                        <td className="border px-4 py-2 align-top">
                          <div className="flex flex-col gap-2">
                            <select
                              value={durationMode === "custom" ? "custom" : String(draft.duration)}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "custom") {
                                  setDurationModeByBuilding((p) => ({ ...p, [buildingId]: "custom" }));
                                  setCustomDurationByBuilding((p) => ({
                                    ...p,
                                    [buildingId]: p[buildingId] || (draft.duration > 3 ? String(draft.duration) : "4"),
                                  }));
                                  setDuration(buildingId, 4);
                                } else {
                                  setDurationModeByBuilding((p) => ({ ...p, [buildingId]: "preset" }));
                                  setDuration(buildingId, Number(v));
                                }
                              }}
                              className="border rounded px-2 py-2 text-base w-full"
                            >
                              <option value="0.5">Medio día</option>
                              <option value="1">1 día</option>
                              <option value="2">2 días</option>
                              <option value="3">3 días</option>
                              <option value="custom">Personalizado (&gt; 3)</option>
                            </select>

                            {durationMode === "custom" && (
                              <div className="flex gap-2 items-center">
                                <input
                                  type="number"
                                  min={0.5}
                                  step={0.5}
                                  value={customDurStr}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomDurationByBuilding((p) => ({ ...p, [buildingId]: val }));
                                    const n = Number(val);
                                    if (!Number.isFinite(n)) return;
                                    setDuration(buildingId, n);
                                  }}
                                  className="border rounded px-2 py-2 w-full"
                                  placeholder="Ej: 4, 6, 10..."
                                />
                                <span className="text-sm text-gray-600 whitespace-nowrap">días</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Inamovible */}
                        <td className="border px-4 py-2 text-center align-top">
                          <input type="checkbox" checked={!!draft.is_fixed} onChange={(e) => handleFixedChange(buildingId, e.target.checked)} className="w-6 h-6" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-4 mt-8">
            <button type="button" onClick={onClose} className="px-6 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50" disabled={saving}>
              Cancelar
            </button>
            <button type="button" onClick={handleSave} className="px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60" disabled={saving}>
              Guardar Asignaciones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
