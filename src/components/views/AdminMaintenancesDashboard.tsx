
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Download } from 'lucide-react';

interface Maintenance {
  id: string;
  building_name: string;
  building_address: string;
  elevators_count: number;
  created_at: string;
  is_active: boolean;
  client: { company_name: string } | null;
}

interface Filters {
  building: string;
  elevator: string;
  client: string;
  year: string;
}

export function AdminMaintenancesDashboard({ onNewMaintenance }: { onNewMaintenance?: () => void } = {}) {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [filtered, setFiltered] = useState<Maintenance[]>([]);
  const [filters, setFilters] = useState<Filters>({ building: '', elevator: '', client: '', year: '' });
  const [buildingOptions, setBuildingOptions] = useState<string[]>([]);
  const [elevatorOptions, setElevatorOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaintenances();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, maintenances]);

  const loadMaintenances = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`id, building_name, building_address, elevators_count, created_at, is_active, client:client_id (company_name)`) // relación con clients
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMaintenances(data || []);
      // Extraer opciones únicas para los selects
      const buildings = Array.from(new Set((data || []).map(m => m.building_name).filter(Boolean)));
      const elevators = Array.from(new Set((data || []).map(m => String(m.elevators_count)).filter(Boolean)));
      const clients = Array.from(new Set((data || []).map(m => m.client?.company_name).filter(Boolean)));
      const years = Array.from(new Set((data || []).map(m => m.created_at?.slice(0,4)).filter(Boolean)));
      setBuildingOptions(buildings);
      setElevatorOptions(elevators);
      setClientOptions(clients);
      setYearOptions(years);
    } catch (err) {
      console.error('Error loading maintenances:', err);
      setMaintenances([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = maintenances;
    if (filters.building)
      result = result.filter(m => m.building_name.toLowerCase().includes(filters.building.toLowerCase()));
    if (filters.elevator)
      result = result.filter(m => String(m.elevators_count).includes(filters.elevator));
    if (filters.client)
      result = result.filter(m => m.client?.company_name?.toLowerCase().includes(filters.client.toLowerCase()));
    if (filters.year)
      result = result.filter(m => m.created_at.startsWith(filters.year));
    setFiltered(result);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleDownload = () => {
    alert('Descarga masiva de PDFs (simulado)');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Mantenimientos</h1>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          onClick={onNewMaintenance}
          title="Ir a vista de mantenimiento"
        >
          <Plus className="w-5 h-5" /> Nuevo Mantenimiento
        </button>
      </div>
      <div className="flex gap-2 mb-4">
        <select
          className="px-3 py-2 border rounded"
          name="building"
          value={filters.building}
          onChange={handleFilterChange as any}
        >
          <option value="">Filtrar por edificio</option>
          {buildingOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select
          className="px-3 py-2 border rounded"
          name="elevator"
          value={filters.elevator}
          onChange={handleFilterChange as any}
        >
          <option value="">Filtrar por ascensores</option>
          {elevatorOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select
          className="px-3 py-2 border rounded"
          name="client"
          value={filters.client}
          onChange={handleFilterChange as any}
        >
          <option value="">Filtrar por cliente</option>
          {clientOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select
          className="px-3 py-2 border rounded"
          name="year"
          value={filters.year}
          onChange={handleFilterChange as any}
        >
          <option value="">Filtrar por año (YYYY)</option>
          {yearOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <button className="flex items-center gap-2 px-3 py-2 bg-green-200 rounded hover:bg-green-300" onClick={handleDownload}>
          <Download className="w-4 h-4" /> Descargar PDFs
        </button>
      </div>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} className="text-center p-4">Cargando...</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={7} className="text-center p-4">No hay mantenimientos</td></tr>
          ) : (
            filtered.map(m => (
              <tr key={m.id} className="border-b">
                <td className="p-2">{m.building_name || '-'}</td>
                <td className="p-2">{m.building_address || '-'}</td>
                <td className="p-2">{m.elevators_count ?? '-'}</td>
                <td className="p-2">{m.client?.company_name || '-'}</td>
                <td className="p-2">{m.created_at ? m.created_at.split('T')[0] : '-'}</td>
                <td className="p-2">{m.is_active ? 'Activo' : 'Inactivo'}</td>
                <td className="p-2 flex gap-2">
                  <button
                    className="text-blue-600 hover:underline flex items-center gap-1"
                    onClick={onNewMaintenance}
                  >
                    <Plus className="w-4 h-4" /> Ver mantenimiento
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
