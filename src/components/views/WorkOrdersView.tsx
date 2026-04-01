import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  assignTechnicianToWorkOrder,
  createWorkOrder,
  getPartsCatalog,
  getWorkOrderItems,
  getWorkOrdersForAdmin,
  saveWorkOrderItems,
  updateWorkOrder,
  type WorkOrderCreateInput,
} from "../../lib/workOrdersService";
import type { WorkOrderAdminRow } from "../../lib/workOrdersService";
import type { WorkOrderItemType } from "../../types/workOrderItems";
import type { PartCatalogItem } from "../../types/parts";

type ClientRow = {
  id: string;
  company_name: string | null;
  building_name?: string | null;
};

type ElevatorRow = {
  id: string;
  client_id: string | null;
  elevator_number: number | null;
  tower_name: string | null;
  index_number: number | null;
  location_building: string | null;
  model: string | null;
};

type TechnicianRow = {
  id: string;
  full_name: string | null;
};

type ItemScopeType = "single_elevator" | "all_selected_elevators";

type FormItem = {
  localId: string;
  item_type: WorkOrderItemType;
  description: string;
  quantity: number;
  unit: string;
  part_catalog_id?: string;
  warranty_months?: number;
  notes: string;
  sort_order: number;
  scope_type: ItemScopeType;
  target_elevator_id: string;
};

type CreateFormState = {
  title: string;
  description: string;
  client_id: string;
  building_id: string;
  work_type: string;
  quotation_number: string;
  quotation_pdf_url: string;
  estimated_days: string;
  required_technicians: string;
  is_internal: boolean;
  valid_until: string;
  priority: string;
};

type ServiceRequestForOT = {
  id: string;
  title: string;
  description: string;
  client_id: string | null;
  elevator_id: string | null;
  priority: string | null;
  created_at: string;
  request_type: string | null;
  intervention_type: string | null;
  clients?: {
    company_name: string | null;
    building_name: string | null;
  } | null;
  elevators?: {
    elevator_number: number | null;
    tower_name?: string | null;
    location_name?: string | null;
    location_building?: string | null;
    model?: string | null;
  } | null;
};

const emptyForm = (): CreateFormState => ({
  title: "",
  description: "",
  client_id: "",
  building_id: "",
  work_type: "repair",
  quotation_number: "",
  quotation_pdf_url: "",
  estimated_days: "",
  required_technicians: "1",
  is_internal: true,
  valid_until: "",
  priority: "medium",
});

function formatDate(date?: string) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("es-CL");
  } catch {
    return date;
  }
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "draft":
      return "Borrador";
    case "waiting_client_approval":
      return "Esperando aprobación cliente";
    case "approved":
      return "Aprobada";
    case "assigned":
      return "Asignada";
    case "in_progress":
      return "En progreso";
    case "completed":
      return "Completada";
    case "cancelled":
      return "Cancelada";
    case "expired":
      return "Vencida";
    default:
      return status || "—";
  }
}

function getApprovalLabel(status?: string) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "approved":
      return "Aprobada";
    case "rejected":
      return "Rechazada";
    case "approved_by_admin_override":
      return "Aprobada por admin";
    default:
      return status || "—";
  }
}

function getElevatorLabel(elevator: ElevatorRow) {
  const elevatorNumber =
    elevator.elevator_number !== null && elevator.elevator_number !== undefined
      ? `Ascensor #${elevator.elevator_number}`
      : "Ascensor";

  if (elevator.tower_name) {
    return `${elevatorNumber} — ${elevator.tower_name}`;
  }

  if (elevator.location_building) {
    return `${elevatorNumber} — ${elevator.location_building}`;
  }

  if (elevator.index_number !== null && elevator.index_number !== undefined) {
    return `${elevatorNumber} — Nº interno ${elevator.index_number}`;
  }

  if (elevator.model) {
    return `${elevatorNumber} — ${elevator.model}`;
  }

  return elevatorNumber;
}

function getRequestTypeLabel(type?: string | null) {
  switch (type) {
    case "repair":
      return "Trabajos / Reparación";
    case "parts":
      return "Repuestos";
    case "diagnostic":
      return "Diagnóstico Técnico";
    default:
      return type || "Solicitud";
  }
}

