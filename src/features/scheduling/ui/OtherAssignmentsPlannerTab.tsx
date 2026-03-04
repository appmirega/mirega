import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type OtherAssignmentType =
  | "repair"
  | "certification_visit"
  | "rescue_induction"
  | "rescue_training"
  | "technical_visit";

const TYPE_LABEL: Record<OtherAssignmentType, string> = {
  repair: "Reparación",
  certification_visit: "Visita certificación",
  rescue_induction: "Inducción rescate",
  rescue_training: "Capacitación rescate",
  technical_visit: "Visita técnica",
};

type TechnicianOption = {
  id: string;
  full_name: string;
};

export default function OtherAssignmentsPlannerTab() {
  const [type, setType] = useState<OtherAssignmentType>("repair");
  const [date, setDate] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [technicianId, setTechnicianId] = useState<string>("");
  const [techs, setTechs] = useState<TechnicianOption[]>([]);
  const [loadingTechs, setLoadingTechs] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const canSubmit = useMemo(() => {
    return Boolean(date) && Boolean(title.trim());
  }, [date, title]);

  useEffect(() => {
    let mounted = true;

    const loadTechs = async () => {
      setLoadingTechs(true);
      setMsg(null);

      // Ajusta este select según tu tabla real.
      // En muchos proyectos "profiles" tiene full_name / display_name.
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name", { ascending: true });

      if (!mounted) return;

      if (error) {
        setTechs([]);
        setMsg({
          kind: "err",
          text: `No pude cargar técnicos (profiles): ${error.message}`,
        });
      } else {
        setTechs((data ?? []).filter(Boolean) as TechnicianOption[]);
      }

      setLoadingTechs(false);
    };

    loadTechs();

    return () => {
      mounted = false;
    };
  }, []);

  const createAssignment = async () => {
    setMsg(null);

    if (!canSubmit) {
      setMsg({
        kind: "err",
        text: "Completa al menos Fecha y Título.",
      });
      return;
    }

    setSaving(true);

    // Creamos un evento genérico en calendar_events (si tu app usa otra tabla, dime cuál y lo ajusto).
    // Campos comunes: type, title, event_date, technician_id
    const payload: any = {
      type,
      title: title.trim(),
      event_date: date, // yyyy-mm-dd
      technician_id: technicianId || null,
      source: "manual_other_assignments",
    };

    const { error } = await supabase.from("calendar_events").insert(payload);

    if (error) {
      setMsg({
        kind: "err",
        text: `No se pudo crear la asignación: ${error.message}`,
      });
      setSaving(false);
      return;
    }

    setMsg({ kind: "ok", text: "Asignación creada correctamente." });
    setTitle("");
    setTechnicianId("");
    setSaving(false);
  };

  return (
    <div className="bg-white border rounded-xl p-4">
      <h2 className="text-lg font-semibold">Crear asignación manual</h2>
      <p className="text-sm text-slate-500 mb-4">
        Registra reparaciones, inducciones/capacitaciones y otras actividades.
      </p>

      {msg && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            msg.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Tipo</label>
          <select
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={type}
            onChange={(e) => setType(e.target.value as OtherAssignmentType)}
          >
            {(
              Object.keys(TYPE_LABEL) as Array<keyof typeof TYPE_LABEL>
            ).map((k) => (
              <option key={k} value={k}>
                {TYPE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Fecha</label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Técnico</label>
          <select
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            disabled={loadingTechs}
          >
            <option value="">Sin asignar</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
          {loadingTechs && (
            <p className="text-xs text-slate-500 mt-1">Cargando técnicos…</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Título</label>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2"
            placeholder="Ej: Reparación motor / Inducción rescate edificio X"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={createAssignment}
          disabled={saving || !canSubmit}
          className={`px-4 py-2 rounded-lg text-white ${
            saving || !canSubmit
              ? "bg-slate-400"
              : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          {saving ? "Creando..." : "Crear asignación"}
        </button>
      </div>
    </div>
  );
}