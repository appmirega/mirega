import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Clock, Wrench, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  getWorkOrderItems,
  getWorkOrdersForTechnician,
  markWorkOrderInProgress,
  type WorkOrderTechnicianRow,
} from "../../lib/workOrdersService";
import type { WorkOrderItem } from "../../types/workOrderItems";
import { WorkOrderClosureForm } from "../forms/WorkOrderClosureForm";

type ViewMode = "list" | "closure";

function getStatusLabel(status?: string) {
  switch (status) {
    case "assigned":
      return "Asignada";
    case "in_progress":
      return "En progreso";
    case "completed":
      return "Completada";
    case "approved":
      return "Aprobada";
    default:
      return status || "—";
  }
}

function getStatusBadge(status?: string) {
  switch (status) {
    case "assigned":
      return "bg-blue-100 text-blue-800";
    case "in_progress":
      return "bg-orange-100 text-orange-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "approved":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function getWorkTypeLabel(type?: string) {
  switch (type) {
    case "repair":
      return "Reparación";
    case "modernization":
      return "Modernización";
    case "normative":
      return "Normativo";
    case "improvement":
      return "Mejora";
    case "maintenance":
      return "Mantenimiento";
    case "inspection":
      return "Inspección";
    default:
      return type || "—";
  }
}

function formatDate(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("es-CL");
  } catch {
    return value;
  }
}

