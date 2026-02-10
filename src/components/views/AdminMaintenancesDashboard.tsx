import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Download, Filter } from 'lucide-react';


interface Maintenance {
  id: string;
  building: {
    name: string;
    address: string;
  };
  client: {
    company_name: string;
  };
  scheduled_date: string;
  status: string;
}

interface AdminMaintenancesDashboardProps {
  onNewMaintenance?: () => void;
}

export function AdminMaintenancesDashboard({ onNewMaintenance }: AdminMaintenancesDashboardProps = {}) {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  // Solo dashboard, sin vista operativa ni checklist técnico


  useEffect(() => {
    loadMaintenances();
  }, []);

  const loadMaintenances = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          id,
          scheduled_date,
          status,
          building:building_id (name, address),
          client:client_id (company_name)
        `)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      // Corregir: Supabase retorna arrays para relaciones, tomar el primer elemento
      setMaintenances(
        (data || []).map((m: any) => ({
          ...m,
          building: Array.isArray(m.building) ? m.building[0] : m.building,
          client: Array.isArray(m.client) ? m.client[0] : m.client,
        }))
      );
    } catch (err) {
      console.error('Error loading maintenances:', err);
      setMaintenances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    // Lógica de descarga masiva
    alert('Descarga masiva de PDFs (simulado)');
  };

  // El dashboard admin no debe mostrar la vista de técnico ni lógica de checklist técnico
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Mantenimientos</h1>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            onClick={onNewMaintenance}
            title="Crear nueva mantención"
          >
            <Plus className="w-5 h-5" /> Nuevo Mantenimiento
          </button>
        </div>
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
                <td className="p-2">{m.building?.name || '-'}</td>
                <td className="p-2">{m.client?.company_name || '-'}</td>
                <td className="p-2">{m.scheduled_date?.split('T')[0]}</td>
                <td className="p-2">{m.status === 'pending' ? 'Pendiente' : m.status === 'completed' ? 'Completado' : m.status}</td>
                <td className="p-2 flex gap-2">
                  <button className="text-blue-600 hover:underline flex items-center gap-1"><Edit className="w-4 h-4" /> Editar</button>
                  {/* Otras acciones: ver, eliminar, etc. */}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* El formulario de agendamiento y lógica asociada han sido eliminados. */}
      <div className="mt-6 text-center text-blue-700 font-semibold">Funcionalidad de creación de mantenimientos en desarrollo.</div>
    </div>
  );
}
