import React, { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type RequestType = "permission" | "vacation";

function safeText(value?: string | null) {
  return (value ?? "").trim();
}

export function TechnicianAbsenceForm({
  technicianId,
  onClose,
  onSaved,
}: {
  technicianId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [requestType, setRequestType] = useState<RequestType>("permission");

  const [singleDate, setSingleDate] = useState<string>("");

  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");

  const [reason, setReason] = useState<string>("");

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const canSubmit = useMemo(() => {
    if (requestType === "permission") {
      return Boolean(singleDate);
    }

    return Boolean(rangeStart) && Boolean(rangeEnd);
  }, [requestType, singleDate, rangeStart, rangeEnd]);

  const submitRequest = async () => {
    setError("");
    setSuccess("");

    if (!canSubmit) {
      setError("Completa los campos requeridos.");
      return;
    }

    if (requestType === "vacation" && rangeStart > rangeEnd) {
      setError("La fecha de inicio no puede ser mayor que la fecha final.");
      return;
    }

    setSaving(true);

    try {
      if (requestType === "permission") {
        const payload = {
          technician_id: technicianId,
          start_date: singleDate,
          end_date: singleDate,
          absence_type: "personal_leave",
          reason: safeText(reason) || "Permiso",
          status: "pending",
        };

        const { error } = await supabase
          .from("technician_availability")
          .insert(payload);

        if (error) throw error;
      } else {
        const payload = {
          technician_id: technicianId,
          leave_type: "vacaciones",
          start_date: rangeStart,
          end_date: rangeEnd,
          reason: safeText(reason) || "Vacaciones",
          status: "pending",
        };

        const { error } = await supabase.from("technician_leaves").insert(payload);

        if (error) throw error;
      }

      setSuccess("Solicitud enviada correctamente.");

      setTimeout(() => {
        onSaved();
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No fue posible enviar la solicitud.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold text-slate-900">
              Solicitar Permiso / Vacaciones
            </div>
            <div className="text-sm text-slate-500">
              Permiso = 1 día • Vacaciones = rango de fechas
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-md border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Tipo de evento</label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as RequestType)}
            >
              <option value="permission">Permiso</option>
              <option value="vacation">Vacaciones</option>
            </select>
          </div>

          {requestType === "permission" ? (
            <div>
              <label className="text-sm font-medium">Fecha</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Desde</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Hasta</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Descripción</label>
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo de la solicitud"
            />
          </div>

          <button
            onClick={submitRequest}
            disabled={saving || !canSubmit}
            className={`w-full rounded-lg px-4 py-2 text-white ${
              saving || !canSubmit
                ? "bg-slate-400"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {saving ? "Enviando..." : "Enviar Solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}