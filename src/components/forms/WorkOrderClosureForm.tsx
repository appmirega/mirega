import { useMemo, useState } from "react";
import {
  completeWorkOrder,
  getWorkOrderById,
  getWorkOrderItems,
  registerInstalledPartsFromItems,
} from "../../lib/workOrdersService";
import type { WorkOrderItem } from "../../types/workOrderItems";

interface WorkOrderClosureFormProps {
  workOrderId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function WorkOrderClosureForm({
  workOrderId,
  onSuccess,
  onCancel,
}: WorkOrderClosureFormProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [startedAt, setStartedAt] = useState("");
  const [completedAt, setCompletedAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [technicalReport, setTechnicalReport] = useState("");
  const [clientReceptionName, setClientReceptionName] = useState("");
  const [clientSignatureUrl, setClientSignatureUrl] = useState("");
  const [actualHours, setActualHours] = useState("");

  const [beforePhotos, setBeforePhotos] = useState<string[]>([""]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([""]);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([""]);

  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [partSelections, setPartSelections] = useState<Record<string, boolean>>({});

  const [orderTitle, setOrderTitle] = useState("");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  useMemo(() => {
    void loadData();
  }, [workOrderId]);

  async function loadData() {
    setInitialLoading(true);
    setError("");

    try {
      const [order, orderItems] = await Promise.all([
        getWorkOrderById(workOrderId),
        getWorkOrderItems(workOrderId),
      ]);

      if (!order) {
        throw new Error("No se encontró la orden de trabajo.");
      }

      setOrderTitle(order.title || "");
      setOrderNumber(order.ot_number || null);
      setItems(orderItems);

      const defaultPartSelection: Record<string, boolean> = {};
      for (const item of orderItems) {
        if (item.item_type === "part") {
          defaultPartSelection[item.id] = true;
        }
      }
      setPartSelections(defaultPartSelection);

      const now = new Date();
      const startDefault = new Date(now.getTime() - 2 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16);

      setStartedAt(order.technician_started_at?.slice(0, 16) || startDefault);
    } catch (err: any) {
      console.error("Error loading closure form:", err);
      setError(err?.message || "No fue posible cargar la información de cierre.");
    } finally {
      setInitialLoading(false);
    }
  }

  function updatePhotoList(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) {
    setter((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function addPhotoField(
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    setter((prev) => [...prev, ""]);
  }

  function removePhotoField(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number
  ) {
    setter((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
  }

  const selectedPartCount = Object.values(partSelections).filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      if (!startedAt) {
        throw new Error("Debes ingresar la fecha/hora de inicio.");
      }

      if (!completedAt) {
        throw new Error("Debes ingresar la fecha/hora de término.");
      }

      if (!technicalReport.trim()) {
        throw new Error("Debes ingresar el informe técnico de cierre.");
      }

      const {
        data: { user },
        error: authError,
      } = await (await import("../../lib/supabase")).supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("No hay sesión activa para registrar el cierre.");

      const normalizedPhotos = [
        ...beforePhotos
          .map((url) => url.trim())
          .filter(Boolean)
          .map((fileUrl) => ({ fileUrl, photoType: "before" as const })),
        ...afterPhotos
          .map((url) => url.trim())
          .filter(Boolean)
          .map((fileUrl) => ({ fileUrl, photoType: "after" as const })),
        ...evidencePhotos
          .map((url) => url.trim())
          .filter(Boolean)
          .map((fileUrl) => ({ fileUrl, photoType: "evidence" as const })),
      ];

      await completeWorkOrder({
        workOrderId,
        completedBy: user.id,
        startedAt: new Date(startedAt).toISOString(),
        completedAt: new Date(completedAt).toISOString(),
        technicalReport: technicalReport.trim(),
        clientReceptionName: clientReceptionName.trim() || null,
        clientSignatureUrl: clientSignatureUrl.trim() || null,
        actualHours: actualHours ? Number(actualHours) : null,
        photos: normalizedPhotos,
      });

      const partItemsToRegister = items.filter(
        (item) => item.item_type === "part" && partSelections[item.id]
      );

      if (partItemsToRegister.length > 0) {
        await registerInstalledPartsFromItems(workOrderId);
      }

      setSuccessMessage("Orden de trabajo cerrada correctamente.");
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err: any) {
      console.error("Error closing work order:", err);
      setError(err?.message || "No fue posible cerrar la orden de trabajo.");
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Cierre de Orden de Trabajo
          </h1>
          <p className="mt-1 text-slate-600">
            {orderNumber ? `OT-${orderNumber}` : "OT"} · {orderTitle || "Sin título"}
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Volver
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Fecha/hora inicio *
            </label>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Fecha/hora término *
            </label>
            <input
              type="datetime-local"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Horas reales
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={actualHours}
              onChange={(e) => setActualHours(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Ej: 3.5"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Informe técnico *
          </label>
          <textarea
            value={technicalReport}
            onChange={(e) => setTechnicalReport(e.target.value)}
            className="min-h-[140px] w-full rounded-lg border px-3 py-2"
            placeholder="Describe el trabajo ejecutado, pruebas realizadas, observaciones y resultado final."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Recepción cliente
            </label>
            <input
              value={clientReceptionName}
              onChange={(e) => setClientReceptionName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Nombre de quien recibe el trabajo"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              URL firma / recepción
            </label>
            <input
              value={clientSignatureUrl}
              onChange={(e) => setClientSignatureUrl(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="URL de imagen o referencia de firma"
            />
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Repuestos instalados
            </h2>
            <p className="text-sm text-slate-600">
              Marca cuáles repuestos realmente fueron instalados para dejar historial y garantía.
            </p>
          </div>

          {items.filter((item) => item.item_type === "part").length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
              Esta OT no tiene repuestos registrados como ítems tipo repuesto.
            </div>
          ) : (
            <div className="space-y-2">
              {items
                .filter((item) => item.item_type === "part")
                .map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(partSelections[item.id])}
                      onChange={(e) =>
                        setPartSelections((prev) => ({
                          ...prev,
                          [item.id]: e.target.checked,
                        }))
                      }
                    />
                    <div>
                      <div className="font-medium text-slate-900">
                        {item.description}
                      </div>
                      <div className="text-sm text-slate-600">
                        Cantidad: {item.quantity} {item.unit || ""}
                      </div>
                      {typeof item.warranty_months === "number" && (
                        <div className="text-sm text-slate-500">
                          Garantía: {item.warranty_months} meses
                        </div>
                      )}
                    </div>
                  </label>
                ))}
            </div>
          )}

          <div className="mt-3 text-sm text-slate-600">
            Repuestos seleccionados para historial: <strong>{selectedPartCount}</strong>
          </div>
        </div>

        <PhotoSection
          title="Fotos antes"
          values={beforePhotos}
          onChange={setBeforePhotos}
        />

        <PhotoSection
          title="Fotos después"
          values={afterPhotos}
          onChange={setAfterPhotos}
        />

        <PhotoSection
          title="Fotos evidencia"
          values={evidencePhotos}
          onChange={setEvidencePhotos}
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Cerrando..." : "Cerrar OT"}
          </button>
        </div>
      </form>
    </div>
  );

  function PhotoSection({
    title,
    values,
    onChange,
  }: {
    title: string;
    values: string[];
    onChange: React.Dispatch<React.SetStateAction<string[]>>;
  }) {
    return (
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600">
              Ingresa URLs o referencias de archivos subidos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => addPhotoField(onChange)}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
          >
            + Agregar
          </button>
        </div>

        <div className="space-y-2">
          {values.map((value, index) => (
            <div key={`${title}-${index}`} className="flex gap-2">
              <input
                value={value}
                onChange={(e) => updatePhotoList(onChange, index, e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="https://... o referencia del archivo"
              />
              <button
                type="button"
                onClick={() => removePhotoField(onChange, index)}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }
}