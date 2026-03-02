import { useEffect, useMemo, useState } from "react";
import { eachDayOfInterval } from "date-fns";
import { supabase } from "../../lib/supabase";
import { Calendar, UserPlus, Trash2, X } from "lucide-react";

interface Technician {
  id: string;
  full_name: string;
}

interface Building {
  id: string; // client_id
  name: string; // internal_alias
}

interface ExternalTech {
  id: string; // uuid si existe tabla, si no un id local
  full_name: string;
}

type DurationOption = 0.5 | 1 | 2 | 3 | "custom";

interface AssignmentDraft {
  building: Building;
  internalTechnicians: Technician[];
  externalTechnicians: ExternalTech[];
  day: string;
  durationOption: DurationOption;
  customDays: number; // usado si durationOption === "custom"
  is_fixed: boolean;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthKey(year: number, monthIndex0: number) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
}

function isWeekday(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  return dow !== 0 && dow !== 6;
}

/**
 * Selector “chips” (mejor UX que <select multiple>)
 */
function TagPicker<T extends { id: string; full_name: string }>({
  items,
  selected,
  placeholder,
  onChange,
  disabled,
}: {
  items: T[];
  selected: T[];
  placeholder: string;
  onChange: (next: T[]) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const filtered = useMemo(() => {
    const query = normalize(q);
    if (!query) return items.filter((it) => !selectedIds.has(it.id)).slice(0, 12);
    return items
      .filter((it) => !selectedIds.has(it.id))
      .filter((it) => normalize(it.full_name).includes(query))
      .slice(0, 12);
  }, [items, q, selectedIds]);

  return (
    <div className={cx("w-full", disabled && "opacity-60 pointer-events-none")}>
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.length === 0 ? (
          <span className="text-sm text-slate-400">Sin selección</span>
        ) : (
          selected.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-sm"
            >
              {s.full_name}
              <button
                type="button"
                className="text-slate-500 hover:text-slate-900"
                onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
                aria-label="Quitar"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />

        {filtered.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-sm max-h-56 overflow-auto">
            {filtered.map((it) => (
              <button
                key={it.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  onChange([...selected, it]);
                  setQ("");
                }}
              >
                {it.full_name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
  const [externalTechnicians, setExternalTechnicians] = useState<ExternalTech[]>([]);
  const [externalStoreMode, setExternalStoreMode] = useState<"db" | "local">("local");

  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<AssignmentDraft[]>([]);

  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  const monthStart = useMemo(() => {
    const d = new Date(year, month, 1);
    return toISODate(d);
  }, [year, month]);

  const monthEnd = useMemo(() => {
    const d = new Date(year, month + 1, 0);
    return toISODate(d);
  }, [year, month]);

  const [externalNameInput, setExternalNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --- Absences blocking (approved only) ---
  const [absenceLoading, setAbsenceLoading] = useState(false);
  const [absenceError, setAbsenceError] = useState("");
  // Map: technician_id -> Set of blocked days "YYYY-MM-DD"
  const [blockedByTech, setBlockedByTech] = useState<Record<string, Set<string>>>({});

  // --- Load base data ---
  useEffect(() => {
    (async () => {
      // Buildings (clients)
      const { data: clientsData, error: clientsErr } = await supabase
        .from("clients")
        .select("id, internal_alias")
        .order("internal_alias", { ascending: true });

      if (!clientsErr) {
        setBuildings(
          (clientsData || [])
            .filter((e: any) => e.internal_alias && String(e.internal_alias).trim() !== "")
            .map((e: any) => ({ id: e.id, name: e.internal_alias }))
        );
      }

      // Internal technicians: prefer view used by Calendar
      const { data: techView, error: techViewErr } = await supabase
        .from("v_technician_availability_today")
        .select("technician_id, full_name")
        .order("full_name", { ascending: true });

      if (!techViewErr && techView) {
        setTechnicians(
          (techView || [])
            .filter((t: any) => t.technician_id && t.full_name)
            .map((t: any) => ({ id: t.technician_id, full_name: t.full_name }))
        );
      } else {
        // fallback
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "technician")
          .order("full_name", { ascending: true });

        setTechnicians(
          (profs || [])
            .filter((p: any) => p.id && p.full_name)
            .map((p: any) => ({ id: p.id, full_name: p.full_name }))
        );
      }

      // External technicians: if DB exists
      const { data: ext, error: extErr } = await supabase
        .from("external_technicians")
        .select("id, full_name")
        .order("full_name", { ascending: true });

      if (!extErr && ext) {
        setExternalTechnicians(
          (ext || []).filter((x: any) => x.id && x.full_name).map((x: any) => ({ id: x.id, full_name: x.full_name }))
        );
        setExternalStoreMode("db");
      } else {
        setExternalStoreMode("local");
        setExternalTechnicians([]);
      }
    })();
  }, []);

  // --- Load approved absences for this month (blocking) ---
  useEffect(() => {
    (async () => {
      setAbsenceLoading(true);
      setAbsenceError("");

      try {
        const { data, error } = await supabase
          .from("technician_availability")
          .select("technician_id, start_date, end_date, status")
          .eq("status", "approved")
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart);

        if (error) throw error;

        const map: Record<string, Set<string>> = {};

        for (const a of (data ?? []) as any[]) {
          if (!a.technician_id || !a.start_date || !a.end_date) continue;

          const start = new Date(`${a.start_date}T00:00:00`);
          const end = new Date(`${a.end_date}T00:00:00`);
          const days = eachDayOfInterval({ start, end });

          if (!map[a.technician_id]) map[a.technician_id] = new Set<string>();
          for (const d of days) {
            map[a.technician_id].add(toISODate(d));
          }
        }

        setBlockedByTech(map);
      } catch (e: any) {
        setAbsenceError(e?.message || "Error cargando ausencias aprobadas");
        setBlockedByTech({});
      } finally {
        setAbsenceLoading(false);
      }
    })();
  }, [monthStart, monthEnd]);

  // --- helpers ---
  const selectedBuildingsObjects = useMemo(() => {
    const idSet = new Set(selectedBuildings);
    return buildings.filter((b) => idSet.has(b.id));
  }, [buildings, selectedBuildings]);

  useEffect(() => {
    // Rebuild drafts when selected buildings change
    setDrafts((prev) => {
      const byId = new Map(prev.map((d) => [d.building.id, d]));
      const next: AssignmentDraft[] = [];

      for (const b of selectedBuildingsObjects) {
        const existing = byId.get(b.id);
        next.push(
          existing || {
            building: b,
            internalTechnicians: [],
            externalTechnicians: [],
            day: toISODate(new Date(year, month, 1)),
            durationOption: 1,
            customDays: 4,
            is_fixed: false,
          }
        );
      }
      return next;
    });
  }, [selectedBuildingsObjects, month, year]);

  const addExternalLocal = () => {
    const name = externalNameInput.trim();
    if (!name) return;
    const id = `local-${Date.now()}`;
    setExternalTechnicians((prev) => [...prev, { id, full_name: name }]);
    setExternalNameInput("");
  };

  const daysInMonth = useMemo(() => {
    const last = new Date(year, month + 1, 0);
    const out: string[] = [];
    for (let d = 1; d <= last.getDate(); d++) {
      const iso = toISODate(new Date(year, month, d));
      if (isWeekday(iso)) out.push(iso);
    }
    return out;
  }, [year, month]);

  const updateDraft = (buildingId: string, patch: Partial<AssignmentDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.building.id === buildingId ? { ...d, ...patch } : d)));
  };

  // --- Save (CORREGIDO: NO envia completion_type) ---
  const handleSave = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (drafts.length === 0) {
        setError("Selecciona uno o más edificios.");
        return;
      }

      const invalid = drafts.find((d) => d.internalTechnicians.length === 0 && d.externalTechnicians.length === 0);
      if (invalid) {
        setError(`En "${invalid.building.name}": selecciona al menos 1 técnico interno o 1 externo recurrente.`);
        return;
      }

      const monthStr = monthKey(year, month);

      // --- Block planning on approved absence days (internal technicians) ---
      if (absenceLoading) {
        setError("Cargando ausencias aprobadas... intenta nuevamente en unos segundos.");
        return;
      }

      // Si hay error cargando ausencias, no bloqueamos (solo avisamos en consola)
      if (absenceError) {
        console.warn("Absence load error:", absenceError);
      }

      const violations: Array<{ day: string; building: string; techName: string }> = [];

      for (const d of drafts) {
        for (const t of d.internalTechnicians) {
          const blockedSet = blockedByTech[t.id];
          if (blockedSet && blockedSet.has(d.day)) {
            violations.push({ day: d.day, building: d.building.name, techName: t.full_name });
          }
        }
      }

      if (violations.length > 0) {
        const v = violations.slice(0, 6);
        const msg =
          "No puedes asignar técnicos en fechas con ausencias aprobadas:\n" +
          v.map((x) => `• ${x.day} — ${x.techName} (${x.building})`).join("\n") +
          (violations.length > v.length ? `\n…y ${violations.length - v.length} más.` : "");

        setError(msg);
        return;
      }

      const rows: any[] = [];

      for (const d of drafts) {
        const durationDays =
          d.durationOption === "custom" ? Math.max(4, Number(d.customDays || 4)) : Number(d.durationOption);

        const base = {
          client_id: d.building.id,
          building_name: d.building.name,
          scheduled_date: d.day,
          status: "scheduled",
          is_fixed: !!d.is_fixed,
          is_external: false,
          external_personnel_name: null,
          calendar_month: monthStr,

          // OJO: NO enviar completion_type.
          // Tu CHECK permite SOLO: signed / transferred / cancelled
          // completion_type queda NULL (permitido según tu esquema)
        };

        for (const t of d.internalTechnicians) {
          rows.push({
            ...base,
            assigned_technician_id: t.id,
            is_external: false,
            external_personnel_name: null,
          });
        }

        for (const ex of d.externalTechnicians) {
          rows.push({
            ...base,
            assigned_technician_id: null,
            is_external: true,
            external_personnel_name: ex.full_name,
          });
        }

        // Si en el futuro quieres guardar duración en DB:
        // Lo ideal es crear una columna "duration_days" (numeric) o "scheduled_duration_days"
        // y guardarla ahí. Hoy no la tenemos en tu esquema.
        void durationDays;
      }

      const { error: insertError } = await supabase.from("maintenance_assignments").insert(rows);
      if (insertError) throw insertError;

      setSuccess("Asignaciones guardadas correctamente.");
      onSuccess?.();

      setTimeout(() => {
        setSuccess("");
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err?.message || "Error al guardar asignaciones.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-4">
        <Calendar className="w-7 h-7" /> Calendario de mantenimiento (mensual)
      </h2>

      {absenceLoading ? (
        <div className="text-xs text-slate-500 mb-2">Cargando ausencias aprobadas…</div>
      ) : absenceError ? (
        <div className="text-xs text-red-600 mb-2">Ausencias: {absenceError}</div>
      ) : null}

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: selectors */}
        <div className="space-y-4">
          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-2">Mes</div>
            <div className="flex items-center gap-2">
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>
                    {format(new Date(year, i, 1), "MMMM", { locale: es })}
                  </option>
                ))}
              </select>

              <input
                type="number"
                className="border rounded-lg px-3 py-2 text-sm w-28"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Rango: <b>{monthStart}</b> → <b>{monthEnd}</b>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-2">Edificios</div>

            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              multiple
              value={selectedBuildings}
              onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                setSelectedBuildings(opts);
              }}
              size={10}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <div className="mt-2 text-xs text-slate-500">
              Seleccionados: <b>{selectedBuildings.length}</b>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-2 flex items-center justify-between">
              Técnicos externos
              <span className="text-xs text-slate-500">
                modo: <b>{externalStoreMode === "db" ? "DB" : "local"}</b>
              </span>
            </div>

            {externalStoreMode === "local" && (
              <div className="flex gap-2 mb-3">
                <input
                  value={externalNameInput}
                  onChange={(e) => setExternalNameInput(e.target.value)}
                  placeholder="Nombre técnico externo"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addExternalLocal}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-3 py-2 text-sm"
                >
                  <UserPlus className="w-4 h-4" /> Agregar
                </button>
              </div>
            )}

            <div className="text-sm text-slate-600">
              Disponibles: <b>{externalTechnicians.length}</b>
            </div>
          </div>
        </div>

        {/* Right: drafts */}
        <div className="space-y-4">
          <div className="rounded-xl border p-4">
            <div className="font-semibold mb-3">Planificación por edificio</div>

            {drafts.length === 0 ? (
              <div className="text-sm text-slate-500">Selecciona edificios para empezar.</div>
            ) : (
              <div className="space-y-4">
                {drafts.map((d) => (
                  <div key={d.building.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{d.building.name}</div>
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-900"
                        onClick={() => setSelectedBuildings((prev) => prev.filter((id) => id !== d.building.id))}
                        title="Quitar edificio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-1">Día</div>
                        <select
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          value={d.day}
                          onChange={(e) => updateDraft(d.building.id, { day: e.target.value })}
                        >
                          {daysInMonth.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-1">Técnicos internos</div>
                        <TagPicker
                          items={technicians}
                          selected={d.internalTechnicians}
                          placeholder="Buscar técnico..."
                          onChange={(next) => updateDraft(d.building.id, { internalTechnicians: next })}
                        />
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-1">Técnicos externos</div>
                        <TagPicker
                          items={externalTechnicians}
                          selected={d.externalTechnicians}
                          placeholder="Buscar externo..."
                          onChange={(next) => updateDraft(d.building.id, { externalTechnicians: next })}
                          disabled={externalTechnicians.length === 0}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id={`fixed-${d.building.id}`}
                          type="checkbox"
                          checked={d.is_fixed}
                          onChange={(e) => updateDraft(d.building.id, { is_fixed: e.target.checked })}
                        />
                        <label htmlFor={`fixed-${d.building.id}`} className="text-sm text-slate-700">
                          Fija
                        </label>
                      </div>

                      <div className="text-xs text-slate-500">
                        Nota: Si intentas asignar un técnico interno en un día con ausencia aprobada,
                        el sistema lo bloqueará.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border bg-white px-4 py-2 text-sm"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? "Guardando..." : "Guardar asignaciones"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-xs text-slate-600">
              Tip: Se consideran días hábiles (L-V) en el selector de fechas.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}