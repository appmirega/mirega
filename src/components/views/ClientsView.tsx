import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";

type ElevatorRow = {
  id: string;
  client_id: string;
  tower_name: string | null;
  elevator_number: number | null;
  index_number: number | null;
  brand: string | null;
  model: string | null;
  capacity_persons: number | null;
  capacity_kg: number | null;
};

type Client = {
  id: string;
  name: string;
};

function compareElevators(a: ElevatorRow, b: ElevatorRow) {
  const numA = a.elevator_number ?? a.index_number ?? 0;
  const numB = b.elevator_number ?? b.index_number ?? 0;
  return numA - numB;
}

function getTowerRank(name: string | null) {
  if (!name) return 9999;

  const upper = name.toUpperCase();

  // Letras A, B, C
  if (/^[A-Z]$/.test(upper)) {
    return upper.charCodeAt(0);
  }

  // Números
  if (!isNaN(Number(upper))) {
    return 1000 + Number(upper);
  }

  // Otros nombres
  return 2000 + upper.charCodeAt(0);
}

export function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [elevators, setElevators] = useState<ElevatorRow[]>([]);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const { data } = await supabase.from("clients").select("*");
    setClients(data || []);
  }

  async function loadElevators(clientId: string) {
    const { data } = await supabase
      .from("elevators")
      .select("*")
      .eq("client_id", clientId);

    setElevators(data || []);
  }

  function handleSelect(client: Client) {
    setSelectedClient(client);
    loadElevators(client.id);
  }

  const grouped = useMemo(() => {
    const map: Record<string, ElevatorRow[]> = {};

    elevators.forEach((e) => {
      const key = e.tower_name || "SIN TORRE";
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });

    return Object.entries(map)
      .sort(([a], [b]) => getTowerRank(a) - getTowerRank(b))
      .map(([tower, list]) => ({
        tower,
        elevators: list.sort(compareElevators),
      }));
  }, [elevators]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Gestión de Clientes</h1>

      {/* LISTA CLIENTES */}
      <div className="grid grid-cols-2 gap-4">
        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelect(c)}
            className="border p-3 rounded hover:bg-gray-100 text-left"
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* DETALLE */}
      {selectedClient && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">
            Cliente: {selectedClient.name}
          </h2>

          {grouped.map((group) => (
            <div key={group.tower} className="border rounded p-4">
              <h3 className="font-semibold mb-2">
                Torre: {group.tower}
              </h3>

              <div className="space-y-2">
                {group.elevators.map((e) => (
                  <div
                    key={e.id}
                    className="border p-2 rounded flex justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        Ascensor{" "}
                        {e.elevator_number ?? e.index_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {e.brand} {e.model}
                      </div>
                    </div>

                    <div className="text-sm text-right">
                      <div>{e.capacity_persons} personas</div>
                      <div>{e.capacity_kg} kg</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {grouped.length === 0 && (
            <p className="text-gray-500">
              Este cliente no tiene ascensores.
            </p>
          )}
        </div>
      )}
    </div>
  );
}