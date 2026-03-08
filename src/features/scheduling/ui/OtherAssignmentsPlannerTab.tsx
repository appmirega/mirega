import { useEffect, useMemo, useRef, useState } from "react";
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

type PlannerBuilding = {
  id: string;
  name: string;
  address?: string | null;
  client_name?: string | null;
  source: "building" | "client";
};

type ClientRow = {
  id: string;
  company_name: string | null;
  building_name: string | null;
  address?: string | null;
};

function safeText(value?: string | null) {
  return (value ?? "").trim();
}

function normalizeText(value?: string | null) {
  return safeText(value).toLowerCase();
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
  const [plannerBuildings, setPlannerBuildings] = useState<PlannerBuilding[]>([]);

  const [buildingSearch, setBuildingSearch] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const [loadingBase, setLoadingBase] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(eventDate) && Boolean(title.trim()) && Boolean(buildingName.trim());
  }, [eventDate, title, buildingName]);

  const selectedBuilding = useMemo(() => {
    return (
      plannerBuildings.find(
        (item) => normalizeText(item.name) === normalizeText(buildingName)
      ) ?? null
    );
  }, [plannerBuildings, buildingName]);

  const filteredBuildings = useMemo(() => {
    const term = normalizeText(buildingSearch || buildingName);

    const source = plannerBuildings.filter((item) => safeText(item.name));

    if (!term) return source.slice(0, 10);

    return source
      .filter((item) => {
        const haystack = [
          safeText(item.name),
          safeText(item.client_name),
          safeText(item.address),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      })
      .slice(0, 10);
  }, [plannerBuildings, buildingName, buildingSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadBaseData = async () => {
      setLoadingBase(true);
      setMsg(null);

      try {
        const [
          { data: technicianData, error: technicianError },
          { data: buildingData, error: buildingError },
          { data: clientData, error: clientError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, role, person_type, company_name")
            .eq("role", "technician")
            .order("full_name", { ascending: true }),
          supabase
            .from("buildings")
            .select("id, name, address")
            .order("name", { ascending: true }),
          supabase
            .from("clients")
            .select("id, company_name, building_name, address")
            .order("company_name", { ascending: true }),
        ]);

        if (technicianError) throw technicianError;
        if (buildingError) throw buildingError;
        if (clientError) throw clientError;

        if (!mounted) return;

        const buildings = (buildingData ?? []) as Array<any>;
        const clients = (clientData ?? []) as ClientRow[];

        let sourceRows: PlannerBuilding[] = [];

        if (buildings.length > 0) {
          sourceRows = buildings.map((item) => {
            const matchingClient =
              clients.find(
                (client) =>
                  normalizeText(client.building_name) === normalizeText(item.name)
              ) ?? null;

            return {
              id: item.id,
              name: item.name,
              address: item.address ?? null,
              client_name: matchingClient?.company_name ?? null,
              source: "building" as const,
            };
          });
        } else {
          sourceRows = clients
            .filter((client) => safeText(client.building_name))
            .map((client) => ({
              id: client.id,
              name: safeText(client.building_name),
              address: client.address ?? null,
              client_name: client.company_name ?? null,
              source: "client" as const,
            }));
        }

        const uniqueRows = sourceRows.filter(
          (item, index, arr) =>
            arr.findIndex((x) => normalizeText(x.name) === normalizeText(item.name)) ===
            index
        );

        setPlannerBuildings(uniqueRows);
        setTechnicians((technicianData ?? []) as TechnicianOption[]);
      } catch (error: any) {
        if (!mounted) return;
        console.error(error);
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

  const handleSelectBuilding = (building: PlannerBuilding) => {
    setBuildingName(building.name);
    setBuildingSearch(building.name);
    setShowSuggestions(false);
  };

  const createAssignment = async () => {
    setMsg(null);

    if (!canSubmit) {
      setMsg({
        kind: "err",
        text: "Completa Fecha, Edificio y Título.",
      });
      return;
    }

    setSaving(true);

    try {
      const technician =
        technicians.find((item) => item.id === technicianId) ?? null;

      const person = technician ? safeText(technician.full_name) : "";
      const finalDescription = [title.trim(), description.trim()]
        .filter(Boolean)
        .join(" — ");

      const payload = {
        event_type: type,
        event_date: eventDate,
        person: person || null,
        description: finalDescription || title.trim(),
        building_name: buildingName.trim(),
      };

      const { error } = await supabase.from("calendar_events").insert(payload);

      if (error) throw error;

      setMsg({
        kind: "ok",
        text: "Asignación operativa creada correctamente.",
      });

      setTitle("");
      setBuildingName("");
      setBuildingSearch("");
      setTechnicianId("");
      setDescription("");
      setShowSuggestions(false);
    } catch (error: any) {
      console.error(error);
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
          Puedes buscar y seleccionar un edificio existente.
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

        <div className="md:col-span-2" ref={containerRef}>
          <label className="text-sm font-medium">Edificio</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Escribe o selecciona un edificio"
            value={buildingSearch || buildingName}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setBuildingSearch(e.target.value);
              setBuildingName(e.target.value);
              setShowSuggestions(true);
            }}
          />

          {selectedBuilding && (
            <div className="mt-2 rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Cliente: <b>{safeText(selectedBuilding.client_name) || "—"}</b>
              {safeText(selectedBuilding.address)
                ? ` · Dirección: ${safeText(selectedBuilding.address)}`
                : ""}
            </div>
          )}

          {showSuggestions && (
            <div className="mt-2 rounded-lg border bg-white shadow-sm">
              {filteredBuildings.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-500">
                  No hay coincidencias. Puedes escribir el nombre manualmente.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {filteredBuildings.map((building) => (
                    <button
                      key={building.id}
                      type="button"
                      className="block w-full border-b px-3 py-3 text-left hover:bg-slate-50 last:border-b-0"
                      onClick={() => handleSelectBuilding(building)}
                    >
                      <div className="font-medium text-slate-900">
                        {building.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {safeText(building.client_name) || "Sin cliente"}
                        {safeText(building.address)
                          ? ` · ${safeText(building.address)}`
                          : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-1 text-xs text-slate-500">
            Puedes seleccionar una sugerencia o escribir manualmente si el edificio no existe aún.
          </div>
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

        <div>
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