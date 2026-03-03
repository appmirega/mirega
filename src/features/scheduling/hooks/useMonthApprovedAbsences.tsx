import { useEffect, useMemo, useState } from "react";
import type { TechnicianAbsenceRow } from "../domain/technicianAbsence";
import { fetchApprovedAbsencesOverlappingMonth } from "../data/technicianAbsenceRepo";

export function useMonthApprovedAbsences(monthStart: string, monthEnd: string) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TechnicianAbsenceRow[]>([]);
  const [error, setError] = useState<string>("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchApprovedAbsencesOverlappingMonth({ monthStart, monthEnd });
      setRows(data);
    } catch (e: any) {
      setError(e?.message || "Error cargando ausencias aprobadas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, monthEnd]);

  return useMemo(() => ({ loading, rows, error, reload }), [loading, rows, error]);
}