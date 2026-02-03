import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Download, Filter } from 'lucide-react';

interface Maintenance {
  id: string;
  building: string;
  client: string;
  scheduled_date: string;
  status: string;
}

export function AdminMaintenancesDashboard() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadMaintenances();
  }, []);

  const loadMaintenances = async () => {
    setLoading(true);
    // Simulación: reemplazar por fetch real a supabase
    setMaintenances([
      { id: '1', building: 'Edificio A', client: 'Cliente X', scheduled_date: '2026-02-10', status: 'pending' },
      { id: '2', building: 'Edificio B', client: 'Cliente Y', scheduled_date: '2026-02-12', status: 'completed' },
    ]);
    setLoading(false);
  };

  const handleDownload = () => {
    // Lógica de descarga masiva
    alert('Descarga masiva de PDFs (simulado)');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Mantenimientos</h1>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          onClick={() => setShowNewForm(true)}
        >
          <Plus className="w-5 h-5" /> Nuevo Mantenimiento
        </button>
      </div>
      <div className="flex gap-4 mb-4">
        <button className="flex items-center gap-2 px-3 py-2 bg-gray-200 rounded hover:bg-gray-300">
          <Filter className="w-4 h-4" /> Filtros
        </button>
        <button className="flex items-center gap-2 px-3 py-2 bg-green-200 rounded hover:bg-green-300" onClick={handleDownload}>
          <Download className="w-4 h-4" /> Descargar PDFs
        </button>
      </div>
      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Edificio</th>
            <th className="p-2">Cliente</th>
            <th className="p-2">Fecha</th>
            <th className="p-2">Estado</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="text-center p-4">Cargando...</td></tr>
          ) : maintenances.length === 0 ? (
            <tr><td colSpan={5} className="text-center p-4">No hay mantenimientos</td></tr>
          ) : (
            maintenances.map(m => (
              <tr key={m.id} className="border-b">
                <td className="p-2">{m.building}</td>
                <td className="p-2">{m.client}</td>
                <td className="p-2">{m.scheduled_date}</td>
                <td className="p-2">{m.status === 'pending' ? 'Pendiente' : 'Completado'}</td>
                <td className="p-2 flex gap-2">
                  <button className="text-blue-600 hover:underline flex items-center gap-1"><Edit className="w-4 h-4" /> Editar</button>
                  {/* Otras acciones: ver, eliminar, etc. */}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {showNewForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded shadow max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Nuevo Mantenimiento</h2>
            {/* Aquí va el formulario real de creación */}
            <button className="mt-4 px-4 py-2 bg-gray-200 rounded" onClick={() => setShowNewForm(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
