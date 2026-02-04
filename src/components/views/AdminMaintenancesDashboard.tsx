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
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({
    building_id: '',
    client_id: '',
    scheduled_date: '',
    status: 'pending',
    notes: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string|null>(null);
  const [buildingsList, setBuildingsList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  // Nuevo: guardar el último mantenimiento creado
  const [lastCreatedMaintenance, setLastCreatedMaintenance] = useState<any|null>(null);
  const [showChecklistView, setShowChecklistView] = useState(false);
    useEffect(() => {
      if (showNewForm) {
        loadBuildingsAndClients();
      }
    }, [showNewForm]);

    const loadBuildingsAndClients = async () => {
      const { data: buildings } = await supabase.from('buildings').select('id, name, client_id').eq('is_active', true);
      const { data: clients } = await supabase.from('clients').select('id, company_name');
      setBuildingsList(buildings || []);
      setClientsList(clients || []);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateMaintenance = async (e: React.FormEvent) => {
      e.preventDefault();
      setFormLoading(true);
      setFormError(null);
      try {
        const { data, error } = await supabase.from('maintenance_schedules').insert({
          building_id: formData.building_id,
          client_id: formData.client_id,
          scheduled_date: formData.scheduled_date,
          status: formData.status,
          notes: formData.notes
        }).select('id, building_id, client_id, scheduled_date, status');
        if (error) throw error;
        setShowNewForm(false);
        setFormData({ building_id: '', client_id: '', scheduled_date: '', status: 'pending', notes: '' });
        loadMaintenances();
        // Guardar el mantenimiento recién creado para acceso directo al checklist
        if (data && data.length > 0) {
          setLastCreatedMaintenance(data[0]);
        }
      } catch (err: any) {
        setFormError(err.message || 'Error al crear mantenimiento');
      } finally {
        setFormLoading(false);
      }
    };
  const [filter, setFilter] = useState('');
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
            onClick={() => setShowNewForm(true)}
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
      {showNewForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded shadow max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Nuevo Mantenimiento</h2>
            <form onSubmit={handleCreateMaintenance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Edificio</label>
                <select name="building_id" value={formData.building_id} onChange={handleFormChange} required className="w-full border rounded px-2 py-1">
                  <option value="">Selecciona un edificio</option>
                  {buildingsList.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <select name="client_id" value={formData.client_id} onChange={handleFormChange} required className="w-full border rounded px-2 py-1">
                  <option value="">Selecciona un cliente</option>
                  {clientsList.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fecha Programada</label>
                <input type="date" name="scheduled_date" value={formData.scheduled_date} onChange={handleFormChange} required className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea name="notes" value={formData.notes} onChange={handleFormChange} className="w-full border rounded px-2 py-1" />
              </div>
              {formError && <div className="text-red-600 text-sm">{formError}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={() => setShowNewForm(false)} disabled={formLoading}>Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={formLoading}>{formLoading ? 'Guardando...' : 'Crear'}</button>
              </div>
            </form>
            {/* Acceso directo al checklist tras crear */}
            {lastCreatedMaintenance && (
              <div className="mt-6 flex flex-col items-center">
                <button
                  className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 font-semibold"
                  onClick={() => { setShowNewForm(false); setShowChecklistView(true); }}
                >
                  Ir al checklist de mantenimiento
                </button>
                <span className="text-xs text-slate-500 mt-2">Registra el mantenimiento como técnico</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