function getInterventionLabel(type?: string | null) {
  switch (type) {
    case "preventive":
      return "Preventivo";
    case "corrective":
      return "Correctivo";
    case "improvement":
      return "Mejora / Modernización";
    default:
      return type || "—";
  }
}

function mapRequestTypeToWorkType(requestType?: string | null): string {
  switch (requestType) {
    case "parts":
      return "repair";
    case "diagnostic":
      return "inspection";
    case "repair":
    default:
      return "repair";
  }
}

function getRequestElevatorLabel(request: ServiceRequestForOT) {
  const elevatorNumber =
    request.elevators?.elevator_number !== null &&
    request.elevators?.elevator_number !== undefined
      ? `Ascensor #${request.elevators.elevator_number}`
      : "Ascensor";

  const towerOrLocation =
    request.elevators?.tower_name ||
    request.elevators?.location_name ||
    request.elevators?.location_building ||
    request.elevators?.model;

  return towerOrLocation ? `${elevatorNumber} — ${towerOrLocation}` : elevatorNumber;
}

export function WorkOrdersView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [uploadingQuotation, setUploadingQuotation] = useState(false);

  const [workOrders, setWorkOrders] = useState<WorkOrderAdminRow[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [elevators, setElevators] = useState<ElevatorRow[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [partsCatalog, setPartsCatalog] = useState<PartCatalogItem[]>([]);

  const [requestsForOT, setRequestsForOT] = useState<ServiceRequestForOT[]>([]);
  const [selectedServiceRequestId, setSelectedServiceRequestId] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(emptyForm());
  const [selectedElevatorIds, setSelectedElevatorIds] = useState<string[]>([]);
  const [items, setItems] = useState<FormItem[]>([]);
  const [assignTechnicianMap, setAssignTechnicianMap] = useState<Record<string, string>>({});
  const [selectedQuotationFile, setSelectedQuotationFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");

  const selectedWorkOrder = useMemo(
    () => workOrders.find((wo) => wo.id === selectedWorkOrderId) ?? null,
    [workOrders, selectedWorkOrderId]
  );

  const filteredElevators = useMemo(() => {
    if (!form.client_id) return [];

    const filtered = elevators.filter((elevator) => elevator.client_id === form.client_id);
    const unique = new Map<string, ElevatorRow>();

    for (const elevator of filtered) {
      const key = `${elevator.client_id}-${elevator.tower_name ?? ""}-${elevator.index_number ?? ""}-${elevator.elevator_number ?? ""}`;
      if (!unique.has(key)) {
        unique.set(key, elevator);
      }
    }

    return Array.from(unique.values());
  }, [elevators, form.client_id]);

  const selectedElevators = useMemo(() => {
    return filteredElevators.filter((elevator) => selectedElevatorIds.includes(elevator.id));
  }, [filteredElevators, selectedElevatorIds]);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedWorkOrderId) {
      setSelectedItems([]);
      return;
    }
    void loadItems(selectedWorkOrderId);
  }, [selectedWorkOrderId]);

  async function loadRequestsForOT() {
    const { data, error } = await supabase
      .from("service_requests")
      .select(`
        id,
        title,
        description,
        client_id,
        elevator_id,
        priority,
        created_at,
        request_type,
        intervention_type,
        clients:client_id (
          company_name,
          building_name
        ),
        elevators:elevator_id (
          elevator_number,
          tower_name,
          location_name,
          location_building,
          model
        )
      `)
      .eq("status", "processing")
      .eq("workflow_path", "quotation_ot")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setRequestsForOT((data as ServiceRequestForOT[]) || []);
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [
        workOrdersData,
        clientsRes,
        elevatorsRes,
        techniciansRes,
        partsData,
      ] = await Promise.all([
        getWorkOrdersForAdmin(),
        supabase
          .from("clients")
          .select("id, company_name, building_name")
          .order("company_name", { ascending: true }),
        supabase
          .from("elevators")
          .select("id, client_id, elevator_number, tower_name, index_number, location_building, model")
          .order("tower_name", { ascending: true })
          .order("index_number", { ascending: true })
          .order("elevator_number", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "technician")
          .eq("is_active", true)
          .order("full_name", { ascending: true }),
        getPartsCatalog(),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (elevatorsRes.error) throw elevatorsRes.error;
      if (techniciansRes.error) throw techniciansRes.error;

      setWorkOrders(workOrdersData);
      setClients((clientsRes.data ?? []) as ClientRow[]);
      setElevators((elevatorsRes.data ?? []) as ElevatorRow[]);
      setTechnicians((techniciansRes.data ?? []) as TechnicianRow[]);
      setPartsCatalog(partsData);

      await loadRequestsForOT();

      if (workOrdersData.length > 0 && !selectedWorkOrderId) {
        setSelectedWorkOrderId(workOrdersData[0].id);
      }
    } catch (err: any) {
      console.error("Error loading work orders:", err);
      setError(err?.message || "No fue posible cargar las órdenes de trabajo.");
    } finally {
      setLoading(false);
    }
  }

  async function loadItems(workOrderId: string) {
    try {
      const data = await getWorkOrderItems(workOrderId);
      setSelectedItems(data);
    } catch (err) {
      console.error("Error loading work order items:", err);
      setSelectedItems([]);
    }
  }

  function updateForm<K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "client_id") {
        setSelectedElevatorIds([]);
      }

      return next;
    });
  }

  function toggleElevatorSelection(elevatorId: string) {
    setSelectedElevatorIds((prev) =>
      prev.includes(elevatorId)
        ? prev.filter((id) => id !== elevatorId)
        : [...prev, elevatorId]
    );
  }

  function addItem(itemType: WorkOrderItemType) {
    setItems((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        item_type: itemType,
        description: "",
        quantity: 1,
        unit: itemType === "labor" ? "servicio" : "unidad",
        notes: "",
        sort_order: prev.length,
        scope_type: "single_elevator",
        target_elevator_id: selectedElevatorIds[0] || "",
      },
    ]);
  }

  function updateItem(localId: string, patch: Partial<FormItem>) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) return item;

        const next = { ...item, ...patch };

        if (patch.part_catalog_id) {
          const selectedPart = partsCatalog.find((p) => p.id === patch.part_catalog_id);
          if (selectedPart) {
            next.description = selectedPart.name;
            next.warranty_months = selectedPart.default_warranty_months ?? 0;
            next.unit = "unidad";
          }
        }

        if (patch.scope_type === "all_selected_elevators") {
          next.target_elevator_id = "";
        }

        return next;
      })
    );
  }

  function removeItem(localId: string) {
    setItems((prev) =>
      prev
        .filter((item) => item.localId !== localId)
        .map((item, index) => ({ ...item, sort_order: index }))
    );
  }

  function resetCreateForm() {
    setShowCreateForm(false);
    setForm(emptyForm());
    setItems([]);
    setSelectedQuotationFile(null);
    setSelectedElevatorIds([]);
    setSelectedServiceRequestId(null);
  }

  function prefillFromServiceRequest(req: ServiceRequestForOT) {
    setSelectedServiceRequestId(req.id);
    setShowCreateForm(true);
    setForm({
      ...emptyForm(),
      title: req.title || "",
      description: req.description || "",
      client_id: req.client_id || "",
      building_id: "",
      work_type: mapRequestTypeToWorkType(req.request_type),
      quotation_number: "",
      quotation_pdf_url: "",
      estimated_days: "",
      required_technicians: "1",
      is_internal: true,
      valid_until: "",
      priority: req.priority || "medium",
    });
    setSelectedElevatorIds(req.elevator_id ? [req.elevator_id] : []);
    setItems([]);
    setSelectedQuotationFile(null);
  }

  async function uploadQuotationPdf(file: File, quotationNumber: string): Promise<string> {
    const safeQuotation = quotationNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileExt = file.name.split(".").pop() || "pdf";
    const fileName = `${Date.now()}_${safeQuotation}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("quotation-pdfs")
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("quotation-pdfs").getPublicUrl(fileName);

    return publicUrl;
  }

  async function handleCreateWorkOrder() {
    setSaving(true);
    setError("");

    try {
      if (!form.title.trim()) {
        throw new Error("Debes ingresar un título para la OT.");
      }
      if (!form.client_id) {
        throw new Error("Debes seleccionar un cliente.");
      }
      if (selectedElevatorIds.length === 0) {
        throw new Error("Debes seleccionar al menos un ascensor.");
      }
      if (!form.quotation_number.trim()) {
        throw new Error("Debes ingresar el número de cotización.");
      }
      if (!selectedQuotationFile && !form.quotation_pdf_url.trim()) {
        throw new Error("Debes adjuntar el PDF de cotización o ingresar su URL.");
      }
      if (items.length === 0) {
        throw new Error("Debes agregar al menos un ítem de trabajo.");
      }

      const invalidSingleScope = items.some(
        (item) => item.scope_type === "single_elevator" && !item.target_elevator_id
      );

      if (invalidSingleScope) {
        throw new Error(
          "Hay ítems configurados para un ascensor específico sin ascensor asignado."
        );
      }

      let quotationPdfUrl = form.quotation_pdf_url.trim();

      if (selectedQuotationFile) {
        setUploadingQuotation(true);
        quotationPdfUrl = await uploadQuotationPdf(
          selectedQuotationFile,
          form.quotation_number.trim()
        );
      }

      const primaryElevatorId = selectedElevatorIds[0];

      const createInput: WorkOrderCreateInput = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        client_id: form.client_id,
        building_id: undefined,
        elevator_id: primaryElevatorId || undefined,
        work_type: (form.work_type as WorkOrderCreateInput["work_type"]) || "repair",
        quotation_number: form.quotation_number.trim(),
        quotation_pdf_url: quotationPdfUrl,
        estimated_days: form.estimated_days ? Number(form.estimated_days) : null,
        required_technicians: form.required_technicians
          ? Number(form.required_technicians)
          : 1,
        is_internal: form.is_internal,
        valid_until: form.valid_until || null,
        priority: form.priority,
        status: "waiting_client_approval",
        client_approval_status: "pending",
      };

      const created = await createWorkOrder(createInput);

      const itemsPayload = items.map((item) => ({
        item_type: item.item_type,
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unit: item.unit || undefined,
        part_catalog_id: item.part_catalog_id || undefined,
        warranty_months:
          typeof item.warranty_months === "number" ? item.warranty_months : undefined,
        notes: item.notes.trim() || undefined,
        sort_order: item.sort_order,
        scope_type: item.scope_type,
        target_elevator_id:
          item.scope_type === "single_elevator"
            ? item.target_elevator_id || undefined
            : undefined,
      }));

      await saveWorkOrderItems(created.id, itemsPayload as any);

      if (selectedServiceRequestId) {
        const { error: linkError } = await supabase
          .from("service_requests")
          .update({
            linked_work_order_id: created.id,
            work_order_id: created.id,
            quotation_number: form.quotation_number.trim(),
            status: "approved",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", selectedServiceRequestId);

        if (linkError) throw linkError;
      }

      await loadAll();
      setSelectedWorkOrderId(created.id);
      resetCreateForm();
    } catch (err: any) {
      console.error("Error creating work order:", err);
      setError(err?.message || "No fue posible crear la orden de trabajo.");
    } finally {
      setSaving(false);
      setUploadingQuotation(false);
    }
  }

  async function handleAssignTechnician(workOrderId: string) {
    const technicianId = assignTechnicianMap[workOrderId];
    if (!technicianId) return;

    setAssigningId(workOrderId);
    setError("");

    try {
      await assignTechnicianToWorkOrder(workOrderId, technicianId);
      await loadAll();
    } catch (err: any) {
      console.error("Error assigning technician:", err);
      setError(err?.message || "No fue posible asignar el técnico.");
    } finally {
      setAssigningId(null);
    }
  }

  async function handleAdminApprove(workOrderId: string) {
    setError("");
    try {
      await updateWorkOrder(workOrderId, {
        status: "approved",
        client_approval_status: "approved_by_admin_override",
      });
      await loadAll();
    } catch (err: any) {
      console.error("Error approving work order:", err);
      setError(err?.message || "No fue posible aprobar manualmente la OT.");
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Órdenes de Trabajo</h1>
          <p className="mt-1 text-slate-600">
            Gestión administrativa de OT, cotizaciones y asignación técnica.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (showCreateForm) {
              resetCreateForm();
            } else {
              setShowCreateForm(true);
            }
          }}
          className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {showCreateForm ? "Cerrar formulario" : "Nueva OT"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {requestsForOT.length > 0 && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Solicitudes en Cotización</h2>
              <p className="text-sm text-slate-600">
                Solicitudes derivadas desde el flujo de servicios para crear cotización y OT.
              </p>
            </div>
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">
              {requestsForOT.length} pendiente(s)
            </span>
          </div>

          <div className="space-y-4">
            {requestsForOT.map((req) => (
              <div
                key={req.id}
                className={`rounded-lg border p-4 ${
                  selectedServiceRequestId === req.id ? "border-slate-900 bg-slate-50" : "border-slate-200"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="font-semibold text-slate-900">{req.title}</div>
                    <div className="text-sm text-slate-600">
                      {(req.clients?.company_name || req.clients?.building_name || "Cliente")}
                      {" — "}
                      {getRequestElevatorLabel(req)}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        {getRequestTypeLabel(req.request_type)}
                      </span>
                      <span className="rounded-full border bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        {getInterventionLabel(req.intervention_type)}
                      </span>
                      <span className="rounded-full border bg-orange-100 px-3 py-1 font-semibold text-orange-800">
                        Prioridad: {(req.priority || "medium").toUpperCase()}
                      </span>
                      <span className="rounded-full border bg-purple-100 px-3 py-1 font-semibold text-purple-800">
                        En cotización
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-line">{req.description}</p>
                    <div className="text-xs text-slate-500">
                      Ingresada el {formatDate(req.created_at)}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => prefillFromServiceRequest(req)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Crear OT
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">
              {selectedServiceRequestId
                ? "Crear OT desde solicitud en cotización"
                : "Crear nueva orden de trabajo"}
            </h2>

            {selectedServiceRequestId && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                Solicitud vinculada
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Título *
              </label>
              <input
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Ej: Reparación operador de puerta"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Cliente *
              </label>
              <select
                value={form.client_id}
                onChange={(e) => updateForm("client_id", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.building_name || client.id}
                  </option>
                ))}
              </select>
            </div>

            <div></div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Ascensores incluidos en la OT *
              </label>

              {!form.client_id ? (
                <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-500">
                  Primero selecciona un cliente para ver sus ascensores.
                </div>
              ) : filteredElevators.length === 0 ? (
                <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-500">
                  Este cliente no tiene ascensores disponibles.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {filteredElevators.map((elevator) => {
                    const checked = selectedElevatorIds.includes(elevator.id);
                    return (
                      <label
                        key={elevator.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${
                          checked ? "border-slate-900 bg-slate-50" : "border-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleElevatorSelection(elevator.id)}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-slate-900">
                            {getElevatorLabel(elevator)}
                          </div>
                          <div className="text-xs text-slate-500">
                            ID: {elevator.id.slice(0, 8)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Tipo de trabajo
              </label>
              <select
                value={form.work_type}
                onChange={(e) => updateForm("work_type", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="repair">Reparación</option>
                <option value="modernization">Modernización</option>
                <option value="normative">Normativo</option>
                <option value="improvement">Mejora</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="inspection">Inspección</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Prioridad
              </label>
              <select
                value={form.priority}
                onChange={(e) => updateForm("priority", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                N° cotización *
              </label>
              <input
                value={form.quotation_number}
                onChange={(e) => updateForm("quotation_number", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Ej: COT-2026-001"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Adjuntar PDF cotización *
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setSelectedQuotationFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border px-3 py-2"
              />
              {selectedQuotationFile && (
                <p className="mt-1 text-xs text-slate-500">
                  Archivo seleccionado: {selectedQuotationFile.name}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                URL PDF cotización
              </label>
              <input
                value={form.quotation_pdf_url}
                onChange={(e) => updateForm("quotation_pdf_url", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Opcional si adjuntas archivo"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Días estimados
              </label>
              <input
                type="number"
                min="1"
                value={form.estimated_days}
                onChange={(e) => updateForm("estimated_days", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Técnicos requeridos
              </label>
              <input
                type="number"
                min="1"
                value={form.required_technicians}
                onChange={(e) => updateForm("required_technicians", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Válida hasta
              </label>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => updateForm("valid_until", e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.is_internal}
                  onChange={(e) => updateForm("is_internal", e.target.checked)}
                />
                <span className="text-sm text-slate-700">Trabajo interno</span>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Descripción general
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              className="min-h-[100px] w-full rounded-lg border px-3 py-2"
              placeholder="Detalle general del trabajo a ejecutar"
            />
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Ítems de la OT</h3>
                <p className="text-sm text-slate-600">
                  Define si cada ítem aplica a un ascensor específico o a todos.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addItem("part")}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  + Repuesto
                </button>
                <button
                  type="button"
                  onClick={() => addItem("material")}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  + Material
                </button>
                <button
                  type="button"
                  onClick={() => addItem("labor")}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  + Trabajo
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                Aún no agregas ítems. Debes ingresar al menos uno para crear la OT.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.localId} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">
                        Ítem #{index + 1} ·{" "}
                        {item.item_type === "part"
                          ? "Repuesto"
                          : item.item_type === "material"
                          ? "Material"
                          : "Trabajo"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.localId)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Eliminar
                      </button>
                    </div>

                    <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Aplica a
                        </label>
                        <select
                          value={item.scope_type}
                          onChange={(e) =>
                            updateItem(item.localId, {
                              scope_type: e.target.value as ItemScopeType,
                            })
                          }
                          className="w-full rounded-lg border px-3 py-2"
                        >
                          <option value="single_elevator">Un ascensor específico</option>
                          <option value="all_selected_elevators">
                            Todos los ascensores seleccionados
                          </option>
                        </select>
                      </div>

                      {item.scope_type === "single_elevator" && (
                        <div className="xl:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Ascensor destino
                          </label>
                          <select
                            value={item.target_elevator_id}
                            onChange={(e) =>
                              updateItem(item.localId, {
                                target_elevator_id: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border px-3 py-2"
                          >
                            <option value="">Seleccionar ascensor</option>
                            {selectedElevators.map((elevator) => (
                              <option key={elevator.id} value={elevator.id}>
                                {getElevatorLabel(elevator)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Tipo
                        </label>
                        <select
                          value={item.item_type}
                          onChange={(e) =>
                            updateItem(item.localId, {
                              item_type: e.target.value as WorkOrderItemType,
                            })
                          }
                          className="w-full rounded-lg border px-3 py-2"
                        >
                          <option value="part">Repuesto</option>
                          <option value="material">Material</option>
                          <option value="labor">Trabajo</option>
                        </select>
                      </div>

                      {item.item_type === "part" ? (
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Repuesto catálogo
                          </label>
                          <select
                            value={item.part_catalog_id || ""}
                            onChange={(e) =>
                              updateItem(item.localId, {
                                part_catalog_id: e.target.value || undefined,
                              })
                            }
                            className="w-full rounded-lg border px-3 py-2"
                          >
                            <option value="">Seleccionar repuesto</option>
                            {partsCatalog.map((part) => (
                              <option key={part.id} value={part.id}>
                                {part.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Descripción
                          </label>
                          <input
                            value={item.description}
                            onChange={(e) =>
                              updateItem(item.localId, { description: e.target.value })
                            }
                            className="w-full rounded-lg border px-3 py-2"
                          />
                        </div>
                      )}

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.localId, {
                              quantity: Number(e.target.value) || 1,
                            })
                          }
                          className="w-full rounded-lg border px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Unidad
                        </label>
                        <input
                          value={item.unit}
                          onChange={(e) =>
                            updateItem(item.localId, { unit: e.target.value })
                          }
                          className="w-full rounded-lg border px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Notas
                      </label>
                      <textarea
                        value={item.notes}
                        onChange={(e) =>
                          updateItem(item.localId, { notes: e.target.value })
                        }
                        className="min-h-[80px] w-full rounded-lg border px-3 py-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => resetCreateForm()}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => void handleCreateWorkOrder()}
              disabled={saving || uploadingQuotation}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {uploadingQuotation
                ? "Subiendo cotización..."
                : saving
                ? "Guardando..."
                : "Crear OT"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold text-slate-900">Listado de OT</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">OT</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Aprobación</th>
                  <th className="px-4 py-3">Técnico</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No hay órdenes de trabajo registradas.
                    </td>
                  </tr>
                ) : (
                  workOrders.map((wo) => (
                    <tr
                      key={wo.id}
                      className={`border-t ${
                        selectedWorkOrderId === wo.id ? "bg-slate-50" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedWorkOrderId(wo.id)}
                          className="text-left"
                        >
                          <div className="font-semibold text-slate-900">OT-{wo.ot_number}</div>
                          <div className="text-xs text-slate-500">{wo.title}</div>
                        </button>
                      </td>
                      <td className="px-4 py-3">{wo.client_name || "—"}</td>
                      <td className="px-4 py-3">{getStatusLabel(wo.status)}</td>
                      <td className="px-4 py-3">{getApprovalLabel(wo.client_approval_status)}</td>
                      <td className="px-4 py-3">{wo.technician_name || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {wo.client_approval_status === "pending" && (
                            <button
                              type="button"
                              onClick={() => void handleAdminApprove(wo.id)}
                              className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50"
                            >
                              Aprobar admin
                            </button>
                          )}

                          <select
                            value={assignTechnicianMap[wo.id] || ""}
                            onChange={(e) =>
                              setAssignTechnicianMap((prev) => ({
                                ...prev,
                                [wo.id]: e.target.value,
                              }))
                            }
                            className="rounded-lg border px-2 py-1.5 text-xs"
                          >
                            <option value="">Asignar técnico</option>
                            {technicians.map((tech) => (
                              <option key={tech.id} value={tech.id}>
                                {tech.full_name || tech.id}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => void handleAssignTechnician(wo.id)}
                            disabled={!assignTechnicianMap[wo.id] || assigningId === wo.id}
                            className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                          >
                            {assigningId === wo.id ? "Asignando..." : "Asignar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold text-slate-900">Detalle de OT</h2>
          </div>

          {!selectedWorkOrder ? (
            <div className="p-4 text-sm text-slate-500">
              Selecciona una orden de trabajo para ver su detalle.
            </div>
          ) : (
            <div className="space-y-4 p-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Título
                </div>
                <div className="mt-1 font-semibold text-slate-900">{selectedWorkOrder.title}</div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cliente
                  </div>
                  <div className="mt-1 text-slate-900">{selectedWorkOrder.client_name || "—"}</div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ascensor
                  </div>
                  <div className="mt-1 text-slate-900">{selectedWorkOrder.elevator_name || "—"}</div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estado
                  </div>
                  <div className="mt-1 text-slate-900">{getStatusLabel(selectedWorkOrder.status)}</div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Aprobación cliente
                  </div>
                  <div className="mt-1 text-slate-900">
                    {getApprovalLabel(selectedWorkOrder.client_approval_status)}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    N° cotización
                  </div>
                  <div className="mt-1 text-slate-900">
                    {selectedWorkOrder.quotation_number || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fecha creación
                  </div>
                  <div className="mt-1 text-slate-900">{formatDate(selectedWorkOrder.created_at)}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Descripción
                </div>
                <div className="mt-1 whitespace-pre-line text-slate-900">
                  {selectedWorkOrder.description || "—"}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ítems
                </div>
                {selectedItems.length === 0 ? (
                  <div className="mt-1 text-slate-500">No hay ítems cargados.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedItems.map((item: any, idx: number) => (
                      <div key={item.id || idx} className="rounded-lg border p-3">
                        <div className="font-medium text-slate-900">
                          {item.description || "Ítem sin descripción"}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {item.item_type} · Cantidad: {item.quantity} {item.unit || ""}
                        </div>
                        {item.notes && (
                          <div className="mt-1 text-xs text-slate-600 whitespace-pre-line">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedWorkOrder.quotation_pdf_url && (
                <div>
                  <a
                    href={selectedWorkOrder.quotation_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Ver PDF de cotización
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}