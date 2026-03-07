import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type AssignmentType =
  | "repair"
  | "technical_visit"
  | "inspection"
  | "certification"
  | "rescue_training"
  | "other";

const TYPE_LABEL: Record<AssignmentType, string> = {
  repair: "Reparación",
  technical_visit: "Visita técnica",
  inspection: "Inspección",
  certification: "Certificación",
  rescue_training: "Capacitación / rescate",
  other: "Otro",
};

type TechnicianOption = {
  id: string;
  full_name: string | null;
  person_type?: "internal" | "external" | null;
  company_name?: string | null;
};

type BuildingOption = {
  id: string;
  name: string;
};

function safeText(value?: string | null) {
  return (value ?? "").trim();
}

function technicianLabel(tech: TechnicianOption) {
  const base = safeText(tech.full_name) || tech.id;
  if (tech.person_type === "external") {
    const company = safeText(tech.company_name);
    return company ? `${base} (Externo - ${company})` : `${base} (Externo)`;
  }
  return base;
}

export function OtherAssignmentsPlannerTab() {
  const [type, setType] = useState<AssignmentType>("repair");
  const [eventDate, setEventDate] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [buildingName, setBuildingName] = useState<string>("");
  const [technicianId, setTechnicianId] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);

  const [loadingBase, setLoadingBase] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(eventDate) && Boolean(title.trim());
  }, [eventDate, title]);

  useEffect(() => {
    let mounted = true;

    const loadBaseData = async () => {
      setLoadingBase(true);
      setMsg(null);

      try {
        const [
          { data: technicianData, error: technicianError },
          { data: buildingData, error: buildingError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, role, person_type, company_name")
            .eq("role", "technician")
            .order("full_name", { ascending: true }),
          supabase
            .from("buildings")
            .select("id, name")
            .order("name", { ascending: true }),
        ]);

        if (technicianError) throw technicianError;
        if (buildingError) throw buildingError;

        if (!mounted) return;

        setTechnicians((technicianData ?? []) as TechnicianOption[]);
        setBuildings((buildingData ?? []) as BuildingOption[]);
      } catch (error: any) {
        if (!mounted) return;
        setMsg({
          kind: "err",
          text: error?.message || "No fue posible cargar técnicos y edificios.",
        });
      } finally {
        if (mounted) setLoadingBase(false);
      }
    };

    void loadBaseData();

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

    try {
      const technician =
        technicians.find((item) => item.id === technicianId) ?? null;

      const person = technician ? safeText(technician.full_name) : "";

      const finalDescription = [
        title.trim(),
        description.trim(),
      ]
        .filter(Boolean)
        .join(" — ");

      const payload = {
        event_type: type,
        event_date: eventDate,
        person: person || null,
        description: finalDescription || title.trim(),
        building_name: buildingName.trim() || null,
      };

      const { error } = await supabase.from("calendar_events").insert(payload);

      if (error) throw error;

      setMsg({
        kind: "ok",
        text: "Asignación operativa creada correctamente.",
      });

      setTitle("");
      setBuildingName("");
      setTechnicianId("");
      setDescription("");
    } catch (error: any) {
      setMsg({
        kind: "err",
        text: error?.message || "No se pudo crear la asignación operativa.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-4">
        <div className="text-base font-semibold">Asignaciones operativas</div>
        <div className="text-sm text-slate-500">
          Programa trabajos que no corresponden a mantenciones ni a turnos de emergencia.
        </div>
      </div>

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Tipo</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={type}
            onChange={(e) => setType(e.target.value as AssignmentType)}
          >
            {(Object.keys(TYPE_LABEL) as AssignmentType[]).map((key) => (
              <option key={key} value={key}>
                {TYPE_LABEL[key]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Fecha</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Edificio</label>
          <input
            list="buildings-list"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Escribe o selecciona un edificio"
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
          />
          <datalist id="buildings-list">
            {buildings.map((building) => (
              <option key={building.id} value={building.name} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="text-sm font-medium">Técnico</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            disabled={loadingBase}
          >
            <option value="">Sin asignar</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {technicianLabel(tech)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium">Título</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Ej: Reparación tablero - Torre B"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium">Descripción / notas</label>
          <textarea
            className="mt-1 w-full rounded-lg border px-3 py-2"
            rows={4}
            placeholder="Detalle del trabajo programado"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={createAssignment}
          disabled={saving || !canSubmit}
          className={`rounded-lg px-4 py-2 text-white ${
            saving || !canSubmit
              ? "bg-slate-400"
              : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          {saving ? "Creando..." : "Crear asignación operativa"}
        </button>
      </div>
    </div>
  );
}