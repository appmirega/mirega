import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type RequestRow = Record<string, any>;

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = safeText(value);
    if (text) return text;
  }
  return "";
}

function statusLabel(status: string) {
  return status || "Sin estado";
}

function RequestCard({
  row,
  onMove,
}: {
  row: RequestRow;
  onMove: (id: string, nextStatus: string) => void;
}) {
  const id = row.id as string;
  const title =
    firstNonEmpty(row.title, row.subject, row.name, row.request_title) ||
    "Solicitud sin título";

  const requestType =
    firstNonEmpty(row.request_type, row.type, row.category) || "Sin tipo";

  const description =
    firstNonEmpty(
      row.description,
      row.details,
      row.notes,
      row.message,
      row.reason
    ) || "Sin descripción";

  const building =
    firstNonEmpty(
      row.building_name,
      row.building,
      row.location_name,
      row.site_name
    ) || "Sin edificio";

  const priority =
    firstNonEmpty(row.priority, row.priority_level) || "Sin prioridad";

  const source =
    firstNonEmpty(row.source_type, row.source, row.origin) || "Sin origen";

  const createdAt = firstNonEmpty(row.created_at);
  const status = firstNonEmpty(row.status) || "pending";

  return (
    <div className="rounded-lg border bg-white p-3">
      <div>
        <div className="font-medium text-slate-900">{title}</div>
        <div className="mt-1 text-xs text-slate-500">
          Tipo: <b>{requestType}</b> · Estado: <b>{statusLabel(status)}</b>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Edificio: <b>{building}</b> · Prioridad: <b>{priority}</b> · Origen: <b>{source}</b>
        </div>
        {createdAt && (
          <div className="mt-1 text-xs text-slate-500">
            Creada: <b>{createdAt}</b>
          </div>
        )}
        <div className="mt-2 text-sm text-slate-600">{description}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {status !== "pending" && (
          <button
            className="rounded-md border bg-white px-3 py-2 text-xs"
            onClick={() => onMove(id, "pending")}
          >
            Marcar pendiente
          </button>
        )}

        {status !== "analyzing" && (
          <button
            className="rounded-md border bg-white px-3 py-2 text-xs"
            onClick={() => onMove(id, "analyzing")}
          >
            En análisis
          </button>
        )}

        {status !== "approved" && (
          <button
            className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white"
            onClick={() => onMove(id, "approved")}
          >
            Aprobar
          </button>
        )}

        {status !== "rejected" && (
          <button
            className="rounded-md bg-rose-600 px-3 py-2 text-xs text-white"
            onClick={() => onMove(id, "rejected")}
          >
            Rechazar
          </button>
        )}
      </div>
    </div>
  );
}

function Column({
  title,
  rows,
  onMove,
}: {
  title: string;
  rows: RequestRow[];
  onMove: (id: string, nextStatus: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div className="mb-3 font-semibold text-slate-900">{title}</div>

      {rows.length === 0 ? (
        <div className="rounded-md border bg-white p-3 text-sm text-slate-500">
          Sin solicitudes
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <RequestCard key={row.id} row={row} onMove={onMove} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CoordinationServiceRequestsTab() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRows((data ?? []) as RequestRow[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible cargar las solicitudes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const pendingRows = useMemo(
    () => rows.filter((row) => (row.status ?? "pending") === "pending"),
    [rows]
  );

  const analyzingRows = useMemo(
    () => rows.filter((row) => row.status === "analyzing"),
    [rows]
  );

  const approvedRows = useMemo(
    () => rows.filter((row) => row.status === "approved"),
    [rows]
  );

  const moveRequest = async (id: string, nextStatus: string) => {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: nextStatus })
        .eq("id", id);

      if (error) throw error;

      await loadRows();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible actualizar la solicitud.");
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Coordinación (solicitudes)</div>
          <div className="text-sm text-slate-500">
            Aprueba, rechaza y mueve solicitudes según revisión administrativa.
          </div>
        </div>

        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
          onClick={loadRows}
          disabled={loading}
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Column title="Pendiente" rows={pendingRows} onMove={moveRequest} />
        <Column title="En análisis" rows={analyzingRows} onMove={moveRequest} />
        <Column title="Aprobada" rows={approvedRows} onMove={moveRequest} />
      </div>
    </div>
  );
}