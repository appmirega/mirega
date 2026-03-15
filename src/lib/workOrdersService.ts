import { supabase } from "./supabase";
import type {
  ClientApprovalStatus,
  WorkOrder,
  WorkOrderStatus,
  WorkType,
} from "../types/workOrders";
import type { WorkOrderItem } from "../types/workOrderItems";
import type { ElevatorPartHistory, PartCatalogItem } from "../types/parts";

type UUID = string;

export interface WorkOrderCreateInput {
  title: string;
  description?: string;
  client_id?: UUID;
  building_id?: UUID;
  elevator_id?: UUID | null;
  assigned_technician_id?: UUID | null;
  work_type?: WorkType;
  status?: WorkOrderStatus;
  client_approval_status?: ClientApprovalStatus;
  quotation_number?: string;
  quotation_pdf_url?: string;
  external_quotation_number?: string;
  external_quotation_pdf_url?: string;
  estimated_days?: number | null;
  required_technicians?: number | null;
  is_internal?: boolean;
  scheduled_date?: string | null;
  created_by?: UUID;
  estimated_hours?: number | null;
  approval_deadline?: string | null;
  valid_until?: string | null;
  requires_client_approval?: boolean;
  priority?: string | null;
}

export interface WorkOrderUpdateInput {
  title?: string;
  description?: string;
  client_id?: UUID;
  building_id?: UUID;
  elevator_id?: UUID | null;
  assigned_technician_id?: UUID | null;
  work_type?: WorkType;
  status?: WorkOrderStatus;
  client_approval_status?: ClientApprovalStatus;
  quotation_number?: string;
  quotation_pdf_url?: string;
  external_quotation_number?: string;
  external_quotation_pdf_url?: string;
  estimated_days?: number | null;
  required_technicians?: number | null;
  is_internal?: boolean;
  scheduled_date?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  approval_deadline?: string | null;
  valid_until?: string | null;
  technician_started_at?: string | null;
  technician_finished_at?: string | null;
  is_closed?: boolean;
  client_feedback?: string | null;
  client_satisfaction_rating?: number | null;
  priority?: string | null;
}

export interface WorkOrderAdminRow extends WorkOrder {
  client_name?: string;
  building_name?: string;
  elevator_name?: string;
  technician_name?: string;
}

export interface WorkOrderTechnicianRow extends WorkOrder {
  client_name?: string;
  building_name?: string;
  elevator_name?: string;
}

export interface WorkOrderCompleteInput {
  workOrderId: UUID;
  completedBy: UUID;
  startedAt?: string | null;
  completedAt?: string | null;
  technicalReport?: string | null;
  clientReceptionName?: string | null;
  clientSignatureUrl?: string | null;
  actualHours?: number | null;
  photos?: Array<{
    fileUrl: string;
    photoType: "before" | "after" | "evidence";
  }>;
}

function mapWorkOrder(row: Record<string, unknown>): WorkOrder {
  return {
    id: String(row.id),
    ot_number: Number(row.ot_number ?? 0),
    order_number: row.order_number ? String(row.order_number) : undefined,
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : undefined,
    client_id: row.client_id ? String(row.client_id) : undefined,
    building_id: row.building_id ? String(row.building_id) : undefined,
    elevator_id: row.elevator_id ? String(row.elevator_id) : undefined,
    assigned_technician_id: row.assigned_technician_id
      ? String(row.assigned_technician_id)
      : undefined,
    work_type: row.work_type ? (String(row.work_type) as WorkType) : undefined,
    status: String(row.status ?? "draft") as WorkOrderStatus,
    client_approval_status: row.client_approval_status
      ? (String(row.client_approval_status) as ClientApprovalStatus)
      : undefined,
    external_quotation_number: row.external_quotation_number
      ? String(row.external_quotation_number)
      : undefined,
    external_quotation_pdf_url: row.external_quotation_pdf_url
      ? String(row.external_quotation_pdf_url)
      : undefined,
    quotation_number: row.quotation_number
      ? String(row.quotation_number)
      : undefined,
    quotation_pdf_url: row.quotation_pdf_url
      ? String(row.quotation_pdf_url)
      : undefined,
    estimated_days:
      typeof row.estimated_days === "number" ? row.estimated_days : undefined,
    required_technicians:
      typeof row.required_technicians === "number"
        ? row.required_technicians
        : undefined,
    is_internal:
      typeof row.is_internal === "boolean" ? row.is_internal : undefined,
    scheduled_date: row.scheduled_date ? String(row.scheduled_date) : undefined,
    created_by: row.created_by ? String(row.created_by) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    technician_started_at: row.technician_started_at
      ? String(row.technician_started_at)
      : undefined,
    technician_finished_at: row.technician_finished_at
      ? String(row.technician_finished_at)
      : undefined,
    closed_at: row.closed_at ? String(row.closed_at) : undefined,
    is_closed: typeof row.is_closed === "boolean" ? row.is_closed : undefined,
    estimated_hours:
      typeof row.estimated_hours === "number" ? row.estimated_hours : undefined,
    actual_hours:
      typeof row.actual_hours === "number" ? row.actual_hours : undefined,
    total_cost: typeof row.total_cost === "number" ? row.total_cost : undefined,
    client_satisfaction_rating:
      typeof row.client_satisfaction_rating === "number"
        ? row.client_satisfaction_rating
        : undefined,
    client_feedback: row.client_feedback
      ? String(row.client_feedback)
      : undefined,
  };
}

