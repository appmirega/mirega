import React from 'react';

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
}

export const EmergencyShiftsTable: React.FC<EmergencyShiftsTableProps> = ({ shifts }) => {
  // Agrupar turnos por id para mostrar solo una fila por periodo
  const uniqueShifts = shifts.reduce((acc: EmergencyShiftRow[], shift) => {
    if (!acc.some(s => s.id === shift.id)) acc.push(shift);
    return acc;
  }, []);
  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">Turnos de emergencia del mes</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Periodo</th>
              <th className="border px-2 py-1">Formato</th>
              <th className="border px-2 py-1">Técnico/Empresa</th>
            </tr>
          </thead>
          <tbody>
            {uniqueShifts.map((shift, idx) => (
              <tr key={shift.id + '-' + idx} className="hover:bg-gray-50">
                <td className="border px-2 py-1">
                  {new Date(shift.shift_start_date).toLocaleDateString()} - {new Date(shift.shift_end_date).toLocaleDateString()}
                </td>
                <td className="border px-2 py-1">
                  {shift.is_24h_shift ? '24 horas' : `${shift.shift_start_time?.slice(0,5) || ''} - ${shift.shift_end_time?.slice(0,5) || ''}`}
                </td>
                <td className="border px-2 py-1">
                  {shift.is_external ? shift.external_personnel_name : shift.technician_id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
