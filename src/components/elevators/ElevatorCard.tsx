import { Eye, ClipboardList, Settings } from "lucide-react";

export type Elevator = {
  id: string;
  client_id: string;
  tower_name: string | null;       // e.g. "A", "Torre 1"
  index_number: number | null;     // e.g. 1,2,3...
  location_name: string | null;    // alias visible si lo usas
  elevator_type: "hydraulic" | "electromechanical";
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  serial_number_not_legible: boolean | null;
  capacity_kg: number | null;
  floors: number | null;
  installation_date: string | null;
  has_machine_room: boolean | null;
  no_machine_room: boolean | null;
  stops_all_floors: boolean | null;
  stops_odd_floors: boolean | null;
  stops_even_floors: boolean | null;
  classification:
    | "ascensor_corporativo"
    | "ascensor_residencial"
    | "montacargas"
    | "montaplatos";
};

type Props = {
  e: Elevator;
};

export default function ElevatorCard({ e }: Props) {
  const n = e.index_number ?? undefined;
  const torre = (e.tower_name || "").trim();
  const headerLeft =
    n ? `Ascensor #${n}` : (e.location_name?.trim() || "Ascensor");

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h4 className="text-lg font-semibold text-slate-900">
            {headerLeft}
          </h4>
          <p className="text-sm text-slate-600">
            {torre ? <>Torre/Identificador: <span className="font-medium">{torre}</span></> : "Sin torre/identificador"}
          </p>
        </div>

        {/* Acciones (placeholders) */}
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
            <Eye className="h-4 w-4" />
            Ver Detalles
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700">
            <ClipboardList className="h-4 w-4" />
            Llenar Partes
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700">
            <Settings className="h-4 w-4" />
            Gestionar Partes
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Información General */}
        <div>
          <h5 className="mb-2 text-sm font-semibold text-slate-800">
            Información General
          </h5>
          <dl className="space-y-1 text-sm">
            <div className="flex">
              <dt className="w-28 text-slate-500">Clasificación:</dt>
              <dd className="flex-1 capitalize">
                {e.classification?.replace("_", " ") || "-"}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-28 text-slate-500">Pisos:</dt>
              <dd className="flex-1">{e.floors ?? "-"}</dd>
            </div>
            <div className="flex">
              <dt className="w-28 text-slate-500">Capacidad:</dt>
              <dd className="flex-1">{e.capacity_kg ? `${e.capacity_kg} kg` : "-"}</dd>
            </div>
          </dl>
        </div>

        {/* Especificaciones */}
        <div>
          <h5 className="mb-2 text-sm font-semibold text-slate-800">
            Especificaciones Técnicas
          </h5>
          <dl className="space-y-1 text-sm">
            <div className="flex">
              <dt className="w-28 text-slate-500">Tipo:</dt>
              <dd className="flex-1">
                {e.elevator_type === "hydraulic" ? "Hidráulico" : "Electromecánico"}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-28 text-slate-500">Fabricante:</dt>
              <dd className="flex-1">{e.manufacturer || "-"}</dd>
            </div>
            <div className="flex">
              <dt className="w-28 text-slate-500">Modelo:</dt>
              <dd className="flex-1">{e.model || "-"}</dd>
            </div>
            <div className="flex">
              <dt className="w-28 text-slate-500">N° Serie:</dt>
              <dd className="flex-1">
                {e.serial_number_not_legible ? (
                  <span className="italic text-orange-600">No legible / No disponible</span>
                ) : (e.serial_number || "-")}
              </dd>
            </div>
          </dl>
        </div>

        {/* Operativas */}
        <div>
          <h5 className="mb-2 text-sm font-semibold text-slate-800">
            Características Operativas
          </h5>
          <dl className="space-y-1 text-sm">
            <div className="flex">
              <dt className="w-36 text-slate-500">Sala de Máquinas:</dt>
              <dd className="flex-1">
                {e.has_machine_room ? "Con sala de máquinas" : e.no_machine_room ? "Sin sala de máquinas" : "-"}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-36 text-slate-500">Paradas:</dt>
              <dd className="flex-1">
                {e.stops_all_floors
                  ? "Todos los pisos"
                  : e.stops_odd_floors
                  ? "Solo impares"
                  : e.stops_even_floors
                  ? "Solo pares"
                  : "-"}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-36 text-slate-500">Instalación:</dt>
              <dd className="flex-1">{e.installation_date || "-"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
