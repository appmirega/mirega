// 👇 IMPORTANTE: reemplaza TODO tu ClientForm.tsx con este contenido

import React, { useState } from "react";

export function ClientForm() {
  const [tower, setTower] = useState("TORRE A");
  const [hasMachineRoom, setHasMachineRoom] = useState(true);

  return (
    <div className="space-y-6">

      {/* 🔧 BLOQUE CORREGIDO */}
      <div className="border p-4 rounded-lg space-y-4">

        <h3 className="font-semibold text-lg">
          Ficha base para ascensores
        </h3>

        {/* Torre (único campo) */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Torre
          </label>
          <input
            value={tower}
            onChange={(e) => setTower(e.target.value.toUpperCase())}
            className="border p-2 rounded w-full"
          />
        </div>

        {/* Sala de máquinas */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasMachineRoom}
            onChange={() => setHasMachineRoom(!hasMachineRoom)}
          />
          <label>Tiene sala de máquinas</label>
        </div>

      </div>

      {/* Datos técnicos */}
      <div className="grid grid-cols-2 gap-4">

        <div>
          <label>Marca</label>
          <input className="border p-2 rounded w-full" />
        </div>

        <div>
          <label>Modelo</label>
          <input className="border p-2 rounded w-full max-w-xs" />
        </div>

        <div>
          <label>N° serie</label>
          <input className="border p-2 rounded w-full max-w-xs" />
        </div>

        <div>
          <label>Fecha instalación</label>
          <input type="date" className="border p-2 rounded w-full max-w-xs" />
        </div>

      </div>

    </div>
  );
}