import React, { useState } from 'react';

interface BreakdownEvent {
  id: string | number;
  date: string;
  type: string;
  assignee?: string;
  building_name?: string;
  shift_hours?: string;
  status?: string;
  description?: string;
  is_external?: boolean;
  is_primary?: boolean;
}

interface ProfessionalBreakdownProps {
  events: BreakdownEvent[];
  selectedMonth: number;
  selectedYear: number;
}

const eventTypeLabels: Record<string, string> = {
  mantenimiento: 'Mantenimiento',
  reparaciones: 'Reparaciones',
  induccion_rescate: 'Inducción de rescate',
  vista_certificacion: 'Vista certificación',
  otros: 'Otros',
};

export const ProfessionalBreakdown: React.FC<ProfessionalBreakdownProps> = ({ events, selectedMonth, selectedYear }) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // Agrupar eventos por día
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const grouped: Record<string, BreakdownEvent[]> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    grouped[dateStr] = [];
  }
  events.forEach(ev => {
    if (grouped[ev.date]) grouped[ev.date].push(ev);
  });

  // Funciones para editar y eliminar
  const handleEdit = (ev: BreakdownEvent) => {
    alert('Funcionalidad de edición en desarrollo');
    // Aquí puedes abrir un modal o formulario para editar la asignación
  };
  const handleDelete = async (ev: BreakdownEvent) => {
    if (window.confirm('¿Seguro que deseas eliminar esta asignación?')) {
      // Eliminar en Supabase
      // ...implementar lógica de eliminación...
      alert('Funcionalidad de eliminación en desarrollo');
    }
  };
  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-4 uppercase tracking-wide">Asignación del mes</h2>
      <div className="overflow-x-auto">
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
            {Object.entries(grouped).flatMap(([date, dayEvents]) =>
              dayEvents.length === 0 ? [] :
                dayEvents.map((ev, idx) => (
                  <tr key={ev.id + '-' + idx} className="hover:bg-gray-50">
                    <td className="border px-2 py-1">{new Date(date).toLocaleDateString()}</td>
                    <td className="border px-2 py-1">{eventTypeLabels[ev.type] || ev.type}</td>
                    <td className="border px-2 py-1">{ev.assignee || '-'}</td>
                    <td className="border px-2 py-1">{ev.building_name || '-'}</td>
                    <td className="border px-2 py-1">{ev.description || '-'}</td>
                    <td className="border px-2 py-1 text-center">
                      <input type="checkbox" checked={!!checked[ev.id + '-' + idx]} onChange={() => setChecked(c => ({ ...c, [ev.id + '-' + idx]: !c[ev.id + '-' + idx] }))} />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button className="text-blue-600 hover:underline" title="Editar asignación" onClick={() => handleEdit(ev)}>✏️</button>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button className="text-red-600 hover:underline" title="Eliminar asignación" onClick={() => handleDelete(ev)}>🗑️</button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      {/* Sección inicial para validar solicitudes */}
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4">Validación de Solicitudes</h2>
        <div className="bg-white border rounded shadow p-4">
          <p className="mb-2 text-gray-700">Aquí aparecerán las solicitudes pendientes para validar, aprobar o rechazar.</p>
          <div className="text-gray-400">(Funcionalidad en desarrollo)</div>
        </div>
      </div>
    </div>
  );
};
