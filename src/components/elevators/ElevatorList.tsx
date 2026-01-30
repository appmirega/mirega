import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ElevatorCard, { Elevator } from "./ElevatorCard";

function useQueryParam(name: string) {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || "";
  }, [name]);
}

export default function ElevatorList() {
  const clientId = useQueryParam("client_id"); // ← ?client_id=xxxx
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Elevator[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError(null);

      // base query
      let query = supabase
        .from("elevators")
        .select(
          [
            "id",
            "client_id",
            "tower_name",
            "index_number",
            "location_name",
            "elevator_type",
            "manufacturer",
            "model",
            "serial_number",
            "serial_number_not_legible",
            "capacity_kg",
            "floors",
            "installation_date",
            "has_machine_room",
            "no_machine_room",
            "stops_all_floors",
            "stops_odd_floors",
            "stops_even_floors",
            "classification",
          ].join(",")
        )
        .order("tower_name", { ascending: true, nullsFirst: true })
        .order("index_number", { ascending: true, nullsFirst: true });

      if (clientId) query = query.eq("client_id", clientId);

      const { data, error } = await query;

      if (ignore) return;
      if (error) {
        setError(error.message);
      } else {
        setItems((data || []) as unknown as Elevator[]);
      }
      setLoading(false);
    })();

    return () => {
      ignore = true;
    };
  }, [clientId]);

  if (loading) {
    return <div className="text-slate-600">Cargando ascensores…</div>;
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center text-slate-600">
        {clientId ? "Este cliente no tiene ascensores registrados." : "No hay ascensores registrados."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((e) => (
        <ElevatorCard key={e.id} e={e} />
      ))}
    </div>
  );
}
