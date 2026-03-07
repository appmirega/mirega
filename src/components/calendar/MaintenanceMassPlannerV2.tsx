import React, { useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { supabase } from "../../lib/supabase";

type Building = {
  id: string;
  name: string;
  address?: string | null;
  client_id?: string | null;
  client_name?: string | null;
};

type Technician = {
  id: string;
  full_name: string | null;
  person_type: "internal" | "external" | null;
  company_name?: string | null;
  is_active?: boolean | null;
};

type MonthAssignmentRow = {
  id: string;
  building_id: string | null;
  assigned_technician_id: string | null;
  scheduled_date: string;
  status?: string | null;
};

type AssignmentDraft = {
  buildingId: string;
  scheduledDate: string;
  technicianId: string;
};

function safeText(value?: string | null) {
  return (value ?? "").trim();
}

function formatTechnicianLabel(technician: Technician) {
  const name = safeText(technician.full_name) || technician.id;

  if (technician.person_type === "external") {
    const company = safeText(technician.company_name);
    return company ? `${name} (Externo - ${company})` : `${name} (Externo)`;
  }

  return name;
}

export function MaintenanceMassPlannerV2() {
  const now = new Date();

  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth());

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [monthAssignments, setMonthAssignments] = useState<MonthAssignmentRow[]>([]);

  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AssignmentDraft>>({});

  const [bulkDate, setBulkDate] = useState<string>(
    format(startOfMonth(now), "yyyy-MM-dd")
  );
  const [bulkTechnicianId, setBulkTechnicianId] = useState<string>("");

  const [search, setSearch] = useState<string>("");
  const [loadingBase, setLoadingBase] = useState<boolean>(false);
  const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const monthStart = useMemo(
    () => format(startOfMonth(new Date(year, month, 1)), "yyyy-MM-dd"),
    [year, month]
  );

  const monthEnd = useMemo(
    () => format(endOfMonth(new Date(year, month, 1)), "yyyy-MM-dd"),
    [year, month]
  );

  const monthLabel = useMemo(
    () => format(new Date(year, month, 1), "yyyy-MM"),
    [year, month]
  );

  const buildingsById = useMemo(() => {
    const map = new Map<string, Building>();
    buildings.forEach((building) => map.set(building.id, building));
    return map;
  }, [buildings]);

  const techniciansById = useMemo(() => {
    const map = new Map<string, Technician>();
    technicians.forEach((technician) => map.set(technician.id, technician));
    return map;
  }, [technicians]);

  const assignedBuildingIds = useMemo(() => {
    return new Set(
      monthAssignments
        .map((assignment) => assignment.building_id)
        .filter(Boolean) as string[]
    );
  }, [monthAssignments]);

  const pendingBuildings = useMemo(() => {
    const term = search.trim().toLowerCase();

    return buildings.filter((building) => {
      if (assignedBuildingIds.has(building.id)) return false;

      if (!term) return true;

      const haystack = [
        safeText(building.name),
        safeText(building.address),
        safeText(building.client_name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [assignedBuildingIds, buildings, search]);

  const selectedBuildingObjects = useMemo(() => {
    const selectedSet = new Set(selectedBuildings);
    return pendingBuildings.filter((building) => selectedSet.has(building.id));
  }, [pendingBuildings, selectedBuildings]);

  const plannedAssignments = useMemo(() => {
    return [...monthAssignments].sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) {
        return a.scheduled_date.localeCompare(b.scheduled_date);
      }

      const aName = safeText(buildingsById.get(a.building_id || "")?.name);
      const bName = safeText(buildingsById.get(b.building_id || "")?.name);

      return aName.localeCompare(bName);
    });
  }, [monthAssignments, buildingsById]);

  useEffect(() => {
    setBulkDate(monthStart);
    setSelectedBuildings([]);
    setDrafts({});
    setError("");
    setSuccess("");
  }, [monthStart]);

  useEffect(() => {
    const loadBaseData = async () => {
      setLoadingBase(true);
      setError("");

      try {
        const [{ data: buildingsData, error: buildingsError }, { data: clientsData, error: clientsError }, { data: techniciansData, error: techniciansError }] =
          await Promise.all([
            supabase
              .from("buildings")
              .select("id, name, address, client_id, is_active")
              .eq("is_active", true)
              .order("name", { ascending: true }),
            supabase
              .from("clients")
              .select("id, company_name")
              .order("company_name", { ascending: true }),
            supabase
              .from("profiles")
              .select("id, full_name, role, person_type, company_name, is_active")
              .in("role", ["technician", "Technician", "tecnico", "técnico"])
              .order("full_name", { ascending: true }),
          ]);

        if (buildingsError) throw buildingsError;
        if (clientsError) throw clientsError;
        if (techniciansError) throw techniciansError;

        const clientsMap = new Map<string, string>();
        (clientsData ?? []).forEach((client: any) => {
          clientsMap.set(client.id, client.company_name);
        });

        const mappedBuildings: Building[] = (buildingsData ?? []).map((item: any) => ({
          id: item.id,
          name: item.name,
          address: item.address ?? null,
          client_id: item.client_id ?? null,
          client_name: item.client_id ? clientsMap.get(item.client_id) ?? null : null,
        }));

        setBuildings(mappedBuildings);
        setTechnicians((techniciansData ?? []) as Technician[]);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "No fue posible cargar edificios, clientes y técnicos.");
      } finally {
        setLoadingBase(false);
      }
    };

    void loadBaseData();
  }, []);

  useEffect(() => {
    const loadAssignmentsForMonth = async () => {
      setLoadingAssignments(true);
      setError("");

      try {
        const { data, error } = await supabase
          .from("maintenance_assignments")
          .select("id, building_id, assigned_technician_id, scheduled_date, status")
          .gte("scheduled_date", monthStart)
          .lte("scheduled_date", monthEnd)
          .order("scheduled_date", { ascending: true });

        if (error) throw error;

        setMonthAssignments((data ?? []) as MonthAssignmentRow[]);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "No fue posible cargar las asignaciones del mes.");
        setMonthAssignments([]);
      } finally {
        setLoadingAssignments(false);
      }
    };

    void loadAssignmentsForMonth();
  }, [monthEnd, monthStart]);

  const ensureDraft = (buildingId: string) => {
    setDrafts((prev) => {
      if (prev[buildingId]) return prev;

      return {
        ...prev,
        [buildingId]: {
          buildingId,
          scheduledDate: bulkDate || monthStart,
          technicianId: bulkTechnicianId,
        },
      };
    });
  };

  const removeDraft = (buildingId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[buildingId];
      return next;
    });
  };

  const toggleBuilding = (buildingId: string) => {
    setError("");
    setSuccess("");

    setSelectedBuildings((prev) => {
      const exists = prev.includes(buildingId);
      const next = exists ? prev.filter((id) => id !== buildingId) : [...prev, buildingId];

      if (exists) removeDraft(buildingId);
      else ensureDraft(buildingId);

      return next;
    });
  };

  const updateDraft = (buildingId: string, patch: Partial<AssignmentDraft>) => {
    setDrafts((prev) => {
      const current = prev[buildingId] ?? {
        buildingId,
        scheduledDate: bulkDate || monthStart,
        technicianId: bulkTechnicianId,
      };

      return {
        ...prev,
        [buildingId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const handleSelectAllPending = () => {
    const ids = pendingBuildings.map((building) => building.id);
    setSelectedBuildings(ids);

    setDrafts((prev) => {
      const next = { ...prev };

      ids.forEach((id) => {
        if (!next[id]) {
          next[id] = {
            buildingId: id,
            scheduledDate: bulkDate || monthStart,
            technicianId: bulkTechnicianId,
          };
        }
      });

      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedBuildings([]);
    setDrafts({});
    setError("");
    setSuccess("");
  };

  const applyBulkValues = () => {
    if (selectedBuildings.length === 0) {
      setError("Selecciona al menos un edificio para aplicar la asignación masiva.");
      return;
    }

    setError("");
    setSuccess("");

    setDrafts((prev) => {
      const next = { ...prev };

      selectedBuildings.forEach((buildingId) => {
        next[buildingId] = {
          buildingId,
          scheduledDate: bulkDate || monthStart,
          technicianId: bulkTechnicianId,
        };
      });

      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (selectedBuildings.length === 0) {
        throw new Error("Debes seleccionar al menos un edificio.");
      }

      const rows = selectedBuildings.map((buildingId) => {
        const draft = drafts[buildingId];

        if (!draft) {
          throw new Error("Hay edificios seleccionados sin datos de asignación.");
        }

        if (!draft.scheduledDate) {
          throw new Error("Cada edificio debe tener una fecha asignada.");
        }

        if (!draft.technicianId) {
          throw new Error("Cada edificio debe tener un técnico asignado.");
        }

        return {
          building_id: buildingId,
          assigned_technician_id: draft.technicianId,
          scheduled_date: draft.scheduledDate,
          scheduled_time_start: "09:00",
          scheduled_time_end: "11:00",
          estimated_duration_hours: 2,
          is_fixed: false,
          assignment_type: "mantenimiento",
          status: "pending",
          notes: null,
        };
      });

      const { error } = await supabase.from("maintenance_assignments").insert(rows);
      if (error) throw error;

      const { data: refreshedData, error: refreshError } = await supabase
        .from("maintenance_assignments")
        .select("id, building_id, assigned_technician_id, scheduled_date, status")
        .gte("scheduled_date", monthStart)
        .lte("scheduled_date", monthEnd)
        .order("scheduled_date", { ascending: true });

      if (refreshError) throw refreshError;

      setMonthAssignments((refreshedData ?? []) as MonthAssignmentRow[]);
      setSelectedBuildings([]);
      setDrafts({});
      setSuccess(
        "Mantenciones asignadas correctamente. Los edificios ya salieron del listado pendiente de este mes."
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible guardar las asignaciones.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-4">
        <div className="text-base font-semibold">Planificador de mantenciones</div>
        <div className="text-sm text-slate-500">
          Muestra los edificios pendientes del mes seleccionado. Al asignar fecha y técnico,
          el edificio sale del listado pendiente solo para ese mes.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="block text-sm font-medium">Año</label>
          <input
            type="number"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Mes</label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
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
            ].map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Buscar edificio</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Nombre del edificio, dirección o cliente"
          />
        </div>

        <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <div>
            Mes seleccionado: <span className="font-semibold">{monthLabel}</span>
          </div>
          <div>
            Pendientes: <span className="font-semibold">{pendingBuildings.length}</span>
          </div>
          <div>
            Ya planificados: <span className="font-semibold">{plannedAssignments.length}</span>
          </div>
        </div>
      </div>

      {(loadingBase || loadingAssignments) && (
        <div className="mt-4 text-sm text-slate-500">Cargando información...</div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {!loadingBase && !loadingAssignments && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="mb-2">
              <div className="font-medium text-slate-900">Edificios pendientes</div>
              <div className="text-xs text-slate-500">
                Estos edificios volverán a aparecer completos al cambiar al mes siguiente.
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                className="font-semibold text-slate-700 underline"
                onClick={handleSelectAllPending}
                disabled={pendingBuildings.length === 0}
              >
                Seleccionar todos
              </button>

              <button
                type="button"
                className="font-semibold text-slate-700 underline"
                onClick={handleClearSelection}
                disabled={selectedBuildings.length === 0}
              >
                Limpiar selección
              </button>
            </div>

            {pendingBuildings.length === 0 ? (
              <div className="rounded-md border bg-white p-3 text-sm text-slate-600">
                No hay edificios pendientes para {monthLabel}.
              </div>
            ) : (
              <div className="max-h-[500px] space-y-1 overflow-y-auto rounded-md border bg-white p-2">
                {pendingBuildings.map((building) => (
                  <label
                    key={building.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedBuildings.includes(building.id)}
                      onChange={() => toggleBuilding(building.id)}
                    />
                    <div className="min-w-0 text-sm">
                      <div className="font-medium text-slate-900">
                        {safeText(building.name) || "Edificio"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {safeText(building.client_name) || "Sin cliente"}{" "}
                        {safeText(building.address) ? `· ${safeText(building.address)}` : ""}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">Asignación masiva</div>
                  <div className="text-sm text-slate-500">
                    Aplica una fecha y un técnico a los edificios seleccionados. Luego puedes ajustar cada fila si lo necesitas.
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-md border bg-white px-3 py-2 text-sm"
                  onClick={applyBulkValues}
                  disabled={selectedBuildings.length === 0}
                >
                  Aplicar a seleccionados
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Fecha</label>
                  <input
                    type="date"
                    value={bulkDate}
                    onChange={(event) => setBulkDate(event.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Técnico</label>
                  <select
                    value={bulkTechnicianId}
                    onChange={(event) => setBulkTechnicianId(event.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar técnico</option>
                    {technicians.map((technician) => (
                      <option key={technician.id} value={technician.id}>
                        {formatTechnicianLabel(technician)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">Edificios seleccionados</div>
                  <div className="text-sm text-slate-500">
                    Cada edificio recibe una sola asignación de mantención dentro del mes seleccionado.
                  </div>
                </div>

                <button
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  disabled={saving || selectedBuildings.length === 0}
                  onClick={handleSave}
                >
                  {saving ? "Guardando..." : "Guardar mantenciones"}
                </button>
              </div>

              {selectedBuildingObjects.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-slate-500">
                  Selecciona uno o más edificios desde la lista de pendientes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left">
                        <th className="px-3 py-2">Edificio</th>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Técnico</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBuildingObjects.map((building) => {
                        const draft = drafts[building.id] ?? {
                          buildingId: building.id,
                          scheduledDate: bulkDate || monthStart,
                          technicianId: bulkTechnicianId,
                        };

                        return (
                          <tr key={building.id} className="border-b">
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {safeText(building.name) || "Edificio"}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {safeText(building.client_name) || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={draft.scheduledDate}
                                onChange={(event) =>
                                  updateDraft(building.id, { scheduledDate: event.target.value })
                                }
                                className="w-full rounded-md border px-3 py-2 text-sm"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={draft.technicianId}
                                onChange={(event) =>
                                  updateDraft(building.id, { technicianId: event.target.value })
                                }
                                className="w-full rounded-md border px-3 py-2 text-sm"
                              >
                                <option value="">Seleccionar técnico</option>
                                {technicians.map((technician) => (
                                  <option key={technician.id} value={technician.id}>
                                    {formatTechnicianLabel(technician)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                className="rounded-md border bg-white px-3 py-2 text-sm"
                                onClick={() => toggleBuilding(building.id)}
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-white p-4">
              <div className="mb-3 font-medium text-slate-900">
                Ya planificados en {monthLabel}
              </div>

              {plannedAssignments.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Todavía no hay mantenciones planificadas para este mes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Edificio</th>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Técnico</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plannedAssignments.map((assignment) => {
                        const building = buildingsById.get(assignment.building_id || "");
                        const technician = assignment.assigned_technician_id
                          ? techniciansById.get(assignment.assigned_technician_id)
                          : undefined;

                        return (
                          <tr key={assignment.id} className="border-b">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {assignment.scheduled_date}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {safeText(building?.name) || "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {safeText(building?.client_name) || "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {technician ? formatTechnicianLabel(technician) : "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {safeText(assignment.status) || "pending"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}