import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Filter } from 'lucide-react';
import { TechnicianEmergencyView } from './TechnicianEmergencyView';

interface Emergency {
  id: string;
  elevator_code: string;
  building_name: string;
  client: { company_name: string };
  status: string;
  created_at: string;
}

interface Filters {
  building: string;
  elevator: string;
  client: string;
  year: string;
  status: string;
}

export function AdminEmergenciesDashboard() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [filtered, setFiltered] = useState<Emergency[]>([]);
  const [filters, setFilters] = useState<Filters>({ building: '', elevator: '', client: '', year: '', status: '' });
  const [buildingOptions, setBuildingOptions] = useState<string[]>([]);
  const [elevatorOptions, setElevatorOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [showNewEmergency, setShowNewEmergency] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmergencies();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, emergencies]);

  const loadEmergencies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('emergencies')
        .select(`id, elevator_code, building_name, status, created_at, client:client_id (company_name)`) // Ajusta según tu estructura real
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEmergencies(data || []);
      // Opciones únicas para selects
      setBuildingOptions(Array.from(new Set((data || []).map((e: any) => e.building_name).filter(Boolean))));
      setElevatorOptions(Array.from(new Set((data || []).map((e: any) => e.elevator_code).filter(Boolean))));
      setClientOptions(Array.from(new Set((data || []).map((e: any) => e.client?.company_name).filter(Boolean))));
      setYearOptions(Array.from(new Set((data || []).map((e: any) => e.created_at?.slice(0,4)).filter(Boolean))));
      setStatusOptions(Array.from(new Set((data || []).map((e: any) => e.status).filter(Boolean))));
    } catch (err) {
      setEmergencies([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...emergencies];
    if (filters.building) result = result.filter(e => e.building_name === filters.building);
    if (filters.elevator) result = result.filter(e => e.elevator_code === filters.elevator);
    if (filters.client) result = result.filter(e => e.client?.company_name === filters.client);
    if (filters.year) result = result.filter(e => e.created_at.startsWith(filters.year));
    if (filters.status) result = result.filter(e => e.status === filters.status);
    setFiltered(result);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  if (showNewEmergency) {
    return <TechnicianEmergencyView />;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Emergencias</h1>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          onClick={() => setShowNewEmergency(true)}
          title="Nueva emergencia"
        >
          <Plus className="w-5 h-5" /> Nueva Emergencia
        </button>
      </div>
      <div className="flex gap-2 mb-4">
        <select className="px-3 py-2 border rounded" name="building" value={filters.building} onChange={handleFilterChange}>
          <option value="">Filtrar por edificio</option>
          {buildingOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select className="px-3 py-2 border rounded" name="elevator" value={filters.elevator} onChange={handleFilterChange}>
          <option value="">Filtrar por ascensor</option>
          {elevatorOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select className="px-3 py-2 border rounded" name="client" value={filters.client} onChange={handleFilterChange}>
          <option value="">Filtrar por cliente</option>
          {clientOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select className="px-3 py-2 border rounded" name="year" value={filters.year} onChange={handleFilterChange}>
          <option value="">Filtrar por año (YYYY)</option>
          {yearOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <select className="px-3 py-2 border rounded" name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">Filtrar por estado</option>
          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Ascensor</th>
            <th className="p-2">Edificio</th>
            <th className="p-2">Cliente</th>
            <th className="p-2">Fecha</th>
            <th className="p-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="text-center p-4">Cargando...</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={5} className="text-center p-4">No hay emergencias</td></tr>
          ) : (
            filtered.map(e => (
              <tr key={e.id} className="border-b">
                <td className="p-2">{e.elevator_code || '-'}</td>
                <td className="p-2">{e.building_name || '-'}</td>
                <td className="p-2">{e.client?.company_name || '-'}</td>
                <td className="p-2">{e.created_at ? e.created_at.split('T')[0] : '-'}</td>
                <td className="p-2">{e.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
