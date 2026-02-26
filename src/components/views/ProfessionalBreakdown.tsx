import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getExternalTechnicians } from "../../lib/external_technicians";

type Row = {
  id: string;
  date: string; // YYYY-MM-DD
  type: string;
  assignee?: string | null;
  building_name?: string | null;
  description?: string | null;
};

const eventTypeLabels: Record<string, string> = {
  preventive: "Preventivo",
  corrective: "Correctivo",
  emergency: "Emergencia",
  mantenimiento: "Mantenimiento",
  reparaciones: "Reparaciones",
  induccion_rescate: "Inducción de rescate",
  vista_certificacion: "Vista certificación",
  otros: "Otros",
  turno_emergencia: "Turno Emergencia",
  turno: "Turno",
};

export function ProfessionalBreakdown({
  month,
  year,
}: {
  month: number; // 0-11
  year: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Modal edición
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editBuilding, setEditBuilding] = useState("");
  const [editPerson, setEditPerson] = useState("");
  const [editDate, setEditDate] = useState("");

  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [externalTechnicians, setExternalTechnicians] = useState<any[]>([]);
  const [edificios, setEdificios] = useState<any[]>([]);

  const monthStart = useMemo(() => {
    const d = new Date(year, month, 1);
    return d.toISOString().slice(0, 10);
  }, [year, month]);

  const monthEnd = useMemo(() => {
    const d = new Date(year, month + 1, 0);
    return d.toISOString().slice(0, 10);
  }, [year, month]);

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      // Cargar listas para edición (NO deben romper si fallan)
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "technician")
        .then(({ data }) => setTecnicos(data || []))
        .catch(() => {});

      supabase
        .from("clients")
        .select("id, company_name, address")
        .then(({ data }) => setEdificios(data || []))
        .catch(() => {});

      setExternalTechnicians(getExternalTechnicians());

      // ✅ Fuente principal: calendar_events
      // Ajusta nombres si tu tabla usa otras columnas (date vs event_date, person vs assignee, etc.)
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, date, title, description, status, building_name, person, type")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      if (error) throw error;

      const mapped: Row[] = (data || []).map((x: any) => ({
        id: String(x.id),
        date: x.date,
        type: x.type ?? "otros",
        assignee: x.person ?? null,
        building_name: x.building_name ?? null,
        description: x.description ?? x.title ?? null,
      }));

      setRows(mapped);
    } catch (e: any) {
      setError(e?.message || "Error cargando asignaciones del mes.");
      setRows([]); // importantísimo: no romper render
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const onRefresh = () => load();
    window.addEventListener("asignacion-eliminada", onRefresh);
    return () => window.removeEventListener("asignacion-eliminada", onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, monthEnd]);

  const handleDelete = async (r: Row) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta asignación?")) return;

    const { error } = await supabase.from("calendar_events").delete().eq("id", r.id);
    if (error) {
      alert("Error al eliminar: " + error.message);
      return;
    }
    window.dispatchEvent(new Event("asignacion-eliminada"));
  };

  const handleEdit = (r: Row) => {
    setEditRow(r);
    setEditDesc(r.description || "");
    setEditBuilding(r.building_name || "");
    setEditPerson(r.assignee || "");
    setEditDate(r.date || "");
  };

  const handleEditSave = async () => {
    if (!editRow) return;

    // ✅ Mantenemos columnas coherentes con lo que seleccionamos arriba
    const { error } = await supabase
      .from("calendar_events")
      .update({
        description: editDesc,
        building_name: editBuilding,
        person: editPerson,
        date: editDate,
      })
      .eq("id", editRow.id);

    if (error) {
      alert("Error al editar: " + error.message);
      return;
    }

    setEditRow(null);
    window.dispatchEvent(new Event("asignacion-eliminada"));
  };

  const titleMonth = `${String(month + 1).padStart(2, "0")}-${year}`;

  return (
    <div className="border rounded-lg bg-white p-4">
      <h3 className="font-semibold text-gray-900 mb-2">Asignación del mes ({titleMonth})</h3>

      {loading && <div className="text-gray-600 text-sm">Cargando asignaciones...</div>}

      {error && (
        <div className="mt-2 border border-red-200 bg-red-50 text-red-700 rounded px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="text-gray-500 text-sm">No hay asignaciones en este mes.</div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto max-h-[420px] mt-3">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Fecha</th>
                <th className="border px-2 py-1">Tipo</th>
                <th className="border px-2 py-1">Asignado</th>
                <th className="border px-2 py-1">Edificio</th>
                <th className="border px-2 py-1">Descripción</th>
                <th className="border px-2 py-1">Listo</th>
                <th className="border px-2 py-1">Editar</th>
                <th className="border px-2 py-1">Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const key = `${r.id}-${idx}`;
                const [yy, mm, dd] = (r.date || "").split("-");
                const dateLabel = yy && mm && dd ? `${dd}-${mm}-${yy}` : r.date;

                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="border px-2 py-1">{dateLabel}</td>
                    <td className="border px-2 py-1">{eventTypeLabels[r.type] || r.type}</td>
                    <td className="border px-2 py-1">{r.assignee || "-"}</td>
                    <td className="border px-2 py-1">{r.building_name || "-"}</td>
                    <td className="border px-2 py-1">{r.description || "-"}</td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={!!checked[key]}
                        onChange={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        className="text-blue-600 hover:underline"
                        title="Editar asignación"
                        onClick={() => handleEdit(r)}
                      >
                        ✏️
                      </button>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        className="text-red-600 hover:underline"
                        title="Eliminar asignación"
                        onClick={() => handleDelete(r)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold">Editar Asignación</h2>
              <button onClick={() => setEditRow(null)} className="text-gray-500 hover:text-red-600">
                ✕
              </button>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-semibold mb-1">Fecha</label>
              <input
                type="date"
                className="border rounded px-2 py-1 w-full"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>

            <div className="mb-2">
              <label className="block text-sm font-semibold mb-1">Técnico/Empresa</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={editPerson}
                onChange={(e) => setEditPerson(e.target.value)}
              >
                <option value="">Selecciona técnico interno o empresa externa</option>
                {tecnicos.map((t: any) => (
                  <option key={t.id} value={t.full_name}>
                    {t.full_name} (Interno)
                  </option>
                ))}
                {externalTechnicians.length > 0 && <option disabled>──────────</option>}
                {externalTechnicians.map((ext: any) => (
                  <option key={ext.id} value={ext.name}>
                    {ext.name} (Externo)
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-semibold mb-1">Edificio</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={editBuilding}
                onChange={(e) => setEditBuilding(e.target.value)}
              >
                <option value="">Selecciona un edificio</option>
                {edificios.map((e: any) => (
                  <option key={e.id} value={e.company_name}>
                    {e.company_name} - {e.address}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-semibold mb-1">Descripción</label>
              <textarea
                className="border rounded px-2 py-1 w-full"
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>

            <button
              className="bg-blue-600 text-white px-4 py-2 rounded mt-2 w-full"
              onClick={handleEditSave}
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}