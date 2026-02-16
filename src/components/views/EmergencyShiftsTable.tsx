// Commit de prueba para forzar deploy Vercel
// Cambio menor para forzar deploy en Vercel
import React from 'react';
// Función para mapear el tipo de asignación
const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    preventive: 'Preventivo',
    corrective: 'Correctivo',
    emergency: 'Emergencia',
    mantenimiento: 'Mantenimiento',
    reparaciones: 'Reparaciones',
    induccion_rescate: 'Inducción de rescate',
    vista_certificacion: 'Vista certificación',
    otros: 'Otros',
    turno_emergencia: 'Turno Emergencia',
    turno: 'Turno',
  };
  return labels[type] || type;
};

interface EmergencyShiftRow {
  id: string | number;
  shift_start_date: string;
  shift_end_date: string;
  is_24h_shift?: boolean;
  shift_start_time?: string;
  shift_end_time?: string;
  is_external?: boolean;
  technician_id?: string;
  external_personnel_name?: string;
}

interface EmergencyShiftsTableProps {
  shifts: EmergencyShiftRow[];
  tecnicos?: any[];
}


export function EmergencyShiftsTable({ shifts, tecnicos }: EmergencyShiftsTableProps) {
  // Agrupar turnos por id para mostrar solo una fila por periodo
  const uniqueShifts = shifts.reduce((acc: EmergencyShiftRow[], shift) => {
    if (!acc.some(s => s.id === shift.id)) acc.push(shift);
    return acc;
  }, []);

  // Usar tecnicos y externos pasados por props
  const externos = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('external_technicians') || '[]') : [];
  const getTechnicianName = (id: string) => {
    if (!id) return '';
    const tech = (typeof tecnicos !== 'undefined' ? tecnicos : []).find((t: any) => t.id === id);
    return tech ? tech.full_name : id;
  };
  const getExternalName = (name: string) => {
    const ext = externos.find((e: any) => e.name === name);
    return ext ? ext.name : name;
  };

  // Helper para formatear fecha dd-mm-aaaa
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  // Handler base para editar/eliminar (solo UI)
  const handleEdit = (shift: EmergencyShiftRow) => {
    alert('Funcionalidad de edición próximamente');
  };
  const handleDelete = (shift: EmergencyShiftRow) => {
    alert('Funcionalidad de eliminación próximamente');
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">Turnos de emergencia del mes</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Periodo</th>
              <th className="border px-2 py-1">Formato</th>
              <th className="border px-2 py-1">Tipo</th>
              <th className="border px-2 py-1">Técnico/Empresa</th>
              <th className="border px-2 py-1">Editar</th>
              <th className="border px-2 py-1">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {uniqueShifts.map((shift, idx) => (
              <tr key={shift.id + '-' + idx} className="hover:bg-gray-50">
                <td className="border px-2 py-1 whitespace-nowrap">
                  <span className="font-semibold">Desde:</span> {formatDate(shift.shift_start_date)}<span className="mx-2"> </span>
                  <span className="font-semibold">Hasta:</span> {formatDate(shift.shift_end_date)}
                </td>
                <td className="border px-2 py-1">
                  {shift.is_24h_shift ? '24 horas' : `${shift.shift_start_time?.slice(0,5) || ''} - ${shift.shift_end_time?.slice(0,5) || ''}`}
                </td>
                <td className="border px-2 py-1">
                  {getTypeLabel(shift.type || 'turno_emergencia')}
                </td>
                <td className="border px-2 py-1">
                  {shift.is_external
                    ? (shift.external_personnel_name || 'Personal Externo')
                    : getTechnicianName(shift.technician_id || '')}
                </td>
                <td className="border px-2 py-1 text-center">
                  <button className="text-blue-600 hover:text-blue-800" onClick={() => handleEdit(shift)} title="Editar">
                    ✎
                  </button>
                </td>
                <td className="border px-2 py-1 text-center">
                  <button className="text-red-600 hover:text-red-800" onClick={() => handleDelete(shift)} title="Eliminar">
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