export function TechnicianWorkOrdersView() {
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [technicianId, setTechnicianId] = useState<string>("");
  const [workOrders, setWorkOrders] = useState<WorkOrderTechnicianRow[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<WorkOrderItem[]>([]);
  const [error, setError] = useState("");

  const selectedWorkOrder = useMemo(
    () => workOrders.find((wo) => wo.id === selectedWorkOrderId) ?? null,
    [workOrders, selectedWorkOrderId]
  );

  const filteredWorkOrders = useMemo(() => {
    if (selectedStatus === "all") return workOrders;
    return workOrders.filter((wo) => wo.status === selectedStatus);
  }, [workOrders, selectedStatus]);

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    if (!selectedWorkOrderId) {
      setSelectedItems([]);
      return;
    }
    void loadItems(selectedWorkOrderId);
  }, [selectedWorkOrderId]);

  async function initialize() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("No se encontró sesión activa.");

      setTechnicianId(user.id);
      await loadWorkOrders(user.id);
    } catch (err: any) {
      console.error("Error initializing technician OT view:", err);
      setError(err?.message || "No fue posible cargar tus órdenes de trabajo.");
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkOrders(currentTechnicianId: string) {
    const data = await getWorkOrdersForTechnician(currentTechnicianId);
    const filtered = data.filter((wo) =>
      ["assigned", "in_progress", "completed", "approved"].includes(wo.status)
    );

    setWorkOrders(filtered);

    if (filtered.length > 0) {
      setSelectedWorkOrderId((prev) =>
        prev && filtered.some((wo) => wo.id === prev) ? prev : filtered[0].id
      );
    } else {
      setSelectedWorkOrderId(null);
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

  async function handleStartWorkOrder(workOrderId: string) {
    setStartingId(workOrderId);
    setError("");

    try {
      await markWorkOrderInProgress(workOrderId);
      await loadWorkOrders(technicianId);
      setSelectedWorkOrderId(workOrderId);
    } catch (err: any) {
      console.error("Error starting work order:", err);
      setError(err?.message || "No fue posible iniciar la orden de trabajo.");
    } finally {
      setStartingId(null);
    }
  }

  function handleClosureSuccess() {
    setViewMode("list");
    if (technicianId) {
      void loadWorkOrders(technicianId);
    }
    if (selectedWorkOrderId) {
      void loadItems(selectedWorkOrderId);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (viewMode === "closure" && selectedWorkOrder) {
    return (
      <WorkOrderClosureForm
        workOrderId={selectedWorkOrder.id}
        onSuccess={handleClosureSuccess}
        onCancel={() => setViewMode("list")}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mis Órdenes de Trabajo</h1>
          <p className="mt-1 text-slate-600">
            Visualiza, ejecuta y cierra solo las OT asignadas a tu perfil.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSelectedStatus("all")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              selectedStatus === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setSelectedStatus("assigned")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              selectedStatus === "assigned"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Asignadas
          </button>
          <button
            onClick={() => setSelectedStatus("in_progress")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              selectedStatus === "in_progress"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            En progreso
          </button>
          <button
            onClick={() => setSelectedStatus("completed")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              selectedStatus === "completed"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Completadas
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {workOrders.filter((w) => w.status === "assigned").length}
              </p>
              <p className="text-sm text-slate-600">Asignadas</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Wrench className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {workOrders.filter((w) => w.status === "in_progress").length}
              </p>
              <p className="text-sm text-slate-600">En progreso</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {workOrders.filter((w) => w.status === "completed").length}
              </p>
              <p className="text-sm text-slate-600">Completadas</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-slate-700" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{workOrders.length}</p>
              <p className="text-sm text-slate-600">Total OT</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold text-slate-900">Listado de OT asignadas</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">OT</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>

              <tbody>
                {filteredWorkOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No tienes órdenes de trabajo en este estado.
                    </td>
                  </tr>
                ) : (
                  filteredWorkOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={`border-t ${
                        selectedWorkOrderId === order.id ? "bg-slate-50" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedWorkOrderId(order.id)}
                          className="text-left"
                        >
                          <div className="font-semibold text-slate-900">
                            OT-{order.ot_number}
                          </div>
                          <div className="text-xs text-slate-500">{order.title}</div>
                        </button>
                      </td>

                      <td className="px-4 py-3">{order.client_name || "—"}</td>
                      <td className="px-4 py-3">{getWorkTypeLabel(order.work_type)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {order.status === "assigned" && (
                          <button
                            type="button"
                            onClick={() => void handleStartWorkOrder(order.id)}
                            disabled={startingId === order.id}
                            className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                          >
                            {startingId === order.id ? "Iniciando..." : "Iniciar"}
                          </button>
                        )}

                        {order.status === "in_progress" && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWorkOrderId(order.id);
                              setViewMode("closure");
                            }}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                          >
                            Cerrar OT
                          </button>
                        )}

                        {order.status === "completed" && (
                          <span className="text-xs text-green-700">Finalizada</span>
                        )}
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
            <h2 className="text-lg font-semibold text-slate-900">Detalle técnico</h2>
          </div>

          {!selectedWorkOrder ? (
            <div className="p-6 text-sm text-slate-500">
              Selecciona una OT para revisar sus detalles.
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div>
                <div className="text-xs uppercase text-slate-500">Orden</div>
                <div className="text-xl font-bold text-slate-900">
                  OT-{selectedWorkOrder.ot_number}
                </div>
                <div className="text-sm text-slate-600">{selectedWorkOrder.title}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500">Cliente</div>
                  <div className="font-medium">{selectedWorkOrder.client_name || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Edificio</div>
                  <div className="font-medium">{selectedWorkOrder.building_name || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Ascensor</div>
                  <div className="font-medium">{selectedWorkOrder.elevator_name || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Tipo</div>
                  <div className="font-medium">
                    {getWorkTypeLabel(selectedWorkOrder.work_type)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Estado</div>
                  <div className="font-medium">
                    {getStatusLabel(selectedWorkOrder.status)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Fecha creación</div>
                  <div className="font-medium">{formatDate(selectedWorkOrder.created_at)}</div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-slate-500">Descripción del trabajo</div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {selectedWorkOrder.description || "Sin descripción"}
                </div>
              </div>

              <div>
                <div className="mb-2 text-slate-500">Ítems técnicos</div>
                {selectedItems.length === 0 ? (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                    Esta OT no tiene ítems registrados.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map((item) => (
                      <div key={item.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{item.description}</div>
                          <div className="text-xs uppercase text-slate-500">
                            {item.item_type === "part"
                              ? "Repuesto"
                              : item.item_type === "material"
                              ? "Material"
                              : "Trabajo"}
                          </div>
                        </div>

                        <div className="mt-1 text-slate-600">
                          Cantidad: {item.quantity} {item.unit || ""}
                        </div>

                        {item.notes && <div className="text-slate-500">{item.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedWorkOrder.status === "assigned" && (
                <button
                  type="button"
                  onClick={() => void handleStartWorkOrder(selectedWorkOrder.id)}
                  disabled={startingId === selectedWorkOrder.id}
                  className="w-full rounded-lg border px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  {startingId === selectedWorkOrder.id ? "Iniciando..." : "Iniciar trabajo"}
                </button>
              )}

              {selectedWorkOrder.status === "in_progress" && (
                <button
                  type="button"
                  onClick={() => setViewMode("closure")}
                  className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  Cerrar orden de trabajo
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}