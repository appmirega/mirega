// Commit de prueba para forzar deploy Vercel
// Cambio menor para forzar deploy en Vercel
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
                  {shift.shift_start_date} - {shift.shift_end_date}
                </td>
                <td className="border px-2 py-1">
                  {shift.is_24h_shift ? '24 horas' : `${shift.shift_start_time?.slice(0,5) || ''} - ${shift.shift_end_time?.slice(0,5) || ''}`}
                </td>
                <td className="border px-2 py-1">
                  {shift.is_external ? getExternalName(shift.external_personnel_name || '') : getTechnicianName(shift.technician_id || '')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
