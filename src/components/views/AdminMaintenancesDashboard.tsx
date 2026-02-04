import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Download, Filter, Wrench } from 'lucide-react';


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

export function AdminMaintenancesDashboard() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChecklistView, setShowChecklistView] = useState(false);
  const [showOperativeView, setShowOperativeView] = useState(false);


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
      setMaintenances(data || []);
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

  if (showOperativeView) {
    // Renderiza la vista operativa de mantenimientos (técnico)
    // Importa TechnicianMaintenanceChecklistView si no está
    // @ts-ignore
    const TechnicianMaintenanceChecklistView = require('./TechnicianMaintenanceChecklistView').TechnicianMaintenanceChecklistView;
    return <div className="p-6"><button className="mb-4 px-4 py-2 bg-gray-200 rounded" onClick={() => setShowOperativeView(false)}>Volver al dashboard</button><TechnicianMaintenanceChecklistView /></div>;
  }

  if (showChecklistView && lastCreatedMaintenance) {
    // Renderizar TechnicianMaintenanceChecklistView con datos preseleccionados
    // @ts-ignore
    const TechnicianMaintenanceChecklistView = require('./TechnicianMaintenanceChecklistView').TechnicianMaintenanceChecklistView;
    // Pasar props para inicializar el checklist (se puede expandir según lo que acepte el componente)
    return (
      <div className="p-6">
        <button className="mb-4 px-4 py-2 bg-gray-200 rounded" onClick={() => setShowChecklistView(false)}>Volver al dashboard</button>
        <TechnicianMaintenanceChecklistView
          initialMode="client-selection"
          initialClientId={lastCreatedMaintenance.client_id}
          initialBuildingId={lastCreatedMaintenance.building_id}
          initialScheduledDate={lastCreatedMaintenance.scheduled_date}
        />
      </div>
    );
  }
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Mantenimientos</h1>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={() => setShowChecklistView(true)}
          >
            <Plus className="w-5 h-5" /> Nuevo Mantenimiento
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            onClick={() => setShowOperativeView(true)}
          >
            <Wrench className="w-5 h-5" /> Vista Operativa
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
    </div>
  );
}