function mapWorkOrderItem(row: Record<string, unknown>): WorkOrderItem {
  return {
    id: String(row.id),
    work_order_id: String(row.work_order_id),
    item_type: String(row.item_type) as WorkOrderItem["item_type"],
    description: String(row.description ?? ""),
    quantity: Number(row.quantity ?? 0),
    unit: row.unit ? String(row.unit) : undefined,
    part_catalog_id: row.part_catalog_id
      ? String(row.part_catalog_id)
      : undefined,
    warranty_months:
      typeof row.warranty_months === "number" ? row.warranty_months : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapPartCatalogItem(row: Record<string, unknown>): PartCatalogItem {
  return {
    id: String(row.id),
    part_code: row.part_code ? String(row.part_code) : undefined,
    name: String(row.name ?? ""),
    brand: row.brand ? String(row.brand) : undefined,
    model: row.model ? String(row.model) : undefined,
    category: row.category ? String(row.category) : undefined,
    description: row.description ? String(row.description) : undefined,
    default_warranty_months:
      typeof row.default_warranty_months === "number"
        ? row.default_warranty_months
        : undefined,
    is_active: Boolean(row.is_active),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function addMonthsToDate(dateStr: string, months: number): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function normalizeDateOnly(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

export async function getNextWorkOrderNumber(): Promise<number> {
  const { data: fallback, error: fallbackError } = await supabase
    .from("work_orders")
    .select("ot_number")
    .order("ot_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw fallbackError;
  }

  return Number(fallback?.ot_number ?? 999) + 1;
}

export async function getWorkOrdersForAdmin(): Promise<WorkOrderAdminRow[]> {
  const { data, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      clients:client_id ( company_name ),
      buildings:building_id ( name ),
      elevators:elevator_id ( elevator_number, model ),
      technicians:assigned_technician_id ( full_name )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const mapped = mapWorkOrder(row);
    const client = row.clients as Record<string, unknown> | null;
    const building = row.buildings as Record<string, unknown> | null;
    const elevator = row.elevators as Record<string, unknown> | null;
    const technician = row.technicians as Record<string, unknown> | null;

    return {
      ...mapped,
      client_name: client?.company_name ? String(client.company_name) : undefined,
      building_name: building?.name ? String(building.name) : undefined,
      elevator_name: elevator?.elevator_number
        ? String(elevator.elevator_number)
        : elevator?.model
        ? String(elevator.model)
        : undefined,
      technician_name: technician?.full_name
        ? String(technician.full_name)
        : undefined,
    };
  });
}

export async function getWorkOrdersForTechnician(
  technicianId: UUID
): Promise<WorkOrderTechnicianRow[]> {
  const { data, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      clients:client_id ( company_name ),
      buildings:building_id ( name ),
      elevators:elevator_id ( elevator_number, model )
    `)
    .eq("assigned_technician_id", technicianId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const mapped = mapWorkOrder(row);
    const client = row.clients as Record<string, unknown> | null;
    const building = row.buildings as Record<string, unknown> | null;
    const elevator = row.elevators as Record<string, unknown> | null;

    return {
      ...mapped,
      client_name: client?.company_name ? String(client.company_name) : undefined,
      building_name: building?.name ? String(building.name) : undefined,
      elevator_name: elevator?.elevator_number
        ? String(elevator.elevator_number)
        : elevator?.model
        ? String(elevator.model)
        : undefined,
    };
  });
}

export async function getWorkOrderById(
  workOrderId: UUID
): Promise<WorkOrderAdminRow | null> {
  const { data, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      clients:client_id ( company_name ),
      buildings:building_id ( name ),
      elevators:elevator_id ( elevator_number, model ),
      technicians:assigned_technician_id ( full_name )
    `)
    .eq("id", workOrderId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const mapped = mapWorkOrder(row);
  const client = row.clients as Record<string, unknown> | null;
  const building = row.buildings as Record<string, unknown> | null;
  const elevator = row.elevators as Record<string, unknown> | null;
  const technician = row.technicians as Record<string, unknown> | null;

  return {
    ...mapped,
    client_name: client?.company_name ? String(client.company_name) : undefined,
    building_name: building?.name ? String(building.name) : undefined,
    elevator_name: elevator?.elevator_number
      ? String(elevator.elevator_number)
      : elevator?.model
      ? String(elevator.model)
      : undefined,
    technician_name: technician?.full_name
      ? String(technician.full_name)
      : undefined,
  };
}

export async function createWorkOrder(
  input: WorkOrderCreateInput
): Promise<WorkOrder> {
  const otNumber = await getNextWorkOrderNumber();

  const payload = {
    ot_number: otNumber,
    title: input.title,
    description: input.description ?? null,
    client_id: input.client_id ?? null,
    building_id: input.building_id ?? null,
    elevator_id: input.elevator_id ?? null,
    assigned_technician_id: input.assigned_technician_id ?? null,
    work_type: input.work_type ?? "repair",
    status: input.status ?? "waiting_client_approval",
    client_approval_status: input.client_approval_status ?? "pending",
    quotation_number: input.quotation_number ?? null,
    quotation_pdf_url: input.quotation_pdf_url ?? null,
    external_quotation_number: input.external_quotation_number ?? null,
    external_quotation_pdf_url: input.external_quotation_pdf_url ?? null,
    estimated_days: input.estimated_days ?? null,
    required_technicians: input.required_technicians ?? 1,
    is_internal: input.is_internal ?? true,
    scheduled_date: input.scheduled_date ?? null,
    created_by: input.created_by ?? null,
    estimated_hours: input.estimated_hours ?? null,
    approval_deadline: input.approval_deadline ?? null,
    valid_until: input.valid_until ?? null,
    requires_client_approval: input.requires_client_approval ?? true,
    priority: input.priority ?? "medium",
  };

  const { data, error } = await supabase
    .from("work_orders")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  return mapWorkOrder(data as Record<string, unknown>);
}

export async function updateWorkOrder(
  workOrderId: UUID,
  input: WorkOrderUpdateInput
): Promise<WorkOrder> {
  const payload: Record<string, unknown> = {
    ...input,
  };

  const { data, error } = await supabase
    .from("work_orders")
    .update(payload)
    .eq("id", workOrderId)
    .select("*")
    .single();

  if (error) throw error;

  return mapWorkOrder(data as Record<string, unknown>);
}

export async function saveWorkOrderItems(
  workOrderId: UUID,
  items: Array<Omit<WorkOrderItem, "id" | "work_order_id" | "created_at" | "updated_at">>
): Promise<WorkOrderItem[]> {
  const { error: deleteError } = await supabase
    .from("work_order_items")
    .delete()
    .eq("work_order_id", workOrderId);

  if (deleteError) throw deleteError;

  if (items.length === 0) return [];

  const payload = items.map((item, index) => ({
    work_order_id: workOrderId,
    item_type: item.item_type,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit ?? null,
    part_catalog_id: item.part_catalog_id ?? null,
    warranty_months: item.warranty_months ?? null,
    notes: item.notes ?? null,
    sort_order: item.sort_order ?? index,
  }));

  const { data, error } = await supabase
    .from("work_order_items")
    .insert(payload)
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => mapWorkOrderItem(row as Record<string, unknown>));
}

export async function getWorkOrderItems(
  workOrderId: UUID
): Promise<WorkOrderItem[]> {
  const { data, error } = await supabase
    .from("work_order_items")
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => mapWorkOrderItem(row as Record<string, unknown>));
}

export async function getPartsCatalog(): Promise<PartCatalogItem[]> {
  const { data, error } = await supabase
    .from("parts_catalog")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapPartCatalogItem(row as Record<string, unknown>)
  );
}

export async function assignTechnicianToWorkOrder(
  workOrderId: UUID,
  technicianId: UUID
): Promise<WorkOrder> {
  const { data, error } = await supabase
    .from("work_orders")
    .update({
      assigned_technician_id: technicianId,
      assigned_at: new Date().toISOString(),
      status: "assigned",
    })
    .eq("id", workOrderId)
    .select("*")
    .single();

  if (error) throw error;

  return mapWorkOrder(data as Record<string, unknown>);
}

export async function markWorkOrderInProgress(
  workOrderId: UUID
): Promise<WorkOrder> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("work_orders")
    .update({
      status: "in_progress",
      technician_started_at: now,
      started_at: now,
    })
    .eq("id", workOrderId)
    .select("*")
    .single();

  if (error) throw error;

  return mapWorkOrder(data as Record<string, unknown>);
}

export async function completeWorkOrder(
  input: WorkOrderCompleteInput
): Promise<WorkOrder> {
  const startedAt = input.startedAt ?? null;
  const completedAt = input.completedAt ?? new Date().toISOString();

  const { data: closure, error: closureError } = await supabase
    .from("work_order_closures")
    .insert({
      work_order_id: input.workOrderId,
      started_at: startedAt,
      completed_at: completedAt,
      technical_report: input.technicalReport ?? null,
      client_reception_name: input.clientReceptionName ?? null,
      client_signature_url: input.clientSignatureUrl ?? null,
      created_by: input.completedBy,
    })
    .select("id")
    .single();

  if (closureError) throw closureError;

  if (input.photos && input.photos.length > 0) {
    const photosPayload = input.photos.map((photo) => ({
      work_order_id: input.workOrderId,
      photo_type: photo.photoType,
      file_url: photo.fileUrl,
    }));

    const { error: photosError } = await supabase
      .from("work_order_photos")
      .insert(photosPayload);

    if (photosError) throw photosError;
  }

  const updatePayload: Record<string, unknown> = {
    status: "completed",
    is_closed: true,
    completed_at: completedAt,
    closed_at: completedAt,
    technician_finished_at: completedAt,
  };

  if (startedAt) {
    updatePayload.technician_started_at = startedAt;
    updatePayload.started_at = startedAt;
  }

  if (typeof input.actualHours === "number") {
    updatePayload.actual_hours = input.actualHours;
  }

  const { data, error } = await supabase
    .from("work_orders")
    .update(updatePayload)
    .eq("id", input.workOrderId)
    .select("*")
    .single();

  if (error) throw error;
  if (!closure?.id) {
    throw new Error("No fue posible crear el cierre técnico.");
  }

  return mapWorkOrder(data as Record<string, unknown>);
}

export async function registerInstalledPartsFromItems(
  workOrderId: UUID
): Promise<ElevatorPartHistory[]> {
  const workOrder = await getWorkOrderById(workOrderId);

  if (!workOrder) {
    throw new Error("Orden de trabajo no encontrada.");
  }

  if (!workOrder.elevator_id) {
    return [];
  }

  const items = await getWorkOrderItems(workOrderId);
  const partItems = items.filter(
    (item) => item.item_type === "part" && item.part_catalog_id
  );

  if (partItems.length === 0) {
    return [];
  }

  const installedAt =
    normalizeDateOnly(workOrder.completed_at) ??
    normalizeDateOnly(new Date().toISOString())!;

  const historyPayload = partItems.map((item) => {
    const warrantyMonths = item.warranty_months ?? 0;
    const warrantyStart = installedAt;
    const warrantyEnd =
      warrantyMonths > 0 ? addMonthsToDate(installedAt, warrantyMonths) : null;

    return {
      elevator_id: workOrder.elevator_id,
      work_order_id: workOrderId,
      part_catalog_id: item.part_catalog_id,
      installed_at: installedAt,
      warranty_start: warrantyStart,
      warranty_end: warrantyEnd,
      serial_number: null,
      notes: item.description,
    };
  });

  const { data, error } = await supabase
    .from("elevator_parts_history")
    .insert(historyPayload)
    .select("*");

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    elevator_id: String(row.elevator_id),
    work_order_id: String(row.work_order_id),
    part_catalog_id: String(row.part_catalog_id),
    installed_at: String(row.installed_at),
    warranty_start: row.warranty_start ? String(row.warranty_start) : undefined,
    warranty_end: row.warranty_end ? String(row.warranty_end) : undefined,
    serial_number: row.serial_number ? String(row.serial_number) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
  }));
}