import { useEffect, useMemo, useState } from "react";
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
 * Selector “tipo chips” (mejor UX que <select multiple>)
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

  const [externalNameInput, setExternalNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

        setTechnicians((profs || []).map((t: any) => ({ id: t.id, full_name: t.full_name })));
      }

      // External recurring technicians: try DB table first, fallback to localStorage
      const { data: extDb, error: extDbErr } = await supabase
        .from("external_technicians")
        .select("id, full_name")
        .order("full_name", { ascending: true });

      if (!extDbErr) {
        setExternalStoreMode("db");
        setExternalTechnicians((extDb || []).map((t: any) => ({ id: t.id, full_name: t.full_name })));
      } else {
        setExternalStoreMode("local");
        const ext = localStorage.getItem("external_technicians");
        if (ext) {
          try {
            setExternalTechnicians(JSON.parse(ext));
          } catch {
            setExternalTechnicians([]);
          }
        }
      }
    })();
  }, []);

  // --- Weekdays + holidays ---
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  useEffect(() => {
    (async () => {
      const y = year;
      const { data, error } = await supabase
        .from("holidays")
        .select("holiday_date")
        .gte("holiday_date", `${y}-01-01`)
        .lte("holiday_date", `${y}-12-31`);

      if (!error) setHolidays(new Set((data || []).map((h: any) => h.holiday_date)));
    })();
  }, [year]);

  const weekdays = useMemo(() => {
    const days: { date: string; label: string }[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      const dateStr = toISODate(d);
      if (isWeekday(dateStr) && !holidays.has(dateStr)) {
        const label = d.toLocaleDateString("es-CL", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        });
        days.push({ date: dateStr, label });
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [year, month, holidays]);

  // --- Initialize drafts ---
  useEffect(() => {
    if (selectedBuildings.length === 0) {
      setDrafts([]);
      return;
    }

    const firstDay = weekdays[0]?.date || toISODate(new Date(year, month, 1));

    setDrafts(
      selectedBuildings
        .map((bid) => buildings.find((b) => b.id === bid))
        .filter(Boolean)
        .map((building) => ({
          building: building!,
          internalTechnicians: [],
          externalTechnicians: [],
          day: firstDay,
          durationOption: 1,
          customDays: 4,
          is_fixed: false,
        }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildings, buildings, month, year, weekdays.length]);

  // --- External recurring add/remove ---
  const persistExternalLocal = (next: ExternalTech[]) => {
    setExternalTechnicians(next);
    localStorage.setItem("external_technicians", JSON.stringify(next));
  };

  const handleAddExternalRecurring = async () => {
    setError("");
    const name = externalNameInput.trim();
    if (!name) return;

    if (externalTechnicians.some((t) => normalize(t.full_name) === normalize(name))) {
      setExternalNameInput("");
      return;
    }

    if (externalStoreMode === "db") {
      const { data, error } = await supabase
        .from("external_technicians")
        .insert([{ full_name: name }])
        .select("id, full_name")
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      setExternalTechnicians((prev) => [...prev, { id: data.id, full_name: data.full_name }]);
      setExternalNameInput("");
      return;
    }

    // local fallback
    const newTech = { id: String(Date.now()), full_name: name };
    persistExternalLocal([...externalTechnicians, newTech]);
    setExternalNameInput("");
  };

  const handleDeleteExternalRecurring = async (id: string) => {
    setError("");

    if (externalStoreMode === "db") {
      const { error } = await supabase.from("external_technicians").delete().eq("id", id);
      if (error) {
        setError(error.message);
        return;
      }
    }

    const next = externalTechnicians.filter((t) => t.id !== id);
    if (externalStoreMode === "local") persistExternalLocal(next);
    else setExternalTechnicians(next);

    // remove from drafts
    setDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        externalTechnicians: d.externalTechnicians.filter((t) => t.id !== id),
      }))
    );
  };

  // --- Draft update helper ---
  const updateDraft = (buildingId: string, patch: Partial<AssignmentDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.building.id === buildingId ? { ...d, ...patch } : d)));
  };

  // --- Save (seguro con tu esquema) ---
  const handleSave = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (drafts.length === 0) {
        setError("Selecciona uno o más edificios.");
        return;
      }

      // Validate: each building must have at least 1 tech (internal or external)
      const invalid = drafts.find((d) => d.internalTechnicians.length === 0 && d.externalTechnicians.length === 0);
      if (invalid) {
        setError(`En "${invalid.building.name}": selecciona al menos 1 técnico interno o 1 externo recurrente.`);
        return;
      }

      const monthStr = monthKey(year, month);

      // IMPORTANT: assigned_technician_id es UUID => SOLO internos (profiles / view).
      // Externos recurrentes NO son UUID => assigned_technician_id debe ser null.
      const rows: any[] = [];

      for (const d of drafts) {
        const durationDays =
          d.durationOption === "custom" ? Math.max(4, Number(d.customDays || 4)) : Number(d.durationOption);

        const completion_type =
          durationDays === 0.5 ? "half_day" : durationDays === 1 ? "full_day" : "multi_day";

        const base = {
          client_id: d.building.id,
          building_name: d.building.name,
          scheduled_date: d.day,
          status: "scheduled",
          is_fixed: !!d.is_fixed,
          is_external: false,
          external_personnel_name: null,
          calendar_month: monthStr,
          completion_type,
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

      {(error || success) && (
        <div
          className={cx(
            "rounded-lg border px-4 py-3 mb-4 text-sm",
            error && "bg-red-50 border-red-200 text-red-800",
            success && "bg-green-50 border-green-200 text-green-800"
          )}
        >
          {error || success}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <label className="block font-medium mb-1">Edificios</label>

          {buildings.length === 0 ? (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded p-2 mt-2">
              No hay edificios disponibles en la base de datos.
            </div>
          ) : (
            <div className="border rounded px-2 py-2 bg-white" style={{ maxHeight: 260, overflowY: "auto" }}>
              <div className="flex items-center justify-between gap-2 mb-2 px-1">
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-700 underline"
                  onClick={() => setSelectedBuildings(buildings.map((b) => b.id))}
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-700 underline"
                  onClick={() => setSelectedBuildings([])}
                >
                  Limpiar
                </button>
              </div>

              {buildings.map((b) => (
                <label key={b.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedBuildings.includes(b.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedBuildings((prev) => [...prev, b.id]);
                      else setSelectedBuildings((prev) => prev.filter((id) => id !== b.id));
                    }}
                  />
                  <span className="font-semibold">{b.name}</span>
                </label>
              ))}
            </div>
          )}

          {/* External recurring */}
          <div className="mt-6">
            <label className="block font-medium mb-2">Técnicos externos recurrentes</label>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={externalNameInput}
                  onChange={(e) => setExternalNameInput(e.target.value)}
                  className="border rounded-lg px-3 py-2 flex-1 min-w-[220px]"
                  placeholder="Agregar nuevo externo"
                />
                <button
                  type="button"
                  onClick={handleAddExternalRecurring}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Guardar
                </button>
              </div>

              <div className="text-xs text-slate-500">
                {externalStoreMode === "db"
                  ? "Se guardan en Supabase (tabla external_technicians)."
                  : "Modo local: se guardan en este navegador (localStorage)."}
              </div>

              <div className="border rounded-lg bg-white overflow-hidden">
                <div className="px-3 py-2 border-b bg-slate-50 text-sm font-semibold text-slate-700">
                  Lista de recurrentes
                </div>
                <div className="max-h-56 overflow-auto">
                  {externalTechnicians.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-slate-500">Aún no tienes externos guardados.</div>
                  ) : (
                    externalTechnicians.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50">
                        <span className="text-sm">{t.full_name}</span>
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-800"
                          onClick={() => handleDeleteExternalRecurring(t.id)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block font-medium mb-1">Año</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="border rounded-lg px-3 py-2 w-28"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Mes</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="border rounded-lg px-3 py-2 w-44"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>
                    {new Date(2000, i, 1).toLocaleString("es-CL", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1" />
          </div>

          {technicians.length === 0 && (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-4">
              No se encontraron técnicos internos. Revisa la vista <b>v_technician_availability_today</b> o la tabla{" "}
              <b>profiles</b>.
            </div>
          )}

          {selectedBuildings.length === 0 ? (
            <div className="text-center text-slate-500 text-lg my-10">
              Selecciona uno o más edificios para planificar mantenimientos.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm mb-4 bg-white">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border px-3 py-2 text-left">Edificio</th>
                    <th className="border px-3 py-2">Internos</th>
                    <th className="border px-3 py-2">Externos recurrentes</th>
                    <th className="border px-3 py-2">Día</th>
                    <th className="border px-3 py-2">Duración</th>
                    <th className="border px-3 py-2">Inamovible</th>
                  </tr>
                </thead>

                <tbody>
                  {drafts.map((d) => (
                    <tr key={d.building.id} className="align-top">
                      <td className="border px-3 py-3 font-semibold text-base whitespace-nowrap">{d.building.name}</td>

                      <td className="border px-3 py-3 min-w-[280px]">
                        <TagPicker
                          items={technicians}
                          selected={d.internalTechnicians}
                          placeholder="Buscar técnico interno..."
                          onChange={(next) => updateDraft(d.building.id, { internalTechnicians: next })}
                        />
                      </td>

                      <td className="border px-3 py-3 min-w-[280px]">
                        <TagPicker
                          items={externalTechnicians}
                          selected={d.externalTechnicians}
                          placeholder="Buscar externo recurrente..."
                          onChange={(next) => updateDraft(d.building.id, { externalTechnicians: next })}
                        />
                      </td>

                      <td className="border px-3 py-3">
                        <select
                          value={d.day}
                          onChange={(e) => updateDraft(d.building.id, { day: e.target.value })}
                          className="border rounded-lg px-3 py-2"
                        >
                          {weekdays.length === 0 ? (
                            <option disabled>No hay días hábiles</option>
                          ) : (
                            weekdays.map((wd) => (
                              <option key={wd.date} value={wd.date}>
                                {wd.label}
                              </option>
                            ))
                          )}
                        </select>
                      </td>

                      <td className="border px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <select
                            value={d.durationOption}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "custom") updateDraft(d.building.id, { durationOption: "custom" });
                              else updateDraft(d.building.id, { durationOption: Number(v) as DurationOption });
                            }}
                            className="border rounded-lg px-3 py-2"
                          >
                            <option value={0.5}>Medio día</option>
                            <option value={1}>1 día</option>
                            <option value={2}>2 días</option>
                            <option value={3}>3 días</option>
                            <option value="custom">Más de 3 días...</option>
                          </select>

                          {d.durationOption === "custom" && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={4}
                                step={1}
                                value={d.customDays}
                                onChange={(e) =>
                                  updateDraft(d.building.id, { customDays: Number(e.target.value || 4) })
                                }
                                className="border rounded-lg px-3 py-2 w-28"
                              />
                              <span className="text-sm text-slate-600">días</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="border px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!d.is_fixed}
                          onChange={(e) => updateDraft(d.building.id, { is_fixed: e.target.checked })}
                          className="w-6 h-6"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar asignaciones"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
