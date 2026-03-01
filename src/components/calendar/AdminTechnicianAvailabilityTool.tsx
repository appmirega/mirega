import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { TechnicianAvailabilityPanel } from "./TechnicianAvailabilityPanel";

type Technician = {
  technician_id: string;
  full_name: string;
  phone: string;
  email: string;
  is_on_leave: boolean;
  assignments_today: number;
  emergency_shift_type?: string;
};

export function AdminTechnicianAvailabilityTool() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [absences, setAbsences] = useState<Map<string, Map<string, string[]>>>(new Map());
  const [loading, setLoading] = useState(false);

  const loadTechnicians = async () => {
    const { data, error } = await supabase.from("v_technician_availability_today").select("*");
    if (error) throw error;
    setTechnicians((data as any[]) || []);
  };

  const loadAbsences = async () => {
    const { data, error } = await supabase
      .from("technician_availability")
      .select("technician_id, start_date, end_date, reason")
      .eq("status", "approved");

    if (error) throw error;

    const absenceMap = new Map<string, Map<string, string[]>>();

    (data || []).forEach((absence: any) => {
      const [sy, sm, sd] = String(absence.start_date).split("-").map(Number);
      const [ey, em, ed] = String(absence.end_date).split("-").map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;

        if (!absenceMap.has(dateStr)) absenceMap.set(dateStr, new Map());
        if (!absenceMap.get(dateStr)!.has(absence.technician_id)) {
          absenceMap.get(dateStr)!.set(absence.technician_id, []);
        }
        absenceMap.get(dateStr)!.get(absence.technician_id)!.push(absence.reason);
      }
    });

    setAbsences(absenceMap);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      await Promise.all([loadTechnicians(), loadAbsences()]);
    } catch (e) {
      console.error("[AdminTechnicianAvailabilityTool] refresh error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yyyy = currentDate.getFullYear();
  const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
  const dd = String(currentDate.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold">Disponibilidad de técnicos</div>
          <div className="text-sm text-slate-500">
            {loading ? "Cargando..." : "Revisa ausencias y carga del día."}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="rounded-md border px-3 py-2 text-sm"
            value={dateStr}
            onChange={(e) => {
              const [y, m, d] = e.target.value.split("-").map(Number);
              setCurrentDate(new Date(y, m - 1, d));
            }}
          />
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={refresh}
            type="button"
          >
            Refrescar
          </button>
        </div>
      </div>

      <TechnicianAvailabilityPanel
        technicians={technicians}
        currentDate={currentDate}
        onRefresh={refresh}
        absences={absences}
      />
    </div>
  );
}