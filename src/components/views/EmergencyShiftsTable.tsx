// Commit de prueba para forzar deploy Vercel
// Cambio menor para forzar deploy en Vercel
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
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

  const getTechnicianName = (id: string) => {
    if (!id) return '';
    const tech = (typeof tecnicos !== 'undefined' ? tecnicos : []).find((t: any) => t.id === id);
    return tech ? tech.full_name : id;
  };


  // Helper para formatear fecha dd-mm-aaaa
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  // Handler base para editar/eliminar (solo UI)
  const [editing, setEditing] = useState<string | number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const handleEdit = (shift: EmergencyShiftRow) => {
    setEditing(shift.id);
    setEditData({
      shift_start_date: shift.shift_start_date,
      shift_end_date: shift.shift_end_date,
      is_24h_shift: shift.is_24h_shift,
      shift_start_time: shift.shift_start_time,
      shift_end_time: shift.shift_end_time,
    });
  };

  const handleDelete = async (shift: EmergencyShiftRow) => {
    if (!window.confirm('¿Eliminar este turno de emergencia?')) return;
    setLoading(true);
    const { error } = await supabase.from('emergency_shifts').delete().eq('id', shift.id);
    setLoading(false);
    if (error) return alert('Error al eliminar turno: ' + error.message);
    window.dispatchEvent(new CustomEvent('turno-emergencia-actualizado'));
  };

  const handleEditSave = async (shift: EmergencyShiftRow) => {
    setLoading(true);
    const { error } = await supabase.from('emergency_shifts').update({
      shift_start_date: editData.shift_start_date,
      shift_end_date: editData.shift_end_date,
      is_24h_shift: editData.is_24h_shift,
      shift_start_time: editData.shift_start_time,
      shift_end_time: editData.shift_end_time,
    }).eq('id', shift.id);
    setLoading(false);
    if (error) return alert('Error al editar turno: ' + error.message);
    setEditing(null);
    window.dispatchEvent(new CustomEvent('turno-emergencia-actualizado'));
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
            {uniqueShifts.map((shift, idx) => [
              <tr key={shift.id + '-' + idx} className="hover:bg-gray-50">
                <td className="border px-2 py-1 whitespace-nowrap">
                  <span className="font-semibold">Desde:</span> {formatDate(shift.shift_start_date)}<span className="mx-2"> </span>
                  <span className="font-semibold">Hasta:</span> {formatDate(shift.shift_end_date)}
                </td>
                <td className="border px-2 py-1">
                  {shift.is_24h_shift ? '24 horas' : `${shift.shift_start_time?.slice(0,5) || ''} - ${shift.shift_end_time?.slice(0,5) || ''}`}
                </td>
                <td className="border px-2 py-1">
                  {getTypeLabel('turno_emergencia')}
                </td>
                <td className="border px-2 py-1">
                  {shift.is_external
                    ? (shift.external_personnel_name || 'Personal Externo')
                    : getTechnicianName(shift.technician_id || '')}
                </td>
                <td className="border px-2 py-1 text-center">
                  {editing === shift.id ? (
                    <>
                      <button className="text-green-600 font-bold mr-2" onClick={() => handleEditSave(shift)} title="Guardar" disabled={loading}>✔</button>
                      <button className="text-gray-600" onClick={() => setEditing(null)} title="Cancelar" disabled={loading}>✖</button>
                    </>
                  ) : (
                    <button className="text-blue-600 hover:text-blue-800" onClick={() => handleEdit(shift)} title="Editar" disabled={loading}>✎</button>
                  )}
                </td>
                <td className="border px-2 py-1 text-center">
                  <button className="text-red-600 hover:text-red-800" onClick={() => handleDelete(shift)} title="Eliminar" disabled={loading}>🗑️</button>
                </td>
              </tr>,
              editing === shift.id && (
                <tr key={shift.id + '-edit'}>
                  <td colSpan={6} className="bg-blue-50 border px-2 py-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <label>Desde: <input type="date" value={editData.shift_start_date} onChange={e => setEditData({ ...editData, shift_start_date: e.target.value })} className="border rounded px-2 py-1" /></label>
                      <label>Hasta: <input type="date" value={editData.shift_end_date} onChange={e => setEditData({ ...editData, shift_end_date: e.target.value })} className="border rounded px-2 py-1" /></label>
                      <label><input type="checkbox" checked={!!editData.is_24h_shift} onChange={e => setEditData({ ...editData, is_24h_shift: e.target.checked })} /> 24h</label>
                      {!editData.is_24h_shift && (
                        <>
                          <label>Inicio: <input type="time" value={editData.shift_start_time || ''} onChange={e => setEditData({ ...editData, shift_start_time: e.target.value })} className="border rounded px-2 py-1" /></label>
                          <label>Fin: <input type="time" value={editData.shift_end_time || ''} onChange={e => setEditData({ ...editData, shift_end_time: e.target.value })} className="border rounded px-2 py-1" /></label>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
