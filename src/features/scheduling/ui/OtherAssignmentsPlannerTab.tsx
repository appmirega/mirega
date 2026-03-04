import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Technician = {
  id: string;
  full_name: string;
};

export default function OtherAssignmentsPlannerTab() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [technicianId, setTechnicianId] = useState<string>("");

  const [eventType, setEventType] = useState<string>("repair");
  const [eventDate, setEventDate] = useState<string>("");

  const [title, setTitle] = useState<string>("");

  useEffect(() => {
    loadTechnicians();
  }, []);

  async function loadTechnicians() {
    const { data } = await supabase
      .from("technicians")
      .select("id,full_name")
      .order("full_name");

    setTechnicians(data || []);
  }

  async function createAssignment() {
    if (!eventDate) {
      alert("Selecciona una fecha");
      return;
    }

    const start = `${eventDate}T00:00:00`;
    const end = `${eventDate}T23:59:59`;

    const { error } = await supabase.from("calendar_events").insert({
      event_type: eventType,
      technician_id: technicianId || null,
      client_id: null,
      building_name: null,
      event_date: eventDate,
      start_at: start,
      end_at: end,
      status: "scheduled",
      title: title || eventType,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Asignación creada");

    setTitle("");
    setEventDate("");
  }

  return (
    <div className="p-4 border rounded-lg bg-white space-y-4">

      <h2 className="text-lg font-semibold">
        Crear asignación manual
      </h2>

      <div className="grid gap-3 md:grid-cols-2">

        <div>
          <label className="text-sm">Tipo</label>

          <select
            className="w-full border rounded p-2"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="repair">Reparación</option>
            <option value="technical_visit">Visita técnica</option>
            <option value="inspection">Inspección</option>
            <option value="certification">Certificación</option>
            <option value="rescue_training">Inducción rescate</option>
            <option value="support">Soporte</option>
          </select>
        </div>

        <div>
          <label className="text-sm">Fecha</label>

          <input
            type="date"
            className="w-full border rounded p-2"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm">Técnico</label>

          <select
            className="w-full border rounded p-2"
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
          >
            <option value="">Sin asignar</option>

            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm">Título</label>

          <input
            className="w-full border rounded p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

      </div>

      <button
        onClick={createAssignment}
        className="bg-slate-900 text-white px-4 py-2 rounded"
      >
        Crear asignación
      </button>

    </div>
  );
}